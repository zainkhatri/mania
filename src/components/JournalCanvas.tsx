import React, { useRef, useEffect, useState, useCallback } from 'react';
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

const JournalCanvas: React.FC<JournalCanvasProps> = ({
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
}) => {
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
  const [stickerDragOffset, setStickerDragOffset] = useState<{x: number, y: number} | null>(null);
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
        
        const templatePromise = new Promise<HTMLImageElement | null>((resolve) => {
          template.onload = () => {
            console.log('Template loaded successfully');
            resolve(template);
          };
          template.onerror = (err) => {
            console.error('Failed to load template image:', err);
            resolve(null); // Continue even if template fails
          };
          // Add timestamp to prevent caching issues
          const cacheBuster = `?v=${new Date().getTime()}`;
          template.src = templateUrl.includes('?') ? templateUrl : templateUrl + cacheBuster;
        });
        
        const loadedTemplate = await templatePromise;
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

  // Helper to draw images preserving aspect ratio, border, rotation, and flipping
  const drawImagePreservingAspectRatio = (
    img: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number,
    addBorder = false,
    rotation = 0,
    flipH = false,
    flipV = false
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    try {
      const imgAspect = img.width / img.height;
      const targetAspect = width / height;
      let drawWidth: number, drawHeight: number, drawX: number, drawY: number;
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
      ctx.translate(drawX + drawWidth / 2, drawY + drawHeight / 2);
      if (rotation) ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      if (addBorder) {
        // Draw a subtle dark outline instead of white border
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.strokeRect(-drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      }
      ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();
    } catch (err) {
      console.error('Error drawing image:', err);
    }
  };

  // Draw the canvas with all elements
  useEffect(() => {
    if (!canvasRef.current) return;
    if (isLoading) return; // Don't draw while loading
    
    // Check for global flag to force redraw
    if (window.FORCE_CANVAS_REDRAW) {
      console.log('Forced redraw triggered with colors:', window.CURRENT_COLORS);
      window.FORCE_CANVAS_REDRAW = false;
    }
    
    // Log re-render trigger
    console.log('Re-rendering canvas with colors:', textColors);
    console.log('Force update timestamp:', props.forceUpdate);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
    if (!ctx) return;
    
    try {
      // Original canvas dimensions
      canvas.width = 1240;
      canvas.height = 1748;
      
      // Clear canvas and fill with template background color
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f5f2e9'; // Match the template's cream color
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw template
      if (templateImage) {
        // Draw template to fill the entire canvas exactly
        ctx.drawImage(templateImage, 0, 0, canvas.width, canvas.height);
      }
      
      // DEBUG: Draw red guide lines to show notebook lines (21 lines total)
      const showGuideLines = false; // Set to false to hide the red guide lines
      if (showGuideLines) {
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.lineWidth = 5;
        
        // Configure the exact coordinates for the notebook lines
        const notebookLines = [
          283.2, 356.4, 428.6, 500.8, 575.0, 645.2, 719.4, 792, 865,
          937.0, 1010, 1083.0, 1157.0, 1230.0, 1305.0, 1375.0, 1447.0, 1522.0, 1595.0, 1667.0, 1739.0
        ];
        
        // Draw each line at its exact position
        notebookLines.forEach(lineY => {
          ctx.beginPath();
          ctx.moveTo(20, lineY);
          ctx.lineTo(canvas.width - 20, lineY);
          ctx.stroke();
        });
      }
      
      // Calculate dimensions to use full page height
      const topMargin = 20;
      const minSpacingBetweenElements = 10; // Keep better spacing
      let currentYPosition = topMargin + 40; // Starting Y position for the date
      const headerHeight = 180; // Slightly taller header area
      const contentHeight = canvas.height - topMargin - headerHeight - 20; // Subtract top margin, headers, and bottom margin
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
          { type: 'date', x: 0, y: currentYPosition + 10, width: fullWidth, height: 30 },
          // Row 2 - Location spans full width (moved closer to date)
          { type: 'location', x: 10, y: currentYPosition + 10, width: fullWidth, height: 20 },
          // Row 3 - Left image, right text
          { type: 'image', x: 0, y: topMargin + headerHeight + 25, width: imageColumnWidth - 20, height: rowHeight - 30 },
          { type: 'text', x: imageColumnWidth - 50, y: topMargin + headerHeight, width: textColumnWidth + 100, height: rowHeight },
          // Row 4 - Left text, right image
          { type: 'text', x: 0, y: topMargin + headerHeight + rowHeight + 10, width: textColumnWidth + 85, height: rowHeight },
          { type: 'image', x: textColumnWidth + 25, y: topMargin - 30 + headerHeight + rowHeight + 60, width: imageColumnWidth - 20, height: rowHeight - 40 },
          // Row 5 - Third image with consistent margins
          { type: 'image', x: 10, y: topMargin + headerHeight + (rowHeight * 2) + 40, width: imageColumnWidth - 40, height: rowHeight - 30 },
          { type: 'text', x: imageColumnWidth - 40, y: topMargin + headerHeight + (rowHeight * 2) + 20, width: fullWidth - imageColumnWidth + 90, height: rowHeight + 100 }
        ];
      } else {
        // Mirrored layout: Text on left, images on right
        gridLayout = [
          // Row 1 - Date spans full width (moved up further)
          { type: 'date', x: 0, y: currentYPosition + 10, width: fullWidth, height: 50 },
          // Row 2 - Location spans full width (moved closer to date)
          { type: 'location', x: 10, y: currentYPosition, width: fullWidth, height: 30 },
          // Row 3 - Left text, right image (mirroring Row 3 of Style 1)
          { type: 'text', x: -10, y: topMargin + headerHeight, width: textColumnWidth + 90, height: rowHeight },
          { type: 'image', x: textColumnWidth + 15, y: topMargin + headerHeight + 25, width: imageColumnWidth - 20, height: rowHeight - 30 },
          // Row 4 - Left image, right text (mirroring Row 4 of Style 1)
          { type: 'image', x: 0, y: topMargin + -30 + headerHeight + rowHeight + 60, width: imageColumnWidth - 20, height: rowHeight - 40 },
          { type: 'text', x: imageColumnWidth - 55, y: topMargin + headerHeight + rowHeight + 10, width: textColumnWidth + 105, height: rowHeight },
          // Row 5 - Left text, right image (mirroring Row 5 of Style 1)
          { type: 'text', x: -10, y: topMargin + headerHeight + (rowHeight * 2) + 20, width: textColumnWidth + 90, height: rowHeight + 100 },
          { type: 'image', x: textColumnWidth + 15, y: topMargin + headerHeight + (rowHeight * 2) + 40, width: imageColumnWidth - 20, height: rowHeight - 30 }
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
            dateCell.width - 20, // Reduced padding
            "'TitleFont', sans-serif", // Use title font for date - reverting to original
            60, // min
            150 // max
          );
          
          // Set font and color - always black for date text
          ctx.fontKerning = 'normal';
          ctx.font = `${maxDateFontSize}px 'TitleFont', sans-serif`; // Reverting to original font
          ctx.fillStyle = '#000000'; // Always black for the date
          ctx.textAlign = 'left'; // Ensure text is left-aligned
          
          // Calculate metrics for the date text to determine its actual height
          const dateMetrics = ctx.measureText(dateText);
          // For minimal spacing, we'll use just the descent part of the font 
          // since we want the letters to be very close without overlapping
          let dateTextBaselineOffset;
          if (dateMetrics.fontBoundingBoxDescent) {
            dateTextBaselineOffset = dateMetrics.fontBoundingBoxDescent;
          } else {
            // Fallback: estimate descent as 0.2x the font size
            dateTextBaselineOffset = maxDateFontSize * 0.2;
          }
          
          // Draw the date text (moved up further)
          ctx.font = `${maxDateFontSize}px 'TitleFont', sans-serif`; // Reverting to original font
          ctx.fillText(dateText, dateCell.x + 20, dateCell.y + 25);
          
          // Calculate the Y position for the location with minimal spacing
          // Use the date baseline position + reduced spacing (moved higher)
          currentYPosition = dateCell.y + dateTextBaselineOffset + minSpacingBetweenElements - 5; // Reduced by 5px
          
          // Update the location cell's Y position
          const locationCell = gridLayout.find(cell => cell.type === 'location');
          if (locationCell) {
            locationCell.y = currentYPosition;
          }
        } catch (err) {
          console.error('Error drawing date:', err);
          // Fallback position if date rendering fails
          currentYPosition = topMargin + 100;
          
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
      
      // Draw continuous text that flows through all text boxes
      if (journalText) {
        try {
          // Calculate the optimal font size for text sections
          const minFontSize = 14; // Slightly increased minimum font size
          const maxFontSize = 70; // Increased from 60 to 70
          const totalLines = 21; // Total available lines across all text areas
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
                textAreas[0].width - 80, // Increase padding
                textAreas[1].width - 80, // Increase padding
                textAreas[2].width - 80  // Increase padding
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
          
          // First, calculate the optimal font size for our reference text (98 words)
          // This will be our maximum allowable font size even for shorter texts
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
          
          // Adjust final font size for better readability (was 0.75, now 0.85 for larger text)
          fontSize = Math.max(minFontSize, fontSize * 0.85);
          
          // Use the real text to do layout, but with the font size constrained by our reference calculation
          // The font size is now fixed based on 98 words and reduced by 25%
          
          // Set the font with our precisely determined size for content text
          ctx.fontKerning = 'normal';
          const fontString = `${fontSize}px ZainCustomFont, Arial, sans-serif`; // Reverting to original font
          ctx.font = fontString;
          ctx.fillStyle = '#000000';
          
          // Use the same notebook line positions defined earlier
          const notebookLines = [
            283.2, 356.4, 428.6, 500.8, 575.0, 645.2, 719.4, 792, 865,
            937.0, 1010, 1083.0, 1157.0, 1230.0, 1305.0, 1375.0, 1447.0, 1522.0, 1595.0, 1667.0, 1739.0
          ];
          
          // Split text into words for layout
          let currentWord = 0;
          let currentLine = '';
          
          // Define line ranges for each text area to create the snake pattern
          const textAreaLineRanges = [
            { startLine: 0, endLine: 6 },      // First 7 lines (0-6) in the first text area (right)
            { startLine: 7, endLine: 13 },     // Next 7 lines (7-13) in the second text area (left)
            { startLine: 14, endLine: 20 }     // Last 7 lines (14-20) in the third text area (right)
          ];
          
          // Reorder text areas to match the snake pattern
          // The original order is: top-right, middle-left, bottom-right
          // Our desired snaking order is the same, so we keep the order
          const orderedTextAreas = [
            textAreas[0], // First text area (right)
            textAreas[1], // Second text area (left)
            textAreas[2]  // Third text area (right)
          ];
          
          // Process each text area in the specific snake order
          for (let areaIndex = 0; areaIndex < orderedTextAreas.length && currentWord < words.length; areaIndex++) {
            const area = orderedTextAreas[areaIndex];
            const areaX = area.x + 30; // Increase left padding for text
            const areaWidth = area.width - 80; // Account for more padding to reduce squishing
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
              // Adjust baseline offset based on font size
              const baselineOffset = Math.max(5, fontSize / 6);
              const currentY = notebookLines[lineIndex] - baselineOffset; // Adjust for text baseline
              
              // Build the line by adding words until we reach the max width
              while (currentWord < words.length) {
                const nextWord = words[currentWord];
                const testLine = currentLine ? `${currentLine} ${nextWord}` : nextWord;
                const metrics = ctx.measureText(testLine);
                
                if (metrics.width > areaWidth && currentLine) {
                  // Line is full, draw it and move to the next line
                  ctx.fillText(currentLine, areaX, currentY);
                  currentLine = '';
                  break; // Move to next line
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
          
          // Use the regular drawing function for all images now that the grid is correctly positioned
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
          // Find optimal font size for location
          const maxLocationFontSize = calculateOptimalFontSize(
            ctx, 
            location, 
            locationCell.width - 20, // Reduced padding
            "'TitleFont', sans-serif", // Use title font for location
            60, // min
            150 // max
          );
          
          // Determine colors - use direct selection if provided, otherwise use default  
          const locationColor = window.FORCE_CANVAS_REDRAW 
            ? window.CURRENT_COLORS.locationColor 
            : (textColors.locationColor || '#3498DB');
          const locationShadowColor = window.FORCE_CANVAS_REDRAW 
            ? window.CURRENT_COLORS.locationShadowColor 
            : (textColors.locationShadowColor || '#AED6F1');
          
          // Log the color values for debugging
          console.log("Applying location colors:", {
            mainColor: locationColor,
            shadowColor: locationShadowColor
          });
          
          ctx.font = `${maxLocationFontSize}px 'TitleFont', sans-serif`;
          ctx.textAlign = 'left'; // Ensure text is left-aligned
          
          // For the location, we'll ensure it's drawn last (on top of everything)
          // Draw title text on top of all other elements
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
          
          // Simplified shadow effect - just one shadow layer and main text (two colors total)
          // Shadow layer with customizable offsets
          const shadowOffsetX = window.shadowOffsetX !== undefined ? window.shadowOffsetX : 5;
          const shadowOffsetY = window.shadowOffsetY !== undefined ? window.shadowOffsetY : 8;
          
          ctx.fillStyle = locationShadowColor;
          ctx.fillText(location.toUpperCase(), locationCell.x + shadowOffsetX, yPosition + shadowOffsetY);

          // Main text
          ctx.fillStyle = locationColor;
          ctx.fillText(location.toUpperCase(), locationCell.x, yPosition);
          
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
        stickers.forEach((sticker, i) => {
          let img = sticker.imageObj;
          if (!img && sticker.src) {
            img = new window.Image();
            if (typeof sticker.src === 'string') img.src = sticker.src;
            else img.src = URL.createObjectURL(sticker.src);
            sticker.imageObj = img;
          }
          if (img && img.complete) {
            ctx.save();
            ctx.translate(sticker.x + sticker.width/2, sticker.y + sticker.height/2);
            ctx.rotate((sticker.rotation * Math.PI) / 180);
            ctx.drawImage(img, -sticker.width/2, -sticker.height/2, sticker.width, sticker.height);
            // Draw border if selected
            if (activeSticker === i) {
              // Dashed blue border
              ctx.save();
              ctx.setLineDash([8, 6]);
              ctx.strokeStyle = '#2563eb'; // blue-600
              ctx.lineWidth = 3;
              ctx.strokeRect(-sticker.width/2, -sticker.height/2, sticker.width, sticker.height);
              ctx.setLineDash([]);
              ctx.restore();

              const btnRadius = 22;
              // Delete (red, white X) - top-left
              drawSFSymbolButton(ctx, -sticker.width/2 - 16, -sticker.height/2 - 16, '#ef4444', 'delete', btnRadius);
              // Rotate (blue, white arrow) - top-center
              drawSFSymbolButton(ctx, 0, -sticker.height/2 - 38, '#2563eb', 'rotate', btnRadius);
              // Resize (blue, white diagonal) - bottom-right
              drawSFSymbolButton(ctx, sticker.width/2 + 16, sticker.height/2 + 16, '#2563eb', 'resize', btnRadius);
            }
            ctx.restore();
          }
        });
      }

      // After drawing stickers, store button positions for hit detection
      if (activeSticker !== null && stickers[activeSticker]) {
        const sticker = stickers[activeSticker];
        const btnRadius = 22;
        
        // Store button positions in global state for click handling
        setStickerButtonsData({
          deleteBtn: {
            x: sticker.x - sticker.width/2 - 16,
            y: sticker.y - sticker.height/2 - 16
          },
          rotateBtn: {
            x: sticker.x,
            y: sticker.y - sticker.height/2 - 38
          },
          resizeBtn: {
            x: sticker.x + sticker.width/2 + 16,
            y: sticker.y + sticker.height/2 + 16
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
  }, [date, location, textSections, imageObjects, isLoading, templateImage, fontLoaded, getCombinedText, textColors, forceRender, props.forceUpdate, renderCount, layoutMode, stickers, activeSticker, stickerDragOffset, stickerAction]);

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
      // First create a high-resolution PNG snapshot
      html2canvas(journalCanvas, {
        scale: 20, // Extreme high-resolution (20x)
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
        windowWidth: journalCanvas.width * 4,
        windowHeight: journalCanvas.height * 4
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

    // First check for button clicks if a sticker is active
    if (activeSticker !== null) {
      const sticker = stickers[activeSticker];
      const btnRadius = 22;
      
      // Transform canvas coordinates to get actual button positions
      // Delete button (top-left)
      const deleteBtn = {
        x: sticker.x + (-sticker.width/2 - 16) * Math.cos(sticker.rotation * Math.PI / 180) - 
           (-sticker.height/2 - 16) * Math.sin(sticker.rotation * Math.PI / 180),
        y: sticker.y + (-sticker.width/2 - 16) * Math.sin(sticker.rotation * Math.PI / 180) + 
           (-sticker.height/2 - 16) * Math.cos(sticker.rotation * Math.PI / 180)
      };
      
      // Check if delete button was clicked
      if (Math.sqrt((mouseX - deleteBtn.x) ** 2 + (mouseY - deleteBtn.y) ** 2) <= btnRadius) {
        // Delete this sticker
        const newStickers = stickers.filter((_, idx) => idx !== activeSticker);
        setStickers(newStickers);
        setActiveSticker(null);
        renderJournal();
        return;
      }
      
      // Add similar checks for rotate and resize buttons if needed
    }

    // Check if clicked on a sticker
    let clickedOnSticker = false;
    for (let i = stickers.length - 1; i >= 0; i--) {
      const sticker = stickers[i];
      const dx = mouseX - sticker.x;
      const dy = mouseY - sticker.y;
      const angle = -sticker.rotation * Math.PI / 180;
      const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
      const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
      
      // Check if click is inside sticker bounds
      if (Math.abs(localX) < sticker.width/2 && Math.abs(localY) < sticker.height/2) {
        setActiveSticker(i);
        clickedOnSticker = true;
        // Bring to front
        const maxZ = getMaxStickerZ();
        if (sticker.zIndex < maxZ) {
          const newStickers = stickers.map((s, idx) => idx === i ? { ...s, zIndex: maxZ + 1 } : s);
          setStickers(newStickers);
        }
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

    // Check if we clicked on a sticker's control handles
    if (activeSticker !== null) {
      const sticker = stickers[activeSticker];
      const dx = x - (sticker.x + sticker.width/2);
      const dy = y - (sticker.y + sticker.height/2);
      const angle = -sticker.rotation * Math.PI / 180;
      const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
      const localY = dx * Math.sin(angle) + dy * Math.cos(angle);

      // Check resize handle (bottom right)
      if (Math.abs(localX - sticker.width/2) < 15 && Math.abs(localY - sticker.height/2) < 15) {
        setStickerAction('resize');
        setStickerDragOffset({x: localX, y: localY});
        return;
      }
      
      // Check rotate handle (top center)
      if (Math.abs(localX) < 15 && Math.abs(localY + sticker.height/2 + 20) < 15) {
        setStickerAction('rotate');
        setStickerDragOffset({x: localX, y: localY});
        return;
      }
      
      // If clicked inside sticker, start dragging
      if (localX > -sticker.width/2 && localX < sticker.width/2 && 
          localY > -sticker.height/2 && localY < sticker.height/2) {
        setStickerAction('move');
        setStickerDragOffset({x: localX, y: localY});
        setIsDragging(true);
        return;
      }
    }

    // Handle other interactions (text areas, etc.)
    // ... existing code for text areas and other interactions ...
  };

  // Update handleMouseMove to handle dragging
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !props.editMode) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Update cursor based on hover position
    if (activeSticker !== null) {
      const sticker = stickers[activeSticker];
      const dx = x - (sticker.x + sticker.width/2);
      const dy = y - (sticker.y + sticker.height/2);
      const angle = -sticker.rotation * Math.PI / 180;
      const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
      const localY = dx * Math.sin(angle) + dy * Math.cos(angle);

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
    }

    // Handle sticker actions
    if (activeSticker !== null && stickerAction && stickerDragOffset) {
      const sticker = stickers[activeSticker];
      const dx = x - (sticker.x + sticker.width/2);
      const dy = y - (sticker.y + sticker.height/2);
      const angle = -sticker.rotation * Math.PI / 180;
      const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
      const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
      
      let newStickers = [...stickers];
      
      if (stickerAction === 'move') {
        newStickers[activeSticker] = {
          ...sticker,
          x: x - stickerDragOffset.x - sticker.width/2,
          y: y - stickerDragOffset.y - sticker.height/2,
        };
      } else if (stickerAction === 'resize') {
        let newWidth = localX - stickerDragOffset.x + sticker.width;
        let newHeight = localY - stickerDragOffset.y + sticker.height;
        // Maintain aspect ratio
        const aspect = sticker.width / sticker.height;
        if (Math.abs(newWidth / newHeight - aspect) > 0.01) {
          if (Math.abs(localX) > Math.abs(localY)) {
            newHeight = newWidth / aspect;
          } else {
            newWidth = newHeight * aspect;
          }
        }
        newWidth = Math.max(30, newWidth);
        newHeight = Math.max(30, newHeight);
        newStickers[activeSticker] = {
          ...sticker,
          width: newWidth,
          height: newHeight,
        };
      } else if (stickerAction === 'rotate') {
        const centerX = sticker.x + sticker.width/2;
        const centerY = sticker.y + sticker.height/2;
        const angleRad = Math.atan2(y - centerY, x - centerX);
        newStickers[activeSticker] = {
          ...sticker,
          rotation: angleRad * 180 / Math.PI + 90,
        };
      }
      
      setStickers(newStickers);
      renderJournal();
    }

    // Handle other interactions
    // ... existing code for other interactions ...
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

  // 2. Sticker upload handler
  const handleStickerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const img = new window.Image();
      img.onload = () => {
        // Calculate initial size to fit max 120px on the longest side
        let width = img.width;
        let height = img.height;
        const maxDim = 120;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
        }
        setStickers(prev => [
          ...prev,
          {
            src: file,
            x: 200,
            y: 100,
            width,
            height,
            rotation: 0,
            zIndex: prev.length + 10,
            imageObj: img,
          },
        ]);
      };
      img.src = URL.createObjectURL(file);
    }
  };

  // Helper to draw GoodNotes-style control button
  function drawSFSymbolButton(
    ctx: CanvasRenderingContext2D | null,
    x: number,
    y: number,
    color: string, // fill color
    icon: 'delete' | 'rotate' | 'resize',
    btnRadius = 22
  ) {
    if (!ctx) return;
    // Draw drop shadowed button
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, btnRadius, 0, 2 * Math.PI);
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.restore();

    // Set icon size relative to button radius (70-80% of button)
    const iconSize = btnRadius * 1.3;
    
    // Draw the icon directly using canvas primitives for perfect control
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#fff';
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 4; // Much thicker lines
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
    
    // Check for button clicks if button data is available
    if (stickerButtonsData.deleteBtn) {
      const btnRadius = 22;
      const deleteBtn = stickerButtonsData.deleteBtn;
      
      // Use a larger hit area for easier button clicking
      const dist = Math.sqrt((x - deleteBtn.x) ** 2 + (y - deleteBtn.y) ** 2);
      if (dist <= btnRadius * 1.2) { // 20% larger hit area
        console.log("Delete button clicked!");
        // Delete the active sticker
        const newStickers = stickers.filter((_, idx) => idx !== activeSticker);
        setStickers(newStickers);
        setActiveSticker(null);
        setButtonClickHandling(true); // Prevent other handlers from firing
        renderJournal();
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          />
          {images.length >= 3 && props.editMode && (
            <div className="absolute top-2 left-2 z-50">
              <label className="bg-green-500 text-white px-3 py-1 rounded cursor-pointer shadow">
                + Add Sticker
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleStickerUpload} />
              </label>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default JournalCanvas; 