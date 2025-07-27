import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { motion } from 'framer-motion';
import { TextColors } from './ColorPicker';
import html2canvas from 'html2canvas';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { jsPDF } from 'jspdf';

// iOS Detection and Performance Utilities
const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
         (navigator.userAgent.includes('Safari') && navigator.userAgent.includes('Mobile'));
};

const isIOSSafari = () => {
  return isIOS() && /Safari/.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS/.test(navigator.userAgent);
};

// iOS-specific performance configurations
const getIOSOptimizedSettings = () => {
  if (isIOS()) {
    return {
      // GOODNOTES-QUALITY: Maintain quality on iOS while keeping performance
      dragCanvasScale: 0.9, // Higher resolution during drag (90% vs 50%)
      dragRenderThrottle: 16, // Keep 60fps for smooth dragging
      staticRenderThrottle: 16, // 60fps when static
      maxStickerResolution: 2048, // Higher resolution limit for iOS (same as desktop)
      enableHardwareAcceleration: true,
      useOffscreenCanvas: false, // Safari doesn't support it well
      imageSmoothingEnabled: true, // ALWAYS enable smoothing for quality
      highQualityExport: true // Enable high quality during export
    };
  } else {
    return {
      dragCanvasScale: 0.9, // Consistent quality across platforms
      dragRenderThrottle: 16,
      staticRenderThrottle: 16,
      maxStickerResolution: 2048,
      enableHardwareAcceleration: true,
      useOffscreenCanvas: true,
      imageSmoothingEnabled: true,
      highQualityExport: true
    };
  }
};

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
  x: number; // px - display position
  y: number; // px - display position
  width: number; // px - display size (transform applied)
  height: number; // px - display size (transform applied)
  rotation: number; // degrees - display rotation (transform applied)
  zIndex: number;
  imageObj?: HTMLImageElement; // for caching loaded image
  originalWidth?: number; // CRITICAL: original pixel dimensions for export
  originalHeight?: number; // CRITICAL: original pixel dimensions for export
  scaleX?: number; // transform scale factor from original to display
  scaleY?: number; // transform scale factor from original to display
  originalUrl?: string; // reference to original object URL for cleanup
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
  layoutMode?: 'standard' | 'mirrored' | 'freeflow'; // Layout mode for the journal
  editMode?: boolean; // Whether we're in edit mode
  onTextClick?: (area: ClickableTextArea) => void; // Callback when text is clicked
  onImageDrag?: (index: number, x: number, y: number) => void; // Callback when image is dragged
  onImageResize?: (index: number, width: number, height: number) => void; // Callback when image is resized
  onImageClick?: (x: number, y: number) => void; // Callback when image is clicked for eyedropper
  onImageDelete?: (index: number) => void; // Callback when image delete button is clicked
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
  showCursor?: boolean; // Add showCursor prop
  cursorVisible?: boolean; // Add cursorVisible prop
  cursorPosition?: { textAreaIndex: number; characterIndex: number } | { isLocation: true; characterIndex: number }; // Add cursorPosition prop
  needInspiration?: boolean; // Whether to show inspiration question
  inspirationQuestion?: string; // The inspiration question to display
  savedImagePositions?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>; // Saved image positions to restore
}

// Export the imperative handle type
export interface JournalCanvasHandle {
  addSticker: (file: File, width?: number, height?: number) => boolean;
  addMultipleStickers: (files: File[]) => boolean;
  exportUltraHDPDF: () => void; // Add the export function to the interface
  clearStickers: () => void; // Add function to clear all stickers
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
      layoutMode = 'freeflow', // Default to freeflow layout
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
  showCursor = false,
  cursorVisible = false,
  cursorPosition,
  needInspiration = false,
  inspirationQuestion = '',
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
  
  // Debug: Log stickers state changes
  useEffect(() => {
    console.log("Stickers state updated:", stickers.length, stickers);
  }, [stickers]);

  // Add persistence for stickers - save to localStorage whenever stickers change
  useEffect(() => {
    if (stickers.length > 0) {
      try {
        // Save stickers to localStorage with a unique key based on date and location
        const stickerKey = `stickers_${date.toISOString().split('T')[0]}_${location}`;
        const stickersToSave = stickers.map(sticker => ({
          ...sticker,
          // Don't save imageObj as it can't be serialized
          imageObj: undefined,
          // Don't save originalUrl as it's a blob URL that will be invalid
          originalUrl: undefined
        }));
        localStorage.setItem(stickerKey, JSON.stringify(stickersToSave));
        console.log("Saved stickers to localStorage:", stickerKey, stickersToSave.length);
      } catch (error) {
        console.error("Failed to save stickers to localStorage:", error);
      }
    }
  }, [stickers, date, location]);

  // Load stickers from localStorage on component mount
  useEffect(() => {
    try {
      const stickerKey = `stickers_${date.toISOString().split('T')[0]}_${location}`;
      const savedStickers = localStorage.getItem(stickerKey);
      if (savedStickers) {
        const parsedStickers = JSON.parse(savedStickers);
        console.log("Loaded stickers from localStorage:", stickerKey, parsedStickers.length);
        
        // Restore stickers with their positions and properties, and reload their images
        const restoredStickers = parsedStickers.map((sticker: any) => ({
          ...sticker,
          // Recreate imageObj and originalUrl when needed
          imageObj: undefined,
          originalUrl: undefined
        }));
        
        setStickers(restoredStickers);
        
        // Reload the images for the restored stickers
        restoredStickers.forEach((sticker: any, index: number) => {
          if (sticker.src) {
            const img = new window.Image();
            img.crossOrigin = "anonymous";
            img.decoding = 'sync';
            
            img.onload = () => {
              setStickers(prev => {
                const newStickers = [...prev];
                if (newStickers[index]) {
                  newStickers[index] = {
                    ...newStickers[index],
                    imageObj: img
                  };
                }
                return newStickers;
              });
            };
            
            img.onerror = (error) => {
              console.error("Failed to reload sticker image:", error);
            };
            
            // Handle both File objects and string URLs
            if (typeof sticker.src === 'string') {
              img.src = sticker.src;
            } else {
              // For File objects, we need to recreate the object URL
              const url = URL.createObjectURL(sticker.src);
              img.src = url;
              // Update the sticker with the new URL
              setStickers(prev => {
                const newStickers = [...prev];
                if (newStickers[index]) {
                  newStickers[index] = {
                    ...newStickers[index],
                    originalUrl: url
                  };
                }
                return newStickers;
              });
            }
          }
        });
      }
    } catch (error) {
      console.error("Failed to load stickers from localStorage:", error);
    }
  }, [date, location]); // Only reload when date or location changes

  // Clear stickers when component unmounts or when date/location changes significantly
  useEffect(() => {
    return () => {
      // Cleanup function - revoke any object URLs to prevent memory leaks
      stickers.forEach(sticker => {
        if (sticker.originalUrl) {
          URL.revokeObjectURL(sticker.originalUrl);
        }
      });
    };
  }, [stickers]);
  
  // Debug: Log stickers state changes
  useEffect(() => {
    console.log("Stickers state updated:", stickers.length, stickers);
  }, [stickers]);
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
  const [hoveredImage, setHoveredImage] = useState<number | null>(null);
  const [debounceRender, setDebounceRender] = useState(0);
  
