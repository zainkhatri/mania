import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { motion } from 'framer-motion';
import { TextColors } from './ColorPicker';
import html2canvas from 'html2canvas';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { jsPDF } from 'jspdf';

// Define types for image positioning
export interface ImagePosition {
  x: number;       // x coordinate percentage (0-100)
  y: number;       // y coordinate percentage (0-100)
  width: number;   // width percentage (0-100)
  height: number;  // height percentage (0-100)
  rotation: number; // rotation in degrees
  flipH: boolean;  // flip horizontally
  flipV: boolean;  // flip vertically
  zIndex: number;  // z-index for layering (higher numbers appear on top)
}

// Define draggable image information
export interface DraggableImageInfo {
  index: number;
  isDragging: boolean;
  offsetX: number;
  offsetY: number;
}

// Color theme options for text shadows
export type ColorTheme = 'classic' | 'pastel' | 'monochrome' | 'forest' | 'sunset' | 'ocean';

// Define clickable text area
export interface ClickableTextArea {
  type: 'location' | 'text' | 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  index?: number; // For text sections or images
}

// 1. Sticker type and state additions
interface StickerImage {
  src: string | Blob;
  x: number; // px
  y: number; // px
  width: number; // px
  height: number; // px
  rotation: number; // degrees
  zIndex: number;
  imageObj?: HTMLImageElement; // for caching loaded image
  originalWidth?: number; // store original width for high quality rendering
  originalHeight?: number; // store original height for high quality rendering
}

// Add this interface for drag and pinch operations
interface StickerDragData {
  x: number;
  y: number;
  initialPinchDistance?: number;
  initialWidth?: number;
  initialHeight?: number;
  initialTouchAngle?: number;
  initialRotation?: number;
}

interface JournalCanvasProps {
  date: Date;
  location: string;
  textSections: string[];  // We'll combine these into one continuous text
  images: (string | Blob)[];  // Allow File/Blob objects or URL strings
  onNewEntry: () => void;
  templateUrl?: string; // Add optional template URL prop
  textColors?: TextColors; // Direct color customization
  layoutMode?: 'standard' | 'mirrored'; // Layout mode for the journal
  editMode?: boolean; // Whether we're in edit mode
  onTextClick?: (area: ClickableTextArea) => void; // Callback when text is clicked
  onImageDrag?: (index: number, x: number, y: number) => void; // Callback when image is dragged
  onImageClick?: (x: number, y: number) => void; // Callback when image is clicked for eyedropper
  forceUpdate?: number; // Add timestamp to force updates
  onAddSticker?: (e: React.ChangeEvent<HTMLInputElement>) => void; // Add callback for sticker button
  template?: {
    name: string;
    backgroundColor: string;
    textColor: string;
    accentColor: string;
    fontFamily: string;
    fontWeight: string;
    fontSize: string;
    lineHeight: string;
    textAlign: string;
    padding: string;
    borderRadius: string;
    showDate: boolean;
    showLocation: boolean;
    dateFormat: string;
  };
}

// Export the imperative handle type
export interface JournalCanvasHandle {
  addSticker: (file: File, width?: number, height?: number) => void;
  addMultipleStickers: (files: File[]) => void;
}

