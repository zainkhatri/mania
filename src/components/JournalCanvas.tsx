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
  const [showLocationShadow, setShowLocationShadow] = useState(false);
  
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





  // Draw the canvas with all elements - optimized with throttling for performance
  useEffect(() => {
    if (!canvasRef.current) return;
    if (isLoading) return; // Don't draw while loading
    
    // Throttle renders to prevent excessive re-rendering
    const now = Date.now();
    if (now - lastUpdateTimeRef.current < 16) { // 60fps throttle
      return;
    }
    lastUpdateTimeRef.current = now;
    
    const renderCanvas = () => {
    // Check for global flag to force redraw
    if (window.FORCE_CANVAS_REDRAW) {
      window.FORCE_CANVAS_REDRAW = false;
    }
    
    const canvas = canvasRef.current;
      if (!canvas) return;
      
    // Get device pixel ratio for mobile optimization
    const dpr = window.devicePixelRatio || 1;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    
      // Use optimized high-resolution settings - reduced from 3100x4370 to 1860x2620
    let canvasWidth, canvasHeight;
      canvasWidth = 1860;  // Reduced from 3100
      canvasHeight = 2620; // Reduced from 4370
      
      // Set canvas size
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw template
      if (templateImage) {
        // Save current context state
        ctx.save();
        
        // Ensure high quality rendering for template
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw template to fill the entire canvas exactly
        try {
          ctx.drawImage(templateImage, 0, 0, canvas.width, canvas.height);
        } catch (err) {
          // If drawing fails, try to draw at original size
          try {
            ctx.drawImage(templateImage, 0, 0, templateImage.width, templateImage.height);
          } catch (err) {
            // If all else fails, draw a background color
            ctx.fillStyle = template.backgroundColor || '#f5f5f5';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        }
        
        ctx.restore();
      } else {
        // Fallback background
        ctx.fillStyle = template.backgroundColor || '#f5f5f5';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      // Draw content based on layout mode
      if (layoutMode === 'freeflow') {
        renderSimpleTextFlow(ctx);
              } else {
        // For now, just use the freeflow layout as fallback
          renderSimpleTextFlow(ctx);
      }
    };
    
    renderCanvas();
  }, [textSections, images, templateImage, textColors, layoutMode, stickers, isLoading, forceRender]);
  
  // Show location shadow when location is available
  useEffect(() => {
    if (location && location.trim()) {
      setShowLocationShadow(true);
    }
  }, [location]);

  // Add cleanup for animation frames and timers
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (dragAnimationFrameRef.current) {
        cancelAnimationFrame(dragAnimationFrameRef.current);
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Add this before the main useEffect
  const renderCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    if (isLoading) return;
    
    // Check for global flag to force redraw
    if (window.FORCE_CANVAS_REDRAW) {
      window.FORCE_CANVAS_REDRAW = false;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Get device pixel ratio for mobile optimization
    const dpr = window.devicePixelRatio || 1;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    
    // Use optimized high-resolution settings - reduced from 3100x4370 to 1860x2620
    let canvasWidth, canvasHeight;
    canvasWidth = 1860;  // Reduced from 3100 for better performance
    canvasHeight = 2620; // Reduced from 4370 for better performance
          
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
        // Save current context state
                  ctx.save();
        
        // Ensure high quality rendering for template
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw template to fill the entire canvas exactly
        try {
          ctx.drawImage(templateImage, 0, 0, canvas.width, canvas.height);
              } catch (err) {
          console.error('Error drawing template:', err);
          // If drawing fails, try to draw at original size
          try {
            ctx.drawImage(templateImage, 0, 0, templateImage.width, templateImage.height);
      } catch (err) {
            console.error('Failed to draw template even at original size:', err);
          }
        }
        
        // Restore context state
          ctx.restore();
      }
      

      
      // ... rest of your existing render logic for other layouts ...
      
    } catch (error) {
      console.error('Error rendering canvas:', error);
    }
  }, [date, location, textSections, images, textColors, layoutMode, templateImage, isLoading, props.savedImagePositions]);

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
  ): { lines: string[], y: number, availableWidth: number, startX: number } => {
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
    
    return { availableWidth, startX, lines: [], y: currentY };
  };

  const renderSimpleTextFlow = (ctx: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Draw date and location first
    const dateText = formatDate(date);
    
    // Find optimal font size for date (scaled for new canvas) - make it as big as possible
    const maxDateFontSize = calculateOptimalFontSize(
      ctx, 
      dateText, 
      canvas.width - 48, // Reduced margin for more space
      "'TitleFont', sans-serif",
      96,  // Much higher min size
      360  // Much higher max size
    );
    
    // Set font and color for date with graffiti layering effect
    ctx.font = `${maxDateFontSize}px 'TitleFont', sans-serif`;
    ctx.textAlign = 'left';
    
    // Draw date (clean, no shadow)
    ctx.fillStyle = '#000000'; // Main color
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillText(dateText, 24, 150); // Clean date text
    
    // Draw location if provided
    if (location && location.trim()) {
      // Find optimal font size for location with dynamic sizing - make it as big as possible
      const maxLocationFontSize = calculateOptimalFontSize(
        ctx,
        location.toUpperCase(),
        canvas.width - 48, // Reduced margin for more space
        "'TitleFont', sans-serif",
        72,  // Much higher min size
        300  // Much higher max size
      );
      
      // Set font and colors for location with enhanced graffiti layering
      ctx.font = `${maxLocationFontSize}px 'TitleFont', sans-serif`;
      ctx.textAlign = 'left';
      
      // Draw location shadow first (behind the text)
      if (showLocationShadow) {
        // Create a darker version of the location color
        const darkerColor = adjustColor(textColors.locationColor, -50); // Make 50% darker for more visibility
        ctx.fillStyle = darkerColor;
        ctx.shadowColor = 'rgba(0,0,0,0)';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillText(location.toUpperCase(), 42, 163 + maxDateFontSize + 30); // 18px offset, 5px higher
      }
      
      // Draw location text on top (always visible)
      ctx.fillStyle = textColors.locationColor; // This should be the main color
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
      ctx.fillText(location.toUpperCase(), 24, 150 + maxDateFontSize + 30); // Moved up by 10px
    }
    
    // Scale line coordinates for new canvas dimensions (1860x2620)
    // Original coordinates were for 3100x4370, so scale by 2620/4370 = 0.6
    const scaleFactor = 2620 / 4370; // 0.6
    const journalLineYCoords = [
      420, 534, 642, 750, 858, 966, 1080, 1188, 1296, 1404, 
      1512, 1620, 1728, 1836, 1944, 2064, 2172, 2280, 2394, 2496, 2598
    ];
    
    // Get images for simple layout (max 3)
    const simpleImages = images.slice(0, 3);
    
    // Text area setup - use full width with margins (scaled for new canvas)
    const leftMargin = 48; // Scaled from 80 to 48
    const rightMargin = 48; // Scaled from 80 to 48
    const textWidth = canvas.width - leftMargin - rightMargin; // 1764px available width
    
    // Get combined text
    const journalText = getCombinedText();
    // For freeflow layout, render even if there's no text (to show images)
    if (!journalText && simpleImagePositions.length === 0) return;
    
    // Calculate starting Y position for text (below date and location)
    const textStartY = 150 + (location && location.trim() ? maxDateFontSize + 80 : 40);
    
    // Font size bounds (scaled for new canvas)
    const minFontSize = 17; // Scaled from 28
    const maxFontSize = 84; // Scaled from 140
    
    // Calculate line spacing (distance between lines) - scaled for new canvas
    const lineSpacing = journalLineYCoords.length > 1 ? 
      journalLineYCoords[1] - journalLineYCoords[0] : 114; // Scaled from 190 to 114
    
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
            
            // Calculate new size based on mouse movement with improved algorithm
            // Use diagonal distance for more natural scaling
            const deltaMagnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            // SUPER SIMPLE LOGIC: Top-left = shrink, bottom-right = grow
            const dragDirectionX = e.clientX - resizeStartData.startX;
            const dragDirectionY = e.clientY - resizeStartData.startY;
            
            // If dragging towards top-left: shrink, if dragging towards bottom-right: grow
            const isShrinking = dragDirectionX < 0 || dragDirectionY < 0;
            const isGrowing = dragDirectionX > 0 || dragDirectionY > 0;
            
            // Simple scale factor based on drag distance
            const scaleFactor = isShrinking ? 
              Math.max(0.01, 1 - (deltaMagnitude / 100)) : // Shrink: 1% to 100% of original
              Math.min(2.0, 1 + (deltaMagnitude / 100));   // Grow: 100% to 200% of original
            
            // Apply scale factor while maintaining aspect ratio
            let newWidth = Math.max(3, resizeStartData.startWidth * scaleFactor); // Reduced minimum from 10 to 3
            let newHeight = newWidth / originalAspectRatio;
            
            // Ensure minimum height as well
            if (newHeight < 3) { // Reduced minimum from 10 to 3
              newHeight = 3;
              newWidth = newHeight * originalAspectRatio;
            }
            
            // Constrain to canvas bounds while preserving aspect ratio
            if (!canvasRef.current) return;
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
      const deleteOffsetX = -sticker.width/2 - 15; // Half the offset for smaller buttons
      const deleteOffsetY = -sticker.height/2 - 15; // Half the offset for smaller buttons
      const deleteBtnX = centerX + deleteOffsetX * cos - deleteOffsetY * sin;
      const deleteBtnY = centerY + deleteOffsetX * sin + deleteOffsetY * cos;
      
      // Rotate button position (top-center)
      const rotateOffsetX = 0;
      const rotateOffsetY = -sticker.height/2 - 30; // Half the offset for smaller buttons
      const rotateBtnX = centerX + rotateOffsetX * cos - rotateOffsetY * sin;
      const rotateBtnY = centerY + rotateOffsetX * sin + rotateOffsetY * cos;
      
      // Resize button position (bottom-right)
      const resizeOffsetX = sticker.width/2 + 15; // Half the offset for smaller buttons
      const resizeOffsetY = sticker.height/2 + 15; // Half the offset for smaller buttons
      const resizeBtnX = centerX + resizeOffsetX * cos - resizeOffsetY * sin;
      const resizeBtnY = centerY + resizeOffsetX * sin + resizeOffsetY * cos;
      
      // Check if hovering over any button
      if (Math.sqrt((x - deleteBtnX) ** 2 + (y - deleteBtnY) ** 2) <= btnRadius * 1.2) {
        if (hoveredButton !== 'delete') {
          setHoveredButton('delete');
          setCanvasCursor('pointer');
          debouncedRender();
        }
      } else if (Math.sqrt((x - rotateBtnX) ** 2 + (y - rotateBtnY) ** 2) <= btnRadius * 1.2) {
        if (hoveredButton !== 'rotate') {
          setHoveredButton('rotate');
          setCanvasCursor('pointer');
          debouncedRender();
        }
      } else if (Math.sqrt((x - resizeBtnX) ** 2 + (y - resizeBtnY) ** 2) <= btnRadius * 1.2) {
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
        
        // Enforce minimum size (HELLA small for tiny stickers)
        const minSize = 5;
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
            const imageWidth = 400; // Reduced from 800
            const imageHeight = 300; // Reduced from 600
            
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
            // Use the new canvas dimensions (1860x2620)
            const canvasWidth = 1860;
            const canvasHeight = 2620;
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
          
          if (image && (position.width === 400 || position.height === 300)) {
            // This image still has default dimensions, calculate proper ones
            try {
              // Calculate dimensions inline to avoid scope issues
              const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
                const img = new Image();
                img.onload = () => {
                  const aspectRatio = img.naturalWidth / img.naturalHeight;
                  const maxDimension = 600; // Reduced from 1200
                  
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
      const defaultStickerSize = 100; // Reduced from 200 to match new tiny dimensions
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
      // Use the new canvas dimensions (1860x2620)
      const canvasWidth = 1860;
      const canvasHeight = 2620;
      
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
    btnRadius = 30, // Half the size for even cleaner look
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
      const deleteOffsetX = -sticker.width/2 - 15; // Half the offset for smaller buttons
      const deleteOffsetY = -sticker.height/2 - 15; // Half the offset for smaller buttons
      const deleteBtnX = centerX + deleteOffsetX * cos - deleteOffsetY * sin;
      const deleteBtnY = centerY + deleteOffsetX * sin + deleteOffsetY * cos;
      
      // Rotate button position (top-center)
      const rotateOffsetX = 0;
      const rotateOffsetY = -sticker.height/2 - 30; // Half the offset for smaller buttons
      const rotateBtnX = centerX + rotateOffsetX * cos - rotateOffsetY * sin;
      const rotateBtnY = centerY + rotateOffsetX * sin + rotateOffsetY * cos;
      
      // Resize button position (bottom-right)
      const resizeOffsetX = sticker.width/2 + 15; // Half the offset for smaller buttons
      const resizeOffsetY = sticker.height/2 + 15; // Half the offset for smaller buttons
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
    
    // Only prevent default for actual image interactions, not general page scrolling
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;
    
    let isImageInteraction = false;
    
    // Check if touching an image or sticker - only prevent scroll for actual interactions
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
    
    // Check stickers
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
    
    // Only prevent scrolling and set interaction state for actual image interactions
    if (isImageInteraction) {
      e.preventDefault();
      e.stopPropagation();
      setIsImageInteraction(true);
    }
    
    // Continue with existing touch logic...
    // ... rest of existing handleTouchStart logic
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
      const minSize = 50;
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
        // Cancel any pending animation frame for smoother updates
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        
        // Use requestAnimationFrame for smooth 60fps updates
        animationFrameRef.current = requestAnimationFrame(() => {
          const newPositions = [...simpleImagePositions];
          const deltaX = x - resizeStartData.startX;
          const deltaY = y - resizeStartData.startY;
          
          // Enhanced touch sensitivity for mobile - more responsive
          const touchSensitivity = 1.5; // Increase sensitivity for better mobile experience
          const adjustedDeltaX = deltaX * touchSensitivity;
          const adjustedDeltaY = deltaY * touchSensitivity;
          
          // STRICT ASPECT RATIO PRESERVATION - NO STRETCHING ALLOWED (Touch)
          const originalAspectRatio = resizeStartData.startWidth / resizeStartData.startHeight;
          
          // Calculate new size based on touch movement with improved algorithm
          // Use diagonal distance for more natural scaling
          const deltaMagnitude = Math.sqrt(adjustedDeltaX * adjustedDeltaX + adjustedDeltaY * adjustedDeltaY);
          
          // SUPER SIMPLE LOGIC: Top-left = shrink, bottom-right = grow
          const dragDirectionX = x - resizeStartData.startX;
          const dragDirectionY = y - resizeStartData.startY;
          
          // If dragging towards top-left: shrink, if dragging towards bottom-right: grow
          const isShrinking = dragDirectionX < 0 || dragDirectionY < 0;
          const isGrowing = dragDirectionX > 0 || dragDirectionY > 0;
          
          // Simple scale factor based on drag distance
          const scaleFactor = isShrinking ? 
            Math.max(0.01, 1 - (deltaMagnitude / 100)) : // Shrink: 1% to 100% of original
            Math.min(2.0, 1 + (deltaMagnitude / 100));   // Grow: 100% to 200% of original
          
          // Apply scale factor while maintaining aspect ratio
          let newWidth = Math.max(2, resizeStartData.startWidth * scaleFactor); // Reduced minimum from 8 to 2
          let newHeight = newWidth / originalAspectRatio;
          
          // Ensure minimum height as well
          if (newHeight < 2) { // Reduced minimum from 8 to 2
            newHeight = 2;
            newWidth = newHeight * originalAspectRatio;
          }
          
          // Constrain to canvas bounds while preserving aspect ratio
          if (!canvasRef.current) return;
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
        });
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
        
        // Enforce minimum size (HELLA small for tiny stickers)
        const minSize = 5;
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

  // Add cleanup for animation frames and timers
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (dragAnimationFrameRef.current) {
        cancelAnimationFrame(dragAnimationFrameRef.current);
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

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