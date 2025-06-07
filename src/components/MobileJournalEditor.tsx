import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import JournalCanvas, { JournalCanvasHandle } from './JournalCanvas';
import JournalEnhancer from './JournalEnhancer';
import 'react-datepicker/dist/react-datepicker.css';
import DatePicker from 'react-datepicker';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faLocationDot, 
  faCamera, 
  faPencil,
  faImage,
  faDownload,
  faPlus,
  faTimes,
  faCheck,
  faPalette,
  faMagic,
  faHeart,
  faShare,
  faCalendarAlt,
  faChevronUp,
  faChevronDown,
  faGripVertical,
  faStar,
  faBars,
  faGift,
  faBook
} from '@fortawesome/free-solid-svg-icons';
import SimpleColorPicker from './TempColorPicker';
import LayoutToggle from './LayoutToggle';
import { toast } from 'react-toastify';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface MobileJournalEditorProps {
  onUpdate: (data: {
    date: Date;
    location: string;
    images: (string | Blob)[];
    textSections: string[];
  }) => void;
  initialData?: {
    date?: Date;
    location?: string;
    images?: (string | Blob)[];
    textSections?: string[];
  };
}

type EditMode = 'view' | 'location' | 'text' | 'image' | 'color' | 'ai';

// --- COLOR EXTRACTION UTILS (from TempColorPicker) ---
function getShadowColor(color: string, darknessLevel: number = 0.7): string {
  try {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const newR = Math.floor(r * darknessLevel);
    const newG = Math.floor(g * darknessLevel);
    const newB = Math.floor(b * darknessLevel);
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  } catch {
    return '#333333';
  }
}
function rgbToHsl(r: number, g: number, b: number): { h: number, s: number, l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}
function hslToRgb(h: number, s: number, l: number): { r: number, g: number, b: number } {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}
function getDefaultColors(count: number = 12): string[] {
  const defaultPalette = [
    '#E74C3C', '#3498DB', '#2ECC71', '#F1C40F', '#9B59B6', '#E67E22', '#1ABC9C', '#34495E', '#CB4335', '#16A085', '#8E44AD', '#D35400', '#27AE60', '#2980B9', '#F39C12', '#7D3C98', '#C0392B', '#196F3D', '#A569BD', '#5DADE2'
  ];
  return defaultPalette.slice(0, count);
}
function sortColorsByHue(colors: string[]): string[] {
  return [...colors].sort((a, b) => {
    const aRGB = { r: parseInt(a.slice(1, 3), 16), g: parseInt(a.slice(3, 5), 16), b: parseInt(a.slice(5, 7), 16) };
    const bRGB = { r: parseInt(b.slice(1, 3), 16), g: parseInt(b.slice(3, 5), 16), b: parseInt(b.slice(5, 7), 16) };
    const aHSL = rgbToHsl(aRGB.r, aRGB.g, aRGB.b);
    const bHSL = rgbToHsl(bRGB.r, bRGB.g, bRGB.b);
    return aHSL.h - bHSL.h;
  });
}
async function extractColorsFromImages(imageUrls: (string | Blob)[]): Promise<string[]> {
  const allColorCandidates: { hex: string, hsl: { h: number, s: number, l: number }, rgb: { r: number, g: number, b: number } }[] = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const imageUrl = imageUrls[i];
    if (!imageUrl) continue;
    await new Promise<void>((resolve) => {
      const img = new window.Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 150;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve();
        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size).data;
        const gridStep = Math.floor(size / 20);
        for (let y = gridStep; y < size; y += gridStep) {
          for (let x = gridStep; x < size; x += gridStep) {
            const point = (y * size + x) * 4;
            const r = imageData[point];
            const g = imageData[point + 1];
            const b = imageData[point + 2];
            const a = imageData[point + 3];
            if (a < 128) continue;
            const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            const hsl = rgbToHsl(r, g, b);
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            if (brightness > 30 && brightness < 230 && hsl.s > 15 && hsl.l > 15 && hsl.l < 85) {
              allColorCandidates.push({ hex, hsl, rgb: { r, g, b } });
            }
          }
        }
        resolve();
      };
      img.onerror = () => resolve();
      img.src = typeof imageUrl === 'string' ? imageUrl : URL.createObjectURL(imageUrl);
    });
  }
  if (allColorCandidates.length === 0) return getDefaultColors(12);
  return createDiversePalette(allColorCandidates, 12);
}
function createDiversePalette(
  candidates: {hex: string, hsl: {h: number, s: number, l: number}, rgb: {r: number, g: number, b: number}}[],
  paletteSize: number
): string[] {
  type Candidate = { hex: string, hsl: { h: number, s: number, l: number }, rgb: { r: number, g: number, b: number } };
  if (candidates.length === 0) return getDefaultColors(paletteSize);
  const HUE_SEGMENTS = [
    { name: 'reds', min: 355, max: 10 },
    { name: 'oranges', min: 10, max: 45 },
    { name: 'yellows', min: 45, max: 70 },
    { name: 'yellowGreens', min: 70, max: 100 },
    { name: 'greens', min: 100, max: 150 },
    { name: 'teals', min: 150, max: 195 },
    { name: 'cyans', min: 195, max: 220 },
    { name: 'blues', min: 220, max: 260 },
    { name: 'purples', min: 260, max: 290 },
    { name: 'magentas', min: 290, max: 330 },
    { name: 'pinkReds', min: 330, max: 355 }
  ];
  const uniqueColors = Array.from(new Map(candidates.map(c => [c.hex, c])).values());
  const segmentedColors: { [key: string]: Candidate[] } = {};
  HUE_SEGMENTS.forEach(segment => { segmentedColors[segment.name] = []; });
  uniqueColors.forEach(color => {
    let h = color.hsl.h;
    if (color.hsl.l < 15 || color.hsl.l > 85) return;
    if (color.hsl.s < 15) return;
    for (const segment of HUE_SEGMENTS) {
      if (segment.min > segment.max) {
        if (h >= segment.min || h <= segment.max) { segmentedColors[segment.name].push(color); break; }
      } else if (h >= segment.min && h <= segment.max) { segmentedColors[segment.name].push(color); break; }
    }
  });
  const representatives: Candidate[] = [];
  Object.entries(segmentedColors).forEach(([segmentName, colors]) => {
    if (colors.length === 0) return;
    colors.sort((a, b) => b.hsl.s - a.hsl.s);
    representatives.push(colors[0]);
    if (colors.length > 3) {
      const remainingColors = colors.slice(1);
      remainingColors.sort((a, b) => {
        const lightnessDiffA = Math.abs(a.hsl.l - colors[0].hsl.l);
        const lightnessDiffB = Math.abs(b.hsl.l - colors[0].hsl.l);
        return lightnessDiffB - lightnessDiffA;
      });
      if (remainingColors.length > 0 && Math.abs(remainingColors[0].hsl.l - colors[0].hsl.l) > 30) {
        representatives.push(remainingColors[0]);
      }
    }
  });
  const selectedColors: { hex: string, rgb: { r: number, g: number, b: number } }[] = [];
  representatives.sort((a, b) => b.hsl.s - a.hsl.s);
  if (representatives.length > 0) {
    selectedColors.push({ hex: representatives[0].hex, rgb: representatives[0].rgb });
  }
  const MINIMUM_DIFFERENCE = 120;
  while (selectedColors.length < paletteSize && representatives.length > 0) {
    let bestIndex = -1;
    let maxMinDistance = -1;
    for (let i = 0; i < representatives.length; i++) {
      const candidate = representatives[i];
      if (selectedColors.some(c => c.hex === candidate.hex)) continue;
      let minDistance = Number.MAX_VALUE;
      for (const selected of selectedColors) {
        const distance = Math.sqrt(
          Math.pow(candidate.rgb.r - selected.rgb.r, 2) +
          Math.pow(candidate.rgb.g - selected.rgb.g, 2) +
          Math.pow(candidate.rgb.b - selected.rgb.b, 2)
        );
        minDistance = Math.min(minDistance, distance);
      }
      if (minDistance > maxMinDistance) {
        maxMinDistance = minDistance;
        bestIndex = i;
      }
    }
    if (bestIndex !== -1 && maxMinDistance >= MINIMUM_DIFFERENCE) {
      selectedColors.push({ hex: representatives[bestIndex].hex, rgb: representatives[bestIndex].rgb });
      representatives.splice(bestIndex, 1);
    } else {
      if (bestIndex !== -1) { representatives.splice(bestIndex, 1); }
      else { break; }
    }
  }
  if (selectedColors.length < paletteSize) {
    const defaultColors = getDefaultColors(paletteSize * 2);
    const needed = paletteSize - selectedColors.length;
    const filteredDefaults = defaultColors.filter(defaultColor => {
      const r = parseInt(defaultColor.slice(1, 3), 16);
      const g = parseInt(defaultColor.slice(3, 5), 16);
      const b = parseInt(defaultColor.slice(5, 7), 16);
      return !selectedColors.some(selected => {
        const diff = Math.sqrt(
          Math.pow(r - selected.rgb.r, 2) +
          Math.pow(g - selected.rgb.g, 2) +
          Math.pow(b - selected.rgb.b, 2)
        );
        return diff < MINIMUM_DIFFERENCE;
      });
    });
    selectedColors.push(...filteredDefaults.slice(0, needed).map(hex => ({ hex, rgb: { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) } })));
  }
  return selectedColors.map(c => c.hex).slice(0, paletteSize);
}
// --- END COLOR UTILS ---