// Helper function to adjust color brightness 
// (positive value brightens, negative value darkens)
function adjustColor(hex: string, percent: number): string {
  // Convert hex to RGB
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  
  // Adjust brightness
  r = Math.max(0, Math.min(255, r + Math.round(r * percent / 100)));
  g = Math.max(0, Math.min(255, g + Math.round(g * percent / 100)));
  b = Math.max(0, Math.min(255, b + Math.round(b * percent / 100)));
  
  // Convert back to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Simple, bold SF Symbol paths for controls
const SF_SYMBOLS_PATHS = {
  // Simple X for delete
  delete: {
    path: "M8.5 8.5L15.5 15.5M15.5 8.5L8.5 15.5",
    width: 24,
    height: 24,
    centerX: 12,
    centerY: 12
  },
  // Simple rotate arrow
  rotate: {
    path: "M12 5.75V8.25M16.25 7.75L14.25 9.75M7.75 7.75L9.75 9.75M16 12.25C16 9.35 13.65 7 10.75 7C7.85 7 5.5 9.35 5.5 12.25C5.5 15.15 7.85 17.5 10.75 17.5C13.65 17.5 16 15.15 16 12.25Z",
    width: 24,
    height: 24,
    centerX: 12,
    centerY: 12
  },
  // Simple resize arrows
  resize: {
    path: "M9 15L15 9M15 15L9 9",
    width: 24,
    height: 24,
    centerX: 12,
    centerY: 12
  }
};

// Change to use forwardRef
const JournalCanvas = forwardRef<JournalCanvasHandle, JournalCanvasProps>(({
  date,
  location,
  textSections,
  images,
  onNewEntry,
  templateUrl = '/templates/goodnotes-a6-yellow.jpg', // Use EXACTLY this template
  textColors = {
    locationColor: '#3498DB',
    locationShadowColor: '#AED6F1'
  },
  layoutMode = 'standard', // Default to standard layout
  onAddSticker,
  template = {
    name: 'Default',
    backgroundColor: '#111111', // Dark background
    textColor: '#22c55e', // Green text
    accentColor: '#15803d', // Dark green accent
    fontFamily: 'Arial, sans-serif',
    fontWeight: '400',
    fontSize: '16px',
    lineHeight: '1.5',
    textAlign: 'left',
    padding: '40px',
    borderRadius: '12px',
    showDate: true,
    showLocation: true,
    dateFormat: 'MMMM DD, YYYY'
  },
  ...props
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isRendering, setIsRendering] = useState(false);
  const [activeBoxes, setActiveBoxes] = useState<string[]>([]);
  const [clickableAreas, setClickableAreas] = useState<ClickableTextArea[]>([]);
  const [draggingImage, setDraggingImage] = useState<DraggableImageInfo | null>(null);
  const imagePositionsRef = useRef<ImagePosition[]>([]);
  const [imageObjects, setImageObjects] = useState<HTMLImageElement[]>([]);
  const [templateImage, setTemplateImage] = useState<HTMLImageElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [forceRender, setForceRender] = useState(0); // Add state to force re-renders
  const [renderCount, setRenderCount] = useState(0);
  const [stickers, setStickers] = useState<StickerImage[]>([]);
  const [activeSticker, setActiveSticker] = useState<number | null>(null);
  const [stickerDragOffset, setStickerDragOffset] = useState<StickerDragData | null>(null);
  const [stickerAction, setStickerAction] = useState<'move' | 'resize' | 'rotate' | null>(null);
  const [canvasCursor, setCanvasCursor] = useState<string>('default');
  const [isDragging, setIsDragging] = useState(false);
  const [buttonClickHandling, setButtonClickHandling] = useState(false);
  const [stickerButtonsData, setStickerButtonsData] = useState<{
    deleteBtn: {x: number, y: number} | null,
    rotateBtn: {x: number, y: number} | null,
    resizeBtn: {x: number, y: number} | null
  }>({
    deleteBtn: null,
    rotateBtn: null,
    resizeBtn: null
  });
  const [hoveredButton, setHoveredButton] = useState<'delete' | 'rotate' | 'resize' | null>(null);
  const [debounceRender, setDebounceRender] = useState(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Function to trigger a re-render when needed
  const renderJournal = useCallback(() => {
    setForceRender(prev => prev + 1); // Increment to trigger a re-render
  }, []);
  
  // Font loading using FontFace API
  useEffect(() => {
    // Add timestamp to prevent caching of the font files
    const timestamp = new Date().getTime();
    const contentFontUrl = `${process.env.PUBLIC_URL}/font/zain.ttf?v=${timestamp}`; // For journal content
    const titleFontUrl = `${process.env.PUBLIC_URL}/font/titles.ttf?v=${timestamp}`; // Corrected font name for location
    
    // Load the fonts
    const loadFonts = async () => {
      try {
        console.log('Starting to load custom fonts...');
        
        // Load content font
        const contentFont = new FontFace('ZainCustomFont', `url(${contentFontUrl})`, {
          style: 'normal',
          weight: '400',
          display: 'swap'
        });
        
        // Load title font
        const headingFont = new FontFace('TitleFont', `url(${titleFontUrl})`, {
          style: 'normal',
          weight: '700', // Make title font bold for better visibility
          display: 'swap'
        });
        
        try {
          // Attempt to clear font cache
          if ('fonts' in document) {
            document.fonts.clear();
            console.log('Font cache cleared');
          }
        } catch (e) {
          console.warn('Failed to clear font cache, continuing anyway:', e);
        }
        
        // Load both fonts and add to document
        const loadedContentFont = await contentFont.load();
        document.fonts.add(loadedContentFont);
        console.log('Content font loaded successfully');
        
        try {
          const loadedTitleFont = await headingFont.load();
          document.fonts.add(loadedTitleFont);
          console.log('Title font loaded successfully: ', titleFontUrl);
          
          // Force a redraw when fonts are loaded
          setTimeout(() => {
            console.log('Forcing redraw after font load');
            setForceRender(prev => prev + 1);
          }, 100);
        } catch (titleErr) {
          console.warn('Failed to load title font, continuing with standard fonts:', titleErr);
        }
        
        // Mark fonts as loaded and remove loading state
        setFontLoaded(true);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading fonts:', err);
        // Continue without custom fonts
        setFontLoaded(false);
        setIsLoading(false);
      }
    };
    
    loadFonts();
    
    // Add a fallback to ensure loading state is cleared even if fonts fail
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.warn('Font loading timed out, continuing without custom fonts');
        setIsLoading(false);
      }
    }, 3000); // 3 second timeout
    
    return () => clearTimeout(timeout);
  }, []);
  
  // Format date in handwritten style
  const formatDate = (date: Date): string => {
    // Create a new date object that preserves the selected day without timezone issues
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const adjustedDate = new Date(year, month, day, 12, 0, 0);
    
    // Helper function to get ordinal suffix
    const getOrdinalSuffix = (day: number): string => {
      if (day > 3 && day < 21) return 'TH';
      switch (day % 10) {
        case 1: return 'ST';
        case 2: return 'ND';
        case 3: return 'RD';
        default: return 'TH';
      }
    };

    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    
    // Format the date without ordinal first using adjusted date
    let dateStr = adjustedDate.toLocaleDateString('en-US', options);
    
    // Extract the day number and add the ordinal suffix
    const ordinalSuffix = getOrdinalSuffix(day);
    
    // Replace the day number with day + ordinal suffix
    dateStr = dateStr.replace(/(\d+)/, `$1${ordinalSuffix}`);
    
    // Fix double commas - remove any existing comma after the day before adding our own
    dateStr = dateStr.replace(/(\d+[A-Z]+),/, '$1');
    
    // Make sure there's a comma after the ordinal suffix
    dateStr = dateStr.replace(/(\d+[A-Z]+)/, '$1,');
    
    return dateStr.toUpperCase();
  };

  // Combine all text sections into one continuous text
  const getCombinedText = useCallback((): string => {
    // If there's just a single string in the array, return it directly
    // Otherwise join the text sections without adding any separators
    return textSections.length === 1 ? textSections[0] : textSections.join('').trim();
  }, [textSections]);

  // Preload template and images
  useEffect(() => {
    if (isLoading) return; // Wait for font loading state to be cleared
    
    console.log('Starting to load template and images');
    setIsLoading(true);
    const loadTemplateAndImages = async () => {
      try {
        // Load template first
        const template = new Image();
        template.crossOrigin = 'anonymous'; // In case the template is hosted elsewhere
        
        console.log('Attempting to load template from:', templateUrl);
        
        const templatePromise = new Promise<HTMLImageElement | null>((resolve) => {
          template.onload = () => {
            console.log('Template loaded successfully:', template.width, 'x', template.height);
            resolve(template);
          };
          template.onerror = (err) => {
            console.error('Failed to load template image with cache buster:', err);
            // Try loading without cache buster
            console.log('Attempting to load template without cache buster:', templateUrl);
            template.src = templateUrl;
            template.onload = () => {
              console.log('Template loaded successfully without cache buster:', template.width, 'x', template.height);
              resolve(template);
            };
            template.onerror = () => {
              console.error('Failed to load template image even without cache buster');
              // Try one more time with a different path
              const altPath = templateUrl.startsWith('/') ? templateUrl.slice(1) : '/' + templateUrl;
              console.log('Attempting to load template with alternate path:', altPath);
              template.src = altPath;
              template.onload = () => {
                console.log('Template loaded successfully with alternate path:', template.width, 'x', template.height);
                resolve(template);
              };
              template.onerror = () => {
                console.error('All template loading attempts failed');
                resolve(null);
              };
            };
          };
          // Add timestamp to prevent caching issues
          const cacheBuster = `?v=${new Date().getTime()}`;
          template.src = templateUrl.includes('?') ? templateUrl : templateUrl + cacheBuster;
        });
        
        const loadedTemplate = await templatePromise;
        if (!loadedTemplate) {
          console.error('Could not load template, falling back to default background');
        } else {
          console.log('Template loaded and ready to use:', loadedTemplate.width, 'x', loadedTemplate.height);
        }
        setTemplateImage(loadedTemplate);
        
        console.log('Debug: Images to load:', images.length);
        
        // Then load the regular images
        const loadedImages: HTMLImageElement[] = [];
        
        // Create an array of promises for loading each image
        const imagePromises = images.map((src) => {
          return new Promise<HTMLImageElement | null>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous'; // Set crossOrigin for all images to prevent tainted canvas
            img.onload = () => {
              console.log('Debug: Image loaded successfully');
              resolve(img);
            };
            img.onerror = (err) => {
              console.error('Failed to load image:', err);
              resolve(null);
            };
            // Determine source type
            if (typeof src === 'string') {
              console.log('Debug: Loading image from URL');
              // Use the direct source without cache busting to avoid rendering issues
              img.src = src;
            } else {
              // Blob (File) object
              console.log('Debug: Loading image from Blob');
              img.src = URL.createObjectURL(src);
            }
            
            // Standard decoding is more reliable
            img.decoding = 'auto';
          });
        });
        
        // Resolve all promises
        if (imagePromises.length > 0) {
          const results = await Promise.all(imagePromises);
          // Fix the linter error by using type guard to filter out nulls
          const validImages = results.filter((img): img is HTMLImageElement => img !== null);
          console.log('Debug: Successfully loaded images:', validImages.length);
          loadedImages.push(...validImages);
        } else {
          console.log('Debug: No images to load');
        }
        
        setImageObjects(loadedImages);
      } catch (err) {
        console.error('Error loading template or images:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTemplateAndImages();
  }, [images, templateUrl, fontLoaded]);

  // Helper to draw images preserving aspect ratio, border, rotation, flipping, and quality
  const drawImagePreservingAspectRatio = (
    img: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number,
    addBorder = false,
    rotation = 0,
    flipH = false,
    flipV = false,
    enhancedQuality = false
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    try {
      // Ensure high quality image rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Calculate aspect ratios to maintain proportions
      const imgAspect = img.width / img.height;
      const targetAspect = width / height;
      let drawWidth: number, drawHeight: number, drawX: number, drawY: number;
      
      // Determine dimensions that preserve aspect ratio
      if (imgAspect > targetAspect) {
        drawWidth = width;
        drawHeight = width / imgAspect;
        drawX = x;
        drawY = y + (height - drawHeight) / 2;
      } else {
        drawHeight = height;
        drawWidth = height * imgAspect;
        drawX = x + (width - drawWidth) / 2;
        drawY = y;
      }
      
      ctx.save();
      
      // Apply transformations (translate, rotate, scale)
      ctx.translate(drawX + drawWidth / 2, drawY + drawHeight / 2);
      if (rotation) ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      
      if (addBorder) {
        // Draw a subtle dark outline instead of white border
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.strokeRect(-drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      }
      
      // Use a two-step drawing process for better quality:
      // 1. Draw to an intermediate canvas at full resolution
      // 2. Draw the intermediate canvas to the final canvas
      
      // Create temporary canvas for higher quality rendering
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d', { 
        alpha: true,
        colorSpace: 'srgb',
        desynchronized: false
      });
      
      if (tempCtx) {
        // High quality mode for main images
      // Use larger canvas for better scaling
      const scaleFactor = 1.5;
      tempCanvas.width = Math.max(img.width * scaleFactor, drawWidth * 1.5);
      tempCanvas.height = Math.max(img.height * scaleFactor, drawHeight * 1.5);
      
      // Apply maximum quality settings
      tempCtx.imageSmoothingEnabled = true;
      tempCtx.imageSmoothingQuality = 'high';
      
      // First draw image to temp canvas at larger size for better quality
      tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
      
      // Now draw from the temp canvas to the main canvas
      ctx.drawImage(tempCanvas, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      } else {
        // Fallback to direct drawing if tempCtx fails
        ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      }
      
      ctx.restore();
    } catch (err) {
      console.error('Error drawing image:', err);
    }
  };

  // Use debounce to limit renders
  const debouncedRender = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebounceRender(prev => prev + 1);
    }, 16); // ~60fps
  }, []);

  // Add this function before renderCanvas
  const getDefaultLocationFontSize = (ctx: CanvasRenderingContext2D, canvasWidth: number): number => {
    // Create a 12-character test string
    const testLocation = 'ABCDEFGHIJKL';
    
    // Calculate font size for 12 characters
    return calculateOptimalFontSize(
      ctx,
      testLocation,
      canvasWidth - 80, // Same padding as used in location drawing
      "'TitleFont', sans-serif",
      60,
      600
    );
  };

  // Draw the canvas with all elements - optimized with useMemo for heavy calculation 
  useEffect(() => {
    if (!canvasRef.current) return;
    if (isLoading) return; // Don't draw while loading
    
    const renderCanvas = () => {
    // Check for global flag to force redraw
    if (window.FORCE_CANVAS_REDRAW) {
      console.log('Forced redraw triggered with colors:', window.CURRENT_COLORS);
      window.FORCE_CANVAS_REDRAW = false;
    }
    
    // Log re-render trigger
    console.log('Re-rendering canvas with colors:', textColors);
    console.log('Force update timestamp:', props.forceUpdate);
    
    const canvas = canvasRef.current;
      if (!canvas) return;
      
          // Create an optimized rendering context
    const ctx = canvas.getContext('2d', { 
      alpha: true, 
      willReadFrequently: false, // Disable for better performance
      desynchronized: true, // Enable for better performance
    });
    if (!ctx) return;
    
    try {
      // Use higher resolution for image quality
      canvas.width = 3100; // 2.5x from 1240
      canvas.height = 4370; // 2.5x from 1748
      
      // Enable quality rendering but without excessive filtering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Remove filters for better performance
      
      // Clear canvas and fill with template background color
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f5f2e9'; // Match the template's cream color
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw template
      if (templateImage) {
        console.log('Drawing template:', templateImage.width, 'x', templateImage.height);
        // Save current context state
        ctx.save();
        
        // Ensure high quality rendering for template
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw template to fill the entire canvas exactly
        try {
          ctx.drawImage(templateImage, 0, 0, canvas.width, canvas.height);
          console.log('Template drawn successfully');
        } catch (err) {
          console.error('Error drawing template:', err);
          // If drawing fails, try to draw at original size
          try {
            ctx.drawImage(templateImage, 0, 0, templateImage.width, templateImage.height);
            console.log('Template drawn at original size');
          } catch (err) {
            console.error('Failed to draw template even at original size:', err);
          }
        }
        
        // Restore context state
        ctx.restore();
      } else {
        console.log('No template image available, using default background');
      }
      
      // Calculate dimensions to use full page height
      const topMargin = 80; // Doubled from 20
      const minSpacingBetweenElements = -40; // Doubled from 10
      let currentYPosition = topMargin + 100; // Moved down to be closer to location
      const headerHeight = 360; // Doubled from 180
      const contentHeight = canvas.height - topMargin - headerHeight - 40; // Doubled bottom margin
      const rowHeight = contentHeight / 3; // Divide remaining space into 3 equal rows
      
      // Ensure the grid layout allows content to fill full width
      const fullWidth = canvas.width; // Use the full canvas width
      
      // Adjust ratio to give more space to text and fill entire canvas
      const imageColumnWidth = fullWidth * 0.55; // Wider images
      const textColumnWidth = fullWidth * 0.45; // Wider text
      
      // Define grid layout that fills the entire canvas with no margins
      let gridLayout;
      
      if (layoutMode === 'standard') {
        // Standard layout (original): Images on left, text on right
        gridLayout = [
          // Row 1 - Date spans full width (moved up further)
          { type: 'date', x: 0, y: currentYPosition + 10, width: fullWidth, height: 0 },
          // Row 2 - Location spans full width (moved closer to date)
          { type: 'location', x: -10, y: currentYPosition + 10, width: fullWidth, height: 0 },
          // Row 3 - Left image, right text
          { type: 'image', x: 30, y: topMargin + headerHeight + 115, width: imageColumnWidth - 70, height: rowHeight - 30 },
          { type: 'text', x: imageColumnWidth - 50, y: topMargin + headerHeight, width: textColumnWidth + 100, height: rowHeight },
          // Row 4 - Left text, right image
          { type: 'text', x: 0, y: topMargin + headerHeight + rowHeight + 10, width: textColumnWidth + 85, height: rowHeight },
          { type: 'image', x: textColumnWidth + 50, y: topMargin - 30 + headerHeight + rowHeight + 60, width: imageColumnWidth - 70, height: rowHeight + 70 },
          // Row 5 - Third image with consistent margins
          { type: 'image', x: 30, y: topMargin + headerHeight + (rowHeight * 2) + 40, width: imageColumnWidth - 40, height: rowHeight + 20 },
          { type: 'text', x: imageColumnWidth - 40, y: topMargin + headerHeight + (rowHeight * 2) + 20, width: fullWidth - imageColumnWidth + 90, height: rowHeight + 100 }
        ];
      } else {
        // Mirrored layout: Text on left, images on right
        gridLayout = [
          // Row 1 - Date spans full width
          { type: 'date', x: 0, y: currentYPosition + 10, width: fullWidth, height: 0 },
          // Row 2 - Location spans full width
          { type: 'location', x: -10, y: currentYPosition + 10, width: fullWidth, height: 0 },
          // Row 3 - Left text, right image (mirroring Row 3 of Style 1)
          { type: 'text', x: -10, y: topMargin + headerHeight, width: textColumnWidth + 90, height: rowHeight },
          { type: 'image', x: textColumnWidth + 50, y: topMargin + headerHeight + 115, width: imageColumnWidth - 70, height: rowHeight - 30 },
          // Row 4 - Left image, right text (mirroring Row 4 of Style 1)
          { type: 'image', x: 30, y: topMargin - 30 + headerHeight + rowHeight + 60, width: imageColumnWidth - 70, height: rowHeight + 70 },
          { type: 'text', x: imageColumnWidth - 50, y: topMargin + headerHeight + rowHeight + 10, width: textColumnWidth + 100, height: rowHeight },
          // Row 5 - Left text, right image (mirroring Row 5 of Style 1)
          { type: 'text', x: -10, y: topMargin + headerHeight + (rowHeight * 2) + 20, width: textColumnWidth + 90, height: rowHeight + 100 },
          { type: 'image', x: textColumnWidth + 50, y: topMargin + headerHeight + (rowHeight * 2) + 40, width: imageColumnWidth - 40, height: rowHeight + 20 }
        ];
      }
      
      // Extract text areas and image positions from grid layout
      const textAreas = gridLayout.filter(item => item.type === 'text');
      const imagePositions = gridLayout
        .filter(item => item.type === 'image')
        .map(item => ({
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          rotation: 0,
          flipH: false,
          flipV: false,
          zIndex: 1 // Keeping this low so text appears on top
        }));
      
      // Track clickable areas for interactivity
      const newClickableAreas: ClickableTextArea[] = [];
      
      // Draw date at the top with proper alignment and font size
      const dateCell = gridLayout.find(cell => cell.type === 'date');
      if (dateCell) {
        const dateText = formatDate(date);
        try {
          // Find optimal font size for date
          const maxDateFontSize = calculateOptimalFontSize(
            ctx, 
            dateText, 
            dateCell.width - 40,
            "'TitleFont', sans-serif",
            120,
            300
          );
          
          // Set font and color - always black for date text
          ctx.fontKerning = 'normal';
          ctx.font = `${maxDateFontSize}px 'TitleFont', sans-serif`;
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'left';
          
          // Apply text enhancement techniques
          if (ctx.shadowBlur !== undefined) {
            ctx.shadowColor = 'rgba(0,0,0,0.01)';
            ctx.shadowBlur = 0.5;
            ctx.shadowOffsetX = 0.2;
            ctx.shadowOffsetY = 0.2;
          }
          
          // Calculate metrics for the date text
          const dateMetrics = ctx.measureText(dateText);
          let dateTextBaselineOffset;
          if (dateMetrics.fontBoundingBoxDescent) {
            dateTextBaselineOffset = dateMetrics.fontBoundingBoxDescent;
          } else {
            dateTextBaselineOffset = maxDateFontSize * 0.2;
          }
          
          // Draw the date text (moved down)
          ctx.fillText(dateText, dateCell.x + 20, dateCell.y + 25);
          
          // Calculate the Y position for the location with minimal spacing
          currentYPosition = dateCell.y + dateTextBaselineOffset + minSpacingBetweenElements + 15; // Increased spacing
          
          // Update the location cell's Y position
          const locationCell = gridLayout.find(cell => cell.type === 'location');
          if (locationCell) {
            locationCell.y = currentYPosition;
          }
        } catch (err) {
          console.error('Error drawing date:', err);
          // Fallback position if date rendering fails
          currentYPosition = topMargin + 280; // Keep consistent with new position
          
          // Update the location cell's Y position with fallback value
          const locationCell = gridLayout.find(cell => cell.type === 'location');
          if (locationCell) {
            locationCell.y = currentYPosition;
          }
        }
      }
      
      // Get the location cell for later use (moved drawing to end)
      const locationCell = gridLayout.find(cell => cell.type === 'location');
      
      // Get combined text from all sections
      const journalText = getCombinedText();
      
      // Remove the red guide lines section and use these exact coordinates for text placement
      const journalLineYCoords = [
        700, 890, 1070, 1250, 1430, 1610, 1800, 1980, 2160, 2340, 
        2520, 2700, 2880, 3060, 3240, 3440, 3620, 3800, 3990, 4160, 4330
      ];

      // Draw continuous text that flows through all text boxes
      if (journalText) {
        try {
          // Calculate the optimal font size for text sections
          const minFontSize = 28; // Doubled from 14
          const maxFontSize = 140; // Doubled from 70
          const totalLines = 21; // Updated to match new line count
          const words = journalText.split(' ');
          
          // Use binary search to find the largest font size that fits
          let low = minFontSize;
          let high = maxFontSize;
          let fontSize = minFontSize;
          
          // Create a fixed text with 98 words to use as a reference for font sizing
          const referenceText = Array(98).fill("word").join(" ");
          const referenceWords = referenceText.split(' ');
          
          // Function to count lines with our reference text (98 words)
          const countReferenceLines = (size: number): number => {
            try {
              const testFontString = `${size}px ZainCustomFont, Arial, sans-serif`;
              ctx.font = testFontString;
              
              const smallestAreaWidth = Math.min(
                textAreas[0].width - 160,
                textAreas[1].width - 160,
                textAreas[2].width - 160
              );
              
              let lines = 0;
              let currentLine = '';
              
              for (const word of referenceWords) {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                const metrics = ctx.measureText(testLine);
                
                if (metrics.width > smallestAreaWidth && currentLine) {
                  lines++;
                  currentLine = word;
                } else {
                  currentLine = testLine;
                }
              }
              
              if (currentLine) {
                lines++;
              }
              
              return lines;
            } catch (err) {
              console.error('Error counting reference lines:', err);
              return totalLines + 1;
            }
          };
          
          // Calculate optimal font size
          while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const lineCount = countReferenceLines(mid);
            
            if (lineCount <= totalLines) {
              fontSize = mid;
              low = mid + 1;
            } else {
              high = mid - 1;
            }
          }
          
          // Fine tune the reference font size
          while (fontSize < maxFontSize && countReferenceLines(fontSize + 1) <= totalLines) {
            fontSize += 1;
          }
          
          // Adjust final font size for better readability
          fontSize = Math.max(minFontSize, fontSize * 0.85);
          
          // Set the font with our precisely determined size for content text
          ctx.fontKerning = 'normal';
          const fontString = `990 ${fontSize}px ZainCustomFont, Arial, sans-serif`;
          ctx.font = fontString;
          ctx.fillStyle = '#000000';
          
          // Reset any shadow settings before journal text
          ctx.shadowColor = 'rgba(0,0,0,0)';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          
          // Split text into words for layout
          let currentWord = 0;
          let currentLine = '';
          
          // Define line ranges for each text area to create the snake pattern
          const textAreaLineRanges = [
            { startLine: 0, endLine: 6 },      // First 7 lines in the first text area
            { startLine: 7, endLine: 13 },     // Next 7 lines in the second text area
            { startLine: 14, endLine: 20 }     // Last 7 lines in the third text area
          ];
          
          // Order text areas to match the snake pattern
          const orderedTextAreas = [
            textAreas[0], // First text area (right)
            textAreas[1], // Second text area (left)
            textAreas[2]  // Third text area (right)
          ];
          
          // Process each text area in the specific snake order
          for (let areaIndex = 0; areaIndex < orderedTextAreas.length && currentWord < words.length; areaIndex++) {
            const area = orderedTextAreas[areaIndex];
            const areaX = area.x + 60;
            const areaWidth = area.width - 160;
            const lineRange = textAreaLineRanges[areaIndex];
            
            // Add this text area to clickable areas
            newClickableAreas.push({
              type: 'text',
              x: area.x,
              y: area.y,
              width: area.width,
              height: area.height,
              text: textSections[areaIndex] || '',
              index: areaIndex
            });
            
            // Reset line for this text area
            currentLine = '';
            
            // Process only the specific range of lines for this text area
            for (let lineIndex = lineRange.startLine; lineIndex <= lineRange.endLine && currentWord < words.length; lineIndex++) {
              // Use the exact y-coordinate from our array
              const currentY = journalLineYCoords[lineIndex];
              
              // Build the line by adding words until we reach the max width
              while (currentWord < words.length) {
                const nextWord = words[currentWord];
                const testLine = currentLine ? `${currentLine} ${nextWord}` : nextWord;
                const metrics = ctx.measureText(testLine);
                
                if (metrics.width > areaWidth && currentLine) {
                  // Line is full, draw it and move to the next line
                  ctx.fillText(currentLine, areaX, currentY);
                  currentLine = '';
                  break;
                } else {
                  // Add word to current line and continue
                  currentLine = testLine;
                  currentWord++;
                }
              }
              
              // If we've processed all words or this is the last line in the range, draw any remaining text
              if (currentWord >= words.length || lineIndex === lineRange.endLine) {
                if (currentLine) {
                  ctx.fillText(currentLine, areaX, currentY);
                  currentLine = '';
                }
              }
            }
          }
        } catch (err) {
          console.error('Error drawing journal text:', err);
        }
      }
      
      // Draw each image with its position, with proper borders and padding
      try {
        const maxImages = Math.min(imageObjects.length, imagePositions.length);
        for (let i = 0; i < maxImages; i++) {
          const img = imageObjects[i];
          const position = imagePositions[i];
          
          // Use the high-quality drawing function for all images with enhanced quality
          drawImagePreservingAspectRatio(
            img,
            position.x, 
            position.y, 
            position.width, 
            position.height, 
            true, // Add a subtle border for definition
            position.rotation,
            position.flipH,
            position.flipV
          );
          
          // Add image to clickable areas for eyedropper functionality
          newClickableAreas.push({
            type: 'image',
            x: position.x,
            y: position.y,
            width: position.width,
            height: position.height,
            text: '',
            index: i
          });
        }
      } catch (err) {
        console.error('Error drawing images:', err);
      }
      
      // Draw location LAST (after all other elements) to ensure it's on top of everything
      if (locationCell && location) {
        try {
          // Get the default font size for 12 characters
          const defaultFontSize = getDefaultLocationFontSize(ctx, canvas.width);
          
          // Use this as the maximum font size
          const maxLocationFontSize = Math.min(
            defaultFontSize,
            calculateOptimalFontSize(
              ctx, 
              location.toUpperCase(), 
              canvas.width - 80,
              "'TitleFont', sans-serif",
              60,
              defaultFontSize // Use the 12-char size as the maximum
            )
          );
          
          // Determine colors - use direct selection if provided, otherwise use default  
          const locationColor = window.FORCE_CANVAS_REDRAW 
            ? window.CURRENT_COLORS.locationColor 
            : (textColors.locationColor || '#3498DB');
          const locationShadowColor = window.FORCE_CANVAS_REDRAW 
            ? window.CURRENT_COLORS.locationShadowColor 
            : (textColors.locationShadowColor || '#AED6F1');
              
          // Reset any existing filters or shadow settings
          ctx.filter = 'none';
          ctx.shadowColor = 'rgba(0,0,0,0)';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          
          // Log the color values for debugging
          console.log("Applying location colors:", {
            mainColor: locationColor,
            shadowColor: locationShadowColor
          });
          
          ctx.font = `${maxLocationFontSize}px 'TitleFont', sans-serif`;
          ctx.textAlign = 'left'; // Ensure text is left-aligned
          
          // For the location, we'll ensure it's drawn last (on top of all other elements)
          ctx.save();
          
          // Calculate the text metrics for proper positioning
          const locationMetrics = ctx.measureText(location.toUpperCase());
          let locationBaseline;
          if (locationMetrics.fontBoundingBoxAscent) {
            locationBaseline = locationMetrics.fontBoundingBoxAscent;
          } else {
            // Fallback: estimate ascent as 0.8x the font size
            locationBaseline = maxLocationFontSize * 0.8;
          }
          
          // Position the location baseline for tight spacing
          const yPosition = locationCell.y + locationBaseline;
          
          // Clear any previous text in this area to prevent ghosting
          ctx.save();
          ctx.fillStyle = "#ffffff";
          ctx.globalAlpha = 0; // Make it invisible
          ctx.fillRect(locationCell.x, locationCell.y - maxLocationFontSize, locationCell.width, maxLocationFontSize * 2);
          ctx.restore();
          
          // Shadow layer with customizable offsets
          const shadowOffsetX = 25;
          const shadowOffsetY = 25;
          
          ctx.fillStyle = locationShadowColor;
          ctx.fillText(location.toUpperCase(), 40 + shadowOffsetX, yPosition + shadowOffsetY);

          // Main text
          ctx.fillStyle = locationColor;
          ctx.fillText(location.toUpperCase(), 40, yPosition);
          
          ctx.restore();
        } catch (err) {
          console.error('Error drawing location:', err);
        }
      }
      
      // Add location to clickable areas
      if (locationCell) {
        newClickableAreas.push({
          type: 'location',
          x: locationCell.x,
          y: locationCell.y,
          width: locationCell.width,
          height: locationCell.height,
          text: location
        });
      }
      
      // Update clickable areas state for interactivity
      setClickableAreas(newClickableAreas);
      
      // Store image positions for dragging
      imagePositionsRef.current = imagePositions;

      // Draw stickers after main content
      if (stickers.length > 0) {
          console.log(`Rendering ${stickers.length} stickers`);
          
          // Sort stickers by z-index for proper layering
          const sortedStickers = [...stickers].sort((a, b) => a.zIndex - b.zIndex);
          
          sortedStickers.forEach((sticker, i) => {
            let img = sticker.imageObj;
            
            // If image is not loaded yet, load it
            if (!img && sticker.src) {
              img = new window.Image();
              img.crossOrigin = "anonymous";
              img.decoding = 'sync'; // Synchronous decoding for best quality
              
              // Prevent browser from applying any quality reduction
              if (typeof sticker.src === 'string') {
                img.src = sticker.src;
              } else {
                // Create a high-quality object URL
                const url = URL.createObjectURL(sticker.src);
                img.src = url;
              }
              
              // Store image object for future renders
              const updatedStickers = [...stickers];
              updatedStickers[stickers.findIndex(s => s === sticker)].imageObj = img;
              setStickers(updatedStickers);
            }
            
            if (img && img.complete) {
              ctx.save();
              
              // Move to sticker center and apply rotation
              ctx.translate(sticker.x + sticker.width/2, sticker.y + sticker.height/2);
              ctx.rotate((sticker.rotation * Math.PI) / 180);
              
              // Force absolute highest quality rendering settings
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              
              // Use original image dimensions for source rectangle
              const sourceWidth = img.naturalWidth || img.width;
              const sourceHeight = img.naturalHeight || img.height;
              
              // Draw the image at full resolution
              ctx.drawImage(
                img,
                0, 0, sourceWidth, sourceHeight, // Source: Use full original dimensions
                -sticker.width/2, -sticker.height/2, sticker.width, sticker.height // Destination
              );
              
              // Draw border and controls if sticker is active
              if (activeSticker !== null && stickers[activeSticker] === sticker) {
                // Dashed blue border
                ctx.setLineDash([16, 12]); // Doubled from [8, 6]
                ctx.strokeStyle = '#2563eb'; // blue-600
                ctx.lineWidth = 6; // Doubled from 3
                ctx.strokeRect(-sticker.width/2, -sticker.height/2, sticker.width, sticker.height);
                ctx.setLineDash([]);
                
                const btnRadius = 44; // Doubled from 22
                
                // Delete (red, white X) - top-left
                drawSFSymbolButton(
                  ctx, 
                  -sticker.width/2 - 32, // Doubled from 16
                  -sticker.height/2 - 32, // Doubled from 16
                  '#ef4444', 
                  'delete', 
                  btnRadius,
                  hoveredButton === 'delete'
                );
                
                // Rotate (blue, white arrow) - top-center
                drawSFSymbolButton(
                  ctx, 
                  0, 
                  -sticker.height/2 - 76, // Doubled from 38
                  '#2563eb', 
                  'rotate', 
                  btnRadius,
                  hoveredButton === 'rotate'
                );
                
                // Resize (blue, white diagonal) - bottom-right
                drawSFSymbolButton(
                  ctx, 
                  sticker.width/2 + 32, // Doubled from 16
                  sticker.height/2 + 32, // Doubled from 16
                  '#2563eb', 
                  'resize', 
                  btnRadius,
                  hoveredButton === 'resize'
                );
              }
              
              ctx.restore();
            }
          });
      }

        // After drawing stickers, store button positions for hit detection
        if (activeSticker !== null && stickers[activeSticker]) {
          const sticker = stickers[activeSticker];
          const centerX = sticker.x + sticker.width/2;
          const centerY = sticker.y + sticker.height/2;
          const angle = sticker.rotation * Math.PI / 180;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          
          // Calculate rotation-adjusted button positions
          const deleteOffsetX = -sticker.width/2 - 16;
          const deleteOffsetY = -sticker.height/2 - 16;
          const deleteBtnX = centerX + deleteOffsetX * cos - deleteOffsetY * sin;
          const deleteBtnY = centerY + deleteOffsetX * sin + deleteOffsetY * cos;
          
          const rotateOffsetX = 0;
          const rotateOffsetY = -sticker.height/2 - 38;
          const rotateBtnX = centerX + rotateOffsetX * cos - rotateOffsetY * sin;
          const rotateBtnY = centerY + rotateOffsetX * sin + rotateOffsetY * cos;
          
          const resizeOffsetX = sticker.width/2 + 16;
          const resizeOffsetY = sticker.height/2 + 16;
          const resizeBtnX = centerX + resizeOffsetX * cos - resizeOffsetY * sin;
          const resizeBtnY = centerY + resizeOffsetX * sin + resizeOffsetY * cos;
          
          // Store button positions in global state for click handling
          setStickerButtonsData({
            deleteBtn: {
              x: deleteBtnX,
              y: deleteBtnY
            },
            rotateBtn: {
              x: rotateBtnX,
              y: rotateBtnY
            },
            resizeBtn: {
              x: resizeBtnX,
              y: resizeBtnY
            }
          });
        } else {
          // Reset button positions if no active sticker
          setStickerButtonsData({
            deleteBtn: null,
            rotateBtn: null,
            resizeBtn: null
          });
        }
    } catch (error) {
      console.error("Error drawing canvas:", error);
    }
    };
    
    renderCanvas();
  }, [date, location, textSections, imageObjects, isLoading, templateImage, fontLoaded, getCombinedText, textColors, forceRender, props.forceUpdate, renderCount, layoutMode, stickers, activeSticker, stickerDragOffset, stickerAction, hoveredButton, debounceRender]);

  // Replace both export functions with a single ultra-high-quality export
  const exportUltraHDPDF = () => {
    if (!canvasRef.current) return;
    
    // Create a saving indicator
    const savingToast = document.createElement('div');
    savingToast.className = 'fixed top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-50 z-50';
    savingToast.innerHTML = `
      <div class="bg-white p-4 rounded-md shadow-lg flex flex-col items-center">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-3"></div>
        <p class="text-gray-800">Creating Ultra-Maximum Resolution Export...</p>
      </div>
    `;
    document.body.appendChild(savingToast);
    
    // Get the canvas for export
    const journalCanvas = canvasRef.current;
    
    try {
      // Create a high quality PNG snapshot
      html2canvas(journalCanvas, {
        scale: 8, // Higher resolution for better image quality
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f5f2e9',
        logging: false,
        letterRendering: true,
        imageTimeout: 0,
        async: true,
        removeContainer: true,
        foreignObjectRendering: false, // Better quality with native canvas rendering
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        windowWidth: journalCanvas.width * 1.5,  // Higher scaling for better quality
        windowHeight: journalCanvas.height * 1.5, // Higher scaling for better quality
        onclone: (documentClone: Document) => {
          const canvas = documentClone.getElementById('journal-canvas') as HTMLCanvasElement;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
            }
          }
        }
      }).then((canvas: HTMLCanvasElement) => {
        // Get PNG data at maximum quality
        const pngData = canvas.toDataURL('image/png', 1.0);
        
        // Create a new image element from the high-quality PNG
        const img = new Image();
        img.onload = () => {
          // Define PDF options with extreme quality settings
          // Create PDF document with maximum quality
          const pdf = new jsPDF(
            'portrait', 
            'px', 
            [journalCanvas.width * 2, journalCanvas.height * 2],
            false // No compression
          );
          
          // Add px_scaling hotfix manually if needed
          if (pdf.internal && pdf.internal.scaleFactor) {
            pdf.internal.scaleFactor = 2; // Boost scaling factor
          }
          
          // Add the image to the PDF at maximum resolution
          pdf.addImage({
            imageData: pngData,
            x: 0,
            y: 0,
            width: pdf.internal.pageSize.getWidth(),
            height: pdf.internal.pageSize.getHeight(),
            compression: 'NONE', // No compression for maximum quality
            rotation: 0,
            alias: `journal-${Date.now()}` // Unique alias to prevent caching issues
          });
          
          // Save the PDF
          pdf.save(`journal-${date.toISOString().split('T')[0]}-crystalHD.pdf`);
          
          // Remove saving indicator
          document.body.removeChild(savingToast);
          
          // Show success notification
          const successToast = document.createElement('div');
          successToast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg z-50';
          successToast.textContent = 'Crystal Clear Export Complete';
          document.body.appendChild(successToast);
          
          // Remove success notification after 2 seconds
          setTimeout(() => {
            document.body.removeChild(successToast);
          }, 2000);
        };
        
        img.onerror = (err) => {
          console.error('Error loading high-resolution image for PDF:', err);
          document.body.removeChild(savingToast);
          alert('Could not create crystal clear export. Please try again.');
        };
        
        // Start loading the high-resolution image
        img.src = pngData;
      }).catch((error: Error) => {
        console.error('Error creating canvas snapshot:', error);
        document.body.removeChild(savingToast);
        alert('Could not create export. Please try again.');
      });
    } catch (error: unknown) {
      console.error('Error in export process:', error);
      document.body.removeChild(savingToast);
      alert('Could not create export. Please try again.');
    }
  };

  // Calculate the optimal font size to fit text in a given width
  const calculateOptimalFontSize = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    fontFamily: string,
    minSize: number,
    maxSize: number
  ): number => {
    // Binary search for the largest font size that fits
    let low = minSize;
    let high = maxSize;
    let optimalSize = minSize;
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      ctx.font = `${mid}px ${fontFamily}`;
      const metrics = ctx.measureText(text);
      
      if (metrics.width <= maxWidth) {
        // This font size fits, try a larger one
        optimalSize = mid;
        low = mid + 1;
      } else {
        // This font size doesn't fit, try a smaller one
        high = mid - 1;
      }
    }
    
    // Fine precision tuning with decimal increments
    // First, try to increase with 1.0 increments
    while (optimalSize < maxSize) {
      ctx.font = `${optimalSize + 1}px ${fontFamily}`;
      if (ctx.measureText(text).width <= maxWidth) {
        optimalSize += 1;
      } else {
        break;
      }
    }
    
    // Then use 0.1 increments for finer precision
    while (optimalSize < maxSize) {
      ctx.font = `${optimalSize + 0.1}px ${fontFamily}`;
      if (ctx.measureText(text).width <= maxWidth) {
        optimalSize += 0.1;
      } else {
        break;
      }
    }
    
    // Round to 2 decimal places
    return Math.round(optimalSize * 100) / 100;
  };

  // Helper to get max zIndex
  const getMaxStickerZ = () => stickers.length > 0 ? Math.max(...stickers.map(s => s.zIndex)) : 0;

  // Add click handler for sticker selection
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !props.editMode) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    console.log("Canvas clicked at:", mouseX, mouseY);

    // First check for button clicks if a sticker is active
    if (activeSticker !== null && stickerButtonsData.deleteBtn) {
      const deleteBtn = stickerButtonsData.deleteBtn;
      const btnRadius = 22;
      
      // Check if delete button was clicked (with larger hit area)
      if (Math.sqrt((mouseX - deleteBtn.x) ** 2 + (mouseY - deleteBtn.y) ** 2) <= btnRadius * 1.5) {
        console.log("Deleting sticker:", activeSticker);
        // Delete this sticker
        const newStickers = stickers.filter((_, idx) => idx !== activeSticker);
        setStickers(newStickers);
        setActiveSticker(null);
        renderJournal();
        return;
      }
    }

    // Check if clicked on a sticker - using generous hit area
    // Process stickers from top to bottom (highest z-index first)
    const sortedStickerIndices = stickers
      .map((sticker, index) => ({ index, zIndex: sticker.zIndex }))
      .sort((a, b) => b.zIndex - a.zIndex)
      .map(item => item.index);

    let clickedOnSticker = false;
    for (const i of sortedStickerIndices) {
        const sticker = stickers[i];
      const centerX = sticker.x + sticker.width/2;
      const centerY = sticker.y + sticker.height/2;
      const dx = mouseX - centerX;
      const dy = mouseY - centerY;
        const angle = -sticker.rotation * Math.PI / 180;
        const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
        const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
      
      // Use a slightly larger hit area (10% buffer) for easier selection
      const hitWidthHalf = sticker.width/2 * 1.1;
      const hitHeightHalf = sticker.height/2 * 1.1;
      
      // Check if click is inside sticker bounds with buffer
      if (Math.abs(localX) < hitWidthHalf && Math.abs(localY) < hitHeightHalf) {
          setActiveSticker(i);
        clickedOnSticker = true;
          // Bring to front
          const maxZ = getMaxStickerZ();
          if (sticker.zIndex < maxZ) {
            const newStickers = stickers.map((s, idx) => idx === i ? { ...s, zIndex: maxZ + 1 } : s);
            setStickers(newStickers);
          }
        console.log("Selected sticker:", i, "Total stickers:", stickers.length);
        break;
      }
    }
    
    // If we didn't click on a sticker, deselect the active sticker
    if (!clickedOnSticker) {
      setActiveSticker(null);
    }
  };

  // Update handleMouseDown to handle dragging
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !props.editMode) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Check if we clicked on a sticker
    if (activeSticker !== null) {
      const sticker = stickers[activeSticker];
      const centerX = sticker.x + sticker.width/2;
      const centerY = sticker.y + sticker.height/2;
      const dx = x - centerX;
      const dy = y - centerY;
      const angle = -sticker.rotation * Math.PI / 180;
      const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
      const localY = dx * Math.sin(angle) + dy * Math.cos(angle);

      // If clicked inside sticker (with buffer), start dragging
      const hitWidthHalf = sticker.width/2 * 1.1;
      const hitHeightHalf = sticker.height/2 * 1.1;
      
      if (Math.abs(localX) < hitWidthHalf && Math.abs(localY) < hitHeightHalf) {
          setStickerAction('move');
          setStickerDragOffset({x: localX, y: localY});
        setIsDragging(true);
          return;
      }
    }

    // Handle other interactions (text areas, etc.)
    // ... existing code for text areas and other interactions ...
  };

  // Update handleMouseMove to handle dragging and hover effects
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !props.editMode) return;
    
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
    
    // Check for button hover if we have an active sticker
    if (activeSticker !== null && stickers[activeSticker]) {
      const sticker = stickers[activeSticker];
      const btnRadius = 44;
      const centerX = sticker.x + sticker.width/2;
      const centerY = sticker.y + sticker.height/2;
      
      // Calculate rotation-adjusted button positions
      const angle = sticker.rotation * Math.PI / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      
      // Delete button position (top-left)
      const deleteOffsetX = -sticker.width/2 - 32; // Doubled from 16
      const deleteOffsetY = -sticker.height/2 - 32; // Doubled from 16
      const deleteBtnX = centerX + deleteOffsetX * cos - deleteOffsetY * sin;
      const deleteBtnY = centerY + deleteOffsetX * sin + deleteOffsetY * cos;
      
      // Rotate button position (top-center)
      const rotateOffsetX = 0;
      const rotateOffsetY = -sticker.height/2 - 76; // Doubled from 38
      const rotateBtnX = centerX + rotateOffsetX * cos - rotateOffsetY * sin;
      const rotateBtnY = centerY + rotateOffsetX * sin + rotateOffsetY * cos;
      
      // Resize button position (bottom-right)
      const resizeOffsetX = sticker.width/2 + 32; // Doubled from 16
      const resizeOffsetY = sticker.height/2 + 32; // Doubled from 16
      const resizeBtnX = centerX + resizeOffsetX * cos - resizeOffsetY * sin;
      const resizeBtnY = centerY + resizeOffsetX * sin + resizeOffsetY * cos;
      
      // Check if hovering over any button
      if (Math.sqrt((x - deleteBtnX) ** 2 + (y - deleteBtnY) ** 2) <= btnRadius * 1.5) {
        if (hoveredButton !== 'delete') {
          setHoveredButton('delete');
          setCanvasCursor('pointer');
          debouncedRender();
        }
      } else if (Math.sqrt((x - rotateBtnX) ** 2 + (y - rotateBtnY) ** 2) <= btnRadius * 1.5) {
        if (hoveredButton !== 'rotate') {
          setHoveredButton('rotate');
          setCanvasCursor('pointer');
          debouncedRender();
        }
      } else if (Math.sqrt((x - resizeBtnX) ** 2 + (y - resizeBtnY) ** 2) <= btnRadius * 1.5) {
        if (hoveredButton !== 'resize') {
          setHoveredButton('resize');
          setCanvasCursor('pointer');
          debouncedRender();
        }
      } else if (hoveredButton !== null) {
        setHoveredButton(null);
        
        // Set cursor based on position within sticker instead
        const dx = x - centerX;
        const dy = y - centerY;
        const localX = dx * Math.cos(-angle) - dy * Math.sin(-angle);
        const localY = dx * Math.sin(-angle) + dy * Math.cos(-angle);
        
        // Set cursor based on position
        if (Math.abs(localX - sticker.width/2) < 15 && Math.abs(localY - sticker.height/2) < 15) {
          setCanvasCursor('nwse-resize');
        } else if (Math.abs(localX) < 15 && Math.abs(localY + sticker.height/2 + 20) < 15) {
          setCanvasCursor('grab');
        } else if (localX > -sticker.width/2 && localX < sticker.width/2 && 
                   localY > -sticker.height/2 && localY < sticker.height/2) {
          setCanvasCursor(isDragging ? 'grabbing' : 'grab');
        } else {
          setCanvasCursor('default');
        }
        
        debouncedRender();
      }
    }
    
    // Handle sticker actions
    if (activeSticker !== null && stickerAction && stickerDragOffset) {
      const activeStickObj = stickers[activeSticker];
      const centerX = activeStickObj.x + activeStickObj.width/2;
      const centerY = activeStickObj.y + activeStickObj.height/2;
      const dx = x - centerX;
      const dy = y - centerY;
      const angle = -activeStickObj.rotation * Math.PI / 180;
      const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
      const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
      
      let newStickers = [...stickers];
      
      if (stickerAction === 'move') {
        newStickers[activeSticker] = {
          ...activeStickObj,
          x: x - stickerDragOffset.x - activeStickObj.width/2,
          y: y - stickerDragOffset.y - activeStickObj.height/2,
        };
      } else if (stickerAction === 'resize') {
        // Get the current distance from cursor to sticker center
        const currentDistance = Math.sqrt(dx * dx + dy * dy);
        
        // Get the initial distance (or calculate it if first resize move)
        if (!stickerDragOffset.initialWidth) {
          // This is the first resize move, store initial values
          setStickerDragOffset({
            ...stickerDragOffset,
            initialWidth: activeStickObj.width,
            initialHeight: activeStickObj.height,
            initialPinchDistance: currentDistance
          });
          return;
        }
        
        // Calculate scale factor with gradual change to make it much smoother
        const distanceRatio = currentDistance / stickerDragOffset.initialPinchDistance!;
        
        // Apply very gentle scaling - use a more conservative approach
        // Blend between current size and target size for smoother transitions
        const blendFactor = 0.1; // Only move 10% toward the target size per frame
        const targetScaleFactor = Math.sqrt(distanceRatio); // Sqrt for more linear feel
        
        // Gradually approach the target scale (prevents jumps and disappearing)
        const currentScale = activeStickObj.width / stickerDragOffset.initialWidth!;
        const newScale = currentScale * (1 - blendFactor) + targetScaleFactor * blendFactor;
        
        // Calculate new dimensions while preserving aspect ratio
        let newWidth = stickerDragOffset.initialWidth! * newScale;
        let newHeight = stickerDragOffset.initialHeight! * newScale;
        
        // Enforce minimum size (larger minimum to prevent disappearing)
        const minSize = 100;
        if (newWidth < minSize || newHeight < minSize) {
          const aspectRatio = stickerDragOffset.initialWidth! / stickerDragOffset.initialHeight!;
          if (aspectRatio > 1) {
            newWidth = minSize;
            newHeight = minSize / aspectRatio;
          } else {
            newHeight = minSize;
            newWidth = minSize * aspectRatio;
          }
        }
        
        // Enforce maximum size to prevent stickers from becoming too large
        const maxSize = Math.min(canvasRef.current.width, canvasRef.current.height) * 0.5;
        if (newWidth > maxSize || newHeight > maxSize) {
          const aspectRatio = stickerDragOffset.initialWidth! / stickerDragOffset.initialHeight!;
          if (aspectRatio > 1) {
            newWidth = maxSize;
            newHeight = maxSize / aspectRatio;
          } else {
            newHeight = maxSize;
            newWidth = maxSize * aspectRatio;
          }
        }
        
        // Calculate new position that keeps the sticker centered at the same point
        // This is critical to prevent the sticker from moving during resize
        const oldCenterX = activeStickObj.x + activeStickObj.width/2;
        const oldCenterY = activeStickObj.y + activeStickObj.height/2;
        const newX = oldCenterX - newWidth/2;
        const newY = oldCenterY - newHeight/2;
        
        newStickers[activeSticker] = {
          ...activeStickObj,
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
        };
      } else if (stickerAction === 'rotate') {
        const angleRad = Math.atan2(y - centerY, x - centerX);
        newStickers[activeSticker] = {
          ...activeStickObj,
          rotation: angleRad * 180 / Math.PI + 90,
        };
      }
      
      setStickers(newStickers);
      renderJournal();
    }
  };

  // Update handleMouseUp to handle dragging
  const handleMouseUp = () => {
    setStickerAction(null);
    setStickerDragOffset(null);
    setIsDragging(false);
    setCanvasCursor('default');
  };
  
  // Update handleMouseLeave to handle dragging
  const handleMouseLeave = () => {
    setStickerAction(null);
    setStickerDragOffset(null);
    setIsDragging(false);
    setCanvasCursor('default');
  };

  // Add click handler to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Remove any existing listener first
      canvas.removeEventListener('click', handleCanvasClick as any);
      // Add the new one
      canvas.addEventListener('click', handleCanvasClick as any);
      return () => {
        canvas.removeEventListener('click', handleCanvasClick as any);
      };
    }
  }, [activeSticker, stickers, props.editMode]);

  // Function to force a redraw from outside
  const forceRedraw = useCallback(() => {
    console.log('Force redraw called');
    setRenderCount(prev => prev + 1);
  }, []);

  // Expose the forceRedraw method to the window for direct access
  useEffect(() => {
    // @ts-ignore
    window.forceCanvasRedraw = forceRedraw;
    return () => {
      // @ts-ignore
      delete window.forceCanvasRedraw;
    };
  }, [forceRedraw]);

  // 2. Sticker upload handler - moved to external UI
  const handleStickerFile = (file: File) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      // Always use original dimensions at full resolution
      const originalWidth = img.naturalWidth || img.width;
      const originalHeight = img.naturalHeight || img.height;
      
      // Store original dimensions but scale display size if needed
      let displayWidth = originalWidth;
      let displayHeight = originalHeight;
      
      // Only scale down the display size if the image is extremely large
      const maxDisplayDimension = 2000;
      if (displayWidth > maxDisplayDimension || displayHeight > maxDisplayDimension) {
        const scale = maxDisplayDimension / Math.max(displayWidth, displayHeight);
        displayWidth *= scale;
        displayHeight *= scale;
      }
      
      // Create a new sticker with both original and display dimensions
      setStickers(prevStickers => [
        ...prevStickers,
        {
          src: file,
          x: Math.random() * 400 + 200,
          y: Math.random() * 400 + 200,
          width: displayWidth,
          height: displayHeight,
          rotation: 0,
          zIndex: prevStickers.length + 10,
          imageObj: img,
          originalWidth: originalWidth,  // Store original dimensions
          originalHeight: originalHeight // Store original dimensions
        },
      ]);
      
      // Force a re-render to show the high-quality sticker
      renderJournal();
    };
    
    // Use synchronous decoding for best quality
    img.decoding = 'sync';
    
    // Create a revocable URL for the file
    const url = URL.createObjectURL(file);
    img.src = url;
    
    // Clean up the URL after loading
    img.onload = () => {
      URL.revokeObjectURL(url);
      img.onload = null;
    };
  };

  // Expose the addSticker method via the forwarded ref
  useImperativeHandle(ref, () => ({
    addSticker: (file: File, width?: number, height?: number) => {
      console.log("Adding sticker:", file.name);
      try {
        handleStickerFile(file);
        return true;
      } catch (err) {
        console.error("Error adding sticker:", err);
        return false;
      }
    },
    addMultipleStickers: (files: File[]) => {
      try {
        addMultipleStickers(files);
        return true;
      } catch (err) {
        console.error("Error adding multiple stickers:", err);
        return false;
      }
    }
  }));

  // Helper to draw GoodNotes-style control button
  function drawSFSymbolButton(
    ctx: CanvasRenderingContext2D | null,
    x: number,
    y: number,
    color: string, // fill color
    icon: 'delete' | 'rotate' | 'resize',
    btnRadius = 44, // Doubled from 22
    isHovered = false
  ) {
    if (!ctx) return;
    // Draw drop shadowed button
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, btnRadius, 0, 2 * Math.PI);
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 16; // Doubled from 8
    ctx.shadowOffsetX = 4; // Doubled from 2
    ctx.shadowOffsetY = 4; // Doubled from 2
    
    // Make button brighter if hovered
    const btnColor = isHovered ? adjustColor(color, 20) : color;
    ctx.fillStyle = btnColor;
    ctx.fill();
    
    // Add white border
    ctx.lineWidth = 6; // Doubled from 3
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.restore();

    // Set icon size relative to button radius (70-80% of button)
    const iconSize = btnRadius * (isHovered ? 1.4 : 1.3); // Slightly bigger when hovered
    
    // Draw the icon directly using canvas primitives for perfect control
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#fff';
    ctx.fillStyle = '#fff';
    ctx.lineWidth = isHovered ? 10 : 8; // Doubled from 5/4
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (icon === 'delete') {
      // Draw X (delete)
      const offset = iconSize * 0.4;
      ctx.beginPath();
      ctx.moveTo(-offset, -offset);
      ctx.lineTo(offset, offset);
      ctx.moveTo(offset, -offset);
      ctx.lineTo(-offset, offset);
      ctx.stroke();
    } 
    else if (icon === 'rotate') {
      // Draw rotation arrow
      const radius = iconSize * 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, radius, -Math.PI/4, Math.PI * 1.2, false);
      ctx.stroke();
      
      // Arrow head
      const arrowSize = radius * 0.4;
      const angle = Math.PI * 1.2;
      const arrowX = Math.cos(angle) * radius;
      const arrowY = Math.sin(angle) * radius;
      
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(arrowX - arrowSize, arrowY - arrowSize/2);
      ctx.lineTo(arrowX - arrowSize/2, arrowY + arrowSize/2);
      ctx.closePath();
      ctx.fill();
    } 
    else if (icon === 'resize') {
      // Draw corner-expand resize icon (clearer than just a diagonal line)
      const offset = iconSize * 0.5;
      
      // Main diagonal line
      ctx.beginPath();
      ctx.moveTo(-offset, -offset);
      ctx.lineTo(offset, offset);
      ctx.stroke();
      
      // Horizontal and vertical edges on both ends
      // Bottom-right corner
      ctx.beginPath();
      ctx.moveTo(offset, offset);
      ctx.lineTo(offset, offset * 0.5);
      ctx.moveTo(offset, offset);
      ctx.lineTo(offset * 0.5, offset);
      ctx.stroke();
      
      // Top-left corner
      ctx.beginPath();
      ctx.moveTo(-offset, -offset);
      ctx.lineTo(-offset, -offset * 0.5);
      ctx.moveTo(-offset, -offset);
      ctx.lineTo(-offset * 0.5, -offset);
      ctx.stroke();
    }
    
    ctx.restore();
  }

  // Check if a point is inside a button
  function isPointInButton(x: number, y: number, buttonX: number, buttonY: number, radius: number): boolean {
    const dx = x - buttonX;
    const dy = y - buttonY;
    return dx * dx + dy * dy <= radius * radius;
  }

  // Implement a separate handler specifically for button clicks
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !props.editMode) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    // Check for button clicks if we have an active sticker
    if (activeSticker !== null && stickers[activeSticker]) {
      const sticker = stickers[activeSticker];
      const btnRadius = 44; // Doubled from 22
      const centerX = sticker.x + sticker.width/2;
      const centerY = sticker.y + sticker.height/2;
      
      // Calculate rotation-adjusted button positions
      const angle = sticker.rotation * Math.PI / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      
      // Delete button position (top-left)
      const deleteOffsetX = -sticker.width/2 - 32; // Doubled from 16
      const deleteOffsetY = -sticker.height/2 - 32; // Doubled from 16
      const deleteBtnX = centerX + deleteOffsetX * cos - deleteOffsetY * sin;
      const deleteBtnY = centerY + deleteOffsetX * sin + deleteOffsetY * cos;
      
      // Rotate button position (top-center)
      const rotateOffsetX = 0;
      const rotateOffsetY = -sticker.height/2 - 76; // Doubled from 38
      const rotateBtnX = centerX + rotateOffsetX * cos - rotateOffsetY * sin;
      const rotateBtnY = centerY + rotateOffsetX * sin + rotateOffsetY * cos;
      
      // Resize button position (bottom-right)
      const resizeOffsetX = sticker.width/2 + 32; // Doubled from 16
      const resizeOffsetY = sticker.height/2 + 32; // Doubled from 16
      const resizeBtnX = centerX + resizeOffsetX * cos - resizeOffsetY * sin;
      const resizeBtnY = centerY + resizeOffsetX * sin + resizeOffsetY * cos;
      
      // Use a larger hit area for easier button clicking (1.5x radius)
      if (Math.sqrt((x - deleteBtnX) ** 2 + (y - deleteBtnY) ** 2) <= btnRadius * 1.5) {
        console.log("Delete button clicked!");
        // Delete the active sticker
        const newStickers = stickers.filter((_, idx) => idx !== activeSticker);
        setStickers(newStickers);
        setActiveSticker(null);
        setButtonClickHandling(true); // Prevent other handlers from firing
        renderJournal();
        return;
      }
      
      // Handle rotate button click
      if (Math.sqrt((x - rotateBtnX) ** 2 + (y - rotateBtnY) ** 2) <= btnRadius * 1.5) {
        setStickerAction('rotate');
        setStickerDragOffset({x: 0, y: 0});
        setButtonClickHandling(true);
        return;
      }
      
      // Handle resize button click
      if (Math.sqrt((x - resizeBtnX) ** 2 + (y - resizeBtnY) ** 2) <= btnRadius * 1.5) {
        setStickerAction('resize');
        setStickerDragOffset({x: 0, y: 0});
        setButtonClickHandling(true);
        return;
      }
    }
    
    // Handle other mousedown logic only if we're not handling button clicks
    if (!buttonClickHandling) {
      handleMouseDown(e);
    }
  };

  // Reset button click handling on mouse up
  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setButtonClickHandling(false);
    handleMouseUp();
  };

  // Touch event handlers for mobile devices
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !props.editMode) return;
    
    // Prevent scrolling when interacting with canvas
    e.preventDefault();
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;
    
    // Store multi-touch initial state for rotation detection
    if (e.touches.length === 2 && activeSticker !== null) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const touch1X = (touch1.clientX - rect.left) * scaleX;
      const touch1Y = (touch1.clientY - rect.top) * scaleY;
      const touch2X = (touch2.clientX - rect.left) * scaleX;
      const touch2Y = (touch2.clientY - rect.top) * scaleY;
      
      // Calculate initial angle between two fingers
      const initialAngle = Math.atan2(touch2Y - touch1Y, touch2X - touch1X);
      
      // Store active sticker initial rotation
      const activeStickObj = stickers[activeSticker];
      
      // Set rotation mode
      setStickerAction('rotate');
      setStickerDragOffset({
        x: 0,
        y: 0,
        initialTouchAngle: initialAngle,
        initialRotation: activeStickObj.rotation
      });
      return;
    }
    
    // Check for button touches if we have an active sticker
    if (activeSticker !== null && stickers[activeSticker]) {
      const sticker = stickers[activeSticker];
      const btnRadius = 44; // Doubled from 22
      const centerX = sticker.x + sticker.width/2;
      const centerY = sticker.y + sticker.height/2;
      
      // Calculate rotation-adjusted button positions
      const angle = sticker.rotation * Math.PI / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      
      // Delete button position (top-left)
      const deleteOffsetX = -sticker.width/2 - 32; // Doubled from 16
      const deleteOffsetY = -sticker.height/2 - 32; // Doubled from 16
      const deleteBtnX = centerX + deleteOffsetX * cos - deleteOffsetY * sin;
      const deleteBtnY = centerY + deleteOffsetX * sin + deleteOffsetY * cos;
      
      // Rotate button position (top-center)
      const rotateOffsetX = 0;
      const rotateOffsetY = -sticker.height/2 - 76; // Doubled from 38
      const rotateBtnX = centerX + rotateOffsetX * cos - rotateOffsetY * sin;
      const rotateBtnY = centerY + rotateOffsetX * sin + rotateOffsetY * cos;
      
      // Resize button position (bottom-right)
      const resizeOffsetX = sticker.width/2 + 32; // Doubled from 16
      const resizeOffsetY = sticker.height/2 + 32; // Doubled from 16
      const resizeBtnX = centerX + resizeOffsetX * cos - resizeOffsetY * sin;
      const resizeBtnY = centerY + resizeOffsetX * sin + resizeOffsetY * cos;
      
      // Use a larger hit area for easier button clicking (1.8x radius for touch)
      if (Math.sqrt((x - deleteBtnX) ** 2 + (y - deleteBtnY) ** 2) <= btnRadius * 1.8) {
        // Delete the active sticker
        const newStickers = stickers.filter((_, idx) => idx !== activeSticker);
        setStickers(newStickers);
        setActiveSticker(null);
        setButtonClickHandling(true);
        renderJournal();
        return;
      }
      
      // Handle rotate button touch
      if (Math.sqrt((x - rotateBtnX) ** 2 + (y - rotateBtnY) ** 2) <= btnRadius * 1.8) {
        setStickerAction('rotate');
        setStickerDragOffset({x: 0, y: 0});
        setButtonClickHandling(true);
        return;
      }
      
      // Handle resize button touch
      if (Math.sqrt((x - resizeBtnX) ** 2 + (y - resizeBtnY) ** 2) <= btnRadius * 1.8) {
        setStickerAction('resize');
        setStickerDragOffset({x: 0, y: 0});
        setButtonClickHandling(true);
        return;
      }
    }
    
    // If we're not handling button clicks, check if touch is on a sticker
    if (!buttonClickHandling) {
      // Check if touch is on any sticker - starting with highest z-index
      const sortedStickerIndices = stickers
        .map((sticker, index) => ({ index, zIndex: sticker.zIndex }))
        .sort((a, b) => b.zIndex - a.zIndex)
        .map(item => item.index);

      let touchedOnSticker = false;
      for (const i of sortedStickerIndices) {
        const sticker = stickers[i];
        const centerX = sticker.x + sticker.width/2;
        const centerY = sticker.y + sticker.height/2;
        const dx = x - centerX;
        const dy = y - centerY;
        const angle = -sticker.rotation * Math.PI / 180;
        const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
        const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
        
        // Use a slightly larger hit area (20% buffer) for touch
        const hitWidthHalf = sticker.width/2 * 1.2;
        const hitHeightHalf = sticker.height/2 * 1.2;
        
        if (Math.abs(localX) < hitWidthHalf && Math.abs(localY) < hitHeightHalf) {
          setActiveSticker(i);
          touchedOnSticker = true;
          
          // Bring to front
          const maxZ = getMaxStickerZ();
          if (sticker.zIndex < maxZ) {
            const newStickers = stickers.map((s, idx) => idx === i ? { ...s, zIndex: maxZ + 1 } : s);
            setStickers(newStickers);
          }
          
          // Set up dragging
          setStickerAction('move');
          setStickerDragOffset({x: localX, y: localY});
          setIsDragging(true);
          break;
        }
      }
      
      if (!touchedOnSticker) {
        setActiveSticker(null);
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !props.editMode) return;
    
    // Prevent scrolling when interacting with canvas
    e.preventDefault();
    
    // Handle two-finger rotation
    if (e.touches.length === 2 && 
        activeSticker !== null && 
        stickerAction === 'rotate' && 
        stickerDragOffset?.initialTouchAngle !== undefined) {
      
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;
      
      // Convert touch positions to canvas coordinates
      const touch1X = (touch1.clientX - rect.left) * scaleX;
      const touch1Y = (touch1.clientY - rect.top) * scaleY;
      const touch2X = (touch2.clientX - rect.left) * scaleX;
      const touch2Y = (touch2.clientY - rect.top) * scaleY;
      
      // Calculate current angle between fingers
      const currentAngle = Math.atan2(touch2Y - touch1Y, touch2X - touch1X);
      
      // Determine the angle change in radians
      const angleDelta = currentAngle - stickerDragOffset.initialTouchAngle;
      
      // Convert to degrees and add to initial rotation
      const newRotation = stickerDragOffset.initialRotation! + (angleDelta * 180 / Math.PI);
      
      // Update sticker rotation
      const activeStickObj = stickers[activeSticker];
      const newStickers = [...stickers];
      newStickers[activeSticker] = {
        ...activeStickObj,
        rotation: newRotation
      };
      
      setStickers(newStickers);
      renderJournal();
      return;
    }
    
    // Handle pinch-to-zoom gesture for resizing stickers
    if (e.touches.length === 2 && activeSticker !== null) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;
      
      // Convert touch positions to canvas coordinates
      const touch1X = (touch1.clientX - rect.left) * scaleX;
      const touch1Y = (touch1.clientY - rect.top) * scaleY;
      const touch2X = (touch2.clientX - rect.left) * scaleX;
      const touch2Y = (touch2.clientY - rect.top) * scaleY;
      
      // Calculate the distance between the two touches
      const currentDistance = Math.sqrt(
        Math.pow(touch2X - touch1X, 2) + Math.pow(touch2Y - touch1Y, 2)
      );
      
      // Also calculate the midpoint between touches to maintain position during resize
      const midpointX = (touch1X + touch2X) / 2;
      const midpointY = (touch1Y + touch2Y) / 2;
      
      // If this is the first move of a pinch gesture, store the initial distance
      if (!stickerDragOffset || !stickerDragOffset.initialPinchDistance) {
        const activeStickObj = stickers[activeSticker];
        
        // Get sticker center position to maintain during resize
        const centerX = activeStickObj.x + activeStickObj.width / 2;
        const centerY = activeStickObj.y + activeStickObj.height / 2;
        
        setStickerAction('resize');
        setStickerDragOffset({
          x: centerX - midpointX, // Store offset between sticker center and touch midpoint
          y: centerY - midpointY,
          initialPinchDistance: currentDistance,
          initialWidth: activeStickObj.width,
          initialHeight: activeStickObj.height
        });
        return;
      }
      
      // Get active sticker object
      const activeStickObj = stickers[activeSticker];
      
      // Calculate scale factor with gradual change to make it much smoother
      const distanceRatio = currentDistance / stickerDragOffset.initialPinchDistance!;
      
      // Apply very gentle scaling - use a more conservative approach
      // Blend between current size and target size for smoother transitions
      const blendFactor = 0.1; // Only move 10% toward the target size per frame
      const targetScaleFactor = Math.sqrt(distanceRatio); // Sqrt for more linear feel
      
      // Gradually approach the target scale (prevents jumps and disappearing)
      const currentScale = activeStickObj.width / stickerDragOffset.initialWidth!;
      const newScale = currentScale * (1 - blendFactor) + targetScaleFactor * blendFactor;
      
      // Calculate new dimensions while preserving aspect ratio
      let newWidth = stickerDragOffset.initialWidth! * newScale;
      let newHeight = stickerDragOffset.initialHeight! * newScale;
      
      // Enforce minimum size (larger minimum to prevent disappearing)
      const minSize = 100;
      if (newWidth < minSize || newHeight < minSize) {
        const aspectRatio = stickerDragOffset.initialWidth! / stickerDragOffset.initialHeight!;
        if (aspectRatio > 1) {
          newWidth = minSize;
          newHeight = minSize / aspectRatio;
        } else {
          newHeight = minSize;
          newWidth = minSize * aspectRatio;
        }
      }
      
      // Enforce maximum size to prevent stickers from becoming too large
      const maxSize = Math.min(canvasRef.current.width, canvasRef.current.height) * 0.5;
      if (newWidth > maxSize || newHeight > maxSize) {
        const aspectRatio = stickerDragOffset.initialWidth! / stickerDragOffset.initialHeight!;
        if (aspectRatio > 1) {
          newWidth = maxSize;
          newHeight = maxSize / aspectRatio;
        } else {
          newHeight = maxSize;
          newWidth = maxSize * aspectRatio;
        }
      }
      
      // Calculate new position based on midpoint and stored offset to maintain position
      // This is key to prevent stickers from "jumping" when resizing
      const newX = midpointX + stickerDragOffset.x - newWidth/2;
      const newY = midpointY + stickerDragOffset.y - newHeight/2;
      
      // Update sticker dimensions and position
      const newStickers = [...stickers];
      newStickers[activeSticker] = {
        ...activeStickObj,
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight
      };
      
      setStickers(newStickers);
      renderJournal();
      return;
    }
    
    // Handle single touch for moving, rotating, etc.
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;
    
    // Handle sticker actions
    if (activeSticker !== null && stickerAction && stickerDragOffset) {
      const activeStickObj = stickers[activeSticker];
      const centerX = activeStickObj.x + activeStickObj.width/2;
      const centerY = activeStickObj.y + activeStickObj.height/2;
      const dx = x - centerX;
      const dy = y - centerY;
      const angle = -activeStickObj.rotation * Math.PI / 180;
      const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
      const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
      
      let newStickers = [...stickers];
      
      if (stickerAction === 'move') {
        newStickers[activeSticker] = {
          ...activeStickObj,
          x: x - stickerDragOffset.x - activeStickObj.width/2,
          y: y - stickerDragOffset.y - activeStickObj.height/2,
        };
      } else if (stickerAction === 'resize') {
        // Get the current distance from cursor to sticker center
        const currentDistance = Math.sqrt(dx * dx + dy * dy);
        
        // Get the initial distance (or calculate it if first resize move)
        if (!stickerDragOffset.initialWidth) {
          // This is the first resize move, store initial values
          setStickerDragOffset({
            ...stickerDragOffset,
            initialWidth: activeStickObj.width,
            initialHeight: activeStickObj.height,
            initialPinchDistance: currentDistance
          });
          return;
        }
        
        // Calculate scale factor with gradual change to make it much smoother
        const distanceRatio = currentDistance / stickerDragOffset.initialPinchDistance!;
        
        // Apply very gentle scaling - use a more conservative approach
        // Blend between current size and target size for smoother transitions
        const blendFactor = 0.1; // Only move 10% toward the target size per frame
        const targetScaleFactor = Math.sqrt(distanceRatio); // Sqrt for more linear feel
        
        // Gradually approach the target scale (prevents jumps and disappearing)
        const currentScale = activeStickObj.width / stickerDragOffset.initialWidth!;
        const newScale = currentScale * (1 - blendFactor) + targetScaleFactor * blendFactor;
        
        // Calculate new dimensions while preserving aspect ratio
        let newWidth = stickerDragOffset.initialWidth! * newScale;
        let newHeight = stickerDragOffset.initialHeight! * newScale;
        
        // Enforce minimum size (larger minimum to prevent disappearing)
        const minSize = 100;
        if (newWidth < minSize || newHeight < minSize) {
          const aspectRatio = stickerDragOffset.initialWidth! / stickerDragOffset.initialHeight!;
          if (aspectRatio > 1) {
            newWidth = minSize;
            newHeight = minSize / aspectRatio;
          } else {
            newHeight = minSize;
            newWidth = minSize * aspectRatio;
          }
        }
        
        // Enforce maximum size to prevent stickers from becoming too large
        const maxSize = Math.min(canvasRef.current.width, canvasRef.current.height) * 0.5;
        if (newWidth > maxSize || newHeight > maxSize) {
          const aspectRatio = stickerDragOffset.initialWidth! / stickerDragOffset.initialHeight!;
          if (aspectRatio > 1) {
            newWidth = maxSize;
            newHeight = maxSize / aspectRatio;
          } else {
            newHeight = maxSize;
            newWidth = maxSize * aspectRatio;
          }
        }
        
        // Calculate new position that keeps the sticker centered at the same point
        // This is critical to prevent the sticker from moving during resize
        const oldCenterX = activeStickObj.x + activeStickObj.width/2;
        const oldCenterY = activeStickObj.y + activeStickObj.height/2;
        const newX = oldCenterX - newWidth/2;
        const newY = oldCenterY - newHeight/2;
        
        newStickers[activeSticker] = {
          ...activeStickObj,
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
        };
      } else if (stickerAction === 'rotate') {
        const angleRad = Math.atan2(y - centerY, x - centerX);
        newStickers[activeSticker] = {
          ...activeStickObj,
          rotation: angleRad * 180 / Math.PI + 90,
        };
      }
      
      setStickers(newStickers);
      renderJournal();
    }
  };

  const handleTouchEnd = () => {
    setButtonClickHandling(false);
    setStickerAction(null);
    setStickerDragOffset(null);
    setIsDragging(false);
  };

  // Clean up any timers
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Add a new function to handle multiple stickers
  const addMultipleStickers = (files: File[]) => {
    console.log(`Adding ${files.length} stickers at once`);
    
    // Calculate canvas dimensions for positioning
    const canvasWidth = canvasRef.current?.width || 1240;
    const canvasHeight = canvasRef.current?.height || 1748;
    
    // Process each file to add as a sticker
    const promises = files.map((file, index) => {
      return new Promise<StickerImage | null>((resolve) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.decoding = 'sync'; // Synchronous decoding for best quality
        
        img.onload = () => {
          // Preserve original dimensions completely - absolutely no quality reduction
          const originalWidth = img.naturalWidth || img.width;
          const originalHeight = img.naturalHeight || img.height;
          
          // Scale large images down for display, but preserve original dimensions
          let width = originalWidth;
          let height = originalHeight;
          
          // For extremely large images, apply reasonable scaling for display
          const maxDimension = 2000; // High-resolution cap
          if (width > maxDimension || height > maxDimension) {
            const scaleFactor = maxDimension / Math.max(width, height);
            width = width * scaleFactor;
            height = height * scaleFactor;
          }
          
          // Create a grid-like distribution with some randomness
          // Use modulo to create rows and columns
          const cols = Math.ceil(Math.sqrt(files.length));
          const col = index % cols;
          const row = Math.floor(index / cols);
          
          // Calculate base position in a grid
          const baseX = (canvasWidth * 0.6) * (col / cols) + canvasWidth * 0.2;
          const baseY = (canvasHeight * 0.6) * (row / cols) + canvasHeight * 0.2;
          
          // Add randomness to prevent perfect alignment
          const jitterX = Math.random() * 100 - 50;
          const jitterY = Math.random() * 100 - 50;
          
          resolve({
            src: file,
            x: baseX + jitterX,
            y: baseY + jitterY,
            width: width,
            height: height,
            rotation: 0, // No rotation when scattering stickers
            zIndex: 100 + index, // Ensure proper stacking
            imageObj: img,
            originalWidth: originalWidth, // Store original dimensions
            originalHeight: originalHeight // Store original dimensions
          });
        };
        
        img.onerror = () => {
          console.error("Failed to load sticker image:", file.name);
          resolve(null);
        };
        
        img.src = URL.createObjectURL(file);
      });
    });
    
    // Wait for all image loading to complete
    Promise.all(promises).then((newStickers) => {
      // Filter out any that failed to load
      const validStickers = newStickers.filter((s): s is StickerImage => s !== null);
      
      if (validStickers.length > 0) {
        // Add all new stickers to the canvas
        setStickers(prev => [...prev, ...validStickers]);
        
        // Select the last added sticker
        setTimeout(() => {
          setActiveSticker(stickers.length + validStickers.length - 1);
          renderJournal();
        }, 100);
      }
    });
  };

  return (
    <div className="relative w-full overflow-hidden">
      {isLoading ? (
        <div className="bg-gray-100 animate-pulse w-full h-96 rounded-lg flex items-center justify-center">
          <span className="text-gray-400">Loading journal...</span>
        </div>
      ) : (
        <>
          <motion.canvas
            ref={canvasRef}
            id="journal-canvas"
            className="w-full h-auto max-w-full bg-[#f5f2e9] rounded-lg shadow-lg"
            style={{ 
              aspectRatio: '1240 / 1748',
              width: '100%',
              maxWidth: '100%',
              margin: '0 auto',
              cursor: canvasCursor
            }}
            whileHover={{ boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)' }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleMouseLeave}
            onClick={handleCanvasClick}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          />
          
          {/* Add sticker button is now moved to parent component */}
        </>
      )}
    </div>
  );
});

export default JournalCanvas; 