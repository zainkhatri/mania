import React, { useRef, useEffect, useState, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { motion } from 'framer-motion';
import { TextColors } from './ColorPicker';
import { jsPDF } from 'jspdf';

// Performance configurations
const getOptimizedSettings = () => {
  return {
    dragCanvasScale: 0.9,
    dragRenderThrottle: 16,
    staticRenderThrottle: 16,
    maxStickerResolution: 2048,
    enableHardwareAcceleration: true,
    useOffscreenCanvas: true,
    imageSmoothingEnabled: true,
    highQualityExport: true
  };
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
    rotation?: number;
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
    padding: '0px',
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
  
  // Debug statements removed
  
  const [stickers, setStickers] = useState<StickerImage[]>([]);
  const [showLocationShadow, setShowLocationShadow] = useState(false);

  // Track image animations: Map of image index to animation start time
  const [imageAnimations, setImageAnimations] = useState<Map<number, number>>(new Map());

  // Guard refs to prevent double-initialization from React StrictMode
  const didInitFonts = useRef(false);
  const didInitTemplate = useRef(false);

  // Track previous image count to detect new images
  const prevImageCountRef = useRef(images.length);

  // Detect when new images are added and trigger animations
  useEffect(() => {
    const currentCount = images.length;
    const prevCount = prevImageCountRef.current;

    if (currentCount > prevCount) {
      // New images were added - animate them
      const newAnimations = new Map(imageAnimations);
      for (let i = prevCount; i < currentCount; i++) {
        newAnimations.set(i, Date.now());
      }
      setImageAnimations(newAnimations);

      // Request animation frame to continuously update during animation
      const animate = () => {
        const now = Date.now();
        let hasActiveAnimations = false;

        newAnimations.forEach((startTime, index) => {
          const elapsed = now - startTime;
          if (elapsed < 600) { // 600ms animation duration
            hasActiveAnimations = true;
          }
        });

        if (hasActiveAnimations) {
          animationFrameRef.current = requestAnimationFrame(animate);
        }
      };

      animate();
    } else if (currentCount < prevCount) {
      // Images were removed - remove their animations
      const newAnimations = new Map(imageAnimations);
      for (let i = currentCount; i < prevCount; i++) {
        newAnimations.delete(i);
      }
      setImageAnimations(newAnimations);
    }

    prevImageCountRef.current = currentCount;

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [images.length]);

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

  // Load stickers from localStorage on component mount (runs once per date/location change)
  useEffect(() => {
    if (didInitTemplate.current) return; // Prevent double-load
    didInitTemplate.current = true;
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

    // Cleanup function - revoke any object URLs to prevent memory leaks
    return () => {
      stickers.forEach(sticker => {
        if (sticker.originalUrl) {
          URL.revokeObjectURL(sticker.originalUrl);
        }
      });
      didInitTemplate.current = false; // Reset on unmount
    };
  }, [date, location]); // Only reload when date or location changes
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
    rotation: number;
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
  
  // Pinch-to-resize state for mobile
  const [initialPinchDistance, setInitialPinchDistance] = useState<number>(0);
  const [initialImageSize, setInitialImageSize] = useState<{width: number, height: number} | null>(null);
  
  // Performance optimization refs
  const settings = getOptimizedSettings();
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const isRenderingRef = useRef<boolean>(false);
  const dragAnimationFrameRef = useRef<number | null>(null);
  const lastDragUpdateRef = useRef<number>(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isDraggingSticker, setIsDraggingSticker] = useState(false);
  const [isHighQualityMode, setIsHighQualityMode] = useState(true);
  const [isImageInteraction, setIsImageInteraction] = useState(false);
  const previousCanvasDataRef = useRef<ImageData | null>(null);
  
  // Function to trigger a re-render when needed (now handled by React's dependency tracking)
  const renderJournal = useCallback(() => {
    // Re-renders are now handled automatically by useEffect dependencies
  }, []);

  // iOS-optimized throttled render function
  const throttledRender = useCallback(() => {
    const now = Date.now();
    const throttleTime = isDraggingSticker ? settings.dragRenderThrottle : settings.staticRenderThrottle;
    
    if (now - lastUpdateTimeRef.current > throttleTime) {
      lastUpdateTimeRef.current = now;
      renderJournal();
    }
  }, [renderJournal, isDraggingSticker, settings]);

  // iOS-optimized debounced render function for drag operations
  const debouncedDragRender = useCallback(() => {
    if (dragAnimationFrameRef.current) {
      cancelAnimationFrame(dragAnimationFrameRef.current);
    }
    
    dragAnimationFrameRef.current = requestAnimationFrame(() => {
      const now = Date.now();
      if (now - lastDragUpdateRef.current > settings.dragRenderThrottle) {
        lastDragUpdateRef.current = now;
        
        renderJournal();
      }
    });
  }, [renderJournal, isDraggingSticker, settings]);
  
  // Font loading using FontFace API - runs once on mount
  useEffect(() => {
    if (didInitFonts.current) return; // Stop StrictMode double-run
    didInitFonts.current = true;

    let cancelled = false; // Track if component unmounted

    // Add timestamp to prevent caching of the font files
    const timestamp = new Date().getTime();
    const contentFontUrl = `${process.env.PUBLIC_URL}/font/zain.ttf?v=${timestamp}`;
    const titleFontUrl = `${process.env.PUBLIC_URL}/font/titles.ttf?v=${timestamp}`;

    // Load the fonts
    const loadFonts = async () => {
      try {
        // Load content font
        const contentFont = new FontFace('ZainCustomFont', `url(${contentFontUrl})`, {
          style: 'normal',
          weight: '900',
          display: 'swap'
        });

        // Load title font
        const headingFont = new FontFace('TitleFont', `url(${titleFontUrl})`, {
          style: 'normal',
          weight: '700',
          display: 'swap'
        });

        // Load both fonts in parallel
        await Promise.all([
          contentFont.load().then(font => document.fonts.add(font)),
          headingFont.load().then(font => document.fonts.add(font)).catch(() => {
            // Title font is optional
          })
        ]);

        if (cancelled) return;

        // Mark fonts as loaded - flip isLoading ONCE
        setFontLoaded(true);
        setIsLoading(false);
      } catch (err) {
        if (cancelled) return;
        setFontLoaded(false);
        setIsLoading(false);
      }
    };

    loadFonts();

    return () => {
      cancelled = true;
      didInitFonts.current = false;
    };
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
    // Debug statement removed
    // If there's just a single string in the array, return it directly
    // Otherwise join the text sections with spaces to preserve word boundaries
    const combined = textSections.length === 1 ? textSections[0] : textSections.join(' ').trim();
    // Debug statement removed
    return combined;
  }, [textSections]);

  // Memoize draw dependencies to prevent unnecessary re-draws
  const drawParams = useMemo(() => ({
    hasTemplate: !!templateImage,
    textCount: textSections.length,
    imageCount: images.length,
    stickerCount: stickers.length
  }), [templateImage, textSections.length, images.length, stickers.length]);

  // Preload template and images
  useEffect(() => {
    if (isLoading || !fontLoaded) return; // Wait for fonts first

    setIsLoading(true);
    let cancelled = false;

    const loadTemplateAndImages = async () => {
      try {
        // Load template first
        const template = new Image();
        template.crossOrigin = 'anonymous';

        const templatePromise = new Promise<HTMLImageElement | null>((resolve) => {
          template.onload = () => resolve(template);
          template.onerror = () => {
            // Try without cache buster
            template.src = templateUrl;
            template.onload = () => resolve(template);
            template.onerror = () => resolve(null);
          };
          const cacheBuster = `?v=${new Date().getTime()}`;
          template.src = templateUrl.includes('?') ? templateUrl : templateUrl + cacheBuster;
        });

        const loadedTemplate = await templatePromise;
        if (cancelled) return;

        setTemplateImage(prev => prev === loadedTemplate ? prev : loadedTemplate); // No-op if same

        // Load regular images
        const loadedImages: HTMLImageElement[] = [];
        const imagePromises = images.map((src, index) => {
          return new Promise<HTMLImageElement | null>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);

            if (typeof src === 'string') {
              img.src = src;
            } else {
              img.src = URL.createObjectURL(src);
            }
            img.decoding = 'auto';
          });
        });

        if (imagePromises.length > 0) {
          const results = await Promise.all(imagePromises);
          if (cancelled) return;
          const validImages = results.filter((img): img is HTMLImageElement => img !== null);
          loadedImages.push(...validImages);
        }

        if (cancelled) return;
        setImageObjects(loadedImages);
      } catch (err) {
        console.error('Error loading template or images:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadTemplateAndImages();

    return () => {
      cancelled = true;
    };
  }, [images, templateUrl, fontLoaded]);

  // Helper to draw images preserving aspect ratio, border, rotation, flipping, quality, and animation
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
    enhancedQuality = false,
    imageIndex?: number
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
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

      // Calculate animation progress if this image is animating
      let animationProgress = 1; // Default to fully visible
      let animationScale = 1;
      let animationOpacity = 1;

      if (imageIndex !== undefined && imageAnimations.has(imageIndex)) {
        const startTime = imageAnimations.get(imageIndex)!;
        const elapsed = Date.now() - startTime;
        const duration = 600; // 600ms animation

        if (elapsed < duration) {
          animationProgress = elapsed / duration;
          // Ease out cubic for smooth deceleration
          const eased = 1 - Math.pow(1 - animationProgress, 3);
          animationScale = 0.5 + (eased * 0.5); // Scale from 0.5 to 1
          animationOpacity = eased; // Fade from 0 to 1
        }
      }

      // Apply transformations (translate, rotate, scale, and animation)
      ctx.translate(drawX + drawWidth / 2, drawY + drawHeight / 2);
      if (rotation) ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale((flipH ? -1 : 1) * animationScale, (flipV ? -1 : 1) * animationScale);

      // Apply animation opacity
      ctx.globalAlpha = animationOpacity;
      
      if (addBorder) {
        // Draw a subtle dark outline instead of white border
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.strokeRect(-drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      }
      
      // OPTIMIZED: Skip expensive double-buffering during interactions
      // Only use temp canvas for static/export quality when not dragging
      const shouldUseHighQuality = enhancedQuality && !isDraggingSticker && !draggedSimpleImage && !resizingSimpleImage;

      if (shouldUseHighQuality) {
        // High quality mode: Create temporary canvas for better rendering
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d', {
          alpha: true,
          colorSpace: 'srgb',
          desynchronized: false
        });

        if (tempCtx) {
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
          // Fallback to direct drawing
          ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        }
      } else {
        // Fast mode during interactions: Direct drawing for smooth performance
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





  // Removed duplicate rendering useEffect - will be added after renderCanvas callback definition

  // Show location shadow when location is available
  useEffect(() => {
    if (location && location.trim()) {
      setShowLocationShadow(true);
    }
  }, [location]);

  // Handle text content changes - INSTANT updates for real-time experience
  useEffect(() => {
    // INSTANT updates - no debouncing for real-time experience
    if (textSections.some(text => text.trim()) || images.length > 0) {
      // Debug statement removed
    }
  }, [textSections, images]);

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

  // Add debounce mechanism to prevent excessive re-renders
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastRenderTimeRef = useRef<number>(0);
  const RENDER_DEBOUNCE_MS = 16; // ~60fps

  // Add this before the main useEffect
  const renderCanvas = useCallback(() => {
    const now = Date.now();
    // Debug statement removed
    
    if (!canvasRef.current) return;
    if (isLoading) return;

    // Debounce rapid calls
    if (now - lastRenderTimeRef.current < RENDER_DEBOUNCE_MS) {
      // Debug statement removed
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
      renderTimeoutRef.current = setTimeout(() => {
        renderCanvas();
      }, RENDER_DEBOUNCE_MS - (now - lastRenderTimeRef.current));
      return;
    }

    lastRenderTimeRef.current = now;
    
    // Check for global flag to force redraw
    if (window.FORCE_CANVAS_REDRAW) {
      window.FORCE_CANVAS_REDRAW = false;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Get device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    
    // Use optimized high-resolution settings - reduced from 3100x4370 to 1860x2620
    let canvasWidth, canvasHeight;
    canvasWidth = 1860;  // Reduced from 3100 for better performance
    canvasHeight = 2620; // Reduced from 4370 for better performance
          
          // Create an optimized rendering context with identical settings for all devices
    const ctx = canvas.getContext('2d', {
      alpha: true,
      willReadFrequently: true, // Enable for better performance with frequent readback operations
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
      
      // Draw content based on layout mode
      if (layoutMode === 'freeflow') {
        renderSimpleTextFlow(ctx);
      } else {
        // For now, just use the freeflow layout as fallback
        renderSimpleTextFlow(ctx);
      }
      
    } catch (error) {
      console.error('Error rendering canvas:', error);
    }
  }, [date, location, textSections, images, textColors, layoutMode, templateImage, isLoading, props.savedImagePositions, simpleImagePositions, selectedImage, hoveredImage, draggedSimpleImage, resizingSimpleImage]);

  // Single rendering useEffect to prevent flash when adding/deleting images
  useEffect(() => {
    console.log('🔥 CANVAS RENDER TRIGGERED', {
      hasCanvas: !!canvasRef.current,
      isLoading,
      hasTemplate: !!templateImage,
      textSections: textSections.length,
      images: images.length,
      isDragging: !!draggedSimpleImage,
      timestamp: Date.now()
    });

    if (!canvasRef.current) {
      console.log('🔥 SKIPPED: No canvas ref');
      return;
    }
    if (isLoading) {
      console.log('🔥 SKIPPED: Still loading');
      return;
    }

    // Allow rendering during drag for smooth visual feedback
    // RAF throttling in mousemove handles performance

    console.log('🔥 WILL RENDER on next frame');
    // Use requestAnimationFrame for smooth, synchronized rendering
    const frameId = requestAnimationFrame(() => {
      console.log('🔥 RENDERING CANVAS NOW');
      const startTime = performance.now();
      renderCanvas();
      const endTime = performance.now();
      console.log(`🔥 CANVAS RENDER COMPLETE in ${(endTime - startTime).toFixed(2)}ms`);
    });

    return () => {
      // Debug statement removed
      cancelAnimationFrame(frameId);
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
        renderTimeoutRef.current = null;
      }
    };
  }, [templateImage, textColors, layoutMode, stickers, isLoading, textSections, images, simpleImagePositions, selectedImage, hoveredImage, draggedSimpleImage, resizingSimpleImage, renderCanvas]);

  // Mobile-optimized PDF export function
  const exportUltraHDPDF = () => {
    if (!canvasRef.current) {
      console.error('Canvas reference not available for PDF export');
      return;
    }
    
    // Detect mobile device and adjust settings accordingly
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    // Debug statements removed
    // Debug statement removed
    
    // Force high quality mode for export
    const wasHighQuality = isHighQualityMode;
    const wasDragging = isDraggingSticker;
    
    // Clear any image selection before export to hide handles
    const wasSelectedImage = selectedImage;
    setSelectedImage(null);
    
    setIsHighQualityMode(true);
    setIsDraggingSticker(false);
    
    // Force a render to ensure all images are properly drawn on the canvas
    renderJournal();
    
    // Wait a bit for the render to complete, then perform export
    setTimeout(() => {
      performExport();
    }, 100);
    
    function performExport() {
      // Create a saving indicator
      const savingToast = document.createElement('div');
      savingToast.className = 'fixed top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-50 z-50';
      savingToast.innerHTML = `
        <div class="bg-white p-4 rounded-md shadow-lg flex flex-col items-center">
          <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-3"></div>
          <p class="text-gray-800">Creating your mania journal...</p>
        </div>
      `;
      document.body.appendChild(savingToast);
      
      // Get the canvas for export
      const journalCanvas = canvasRef.current;
      if (!journalCanvas) {
        console.error('Canvas not available during export');
        document.body.removeChild(savingToast);
        return;
      }
      
      // Debug statement removed
      
      // Validate canvas dimensions before proceeding
      if (journalCanvas.width === 0 || journalCanvas.height === 0) {
        console.error('🖼️ PDF EXPORT ERROR: Canvas has invalid dimensions');
        document.body.removeChild(savingToast);
        alert('Export failed: Canvas not ready. Please try again.');
        return;
      }
      
      performExportWithCanvas(journalCanvas, savingToast);
    }
    
    function performExportWithCanvas(journalCanvas: HTMLCanvasElement, savingToast: HTMLElement) {

      try {
        // Create a mobile-optimized PNG snapshot
        const exportQuality = isMobile ? 0.9 : 1.0; // Lower quality on mobile for smaller files

        console.log('📱 Export settings:', { exportQuality, isMobile });
        // Debug statement removed

        // Directly use the canvas's toDataURL - no need for html2canvas
        let pngData: string;
        try {
          pngData = journalCanvas.toDataURL('image/png', exportQuality);
          // Debug statement removed

          // Validate PNG data
          if (pngData.length < 1000) { // PNG should be at least 1KB
            throw new Error(`PNG data too small: ${pngData.length} bytes`);
          }
        } catch (pngError) {
          console.error('🖼️ PDF EXPORT ERROR: Failed to create PNG data:', pngError);
          document.body.removeChild(savingToast);
          alert('Could not create export. Please try again.');
          return;
        }

        // Create a new image element from the high-quality PNG
        const img = new Image();
        img.onload = () => {
          // Debug statement removed

          try {
            // Mobile-optimized PDF creation
            let pdf;

            if (isMobile) {
              // On mobile, use smaller dimensions to prevent memory issues
              const mobileWidth = Math.min(journalCanvas.width, 1200);
              const mobileHeight = Math.min(journalCanvas.height, 1600);

              console.log('📱 Mobile PDF dimensions:', { mobileWidth, mobileHeight, originalWidth: journalCanvas.width, originalHeight: journalCanvas.height });

              pdf = new jsPDF(
                'portrait',
                'px',
                [mobileWidth, mobileHeight],
                true // Enable compression on mobile for smaller files
              );
            } else {
              // Desktop: maximum quality
              pdf = new jsPDF(
                'portrait',
                'px',
                [journalCanvas.width, journalCanvas.height],
                false // No compression
              );
            }

            // Add the image to the PDF with mobile-optimized settings
            pdf.addImage({
              imageData: pngData,
              x: 0,
              y: 0,
              width: pdf.internal.pageSize.getWidth(),
              height: pdf.internal.pageSize.getHeight(),
              compression: isMobile ? 'FAST' : 'NONE', // Fast compression on mobile
              rotation: 0,
              alias: `journal-${Date.now()}` // Unique alias to prevent caching issues
            });

            // Debug statement removed

            // Save the PDF with mania-MM-DD-YYYY.pdf format
            const now = new Date();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const year = now.getFullYear();
            const filename = `mania-${month}-${day}-${year}.pdf`;

            console.log('📱 Saving PDF:', filename, 'isMobile:', isMobile);

            // Mobile-specific download handling
            if (isMobile && isIOS) {
              // Safari iOS: Use special handling for better compatibility
              try {
                console.log('📱 Safari iOS detected, using special download method');

                // Method 1: Try blob with download attribute
                const pdfBlob = pdf.output('blob');
                const url = URL.createObjectURL(pdfBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                console.log('📱 Safari iOS blob download initiated');

                // Safari download handled silently

              } catch (iosError) {
                console.warn('📱 Safari iOS blob download failed, trying alternative method:', iosError);

                // Method 2: Try opening in new tab for Safari
                try {
                  const pdfDataUri = pdf.output('datauristring');
                  const newWindow = window.open();
                  if (newWindow) {
                    newWindow.document.write(`
                      <html>
                        <head><title>Download PDF</title></head>
                        <body style="margin:0;padding:20px;background:#000;color:#fff;font-family:sans-serif;">
                          <h2>PDF Ready for Download</h2>
                          <p>Tap and hold the image below, then select "Save Image" or "Save to Files"</p>
                          <img src="${pdfDataUri}" style="max-width:100%;border:1px solid #333;" />
                          <p><small>If this doesn't work, try the PNG export instead.</small></p>
                        </body>
                      </html>
                    `);
                    console.log('📱 Safari iOS new window method initiated');
                  }
                } catch (windowError) {
                  console.error('📱 Safari iOS all methods failed:', windowError);
                  // Fall back to PNG
                  throw new Error('Safari PDF download failed');
                }
              }
            } else if (isMobile) {
              // Other mobile devices: Standard save
              pdf.save(filename);
            } else {
              // Desktop: Standard save
              pdf.save(filename);
            }

            // Remove saving indicator
            document.body.removeChild(savingToast);

            // Show simple success notification
            const successToast = document.createElement('div');
            successToast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg z-50';
            successToast.textContent = 'Export Complete';
            document.body.appendChild(successToast);

            // Remove success notification after 2 seconds
            setTimeout(() => {
              if (document.body.contains(successToast)) {
                document.body.removeChild(successToast);
              }
            }, 2000);

            // Debug statement removed
          } catch (pdfError) {
            console.error('🖼️ PDF EXPORT ERROR: Error creating PDF:', pdfError);

            // On mobile, offer PNG fallback if PDF fails
            if (isMobile) {
              console.log('📱 PDF creation failed on mobile, offering PNG fallback');
              try {
                if (isIOS) {
                  // Safari iOS: Use special PNG handling
                  console.log('📱 Safari iOS PNG fallback initiated');

                  // Method 1: Try blob download
                  try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    const img = new Image();

                    img.onload = () => {
                      canvas.width = img.width;
                      canvas.height = img.height;
                      ctx?.drawImage(img, 0, 0);

                      canvas.toBlob((blob) => {
                        if (blob) {
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `journal-${date.toISOString().split('T')[0]}-mobile.png`;
                          link.style.display = 'none';
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);

                          // Safari PNG handled silently
                        }
                      }, 'image/png');
                    };

                    img.src = pngData;
                  } catch (blobError) {
                    console.warn('📱 Safari iOS blob PNG failed, trying data URI method:', blobError);

                    // Method 2: Open PNG in new tab for Safari
                    const newWindow = window.open();
                    if (newWindow) {
                      newWindow.document.write(`
                        <html>
                          <head><title>Download PNG</title></head>
                          <body style="margin:0;padding:20px;background:#000;color:#fff;font-family:sans-serif;">
                            <h2>PNG Ready for Download</h2>
                            <p>Tap and hold the image below, then select "Save Image" or "Save to Files"</p>
                            <img src="${pngData}" style="max-width:100%;border:1px solid #333;" />
                          </body>
                        </html>
                      `);
                    }
                  }
                } else {
                  // Other mobile: Standard PNG download
                  const link = document.createElement('a');
                  link.href = pngData;
                  link.download = `journal-${date.toISOString().split('T')[0]}-mobile.png`;
                  link.click();
                }

                // Show simple fallback message
                const fallbackToast = document.createElement('div');
                fallbackToast.className = 'fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-md shadow-lg z-50';
                fallbackToast.textContent = 'PNG Export Complete';
                document.body.appendChild(fallbackToast);

                setTimeout(() => {
                  if (document.body.contains(fallbackToast)) {
                    document.body.removeChild(fallbackToast);
                  }
                }, 3000);

                console.log('📱 PNG fallback export completed');
              } catch (fallbackError) {
                console.error('📱 PNG fallback also failed:', fallbackError);
                alert('Export failed. Please try again or use a different device.');
              }
            } else {
              alert('Could not create PDF. Please try again.');
            }

            document.body.removeChild(savingToast);
          }
        };

        img.onerror = (err) => {
          console.error('🖼️ PDF EXPORT ERROR: Error loading high-resolution image for PDF:', err);
          document.body.removeChild(savingToast);
          alert('Could not create crystal clear export. Please try again.');
        };

        // Start loading the high-resolution image
        img.src = pngData;
      } catch (error: unknown) {
        console.error('🖼️ PDF EXPORT ERROR: Error in export process:', error);
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
    // Debug statement removed
    // For freeflow layout, render even if there's no text (to show images)
    if (!journalText && simpleImagePositions.length === 0) {
      // Debug statement removed
      return;
    }
    
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
          
          // Draw the image with rotation support
          ctx.save();
          
          // Calculate animation progress if this image is animating
          let animationScale = 1;
          let animationOpacity = 1;

          if (imageAnimations.has(index)) {
            const startTime = imageAnimations.get(index)!;
            const elapsed = Date.now() - startTime;
            const duration = 600; // 600ms animation

            if (elapsed < duration) {
              const animationProgress = elapsed / duration;
              // Ease out cubic for smooth deceleration
              const eased = 1 - Math.pow(1 - animationProgress, 3);
              animationScale = 0.5 + (eased * 0.5); // Scale from 0.5 to 1
              animationOpacity = eased; // Fade from 0 to 1
            }
          }

          // Save context for animation transformations
          ctx.save();

          // Apply animation opacity
          ctx.globalAlpha *= animationOpacity;

          // Calculate center point for animation scaling
          const centerX = imagePos.x + imagePos.width / 2;
          const centerY = imagePos.y + imagePos.height / 2;

          // Apply animation scale from center
          ctx.translate(centerX, centerY);
          ctx.scale(animationScale, animationScale);
          ctx.translate(-centerX, -centerY);

          // Apply rotation if specified
          if (imagePos.rotation && imagePos.rotation !== 0) {
            // Move to center of image for rotation
            ctx.translate(centerX, centerY);
            ctx.rotate((imagePos.rotation * Math.PI) / 180);
            ctx.translate(-centerX, -centerY);
          }

          ctx.drawImage(img, imagePos.x, imagePos.y, imagePos.width, imagePos.height);

          // Restore context after animation
          ctx.restore();
          
          // Draw border and controls if in edit mode and image is selected OR being dragged
          if (props.editMode && (selectedImage === index || draggedSimpleImage === index)) {
            // Draw subtle border
            ctx.strokeStyle = draggedSimpleImage === index ? '#007AFF' : 'rgba(0, 122, 255, 0.6)';
            ctx.lineWidth = 2;
            ctx.strokeRect(imagePos.x, imagePos.y, imagePos.width, imagePos.height);
            
            // Draw delete button (top-left) - GoodNotes style, bigger for mobile
            const deleteBtnX = imagePos.x + 30;
            const deleteBtnY = imagePos.y + 30;
            const deleteBtnRadius = 40; // Bigger for mobile touch
            
            // Draw delete button with shadow
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            
            // Delete button background
            ctx.fillStyle = '#FF3B30';
            ctx.beginPath();
            ctx.arc(deleteBtnX, deleteBtnY, deleteBtnRadius, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.restore();
            
            // Draw elegant X icon
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3; // Much thinner for smaller button
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(deleteBtnX - 16, deleteBtnY - 16);
            ctx.lineTo(deleteBtnX + 16, deleteBtnY + 16);
            ctx.moveTo(deleteBtnX + 16, deleteBtnY - 16);
            ctx.lineTo(deleteBtnX - 16, deleteBtnY + 16);
            ctx.stroke();
            
            // Draw resize handle (bottom-right) - GoodNotes style, bigger for mobile
            const resizeBtnX = imagePos.x + imagePos.width - 30;
            const resizeBtnY = imagePos.y + imagePos.height - 30;
            const resizeBtnRadius = 40; // Bigger for mobile touch
            const isResizing = resizingSimpleImage === index;
            
            // Draw resize button with shadow
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            
            // Resize button background
            ctx.fillStyle = isResizing ? '#0056CC' : '#007AFF';
            ctx.beginPath();
            ctx.arc(resizeBtnX, resizeBtnY, resizeBtnRadius, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.restore();
            
            // Draw GoodNotes-style scaling icon (corner handles) - smaller size
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3; // Much thinner for smaller button
            ctx.lineCap = 'round';
            
            // Draw corner handles like GoodNotes - smaller size
            ctx.beginPath();
            
            // Top-left corner handle
            ctx.moveTo(resizeBtnX - 12, resizeBtnY - 12);
            ctx.lineTo(resizeBtnX - 12, resizeBtnY - 20);
            ctx.moveTo(resizeBtnX - 12, resizeBtnY - 20);
            ctx.lineTo(resizeBtnX - 20, resizeBtnY - 20);
            
            // Bottom-right corner handle
            ctx.moveTo(resizeBtnX + 12, resizeBtnY + 12);
            ctx.lineTo(resizeBtnX + 12, resizeBtnY + 20);
            ctx.moveTo(resizeBtnX + 12, resizeBtnY + 20);
            ctx.lineTo(resizeBtnX + 20, resizeBtnY + 20);
            
            // Top-right corner handle
            ctx.moveTo(resizeBtnX + 12, resizeBtnY - 12);
            ctx.lineTo(resizeBtnX + 12, resizeBtnY - 20);
            ctx.moveTo(resizeBtnX + 12, resizeBtnY - 20);
            ctx.lineTo(resizeBtnX + 20, resizeBtnY - 20);
            
            // Bottom-left corner handle
            ctx.moveTo(resizeBtnX - 12, resizeBtnY + 12);
            ctx.lineTo(resizeBtnX - 12, resizeBtnY + 20);
            ctx.moveTo(resizeBtnX - 12, resizeBtnY + 20);
            ctx.lineTo(resizeBtnX - 20, resizeBtnY + 20);
            
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

    // First check for image interactions
    if (props.editMode && layoutMode === 'freeflow' && simpleImagePositions.length > 0) {
      // Check if clicked on an image or its controls
      for (let i = simpleImagePositions.length - 1; i >= 0; i--) {
        const position = simpleImagePositions[i];
        
        // Check if click is within image bounds
        if (mouseX >= position.x && mouseX <= position.x + position.width &&
            mouseY >= position.y && mouseY <= position.y + position.height) {
          
          // If image is already selected, check for button clicks
          if (selectedImage === i) {
            // Check if delete button was clicked (top-left)
            const deleteBtnX = position.x + 30;
            const deleteBtnY = position.y + 30;
            const deleteBtnRadius = 40; // Match the visual button size
            
            if (Math.sqrt((mouseX - deleteBtnX) ** 2 + (mouseY - deleteBtnY) ** 2) <= deleteBtnRadius) {
              console.log("Deleting image:", i);
              if (props.onImageDelete) {
                props.onImageDelete(i);
              }
              setSelectedImage(null);
              return;
            }
            
            // Check if resize handle was clicked (bottom-right)
            const resizeBtnX = position.x + position.width - 30;
            const resizeBtnY = position.y + position.height - 30;
            const resizeBtnRadius = 40; // Match the visual button size
            
            if (Math.sqrt((mouseX - resizeBtnX) ** 2 + (mouseY - resizeBtnY) ** 2) <= resizeBtnRadius) {
              console.log("Starting resize for image:", i);
              setResizingSimpleImage(i);
              setResizeStartData({
                startX: mouseX,
                startY: mouseY,
                startWidth: position.width,
                startHeight: position.height,
                startImageX: position.x,
                startImageY: position.y
              });
              return;
            }
          } else {
            // Select this image
            console.log("Selecting image:", i);
            setSelectedImage(i);
            setHoveredImage(i);
            return;
          }
        }
      }
      
      // If clicked outside all images, deselect current image
      if (selectedImage !== null) {
        console.log("Deselecting image, saving position");
        setSelectedImage(null);
        setHoveredImage(null);
        // The position is already saved in the state, no need to call save here
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
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    console.log("Mouse down at:", mouseX, mouseY);

    // BULLETPROOF IMAGE INTERACTION SYSTEM
    if (layoutMode === 'freeflow' && simpleImagePositions.length > 0) {
      let clickedImage = false;
      
      // Process images from top to bottom (highest z-index first)
      for (let i = simpleImagePositions.length - 1; i >= 0; i--) {
        const imagePos = simpleImagePositions[i];
        const deleteBtnRadius = 40;
        const resizeBtnRadius = 40;
        
        // Check if click is on delete button (top-left)
        const deleteBtnX = imagePos.x + 30;
        const deleteBtnY = imagePos.y + 30;
        const distanceToDelete = Math.sqrt((mouseX - deleteBtnX) ** 2 + (mouseY - deleteBtnY) ** 2);
        
        if (distanceToDelete <= deleteBtnRadius) {
          console.log("🗑️ Delete button clicked, deleting image:", i);
          // Clear selection immediately before deleting
          setSelectedImage(null);
          setDraggedSimpleImage(null);
          setResizingSimpleImage(null);
          if (props.onImageDelete) {
            props.onImageDelete(i);
          }
          return;
        }
        
        // Check if click is on resize button (bottom-right)
        const resizeBtnX = imagePos.x + imagePos.width - 30;
        const resizeBtnY = imagePos.y + imagePos.height - 30;
        const distanceToResize = Math.sqrt((mouseX - resizeBtnX) ** 2 + (mouseY - resizeBtnY) ** 2);
        
        if (distanceToResize <= resizeBtnRadius) {
          console.log("🔧 Resize button clicked, starting resize for image:", i);
          // Ensure image is selected before resizing
          if (selectedImage !== i) {
            setSelectedImage(i);
          }
          setResizingSimpleImage(i);
          setResizeStartData({
            startX: mouseX,
            startY: mouseY,
            startWidth: imagePos.width,
            startHeight: imagePos.height,
            startImageX: imagePos.x,
            startImageY: imagePos.y
          });
          return;
        }
        
        // Check if click is on the image body
        if (mouseX >= imagePos.x && mouseX <= imagePos.x + imagePos.width &&
            mouseY >= imagePos.y && mouseY <= imagePos.y + imagePos.height) {
          
          clickedImage = true;
          // Debug statement removed
          
          // ALWAYS select the image when clicked - no exceptions
          if (selectedImage !== i) {
            console.log("✅ Selecting image:", i);
            setSelectedImage(i);
          }
          
          // Set up for immediate dragging - no delays, no timers
          setDragOffset({
            x: mouseX - imagePos.x,
            y: mouseY - imagePos.y
          });
          
          // Enable dragging immediately for responsive feel
          setDraggedSimpleImage(i);
          console.log("🚀 Dragging enabled immediately for image:", i);
          
          break;
        }
      }
      
      // Only deselect if we didn't click on ANY image
      if (!clickedImage && selectedImage !== null) {
        console.log("🔄 Clicking outside images, deselecting current selection");
        setSelectedImage(null);
      }
    }

    // Check if we clicked on a sticker
    if (activeSticker !== null) {
      const sticker = stickers[activeSticker];
      const centerX = sticker.x + sticker.width/2;
      const centerY = sticker.y + sticker.height/2;
      const dx = mouseX - centerX;
      const dy = mouseY - centerY;
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
  const lastRenderTime = React.useRef(0);
  const THROTTLE_MS = 16; // ~60fps for position tracking
  const RENDER_THROTTLE_MS = 16; // Smooth 60fps dragging
  const dragPositionRef = React.useRef<{x: number, y: number} | null>(null);
  const pendingDragUpdate = React.useRef<boolean>(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !props.editMode) return;
    
    try {
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      // Handle freeflow layout image dragging and resizing
      if (layoutMode === 'freeflow') {
        // Only check for image hover when NOT dragging (avoid unnecessary re-renders)
        if (draggedSimpleImage === null && resizingSimpleImage === null) {
          let foundHoveredImage = false;
          for (let i = simpleImagePositions.length - 1; i >= 0; i--) {
            const imagePos = simpleImagePositions[i];
            if (x >= imagePos.x && x <= imagePos.x + imagePos.width &&
                y >= imagePos.y && y <= imagePos.y + imagePos.height) {
              if (hoveredImage !== i) {
                setHoveredImage(i);
              }
              foundHoveredImage = true;
              break;
            }
          }
          if (!foundHoveredImage && hoveredImage !== null) {
            setHoveredImage(null);
          }
        }
        
        // Handle dragging of images (only when dragging is explicitly enabled)
        if (draggedSimpleImage !== null) {
          const newX = x - dragOffset.x;
          const newY = y - dragOffset.y;

          // Constrain to canvas bounds
          const constrainedX = Math.max(0, Math.min(canvasRef.current.width - simpleImagePositions[draggedSimpleImage].width, newX));
          const constrainedY = Math.max(0, Math.min(canvasRef.current.height - simpleImagePositions[draggedSimpleImage].height, newY));

          // Store position in ref for immediate visual feedback
          dragPositionRef.current = { x: constrainedX, y: constrainedY };

          // Schedule RAF update for smooth 60fps rendering
          if (!pendingDragUpdate.current) {
            pendingDragUpdate.current = true;

            requestAnimationFrame(() => {
              pendingDragUpdate.current = false;

              if (draggedSimpleImage === null || !dragPositionRef.current) return;

              // Update state to trigger canvas redraw
              const newPositions = simpleImagePositions.map((pos, idx) =>
                idx === draggedSimpleImage && dragPositionRef.current
                  ? { ...pos, x: dragPositionRef.current.x, y: dragPositionRef.current.y }
                  : pos
              );

              setSimpleImagePositions(newPositions);

              // Call the onImageDrag callback if provided
              if (props.onImageDrag && dragPositionRef.current) {
                props.onImageDrag(draggedSimpleImage, dragPositionRef.current.x, dragPositionRef.current.y);
              }
            });
          }

          return;
        }
        
        if (resizingSimpleImage !== null && resizeStartData) {
          const deltaX = x - resizeStartData.startX;
          const deltaY = y - resizeStartData.startY;

          const canvasWidth = canvasRef.current.width;
          const canvasHeight = canvasRef.current.height;
          const newWidth = Math.max(100, Math.min(canvasWidth * 0.8, resizeStartData.startWidth + deltaX));
          const newHeight = Math.max(100, Math.min(canvasHeight * 0.8, resizeStartData.startHeight + deltaY));

          // Preserve aspect ratio
          const aspectRatio = resizeStartData.startWidth / resizeStartData.startHeight;
          let finalWidth = newWidth;
          let finalHeight = newHeight;

          if (newWidth / newHeight > aspectRatio) {
            finalHeight = newWidth / aspectRatio;
            if (finalHeight > canvasHeight * 0.8) {
              finalHeight = canvasHeight * 0.8;
              finalWidth = finalHeight * aspectRatio;
            }
          } else {
            finalWidth = newHeight * aspectRatio;
            if (finalWidth > canvasWidth * 0.8) {
              finalWidth = canvasWidth * 0.8;
              finalHeight = finalWidth / aspectRatio;
            }
          }

          const finalWidthRounded = Math.round(finalWidth);
          const finalHeightRounded = Math.round(finalHeight);

          // Schedule single RAF update if not already pending
          if (!pendingDragUpdate.current) {
            pendingDragUpdate.current = true;

            requestAnimationFrame(() => {
              pendingDragUpdate.current = false;

              if (resizingSimpleImage === null) return;

              // Batch update
              const newPositions = simpleImagePositions.map((pos, idx) =>
                idx === resizingSimpleImage
                  ? { ...pos, width: finalWidthRounded, height: finalHeightRounded }
                  : pos
              );

              setSimpleImagePositions(newPositions);

              // Call the onImageResize callback if provided
              if (props.onImageResize) {
                props.onImageResize(resizingSimpleImage, finalWidthRounded, finalHeightRounded);
              }
            });
          }

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
            const deleteBtnX = position.x + 20;
            const deleteBtnY = position.y + 20;
            const deleteBtnRadius = 25; // Match visual button size for full clickable area
            
            if (Math.sqrt((x - deleteBtnX) ** 2 + (y - deleteBtnY) ** 2) <= deleteBtnRadius) {
              setCanvasCursor('pointer');
            } else {
              // Check if hovering over resize handle (bottom-right)
              const resizeBtnX = position.x + position.width - 20;
              const resizeBtnY = position.y + position.height - 20;
              const resizeBtnRadius = 25; // Match visual button size for full clickable area
              
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
    // Commit final position from ref when stopping drag
    if (draggedSimpleImage !== null && dragPositionRef.current) {
      const finalPositions = [...simpleImagePositions];
      finalPositions[draggedSimpleImage] = {
        ...finalPositions[draggedSimpleImage],
        x: dragPositionRef.current.x,
        y: dragPositionRef.current.y
      };
      setSimpleImagePositions(finalPositions);

      // Call the onImageDrag callback with final position
      if (props.onImageDrag) {
        props.onImageDrag(draggedSimpleImage, dragPositionRef.current.x, dragPositionRef.current.y);
      }

      dragPositionRef.current = null;
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

  // Handle touch start events for mobile image dragging
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !props.editMode) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;

    console.log("Touch start at:", x, y);

    // BULLETPROOF TOUCH INTERACTION SYSTEM
    if (layoutMode === 'freeflow' && simpleImagePositions.length > 0) {
      let touchedImage = false;
      
      // Process images from top to bottom (highest z-index first)
      for (let i = simpleImagePositions.length - 1; i >= 0; i--) {
        const imagePos = simpleImagePositions[i];
        const deleteBtnRadius = 40;
        const resizeBtnRadius = 40;
        
        // Check if touch is on delete button (top-left)
        const deleteBtnX = imagePos.x + 30;
        const deleteBtnY = imagePos.y + 30;
        const distanceToDelete = Math.sqrt((x - deleteBtnX) ** 2 + (y - deleteBtnY) ** 2);
        
        if (distanceToDelete <= deleteBtnRadius) {
          console.log("🗑️ Delete button touched, deleting image:", i);
          // Clear selection immediately before deleting
          setSelectedImage(null);
          setDraggedSimpleImage(null);
          setResizingSimpleImage(null);
          if (props.onImageDelete) {
            props.onImageDelete(i);
          }
          return;
        }
        
        // Check if touch is on resize button (bottom-right)
        const resizeBtnX = imagePos.x + imagePos.width - 30;
        const resizeBtnY = imagePos.y + imagePos.height - 30;
        const distanceToResize = Math.sqrt((x - resizeBtnX) ** 2 + (y - resizeBtnY) ** 2);
        
        if (distanceToResize <= resizeBtnRadius) {
          console.log("🔧 Resize button touched, starting resize for image:", i);
          // Ensure image is selected before resizing
          if (selectedImage !== i) {
            setSelectedImage(i);
          }
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
        
        // Check if touch is on the image body
        if (x >= imagePos.x && x <= imagePos.x + imagePos.width &&
            y >= imagePos.y && y <= imagePos.y + imagePos.height) {
          
          touchedImage = true;
          // Debug statement removed
          
          // ALWAYS select the image when touched - no exceptions
          if (selectedImage !== i) {
            console.log("✅ Selecting image:", i);
            setSelectedImage(i);
          }
          
          // Set up for immediate dragging - no delays, no timers
          setDragOffset({
            x: x - imagePos.x,
            y: y - imagePos.y
          });
          
          // Enable dragging immediately for responsive feel
          setDraggedSimpleImage(i);
          console.log("🚀 Dragging enabled immediately for image:", i);
          
          break;
        }
      }
      
      // Only deselect if we didn't touch ANY image
      if (!touchedImage && selectedImage !== null) {
        console.log("🔄 Touching outside images, deselecting current selection");
        setSelectedImage(null);
      }
    }
  };

  // Handle touch move events for mobile image dragging and resizing
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !props.editMode) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;
    
    // Handle dragging of images (only when dragging is explicitly enabled)
    if (draggedSimpleImage !== null && e.touches.length === 1) {
      // Update image position
      const newPositions = [...simpleImagePositions];
      const newX = Math.max(0, Math.min(canvasRef.current.width - newPositions[draggedSimpleImage].width, x - dragOffset.x));
      const newY = Math.max(0, Math.min(canvasRef.current.height - newPositions[draggedSimpleImage].height, y - dragOffset.y));
      
      newPositions[draggedSimpleImage] = {
        ...newPositions[draggedSimpleImage],
        x: newX,
        y: newY
      };
      
      setSimpleImagePositions(newPositions);
      
      // Call the callback to update parent state
      if (props.onImageDrag) {
        props.onImageDrag(draggedSimpleImage, newX, newY);
      }
    }
    
    // Handle resizing with single finger drag
    if (resizingSimpleImage !== null && e.touches.length === 1 && resizeStartData) {
      const deltaX = x - resizeStartData.startX;
      const deltaY = y - resizeStartData.startY;
      
      // Calculate new dimensions based on drag direction
      // GoodNotes style: drag bottom-right to grow, top-left to shrink
      const newWidth = Math.max(100, Math.min(canvasRef.current.width * 0.8, resizeStartData.startWidth + deltaX));
      const newHeight = Math.max(100, Math.min(canvasRef.current.height * 0.8, resizeStartData.startHeight + deltaY));
      
      // Preserve aspect ratio
      const aspectRatio = resizeStartData.startWidth / resizeStartData.startHeight;
      let finalWidth = newWidth;
      let finalHeight = newHeight;
      
      if (newWidth / newHeight > aspectRatio) {
        finalHeight = newWidth / aspectRatio;
        if (finalHeight > canvasRef.current.height * 0.8) {
          finalHeight = canvasRef.current.height * 0.8;
          finalWidth = finalHeight * aspectRatio;
        }
      } else {
        finalWidth = newHeight * aspectRatio;
        if (finalWidth > canvasRef.current.width * 0.8) {
          finalWidth = canvasRef.current.width * 0.8;
          finalHeight = finalWidth / aspectRatio;
        }
      }
      
      const newPositions = [...simpleImagePositions];
      newPositions[resizingSimpleImage] = {
        ...newPositions[resizingSimpleImage],
        width: finalWidth,
        height: finalHeight
      };
      
      setSimpleImagePositions(newPositions);
      
      // Call the callback to update parent state
      if (props.onImageResize) {
        props.onImageResize(resizingSimpleImage, finalWidth, finalHeight);
      }
    }
    
    // Handle pinch-to-resize
    if (selectedImage !== null && e.touches.length === 2 && initialPinchDistance > 0 && initialImageSize) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = Math.sqrt(
        Math.pow(touch1.clientX - touch2.clientX, 2) + 
        Math.pow(touch1.clientY - touch2.clientY, 2)
      );
      
      const scale = currentDistance / initialPinchDistance;
      const newWidth = Math.max(100, Math.min(canvasRef.current.width * 0.8, initialImageSize.width * scale));
      const newHeight = Math.max(100, Math.min(canvasRef.current.height * 0.8, initialImageSize.height * scale));
      
      // Preserve aspect ratio
      const aspectRatio = initialImageSize.width / initialImageSize.height;
      let finalWidth = newWidth;
      let finalHeight = newHeight;
      
      if (newWidth / newHeight > aspectRatio) {
        finalHeight = newWidth / aspectRatio;
        if (finalHeight > canvasRef.current.height * 0.8) {
          finalHeight = canvasRef.current.height * 0.8;
          finalWidth = finalHeight * aspectRatio;
        }
      } else {
        finalWidth = newHeight * aspectRatio;
        if (finalWidth > canvasRef.current.width * 0.8) {
          finalWidth = canvasRef.current.width * 0.8;
          finalHeight = finalWidth / aspectRatio;
        }
      }
      
      const newPositions = [...simpleImagePositions];
      newPositions[selectedImage] = {
        ...newPositions[selectedImage],
        width: finalWidth,
        height: finalHeight
      };
      
      setSimpleImagePositions(newPositions);
      
      // Call the callback to update parent state
      if (props.onImageResize) {
        props.onImageResize(selectedImage, finalWidth, finalHeight);
      }
    }
  };

  // Handle touch end events for mobile image dragging
  const handleTouchEnd = () => {
    // Stop dragging
    setDraggedSimpleImage(null);
    setDragOffset({ x: 0, y: 0 });
    
    // Stop resizing
    if (resizingSimpleImage !== null) {
      setResizingSimpleImage(null);
      setResizeStartData(null);
    }
    
    // Stop pinch-to-resize
    setInitialPinchDistance(0);
    setInitialImageSize(null);
    
    // Note: We don't deselect the image here to allow for continuous interaction
    // The image will be deselected when touching elsewhere in handleTouchStart
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



  // Note: Removed forceRedraw function - React automatically re-renders when state changes
  
  // Update simple image positions when images prop changes
  // Use ref to track if we've initialized positions for current images
  const initializedImagesRef = useRef<Set<string | Blob>>(new Set());

  useEffect(() => {
    if (layoutMode === 'freeflow' && images.length > 0) {
      // Debug statement removed

      // Use functional update to check if update is needed AND update in one go
      setSimpleImagePositions(prevPositions => {
        // Check if we need to update - only if images actually changed
        const needsUpdate = images.length !== prevPositions.length ||
                           images.some((img, i) => prevPositions[i]?.image !== img);

        if (!needsUpdate) {
          // Debug statement removed
          return prevPositions; // Return same reference to prevent re-render
        }

        // Debug statement removed
        
        const newImagePositions: Array<{
          x: number;
          y: number;
          width: number;
          height: number;
          rotation: number;
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
          // Find existing position by matching the actual image, not by index
          // This prevents teleporting when images are deleted
          const existingPosition = prevPositions.find(pos => {
            // Compare image URLs or blob objects
            if (typeof pos.image === 'string' && typeof image === 'string') {
              return pos.image === image;
            } else if (pos.image === image) {
              return true;
            }
            return false;
          });

            if (existingPosition) {
              // Debug statement removed
              // Preserve existing position, size, and rotation, but update the image reference
              newImagePositions.push({
                ...existingPosition,
                image
              });
            } else {
              // Debug statement removed
            
            // Use default dimensions for initial positioning (will be updated when image loads)
            const imageWidth = 400; // Reduced from 800
            const imageHeight = 300; // Reduced from 600
            
            // This is a new image, calculate default position
            let x = 0, y = 0;
            
            // Check if we have saved positions for this image
            let savedRotation = 0;
            if (props.savedImagePositions && props.savedImagePositions[index]) {
              // Use saved position
              x = props.savedImagePositions[index].x;
              y = props.savedImagePositions[index].y;
              savedRotation = props.savedImagePositions[index].rotation || 0;
              // Debug statement removed
            } else {
              // Spread images out using grid pattern to prevent overlap
              // Use the new canvas dimensions (1860x2620)
              const canvasWidth = 1860;
              const canvasHeight = 2620;
              const centerX = (canvasWidth - imageWidth) / 2;
              const centerY = (canvasHeight - imageHeight) / 2;

              // Use a grid-like pattern with randomness for better spread
              const gridCols = 3;
              const gridX = (index % gridCols) - 1; // -1, 0, 1
              const gridY = Math.floor(index / gridCols);

              const baseOffsetX = gridX * (imageWidth + 100);
              const baseOffsetY = gridY * (imageHeight + 100);

              // Add randomness to avoid perfect grid
              const randomOffsetX = (Math.random() - 0.5) * 100;
              const randomOffsetY = (Math.random() - 0.5) * 100;

              x = centerX + baseOffsetX + randomOffsetX;
              y = centerY + baseOffsetY + randomOffsetY;

              // Ensure images don't go off the canvas edges
              x = Math.max(50, Math.min(x, canvasWidth - imageWidth - 50));
              y = Math.max(50, Math.min(y, canvasHeight - imageHeight - 50));

              // Debug statement removed
            }
            
            newImagePositions.push({
              x,
              y,
              width: imageWidth,
              height: imageHeight,
              rotation: savedRotation, // Use saved rotation or default to 0
              image
            });
          }
        });
        
        // Debug statement removed
        return newImagePositions;
      });

      // Note: Removed renderJournal() call - React automatically re-renders when simpleImagePositions changes
    } else if (layoutMode !== 'freeflow') {
      // Clear positions when not in freeflow mode - use functional update
      setSimpleImagePositions(prev => prev.length > 0 ? [] : prev);
    }
  }, [images, layoutMode, props.savedImagePositions]);

  // Update image dimensions when they load (preserving positions)
  // Note: Only depend on images.length to avoid re-render loop
  useEffect(() => {
    if (layoutMode === 'freeflow' && images.length > 0) {
      const updateImageDimensions = async () => {
        // Use functional update to get latest positions without depending on them
        setSimpleImagePositions(currentPositions => {
          if (currentPositions.length === 0) return currentPositions;

          const updatedPositions = [...currentPositions];
          let hasChanges = false;

          // Process dimensions asynchronously
          images.forEach((image, i) => {
            const position = currentPositions[i];

            if (position && image && (position.width === 400 || position.height === 300)) {
              // This image still has default dimensions, calculate proper ones
              const img = new Image();
              img.onload = () => {
                const aspectRatio = img.naturalWidth / img.naturalHeight;
                const maxDimension = 600;

                let width, height;
                if (aspectRatio > 1) {
                  width = maxDimension;
                  height = maxDimension / aspectRatio;
                } else {
                  height = maxDimension;
                  width = maxDimension * aspectRatio;
                }

                const finalWidth = Math.round(width);
                const finalHeight = Math.round(height);

                if (finalWidth !== position.width || finalHeight !== position.height) {
                  // Update only this specific position
                  setSimpleImagePositions(prev => {
                    const newPositions = [...prev];
                    if (newPositions[i]) {
                      newPositions[i] = {
                        ...newPositions[i],
                        width: finalWidth,
                        height: finalHeight
                      };
                      // Debug statement removed
                    }
                    return newPositions;
                  });
                }
              };
              img.onerror = () => {
                console.error(`Failed to load image ${i} for dimension calculation`);
              };
              img.src = typeof image === 'string' ? image : URL.createObjectURL(image);
            }
          });

          return currentPositions; // Return unchanged initially
        });
      };

      updateImageDimensions();
    }
  }, [images.length, layoutMode]);

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
    btnRadius = 150, // Standard button radius
    isHovered = false
  ) {
    if (!ctx) return;
    
    // Draw drop shadowed button
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, btnRadius, 0, 2 * Math.PI);
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 60;
    ctx.shadowOffsetX = 16;
    ctx.shadowOffsetY = 16;
    
    // Make button brighter if hovered
    const btnColor = isHovered ? adjustColor(color, 25) : color;
    ctx.fillStyle = btnColor;
    ctx.fill();
    
    // Add white border
    ctx.lineWidth = 80;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.restore();

    // Set icon size relative to button radius
    const iconSize = btnRadius * (isHovered ? 1.4 : 1.3);
    
    // Draw the icon directly using canvas primitives for perfect control
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#fff';
    ctx.fillStyle = '#fff';
    ctx.lineWidth = isHovered ? 120 : 100;
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
          
          // Set default sticker size - GoodNotes style
          const defaultStickerSize = 1000;
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
          
          // Positioning - avoid edges and make them easier to grab
          const locationAreaHeight = canvasHeight * 0.15; // Top 15% for location
          const stickerAreaTop = locationAreaHeight + 50;
          const stickerAreaHeight = canvasHeight * 0.4;
          
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

  // Clear all image interaction states when images are deleted to prevent teleporting
  useEffect(() => {
    if (selectedImage !== null && selectedImage >= images.length) {
      console.log("🔄 Image deleted, clearing selection state");
      setSelectedImage(null);
    }
    if (draggedSimpleImage !== null && draggedSimpleImage >= images.length) {
      console.log("🔄 Image deleted, clearing drag state");
      setDraggedSimpleImage(null);
    }
    if (resizingSimpleImage !== null && resizingSimpleImage >= images.length) {
      console.log("🔄 Image deleted, clearing resize state");
      setResizingSimpleImage(null);
    }
  }, [images.length, selectedImage, draggedSimpleImage, resizingSimpleImage]);

  // BULLETPROOF SELECTION STATE MONITORING - without forced re-renders
  useEffect(() => {
    if (props.editMode && layoutMode === 'freeflow') {
      // Debug statement removed

      // Validate selection state
      if (selectedImage !== null) {
        if (selectedImage < 0 || selectedImage >= simpleImagePositions.length) {
          console.error("🚨 INVALID SELECTION STATE: selectedImage out of bounds, resetting");
          setSelectedImage(null);
          return;
        }
        console.log("✅ Selection state validated:", selectedImage);
      }
      // Removed setRenderCount - React already re-renders when state changes
    }
  }, [selectedImage, props.editMode, layoutMode, simpleImagePositions.length]);

  // Note: Removed forced re-render on position changes - React handles this automatically

  // Track canvas ref changes to debug glitching
  useEffect(() => {
    // Debug statement removed
  }, [canvasRef.current]);

  // Track component mount/unmount
  useEffect(() => {
    // Debug statement removed
    return () => {
      // Debug statement removed
    };
  }, []);

  // Debug statement removed

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        contain: 'layout size style paint',
        aspectRatio: '1860 / 2620',
        willChange: 'contents',
        isolation: 'isolate',
        maxWidth: '100%',
        minHeight: 0
      }}
    >
      {/* Removed conditional rendering to prevent flash */}
      <>
        <canvas
            key="journal-canvas-stable"
            ref={canvasRef}
            id="journal-canvas"
            className="w-full h-auto max-w-full bg-[#f5f2e9]"
            style={{
              aspectRatio: '1860 / 2620', // Match actual canvas dimensions
              width: '100%',
              maxWidth: '100%',
              minWidth: '100%', // Lock width during operations
              minHeight: '0', // But allow height to flex with aspect ratio
              margin: '0 auto',
              cursor: canvasCursor,
              touchAction: 'none', // Prevent default touch behaviors
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none',
              imageRendering: 'auto', // High quality scaling
              filter: 'none',
              display: 'block', // Prevent layout shifts
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)', // Static shadow instead of motion
              contain: 'layout size style paint', // Isolate canvas layout
              contentVisibility: 'visible', // Always visible to prevent collapse
              willChange: 'contents', // Hint for GPU, but not transform (keeps size)
              visibility: isLoading ? 'visible' : 'visible' // Always visible even when loading
            }}
            onPointerDown={handleMouseDown}
            onPointerMove={handleMouseMove}
            onPointerUp={handleMouseUp}
            onPointerLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
          
          {/* Add sticker button is now moved to parent component */}
        </>
    </div>
  );
});

export default JournalCanvas; 