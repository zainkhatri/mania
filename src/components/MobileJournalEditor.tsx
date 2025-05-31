import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import JournalCanvas from './JournalCanvas';
import JournalEnhancer from './JournalEnhancer';
import 'react-datepicker/dist/react-datepicker.css';
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
  faBars
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
    />
  );
});

OptimizedTextInput.displayName = 'OptimizedTextInput';

const MobileJournalEditor: React.FC<MobileJournalEditorProps> = ({ onUpdate, initialData }) => {
  // Core data states
  const [date, setDate] = useState<Date>(initialData?.date || new Date());
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
  const journalCanvasRef = useRef(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Auto-hide controls on scroll
  const [lastScrollY, setLastScrollY] = useState(0);
  
  // Add state for which edit tab is open
  const [activeEditTab, setActiveEditTab] = useState<'none' | 'write' | 'location' | 'format'>('none');

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

  // Enhanced image upload with multiple selection and preview
  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    setIsLoading(true);
    hapticFeedback('medium');
    
    try {
      const newImages = [...images];
      const filesToProcess = Array.from(files).slice(0, 3 - images.length);
      
      for (const file of filesToProcess) {
        // Create preview immediately
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            newImages.push(e.target.result as string);
            setImages([...newImages]);
          }
        };
        reader.readAsDataURL(file);
      }
      
      // Show success animation
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
      
      onUpdate({ date, location, images: newImages, textSections });
    } catch (error) {
      toast.error('Failed to upload images');
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  }, [images, date, location, textSections, onUpdate, hapticFeedback]);

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

  // Enhanced download with progress
  const handleDownload = useCallback(async () => {
    const journalElement = document.getElementById('journal-canvas');
    if (!journalElement) {
      toast.error('Could not find journal element');
      return;
    }

    setIsLoading(true);
    hapticFeedback('heavy');
    
    const toastId = toast.loading('Creating PDF...', {
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
      const canvas = await html2canvas(journalElement, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 0,
      });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (pageHeight * canvas.width) / canvas.width;
      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);

      const filename = `journal-${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(filename);

      toast.dismiss(toastId);
      toast.success('Journal saved successfully', {
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
      toast.error('Could not create PDF. Please try again.');
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

  return (
    <div className="min-h-screen bg-gray-50 overflow-hidden">
      {/* Global CSS fix for backwards text */}
      <style>
        {`
          /* Force normal text direction globally for this component */
          .min-h-screen textarea,
          .min-h-screen input[type="text"],
          .min-h-screen input,
          .min-h-screen * {
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
        `}
      </style>

      {/* Single Header */}
      <div className="sticky top-0 z-30 bg-black py-4 px-4">
        <div className="flex items-center justify-between">
          <span className="text-white text-5xl" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>mania</span>
          <button
              onClick={handleDownload}
              disabled={isLoading}
            className="text-white"
            >
              {isLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                />
              ) : (
              <FontAwesomeIcon icon={faDownload} className="text-2xl" />
              )}
          </button>
          </div>
        </div>

      {/* Main Content */}
      <div className="p-4"> {/* Removed extra bottom padding to prevent scroll */}
        {/* Journal Canvas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-white rounded-2xl shadow-sm overflow-hidden mb-4"
          style={{ aspectRatio: '1240/1748' }}
        >
          <JournalCanvas
            ref={journalCanvasRef}
            date={date}
            location={location}
            images={images}
            textSections={textSections}
            editMode={false}
            templateUrl="/templates/goodnotes-a6-yellow.jpg"
            textColors={textColors}
            layoutMode={layoutMode}
            onNewEntry={() => {}}
          />
          
          {/* Interactive overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Location tap area */}
            <div
              className="absolute top-[5%] left-0 right-0 h-[6%] pointer-events-auto cursor-pointer"
              onClick={() => {
                setEditMode('location');
                hapticFeedback('light');
              }}
            />
            
            {/* Text areas */}
            {[13, 42, 72].map((top, index) => (
              <div
                key={index}
                className="absolute pointer-events-auto cursor-pointer"
                style={{
                  top: `${top}%`,
                  left: layoutMode === 'standard' ? '55%' : '2%',
                  width: '44%',
                  height: '27%'
                }}
                onClick={() => {
                  setActiveTextIndex(index);
                  setEditMode('text');
                  hapticFeedback('light');
                }}
              />
            ))}
          </div>
        </motion.div>
      </div>

      {/* Persistent Bottom Edit Panel */}
      <div className="fixed bottom-0 left-0 w-full z-50 bg-white border-t border-gray-200" style={{ height: '25vh', minHeight: 220, boxShadow: '0 -2px 16px rgba(0,0,0,0.06)', overflow: 'hidden', pointerEvents: 'auto' }}>
        {/* Edit Tab Buttons */}
        <div className="flex justify-around items-center h-14 border-b border-gray-100">
          <button
            className={`flex-1 h-full flex flex-col items-center justify-center font-semibold text-lg transition-colors text-gray-700`}
            onClick={() => {
              if (fileInputRef.current) fileInputRef.current.click();
            }}
          >
            <span role="img" aria-label="Images" className="text-xl">🖼️</span>
            <span className="text-xs mt-1">Images</span>
          </button>
          <button
            className={`flex-1 h-full flex flex-col items-center justify-center font-semibold text-lg transition-colors ${activeEditTab === 'write' ? 'text-purple-600' : 'text-gray-700'}`}
            onClick={() => setActiveEditTab('write')}
          >
            ✏️<span className="text-xs mt-1">Write</span>
          </button>
          <button
            className={`flex-1 h-full flex flex-col items-center justify-center font-semibold text-lg transition-colors ${activeEditTab === 'location' ? 'text-blue-600' : 'text-gray-700'}`}
            onClick={() => setActiveEditTab('location')}
          >
            📍<span className="text-xs mt-1">Location</span>
          </button>
          <button
            className={`flex-1 h-full flex flex-col items-center justify-center font-semibold text-lg transition-colors ${activeEditTab === 'format' ? 'text-green-600' : 'text-gray-700'}`}
            onClick={() => setActiveEditTab('format')}
          >
            🎨<span className="text-xs mt-1">Format</span>
          </button>
        </div>
        {/* Edit Controls Area */}
        <div className="h-[calc(25vh-3.5rem)] flex flex-col justify-center items-center px-2 pt-1 pb-1 overflow-hidden">
          {activeEditTab === 'write' && (
            <OptimizedTextInput
              initialValue={textSections[0] || ''}
              onUpdateComplete={(newText) => {
                setTextSections([newText]);
                onUpdate({
                  date,
                  location,
                  images,
                  textSections: [newText]
                });
              }}
            />
          )}
          {activeEditTab === 'location' && (
            <div className="w-full flex flex-col items-center gap-1 py-1" style={{height: '100%', overflow: 'hidden'}}>
              <input
                type="text"
                value={location}
                onChange={e => {
                  setLocation(e.target.value.toUpperCase());
                  onUpdate({ date, location: e.target.value.toUpperCase(), images, textSections });
                }}
                placeholder="Enter location..."
                className="w-full p-1 border border-gray-200 rounded-md focus:border-gray-400 focus:outline-none text-center text-base text-gray-900 placeholder-gray-400 transition-all duration-200 mb-1"
                style={{
                  fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                  direction: 'ltr',
                  textAlign: 'center',
                  unicodeBidi: 'normal',
                  writingMode: 'horizontal-tb',
                  transform: 'none',
                  WebkitTransform: 'none',
                  MozTransform: 'none',
                  msTransform: 'none',
                  OTransform: 'none',
                  textRendering: 'auto',
                  fontFeatureSettings: 'normal',
                  maxHeight: '32px',
                  fontSize: '15px',
                }}
                dir="ltr"
                lang="en"
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                autoFocus
              />
              {/* Image-derived Color Picker - compact */}
              <div className="w-full flex flex-col items-center justify-center mt-1">
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
          {activeEditTab === 'format' && (
            <div className="w-full flex flex-row items-center justify-center gap-4">
              {/* Style 1 Icon */}
              <button
                className={`flex flex-col items-center p-2 rounded-xl border-2 transition-all ${layoutMode === 'standard' ? 'border-green-500 bg-green-50' : 'border-transparent bg-gray-100'}`}
                style={{ width: 90 }}
                onClick={() => setLayoutMode('standard')}
              >
                {/* Mini journal preview SVG for Style 1 */}
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <rect x="4" y="4" width="40" height="40" rx="8" fill="#444" />
                  <rect x="10" y="10" width="28" height="6" rx="2" fill="#bbb" />
                  <rect x="10" y="18" width="12" height="6" rx="2" fill="#bbb" />
                  <rect x="24" y="18" width="14" height="6" rx="2" fill="#bbb" />
                  <rect x="10" y="26" width="28" height="6" rx="2" fill="#bbb" />
                  <rect x="10" y="34" width="14" height="6" rx="2" fill="#bbb" />
                  <rect x="26" y="34" width="12" height="6" rx="2" fill="#bbb" />
                </svg>
                <span className="text-xs font-semibold mt-1">Style 1</span>
              </button>
              {/* Style 2 Icon */}
              <button
                className={`flex flex-col items-center p-2 rounded-xl border-2 transition-all ${layoutMode === 'mirrored' ? 'border-green-500 bg-green-50' : 'border-transparent bg-gray-100'}`}
                style={{ width: 90 }}
                onClick={() => setLayoutMode('mirrored')}
              >
                {/* Mini journal preview SVG for Style 2 */}
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <rect x="4" y="4" width="40" height="40" rx="8" fill="#888" />
                  <rect x="10" y="10" width="28" height="6" rx="2" fill="#eee" />
                  <rect x="26" y="18" width="12" height="6" rx="2" fill="#eee" />
                  <rect x="10" y="18" width="14" height="6" rx="2" fill="#eee" />
                  <rect x="10" y="26" width="28" height="6" rx="2" fill="#eee" />
                  <rect x="26" y="34" width="14" height="6" rx="2" fill="#eee" />
                  <rect x="10" y="34" width="12" height="6" rx="2" fill="#eee" />
                </svg>
                <span className="text-xs font-semibold mt-1">Style 2</span>
              </button>
              </div>
          )}
              </div>
            </div>

      {/* Image Gallery Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-2xl p-6 shadow-sm mb-4"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Images ({images.length}/3)</h3>
              <div className="flex gap-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${
                      i < images.length ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
        
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="aspect-square relative">
              {images[index] ? (
                <motion.div
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  onDrag={(_, info) => handleImageDrag(index, info)}
                  onDragEnd={(_, info) => handleImageDragEnd(index, info)}
                  className={`relative w-full h-full rounded-xl overflow-hidden ${
                    draggedImageIndex === index ? 'z-10 scale-105' : ''
                  } transition-all duration-200`}
                >
                  <img
                    src={typeof images[index] === 'string' ? images[index] as string : URL.createObjectURL(images[index] as Blob)}
                    alt={`Memory ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => {
                      const newImages = images.filter((_, i) => i !== index);
                      setImages(newImages);
                      hapticFeedback('medium');
                    }}
                    className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full text-xs hover:bg-black/70 transition-colors"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </motion.div>
              ) : (
                <button
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.click();
                      hapticFeedback('light');
                    }
                  }}
                  className="w-full h-full border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-all duration-200"
                >
                  <FontAwesomeIcon icon={faCamera} className="text-xl mb-1" />
                  <span className="text-xs">Add</span>
                </button>
              )}
          </div>
          ))}
          </div>
        </motion.div>

        {/* Color Picker Panel */}
        <AnimatePresence>
          {editMode === 'color' && (
            <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-2xl p-6 shadow-sm mb-4"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Colors</h3>
              <SimpleColorPicker
                colors={textColors}
                onChange={setTextColors}
                images={images}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Enhancement Panel */}
        <AnimatePresence>
          {editMode === 'ai' && textSections.some(section => section.trim().length > 0) && (
            <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-2xl p-6 shadow-sm mb-4"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Assistant</h3>
              <JournalEnhancer
                journalText={textSections.join('\n\n')}
                location={location}
                minWordCount={5}
                showInitially={true}
              />
            </motion.div>
          )}
        </AnimatePresence>

      {/* Success Animation */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            <div className="bg-green-500 text-white p-6 rounded-full shadow-lg">
              <FontAwesomeIcon icon={faCheck} className="text-2xl" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
        multiple
      />
    </div>
  );
};

export default MobileJournalEditor; 