// --- IMAGE COMPRESSION UTILITIES ---
interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeKB?: number;
  format?: 'jpeg' | 'webp' | 'png';
}

async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<{ blob: Blob; wasCompressed: boolean; originalSize: number; newSize: number }> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.85,
    maxSizeKB = 1024, // 1MB default
    format = 'jpeg'
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { 
          // Performance optimizations for stickers
          alpha: format === 'png',
          desynchronized: true,
          powerPreference: 'high-performance'
        }) as CanvasRenderingContext2D | null;
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;
        const aspectRatio = width / height;

        if (width > maxWidth) {
          width = maxWidth;
          height = width / aspectRatio;
        }
        if (height > maxHeight) {
          height = maxHeight;
          width = height * aspectRatio;
        }

        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;

        // Optimize rendering for both speed and quality
        ctx.imageSmoothingEnabled = true;
        if (maxWidth <= 800 && maxHeight <= 800 && format === 'png') {
          // For stickers, use high quality since we're optimizing elsewhere
          ctx.imageSmoothingQuality = 'high';
        } else {
          // For large photos, use high quality
          ctx.imageSmoothingQuality = 'high';
        }

        // Draw image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob with compression
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            const originalSize = file.size;
            const newSize = blob.size;
            const wasCompressed = newSize < originalSize;

            // For stickers, accept larger files to maintain quality
            const sizeLimit = maxWidth <= 800 && format === 'png' ? maxSizeKB * 2 : maxSizeKB;

            // If still too large, try with lower quality (but only once for speed)
            if (newSize > sizeLimit * 1024 && quality > 0.85) {
              // Minimal quality reduction to preserve quality
              const lowerQuality = Math.max(0.85, quality - 0.1);
              compressImage(file, { ...options, quality: lowerQuality })
                .then(resolve)
                .catch(reject);
              return;
            }

            resolve({
              blob,
              wasCompressed,
              originalSize,
              newSize
            });
          },
          format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg',
          format === 'png' ? undefined : quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    
    // Create object URL and revoke immediately after load for memory efficiency
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    
    // Clean up object URL after a brief delay
    setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
  });
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function smartImageResize(
  file: File,
  targetType: 'sticker' | 'photo' = 'photo'
): Promise<{ blob: Blob; compressionInfo: string }> {
  const isSticker = targetType === 'sticker';
  
  const options: CompressionOptions = isSticker
    ? {
        maxWidth: 800,   // Smaller for stickers
        maxHeight: 800,
        quality: 0.9,    // Higher quality for stickers (they're usually smaller)
        maxSizeKB: 1024, // 1MB for stickers
        format: 'png'    // PNG for stickers to preserve transparency
      }
    : {
        maxWidth: 1920,  // Larger for photos
        maxHeight: 1920,
        quality: 0.85,   // Good quality for photos
        maxSizeKB: 2048, // 2MB for photos
        format: 'jpeg'   // JPEG for photos (better compression)
      };

  const result = await compressImage(file, options);
  
  let compressionInfo = '';
  if (result.wasCompressed) {
    const savings = ((result.originalSize - result.newSize) / result.originalSize * 100).toFixed(1);
    compressionInfo = `Compressed: ${formatFileSize(result.originalSize)} → ${formatFileSize(result.newSize)} (${savings}% smaller)`;
  } else {
    compressionInfo = `Original size: ${formatFileSize(result.originalSize)}`;
  }

  return {
    blob: result.blob,
    compressionInfo
  };
}
// --- END IMAGE COMPRESSION UTILITIES ---

// Optimized Text Input Component
const OptimizedTextInput = memo(({ 
  initialValue, 
  onUpdateComplete 
}: { 
  initialValue: string, 
  onUpdateComplete: (text: string) => void 
}) => {
  const [localText, setLocalText] = useState(initialValue);
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setLocalText(initialValue);
  }, [initialValue]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setLocalText(newText);
    
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      onUpdateComplete(newText);
    }, 300);
  };

  return (
    <textarea
      value={localText}
      onChange={handleChange}
      placeholder="Start writing..."
      className="w-full p-3 border border-gray-200 rounded-xl focus:border-gray-400 focus:outline-none resize-none min-h-[80px] text-gray-900 placeholder-gray-400"
      style={{
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        lineHeight: '1.5',
        direction: 'ltr',
        textAlign: 'left',
        unicodeBidi: 'normal',
        writingMode: 'horizontal-tb',
        textOrientation: 'mixed',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        perspective: '1000',
        WebkitFontSmoothing: 'antialiased',
        WebkitAppearance: 'none',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'none',
        maxHeight: '100px',
        willChange: 'transform',
        isolation: 'isolate',
      }}
      autoFocus={true}
      dir="ltr"
      lang="en"
      spellCheck={false}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="sentences"
      inputMode="text"
      enterKeyHint="enter"
      data-gramm="false" // Disable Grammarly
      data-enable-grammarly="false"
    />
  );
});

OptimizedTextInput.displayName = 'OptimizedTextInput';

