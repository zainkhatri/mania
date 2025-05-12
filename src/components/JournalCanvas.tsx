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
  
  // Function to trigger a re-render when needed
  const renderJournal = useCallback(() => {
    setForceRender(prev => prev + 1); // Increment to trigger a re-render
  }, []);
  
  // Font loading using FontFace API
  useEffect(() => {
    // Add timestamp to prevent caching of the font files
    const timestamp = new Date().getTime();
    const contentFontUrl = `/font/zain.ttf?v=${timestamp}`; // For journal content
    const titleFontUrl = `/font/titles.ttf?v=${timestamp}`; // Corrected font name for location
    
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
          // Row 1 - Date spans full width
          { type: 'date', x: 0, y: currentYPosition + 30, width: fullWidth, height: 60 },
          // Row 2 - Location spans full width (moved higher - less Y offset from date)
          { type: 'location', x: 0, y: currentYPosition + 40, width: fullWidth, height: 60 },
          // Row 3 - Left image, right text
          { type: 'image', x: 0, y: topMargin + headerHeight + 50, width: imageColumnWidth - 20, height: rowHeight - 30 },
          { type: 'text', x: imageColumnWidth - 50, y: topMargin + headerHeight, width: textColumnWidth + 100, height: rowHeight },
          // Row 4 - Left text, right image
          { type: 'text', x: 0, y: topMargin + headerHeight + rowHeight + 10, width: textColumnWidth + 75, height: rowHeight },
          { type: 'image', x: textColumnWidth + 15, y: topMargin + -10 + headerHeight + rowHeight + 60, width: imageColumnWidth - 20, height: rowHeight - 40 },
          // Row 5 - Left image, right text
          { type: 'image', x: 0, y: topMargin + headerHeight + (rowHeight * 2) + 40, width: imageColumnWidth - 20, height: rowHeight - 30 },
          { type: 'text', x: imageColumnWidth - 50, y: topMargin + headerHeight + (rowHeight * 2) + 20, width: textColumnWidth + 100, height: rowHeight + 100 }
        ];
      } else {
        // Mirrored layout: Text on left, images on right
        gridLayout = [
          // Row 1 - Date spans full width
          { type: 'date', x: 0, y: currentYPosition + 30, width: fullWidth, height: 60 },
          // Row 2 - Location spans full width (moved higher - less Y offset from date)
          { type: 'location', x: 0, y: currentYPosition + 40, width: fullWidth, height: 60 },
          // Row 3 - Left text, right image
          { type: 'text', x: 0, y: topMargin + headerHeight, width: textColumnWidth + 100, height: rowHeight },
          { type: 'image', x: textColumnWidth + 50, y: topMargin + headerHeight + 50, width: imageColumnWidth - 20, height: rowHeight - 30 },
          // Row 4 - Left image, right text
          { type: 'image', x: 0, y: topMargin + -10 + headerHeight + rowHeight + 60, width: imageColumnWidth - 20, height: rowHeight - 40 },
          { type: 'text', x: imageColumnWidth - 50, y: topMargin + headerHeight + rowHeight + 10, width: textColumnWidth + 75, height: rowHeight },
          // Row 5 - Left text, right image
          { type: 'text', x: 0, y: topMargin + headerHeight + (rowHeight * 2) + 20, width: textColumnWidth + 100, height: rowHeight + 100 },
          { type: 'image', x: textColumnWidth + 50, y: topMargin + headerHeight + (rowHeight * 2) + 40, width: imageColumnWidth - 20, height: rowHeight - 30 }
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
          zIndex: 1
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
            "'TitleFont', sans-serif", // Use title font for date
            60, // min
            150 // max
          );
          
          // Set font and color - always black for date text
          ctx.fontKerning = 'normal';
          ctx.font = `${maxDateFontSize}px 'TitleFont', sans-serif`;
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
          
          // Draw the date text (no shadow)
          ctx.fillText(dateText, dateCell.x + 20, dateCell.y + 35);
          
          // Calculate the Y position for the location with minimal spacing
          // Use the date baseline position + reduced spacing (moved higher)
          currentYPosition = dateCell.y + 5 + dateTextBaselineOffset + minSpacingBetweenElements;
          
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
      
      // Draw location below date
      const locationCell = gridLayout.find(cell => cell.type === 'location');
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
          
          // For the location, we'll use the ascent part of the font for precise positioning
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
          // Shadow layer
          ctx.fillStyle = locationShadowColor;
          ctx.fillText(location.toUpperCase(), locationCell.x + 15, yPosition + 5);

          // Main text
          ctx.fillStyle = locationColor;
          ctx.fillText(location.toUpperCase(), locationCell.x + 10, yPosition - 3);
        } catch (err) {
          console.error('Error drawing location:', err);
        }
      }
      
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
          const fontString = `${fontSize}px ZainCustomFont, Arial, sans-serif`; // Keep original font for content
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
    } catch (error) {
      console.error("Error drawing canvas:", error);
    }
  }, [date, location, textSections, imageObjects, isLoading, templateImage, fontLoaded, getCombinedText, textColors, forceRender, props.forceUpdate, renderCount, layoutMode]);

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

  // Update handleMouseDown to support image color picking
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    console.log('Mouse down at:', x, y);
    console.log('Edit mode:', props.editMode);
    
    // Check if we're in edit mode
    if (props.editMode) {
      // Check if we clicked on a text area
      const clickedTextArea = clickableAreas.find(area => 
        (area.type === 'text' || area.type === 'location') &&
        x >= area.x && x <= area.x + area.width && 
        y >= area.y && y <= area.y + area.height
      );
      
      if (clickedTextArea && props.onTextClick) {
        console.log('Clicked on text area:', clickedTextArea);
        props.onTextClick(clickedTextArea);
        return;
      }
      
      // For eyedropper functionality, let's check if we're clicking on any image
      // Check if we're within any of the image positions
      const imagePositions = imagePositionsRef.current;
      const clickedOnImage = imagePositions.some((imgPos, index) => 
        x >= imgPos.x && 
        x <= imgPos.x + imgPos.width && 
        y >= imgPos.y && 
        y <= imgPos.y + imgPos.height
      );
      
      // If we're clicking on an image and have an image click handler, use it
      if (clickedOnImage && props.onImageClick) {
        console.log('Clicked on image at:', x, y);
        props.onImageClick(x, y);
        return;
      }
      
      // If we have the image click handler, allow picking from any part of the canvas
      if (props.onImageClick) {
        console.log('Picking color from canvas at:', x, y);
        props.onImageClick(x, y);
        return;
      }
      
      // Only continue with image dragging if in edit mode
      // Check if click is on an image
      for (let i = imagePositions.length - 1; i >= 0; i--) {
        const imgPos = imagePositions[i];
        if (
          x >= imgPos.x && 
          x <= imgPos.x + imgPos.width && 
          y >= imgPos.y && 
          y <= imgPos.y + imgPos.height
        ) {
          setDraggingImage({
            index: i,
            isDragging: true,
            offsetX: x - imgPos.x,
            offsetY: y - imgPos.y
          });
          return;
        }
      }
    }
  };
  
  // Handle mouse move for dragging images
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!props.editMode || !draggingImage) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / canvas.width) * 100;
    const y = ((e.clientY - rect.top) / canvas.height) * 100;
    
    const newX = Math.max(0, Math.min(100 - imagePositionsRef.current[draggingImage.index].width, 
                                      x - draggingImage.offsetX));
    const newY = Math.max(0, Math.min(100 - imagePositionsRef.current[draggingImage.index].height, 
                                      y - draggingImage.offsetY));
    
    props.onImageDrag?.(draggingImage.index, newX, newY);
    
    // Update the image position locally for immediate visual feedback
    const newImagePositions = [...imagePositionsRef.current];
    newImagePositions[draggingImage.index] = {
      ...newImagePositions[draggingImage.index],
      x: newX,
      y: newY
    };
    imagePositionsRef.current = newImagePositions;
    renderJournal();
  };
  
  // Handle mouse up to stop dragging
  const handleMouseUp = () => {
    setDraggingImage(null);
  };
  
  // Handle mouse leave to stop dragging
  const handleMouseLeave = () => {
    setDraggingImage(null);
  };

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
              margin: '0 auto'
            }}
            whileHover={{ boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            onClick={props.editMode ? exportUltraHDPDF : undefined}
          />
        </>
      )}
    </div>
  );
};

export default JournalCanvas; 