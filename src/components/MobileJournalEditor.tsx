import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import JournalCanvas from './JournalCanvas';
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
  faGift
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
      data-gramm="false" // Disable Grammarly
      data-enable-grammarly="false"
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
  const stickerInputRef = useRef<HTMLInputElement>(null);
  
  // Auto-hide controls on scroll
  const [lastScrollY, setLastScrollY] = useState(0);
  
  // Add state for which edit tab is open - added back 'write' as a simple pencil button
  const [activeEditTab, setActiveEditTab] = useState<'none' | 'write' | 'location' | 'format' | 'date' | 'stickers'>('none');
  
  // Simple state for writing mode
  const [isWriting, setIsWriting] = useState(false);
  const hiddenTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Add state for location editing mode
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const locationTextareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Enhanced sticker upload with high quality preservation
  const handleStickerUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    setIsLoading(true);
    hapticFeedback('medium');
    
    try {
      const filesToProcess = Array.from(files);
      
      // Use the JournalCanvas ref to add stickers with high quality
      if (journalCanvasRef.current && 'addMultipleStickers' in journalCanvasRef.current) {
        (journalCanvasRef.current as any).addMultipleStickers(filesToProcess);
      }
      
      // Show success animation
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
      
      toast.success(`Added ${filesToProcess.length} sticker${filesToProcess.length > 1 ? 's' : ''}`, {
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
      toast.error('Failed to upload stickers');
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
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

  // Add function to handle pencil button click
  const handlePencilClick = useCallback(() => {
    setIsWriting(true);
    setActiveEditTab('write');
    
    // Focus the hidden textarea - simple and consistent
    setTimeout(() => {
      if (hiddenTextareaRef.current) {
        hiddenTextareaRef.current.focus();
        
        // Additional iOS keyboard trigger if needed
        if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
          hiddenTextareaRef.current.click();
        }
      }
    }, 100);
    
    hapticFeedback('light');
  }, [hapticFeedback]);

  // Handle text input changes
  const handleTextChange = useCallback((newText: string) => {
    const newTextSections = [newText]; // Just use one text section for simplicity
    setTextSections(newTextSections);
    onUpdate({ date, location, images, textSections: newTextSections });
  }, [date, location, images, onUpdate]);

  // Close writing mode
  const closeWriting = useCallback(() => {
    setIsWriting(false);
    setActiveEditTab('none');
    if (hiddenTextareaRef.current) {
      hiddenTextareaRef.current.blur();
    }
  }, []);

  // Add function to handle location area click
  const handleLocationClick = useCallback(() => {
    setIsEditingLocation(true);
    setActiveEditTab('location');
    
    // Focus the hidden location textarea
    setTimeout(() => {
      if (locationTextareaRef.current) {
        locationTextareaRef.current.focus();
        
        // Additional iOS keyboard trigger if needed
        if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
          locationTextareaRef.current.click();
        }
      }
    }, 100);
    
    hapticFeedback('light');
  }, [hapticFeedback]);

  // Handle location text input changes
  const handleLocationChange = useCallback((newLocation: string) => {
    setLocation(newLocation.toUpperCase());
    onUpdate({ date, location: newLocation.toUpperCase(), images, textSections });
  }, [date, images, textSections, onUpdate]);

  // Close location editing mode
  const closeLocationEditing = useCallback(() => {
    setIsEditingLocation(false);
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
          
          /* DISABLE MOBILE SCROLLING - Critical for sticker manipulation */
          .mobile-no-scroll {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            overflow: hidden !important;
            -webkit-overflow-scrolling: none !important;
            overscroll-behavior: none !important;
            touch-action: pan-x pan-y !important;
          }
          
          /* Disable body scrolling on mobile */
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
          
          /* iPhone SE specific adjustments */
          @media screen and (max-height: 500px) {
            .full-journal {
              height: 45vh !important;
            }
            .compact-edit-panel {
              height: 55vh !important;
            }
          }
          
          /* Ultra-small screens */
          @media screen and (max-height: 400px) {
            .full-journal {
              height: 40vh !important;
            }
            .compact-edit-panel {
              height: 60vh !important;
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

      {/* Clean Header - Made Much Smaller */}
      <div className="bg-white py-0.5 px-3 flex-shrink-0 border-b border-gray-200" style={{ minHeight: '32px' }}>
        <div className="flex items-center justify-end h-8">
          <button
            onClick={handleDownload}
            disabled={isLoading}
            className="text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full"
              />
            ) : (
              <FontAwesomeIcon icon={faDownload} className="text-sm" />
            )}
          </button>
        </div>
      </div>

      {/* Journal View with iOS Keyboard Optimization */}
      <div className={`flex-1 flex flex-col min-h-0 bg-white`}>
        {/* Journal Section - Adjust for smaller header */}
        <div className="full-journal" style={{ height: '68vh' }}>
          <div className="h-full p-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative bg-white rounded-xl shadow-md overflow-hidden h-full border border-gray-200"
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

        {/* Integrated Control Panel - Smaller height */}
        <div className={`compact-edit-panel bg-white flex-shrink-0 ${isWriting ? 'keyboard-aware' : ''}`} style={{ height: '32vh' }}>
          {/* Clean Tab Bar - Smaller height */}
          <div className={`flex items-center h-10 px-4 border-b border-gray-100 ${isWriting ? 'sticky-tabs' : ''}`}>
            <div className="flex w-full bg-gray-100 rounded-xl p-1">
                              <button
                  className={`flex-1 h-8 flex items-center justify-center font-medium text-sm rounded-lg transition-all duration-200 ${activeEditTab === 'date' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  onClick={() => setActiveEditTab('date')}
                >
                  📅
                </button>
                              <button
                  className={`flex-1 h-8 flex items-center justify-center font-medium text-sm rounded-lg transition-all duration-200 ${activeEditTab === 'location' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  onClick={handleLocationClick}
                >
                  📍
                </button>
                <button
                  className={`flex-1 h-8 flex items-center justify-center font-medium text-sm rounded-lg transition-all duration-200 text-gray-600 hover:text-gray-900`}
                  onClick={() => {
                    if (fileInputRef.current) fileInputRef.current.click();
                  }}
                >
                  🖼️
                </button>
                <button
                  className={`flex-1 h-8 flex items-center justify-center font-medium text-sm rounded-lg transition-all duration-200 ${activeEditTab === 'stickers' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  onClick={() => setActiveEditTab('stickers')}
                >
                  ✨
                </button>
                <button
                  className={`flex-1 h-8 flex items-center justify-center font-medium text-sm rounded-lg transition-all duration-200 ${activeEditTab === 'write' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  onClick={handlePencilClick}
                >
                  ✏️
                </button>
            </div>
          </div>

          {/* Control Content */}
          <div className="flex-1 overflow-hidden">
            {activeEditTab === 'date' && (
              <div className="h-full w-full overflow-hidden flex items-center justify-center">
                <div className="w-full max-h-full overflow-hidden">
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
                    calendarClassName="react-datepicker-custom-mobile"
                  />
                </div>
              </div>
            )}
            
            {activeEditTab === 'location' && (
              <div className="h-full flex flex-col gap-2 overflow-hidden p-3">
                <h3 className="text-base font-semibold text-gray-900 text-center">Location Colors</h3>
                
                {/* Color Picker - Full height for better visibility */}
                <div className="flex-1 bg-gray-50 rounded-lg p-2 overflow-y-auto min-h-0">
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
            
            {activeEditTab === 'stickers' && (
              <div className="h-full flex flex-col gap-2 justify-center p-3">
                <h3 className="text-base font-semibold text-gray-900 text-center">Add Stickers</h3>
                <button
                  onClick={() => {
                    if (stickerInputRef.current) stickerInputRef.current.click();
                  }}
                  className="w-full py-3 bg-blue-500 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors"
                >
                  <FontAwesomeIcon icon={faGift} className="text-base" />
                  Choose Stickers
                </button>
              </div>
            )}
            
            {activeEditTab === 'write' && (
              <div className="h-full flex items-center justify-center p-3">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <FontAwesomeIcon icon={faPencil} className="text-white text-xl" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Writing Mode</h3>
                  <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                    Type and watch your words appear on the journal
                  </p>
                  <button
                    onClick={closeWriting}
                    className="px-6 py-2 bg-gray-100 text-gray-900 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
            
            {/* Default state */}
            {activeEditTab === 'none' && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <span className="text-gray-600 text-2xl">📝</span>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Your Journal</h2>
                  <p className="text-sm text-gray-600">
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
      
      {/* Hidden sticker input */}
      <input
        ref={stickerInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleStickerUpload}
        multiple
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
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
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
          
          /* Mobile inline calendar styles */
          .react-datepicker-custom-mobile {
            border: none !important;
            border-radius: 6px;
            box-shadow: none !important;
            font-family: 'Inter', system-ui, sans-serif;
            font-size: 11px;
            background: white;
            width: 100% !important;
            margin: 0 auto;
            display: flex !important;
            flex-direction: column !important;
            height: 100% !important;
            max-height: 100% !important;
            overflow: hidden !important;
          }
          
          .react-datepicker-custom-mobile .react-datepicker__header {
            background: #f9fafb;
            border-bottom: 1px solid #e5e7eb;
            border-radius: 6px 6px 0 0;
            padding: 4px 0;
            flex-shrink: 0;
          }
          
          .react-datepicker-custom-mobile .react-datepicker__current-month {
            font-weight: 600;
            font-size: 12px;
            color: #374151;
            margin-bottom: 2px;
          }
          
          .react-datepicker-custom-mobile .react-datepicker__day-names {
            margin-bottom: 1px;
            display: flex;
            justify-content: space-between;
            padding: 0 4px;
          }
          
          .react-datepicker-custom-mobile .react-datepicker__day-name {
            color: #6b7280;
            font-weight: 500;
            font-size: 9px;
            flex: 1;
            line-height: 20px;
            text-align: center;
          }
          
          .react-datepicker-custom-mobile .react-datepicker__month {
            padding: 2px;
            background: white;
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-evenly;
            min-height: 0;
            overflow: hidden;
          }
          
          .react-datepicker-custom-mobile .react-datepicker__week {
            display: flex;
            justify-content: space-between;
            flex: 1;
            align-items: center;
          }
          
          .react-datepicker-custom-mobile .react-datepicker__day {
            border-radius: 4px;
            margin: 0.5px;
            color: #374151;
            font-size: 10px;
            font-weight: 500;
            transition: all 0.2s ease;
            flex: 1;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 24px;
            max-height: 36px;
          }
          
          /* Responsive calendar adjustments for different screen sizes */
          @media screen and (max-height: 700px) {
            .react-datepicker-custom-mobile .react-datepicker__day {
              min-height: 20px;
              max-height: 28px;
              font-size: 9px;
            }
            
            .react-datepicker-custom-mobile .react-datepicker__current-month {
              font-size: 11px;
            }
            
            .react-datepicker-custom-mobile .react-datepicker__day-name {
              font-size: 8px;
              line-height: 16px;
            }
          }
          
          @media screen and (max-height: 600px) {
            .react-datepicker-custom-mobile .react-datepicker__day {
              min-height: 18px;
              max-height: 24px;
              font-size: 8px;
              margin: 0.25px;
            }
            
            .react-datepicker-custom-mobile .react-datepicker__current-month {
              font-size: 10px;
              margin-bottom: 1px;
            }
            
            .react-datepicker-custom-mobile .react-datepicker__day-name {
              font-size: 7px;
              line-height: 14px;
            }
            
            .react-datepicker-custom-mobile .react-datepicker__header {
              padding: 2px 0;
            }
          }
          
          /* iPhone SE and smaller screens */
          @media screen and (max-height: 500px) {
            .react-datepicker-custom-mobile .react-datepicker__day {
              min-height: 14px;
              max-height: 18px;
              font-size: 6px;
              margin: 0.1px;
            }
            
            .react-datepicker-custom-mobile .react-datepicker__current-month {
              font-size: 8px;
              margin-bottom: 1px;
            }
            
            .react-datepicker-custom-mobile .react-datepicker__day-name {
              font-size: 5px;
              line-height: 10px;
            }
            
            .react-datepicker-custom-mobile .react-datepicker__header {
              padding: 1px 0;
            }
            
            .react-datepicker-custom-mobile .react-datepicker__month {
              padding: 0px;
            }
            
            .react-datepicker-custom-mobile .react-datepicker__navigation {
              top: 3px;
              width: 14px;
              height: 14px;
            }
            
            .react-datepicker-custom-mobile .react-datepicker__navigation--previous {
              left: 4px;
            }
            
            .react-datepicker-custom-mobile .react-datepicker__navigation--next {
              right: 4px;
            }
          }
          
          /* Ultra-compact for very small screens (iPhone SE and similar) */
          @media screen and (max-height: 500px) {
            .react-datepicker-custom-mobile {
              font-size: 8px !important;
            }
            
            .react-datepicker-custom-mobile .react-datepicker__day {
              min-height: 10px !important;
              max-height: 14px !important;
              font-size: 4px !important;
              margin: 0px !important;
              padding: 0px !important;
            }
            
            .react-datepicker-custom-mobile .react-datepicker__current-month {
              font-size: 6px !important;
              margin-bottom: 0px !important;
            }
            
            .react-datepicker-custom-mobile .react-datepicker__day-name {
              font-size: 3px !important;
              line-height: 6px !important;
            }
            
            .react-datepicker-custom-mobile .react-datepicker__header {
              padding: 0px !important;
            }
            
            .react-datepicker-custom-mobile .react-datepicker__month {
              padding: 0px !important;
            }
            
            .react-datepicker-custom-mobile .react-datepicker__week {
              margin-bottom: 0px !important;
            }
            
            .react-datepicker-custom-mobile .react-datepicker__navigation {
              top: 1px !important;
              width: 10px !important;
              height: 10px !important;
            }
          }
          
          /* Even more compact for very small screens */
          @media screen and (max-height: 400px) {
            .react-datepicker-custom-mobile .react-datepicker__day {
              min-height: 8px !important;
              max-height: 12px !important;
              font-size: 3px !important;
              margin: 0px !important;
            }
            
            .react-datepicker-custom-mobile .react-datepicker__current-month {
              font-size: 5px !important;
              margin-bottom: 0px !important;
            }
            
            .react-datepicker-custom-mobile .react-datepicker__day-name {
              font-size: 2px !important;
              line-height: 4px !important;
            }
          }
          
          .react-datepicker-custom-mobile .react-datepicker__day--selected {
            background-color: #3b82f6 !important;
            color: white;
            font-weight: 600;
          }
          
          .react-datepicker-custom-mobile .react-datepicker__day:hover {
            background-color: #eff6ff;
            color: #1e40af;
          }
          
          .react-datepicker-custom-mobile .react-datepicker__navigation {
            top: 6px;
            width: 18px;
            height: 18px;
            border-radius: 3px;
            background: white;
            border: 1px solid #e5e7eb;
          }
          
          .react-datepicker-custom-mobile .react-datepicker__navigation--previous {
            left: 6px;
          }
          
          .react-datepicker-custom-mobile .react-datepicker__navigation--next {
            right: 6px;
          }
        `}
      </style>
    </div>
  );
};

export default MobileJournalEditor; 