const MobileJournalEditor: React.FC<MobileJournalEditorProps> = ({ onUpdate, initialData }) => {
  // Core data states - ensure we always start with today's date unless provided
  const [date, setDate] = useState<Date>(() => {
    if (initialData?.date) {
      return initialData.date;
    }
    // Always use the current date as default
    return new Date();
  });
  const [location, setLocation] = useState(initialData?.location || '');
  const [images, setImages] = useState<(string | Blob)[]>(initialData?.images || []);
  const [textSections, setTextSections] = useState<string[]>(initialData?.textSections || ['']);
  
  // UI states
  const [editMode, setEditMode] = useState<EditMode>('view');
  const [activeTextIndex, setActiveTextIndex] = useState<number>(0);
  const [showControls, setShowControls] = useState(true);
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  
  // Local editing states to prevent flickering
  const [localTextSections, setLocalTextSections] = useState<string[]>([]);
  const [localLocation, setLocalLocation] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Animation states
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Color and layout states
  const [textColors, setTextColors] = useState({
    locationColor: '#3498DB',
    locationShadowColor: '#AED6F1'
  });
  const [layoutMode, setLayoutMode] = useState<'standard' | 'mirrored'>('standard');
  
  // Refs
  const journalCanvasRef = useRef<JournalCanvasHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);
  
  // Auto-hide controls on scroll
  const [lastScrollY, setLastScrollY] = useState(0);
  
  // Add state for which edit tab is open - default to date tab
  const [activeEditTab, setActiveEditTab] = useState<'none' | 'write' | 'location' | 'format' | 'date' | 'stickers'>('date');
  
  // Zoom state for precise sticker placement
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  
  // Simple state for writing mode
  const [isWriting, setIsWriting] = useState(false);
  const hiddenTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Add state for location editing mode
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const locationTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Cursor tracking states for visual feedback
  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const [locationCursorPosition, setLocationCursorPosition] = useState<number>(0);
  const [showCursor, setShowCursor] = useState(false);
  const [cursorBlink, setCursorBlink] = useState(true);
  const [forceUpdate, setForceUpdate] = useState(0);

  // Cursor blinking effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (showCursor) {
      // Blink cursor every 500ms
      intervalId = setInterval(() => {
        setCursorBlink(prev => !prev);
      }, 500);
    } else {
      setCursorBlink(true); // Reset to visible when not showing
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [showCursor]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setShowControls(false);
      } else {
        setShowControls(true);
      }
      setLastScrollY(currentScrollY);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Haptic feedback for supported devices
  const hapticFeedback = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    if ('vibrate' in navigator) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30]
      };
      navigator.vibrate(patterns[type]);
    }
  }, []);

  // Clean image upload without toast notifications
  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    hapticFeedback('medium');
    
    try {
      const currentImages = [...images];
      const availableSlots = 3 - currentImages.length;
      const filesToProcess = Array.from(files).slice(0, availableSlots);
      
      // Process images one by one with smart compression
      const processedImages: string[] = [];
      
      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        
        // Check file type
        if (!file.type.startsWith('image/')) {
          continue;
        }
        
        try {
          // Smart compression for photos
          const { blob } = await smartImageResize(file, 'photo');
          
          // Convert compressed blob to data URL for images
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              if (e.target?.result) {
                resolve(e.target.result as string);
              } else {
                reject(new Error('Failed to read compressed image'));
              }
            };
            reader.onerror = () => reject(new Error('FileReader error'));
            reader.readAsDataURL(blob);
          });
          
          processedImages.push(dataUrl);
          
        } catch (imageError) {
          // Fail silently for cleaner experience
          console.warn(`Failed to process image ${i + 1}:`, imageError);
        }
      }
      
      if (processedImages.length > 0) {
        // Update state with processed images
        const newImages: (string | Blob)[] = [...currentImages, ...processedImages];
        setImages(newImages);
        onUpdate({ date, location, images: newImages, textSections });
        
        // Show brief success animation only
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 800);
      }
      
    } catch (error) {
      console.error('Error uploading images:', error);
      // Only show error toast for critical failures
      toast.error('Failed to add photos', {
        autoClose: 2000,
        style: { 
          background: '#dc2626',
          color: 'white',
          borderRadius: '8px',
          fontSize: '12px',
          padding: '8px 12px'
        }
      });
    } finally {
      event.target.value = '';
    }
  }, [images, date, location, textSections, onUpdate, hapticFeedback]);

  // GOODNOTES-STYLE sticker upload - Original quality preserved
  const handleStickerUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    // INSTANT haptic feedback
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(5);
      }
      hapticFeedback('light');
    } catch { /* Silent fail */ }
    
    // INSTANT visual feedback
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 200);
    
    // Convert FileList to Array and filter for images only
    const filesToProcess = Array.from(files).filter(file => file.type.startsWith('image/'));
    
    // GOODNOTES APPROACH: No compression, no processing, just pass the original files
    if (journalCanvasRef.current) {
      if (filesToProcess.length === 1) {
        // Single sticker - pass original File object directly
        journalCanvasRef.current.addSticker(filesToProcess[0]);
      } else if (filesToProcess.length > 1) {
        // Multiple stickers - pass original File objects directly
        journalCanvasRef.current.addMultipleStickers(filesToProcess);
      }
    }
    
    // IMMEDIATE cleanup
    event.target.value = '';
  }, [hapticFeedback]);

  // Initialize local states when entering edit mode
  useEffect(() => {
    if (editMode === 'text') {
      setLocalTextSections([...textSections]);
    } else if (editMode === 'location') {
      setLocalLocation(location);
    }
  }, [editMode, textSections, location]);

  // Save changes when exiting edit mode
  const exitEditMode = useCallback(() => {
    if (editMode === 'text') {
      setTextSections(localTextSections);
      onUpdate({ date, location, images, textSections: localTextSections });
    } else if (editMode === 'location') {
      setLocation(localLocation);
      onUpdate({ date, location: localLocation, images, textSections });
    }
    setEditMode('view');
  }, [editMode, localTextSections, localLocation, date, images, textSections, onUpdate]);

  // EXACT COPY of working desktop exportUltraHDPDF function
  const handleDownload = useCallback(async () => {
    if (!journalCanvasRef.current) {
      toast.error('Could not find journal canvas');
      return;
    }

    setIsLoading(true);
    hapticFeedback('heavy');
    
    const toastId = toast.loading('Creating Ultra-HD PDF...', {
      position: 'bottom-center',
      style: { 
        background: '#1a1a1a',
        color: 'white',
        borderRadius: '12px',
        fontSize: '14px',
        padding: '12px 20px'
      }
    });

    try {
      // Force canvas to render at maximum quality before export
      setForceUpdate(prev => prev + 1);
      // Wait for the high-quality render to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get the canvas element directly - no html2canvas needed since we already have a canvas
      const canvasElement = document.querySelector('#journal-canvas') as HTMLCanvasElement;
      if (!canvasElement) {
        throw new Error('Canvas element not found');
      }

      // Get PNG data directly from the canvas at maximum quality
      const pngData = canvasElement.toDataURL('image/png', 1.0);
      
      // Create PDF with canvas dimensions directly
      const pdf = new jsPDF(
        'portrait', 
        'px', 
        [canvasElement.width, canvasElement.height],
        false // No compression
      );
      
      // Add the image to the PDF at maximum resolution
      pdf.addImage(
        pngData,
        'PNG', // Explicitly specify PNG format
        0,
        0,
        pdf.internal.pageSize.getWidth(),
        pdf.internal.pageSize.getHeight(),
        `journal-${Date.now()}`, // Unique alias to prevent caching issues
        'NONE' // No compression for maximum quality
      );

      const filename = `journal-${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(filename);

      toast.dismiss(toastId);
      toast.success('Ultra-HD Journal saved successfully', {
        position: 'bottom-center',
        style: { 
          background: '#1a1a1a',
          color: 'white',
          borderRadius: '12px',
          fontSize: '14px',
          padding: '12px 20px'
        }
      });
      
    } catch (error) {
      console.error('Error creating PDF:', error);
      toast.dismiss(toastId);
      toast.error(`Error: ${error instanceof Error ? error.message : 'Could not create PDF'}`);
    } finally {
      setIsLoading(false);
    }
  }, [hapticFeedback]);

  // Gesture handlers for image reordering
  const handleImageDrag = useCallback((index: number, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 50) {
      setDraggedImageIndex(index);
      hapticFeedback('light');
    }
  }, [hapticFeedback]);

  const handleImageDragEnd = useCallback((index: number, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 100) {
      // Reorder images
      const newImages = [...images];
      const draggedImage = newImages[index];
      newImages.splice(index, 1);
      
      if (info.offset.x > 0 && index < images.length - 1) {
        newImages.splice(index + 1, 0, draggedImage);
      } else if (info.offset.x < 0 && index > 0) {
        newImages.splice(index - 1, 0, draggedImage);
      } else {
        newImages.splice(index, 0, draggedImage);
      }
      
      setImages(newImages);
      onUpdate({ date, location, images: newImages, textSections });
      hapticFeedback('medium');
    }
    setDraggedImageIndex(null);
  }, [images, date, location, textSections, onUpdate, hapticFeedback]);

  // Add function to handle pencil button click
  const handlePencilClick = useCallback(() => {
    // Set all states immediately for instant cursor visibility
    const currentText = textSections[0] || '';
    
    setIsWriting(true);
    setActiveEditTab('write');
    setShowCursor(true);
    setCursorBlink(true); // Start with cursor visible
    setCursorPosition(currentText.length);
    
    // Force immediate re-render of the canvas to show cursor
    setForceUpdate(prev => prev + 1);
    
    // Focus the hidden textarea - but cursor should already be visible
    setTimeout(() => {
      if (hiddenTextareaRef.current) {
        hiddenTextareaRef.current.focus();
        // Set cursor to end of text
        hiddenTextareaRef.current.setSelectionRange(currentText.length, currentText.length);
        setCursorPosition(currentText.length);
        
        // Additional iOS keyboard trigger if needed
        if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
          hiddenTextareaRef.current.click();
        }
      }
    }, 50); // Reduced timeout for faster response
    
    hapticFeedback('light');
  }, [hapticFeedback, textSections]);

  // Handle text input changes
  const handleTextChange = useCallback((newText: string) => {
    const newTextSections = [newText]; // Just use one text section for simplicity
    setTextSections(newTextSections);
    onUpdate({ date, location, images, textSections: newTextSections });
    
    // Update cursor position
    if (hiddenTextareaRef.current) {
      setCursorPosition(hiddenTextareaRef.current.selectionStart || 0);
    }
  }, [date, location, images, onUpdate]);

  // Close writing mode
  const closeWriting = useCallback(() => {
    setIsWriting(false);
    setActiveEditTab('none');
    setShowCursor(false);
    if (hiddenTextareaRef.current) {
      hiddenTextareaRef.current.blur();
    }
  }, []);

  // Add function to handle location area click
  const handleLocationClick = useCallback(() => {
    setIsEditingLocation(true);
    setActiveEditTab('location');
    setShowCursor(true);
    setCursorBlink(true); // Start with cursor visible
    
    // Set cursor position immediately to end of existing location text
    setLocationCursorPosition(location.length);
    
    // Focus the hidden location textarea
    setTimeout(() => {
      if (locationTextareaRef.current) {
        locationTextareaRef.current.focus();
        // Set cursor to end of location text
        locationTextareaRef.current.setSelectionRange(location.length, location.length);
        setLocationCursorPosition(location.length);
        
        // Additional iOS keyboard trigger if needed
        if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
          locationTextareaRef.current.click();
        }
      }
    }, 100);
    
    hapticFeedback('light');
  }, [hapticFeedback, location]);

  // Handle location text input changes
  const handleLocationChange = useCallback((newLocation: string) => {
    setLocation(newLocation.toUpperCase());
    onUpdate({ date, location: newLocation.toUpperCase(), images, textSections });
    
    // Update location cursor position
    if (locationTextareaRef.current) {
      setLocationCursorPosition(locationTextareaRef.current.selectionStart || 0);
    }
  }, [date, images, textSections, onUpdate]);

  // Close location editing mode
  const closeLocationEditing = useCallback(() => {
    setIsEditingLocation(false);
    setShowCursor(false);
    // Keep the location tab active so user can see color picker
    setActiveEditTab('location');
    if (locationTextareaRef.current) {
      locationTextareaRef.current.blur();
    }
  }, []);

  // Zoom and pan handlers for precise sticker placement
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.01;
    const newZoom = Math.min(Math.max(0.5, zoomLevel + delta), 3);
    setZoomLevel(newZoom);
  }, [zoomLevel]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch to zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      setLastPanPoint({ x: distance, y: 0 });
    } else if (e.touches.length === 1 && zoomLevel > 1) {
      // Single finger pan when zoomed
      setIsPanning(true);
      setLastPanPoint({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  }, [zoomLevel]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    
    if (e.touches.length === 2) {
      // Pinch to zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      const scale = distance / lastPanPoint.x;
      const newZoom = Math.min(Math.max(0.5, zoomLevel * scale), 3);
      setZoomLevel(newZoom);
      setLastPanPoint({ x: distance, y: 0 });
    } else if (e.touches.length === 1 && isPanning && zoomLevel > 1) {
      // Pan when zoomed
      const deltaX = e.touches[0].clientX - lastPanPoint.x;
      const deltaY = e.touches[0].clientY - lastPanPoint.y;
      setPanX(prev => prev + deltaX);
      setPanY(prev => prev + deltaY);
      setLastPanPoint({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  }, [isPanning, lastPanPoint, zoomLevel]);

  const handleTouchEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Reset zoom function
  const resetZoom = useCallback(() => {
    setZoomLevel(1);
    setPanX(0);
    setPanY(0);
  }, []);

  return (
    <div className="bg-gray-100 overflow-hidden flex flex-col ios-container mobile-no-scroll">
      {/* Global CSS fix for backwards text */}
      <style>
        {`
          /* Force normal text direction globally for this component */
          .h-screen textarea,
          .h-screen input[type="text"],
          .h-screen input,
          .h-screen * {
            direction: ltr !important;
            unicode-bidi: normal !important;
            writing-mode: horizontal-tb !important;
            text-orientation: mixed !important;
            transform: none !important;
            -webkit-transform: none !important;
            -moz-transform: none !important;
            -ms-transform: none !important;
            -o-transform: none !important;
            filter: none !important;
            -webkit-filter: none !important;
          }
          
          /* Specific overrides for text inputs */
          .text-input-fix,
          .text-input-normal,
          .location-input-normal {
            direction: ltr !important;
            text-align: left !important;
            unicode-bidi: normal !important;
            writing-mode: horizontal-tb !important;
            text-orientation: mixed !important;
            transform: none !important;
            -webkit-transform: none !important;
            -moz-transform: none !important;
            -ms-transform: none !important;
            -o-transform: none !important;
            filter: none !important;
            -webkit-filter: none !important;
            font-feature-settings: normal !important;
            text-rendering: auto !important;
            -webkit-font-feature-settings: normal !important;
            -moz-font-feature-settings: normal !important;
            caret-color: black !important;
          }
          
          /* Override any parent transforms */
          .text-input-fix *,
          .text-input-normal *,
          .location-input-normal * {
            transform: none !important;
            -webkit-transform: none !important;
            direction: ltr !important;
          }
          
          /* Placeholder text fix */
          .text-input-fix::placeholder,
          .text-input-normal::placeholder,
          .location-input-normal::placeholder {
            direction: ltr !important;
            text-align: left !important;
            unicode-bidi: normal !important;
          }
          
          /* Location input center alignment */
          .location-input-normal {
            text-align: center !important;
          }
          .location-input-normal::placeholder {
            text-align: center !important;
          }
          
          /* STICKER-OPTIMIZED MOBILE CONTAINER - Exact desktop behavior */
          .mobile-no-scroll {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            overflow: hidden !important;
            -webkit-overflow-scrolling: none !important;
            overscroll-behavior: none !important;
            touch-action: pan-x pan-y pinch-zoom !important; /* Allow pinch for sticker resize */
          }
          
          /* Disable body scrolling on mobile but preserve sticker interactions */
          @media (max-width: 768px) {
            body {
              overflow: hidden !important;
              position: fixed !important;
              width: 100% !important;
              height: 100% !important;
              -webkit-overflow-scrolling: none !important;
              overscroll-behavior: none !important;
            }
          }
          
          /* Keyboard-aware layout - prioritize journal visibility */
          @media (max-height: 600px) {
            .full-journal {
              height: 60vh !important;
            }
            .compact-edit-panel {
              height: 40vh !important;
            }
          }
          
          /* iPhone SE and small screens - prioritize calendar */
          @media screen and (max-height: 650px) {
            .full-journal {
              height: 35vh !important;
            }
            .compact-edit-panel {
              height: 65vh !important;
            }
          }
          
          /* Very small screens */
          @media screen and (max-height: 500px) {
            .full-journal {
              height: 30vh !important;
            }
            .compact-edit-panel {
              height: 70vh !important;
            }
          }
          
          /* Ultra-small screens */
          @media screen and (max-height: 400px) {
            .full-journal {
              height: 25vh !important;
            }
            .compact-edit-panel {
              height: 75vh !important;
            }
          }
          
          /* PERFORMANCE FIX: Prevent copy/selection on all UI elements */
          .mobile-no-scroll * {
            -webkit-user-select: none !important;
            -webkit-touch-callout: none !important;
            -webkit-tap-highlight-color: transparent !important;
            user-select: none !important;
            -webkit-user-drag: none !important;
            -webkit-appearance: none !important;
          }
          
          /* Allow text input in textareas only */
          .mobile-no-scroll textarea,
          .mobile-no-scroll input[type="text"] {
            -webkit-user-select: text !important;
            user-select: text !important;
          }
          
          /* ZOOM CONTAINER: Isolate zoom from sticker interactions */
          .zoom-container {
            position: relative;
            width: 100%;
            height: 100%;
            overflow: hidden;
          }
          
          /* HIGH PERFORMANCE: Separate static from dynamic content layers */
          .static-content-layer {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none; /* Allow stickers to be interactive above this */
            will-change: transform;
            contain: layout style paint;
          }
          
          .dynamic-sticker-layer {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: auto; /* Interactive stickers */
            will-change: transform;
            contain: layout style paint;
          }
          
          /* ULTRA SMOOTH mobile performance optimizations */
          .sticker-button {
            will-change: transform !important;
            transform: translate3d(0, 0, 0) !important;
            backface-visibility: hidden !important;
            -webkit-backface-visibility: hidden !important;
            perspective: 1000px !important;
            -webkit-perspective: 1000px !important;
            isolation: isolate !important;
            contain: layout style paint !important;
            -webkit-touch-callout: none !important;
            -webkit-user-select: none !important;
            user-select: none !important;
            -webkit-tap-highlight-color: transparent !important;
            /* Mobile specific optimizations */
            -webkit-user-drag: none !important;
            -webkit-appearance: none !important;
            pointer-events: auto !important;
            touch-action: manipulation !important;
          }
          
          .sticker-button:active {
            transform: translate3d(0, 0, 0) scale(0.98) !important;
            transition: transform 0.03s ease-out !important;
          }
          
          /* Ultra-fast file input trigger */
          .sticker-input {
            position: absolute !important;
            left: -9999px !important;
            opacity: 0 !important;
            pointer-events: none !important;
            -webkit-appearance: none !important;
            contain: strict !important;
          }
          
          /* GOODNOTES-STYLE sticker rendering on mobile */
          .mobile-no-scroll canvas {
            /* IMPROVED: Better image rendering for crisp, smooth stickers */
            image-rendering: auto !important; /* Default for smooth rendering */
            image-rendering: -webkit-optimize-contrast !important; /* Better quality on Chrome/Safari */
            image-rendering: crisp-edges !important; /* Better quality on Firefox */
            will-change: transform !important; /* GPU acceleration hint */
            transform: translateZ(0) !important;
            backface-visibility: hidden !important;
            /* Critical: Allow full touch interaction exactly like desktop */
            touch-action: none !important;
            -webkit-touch-callout: none !important;
            -webkit-user-select: none !important;
            user-select: none !important;
            -webkit-tap-highlight-color: transparent !important;
          }
          
          /* Prevent mobile scrolling interference but preserve sticker touch */
          @media (max-width: 768px) {
            .mobile-no-scroll {
              position: fixed !important;
              overflow: hidden !important;
              -webkit-overflow-scrolling: none !important;
              overscroll-behavior: none !important;
              touch-action: none !important; /* Let canvas handle all touch */
            }
          }
          
          /* iOS Keyboard Optimization */
          @supports (-webkit-touch-callout: none) {
            /* Keep layout consistent - just make tabs sticky */
            .keyboard-aware {
              position: relative !important;
            }
            
            .sticky-tabs {
              position: sticky !important;
              top: 0 !important;
              z-index: 1000 !important;
              background: white !important;
              border-bottom: 1px solid #f3f4f6 !important;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
            }
            
            /* Ensure tab content is scrollable when keyboard appears */
            .keyboard-aware .flex-1 {
              overflow-y: auto !important;
              -webkit-overflow-scrolling: touch !important;
            }
            
            /* Small viewport adjustments - minimal changes */
            @media screen and (max-height: 600px) {
              .full-journal {
                height: 60vh !important;
              }
              .compact-edit-panel {
                height: 40vh !important;
              }
            }
            
            /* iPhone-specific minor adjustments */
            @media screen and (max-height: 750px) and (max-width: 430px) {
              .full-journal {
                height: 55vh !important;
              }
              .compact-edit-panel {
                height: 45vh !important;
              }
            }
          }
          
          /* Force body to use dynamic viewport units on iOS */
          @supports (-webkit-touch-callout: none) {
            body {
              height: 100dvh !important;
            }
          }
          
          /* iOS Container with proper height fallbacks */
          .ios-container {
            height: 100vh;
            height: 100dvh;
          }
        `}
      </style>

      {/* Ultra-Compact Header */}
      <div className="bg-white py-0 px-3 flex-shrink-0 border-b border-gray-200" style={{ minHeight: '24px' }}>
        <div className="flex items-center justify-between h-6">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            {zoomLevel !== 1 && (
              <button
                onClick={resetZoom}
                className="text-xs text-blue-600 bg-blue-50 px-1 py-0.5 rounded"
                style={{
                  WebkitUserSelect: 'none',
                  WebkitTouchCallout: 'none',
                  WebkitTapHighlightColor: 'transparent',
                  userSelect: 'none',
                  touchAction: 'manipulation'
                }}
              >
                {Math.round(zoomLevel * 100)}%
              </button>
            )}
          </div>
          
          <button
            onClick={handleDownload}
            disabled={isLoading}
            className="text-gray-700 p-0.5 rounded-lg hover:bg-gray-100 transition-colors"
            style={{
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
              WebkitTapHighlightColor: 'transparent',
              userSelect: 'none',
              touchAction: 'manipulation'
            }}
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full"
              />
            ) : (
              <FontAwesomeIcon icon={faDownload} className="text-xs" />
            )}
          </button>
        </div>
      </div>

      {/* Journal View with iOS Keyboard Optimization */}
      <div className={`flex-1 flex flex-col min-h-0 bg-white`}>
        {/* Journal Section - Always visible with default content */}
        <div className="full-journal" style={{ height: '68vh' }}>
          <div className="h-full p-2">
            <div 
              className="zoom-container bg-white rounded-xl shadow-md border border-gray-200"
              style={{ aspectRatio: '1240/1748' }}
              onWheel={handleWheel}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative w-full h-full overflow-hidden"
                style={{ 
                  transform: `scale(${zoomLevel}) translate(${panX / zoomLevel}px, ${panY / zoomLevel}px)`,
                  transformOrigin: 'center center',
                  transition: isPanning ? 'none' : 'transform 0.2s ease-out'
                }}
              >
                <JournalCanvas
                  ref={journalCanvasRef}
                  date={date}
                  location={location}
                  images={images}
                  textSections={textSections}
                  editMode={true}
                  templateUrl="/templates/goodnotes-a6-yellow.jpg"
                  textColors={textColors}
                  layoutMode={layoutMode}
                  onNewEntry={() => {}}
                  showCursor={showCursor}
                  cursorVisible={cursorBlink && (isWriting || isEditingLocation)}
                  cursorPosition={isEditingLocation 
                    ? { isLocation: true, characterIndex: locationCursorPosition }
                    : { textAreaIndex: 0, characterIndex: cursorPosition }
                  }
                  forceUpdate={forceUpdate}
                />
              
              {/* Interactive overlay */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Location tap area */}
                <div
                  className="absolute top-[5%] left-0 right-0 h-[6%] pointer-events-auto cursor-pointer"
                  onClick={handleLocationClick}
                />
              </div>
              
              {/* Hidden textarea for writing mode */}
              {isWriting && (
                <textarea
                  ref={hiddenTextareaRef}
                  value={textSections[0] || ''}
                  onChange={(e) => handleTextChange(e.target.value)}
                  onBlur={closeWriting}
                  onKeyUp={(e) => {
                    // Update cursor position on key events
                    setCursorPosition(e.currentTarget.selectionStart || 0);
                  }}
                  onMouseUp={(e) => {
                    // Update cursor position on mouse clicks
                    setCursorPosition(e.currentTarget.selectionStart || 0);
                  }}
                  onSelect={(e) => {
                    // Update cursor position on text selection
                    setCursorPosition(e.currentTarget.selectionStart || 0);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 pointer-events-auto resize-none bg-transparent"
                  style={{
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '16px', // Prevent zoom on iOS
                    direction: 'ltr',
                    textAlign: 'left',
                    unicodeBidi: 'normal',
                    writingMode: 'horizontal-tb',
                    transform: 'translateZ(0)', // Hardware acceleration
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    WebkitTransform: 'translateZ(0)',
                  }}
                  placeholder="Start writing..."
                  autoFocus
                  dir="ltr"
                  lang="en"
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="sentences"
                  inputMode="text"
                  enterKeyHint="enter"
                  data-gramm="false" // Disable Grammarly
                  data-enable-grammarly="false"
                />
              )}
              
              {/* Hidden textarea for location editing */}
              {isEditingLocation && (
                <textarea
                  ref={locationTextareaRef}
                  value={location}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  onBlur={closeLocationEditing}
                  onKeyUp={(e) => {
                    // Update location cursor position on key events
                    setLocationCursorPosition(e.currentTarget.selectionStart || 0);
                  }}
                  onMouseUp={(e) => {
                    // Update location cursor position on mouse clicks
                    setLocationCursorPosition(e.currentTarget.selectionStart || 0);
                  }}
                  onSelect={(e) => {
                    // Update location cursor position on text selection
                    setLocationCursorPosition(e.currentTarget.selectionStart || 0);
                  }}
                  className="absolute top-[5%] left-0 right-0 h-[6%] opacity-0 pointer-events-auto resize-none bg-transparent text-center"
                  style={{
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '16px', // Prevent zoom on iOS
                    direction: 'ltr',
                    textAlign: 'center',
                    unicodeBidi: 'normal',
                    writingMode: 'horizontal-tb',
                    transform: 'translateZ(0)', // Hardware acceleration
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    WebkitTransform: 'translateZ(0)',
                  }}
                  placeholder="Location..."
                  autoFocus
                  dir="ltr"
                  lang="en"
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  inputMode="text"
                  enterKeyHint="done"
                  data-gramm="false"
                  data-enable-grammarly="false"
                />
              )}
            </motion.div>
          </div>
        </div>
      </div>

        {/* Integrated Control Panel - Smaller height */}
        <div className={`compact-edit-panel bg-white flex-shrink-0 ${isWriting ? 'keyboard-aware' : ''}`} style={{ height: '32vh' }}>
          {/* Ultra-Compact Tab Bar */}
          <div className={`flex items-center h-8 px-2 border-b border-gray-100 ${isWriting ? 'sticky-tabs' : ''}`}>
            <div className="flex w-full bg-white rounded-lg p-0.5">
              <button
                className={`flex-1 h-6 flex items-center justify-center font-medium text-xs rounded-md transition-all duration-200 ${activeEditTab === 'date' ? 'bg-gray-300 text-black' : 'text-black hover:bg-gray-100'}`}
                onClick={() => setActiveEditTab('date')}
              >
                <FontAwesomeIcon icon={faCalendarAlt} className="text-sm" />
              </button>
              <button
                className={`flex-1 h-6 flex items-center justify-center font-medium text-xs rounded-md transition-all duration-200 text-black hover:bg-gray-100`}
                onClick={() => {
                  if (fileInputRef.current) fileInputRef.current.click();
                }}
              >
                <FontAwesomeIcon icon={faCamera} className="text-sm" />
              </button>
              <button
                className={`flex-1 h-6 flex items-center justify-center font-medium text-xs rounded-md transition-all duration-200 ${activeEditTab === 'location' ? 'bg-gray-300 text-black' : 'text-black hover:bg-gray-100'}`}
                onClick={handleLocationClick}
              >
                <FontAwesomeIcon icon={faLocationDot} className="text-sm" />
              </button>
              <button
                className={`flex-1 h-6 flex items-center justify-center font-medium text-xs rounded-md transition-all duration-200 text-black hover:bg-gray-100 sticker-button`}
                onClick={() => {
                  // Direct camera roll access with desktop-quality processing
                  hapticFeedback('light');
                  if (stickerInputRef.current) {
                    stickerInputRef.current.click();
                  }
                }}
              >
                <FontAwesomeIcon icon={faGift} className="text-sm" />
              </button>
              <button
                className={`flex-1 h-6 flex items-center justify-center font-medium text-xs rounded-md transition-all duration-200 ${activeEditTab === 'write' ? 'bg-gray-300 text-black' : 'text-black hover:bg-gray-100'}`}
                onClick={handlePencilClick}
              >
                <FontAwesomeIcon icon={faPencil} className="text-sm" />
              </button>
            </div>
          </div>

          {/* Control Content */}
          <div className="flex-1 overflow-hidden">
            {activeEditTab === 'date' && (
              <div className="h-full w-full flex items-start justify-center p-0 overflow-y-auto overflow-x-hidden">
                <div className="w-full h-auto max-w-full mt-1 overflow-hidden">
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden relative">
                    {/* Calendar header video background */}
                    <div className="absolute top-0 left-0 right-0 h-12 overflow-hidden rounded-t-lg z-0">
                      <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover opacity-20"
                        style={{ filter: 'contrast(3) brightness(0.3) grayscale(1)' }}
                      >
                        <source src="/background/static.webm" type="video/webm" />
                      </video>
                    </div>
                    <DatePicker
                      selected={date}
                      onChange={(newDate: Date | null) => {
                        if (newDate) {
                          setDate(newDate);
                          onUpdate({ date: newDate, location, images, textSections });
                          // Auto-close after selection
                          setActiveEditTab('none');
                          hapticFeedback('medium');
                        }
                      }}
                      inline
                      showPopperArrow={false}
                      calendarClassName="compact-calendar"
                      fixedHeight={true}
                      showWeekNumbers={false}
                      monthsShown={1}
                      peekNextMonth={true}
                      openToDate={date}
                      todayButton="Today"
                      disabledKeyboardNavigation={true}
                      shouldCloseOnSelect={false}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {activeEditTab === 'location' && (
              <div className="h-full flex flex-col justify-center items-center gap-8 overflow-hidden p-6">
                <h3 className="text-lg font-semibold text-gray-900 text-center">Title Color</h3>
                
                {/* Color Picker - Much more space */}
                <div className="w-full bg-gray-50 rounded-lg p-4 overflow-y-auto">
                  <SimpleColorPicker
                    colors={textColors}
                    onChange={newColors => {
                      setTextColors(newColors);
                      onUpdate({ date, location, images, textSections });
                    }}
                    images={images}
                    compact={true}
                  />
                </div>
              </div>
            )}
            

            {activeEditTab === 'write' && (
              <div className="h-full flex items-center justify-center p-3 bg-white">
                <div className="text-center">
                  <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mb-4 mx-auto">
                    <FontAwesomeIcon icon={faPencil} className="text-white text-xl" />
                  </div>
                  <h3 className="text-lg font-semibold text-black mb-2">Writing Mode</h3>
                  <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                    Type and watch your words appear on the journal
                  </p>
                  <button
                    onClick={closeWriting}
                    className="px-6 py-2 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
            
            {/* Default state */}
            {activeEditTab === 'none' && (
              <div className="h-full flex items-center justify-center bg-white px-6">
                <div className="text-center max-w-sm mx-auto">
                  <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mb-6 mx-auto shadow-lg">
                    <FontAwesomeIcon icon={faBook} className="text-white text-2xl" />
                  </div>
                  <h2 className="text-2xl font-bold text-black mb-3 tracking-tight">Your Journal</h2>
                  <p className="text-base text-gray-500 leading-relaxed">
                    Use the tabs above to add content
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Success Animation */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            <div className="bg-green-500 text-white p-3 rounded-full shadow-lg">
              <FontAwesomeIcon icon={faCheck} className="text-lg" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
        multiple
      />
      
      {/* Desktop-quality sticker input */}
      <input
        ref={stickerInputRef}
        type="file"
        accept="image/*"
        className="sticker-input"
        onChange={handleStickerUpload}
        multiple
        tabIndex={-1}
        style={{ display: 'none' }}
      />
      
      {/* Clean DatePicker Styles */}
      <style>
        {`
          .react-datepicker-wrapper {
            width: 100%;
          }
          
          .react-datepicker-popper {
            z-index: 9999 !important;
          }
          
          .react-datepicker-custom {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            font-family: 'Inter', system-ui, sans-serif;
            font-size: 14px;
            overflow: hidden;
            background: white;
          }
          
          .react-datepicker__header {
            background: #f9fafb;
            border-bottom: 1px solid #e5e7eb;
            border-radius: 12px 12px 0 0;
            padding: 12px 0;
          }
          
          .react-datepicker__current-month {
            font-weight: 600;
            font-size: 16px;
            color: #374151;
            margin-bottom: 8px;
          }
          
          .react-datepicker__day-names {
            margin-bottom: 8px;
          }
          
          .react-datepicker__day-name {
            color: #6b7280;
            font-weight: 500;
            font-size: 12px;
            width: 32px;
            line-height: 32px;
          }
          
          .react-datepicker__month {
            padding: 8px;
            background: white;
          }
          
          .react-datepicker__day {
            border-radius: 8px;
            margin: 1px;
            width: 32px;
            height: 32px;
            line-height: 32px;
            color: #374151;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s ease;
          }
          
          .react-datepicker__day--selected {
            background-color: #3b82f6 !important;
            color: white;
            font-weight: 600;
          }
          
          .react-datepicker__day:hover {
            background-color: #eff6ff;
            color: #1e40af;
          }
          
          .react-datepicker__day--today {
            background-color: #f3f4f6;
            color: #374151;
            font-weight: 600;
          }
          
          .react-datepicker__navigation {
            top: 14px;
            width: 24px;
            height: 24px;
            border-radius: 6px;
            background: white;
            border: 1px solid #e5e7eb;
            transition: all 0.2s ease;
          }
          
          .react-datepicker__navigation:hover {
            background: #f9fafb;
          }
          
          .react-datepicker__navigation--previous {
            border-right-color: #6b7280;
            left: 12px;
          }
          
          .react-datepicker__navigation--next {
            border-left-color: #6b7280;
            right: 12px;
          }
          
                    /* Ultra-clean, perfectly fitted calendar - NO HORIZONTAL SCROLL */
          .compact-calendar {
            border: none !important;
            box-shadow: none !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: transparent !important;
            width: 100% !important;
            margin: 0 !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: 340px !important;
            overflow: hidden !important;
            overflow-x: hidden !important;
          }
          
          /* Force all weeks to show - increased height for 6 weeks */
          .compact-calendar .react-datepicker__month-container {
            height: auto !important;
            max-height: 340px !important;
            width: 100% !important;
            max-width: 100% !important;
            overflow: hidden !important;
          }
          
          .compact-calendar .react-datepicker__header {
            background: #000000;
            border: none;
            border-radius: 8px 8px 0 0;
            padding: 8px 0;
            position: relative;
            overflow: hidden;
          }
          
          .compact-calendar .react-datepicker__current-month {
            font-weight: 700;
            font-size: 14px;
            color: white;
            margin-bottom: 0;
            text-shadow: 0 1px 3px rgba(0,0,0,0.3);
          }
          
          .compact-calendar .react-datepicker__day-names {
            display: flex;
            justify-content: space-around;
            margin-bottom: 0;
            padding: 4px 8px 2px 8px; /* More horizontal padding to match month */
            background: #000000;
            border-bottom: 1px solid #000000;
          }
          
          .compact-calendar .react-datepicker__day-name {
            color: #ffffff;
            font-weight: 600;
            font-size: 9px;
            flex: 1;
            line-height: 14px;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .compact-calendar .react-datepicker__month {
            padding: 2px 4px; /* Reduced padding to prevent overflow */
            background: white;
            height: 280px !important; /* Increased height to fit all 6 weeks properly */
            min-height: 280px !important;
            max-height: 280px !important;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            margin: 0 auto; /* Center instead of side margins */
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }
          
          .compact-calendar .react-datepicker__month-container {
            width: 100%;
          }
          
          .compact-calendar .react-datepicker__week {
            display: flex;
            justify-content: space-around;
            margin: 0;
            height: 40px !important; /* Increased height for each week row to show all dates */
            min-height: 40px !important;
            max-height: 40px !important;
            flex: 1;
            align-items: center;
            width: 100%;
          }
          
          .compact-calendar .react-datepicker__day {
            border-radius: 4px;
            margin: 0 0.5px;
            flex: 1;
            height: 36px !important;
            min-height: 36px !important;
            max-height: 36px !important;
            line-height: 36px;
            color: #374151;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.15s ease;
            text-align: center;
            cursor: pointer;
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            max-width: none;
          }
          
          .compact-calendar .react-datepicker__day--selected {
            background: #000000 !important;
            color: white !important;
            font-weight: 700;
            transform: scale(1.05);
            border-radius: 8px;
            border: 1px solid #ffffff !important;
          }
          
          /* Hide selection if it's outside the current month */
          .compact-calendar .react-datepicker__day--selected.react-datepicker__day--outside-month {
            background: transparent !important;
            color: inherit !important;
            font-weight: normal !important;
            box-shadow: none !important;
            transform: none !important;
          }
          
          .compact-calendar .react-datepicker__day:hover:not(.react-datepicker__day--selected) {
            background-color: #f3f4f6;
            color: #000000;
            transform: scale(1.02);
          }
          
          .compact-calendar .react-datepicker__day--today:not(.react-datepicker__day--selected) {
            background-color: transparent;
            color: inherit;
            font-weight: normal;
            box-shadow: none;
          }
          
          .compact-calendar .react-datepicker__day--outside-month {
            visibility: hidden;
            pointer-events: none;
          }
          
          /* Fix grid layout for incomplete weeks */
          .compact-calendar .react-datepicker__week {
            display: flex;
            justify-content: space-between;
          }
          
          .compact-calendar .react-datepicker__day {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .compact-calendar .react-datepicker__navigation {
            top: 50px;
            width: 12px;
            height: 12px;
            border-radius: 0;
            background: transparent;
            border: none;
            transition: all 0.15s ease;
            box-shadow: none;
            z-index: 20;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.8;
          }
          
          .compact-calendar .react-datepicker__navigation:hover {
            background: transparent;
            opacity: 1;
            transform: scale(1.2);
          }
          
          .compact-calendar .react-datepicker__navigation--previous {
            left: 4px; /* Moved inside container */
          }
          
          .compact-calendar .react-datepicker__navigation--next {
            right: 4px; /* Moved inside container */
          }
          
          .compact-calendar .react-datepicker__navigation-icon::before {
            border-color: #000000;
            border-width: 2px 2px 0 0;
            width: 6px;
            height: 6px;
            margin: 0;
          }
          
          /* COMPREHENSIVE RESPONSIVE DESIGN - FIXED FOR ALL DEVICES */
          
          /* Ultra-small phones (320px - 359px) - EXTRA COMPACT */
          @media screen and (max-width: 359px) {
            .compact-calendar {
              max-height: 180px !important;
            }
            .compact-calendar .react-datepicker__month-container {
              max-height: 180px !important;
            }
            .compact-calendar .react-datepicker__month {
              height: 140px !important;
              min-height: 140px !important;
              max-height: 140px !important;
              padding: 1px 2px;
            }
            .compact-calendar .react-datepicker__header {
              padding: 3px 0;
            }
            .compact-calendar .react-datepicker__navigation {
              width: 6px;
              height: 6px;
              top: 10px;
            }
            .compact-calendar .react-datepicker__navigation--previous {
              left: -10px;
            }
            .compact-calendar .react-datepicker__navigation--next {
              right: -10px;
            }
            .compact-calendar .react-datepicker__week {
              height: 20px !important;
              min-height: 20px !important;
              max-height: 20px !important;
            }
            .compact-calendar .react-datepicker__day {
              height: 18px !important;
              min-height: 18px !important;
              max-height: 18px !important;
              line-height: 18px;
              font-size: 8px;
              margin: 0;
            }
            .compact-calendar .react-datepicker__day-name {
              font-size: 6px;
              line-height: 8px;
              height: 8px;
            }
            .compact-calendar .react-datepicker__current-month {
              font-size: 9px;
              margin-bottom: 1px;
            }
          }
          
          /* Samsung Galaxy S8+, Pixel, and similar phones (360px - 374px) */
          @media screen and (min-width: 360px) and (max-width: 374px) {
            .compact-calendar {
              max-height: 300px !important;
            }
            .compact-calendar .react-datepicker__month-container {
              max-height: 300px !important;
            }
            .compact-calendar .react-datepicker__month {
              height: 240px !important;
              min-height: 240px !important;
              max-height: 240px !important;
              padding: 2px 6px;
            }
            .compact-calendar .react-datepicker__navigation {
              width: 10px;
              height: 10px;
              top: 15px;
            }
            .compact-calendar .react-datepicker__navigation--previous {
              left: -14px;
            }
            .compact-calendar .react-datepicker__navigation--next {
              right: -14px;
            }
            .compact-calendar .react-datepicker__week {
              height: 32px !important;
              min-height: 32px !important;
              max-height: 32px !important;
            }
            .compact-calendar .react-datepicker__day {
              height: 30px !important;
              min-height: 30px !important;
              max-height: 30px !important;
              line-height: 30px;
              font-size: 10px;
              margin: 0 1px;
            }
            .compact-calendar .react-datepicker__day-name {
              font-size: 8px;
              line-height: 12px;
            }
            .compact-calendar .react-datepicker__current-month {
              font-size: 12px;
            }
          }

          /* iPhone SE and iPhone 6/7/8 (375px - 413px) - MUCH SMALLER */
          @media screen and (min-width: 375px) and (max-width: 413px) {
            .compact-calendar {
              max-height: 200px !important;
            }
            .compact-calendar .react-datepicker__month-container {
              max-height: 200px !important;
            }
            .compact-calendar .react-datepicker__month {
              height: 160px !important;
              min-height: 160px !important;
              max-height: 160px !important;
              padding: 1px 4px;
            }
            .compact-calendar .react-datepicker__header {
              padding: 4px 0;
            }
            .compact-calendar .react-datepicker__navigation {
              width: 8px;
              height: 8px;
              top: 12px;
            }
            .compact-calendar .react-datepicker__navigation--previous {
              left: -12px;
            }
            .compact-calendar .react-datepicker__navigation--next {
              right: -12px;
            }
            .compact-calendar .react-datepicker__week {
              height: 22px !important;
              min-height: 22px !important;
              max-height: 22px !important;
            }
            .compact-calendar .react-datepicker__day {
              height: 20px !important;
              min-height: 20px !important;
              max-height: 20px !important;
              line-height: 20px;
              font-size: 9px;
              margin: 0;
            }
            .compact-calendar .react-datepicker__day-name {
              font-size: 7px;
              line-height: 10px;
              height: 10px;
            }
            .compact-calendar .react-datepicker__current-month {
              font-size: 10px;
              margin-bottom: 2px;
            }
          }
          
          /* iPhone Plus/Pro Max/iPhone 15 Pro (414px - 479px) */
          @media screen and (min-width: 414px) and (max-width: 479px) {
            .compact-calendar .react-datepicker__month {
              height: 280px !important; /* Ensure all 6 weeks are visible */
              min-height: 280px !important;
              max-height: 280px !important;
            }
            .compact-calendar .react-datepicker__week {
              height: 40px !important; /* Increased to show dates properly */
              min-height: 40px !important;
              max-height: 40px !important;
            }
            .compact-calendar .react-datepicker__day {
              height: 38px !important; /* Increased for better visibility */
              min-height: 38px !important;
              max-height: 38px !important;
              line-height: 38px;
              font-size: 12px;
            }
            .compact-calendar {
              max-height: 360px !important; /* Increased container height */
            }
            .compact-calendar .react-datepicker__month-container {
              max-height: 360px !important; /* Increased container height */
            }
            .compact-calendar .react-datepicker__navigation {
              width: 14px;
              height: 14px;
            }
            .compact-calendar .react-datepicker__navigation--previous {
              left: -18px;
            }
            .compact-calendar .react-datepicker__navigation--next {
              right: -18px;
            }
          }
          
          /* Surface Duo and medium tablets (480px - 600px) */
          @media screen and (min-width: 480px) and (max-width: 600px) {
            .compact-calendar {
              max-height: 400px !important;
            }
            .compact-calendar .react-datepicker__month-container {
              max-height: 400px !important;
            }
            .compact-calendar .react-datepicker__month {
              height: 340px !important;
              min-height: 340px !important;
              max-height: 340px !important;
              padding: 4px 12px;
            }
            .compact-calendar .react-datepicker__navigation {
              width: 16px;
              height: 16px;
              top: 18px;
            }
            .compact-calendar .react-datepicker__navigation--previous {
              left: -20px;
            }
            .compact-calendar .react-datepicker__navigation--next {
              right: -20px;
            }
            .compact-calendar .react-datepicker__week {
              height: 48px !important;
              min-height: 48px !important;
              max-height: 48px !important;
            }
            .compact-calendar .react-datepicker__day {
              height: 44px !important;
              min-height: 44px !important;
              max-height: 44px !important;
              line-height: 44px;
              font-size: 14px;
              margin: 0 2px;
            }
            .compact-calendar .react-datepicker__day-name {
              font-size: 11px;
              line-height: 18px;
            }
            .compact-calendar .react-datepicker__current-month {
              font-size: 17px;
            }
          }

          /* Large tablets and desktop (600px+) */
          @media screen and (min-width: 600px) {
            .compact-calendar {
              max-height: 450px !important;
            }
            .compact-calendar .react-datepicker__month-container {
              max-height: 450px !important;
            }
            .compact-calendar .react-datepicker__month {
              height: 380px !important;
              min-height: 380px !important;
              max-height: 380px !important;
              padding: 6px 16px;
            }
            .compact-calendar .react-datepicker__navigation {
              width: 18px;
              height: 18px;
              top: 20px;
            }
            .compact-calendar .react-datepicker__navigation--previous {
              left: -24px;
            }
            .compact-calendar .react-datepicker__navigation--next {
              right: -24px;
            }
            .compact-calendar .react-datepicker__week {
              height: 52px !important;
              min-height: 52px !important;
              max-height: 52px !important;
            }
            .compact-calendar .react-datepicker__day {
              height: 48px !important;
              min-height: 48px !important;
              max-height: 48px !important;
              line-height: 48px;
              font-size: 16px;
              margin: 0 3px;
            }
            .compact-calendar .react-datepicker__day-name {
              font-size: 12px;
              line-height: 20px;
            }
            .compact-calendar .react-datepicker__current-month {
              font-size: 18px;
            }
          }
          
          /* Landscape orientation adjustments */
          @media screen and (max-height: 500px) and (orientation: landscape) {
            .compact-calendar .react-datepicker__month {
              height: 140px !important;
              min-height: 140px !important;
              max-height: 140px !important;
            }
            .compact-calendar .react-datepicker__week {
              height: 22px !important;
              min-height: 22px !important;
              max-height: 22px !important;
            }
            .compact-calendar .react-datepicker__day {
              height: 20px !important;
              min-height: 20px !important;
              max-height: 20px !important;
              line-height: 20px;
              font-size: 9px;
            }
            .compact-calendar .react-datepicker__day-name {
              font-size: 8px;
              line-height: 10px;
            }
            .compact-calendar .react-datepicker__current-month {
              font-size: 11px;
            }
            .compact-calendar .react-datepicker__header {
              padding: 4px 0;
            }
          }
          
          /* Very short screens */
          @media screen and (max-height: 600px) {
            .compact-calendar {
              max-height: 180px !important;
            }
            .compact-calendar .react-datepicker__month-container {
              max-height: 180px !important;
            }
          }
          
          /* Ensure calendar never exceeds container */
          @media screen and (max-height: 700px) {
            .compact-edit-panel .compact-calendar {
              max-height: calc(100% - 40px) !important;
            }
          }
        `}
      </style>
    </div>
  );
};

export default MobileJournalEditor; 