  // Add selected image state for freeflow layout
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  
  // Simple layout image dragging state
  const [simpleImagePositions, setSimpleImagePositions] = useState<Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    image: string | Blob;
  }>>([]);
  const [draggedSimpleImage, setDraggedSimpleImage] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<{x: number, y: number}>({x: 0, y: 0});
  const [resizingSimpleImage, setResizingSimpleImage] = useState<number | null>(null);
  const [resizeStartData, setResizeStartData] = useState<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startImageX: number;
    startImageY: number;
  } | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Performance optimization refs with iOS-specific settings
  const iosSettings = getIOSOptimizedSettings();
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const isRenderingRef = useRef<boolean>(false);
  const dragAnimationFrameRef = useRef<number | null>(null);
  const lastDragUpdateRef = useRef<number>(0);
  const [isDraggingSticker, setIsDraggingSticker] = useState(false);
  const [isHighQualityMode, setIsHighQualityMode] = useState(true);
  const [isImageInteraction, setIsImageInteraction] = useState(false);
  const previousCanvasDataRef = useRef<ImageData | null>(null);
  
  // Function to trigger a re-render when needed
  const renderJournal = useCallback(() => {
    setForceRender(prev => prev + 1); // Increment to trigger a re-render
  }, []);

  // iOS-optimized throttled render function
  const throttledRender = useCallback(() => {
    const now = Date.now();
    const throttleTime = isDraggingSticker ? iosSettings.dragRenderThrottle : iosSettings.staticRenderThrottle;
    
    if (now - lastUpdateTimeRef.current > throttleTime) {
      lastUpdateTimeRef.current = now;
      renderJournal();
    }
  }, [renderJournal, isDraggingSticker, iosSettings]);

  // iOS-optimized debounced render function for drag operations
  const debouncedDragRender = useCallback(() => {
    if (dragAnimationFrameRef.current) {
      cancelAnimationFrame(dragAnimationFrameRef.current);
    }
    
    dragAnimationFrameRef.current = requestAnimationFrame(() => {
      const now = Date.now();
      if (now - lastDragUpdateRef.current > iosSettings.dragRenderThrottle) {
        lastDragUpdateRef.current = now;
        
        // On iOS, temporarily reduce quality during drag
        if (isIOS() && isDraggingSticker) {
          setIsHighQualityMode(false);
        }
        
        renderJournal();
        
        // Restore quality after a short delay
        if (isIOS() && isDraggingSticker) {
          setTimeout(() => setIsHighQualityMode(true), 100);
        }
      }
    });
  }, [renderJournal, isDraggingSticker, iosSettings]);
  
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
          weight: '900',
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
        
        // Then load the regular images
        const loadedImages: HTMLImageElement[] = [];
        
        // Create an array of promises for loading each image
        const imagePromises = images.map((src, index) => {
          return new Promise<HTMLImageElement | null>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous'; // Set crossOrigin for all images to prevent tainted canvas
            img.onload = () => {
              resolve(img);
            };
            img.onerror = (err) => {
              console.error(`Failed to load image ${index}:`, err);
              resolve(null);
            };
            // Determine source type
            if (typeof src === 'string') {
              // Use the direct source without cache busting to avoid rendering issues
              img.src = src;
            } else {
              // Blob (File) object
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
          loadedImages.push(...validImages);
        }
        
        setImageObjects(loadedImages);
        // Force a re-render when images are loaded
        renderJournal();
      } catch (err) {
        console.error('Error loading template or images:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTemplateAndImages();
  }, [images, templateUrl, fontLoaded, renderJournal]);

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
      const imgAspect = img.naturalWidth / img.naturalHeight;
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



  // Legacy debounced render for non-critical updates
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
    
    // For freeflow layout, render even if images are still loading
    // The canvas will re-render when images finish loading
    
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
      
    // Get device pixel ratio for mobile optimization
    const dpr = window.devicePixelRatio || 1;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    
    // Use identical high-resolution settings for both mobile and desktop
    // This ensures journals look exactly the same on all devices
    let canvasWidth, canvasHeight;
    // Always use high resolution for consistent quality across all devices
    canvasWidth = 3100; // 2.5x from 1240 - same for mobile and desktop
    canvasHeight = 4370; // 2.5x from 1748 - same for mobile and desktop
          
          // Create an optimized rendering context with identical settings for all devices
    const ctx = canvas.getContext('2d', { 
      alpha: true, 
      willReadFrequently: false, // Disable for better performance
      desynchronized: false, // Changed to false for better text quality
    });
    if (!ctx) return;
    
    try {
      // Set canvas dimensions
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      
      // Enable identical high-quality rendering for all devices with focus on text clarity
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Use identical crisp text rendering settings for all devices
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      
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
      
      // Handle freeflow layout mode (text-only flow)
      if (layoutMode === 'freeflow') {
        // Draw date and location first
        const dateText = formatDate(date);
        try {
          // Find optimal font size for date - same as standard/mirrored layouts
          const maxDateFontSize = calculateOptimalFontSize(
            ctx, 
            dateText, 
            canvas.width - 80,
            "'TitleFont', sans-serif",
            120,
            300
          );
          
          // Set font and color for date - identical to standard/mirrored layouts
          ctx.font = `${maxDateFontSize}px 'TitleFont', sans-serif`;
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'left';
          ctx.shadowColor = 'rgba(0,0,0,0)';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          
          // Draw date
          ctx.fillText(dateText, 40, 190);
          
          // Draw location if provided - identical styling to standard/mirrored layouts
          if (location) {
            try {
              // Get the default font size for 12 characters - same as standard/mirrored layouts
              const defaultFontSize = getDefaultLocationFontSize(ctx, canvas.width);
              
              // Use this as the maximum font size - same calculation as standard/mirrored layouts
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
              
              // Determine colors - use direct selection if provided, otherwise use default - same as standard/mirrored layouts
              const locationColor = window.FORCE_CANVAS_REDRAW 
                ? window.CURRENT_COLORS.locationColor 
                : (textColors.locationColor || '#3498DB');
              const locationShadowColor = window.FORCE_CANVAS_REDRAW 
                ? window.CURRENT_COLORS.locationShadowColor 
                : (textColors.locationShadowColor || '#AED6F1');
                  
              // Reset any existing filters or shadow settings - same as standard/mirrored layouts
              ctx.filter = 'none';
              ctx.shadowColor = 'rgba(0,0,0,0)';
              ctx.shadowBlur = 0;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 0;
              
              // Set font - identical to standard/mirrored layouts
              ctx.font = `${maxLocationFontSize}px 'TitleFont', sans-serif`;
              ctx.textAlign = 'left'; // Ensure text is left-aligned
              
              // For the location, we'll ensure it's drawn last (on top of all other elements)
              ctx.save();
              
              // Calculate the text metrics for proper positioning - same as standard/mirrored layouts
              const locationMetrics = ctx.measureText(location.toUpperCase());
              let locationBaseline;
              if (locationMetrics.fontBoundingBoxAscent) {
                locationBaseline = locationMetrics.fontBoundingBoxAscent;
              } else {
                // Fallback: estimate ascent as 0.8x the font size
                locationBaseline = maxLocationFontSize * 0.8;
              }
              
              // Position the location baseline - use the same calculation as original
              const dateTextBaselineOffset = maxDateFontSize * 0.2;
              const minSpacingBetweenElements = -40;
              const locationY = 190 + dateTextBaselineOffset + minSpacingBetweenElements + 15 + locationBaseline;
              
              // Create graffiti lag effect for location text - draw shadow first - same as standard/mirrored layouts
              ctx.fillStyle = locationShadowColor;
              const shadowX = 65;
              const shadowY = locationY + 25;
              ctx.fillText(location.toUpperCase(), shadowX, shadowY); // Offset by +5x, +5y for lag effect
              
              // Draw main location text on top - same as standard/mirrored layouts
              ctx.fillStyle = locationColor;
              const mainX = 40;
              const mainY = locationY;
              ctx.fillText(location.toUpperCase(), mainX, mainY);
              
              // Draw location cursor if editing location - same as standard/mirrored layouts
              if (cursorPosition && 'isLocation' in cursorPosition && cursorVisible) {
                const characterIndex = cursorPosition.characterIndex;
                const locationText = location.toUpperCase();
                
                // Calculate cursor position in location text
                let cursorX = mainX;
                if (characterIndex > 0 && locationText.length > 0) {
                  const textBeforeCursor = locationText.substring(0, Math.min(characterIndex, locationText.length));
                  const textMetrics = ctx.measureText(textBeforeCursor);
                  cursorX = mainX + textMetrics.width;
                }
                
                // Draw blinking cursor for location
                ctx.save();
                ctx.fillStyle = '#000000'; // Black cursor
                ctx.globalAlpha = cursorVisible ? 1.0 : 0.3;
                ctx.fillRect(cursorX, mainY - maxLocationFontSize * 0.8, 8, maxLocationFontSize); // 8px wide cursor
                ctx.restore();
              }
              
              ctx.restore();
            } catch (err) {
              console.error('Error drawing location in simple mode:', err);
            }
          }
          
          // Render simple text flow
          renderSimpleTextFlow(ctx);
          
          // Update clickable areas for simple mode
          const dateTextBaselineOffset = maxDateFontSize * 0.2;
          const minSpacingBetweenElements = -40;
          const locationY = 190 + dateTextBaselineOffset + minSpacingBetweenElements + 15;
          
          setClickableAreas([
            {
              type: 'location',
              x: 40,
              y: locationY - 30, // Approximate location area
              width: canvas.width - 80,
              height: 60,
              text: location
            }
          ]);
          
          return; // Exit early for simple mode
        } catch (err) {
          console.error('Error in simple layout mode:', err);
        }
      }
      
      // Calculate dimensions to use full page height
      const topMargin = 0; // Reduced from 80 to move everything higher
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
      interface GridLayoutItem {
        type: 'date' | 'location' | 'text' | 'image';
        x: number;
        y: number;
        width: number;
        height: number;
      }
      
      let gridLayout: GridLayoutItem[];
      
      if (layoutMode === 'standard') {
        // Standard layout (original): Images on left, text on right
        gridLayout = [
          // Row 1 - Date spans full width (moved up further)
          { type: 'date', x: 0, y: currentYPosition + 10, width: fullWidth, height: 0 },
          // Row 2 - Location spans full width (moved closer to date)
          { type: 'location', x: -10, y: currentYPosition + 10, width: fullWidth, height: 0 },
          // Row 3 - Left image, right text
          { type: 'image', x: (imageColumnWidth - 70) / 2, y: topMargin + headerHeight + 115, width: imageColumnWidth - 70, height: rowHeight - 30 },
          { type: 'text', x: imageColumnWidth - 50, y: topMargin + headerHeight, width: textColumnWidth + 100, height: rowHeight },
          // Row 4 - Left text, right image
          { type: 'text', x: 0, y: topMargin + headerHeight + rowHeight + 10, width: textColumnWidth + 85, height: rowHeight },
          { type: 'image', x: textColumnWidth + (imageColumnWidth - 70) / 2, y: topMargin - 30 + headerHeight + rowHeight + 60, width: imageColumnWidth - 70, height: rowHeight + 70 },
          // Row 5 - Third image with consistent margins
          { type: 'image', x: (imageColumnWidth - 40) / 2, y: topMargin + headerHeight + (rowHeight * 2) + 40, width: imageColumnWidth - 40, height: rowHeight + 20 },
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
          { type: 'image', x: textColumnWidth + (imageColumnWidth - 70) / 2, y: topMargin + headerHeight + 115, width: imageColumnWidth - 70, height: rowHeight - 30 },
          // Row 4 - Left image, right text (mirroring Row 4 of Style 1)
          { type: 'image', x: (imageColumnWidth - 70) / 2, y: topMargin - 30 + headerHeight + rowHeight + 60, width: imageColumnWidth - 70, height: rowHeight + 70 },
          { type: 'text', x: imageColumnWidth - 50, y: topMargin + headerHeight + rowHeight + 10, width: textColumnWidth + 100, height: rowHeight },
          // Row 5 - Left text, right image (mirroring Row 5 of Style 1)
          { type: 'text', x: -10, y: topMargin + headerHeight + (rowHeight * 2) + 20, width: textColumnWidth + 90, height: rowHeight + 100 },
          { type: 'image', x: textColumnWidth + (imageColumnWidth - 40) / 2, y: topMargin + headerHeight + (rowHeight * 2) + 40, width: imageColumnWidth - 40, height: rowHeight + 20 }
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
      
      // Draw date at the top with proper alignment and font size - use exact same positioning as freeflow
      const dateCell = gridLayout.find(cell => cell.type === 'date');
      if (dateCell) {
        const dateText = formatDate(date);
        try {
          // Find optimal font size for date - same as freeflow layout
          const maxDateFontSize = calculateOptimalFontSize(
            ctx, 
            dateText, 
            canvas.width - 80, // Use same width calculation as freeflow
            "'TitleFont', sans-serif",
            120,
            300
          );
          
          // Set font and color - always black for date text - identical to freeflow layout
          ctx.font = `${maxDateFontSize}px 'TitleFont', sans-serif`;
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'left';
          
          // Remove all shadow effects for clean, crisp text - same as freeflow layout
          ctx.shadowColor = 'rgba(0,0,0,0)';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          
          // Calculate metrics for the date text - same as freeflow layout
          const dateMetrics = ctx.measureText(dateText);
          let dateTextBaselineOffset;
          if (dateMetrics.fontBoundingBoxDescent) {
            dateTextBaselineOffset = dateMetrics.fontBoundingBoxDescent;
          } else {
            dateTextBaselineOffset = maxDateFontSize * 0.2;
          }
          
          // Draw the date text - use exact same positioning as freeflow (40, 190)
          ctx.fillText(dateText, 40, 190);
          
          // Calculate the Y position for the location - use exact same calculation as freeflow
          const minSpacingBetweenElements = -40;
          const locationY = 190 + dateTextBaselineOffset + minSpacingBetweenElements + 15;
          
          // Update the location cell's Y position to match freeflow
          const locationCell = gridLayout.find(cell => cell.type === 'location');
          if (locationCell) {
            locationCell.y = locationY;
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
              const testFontString = `900 ${size}px ZainCustomFont, Arial, sans-serif`;
              ctx.font = testFontString;
              
              const textAreas = gridLayout.filter((item: GridLayoutItem) => item.type === 'text');
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
          // Use extra bold font weight for maximum thickness
          const fontWeight = '900'; // Extra bold weight for maximum thickness
          const fontString = `${fontWeight} ${fontSize}px ZainCustomFont, Arial, sans-serif`;
          ctx.font = fontString;
          ctx.fillStyle = '#000000';
          
          // Add text stroke for extra boldness
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.5;
          
          // COMPLETELY disable all shadow effects for journal text
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          
          // Ensure crisp text rendering on mobile devices
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          ctx.filter = 'none';
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1.0;
          
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
                  ctx.save();
                  // Ensure crisp rendering with no transforms or effects
                  ctx.setTransform(1, 0, 0, 1, 0, 0);
                  ctx.direction = 'ltr';
                  ctx.fillStyle = '#000000'; // Solid black, no transparency
                  ctx.globalAlpha = 1.0;
                  // Disable all shadow effects again before drawing
                  ctx.shadowColor = 'transparent';
                  ctx.shadowBlur = 0;
                  ctx.shadowOffsetX = 0;
                  ctx.shadowOffsetY = 0;
                  
                  // Add stroke for extra boldness
                  ctx.strokeStyle = '#000000';
                  ctx.lineWidth = 1.5;
                  
                  // Draw text with stroke for extra boldness
                  drawTextWithCustomTKerning(ctx, currentLine, areaX, currentY, 8);
                  drawTextWithCustomTKerning(ctx, currentLine, areaX, currentY, 8);
                  
                  ctx.restore();
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
                  ctx.save();
                  ctx.setTransform(1, 0, 0, 1, 0, 0);
                  ctx.direction = 'ltr';
                  ctx.fillStyle = '#000000'; // Solid black, no transparency
                  ctx.globalAlpha = 1.0;
                  // Disable all shadow effects again before drawing
                  ctx.shadowColor = 'transparent';
                  ctx.shadowBlur = 0;
                  ctx.shadowOffsetX = 0;
                  ctx.shadowOffsetY = 0;
                  
                  // Add stroke for extra boldness
                  ctx.strokeStyle = '#000000';
                  ctx.lineWidth = 1.5;
                  
                  // Draw text with stroke for extra boldness
                  drawTextWithCustomTKerning(ctx, currentLine, areaX, currentY, 8);
                  drawTextWithCustomTKerning(ctx, currentLine, areaX, currentY, 8);
                  
                  ctx.restore();
                  currentLine = '';
                }
              }
            }
          }
        } catch (err) {
          console.error('Error drawing journal text:', err);
        }
      }
      

      
      // Draw cursor if enabled - always show when focused, blink with cursorVisible
      if (showCursor && cursorPosition) {
        console.log('Cursor drawing conditions met:', { showCursor, cursorPosition, cursorVisible });
        try {
          // Check if it's a location cursor or text area cursor
          if ('isLocation' in cursorPosition) {
            // Handle location cursor
            const { characterIndex } = cursorPosition;
            console.log('Drawing location cursor at character:', characterIndex);
            
            // Get location area from grid layout
            const locationArea = gridLayout.find((item: GridLayoutItem) => item.type === 'location');
            if (locationArea) {
              // Calculate font size for location
              const locationFontSize = getDefaultLocationFontSize(ctx, canvas.width);
              ctx.font = `bold ${locationFontSize}px TitleFont, Arial, sans-serif`;
              
              // Calculate cursor position in location text
              const locationText = location || '';
              const textBeforeCursor = locationText.substring(0, characterIndex);
              const textMetrics = ctx.measureText(textBeforeCursor);
              
              // Use the exact same positioning logic as the location text drawing
              const locationMetrics = ctx.measureText(locationText.toUpperCase());
              let locationBaseline;
              if (locationMetrics.fontBoundingBoxAscent) {
                locationBaseline = locationMetrics.fontBoundingBoxAscent;
              } else {
                // Fallback: estimate ascent as 0.8x the font size
                locationBaseline = locationFontSize * 0.8;
              }
              
              // Position the cursor at the exact same baseline as the location text
              const yPosition = locationArea.y + locationBaseline;
              
              const cursorX = 40 + textMetrics.width; // Same X offset as location text (40)
              const cursorY = yPosition;
              
              // Draw the location cursor
              ctx.save();
              ctx.fillStyle = '#000000'; // Black cursor
              ctx.globalAlpha = cursorVisible ? 1.0 : 0.3;
              ctx.fillRect(cursorX, cursorY - locationFontSize * 0.8, 12, locationFontSize);
              ctx.restore();
              
              console.log('LOCATION CURSOR DRAWN! Position:', { cursorX, cursorY, characterIndex, locationFontSize, cursorVisible });
            }
          } else {
            // Handle text area cursor (existing logic)
            const { textAreaIndex, characterIndex } = cursorPosition;
            
            // Get the text from the specific text area
            const textAreaText = textSections[textAreaIndex] || '';
            console.log('Drawing cursor for text area:', textAreaIndex, 'with text:', textAreaText, 'at character:', characterIndex);
            
            // Calculate font size (same logic as text drawing)
            const minFontSize = 28;
            const maxFontSize = 140;
            const totalLines = 21;
            
            let low = minFontSize;
            let high = maxFontSize;
            let fontSize = minFontSize;
            
            const referenceText = Array(98).fill("word").join(" ");
            const referenceWords = referenceText.split(' ');
            
            const countReferenceLines = (size: number): number => {
              try {
                const testFontString = `900 ${size}px ZainCustomFont, Arial, sans-serif`;
                ctx.font = testFontString;
                
                const textAreas = gridLayout.filter((item: GridLayoutItem) => item.type === 'text');
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
                return totalLines + 1;
              }
            };
            
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
            
            while (fontSize < maxFontSize && countReferenceLines(fontSize + 1) <= totalLines) {
              fontSize += 1;
            }
            
            fontSize = Math.max(minFontSize, fontSize * 0.85);
            
            // Set font for cursor positioning
            const cursorFontWeight = '900'; // Extra bold weight to match text
            ctx.font = `${cursorFontWeight} ${fontSize}px ZainCustomFont, Arial, sans-serif`;
            
            // Get text areas and calculate cursor position
            const textAreas = gridLayout.filter((item: GridLayoutItem) => item.type === 'text');
            const orderedTextAreas = [textAreas[0], textAreas[1], textAreas[2]];
            
            if (textAreaIndex >= 0 && textAreaIndex < orderedTextAreas.length) {
              const area = orderedTextAreas[textAreaIndex];
              const areaX = area.x + 60;
              const areaWidth = area.width - 160;
              
              // Get the line ranges for each text area
              const textAreaLineRanges = [
                { startLine: 0, endLine: 6 },
                { startLine: 7, endLine: 13 },
                { startLine: 14, endLine: 20 }
              ];
              
              const lineRange = textAreaLineRanges[textAreaIndex];
              
              // Default cursor position (for empty text)
              let cursorX = areaX;
              let cursorY = journalLineYCoords[lineRange.startLine];
              
              // If there's text, calculate the exact cursor position
              if (textAreaText.length > 0) {
                // Split text into words and simulate layout for this specific text area
                const words = textAreaText.split(' ');
                let currentWord = 0;
                let currentLine = '';
                let charactersProcessed = 0;
                let cursorFound = false;
                
                for (let lineIndex = lineRange.startLine; lineIndex <= lineRange.endLine && currentWord < words.length; lineIndex++) {
                  const currentY = journalLineYCoords[lineIndex];
                  currentLine = '';
                  
                  while (currentWord < words.length) {
                    const nextWord = words[currentWord];
                    const testLine = currentLine ? `${currentLine} ${nextWord}` : nextWord;
                    const metrics = ctx.measureText(testLine);
                    
                    if (metrics.width > areaWidth && currentLine) {
                      // Line is full, check if cursor is in this line
                      const lineLength = currentLine.length;
                      
                      if (charactersProcessed <= characterIndex && characterIndex <= charactersProcessed + lineLength) {
                        // Cursor is in this line
                        const charIndexInLine = characterIndex - charactersProcessed;
                        const textBeforeCursor = currentLine.substring(0, charIndexInLine);
                        const textMetrics = ctx.measureText(textBeforeCursor);
                        
                        cursorX = areaX + textMetrics.width;
                        cursorY = currentY;
                        cursorFound = true;
                        break;
                      }
                      
                      charactersProcessed += lineLength + 1; // +1 for space
                      currentLine = '';
                      break;
                    } else {
                      currentLine = testLine;
                      currentWord++;
                    }
                  }
                  
                  if (cursorFound) break;
                  
                  // Check if cursor is at the end of the last line
                  if (currentWord >= words.length || lineIndex === lineRange.endLine) {
                    if (currentLine) {
                      const lineLength = currentLine.length;
                      
                      if (charactersProcessed <= characterIndex && characterIndex <= charactersProcessed + lineLength) {
                        const charIndexInLine = characterIndex - charactersProcessed;
                        const textBeforeCursor = currentLine.substring(0, charIndexInLine);
                        const textMetrics = ctx.measureText(textBeforeCursor);
                        
                        cursorX = areaX + textMetrics.width;
                        cursorY = currentY;
                        cursorFound = true;
                      }
                      
                      charactersProcessed += lineLength + 1;
                    }
                    break;
                  }
                }
              }
              
              // Draw the chunky cursor - always visible when focused, blink with opacity
              ctx.save();
              ctx.fillStyle = '#000000'; // Black cursor
              ctx.globalAlpha = cursorVisible ? 1.0 : 0.3; // Use opacity for blinking, never fully invisible
              ctx.fillRect(cursorX, cursorY - fontSize * 0.8, 12, fontSize); // 12px wide chunky cursor
              ctx.restore();
              
              console.log('CURSOR DRAWN! Position:', { cursorX, cursorY, textAreaIndex, characterIndex, fontSize, cursorVisible, opacity: cursorVisible ? 1.0 : 0.3, hasText: textAreaText.length > 0 });
              console.log('Canvas dimensions:', { width: canvas.width, height: canvas.height });
              console.log('Cursor rect:', { x: cursorX, y: cursorY - fontSize * 0.8, width: 12, height: fontSize });
            }
          }
        } catch (err) {
          console.error('Error drawing cursor:', err);
        }
      }
      
      // Draw each image with its position, with proper borders and padding
      try {
        const maxImages = Math.min(imageObjects.length, imagePositions.length);
        for (let i = 0; i < maxImages; i++) {
          const img = imageObjects[i];
          const position = imagePositions[i];
          
          // ALWAYS use the high-quality drawing function to preserve aspect ratio
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
          
          // Draw delete button if image is hovered and in edit mode
          if (props.editMode && hoveredImage === i && layoutMode === 'freeflow') {
            const deleteBtnX = position.x + position.width - 20;
            const deleteBtnY = position.y + 20;
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
            drawSFSymbolButton(
              ctx,
              deleteBtnX,
              deleteBtnY,
              '#ff4444', // Red background
              'delete',
              isMobile ? 200 : 150, // REASONABLE but much bigger buttons
              false
            );
          }
        }
      } catch (err) {
        console.error('Error drawing images:', err);
      }
      
      // Draw location LAST (after all other elements) to ensure it's on top of everything - identical to freeflow layout
      if (locationCell && location) {
        try {
          // Get the default font size for 12 characters - same as freeflow layout
          const defaultFontSize = getDefaultLocationFontSize(ctx, canvas.width);
          
          // Use this as the maximum font size - same calculation as freeflow layout
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
          
          // Determine colors - use direct selection if provided, otherwise use default - same as freeflow layout
          const locationColor = window.FORCE_CANVAS_REDRAW 
            ? window.CURRENT_COLORS.locationColor 
            : (textColors.locationColor || '#3498DB');
          const locationShadowColor = window.FORCE_CANVAS_REDRAW 
            ? window.CURRENT_COLORS.locationShadowColor 
            : (textColors.locationShadowColor || '#AED6F1');
              
          // Reset any existing filters or shadow settings - same as freeflow layout
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
          
          // Set font - identical to freeflow layout
          ctx.font = `${maxLocationFontSize}px 'TitleFont', sans-serif`;
          ctx.textAlign = 'left'; // Ensure text is left-aligned
          
          // For the location, we'll ensure it's drawn last (on top of all other elements)
          ctx.save();
          
          // Calculate the text metrics for proper positioning - same as freeflow layout
          const locationMetrics = ctx.measureText(location.toUpperCase());
          let locationBaseline;
          if (locationMetrics.fontBoundingBoxAscent) {
            locationBaseline = locationMetrics.fontBoundingBoxAscent;
          } else {
            // Fallback: estimate ascent as 0.8x the font size
            locationBaseline = maxLocationFontSize * 0.8;
          }
          
          // Calculate location position - use exact same calculation as freeflow
          const dateTextBaselineOffset = 300 * 0.2; // Use approximate date font size
          const minSpacingBetweenElements = -40;
          const locationY = 190 + dateTextBaselineOffset + minSpacingBetweenElements + 15 + locationBaseline;
          
          // Position the location baseline - use exact same positioning as freeflow
          const yPosition = locationY;
          
          // Clear any previous text in this area to prevent ghosting
          ctx.save();
          ctx.fillStyle = "#ffffff";
          ctx.globalAlpha = 0; // Make it invisible
          ctx.fillRect(0, locationY - maxLocationFontSize, canvas.width, maxLocationFontSize * 2);
          ctx.restore();
          
          // Create graffiti lag effect for location text - draw shadow first - same as freeflow
          ctx.fillStyle = locationShadowColor;
          const shadowX = 65;
          const shadowY = yPosition + 25;
          ctx.fillText(location.toUpperCase(), shadowX, shadowY); // Offset by +5x, +5y for lag effect
          
          // Draw main location text on top - same as freeflow
          ctx.fillStyle = locationColor;
          const mainX = 40;
          const mainY = yPosition;
          ctx.fillText(location.toUpperCase(), mainX, mainY);
          
          // Draw location cursor if editing location
          if (cursorPosition && 'isLocation' in cursorPosition && cursorVisible) {
            const characterIndex = cursorPosition.characterIndex;
            const locationText = location.toUpperCase();
            
            // Calculate cursor position in location text
            let cursorX = mainX;
            if (characterIndex > 0 && locationText.length > 0) {
              const textBeforeCursor = locationText.substring(0, Math.min(characterIndex, locationText.length));
              const textMetrics = ctx.measureText(textBeforeCursor);
              cursorX = mainX + textMetrics.width;
            }
            
            // Draw blinking cursor for location
            ctx.save();
            ctx.fillStyle = '#000000'; // Black cursor
            ctx.globalAlpha = cursorVisible ? 1.0 : 0.3;
            ctx.fillRect(cursorX, mainY - maxLocationFontSize * 0.8, 8, maxLocationFontSize); // 8px wide cursor
            ctx.restore();
            
            console.log('LOCATION CURSOR DRAWN! Position:', { 
              cursorX, 
              cursorY: mainY, 
              characterIndex, 
              fontSize: maxLocationFontSize, 
              locationText,
              textBeforeCursor: location.toUpperCase().substring(0, characterIndex)
            });
          }
          
          ctx.restore();
        } catch (err) {
          console.error('Error drawing location:', err);
        }
      }
      
      // Draw inspiration question in ghost white if enabled
      if (needInspiration && inspirationQuestion && inspirationQuestion.trim()) {
        try {
          // Get the text areas to find a good position for the inspiration question
          const textAreas = gridLayout.filter((item: GridLayoutItem) => item.type === 'text');
          if (textAreas.length > 0) {
            // Use the last text area for the inspiration question
            const lastTextArea = textAreas[textAreas.length - 1];
            const areaX = lastTextArea.x + 60;
            const areaY = lastTextArea.y + lastTextArea.height + 40; // Position below the last text area
            
            // Set font for inspiration question
            const inspirationFontSize = 24; // Smaller than main text
            ctx.font = `900 ${inspirationFontSize}px ZainCustomFont, Arial, sans-serif`;
            ctx.textAlign = 'left';
            
            // Draw inspiration question in ghost white (semi-transparent white)
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; // Ghost white with 60% opacity
            ctx.globalAlpha = 0.8; // Additional transparency
            ctx.fillText(inspirationQuestion, areaX, areaY);
            ctx.restore();
          }
        } catch (err) {
          console.error('Error drawing inspiration question:', err);
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
      console.log(`Checking stickers: ${stickers.length} stickers in array`);
      if (stickers.length > 0) {
          console.log(`Rendering ${stickers.length} stickers`);
          
          // Sort stickers by z-index for proper layering
          const sortedStickers = [...stickers].sort((a, b) => a.zIndex - b.zIndex);
          
          sortedStickers.forEach((sticker, i) => {
            let img = sticker.imageObj;
            
            // If image is not loaded yet, load it with iOS optimizations
            if (!img && sticker.src) {
              img = new window.Image();
              img.crossOrigin = "anonymous";
              
              // iOS-specific optimizations
              if (isIOS()) {
                img.decoding = 'async'; // Async decoding for better performance on iOS
                // Limit image resolution on iOS to prevent memory issues
                if (isDraggingSticker && !isHighQualityMode) {
                  img.loading = 'lazy'; // Lazy loading during drag
                }
              } else {
                img.decoding = 'sync'; // Synchronous decoding for best quality on other platforms
              }
              
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
              
              // STEP 3: GOODNOTES-STYLE GPU TRANSFORMS
              // Move to sticker center and apply rotation (pure CSS transform equivalent)
              ctx.translate(sticker.x + sticker.width/2, sticker.y + sticker.height/2);
              ctx.rotate((sticker.rotation * Math.PI) / 180);
              
              // STEP 4: GOODNOTES-STYLE IMAGE RENDERING
              // Use original image dimensions ALWAYS - no quality reduction during drag
              const sourceWidth = img.naturalWidth || img.width;
              const sourceHeight = img.naturalHeight || img.height;
              
              // GOODNOTES-QUALITY: Always use smooth high-quality rendering
              // Calculate display scale for potential optimizations
              const displayScale = Math.min(sticker.width / sourceWidth, sticker.height / sourceHeight);
              
              // ALWAYS use high-quality smooth rendering like GoodNotes
              ctx.imageSmoothingEnabled = true;
              
              if (isHighQualityMode || !isDraggingSticker) {
                // STATIC OR EXPORT: Maximum quality
                ctx.imageSmoothingQuality = 'high';
              } else {
                // DRAGGING: Still use good quality but optimize for performance
                ctx.imageSmoothingQuality = 'high'; // Keep high quality even during drag
              }
              
              // STEP 5: RENDER ORIGINAL IMAGE WITH TRANSFORMS
              // Always use the full original source - never downsample
              ctx.drawImage(
                img,
                0, 0, sourceWidth, sourceHeight, // Source: ALWAYS use original full resolution
                -sticker.width/2, -sticker.height/2, sticker.width, sticker.height // Destination: Apply transforms here
              );
              
              // Draw border and controls if sticker is active (only in freeflow mode)
              if (activeSticker !== null && stickers[activeSticker] === sticker && layoutMode === 'freeflow') {
                // iOS-optimized selection border - much more visible like GoodNotes
                const borderWidth = isIOS() ? 12 : 8; // Thicker on iOS
                const dashSize = isIOS() ? [30, 20] : [20, 15]; // Bigger dashes on iOS
                
                ctx.setLineDash(dashSize);
                ctx.strokeStyle = '#3b82f6'; // Bright blue
                ctx.lineWidth = borderWidth;
                ctx.strokeRect(-sticker.width/2, -sticker.height/2, sticker.width, sticker.height);
                ctx.setLineDash([]);
                
                // Enhanced glow effect for better visibility on iOS
                ctx.save();
                ctx.shadowColor = '#3b82f6';
                ctx.shadowBlur = isIOS() ? 30 : 20; // More glow on iOS
                ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
                ctx.lineWidth = isIOS() ? 16 : 12; // Thicker glow on iOS
                ctx.strokeRect(-sticker.width/2, -sticker.height/2, sticker.width, sticker.height);
                ctx.restore();
                
                // iOS-optimized button sizes - much larger touch targets like GoodNotes
                const btnRadius = isIOS() ? 80 : 60; // Much bigger on iOS for easy touch
                
                // iOS-optimized button positioning - further out for easier touch
                // Mobile-optimized button positioning - VISUALLY MUCH BIGGER
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
                const buttonOffset = isMobile ? 200 : (isIOS() ? 100 : 60); // Much further on all devices (mobile: 200, iOS: 100, desktop: 60)
                const topButtonOffset = isMobile ? 300 : (isIOS() ? 200 : 150); // Even further for top button on all devices (mobile: 300, iOS: 200, desktop: 150)
                
                // Delete (bright red, white X) - top-left - FORCE HUGE
                drawSFSymbolButton(
                  ctx, 
                  -sticker.width/2 - buttonOffset,
                  -sticker.height/2 - buttonOffset,
                  '#ef4444', // Bright red
                  'delete', 
                  isMobile ? 200 : 150, // REASONABLE but much bigger buttons
                  hoveredButton === 'delete'
                );
                
                // Rotate (bright blue, white arrow) - top-center - FORCE HUGE
                drawSFSymbolButton(
                  ctx, 
                  0, 
                  -sticker.height/2 - topButtonOffset,
                  '#3b82f6', // Brighter blue
                  'rotate', 
                  isMobile ? 200 : 150, // REASONABLE but much bigger buttons
                  hoveredButton === 'rotate'
                );
                
                // Resize (bright green, white diagonal) - bottom-right - FORCE HUGE
                drawSFSymbolButton(
                  ctx, 
                  sticker.width/2 + buttonOffset,
                  sticker.height/2 + buttonOffset,
                  '#10b981', // Green for resize (more intuitive)
                  'resize', 
                  isMobile ? 200 : 150, // REASONABLE but much bigger buttons
                  hoveredButton === 'resize'
                );
              }
              
              ctx.restore();
            }
          });
      }

        // After drawing stickers, store button positions for hit detection (only in freeflow mode)
        if (activeSticker !== null && stickers[activeSticker] && layoutMode === 'freeflow') {
          const sticker = stickers[activeSticker];
          const centerX = sticker.x + sticker.width/2;
          const centerY = sticker.y + sticker.height/2;
          const angle = sticker.rotation * Math.PI / 180;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          
          // Mobile-optimized button positioning - VISUALLY MUCH BIGGER
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
          const buttonOffset = isMobile ? 200 : (isIOS() ? 100 : 60); // Increased for all devices (mobile: 200, iOS: 100, desktop: 60)
          const topButtonOffset = isMobile ? 300 : (isIOS() ? 200 : 150); // Increased for all devices (mobile: 300, iOS: 200, desktop: 150)
          
          // Calculate rotation-adjusted button positions
          const deleteOffsetX = -sticker.width/2 - buttonOffset;
          const deleteOffsetY = -sticker.height/2 - buttonOffset;
          const deleteBtnX = centerX + deleteOffsetX * cos - deleteOffsetY * sin;
          const deleteBtnY = centerY + deleteOffsetX * sin + deleteOffsetY * cos;
          
          const rotateOffsetX = 0;
          const rotateOffsetY = -sticker.height/2 - topButtonOffset;
          const rotateBtnX = centerX + rotateOffsetX * cos - rotateOffsetY * sin;
          const rotateBtnY = centerY + rotateOffsetX * sin + rotateOffsetY * cos;
          
          const resizeOffsetX = sticker.width/2 + buttonOffset;
          const resizeOffsetY = sticker.height/2 + buttonOffset;
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
  }, [date, location, textSections, imageObjects, isLoading, templateImage, fontLoaded, getCombinedText, textColors, forceRender, props.forceUpdate, renderCount, layoutMode, stickers, activeSticker, stickerDragOffset, stickerAction, hoveredButton, debounceRender, simpleImagePositions, selectedImage, Date.now()]); // Added timestamp to force refresh

  // iOS-optimized ultra-high-quality export function
  const exportUltraHDPDF = () => {
    if (!canvasRef.current) return;
    
    // Force high quality mode for export
    const wasHighQuality = isHighQualityMode;
    const wasDragging = isDraggingSticker;
    
    // Clear any image selection before export to hide handles
    const wasSelectedImage = selectedImage;
    setSelectedImage(null);
    
    setIsHighQualityMode(true);
    setIsDraggingSticker(false);
    
    // iOS-specific: Ensure we're not in any performance mode
    if (isIOS()) {
      // Force a high-quality re-render before export
      setTimeout(() => {
        renderJournal();
        setTimeout(() => {
          performExport();
        }, 100); // Wait for render to complete
      }, 50);
    } else {
      performExport();
    }
    
         function performExport() {
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
    if (!journalCanvas) return;
    
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
    
    // Restore original quality settings after export
    setIsHighQualityMode(wasHighQuality);
    setIsDraggingSticker(wasDragging);
    setSelectedImage(wasSelectedImage);
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

  // Function to render simple text flow with dynamic image wrapping
  // Helper function to calculate text wrapping around images with precise dimensions
  const calculateTextWrapping = (
    currentY: number, 
    fontSize: number, 
    imagePositions: Array<{x: number, y: number, width: number, height: number}>,
    canvas: HTMLCanvasElement,
    textWidth: number,
    leftMargin: number,
    rightMargin: number
  ) => {
    let availableWidth = textWidth;
    let startX = leftMargin;
    
    // Calculate text line height (approximate)
    const lineHeight = fontSize * 1.2; // Rough estimate of line height
    const textTop = currentY - lineHeight * 0.8; // Text baseline is roughly 80% down from top
    const textBottom = currentY + lineHeight * 0.2; // Text extends a bit below baseline
    
    // Check if any images overlap with this text line
    const overlappingImages = imagePositions.filter(imagePos => {
      const imageTop = imagePos.y;
      const imageBottom = imagePos.y + imagePos.height;
      
      // Check if the text line overlaps with the image vertically
      const verticalOverlap = textBottom > imageTop && textTop < imageBottom;
      
      if (!verticalOverlap) return false;
      
      // Check if the image blocks the text horizontally within the text area
      const imageLeft = imagePos.x;
      const imageRight = imagePos.x + imagePos.width;
      const textAreaLeft = leftMargin;
      const textAreaRight = canvas.width - rightMargin;
      
      // Check if image intersects with the text area
      const horizontalOverlap = imageRight > textAreaLeft && imageLeft < textAreaRight;
      
      return horizontalOverlap;
    });
    
    if (overlappingImages.length > 0) {
      // Sort images by x position to handle multiple images on the same line
      overlappingImages.sort((a, b) => a.x - b.x);
      
      // Find all available text segments on this line
      const textSegments = [];
      
      // Check space before the first image
      const firstImage = overlappingImages[0];
      const spaceBeforeFirst = firstImage.x - leftMargin;
      if (spaceBeforeFirst > 100) { // At least 100px for meaningful text
        textSegments.push({
          start: leftMargin,
          end: firstImage.x - 20, // 20px gap
          width: firstImage.x - leftMargin - 20
        });
      }
      
      // Check spaces between images
      for (let i = 0; i < overlappingImages.length - 1; i++) {
        const currentImage = overlappingImages[i];
        const nextImage = overlappingImages[i + 1];
        const gapStart = currentImage.x + currentImage.width + 20; // 20px gap
        const gapEnd = nextImage.x - 20; // 20px gap
        
        if (gapEnd > gapStart && gapEnd - gapStart > 100) { // At least 100px for text
          textSegments.push({
            start: gapStart,
            end: gapEnd,
            width: gapEnd - gapStart
          });
        }
      }
      
      // Check space after the last image
      const lastImage = overlappingImages[overlappingImages.length - 1];
      const spaceAfterLast = (canvas.width - rightMargin) - (lastImage.x + lastImage.width);
      if (spaceAfterLast > 100) { // At least 100px for meaningful text
        textSegments.push({
          start: lastImage.x + lastImage.width + 20, // 20px gap
          end: canvas.width - rightMargin,
          width: spaceAfterLast - 20
        });
      }
      
      // Find the best text segment (widest available space)
      if (textSegments.length > 0) {
        // Sort by width to find the widest segment
        textSegments.sort((a, b) => b.width - a.width);
        const bestSegment = textSegments[0];
        
        startX = bestSegment.start;
        availableWidth = bestSegment.width;
        
        // If the best segment is too narrow, try to use multiple segments
        if (availableWidth < 300 && textSegments.length > 1) {
          // Try to combine adjacent segments
          for (let i = 0; i < textSegments.length - 1; i++) {
            const current = textSegments[i];
            const next = textSegments[i + 1];
            
            // Check if segments are close enough to combine (less than 200px gap)
            if (next.start - current.end < 200) {
              const combinedWidth = next.end - current.start;
              if (combinedWidth > availableWidth) {
                startX = current.start;
                availableWidth = combinedWidth;
              }
            }
          }
        }
      } else {
        // No good segments found - this line is effectively blocked
        availableWidth = 0;
        startX = leftMargin;
      }
    }
    
    // Ensure minimum width for readability
    if (availableWidth < 150) {
      availableWidth = 0; // No meaningful space available
    }
    
    return { availableWidth, startX };
  };

  const renderSimpleTextFlow = (ctx: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Use the existing hardcoded line coordinates that match the template
    const journalLineYCoords = [
      700, 890, 1070, 1250, 1430, 1610, 1800, 1980, 2160, 2340, 
      2520, 2700, 2880, 3060, 3240, 3440, 3620, 3800, 3990, 4160, 4330
    ];
    
    // Get images for simple layout (max 3)
    const simpleImages = images.slice(0, 3);
    
    // Text area setup - use full width with margins
    const leftMargin = 80;
    const rightMargin = 80;
    const textWidth = canvas.width - leftMargin - rightMargin; // 2940px available width
    
    // Get combined text
    const journalText = getCombinedText();
    // For freeflow layout, render even if there's no text (to show images)
    if (!journalText && simpleImagePositions.length === 0) return;
    
    // Font size bounds
    const minFontSize = 28;
    const maxFontSize = 140;
    
    // Calculate line spacing (distance between lines)
    const lineSpacing = journalLineYCoords.length > 1 ? 
      journalLineYCoords[1] - journalLineYCoords[0] : 190; // Default spacing
    
    // Calculate how many additional lines we can fit below the last hardcoded line
    const lastHardcodedLineY = journalLineYCoords[journalLineYCoords.length - 1]; // 4330
    const bottomMargin = 0; // No margin - go all the way to the bottom
    const availableHeightBelow = canvas.height - lastHardcodedLineY - bottomMargin; // 4370 - 4330 = 40
    const additionalLines = Math.max(0, Math.floor(availableHeightBelow / lineSpacing));
    
    // Total lines available (hardcoded + additional)
    const totalLines = journalLineYCoords.length + additionalLines;
    
    // Use state-managed image positions for simple layout
    const imagePositions = simpleImagePositions;

    // Optimistic font sizing: start large, only shrink if needed
    let fontSize = maxFontSize;
    let fits = false;
    while (fontSize >= minFontSize && !fits) {
      ctx.font = `900 ${fontSize}px ZainCustomFont, Arial, sans-serif`;
      const words = journalText.split(' ');
      let currentWord = 0;
      let usedLines = 0;
      
          // Simulate text flow to see if all words fit using ALL available lines
    for (let lineIndex = 0; lineIndex < totalLines && currentWord < words.length; lineIndex++) {
      let currentLine = '';
      const currentY = lineIndex < journalLineYCoords.length ? 
        journalLineYCoords[lineIndex] : 
        lastHardcodedLineY + (lineIndex - journalLineYCoords.length + 1) * lineSpacing;
      
      // Calculate available width for this line (accounting for images)
      const { availableWidth, startX } = calculateTextWrapping(currentY, fontSize, imagePositions, canvas, textWidth, leftMargin, rightMargin);
      
      // Fill this line with as many words as possible
      if (availableWidth > 0) { // Only try to add words if there's space available
        while (currentWord < words.length) {
          const nextWord = words[currentWord];
          const testLine = currentLine ? `${currentLine} ${nextWord}` : nextWord;
          const metrics = ctx.measureText(testLine);
          
          if (metrics.width > availableWidth && currentLine) {
            // Word doesn't fit on this line, break to next line
            break;
          } else {
            // Word fits on this line
            currentLine = testLine;
            currentWord++;
          }
        }
        
        // Only count this line as used if we actually put text on it
        if (currentLine) {
          usedLines++;
        }
      }
      // If no space available on this line, don't count it as used and skip to next line
      
      // If we've used all words, we're done
      if (currentWord >= words.length) {
        break;
      }
    }
      
      // Only shrink if there are still words left after using ALL available lines
      // This ensures we use the very last line completely before shrinking
      fits = currentWord >= words.length;
      
      if (!fits) {
        fontSize -= 0.5; // More conservative font size reduction
      }
    }
    fontSize = Math.max(minFontSize, fontSize);
    ctx.font = `900 ${fontSize}px ZainCustomFont, Arial, sans-serif`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // Render the text on ALL available lines (hardcoded + additional)
    const words = journalText.split(' ');
    let currentWord = 0;
    let currentLine = '';
    
    // First, render on hardcoded lines
    for (let lineIndex = 0; lineIndex < journalLineYCoords.length && currentWord < words.length; lineIndex++) {
      const currentY = journalLineYCoords[lineIndex];
      
      // Clear the current line for this iteration
      currentLine = '';
      
      // Calculate available width for this line (accounting for images)
      const { availableWidth, startX } = calculateTextWrapping(currentY, fontSize, imagePositions, canvas, textWidth, leftMargin, rightMargin);
      
      // Fill this line with as many words as possible
      if (availableWidth > 0) { // Only try to add words if there's space available
        while (currentWord < words.length) {
          const nextWord = words[currentWord];
          const testLine = currentLine ? `${currentLine} ${nextWord}` : nextWord;
          const metrics = ctx.measureText(testLine);
          
          // If this word would make the line too long, break to next line
          if (metrics.width > availableWidth && currentLine) {
            break;
          } else {
            currentLine = testLine;
            currentWord++;
          }
        }
      }
      // If no space available on this line, skip to next line without using any words
      
      // Draw the line if it has content
      if (currentLine) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.direction = 'ltr';
        ctx.fillStyle = '#000000';
        ctx.globalAlpha = 1.0;
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        // Add stroke for extra boldness
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        
        // Draw text with stroke for extra boldness
        drawTextWithCustomTKerning(ctx, currentLine, startX, currentY, 8);
        drawTextWithCustomTKerning(ctx, currentLine, startX, currentY, 8);
        ctx.restore();
      }
      
      // If we've used all words, we're done
      if (currentWord >= words.length) {
        break;
      }
    }
    
    // Then, continue rendering on additional lines below the last hardcoded line
    for (let additionalLineIndex = 0; additionalLineIndex < additionalLines && currentWord < words.length; additionalLineIndex++) {
      const currentY = lastHardcodedLineY + (additionalLineIndex + 1) * lineSpacing;
      
      // Clear the current line for this iteration
      currentLine = '';
      
      // Calculate available width for this line (accounting for images)
      const { availableWidth, startX } = calculateTextWrapping(currentY, fontSize, imagePositions, canvas, textWidth, leftMargin, rightMargin);
      
      // Fill this line with as many words as possible
      if (availableWidth > 0) { // Only try to add words if there's space available
        while (currentWord < words.length) {
          const nextWord = words[currentWord];
          const testLine = currentLine ? `${currentLine} ${nextWord}` : nextWord;
          const metrics = ctx.measureText(testLine);
          
          // If this word would make the line too long, break to next line
          if (metrics.width > availableWidth && currentLine) {
            break;
          } else {
            currentLine = testLine;
            currentWord++;
          }
        }
      }
      // If no space available on this line, skip to next line without using any words
      
      // Draw the line if it has content
      if (currentLine) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.direction = 'ltr';
        ctx.fillStyle = '#000000';
        ctx.globalAlpha = 1.0;
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        // Add stroke for extra boldness
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        
        // Draw text with stroke for extra boldness
        drawTextWithCustomTKerning(ctx, currentLine, startX, currentY, 8);
        drawTextWithCustomTKerning(ctx, currentLine, startX, currentY, 8);
        ctx.restore();
      }
      
      // If we've used all words, we're done
      if (currentWord >= words.length) {
        break;
      }
    }
    
    // Draw images for freeflow layout
    if (imagePositions.length > 0 && imageObjects.length > 0) {
      imagePositions.forEach((imagePos, index) => {
        // Use the pre-loaded image objects from imageObjects array
        if (imageObjects[index]) {
          const img = imageObjects[index];
          
          // Draw the image
          ctx.save();
          ctx.drawImage(img, imagePos.x, imagePos.y, imagePos.width, imagePos.height);
          
          // Draw border and controls if in edit mode and image is selected
          if (props.editMode && selectedImage === index) {
            // Draw subtle border
            ctx.strokeStyle = draggedSimpleImage === index ? '#007AFF' : 'rgba(0, 122, 255, 0.6)';
            ctx.lineWidth = 2;
            ctx.strokeRect(imagePos.x, imagePos.y, imagePos.width, imagePos.height);
            
            // Draw delete button (top-left) - elegant design
            const deleteBtnX = imagePos.x + 30;
            const deleteBtnY = imagePos.y + 30;
            const deleteBtnRadius = 200; // Match visual button size for full clickable area
            
            // Draw delete button with shadow
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            
            // Delete button background
            ctx.fillStyle = '#FF3B30';
            ctx.beginPath();
            ctx.arc(deleteBtnX, deleteBtnY, deleteBtnRadius, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.restore();
            
            // Draw elegant X icon
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 20; // REASONABLE line width
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(deleteBtnX - 60, deleteBtnY - 60);
            ctx.lineTo(deleteBtnX + 60, deleteBtnY + 60);
            ctx.moveTo(deleteBtnX + 60, deleteBtnY - 60);
            ctx.lineTo(deleteBtnX - 60, deleteBtnY + 60);
            ctx.stroke();
            
            // Draw resize handle (bottom-right) - elegant design
            const resizeBtnX = imagePos.x + imagePos.width - 30;
            const resizeBtnY = imagePos.y + imagePos.height - 30;
            const resizeBtnRadius = 200; // Match visual button size for full clickable area
            const isResizing = resizingSimpleImage === index;
            
            // Draw resize button with shadow
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            
            // Resize button background
            ctx.fillStyle = isResizing ? '#0056CC' : '#007AFF';
            ctx.beginPath();
            ctx.arc(resizeBtnX, resizeBtnY, resizeBtnRadius, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.restore();
            
            // Draw GoodNotes-style scaling icon (corner handles) - BIG SIZE
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 20; // Much thicker to match delete button
            ctx.lineCap = 'round';
            
            // Draw corner handles like GoodNotes - BIG SIZE
            ctx.beginPath();
            
            // Top-left corner handle
            ctx.moveTo(resizeBtnX - 60, resizeBtnY - 45);
            ctx.lineTo(resizeBtnX - 60, resizeBtnY - 75);
            ctx.moveTo(resizeBtnX - 60, resizeBtnY - 75);
            ctx.lineTo(resizeBtnX - 30, resizeBtnY - 75);
            
            // Bottom-right corner handle
            ctx.moveTo(resizeBtnX + 60, resizeBtnY + 45);
            ctx.lineTo(resizeBtnX + 60, resizeBtnY + 75);
            ctx.moveTo(resizeBtnX + 60, resizeBtnY + 75);
            ctx.lineTo(resizeBtnX + 30, resizeBtnY + 75);
            
            // Top-right corner handle
            ctx.moveTo(resizeBtnX + 60, resizeBtnY - 45);
            ctx.lineTo(resizeBtnX + 60, resizeBtnY - 75);
            ctx.moveTo(resizeBtnX + 60, resizeBtnY - 75);
            ctx.lineTo(resizeBtnX + 30, resizeBtnY - 75);
            
            // Bottom-left corner handle
            ctx.moveTo(resizeBtnX - 60, resizeBtnY + 45);
            ctx.lineTo(resizeBtnX - 60, resizeBtnY + 75);
            ctx.moveTo(resizeBtnX - 60, resizeBtnY + 75);
            ctx.lineTo(resizeBtnX - 30, resizeBtnY + 75);
            
            ctx.stroke();
          }
          
          ctx.restore();
        }
      });
    }
  };

  // Add click handler for sticker selection
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !props.editMode) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    console.log("Canvas clicked at:", mouseX, mouseY);

    // First check for image delete button clicks
    if (props.editMode && hoveredImage !== null && imagePositionsRef.current[hoveredImage]) {
      const position = imagePositionsRef.current[hoveredImage];
      const deleteBtnX = position.x + position.width - 20;
      const deleteBtnY = position.y + 20;
      const btnRadius = 20;
      
      // Check if delete button was clicked
      if (Math.sqrt((mouseX - deleteBtnX) ** 2 + (mouseY - deleteBtnY) ** 2) <= btnRadius) {
        console.log("Deleting image:", hoveredImage);
        if (props.onImageDelete) {
          props.onImageDelete(hoveredImage);
        }
        setHoveredImage(null);
        return;
      }
    }

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

    // Check if we clicked on a freeflow layout image
    if (layoutMode === 'freeflow' && simpleImagePositions.length > 0) {
      let clickedOnImage = false;
      
      for (let i = simpleImagePositions.length - 1; i >= 0; i--) {
        const imagePos = simpleImagePositions[i];
        
        // Check if click is inside image bounds
        if (x >= imagePos.x && x <= imagePos.x + imagePos.width &&
            y >= imagePos.y && y <= imagePos.y + imagePos.height) {
          
          clickedOnImage = true;
          
          // Check if delete button was clicked (only if image is selected)
          if (selectedImage === i) {
            const deleteBtnX = imagePos.x + 30;
            const deleteBtnY = imagePos.y + 30;
            const deleteBtnRadius = 200; // Match visual button size for full clickable area
            
            if (Math.sqrt((x - deleteBtnX) ** 2 + (y - deleteBtnY) ** 2) <= deleteBtnRadius) {
              // Delete the image
              const newPositions = simpleImagePositions.filter((_, index) => index !== i);
              setSimpleImagePositions(newPositions);
              setSelectedImage(null); // Clear selection after deletion
              if (props.onImageDelete) {
                props.onImageDelete(i);
              }
              return;
            }
            
            // Check if resize handle was clicked (bottom-right corner)
            const resizeBtnX = imagePos.x + imagePos.width - 30;
            const resizeBtnY = imagePos.y + imagePos.height - 30;
            const resizeBtnRadius = 200; // Match visual button size for full clickable area
            
            if (Math.sqrt((x - resizeBtnX) ** 2 + (y - resizeBtnY) ** 2) <= resizeBtnRadius) {
              // Start resizing the image
              setResizingSimpleImage(i);
              setResizeStartData({
                startX: x,
                startY: y,
                startWidth: imagePos.width,
                startHeight: imagePos.height,
                startImageX: imagePos.x,
                startImageY: imagePos.y
              });
              setCanvasCursor('nwse-resize');
              return;
            }
            
            // Check if clicking on image edges for resizing (alternative method)
            const edgeThreshold = 20; // Slightly smaller threshold for cleaner interaction
            const isNearRightEdge = Math.abs(x - (imagePos.x + imagePos.width)) <= edgeThreshold;
            const isNearBottomEdge = Math.abs(y - (imagePos.y + imagePos.height)) <= edgeThreshold;
            
            if (isNearRightEdge && isNearBottomEdge) {
              // Start resizing the image
              setResizingSimpleImage(i);
              setResizeStartData({
                startX: x,
                startY: y,
                startWidth: imagePos.width,
                startHeight: imagePos.height,
                startImageX: imagePos.x,
                startImageY: imagePos.y
              });
              setCanvasCursor('nwse-resize');
              return;
            }
          }
          
          // Select the image if it wasn't already selected
          if (selectedImage !== i) {
            setSelectedImage(i);
            return;
          }
          
          // Start dragging the image (if already selected)
          setDraggedSimpleImage(i);
          setDragOffset({
            x: x - imagePos.x,
            y: y - imagePos.y
          });
          return;
        }
      }
      
      // If we didn't click on any image, deselect the current selection
      if (!clickedOnImage && selectedImage !== null) {
        setSelectedImage(null);
      }
    }

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
  // Add smooth animation state for image operations
  const [isResizing, setIsResizing] = React.useState(false);
  const lastUpdateTime = React.useRef(0);
  const THROTTLE_MS = 16; // ~60fps

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !props.editMode) return;
    
    // Throttle updates for smooth performance
    const now = Date.now();
    if (now - lastUpdateTime.current < THROTTLE_MS) {
      return;
    }
    lastUpdateTime.current = now;
    
    try {
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      // Handle freeflow layout image dragging and resizing
      if (layoutMode === 'freeflow') {
        if (draggedSimpleImage !== null) {
          // Cancel any pending animation frame
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
          
          // Use requestAnimationFrame for smooth updates
          animationFrameRef.current = requestAnimationFrame(() => {
            const newPositions = [...simpleImagePositions];
            const newX = x - dragOffset.x;
            const newY = y - dragOffset.y;
            
            // Constrain to canvas bounds
            const constrainedX = Math.max(0, Math.min(canvasRef.current!.width - newPositions[draggedSimpleImage].width, newX));
            const constrainedY = Math.max(0, Math.min(canvasRef.current!.height - newPositions[draggedSimpleImage].height, newY));
            
            newPositions[draggedSimpleImage] = {
              ...newPositions[draggedSimpleImage],
              x: constrainedX,
              y: constrainedY
            };
            
            setSimpleImagePositions(newPositions);
            setIsDragging(true);
            
            // Call the onImageDrag callback if provided
            if (props.onImageDrag) {
              props.onImageDrag(draggedSimpleImage, constrainedX, constrainedY);
            }
          });
          
          return;
        }
        
        if (resizingSimpleImage !== null && resizeStartData) {
          // Cancel any pending animation frame
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
          
          // Use requestAnimationFrame for smooth updates
          animationFrameRef.current = requestAnimationFrame(() => {
            const newPositions = [...simpleImagePositions];
            const deltaX = x - resizeStartData.startX;
            const deltaY = y - resizeStartData.startY;
            
            // STRICT ASPECT RATIO PRESERVATION - NO STRETCHING ALLOWED
            const originalAspectRatio = resizeStartData.startWidth / resizeStartData.startHeight;
            
            // Calculate new size based on mouse movement (use the larger delta for better UX)
            const deltaMagnitude = Math.max(Math.abs(deltaX), Math.abs(deltaY));
            const scaleFactor = deltaMagnitude > 0 ? 
              (resizeStartData.startWidth + deltaMagnitude) / resizeStartData.startWidth : 1;
            
            // Apply scale factor while maintaining aspect ratio
            let newWidth = Math.max(80, resizeStartData.startWidth * scaleFactor);
            let newHeight = newWidth / originalAspectRatio;
            
            // Ensure minimum height as well
            if (newHeight < 80) {
              newHeight = 80;
              newWidth = newHeight * originalAspectRatio;
            }
            
            // Constrain to canvas bounds while preserving aspect ratio
            const maxWidth = canvasRef.current!.width - resizeStartData.startImageX;
            const maxHeight = canvasRef.current!.height - resizeStartData.startImageY;
            
            // Check if we need to scale down to fit bounds
            if (newWidth > maxWidth) {
              newWidth = maxWidth;
              newHeight = newWidth / originalAspectRatio;
            }
            if (newHeight > maxHeight) {
              newHeight = maxHeight;
              newWidth = newHeight * originalAspectRatio;
            }
            
            // Final dimensions - guaranteed to maintain aspect ratio
            const finalWidth = Math.round(newWidth);
            const finalHeight = Math.round(newHeight);
            
            newPositions[resizingSimpleImage] = {
              ...newPositions[resizingSimpleImage],
              width: finalWidth,
              height: finalHeight
            };
            
            setSimpleImagePositions(newPositions);
            setIsResizing(true);
            
            // Call the onImageResize callback if provided
            if (props.onImageResize) {
              props.onImageResize(resizingSimpleImage, finalWidth, finalHeight);
            }
            
            // Force a re-render to update text wrapping
            debouncedRender();
          });
          
          return;
        }
      }
    
    // Check for button hover if we have an active sticker
    if (activeSticker !== null && stickers[activeSticker]) {
      const sticker = stickers[activeSticker];
      const btnRadius = 140; // Much larger radius for better visibility and touch targets
      const centerX = sticker.x + sticker.width/2;
      const centerY = sticker.y + sticker.height/2;
      
      // Calculate rotation-adjusted button positions
      const angle = sticker.rotation * Math.PI / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      
      // Delete button position (top-left)
      const deleteOffsetX = -sticker.width/2 - 100; // Much larger offset for bigger buttons
      const deleteOffsetY = -sticker.height/2 - 100; // Much larger offset for bigger buttons
      const deleteBtnX = centerX + deleteOffsetX * cos - deleteOffsetY * sin;
      const deleteBtnY = centerY + deleteOffsetX * sin + deleteOffsetY * cos;
      
      // Rotate button position (top-center)
      const rotateOffsetX = 0;
      const rotateOffsetY = -sticker.height/2 - 200; // Much larger offset for bigger buttons
      const rotateBtnX = centerX + rotateOffsetX * cos - rotateOffsetY * sin;
      const rotateBtnY = centerY + rotateOffsetX * sin + rotateOffsetY * cos;
      
      // Resize button position (bottom-right)
      const resizeOffsetX = sticker.width/2 + 100; // Much larger offset for bigger buttons
      const resizeOffsetY = sticker.height/2 + 100; // Much larger offset for bigger buttons
      const resizeBtnX = centerX + resizeOffsetX * cos - resizeOffsetY * sin;
      const resizeBtnY = centerY + resizeOffsetX * sin + resizeOffsetY * cos;
      
      // Check if hovering over any button
      if (Math.sqrt((x - deleteBtnX) ** 2 + (y - deleteBtnY) ** 2) <= btnRadius * 1.8) {
        if (hoveredButton !== 'delete') {
          setHoveredButton('delete');
          setCanvasCursor('pointer');
          debouncedRender();
        }
      } else if (Math.sqrt((x - rotateBtnX) ** 2 + (y - rotateBtnY) ** 2) <= btnRadius * 1.8) {
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
    
    // Check for image hover (freeflow layout) - only for selected images
    if (props.editMode && layoutMode === 'freeflow' && simpleImagePositions.length > 0) {
      let foundHoveredImage = false;
      
      // Check each image for hover
      for (let i = 0; i < simpleImagePositions.length; i++) {
        const position = simpleImagePositions[i];
        
        // Check if mouse is within image bounds
        if (x >= position.x && x <= position.x + position.width &&
            y >= position.y && y <= position.y + position.height) {
          
          // Only show hover effects for selected images
          if (selectedImage === i) {
            // Check if hovering over delete button (top-left)
            const deleteBtnX = position.x + 30;
            const deleteBtnY = position.y + 30;
            const deleteBtnRadius = 200; // Match visual button size for full clickable area
            
            if (Math.sqrt((x - deleteBtnX) ** 2 + (y - deleteBtnY) ** 2) <= deleteBtnRadius) {
              setCanvasCursor('pointer');
            } else {
              // Check if hovering over resize handle (bottom-right)
              const resizeBtnX = position.x + position.width - 30;
              const resizeBtnY = position.y + position.height - 30;
              const resizeBtnRadius = 200; // Match visual button size for full clickable area
              
              if (Math.sqrt((x - resizeBtnX) ** 2 + (y - resizeBtnY) ** 2) <= resizeBtnRadius) {
                setCanvasCursor('nwse-resize');
              } else {
                // Check if near edges for resizing
                const edgeThreshold = 15;
                const isNearRightEdge = Math.abs(x - (position.x + position.width)) <= edgeThreshold;
                const isNearBottomEdge = Math.abs(y - (position.y + position.height)) <= edgeThreshold;
                
                if (isNearRightEdge && isNearBottomEdge) {
                  setCanvasCursor('nwse-resize');
                } else {
                  setCanvasCursor('grab');
                }
              }
            }
          } else {
            // For non-selected images, show pointer cursor to indicate they can be clicked
            setCanvasCursor('pointer');
          }
          
          if (hoveredImage !== i) {
            setHoveredImage(i);
            debouncedRender();
          }
          foundHoveredImage = true;
          break;
        }
      }
      
      // If not hovering over any image, clear hover state
      if (!foundHoveredImage && hoveredImage !== null) {
        setHoveredImage(null);
        setCanvasCursor('default');
        debouncedRender();
      }
    }
    
    // Check for image hover (other layouts)
    if (props.editMode && layoutMode !== 'freeflow' && imagePositionsRef.current.length > 0) {
      let foundHoveredImage = false;
      
      // Check each image for hover
      for (let i = 0; i < imagePositionsRef.current.length; i++) {
        const position = imagePositionsRef.current[i];
        
        // Check if mouse is within image bounds
        if (x >= position.x && x <= position.x + position.width &&
            y >= position.y && y <= position.y + position.height) {
          
          // Check if hovering over delete button
          const deleteBtnX = position.x + position.width - 20;
          const deleteBtnY = position.y + 20;
          const btnRadius = 40; // Larger radius for image delete buttons
          
          if (Math.sqrt((x - deleteBtnX) ** 2 + (y - deleteBtnY) ** 2) <= btnRadius) {
            setCanvasCursor('pointer');
          } else {
            setCanvasCursor('default');
          }
          
          if (hoveredImage !== i) {
            setHoveredImage(i);
            debouncedRender();
          }
          foundHoveredImage = true;
          break;
        }
      }
      
      // If not hovering over any image, clear hover state
      if (!foundHoveredImage && hoveredImage !== null) {
        setHoveredImage(null);
        setCanvasCursor('default');
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
        
        // GOODNOTES-STYLE: Update scale factors for export quality
        const newScaleX = newWidth / (activeStickObj.originalWidth || activeStickObj.width);
        const newScaleY = newHeight / (activeStickObj.originalHeight || activeStickObj.height);
        
        newStickers[activeSticker] = {
          ...activeStickObj,
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
          scaleX: newScaleX, // Update scale factor for export
          scaleY: newScaleY, // Update scale factor for export
        };
      } else if (stickerAction === 'rotate') {
        const angleRad = Math.atan2(y - centerY, x - centerX);
        newStickers[activeSticker] = {
          ...activeStickObj,
          rotation: angleRad * 180 / Math.PI + 90,
        };
      }
      
      setStickers(newStickers);
      debouncedDragRender();
    }
    } catch (error) {
      console.error('Error in handleMouseMove:', error);
      // Reset sticker action on error to prevent crashes
      setStickerAction(null);
      setStickerDragOffset(null);
      setIsDragging(false);
    }
  };

  // Update handleMouseUp to handle dragging
  const handleMouseUp = () => {
    // Stop simple layout image dragging
    if (draggedSimpleImage !== null) {
      setDraggedSimpleImage(null);
      setDragOffset({x: 0, y: 0});
    }
    
    // Stop simple layout image resizing
    if (resizingSimpleImage !== null) {
      setResizingSimpleImage(null);
      setResizeStartData(null);
    }
    
    setStickerAction(null);
    setStickerDragOffset(null);
    setIsDragging(false);
    setIsResizing(false);
    setCanvasCursor('default');
    
    // Cancel any pending animation frames
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };
  
  // Update handleMouseLeave to handle dragging
  const handleMouseLeave = () => {
    setStickerAction(null);
    setStickerDragOffset(null);
    setIsDragging(false);
    setIsResizing(false);
    setCanvasCursor('default');
    
    // Cancel any pending animation frames
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
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
  
  // Update simple image positions when images prop changes
  useEffect(() => {
    if (layoutMode === 'freeflow' && images.length > 0) {
      console.log('🖼️ Images changed, updating positions. Images count:', images.length);
      console.log('🖼️ Saved positions:', props.savedImagePositions);
      
      // Preserve existing positions and only add new ones for new images
      setSimpleImagePositions(prevPositions => {
        console.log('🖼️ Previous positions:', prevPositions);
        
        const newImagePositions: Array<{
          x: number;
          y: number;
          width: number;
          height: number;
          image: string | Blob;
        }> = [];
        
        // Calculate proper dimensions based on each image's natural aspect ratio
        const calculateImageDimensions = (imageUrl: string | Blob, maxDimension: number = 1200): Promise<{ width: number; height: number }> => {
          return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              const aspectRatio = img.naturalWidth / img.naturalHeight;
              
              let width, height;
              if (aspectRatio > 1) {
                // Landscape image
                width = maxDimension;
                height = maxDimension / aspectRatio;
              } else {
                // Portrait or square image
                height = maxDimension;
                width = maxDimension * aspectRatio;
              }
              
              resolve({ width: Math.round(width), height: Math.round(height) });
            };
            img.onerror = () => {
              // Fallback to default dimensions if image fails to load
              resolve({ width: 800, height: 600 });
            };
            img.src = typeof imageUrl === 'string' ? imageUrl : URL.createObjectURL(imageUrl);
          });
        };
        const canvasWidth = 3100; // Canvas width
        const canvasHeight = 4370; // Canvas height
        
        // Process images synchronously for better performance
        images.forEach((image, index) => {
          // Check if we already have a position for this image index
          const existingPosition = prevPositions[index];
          
          if (existingPosition) {
            console.log(`🖼️ Preserving position for image ${index}:`, existingPosition);
            // Preserve existing position and size, but update the image reference
            newImagePositions.push({
              ...existingPosition,
              image
            });
          } else {
            console.log(`🖼️ Creating new position for image ${index}`);
            
            // Use default dimensions for initial positioning (will be updated when image loads)
            const imageWidth = 800;
            const imageHeight = 600;
            
            // This is a new image, calculate default position
            let x = 0, y = 0;
            
            // Check if we have saved positions for this image
            if (props.savedImagePositions && props.savedImagePositions[index]) {
              // Use saved position
              x = props.savedImagePositions[index].x;
              y = props.savedImagePositions[index].y;
              console.log(`🖼️ Using saved position for image ${index}:`, { x, y });
            } else {
              // Center all images on the page with slight offsets to prevent overlap
              const centerX = (canvasWidth - imageWidth) / 2;
              const centerY = (canvasHeight - imageHeight) / 2;
              
              // Add slight random offset to prevent perfect stacking
              const offsetRange = 50; // Maximum offset in pixels
              const randomOffsetX = (Math.random() - 0.5) * offsetRange;
              const randomOffsetY = (Math.random() - 0.5) * offsetRange;
              
              // For the first image, place it in the center of the page
              if (index === 0) {
                x = centerX;
                y = centerY;
              } else {
                // For additional images, place them near center with slight offsets
                // This creates a more natural, scattered look while keeping them centered
                x = centerX + randomOffsetX;
                y = centerY + randomOffsetY;
                
                // Ensure images don't go off the canvas edges
                x = Math.max(50, Math.min(x, canvasWidth - imageWidth - 50));
                y = Math.max(50, Math.min(y, canvasHeight - imageHeight - 50));
              }
              console.log(`🖼️ Using centered position for image ${index}:`, { x, y });
            }
            
            newImagePositions.push({
              x,
              y,
              width: imageWidth,
              height: imageHeight,
              image
            });
          }
        });
        
        console.log('🖼️ Final new positions:', newImagePositions);
        return newImagePositions;
      });
      
      // Force a re-render when images are added to freeflow layout
      renderJournal();
    } else if (layoutMode !== 'freeflow') {
      // Clear positions when not in freeflow mode
      setSimpleImagePositions([]);
    }
  }, [images, layoutMode, renderJournal, props.savedImagePositions]);

  // Update image dimensions when they load (preserving positions)
  useEffect(() => {
    if (layoutMode === 'freeflow' && simpleImagePositions.length > 0) {
      const updateImageDimensions = async () => {
        const updatedPositions = [...simpleImagePositions];
        let hasChanges = false;

        for (let i = 0; i < updatedPositions.length; i++) {
          const position = updatedPositions[i];
          const image = images[i];
          
          if (image && (position.width === 800 || position.height === 600)) {
            // This image still has default dimensions, calculate proper ones
            try {
              // Calculate dimensions inline to avoid scope issues
              const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
                const img = new Image();
                img.onload = () => {
                  const aspectRatio = img.naturalWidth / img.naturalHeight;
                  const maxDimension = 1200;
                  
                  let width, height;
                  if (aspectRatio > 1) {
                    width = maxDimension;
                    height = maxDimension / aspectRatio;
                  } else {
                    height = maxDimension;
                    width = maxDimension * aspectRatio;
                  }
                  
                  resolve({ width: Math.round(width), height: Math.round(height) });
                };
                img.onerror = () => {
                  resolve({ width: 800, height: 600 });
                };
                img.src = typeof image === 'string' ? image : URL.createObjectURL(image);
              });

              if (dimensions.width !== position.width || dimensions.height !== position.height) {
                updatedPositions[i] = {
                  ...position,
                  width: dimensions.width,
                  height: dimensions.height
                };
                hasChanges = true;
                console.log(`🖼️ Updated dimensions for image ${i}: ${dimensions.width}x${dimensions.height}`);
              }
            } catch (error) {
              console.error(`Failed to calculate dimensions for image ${i}:`, error);
            }
          }
        }

        if (hasChanges) {
          setSimpleImagePositions(updatedPositions);
        }
      };

      updateImageDimensions();
    }
  }, [simpleImagePositions, images, layoutMode]);

  // 2. Sticker upload handler - moved to external UI
  const handleStickerFile = (file: File) => {
    console.log("handleStickerFile called with:", file.name, file.size, file.type);
    
    // Create a revocable URL for the file IMMEDIATELY - no compression
    const url = URL.createObjectURL(file);
    
    // Pre-load the image to get original dimensions
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      console.log("Image loaded successfully for sticker:", file.name);
      
      // STEP 1: SAVE ORIGINAL AT FULL QUALITY - Never touch the original image
      const originalWidth = img.naturalWidth || img.width;
      const originalHeight = img.naturalHeight || img.height;
      console.log("Original dimensions preserved:", originalWidth, "x", originalHeight);
      
      // STEP 2: CALCULATE DISPLAY SIZE - This is just for initial preview, not permanent
      const defaultStickerSize = 400;
      let displayWidth = defaultStickerSize;
      let displayHeight = defaultStickerSize;
      
      // Maintain aspect ratio for initial display
      const aspectRatio = originalWidth / originalHeight;
      if (aspectRatio > 1) {
        displayWidth = defaultStickerSize;
        displayHeight = defaultStickerSize / aspectRatio;
      } else {
        displayHeight = defaultStickerSize;
        displayWidth = defaultStickerSize * aspectRatio;
      }
      
      console.log("Initial display dimensions:", displayWidth, "x", displayHeight);
      
      // Position stickers BELOW the location text area for easier grabbing
      const canvasWidth = canvasRef.current?.width || 1240;
      const canvasHeight = canvasRef.current?.height || 1748;
      
      // Location text is typically at top 15% of canvas - position stickers below that
      const locationAreaHeight = canvasHeight * 0.15;
      const stickerAreaTop = locationAreaHeight + 50;
      const stickerAreaHeight = canvasHeight * 0.4;
      
      // STEP 3: CREATE STICKER WITH ORIGINAL IMAGE + TRANSFORM DATA
      const newSticker = {
        src: file, // Store the original File object - NEVER compress this
        x: Math.random() * (canvasWidth * 0.6) + (canvasWidth * 0.2),
        y: Math.random() * stickerAreaHeight + stickerAreaTop,
        width: displayWidth,  // This is just the display transform
        height: displayHeight, // This is just the display transform
        rotation: 0,           // This is just the display transform
        zIndex: 0,
        imageObj: img, // Cache the loaded image object
        originalWidth: originalWidth,   // CRITICAL: Store original for export
        originalHeight: originalHeight, // CRITICAL: Store original for export
        // NEW: Add transform factors for Goodnotes-style editing
        scaleX: displayWidth / originalWidth,   // Scale factor from original to display
        scaleY: displayHeight / originalHeight, // Scale factor from original to display
        originalUrl: url // Keep reference to the original URL
      };
      
      setStickers(prevStickers => {
        const newZIndex = prevStickers.length + 10;
        const stickerWithZIndex = { ...newSticker, zIndex: newZIndex };
        console.log("Adding ORIGINAL QUALITY sticker to state:", stickerWithZIndex);
        return [...prevStickers, stickerWithZIndex];
      });
      
      // DON'T revoke URL yet - we need it for rendering
      // URL will be revoked when sticker is removed
      
      // Force a re-render to show the sticker
      throttledRender();
    };
    
    img.onerror = (error) => {
      console.error("Failed to load sticker image:", file.name, error);
      URL.revokeObjectURL(url);
    };
    
    // STEP 4: USE BEST QUALITY SETTINGS
    img.decoding = 'sync'; // Synchronous for best quality
    img.src = url;
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
    },
    exportUltraHDPDF: exportUltraHDPDF,
    clearStickers: () => {
      console.log("Clearing all stickers");
      // Revoke object URLs to prevent memory leaks
      stickers.forEach(sticker => {
        if (sticker.originalUrl) {
          URL.revokeObjectURL(sticker.originalUrl);
        }
      });
      setStickers([]);
      // Clear from localStorage
      try {
        const stickerKey = `stickers_${date.toISOString().split('T')[0]}_${location}`;
        localStorage.removeItem(stickerKey);
      } catch (error) {
        console.error("Failed to clear stickers from localStorage:", error);
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
    btnRadius = 180, // Increased base radius from 140 to 180 for desktop
    isHovered = false
  ) {
    // Force much larger buttons for testing - VISUALLY HUGE
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    const mobileBtnRadius = isMobile ? 200 : 150; // REASONABLE but much bigger buttons (mobile: 200px, desktop: 150px)
    const actualRadius = isMobile ? mobileBtnRadius : btnRadius;
    console.log(`Drawing button with radius: ${actualRadius}px (mobile: ${isMobile})`); // DEBUG: Verify button size
    console.log(`Button position: x=${x}, y=${y}, canvas size: ${ctx?.canvas.width}x${ctx?.canvas.height}`); // DEBUG: Button position
    if (!ctx) return;
    // Draw drop shadowed button
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, actualRadius, 0, 2 * Math.PI);
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; // Darker shadow for better visibility
    ctx.shadowBlur = isMobile ? 80 : 60; // Much larger shadow on mobile
    ctx.shadowOffsetX = isMobile ? 20 : 16; // Much larger offset on mobile
    ctx.shadowOffsetY = isMobile ? 20 : 16; // Much larger offset on mobile
    
    // Make button brighter if hovered or on mobile for better visibility
    const btnColor = (isHovered || isMobile) ? adjustColor(color, 25) : color;
    ctx.fillStyle = btnColor;
    ctx.fill();
    
    // Add white border - much thicker on mobile
    ctx.lineWidth = isMobile ? 100 : 80; // MASSIVE border on mobile
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.restore();

    // Set icon size relative to button radius (70-80% of button) - much larger on mobile
    const iconSize = actualRadius * (isHovered ? 1.4 : (isMobile ? 1.6 : 1.3)); // Much bigger on mobile
    
    // Draw the icon directly using canvas primitives for perfect control
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#fff';
    ctx.fillStyle = '#fff';
    ctx.lineWidth = isHovered ? (isMobile ? 150 : 120) : (isMobile ? 120 : 100); // MASSIVE lines on mobile
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
    if (!canvasRef.current || !props.editMode || layoutMode !== 'freeflow') return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    // Check for button clicks if we have an active sticker
    if (activeSticker !== null && stickers[activeSticker]) {
      const sticker = stickers[activeSticker];
      const btnRadius = 140; // Much larger radius for better visibility and touch targets
      const centerX = sticker.x + sticker.width/2;
      const centerY = sticker.y + sticker.height/2;
      
      // Calculate rotation-adjusted button positions
      const angle = sticker.rotation * Math.PI / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      
      // Delete button position (top-left)
      const deleteOffsetX = -sticker.width/2 - 100; // Much larger offset for bigger buttons
      const deleteOffsetY = -sticker.height/2 - 100; // Much larger offset for bigger buttons
      const deleteBtnX = centerX + deleteOffsetX * cos - deleteOffsetY * sin;
      const deleteBtnY = centerY + deleteOffsetX * sin + deleteOffsetY * cos;
      
      // Rotate button position (top-center)
      const rotateOffsetX = 0;
      const rotateOffsetY = -sticker.height/2 - 200; // Much larger offset for bigger buttons
      const rotateBtnX = centerX + rotateOffsetX * cos - rotateOffsetY * sin;
      const rotateBtnY = centerY + rotateOffsetX * sin + rotateOffsetY * cos;
      
      // Resize button position (bottom-right)
      const resizeOffsetX = sticker.width/2 + 100; // Much larger offset for bigger buttons
      const resizeOffsetY = sticker.height/2 + 100; // Much larger offset for bigger buttons
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

  // Add/remove image interaction class to body for CSS scroll prevention
  useEffect(() => {
    if (isImageInteraction || activeSticker !== null || draggedSimpleImage !== null || resizingSimpleImage !== null) {
      document.body.classList.add('image-interaction-active');
    } else {
      document.body.classList.remove('image-interaction-active');
    }
    
    // Cleanup on unmount
    return () => {
      document.body.classList.remove('image-interaction-active');
    };
  }, [isImageInteraction, activeSticker, draggedSimpleImage, resizingSimpleImage]);

  // Touch event handlers for mobile devices
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !props.editMode) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;
    
    // Check if touch is on an image or button (only prevent scroll for image interactions)
    let isImageInteraction = false;
    
    // Check if touching an image in freeflow mode
    if (layoutMode === 'freeflow' && simpleImagePositions.length > 0) {
      for (let i = simpleImagePositions.length - 1; i >= 0; i--) {
        const imagePos = simpleImagePositions[i];
        if (x >= imagePos.x && x <= imagePos.x + imagePos.width &&
            y >= imagePos.y && y <= imagePos.y + imagePos.height) {
          isImageInteraction = true;
          break;
        }
      }
    }
    
    // Check if touching a sticker
    if (stickers.length > 0) {
      for (let i = stickers.length - 1; i >= 0; i--) {
        const sticker = stickers[i];
        const centerX = sticker.x + sticker.width/2;
        const centerY = sticker.y + sticker.height/2;
        const dx = x - centerX;
        const dy = y - centerY;
        const angle = -sticker.rotation * Math.PI / 180;
        const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
        const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
        
        if (Math.abs(localX) <= sticker.width/2 && Math.abs(localY) <= sticker.height/2) {
          isImageInteraction = true;
          break;
        }
      }
    }
    
    // Only prevent scrolling if we're interacting with images
    if (isImageInteraction) {
      e.preventDefault();
      e.stopPropagation();
      document.body.style.touchAction = 'none';
      document.body.style.overflow = 'hidden';
      setIsImageInteraction(true);
    }
    
    // Only proceed with freeflow layout for image interactions
    if (layoutMode !== 'freeflow') return;
    
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
      // Mobile-optimized button radius and hit areas - VISUALLY MUCH BIGGER
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
      const btnRadius = isMobile ? 200 : (isIOS() ? 150 : 120); // REASONABLE radius to match visual button size (mobile: 200, iOS: 150, desktop: 120)
      const centerX = sticker.x + sticker.width/2;
      const centerY = sticker.y + sticker.height/2;
      
      // Calculate rotation-adjusted button positions
      const angle = sticker.rotation * Math.PI / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      
      // Mobile-optimized button positioning - VISUALLY MUCH BIGGER
      const buttonOffset = isMobile ? 300 : (isIOS() ? 200 : 150); // Much larger offset for all devices (mobile: 300, iOS: 200, desktop: 150)
      const topButtonOffset = isMobile ? 420 : (isIOS() ? 320 : 280); // Much larger offset for all devices (mobile: 420, iOS: 320, desktop: 280)
      
      // Delete button position (top-left)
      const deleteOffsetX = -sticker.width/2 - buttonOffset;
      const deleteOffsetY = -sticker.height/2 - buttonOffset;
      const deleteBtnX = centerX + deleteOffsetX * cos - deleteOffsetY * sin;
      const deleteBtnY = centerY + deleteOffsetX * sin + deleteOffsetY * cos;
      
      // Rotate button position (top-center)
      const rotateOffsetX = 0;
      const rotateOffsetY = -sticker.height/2 - topButtonOffset;
      const rotateBtnX = centerX + rotateOffsetX * cos - rotateOffsetY * sin;
      const rotateBtnY = centerY + rotateOffsetX * sin + rotateOffsetY * cos;
      
      // Resize button position (bottom-right)
      const resizeOffsetX = sticker.width/2 + buttonOffset;
      const resizeOffsetY = sticker.height/2 + buttonOffset;
      const resizeBtnX = centerX + resizeOffsetX * cos - resizeOffsetY * sin;
      const resizeBtnY = centerY + resizeOffsetX * sin + resizeOffsetY * cos;
      
      // Mobile-optimized hit areas - EVEN BIGGER for easier touch
      const hitMultiplier = isMobile ? 2.2 : (isIOS() ? 1.5 : 1.2); // Even bigger hit area on mobile (increased from 1.8 to 2.2)
      if (Math.sqrt((x - deleteBtnX) ** 2 + (y - deleteBtnY) ** 2) <= btnRadius * hitMultiplier) {
        console.log("Mobile: Delete button tapped!");
        // Haptic feedback for mobile
        if (navigator.vibrate) {
          navigator.vibrate(50); // Short vibration for button press
        }
        // Delete the active sticker
        const newStickers = stickers.filter((_, idx) => idx !== activeSticker);
        updateStickersOptimized(newStickers);
        setActiveSticker(null);
        setButtonClickHandling(true);
        return;
      }
      
      // Handle rotate button touch
      if (Math.sqrt((x - rotateBtnX) ** 2 + (y - rotateBtnY) ** 2) <= btnRadius * hitMultiplier) {
        console.log("Mobile: Rotate button tapped!");
        // Haptic feedback for mobile
        if (navigator.vibrate) {
          navigator.vibrate(30); // Short vibration for button press
        }
        setStickerAction('rotate');
        setStickerDragOffset({x: 0, y: 0});
        setButtonClickHandling(true);
        return;
      }
      
      // Handle resize button touch
      if (Math.sqrt((x - resizeBtnX) ** 2 + (y - resizeBtnY) ** 2) <= btnRadius * hitMultiplier) {
        console.log("Mobile: Resize button tapped!");
        // Haptic feedback for mobile
        if (navigator.vibrate) {
          navigator.vibrate(30); // Short vibration for button press
        }
        setStickerAction('resize');
        setStickerDragOffset({x: 0, y: 0});
        setButtonClickHandling(true);
        return;
      }
    }
    
    // If we're not handling button clicks, check if touch is on a sticker or simple layout image
    if (!buttonClickHandling) {
      // Check for freeflow layout image touch first
      if (layoutMode === 'freeflow' && simpleImagePositions.length > 0) {
        let touchedImage = false;
        
        for (let i = simpleImagePositions.length - 1; i >= 0; i--) {
          const imagePos = simpleImagePositions[i];
          
          // Check if touch is inside image bounds
          if (x >= imagePos.x && x <= imagePos.x + imagePos.width &&
              y >= imagePos.y && y <= imagePos.y + imagePos.height) {
            
            touchedImage = true;
            
            // Check if touching delete button (only if image is selected)
            if (selectedImage === i) {
              const deleteBtnX = imagePos.x + 30;
              const deleteBtnY = imagePos.y + 30;
              const deleteBtnRadius = 200; // Match visual button size for full clickable area
              
              if (Math.sqrt((x - deleteBtnX) ** 2 + (y - deleteBtnY) ** 2) <= deleteBtnRadius) {
                // Delete the image
                const newPositions = simpleImagePositions.filter((_, index) => index !== i);
                setSimpleImagePositions(newPositions);
                setSelectedImage(null); // Clear selection after deletion
                if (props.onImageDelete) {
                  props.onImageDelete(i);
                }
                return;
              }
              
              // Check if touching resize handle
              const resizeBtnX = imagePos.x + imagePos.width - 30;
              const resizeBtnY = imagePos.y + imagePos.height - 30;
              const resizeBtnRadius = 200; // Match visual button size for full clickable area
              
              if (Math.sqrt((x - resizeBtnX) ** 2 + (y - resizeBtnY) ** 2) <= resizeBtnRadius) {
                // Start resizing the image
                setResizingSimpleImage(i);
                setResizeStartData({
                  startX: x,
                  startY: y,
                  startWidth: imagePos.width,
                  startHeight: imagePos.height,
                  startImageX: imagePos.x,
                  startImageY: imagePos.y
                });
                return;
              }
            }
            
            // Select the image if it wasn't already selected
            if (selectedImage !== i) {
              setSelectedImage(i);
              return;
            }
            
            // Start dragging the image (if already selected)
            setDraggedSimpleImage(i);
            setDragOffset({
              x: x - imagePos.x,
              y: y - imagePos.y
            });
            return;
          }
        }
        
        // If we didn't touch any image, deselect the current selection
        if (!touchedImage && selectedImage !== null) {
          setSelectedImage(null);
        }
      }
      
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
        
        // iOS-optimized hit area - much more generous on iOS like GoodNotes
        const hitBuffer = isIOS() ? 1.4 : 1.2; // 40% larger hit area on iOS
        const hitWidthHalf = sticker.width/2 * hitBuffer;
        const hitHeightHalf = sticker.height/2 * hitBuffer;
        
        if (Math.abs(localX) < hitWidthHalf && Math.abs(localY) < hitHeightHalf) {
          console.log(`iOS: Sticker ${i} selected! Size: ${sticker.width}x${sticker.height}`);
          setActiveSticker(i);
          touchedOnSticker = true;
          
          // iOS haptic feedback when sticker is selected
          if (isIOS() && 'vibrate' in navigator) {
            navigator.vibrate(10); // Short vibration on selection
          }
          
          // Bring to front
          const maxZ = getMaxStickerZ();
          if (sticker.zIndex < maxZ) {
            const newStickers = stickers.map((s, idx) => idx === i ? { ...s, zIndex: maxZ + 1 } : s);
            setStickers(newStickers);
          }
          
          // Set up dragging with iOS optimizations
          setStickerAction('move');
          setStickerDragOffset({x: localX, y: localY});
          setIsDragging(true);
          setIsDraggingSticker(true);
          
          // iOS-specific: Temporarily reduce quality for performance
          if (isIOS()) {
            setIsHighQualityMode(false);
          }
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
    
    // Only prevent scrolling if we're in an image interaction
    if (isImageInteraction || activeSticker !== null || draggedSimpleImage !== null || resizingSimpleImage !== null) {
      e.preventDefault();
      e.stopPropagation();
      document.body.style.touchAction = 'none';
      document.body.style.overflow = 'hidden';
    }
    
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
    
    // Handle freeflow layout image dragging and resizing
    if (layoutMode === 'freeflow') {
      if (draggedSimpleImage !== null) {
        const newPositions = [...simpleImagePositions];
        const newX = x - dragOffset.x;
        const newY = y - dragOffset.y;
        
        // Constrain to canvas bounds
        const constrainedX = Math.max(0, Math.min(canvasRef.current.width - newPositions[draggedSimpleImage].width, newX));
        const constrainedY = Math.max(0, Math.min(canvasRef.current.height - newPositions[draggedSimpleImage].height, newY));
        
        newPositions[draggedSimpleImage] = {
          ...newPositions[draggedSimpleImage],
          x: constrainedX,
          y: constrainedY
        };
        
        setSimpleImagePositions(newPositions);
        
        // Call the onImageDrag callback if provided
        if (props.onImageDrag) {
          props.onImageDrag(draggedSimpleImage, constrainedX, constrainedY);
        }
        
        return;
      }
      
      if (resizingSimpleImage !== null && resizeStartData) {
        const newPositions = [...simpleImagePositions];
        const deltaX = x - resizeStartData.startX;
        const deltaY = y - resizeStartData.startY;
        
        // STRICT ASPECT RATIO PRESERVATION - NO STRETCHING ALLOWED (Touch)
        const originalAspectRatio = resizeStartData.startWidth / resizeStartData.startHeight;
        
        // Calculate new size based on touch movement (use the larger delta for better UX)
        const deltaMagnitude = Math.max(Math.abs(deltaX), Math.abs(deltaY));
        const scaleFactor = deltaMagnitude > 0 ? 
          (resizeStartData.startWidth + deltaMagnitude) / resizeStartData.startWidth : 1;
        
        // Apply scale factor while maintaining aspect ratio
        let newWidth = Math.max(80, resizeStartData.startWidth * scaleFactor);
        let newHeight = newWidth / originalAspectRatio;
        
        // Ensure minimum height as well
        if (newHeight < 80) {
          newHeight = 80;
          newWidth = newHeight * originalAspectRatio;
        }
        
        // Constrain to canvas bounds while preserving aspect ratio
        const maxWidth = canvasRef.current.width - resizeStartData.startImageX;
        const maxHeight = canvasRef.current.height - resizeStartData.startImageY;
        
        // Check if we need to scale down to fit bounds
        if (newWidth > maxWidth) {
          newWidth = maxWidth;
          newHeight = newWidth / originalAspectRatio;
        }
        if (newHeight > maxHeight) {
          newHeight = maxHeight;
          newWidth = newHeight * originalAspectRatio;
        }
        
        // Final dimensions - guaranteed to maintain aspect ratio
        const finalWidth = Math.round(newWidth);
        const finalHeight = Math.round(newHeight);
        
        newPositions[resizingSimpleImage] = {
          ...newPositions[resizingSimpleImage],
          width: finalWidth,
          height: finalHeight
        };
        
        setSimpleImagePositions(newPositions);
        
        // Call the onImageResize callback if provided
        if (props.onImageResize) {
          props.onImageResize(resizingSimpleImage, finalWidth, finalHeight);
        }
        
        // Force a re-render to update text wrapping
        debouncedRender();
        return;
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
        
        // GOODNOTES-STYLE: Update scale factors for export quality
        const newScaleX = newWidth / (activeStickObj.originalWidth || activeStickObj.width);
        const newScaleY = newHeight / (activeStickObj.originalHeight || activeStickObj.height);
        
        newStickers[activeSticker] = {
          ...activeStickObj,
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
          scaleX: newScaleX, // Update scale factor for export
          scaleY: newScaleY, // Update scale factor for export
        };
      } else if (stickerAction === 'rotate') {
        const angleRad = Math.atan2(y - centerY, x - centerX);
        newStickers[activeSticker] = {
          ...activeStickObj,
          rotation: angleRad * 180 / Math.PI + 90,
        };
      }
      
      setStickers(newStickers);
      debouncedDragRender();
    }
  };

  const handleTouchEnd = () => {
    setButtonClickHandling(false);
    setStickerAction(null);
    setStickerDragOffset(null);
    setIsDragging(false);
    setIsDraggingSticker(false);
    
    // Reset simple layout image states
    setDraggedSimpleImage(null);
    setResizingSimpleImage(null);
    setResizeStartData(null);
    
    // Restore scrolling for all devices after touch interactions
    document.body.style.touchAction = '';
    document.body.style.overflow = '';
    setIsImageInteraction(false);
    
    // iOS-specific: Restore high quality mode after drag ends
    if (isIOS()) {
      setTimeout(() => {
        setIsHighQualityMode(true);
        renderJournal(); // Re-render with high quality
      }, 50); // Small delay to ensure smooth drag end
    }
  };

  // Clean up any timers and animation frames
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (dragAnimationFrameRef.current) {
        cancelAnimationFrame(dragAnimationFrameRef.current);
      }
      if (stickerUpdateBatchRef.current.timeoutId) {
        clearTimeout(stickerUpdateBatchRef.current.timeoutId);
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
          
          // Set default sticker size optimized for iOS touch interaction - GoodNotes style
          const defaultStickerSize = isIOS() ? 1200 : 1000; // Bigger on iOS for easier touch
          let width = defaultStickerSize;
          let height = defaultStickerSize;
          
          // Maintain aspect ratio while fitting in default size
          const aspectRatio = originalWidth / originalHeight;
          if (aspectRatio > 1) {
            // Wide image: fit by width
            width = defaultStickerSize;
            height = defaultStickerSize / aspectRatio;
          } else {
            // Tall image: fit by height
            height = defaultStickerSize;
            width = defaultStickerSize * aspectRatio;
          }
          
          // Create a grid-like distribution with some randomness
          // Use modulo to create rows and columns
          const cols = Math.ceil(Math.sqrt(files.length));
          const col = index % cols;
          const row = Math.floor(index / cols);
          
          // iOS-optimized positioning - avoid edges and make them easier to grab
          const locationAreaHeight = canvasHeight * 0.15; // Top 15% for location
          const stickerAreaTop = locationAreaHeight + (isIOS() ? 100 : 50); // More space on iOS
          const stickerAreaHeight = canvasHeight * (isIOS() ? 0.5 : 0.4); // More area on iOS for easier access
          
          // Calculate base position in a grid BELOW the location
          const baseX = (canvasWidth * 0.6) * (col / cols) + canvasWidth * 0.2;
          const baseY = (stickerAreaHeight) * (row / cols) + stickerAreaTop;
          
          // Add randomness to prevent perfect alignment
          const jitterX = Math.random() * 80 - 40; // Reduced jitter
          const jitterY = Math.random() * 80 - 40;
          
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
            originalHeight: originalHeight, // Store original dimensions
            scaleX: width / originalWidth, // Store scale factor for export
            scaleY: height / originalHeight, // Store scale factor for export
            originalUrl: URL.createObjectURL(file) // Keep reference to original URL
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

  // High-performance sticker state management with batching
  const stickerUpdateBatchRef = useRef<{
    pendingUpdates: Partial<StickerImage>[];
    timeoutId: NodeJS.Timeout | null;
  }>({ pendingUpdates: [], timeoutId: null });

  // Optimized sticker update function with batching
  const updateStickerOptimized = useCallback((index: number, updates: Partial<StickerImage>) => {
    if (index < 0 || index >= stickers.length) return;

    // Direct state update for immediate visual feedback
    setStickers(prev => {
      const newStickers = [...prev];
      newStickers[index] = { ...newStickers[index], ...updates };
      return newStickers;
    });

    // Use high-performance rendering
    throttledRender();
  }, [stickers.length, throttledRender]);

  // Optimized batch update for multiple stickers
  const updateStickersOptimized = useCallback((newStickers: StickerImage[]) => {
    setStickers(newStickers);
    throttledRender();
  }, [throttledRender]);

  // Optimized touch event handling with reduced state updates
  const handleStickerTouchMove = useCallback((
    activeIndex: number, 
    action: 'move' | 'resize' | 'rotate',
    touchData: any
  ) => {
    if (activeIndex < 0 || activeIndex >= stickers.length) return;

    const activeSticker = stickers[activeIndex];
    let updates: Partial<StickerImage> = {};

    switch (action) {
      case 'move':
        updates = {
          x: touchData.x - touchData.offsetX,
          y: touchData.y - touchData.offsetY
        };
        break;
      case 'resize':
        if (touchData.newWidth && touchData.newHeight) {
          updates = {
            width: touchData.newWidth,
            height: touchData.newHeight,
            x: touchData.newX,
            y: touchData.newY
          };
        }
        break;
      case 'rotate':
        updates = { rotation: touchData.rotation };
        break;
    }

    if (Object.keys(updates).length > 0) {
      updateStickerOptimized(activeIndex, updates);
    }
  }, [stickers, updateStickerOptimized]);

  // Helper function to draw a line of text with custom kerning for 'T'
  function drawTextWithCustomTKerning(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, kerning: number = -8) {
    let currentX = x;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      ctx.strokeText(char, currentX, y);
      ctx.fillText(char, currentX, y);
      const charWidth = ctx.measureText(char).width;
      if (char === 'T' && i < text.length - 1) {
        currentX += charWidth - kerning;
      } else {
        currentX += charWidth;
      }
    }
  }

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
              cursor: canvasCursor,
              touchAction: 'none', // Prevent default touch behaviors for better performance
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none',
              // GOODNOTES-QUALITY: Maximum image rendering quality
              imageRendering: 'auto', // Force high quality scaling
              // Remove any transforms that could degrade quality
              transform: 'none', // No transform to preserve quality
              // Disable filters that could affect quality
              filter: 'none',
              willChange: 'auto' // Don't hint for transforms
            }}
            whileHover={{ boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
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