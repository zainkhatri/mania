import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import JournalCanvas, { JournalCanvasHandle } from './JournalCanvas';
import JournalEnhancer from './JournalEnhancer';
import KonvaStickers, { StickerData } from './KonvaStickers';
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

        // GOODNOTES-QUALITY: Always use maximum quality for smooth scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high'; // Always use highest quality
        
        // Additional quality settings for photo stickers
        if (maxWidth <= 800 && maxHeight <= 800 && format === 'png') {
          // For stickers: preserve maximum detail and smoothness
          ctx.filter = 'none'; // No filters that could degrade quality
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
  const [isUploading, setIsUploading] = useState(false);
  
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
  const [activeEditTab, setActiveEditTab] = useState<'none' | 'write' | 'location' | 'date' | 'stickers'>('date');
  
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

  // GOODNOTES-LEVEL STICKER SYSTEM: React Konva for hardware acceleration
  const [konvaStickers, setKonvaStickers] = useState<StickerData[]>([]);
  const [stickerIdCounter, setStickerIdCounter] = useState(0);

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

  // Premium image upload with smooth animations
  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    // Immediate haptic feedback and loading state
    hapticFeedback('medium');
    setIsUploading(true);
    
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
        
        // Smooth transition from uploading to success
        await new Promise(resolve => setTimeout(resolve, 300)); // Brief pause for better UX
        setIsUploading(false);
        
        // Show elegant success animation
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 1200); // Longer display for better experience
        
        // Success haptic feedback
        hapticFeedback('heavy');
      } else {
        setIsUploading(false);
      }
      
    } catch (error) {
      console.error('Error uploading images:', error);
      setIsUploading(false);
      
      // Elegant error feedback
      toast.error('Upload failed', {
        autoClose: 2000,
        style: { 
          background: '#1a1a1a',
          color: 'white',
          borderRadius: '12px',
          fontSize: '14px',
          padding: '12px 20px',
          border: '1px solid #dc2626'
        }
      });
    } finally {
      event.target.value = '';
    }
  }, [images, date, location, textSections, onUpdate, hapticFeedback]);

  // GOODNOTES-LEVEL sticker upload with React Konva hardware acceleration
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
    
    // GOODNOTES APPROACH: Create stickers with original quality using React Konva
    filesToProcess.forEach(file => {
      // Create a temporary image to get dimensions
      const img = new Image();
      img.onload = () => {
        const originalWidth = img.naturalWidth || img.width;
        const originalHeight = img.naturalHeight || img.height;
        
        // Calculate initial display size (GoodNotes style)
        const maxInitialSize = 300;
        const aspectRatio = originalWidth / originalHeight;
        let displayWidth = maxInitialSize;
        let displayHeight = maxInitialSize;
        
        if (aspectRatio > 1) {
          displayWidth = maxInitialSize;
          displayHeight = maxInitialSize / aspectRatio;
        } else {
          displayHeight = maxInitialSize;
          displayWidth = maxInitialSize * aspectRatio;
        }
        
        // Create new sticker with TRULY unique ID using timestamp + random
        const uniqueId = `sticker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const newSticker: StickerData = {
          id: uniqueId,
          src: file, // Store original File object - NO COMPRESSION
          x: Math.random() * 200 + 100, // Random positioning
          y: Math.random() * 200 + 200,
          width: displayWidth,
          height: displayHeight,
          rotation: 0,
          scaleX: displayWidth / originalWidth,
          scaleY: displayHeight / originalHeight,
          originalWidth: originalWidth,
          originalHeight: originalHeight,
          zIndex: konvaStickers.length + 1
        };
        
        console.log('🎯 Created sticker with unique ID:', uniqueId, 'at position:', { x: newSticker.x, y: newSticker.y });
        
        // Add to Konva stickers state
        setKonvaStickers(prev => [...prev, newSticker]);
        setStickerIdCounter(prev => prev + 1);
      };
      
      // Load image to get dimensions - no quality loss
      img.src = URL.createObjectURL(file);
    });
    
    // IMMEDIATE cleanup
    event.target.value = '';
  }, [hapticFeedback, stickerIdCounter, konvaStickers.length]);

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

  // SIMPLIFIED APPROACH: Use html2canvas for perfect visual capture
  const handleDownload = useCallback(async () => {
    setIsLoading(true);
    hapticFeedback('heavy');
    
    const toastId = toast.loading('Creating Ultra-HD PDF with stickers...', {
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
      // Force high-quality render
      setForceUpdate(prev => prev + 1);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Find the journal container with both canvas and stickers
      const journalContainer = document.querySelector('.relative.bg-white.rounded-xl.shadow-md.overflow-hidden.h-full.border.border-gray-200') as HTMLElement;
      
      if (!journalContainer) {
        throw new Error('Journal container not found');
      }

      console.log('🎯 CAPTURING VISUAL JOURNAL with html2canvas...');
      
      // Use html2canvas to capture the visual combination of journal + stickers
      const canvas = await html2canvas(journalContainer, {
        scale: 4, // Ultra-high quality 4x scaling
        useCORS: true,
        allowTaint: false,
        backgroundColor: null,
        logging: false,
        width: journalContainer.offsetWidth,
        height: journalContainer.offsetHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        scrollX: 0,
        scrollY: 0,
        ignoreElements: (element: Element) => {
          // Ignore any overlay UI elements, keep only journal content
          return element.classList.contains('absolute') && 
                 !element.classList.contains('konva-stage') &&
                 !element.classList.contains('konva-content');
        }
      });

      console.log('✅ CAPTURED JOURNAL + STICKERS at 4x quality');
      
      // Get ultra-high quality PNG data from html2canvas
      const pngData = canvas.toDataURL('image/png', 1.0);
      
      // Create PDF with canvas dimensions
      const pdf = new jsPDF(
        'portrait', 
        'px', 
        [canvas.width, canvas.height],
        false // No compression
      );
      
      // Add the captured image to the PDF at maximum resolution
      pdf.addImage(
        pngData,
        'PNG',
        0,
        0,
        pdf.internal.pageSize.getWidth(),
        pdf.internal.pageSize.getHeight(),
        `journal-${Date.now()}`,
        'NONE'
      );

      const filename = `journal-${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(filename);

      toast.dismiss(toastId);
      toast.success('Ultra-HD Journal with stickers saved successfully', {
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
  }, [hapticFeedback, konvaStickers]);

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

  // Enhanced pencil button click with clear typing indicators
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
    
    // Focus the hidden textarea with enhanced feedback
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
    }, 50);
    
    // Strong haptic feedback to indicate typing mode
    hapticFeedback('heavy');
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
          
          /* GOODNOTES-LEVEL STICKER PERFORMANCE: React Konva hardware acceleration */
          .konva-stage {
            /* Ultra-smooth hardware acceleration like GoodNotes */
            will-change: transform !important;
            transform: translate3d(0, 0, 0) !important;
            backface-visibility: hidden !important;
            -webkit-backface-visibility: hidden !important;
            perspective: 1000px !important;
            -webkit-perspective: 1000px !important;
            /* GPU layer promotion */
            isolation: isolate !important;
            contain: layout style paint !important;
            /* Disable text selection and context menus */
            -webkit-touch-callout: none !important;
            -webkit-user-select: none !important;
            user-select: none !important;
            -webkit-tap-highlight-color: transparent !important;
            /* Optimize for touch */
            touch-action: manipulation !important;
            -webkit-user-drag: none !important;
            /* Perfect anti-aliasing */
            -webkit-font-smoothing: antialiased !important;
            -moz-osx-font-smoothing: grayscale !important;
          }
          
          .konva-stage canvas {
            /* GOODNOTES-QUALITY: Ultra-smooth photo rendering */
            image-rendering: high-quality !important; /* Maximum quality for photo stickers */
            image-rendering: -webkit-optimize-contrast !important; /* Safari photo optimization */
            image-rendering: smooth !important; /* Chrome smooth photo scaling */
            /* Remove pixelated - only good for pixel art, terrible for photos */
            /* GPU acceleration */
            will-change: transform !important;
            transform: translateZ(0) !important;
            backface-visibility: hidden !important;
            /* Disable context menus */
            -webkit-touch-callout: none !important;
            -webkit-user-select: none !important;
            user-select: none !important;
            /* High-performance touch handling */
            touch-action: manipulation !important;
            pointer-events: auto !important;
          }

          /* ULTRA-HIGH-QUALITY: ALL canvas elements get maximum quality rendering */
          canvas, .mobile-no-scroll canvas, #journal-canvas {
            /* GOODNOTES-QUALITY: Ultra-smooth high-quality image rendering */
            image-rendering: -webkit-optimize-contrast !important; /* Safari optimization */
            image-rendering: smooth !important; /* Chrome/Edge smooth scaling */
            image-rendering: high-quality !important; /* Firefox high quality */
            /* Disable ANY pixelated rendering - destroys photo quality */
            /* Critical: Allow full touch interaction exactly like desktop */
            touch-action: none !important;
            -webkit-touch-callout: none !important;
            -webkit-user-select: none !important;
            user-select: none !important;
            -webkit-tap-highlight-color: transparent !important;
            /* AGGRESSIVE iOS context menu prevention */
            -webkit-touch-callout: none !important;
            -webkit-user-drag: none !important;
            -webkit-text-size-adjust: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            pointer-events: auto !important;
            /* Prevent long press context menu */
            -webkit-context-menu: none !important;
            context-menu: none !important;
            /* CRITICAL: Remove all transforms that could degrade quality */
            transform: none !important;
            -webkit-transform: none !important;
            filter: none !important;
            -webkit-filter: none !important;
            /* Force canvas to render at maximum quality */
            will-change: auto !important;
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
            
            /* GLOBAL iOS context menu prevention */
            .mobile-no-scroll * {
              -webkit-touch-callout: none !important;
              -webkit-user-select: none !important;
              -webkit-tap-highlight-color: transparent !important;
              -webkit-user-drag: none !important;
              user-select: none !important;
              -moz-user-select: none !important;
              -ms-user-select: none !important;
            }
            
            /* Force disable context menus globally on iOS */
            body {
              -webkit-touch-callout: none !important;
              -webkit-user-select: none !important;
              user-select: none !important;
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
        <div className="flex items-center justify-end h-6">
          <button
            onClick={handleDownload}
            disabled={isLoading}
            className="text-gray-700 p-0.5 rounded-lg hover:bg-gray-100 transition-colors"
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
        <div className="full-journal" style={{ height: '65vh' }}>
          <div className="h-full p-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative bg-white rounded-2xl shadow-lg overflow-hidden h-full border border-gray-200"
              style={{ aspectRatio: '1240/1748' }}
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
              
              {/* GOODNOTES-LEVEL STICKER LAYER: React Konva with hardware acceleration */}
              <KonvaStickers
                width={1240}
                height={1748}
                stickers={konvaStickers}
                onStickersChange={setKonvaStickers}
                isEditing={!isWriting && !isEditingLocation}
              />
              
              {/* Interactive overlay */}
                             {!isWriting && !isEditingLocation && (
                 <div 
                   className="absolute inset-0 bg-transparent"
                   style={{ touchAction: 'none' }}
                 />
               )}
            </motion.div>
          </div>
        </div>

        {/* Editing Panel - Compact tabs */}
        <div className="compact-edit-panel bg-gray-50 border-t border-gray-200" style={{ height: '35vh' }}>
          {/* Sticky Tab Navigation */}
          <div className="sticky-tabs bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
            <div className="flex space-x-1">
                             {[
                 { id: 'date' as const, label: 'Date', icon: '📅' },
                 { id: 'location' as const, label: 'Location', icon: '📍' },
                 { id: 'write' as const, label: 'Text', icon: '✍️' },
                 { id: 'stickers' as const, label: 'Photos', icon: '📸' }
               ].map((tab) => (
                 <button
                   key={tab.id}
                   onClick={() => setActiveEditTab(tab.id)}
                   className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                     activeEditTab === tab.id
                       ? 'bg-blue-100 text-blue-700 shadow-sm'
                       : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                   }`}
                 >
                   <span className="text-base mr-1">{tab.icon}</span>
                   <span className="text-xs">{tab.label}</span>
                 </button>
               ))}
            </div>
          </div>
        </div>
      </div>

      {/* Premium Upload Success Animation */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            {/* Backdrop blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            
            {/* Main success container */}
            <motion.div
              initial={{ scale: 0.3, opacity: 0, y: 50 }}
              animate={{ 
                scale: [0.3, 1.1, 1], 
                opacity: 1, 
                y: 0,
                rotate: [0, -5, 5, 0]
              }}
              exit={{ 
                scale: 0.8, 
                opacity: 0, 
                y: -30,
                transition: { duration: 0.2 }
              }}
              transition={{ 
                duration: 0.6, 
                ease: "easeOut",
                times: [0, 0.6, 1]
              }}
              className="relative bg-gradient-to-br from-white to-gray-100 rounded-3xl p-8 shadow-2xl border-4 border-black/10"
            >
              {/* Animated rings */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: [0, 1.2, 1], 
                  opacity: [0, 0.8, 0] 
                }}
                transition={{ 
                  duration: 0.8, 
                  delay: 0.1,
                  ease: "easeOut"
                }}
                className="absolute inset-0 rounded-3xl border-4 border-black/20"
              />
              
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: [0, 1.4, 1.2], 
                  opacity: [0, 0.6, 0] 
                }}
                transition={{ 
                  duration: 1, 
                  delay: 0.2,
                  ease: "easeOut"
                }}
                className="absolute inset-0 rounded-3xl border-2 border-black/10"
              />
              
              {/* Icon container */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ 
                  scale: 1, 
                  rotate: 0,
                }}
                transition={{ 
                  duration: 0.5, 
                  delay: 0.1,
                  type: "spring",
                  stiffness: 200
                }}
                className="relative w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4"
              >
                {/* Sparkle particles */}
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                    animate={{ 
                      scale: [0, 1, 0],
                      opacity: [0, 1, 0],
                      x: [0, (Math.cos(i * 60 * Math.PI / 180)) * 30],
                      y: [0, (Math.sin(i * 60 * Math.PI / 180)) * 30]
                    }}
                    transition={{ 
                      duration: 0.8, 
                      delay: 0.3 + i * 0.1,
                      ease: "easeOut"
                    }}
                    className="absolute w-2 h-2 bg-white rounded-full"
                  />
                ))}
                
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 300 }}
                >
                  <FontAwesomeIcon icon={faCheck} className="text-white text-2xl" />
                </motion.div>
              </motion.div>
              
              {/* Text */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.3 }}
                className="text-center"
              >
                <h3 className="text-xl font-bold text-black mb-1">Upload Complete!</h3>
                <p className="text-sm text-gray-600">Images added to your journal</p>
              </motion.div>
              
              {/* Bottom shine effect */}
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ 
                  duration: 1, 
                  delay: 0.2,
                  ease: "easeInOut"
                }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-3xl transform -skew-x-12"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium Upload Loading Animation */}
      <AnimatePresence>
        {isUploading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            />
            
            {/* Loading container */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative bg-gradient-to-br from-white to-gray-100 rounded-3xl p-8 shadow-2xl border-2 border-black/5"
            >
              {/* Animated upload icon */}
              <motion.div
                animate={{ 
                  rotate: 360,
                  scale: [1, 1.1, 1]
                }}
                transition={{ 
                  rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                  scale: { duration: 1, repeat: Infinity, ease: "easeInOut" }
                }}
                className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4 relative overflow-hidden"
              >
                {/* Inner rotating element */}
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-2 border-2 border-white/30 border-t-white rounded-full"
                />
                <FontAwesomeIcon icon={faCamera} className="text-white text-xl z-10" />
              </motion.div>
              
              {/* Animated text */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-center"
              >
                <motion.h3 
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  className="text-lg font-bold text-black mb-1"
                >
                  Processing Images...
                </motion.h3>
                <p className="text-sm text-gray-600">Optimizing for your journal</p>
              </motion.div>
              
              {/* Progress dots */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex justify-center space-x-2 mt-4"
              >
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 bg-black rounded-full"
                    animate={{ 
                      scale: [1, 1.3, 1],
                      opacity: [0.3, 1, 0.3]
                    }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: i * 0.2,
                      ease: "easeInOut"
                    }}
                  />
                ))}
              </motion.div>
            </motion.div>
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
          
                    /* Premium modern calendar */
          .premium-calendar {
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
          .premium-calendar .react-datepicker__month-container {
            height: auto !important;
            max-height: 340px !important;
            width: 100% !important;
            max-width: 100% !important;
            overflow: hidden !important;
          }
          
          .premium-calendar .react-datepicker__header {
            background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
            border: none;
            border-radius: 16px 16px 0 0;
            padding: 12px 0;
            position: relative;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          }
          
          .premium-calendar .react-datepicker__current-month {
            font-weight: 800;
            font-size: 16px;
            color: white;
            margin-bottom: 0;
            text-shadow: 0 2px 8px rgba(0,0,0,0.5);
            letter-spacing: 1px;
          }
          
          .premium-calendar .react-datepicker__day-names {
            display: flex;
            justify-content: space-around;
            margin-bottom: 0;
            padding: 8px 12px 6px 12px;
            background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
            border-bottom: 1px solid #333333;
          }
          
          .premium-calendar .react-datepicker__day-name {
            color: #ffffff;
            font-weight: 700;
            font-size: 10px;
            flex: 1;
            line-height: 16px;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-shadow: 0 1px 3px rgba(0,0,0,0.3);
          }
          
          .premium-calendar .react-datepicker__month {
            padding: 8px 12px;
            background: linear-gradient(to bottom, #ffffff 0%, #f8f9fa 100%);
            height: 300px !important;
            min-height: 300px !important;
            max-height: 300px !important;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            margin: 0 auto;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            border-radius: 0 0 16px 16px;
          }
          
          .premium-calendar .react-datepicker__month-container {
            width: 100%;
          }
          
          .premium-calendar .react-datepicker__week {
            display: flex;
            justify-content: space-around;
            margin: 0;
            height: 42px !important;
            min-height: 42px !important;
            max-height: 42px !important;
            flex: 1;
            align-items: center;
            width: 100%;
          }
          
          .premium-calendar .react-datepicker__day {
            border-radius: 12px;
            margin: 0 1px;
            flex: 1;
            height: 38px !important;
            min-height: 38px !important;
            max-height: 38px !important;
            line-height: 38px;
            color: #1f2937;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.3s ease;
            text-align: center;
            cursor: pointer;
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            max-width: none;
            position: relative;
          }
          
          .premium-calendar .react-datepicker__day--selected {
            background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%) !important;
            color: white !important;
            font-weight: 800;
            transform: scale(1.1);
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3) !important;
            border: 2px solid #ffffff !important;
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