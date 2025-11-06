import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import JournalCanvas, { JournalCanvasHandle } from './JournalCanvas';
import TempColorPicker, { TextColors } from './TempColorPicker';

// Color functions are now handled by TempColorPicker

// Default colors
const DEFAULT_COLORS: TextColors = {
  locationColor: '#3498DB',
  locationShadowColor: '#1D3557',
};

// Color presets are now handled by TempColorPicker

// Color extraction is now handled by TempColorPicker

// Modern SVG Icons
const Icons = {
  FaPen: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  FaShare: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
    </svg>
  ),
  FaCalendarAlt: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  FaMapMarkerAlt: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  FaPalette: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17v4a2 2 0 002 2h4" />
    </svg>
  ),
  FaImage: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  FaDownload: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  FaTrash: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
};

interface ImagePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  originalWidth?: number;
  originalHeight?: number;
}

interface MobileJournalProps {
  initialDate?: Date;
  initialLocation?: string;
  initialText?: string;
  initialImages?: (string | Blob)[];
  initialColors?: TextColors;
}

const MobileJournal: React.FC<MobileJournalProps> = ({
  initialDate,
  initialLocation = '',
  initialText = '',
  initialImages = [],
  initialColors = DEFAULT_COLORS
}) => {
  // Initialize with today's date at noon to avoid timezone issues
  const getTodayAtNoon = () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return today;
  };

  const [date, setDate] = useState<Date>(initialDate || getTodayAtNoon());
  const [location, setLocation] = useState<string>(initialLocation);
  const [text, setText] = useState<string>(initialText);
  const [images, setImages] = useState<(string | Blob)[]>(initialImages);
  const [colors, setColors] = useState<TextColors>(initialColors);
  // Colors are now handled by TempColorPicker
  const [isExporting, setIsExporting] = useState(false);
  const [imagePositions, setImagePositions] = useState<ImagePosition[]>([]);

  // Mania logo animation states
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [showGlitch, setShowGlitch] = useState(false);

  const navigate = useNavigate();
  const canvasRef = useRef<JournalCanvasHandle>(null);

  // Debug statement removed

  // Mania logo animation effect
  useEffect(() => {
    const styleInterval = setInterval(() => {
      // Pick a random letter to highlight instead of cycling sequentially
      const randomIndex = Math.floor(Math.random() * 5);
      setHighlightIndex(randomIndex);
    }, 200); // Fast random cycling

    const glitchInterval = setInterval(() => {
      // Random glitch effect
      if (Math.random() > 0.7) {
        setShowGlitch(true);
        setTimeout(() => setShowGlitch(false), 150);
      }
    }, 1200);

    return () => {
      clearInterval(styleInterval);
      clearInterval(glitchInterval);
    };
  }, []);

  // Render the mania title with one highlighted letter at a time
  const renderManiaTitle = () => {
    const word = "mania";

    return (
      <span className="title-container">
        {word.split('').map((letter, index) => (
          <span
            key={`letter-${index}-${highlightIndex}`}
            className={index === highlightIndex
              ? "letter-highlight"
              : "letter-normal"}
          >
            {letter}
          </span>
        ))}
      </span>
    );
  };

  const hasContent = useMemo(() => {
    const content = Boolean(location.trim() || text.trim() || images.length > 0);
    // Debug statement removed
    return content;
  }, [location, text, images]);

  // Calculate proper image dimensions while preserving aspect ratio
  const calculateImageDimensions = useCallback(async (image: string | Blob, maxDimension: number = 600): Promise<{ width: number; height: number; originalWidth: number; originalHeight: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const originalWidth = img.naturalWidth;
        const originalHeight = img.naturalHeight;
        const aspectRatio = originalWidth / originalHeight;

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

        resolve({
          width: Math.round(width),
          height: Math.round(height),
          originalWidth,
          originalHeight
        });
      };
      img.onerror = () => {
        resolve({ width: 600, height: 400, originalWidth: 600, originalHeight: 400 });
      };
      img.src = typeof image === 'string' ? image : URL.createObjectURL(image);
    });
  }, []);

  // Image handling
  const handleAddImages = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newImages: (string | Blob)[] = Array.from(files);
    const newPositions: ImagePosition[] = [];

    // Canvas dimensions (from JournalCanvas.tsx)
    const canvasWidth = 1860;
    const canvasHeight = 2620;

    // Process each image to get proper dimensions
    for (let i = 0; i < newImages.length; i++) {
      const image = newImages[i];
      // Use larger max dimension to match canvas scale
      const dimensions = await calculateImageDimensions(image, 600);

      // Calculate center position
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;

      // Position images with offsets from center to prevent overlap
      const currentImageCount = images.length + i;
      const offsetX = (currentImageCount % 3 - 1) * 300; // Spread horizontally
      const offsetY = Math.floor(currentImageCount / 3) * 200; // Stack vertically

      const newPosition = {
        x: centerX - dimensions.width / 2 + offsetX,
        y: centerY - dimensions.height / 2 + offsetY,
        width: dimensions.width,
        height: dimensions.height,
        rotation: 0,
        originalWidth: dimensions.originalWidth,
        originalHeight: dimensions.originalHeight
      };

      newPositions.push(newPosition);
    }

    setImages(prev => [...prev, ...newImages]);
    setImagePositions(prev => [...prev, ...newPositions]);

    // TempColorPicker will handle color extraction automatically
  }, [images.length, imagePositions.length, calculateImageDimensions]);

  // Canvas callbacks for image manipulation
  const handleImageDrag = useCallback((index: number, x: number, y: number) => {
    setImagePositions(prev => {
      const newPositions = [...prev];
      if (newPositions[index]) {
        newPositions[index] = { ...newPositions[index], x, y };
      }
      return newPositions;
    });
  }, []);

  const handleImageResize = useCallback((index: number, width: number, height: number) => {
    setImagePositions(prev => {
      const newPositions = [...prev];
      if (newPositions[index]) {
        newPositions[index] = { ...newPositions[index], width, height };
      }
      return newPositions;
    });
  }, []);

  const handleImageDelete = useCallback((index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePositions(prev => prev.filter((_, i) => i !== index));
  }, []);



  // Export functionality
  const exportPDF = useCallback(async () => {
    if (!canvasRef.current) return;
    
    setIsExporting(true);
    try {
      await canvasRef.current.exportUltraHDPDF();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, []);



  // Reset functionality
  const reset = useCallback(() => {
    setDate(getTodayAtNoon());
    setLocation('');
    setText('');
    setImages([]);
    setImagePositions([]);
    setColors(DEFAULT_COLORS);
  }, []);

  // Convert imagePositions to the format expected by JournalCanvas
  const canvasImagePositions = useMemo(() => {
    // Canvas dimensions (from JournalCanvas.tsx)
    const canvasWidth = 1860;
    const canvasHeight = 2620;

    // Ensure we have positions for all images
    const result = images.map((_, index) => {
      const position = imagePositions[index];
      if (position) {
        return {
          x: position.x,
          y: position.y,
          width: position.width,
          height: position.height,
          rotation: position.rotation || 0
        };
      } else {
        // Fallback position if none exists - center with offset
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        const offsetX = (index % 3 - 1) * 300;
        const offsetY = Math.floor(index / 3) * 200;

        return {
          x: centerX - 300 + offsetX,
          y: centerY - 200 + offsetY,
          width: 600,
          height: 400,
          rotation: 0
        };
      }
    });

    return result;
  }, [images, imagePositions]);



  // Debug effect to track state changes
  useEffect(() => {
    // Debug statement removed
  }, [images, imagePositions, canvasImagePositions]);

  return (
    <div className="mobile-journal bg-black w-full min-h-screen flex flex-col relative select-none">
      {/* Single scrollable page with all sections */}
      <div className="flex-1 overflow-y-auto pb-safe-area-inset-bottom sm:pb-8" style={{ scrollbarGutter: 'stable' }}>
        {/* Mania Logo Section */}
        <section className="!p-0 border-b border-white/10">
          <div className="flex flex-col items-center justify-center py-8 px-6">
            <h1
              className="font-bold text-7xl md:text-6xl mb-6 text-center mania-title text-white text-flicker"
              style={{
                filter: showGlitch ? 'hue-rotate(90deg) brightness(1.5)' : 'none',
                transition: 'filter 0.1s'
              }}
            >
              {renderManiaTitle()}
            </h1>
          </div>

          {/* Journal Canvas with Integrated Image Handling */}
          <div className="relative w-full bg-white overflow-hidden" style={{
            paddingTop: '141.4%', /* This creates a 1:√2 aspect ratio (A4 proportion) */
            height: 'auto',
            touchAction: 'none',
            borderRadius: 0,
            margin: 0
          }}>
            <div className="absolute inset-0" style={{ touchAction: 'none', userSelect: 'none' }}>
              <JournalCanvas
              ref={canvasRef}
              date={date}
              location={location}
              textSections={[text]}
              images={images}
              onNewEntry={reset}
              textColors={colors}
              layoutMode="freeflow"
              editMode={true} // Enable edit mode for image manipulation
              savedImagePositions={canvasImagePositions}
              onImageDrag={handleImageDrag}
              onImageResize={handleImageResize}
              onImageDelete={handleImageDelete}
            />
            </div>
          </div>
        </section>



        {/* Write Your Entry Section */}
        <section className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-6 h-6 border border-white/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white font-mono tracking-wide">Write Your Entry</h2>
          </div>

          <div className="space-y-6">
            {/* Date and Location Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-mono text-white/70 tracking-wider">
                  <svg className="w-3 h-3 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  DATE
                </label>
                <input
                  type="date"
                  className="w-full bg-black/50 border border-white/30 rounded-lg px-4 py-3 text-white font-mono placeholder-white/50 focus:outline-none focus:border-white/60 transition-all duration-200"
                  value={date.toISOString().split('T')[0]}
                  onChange={(e) => {
                    // Parse the date string and set time to noon to avoid timezone issues
                    const [year, month, day] = e.target.value.split('-').map(Number);
                    const newDate = new Date(year, month - 1, day, 12, 0, 0, 0);
                    setDate(newDate);
                  }}
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-mono text-white/70 tracking-wider">
                  <svg className="w-3 h-3 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  LOCATION
                </label>
                <input
                  type="text"
                  placeholder="Where are you?"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-black/50 border border-white/30 rounded-lg px-4 py-3 text-white font-mono placeholder-white/50 focus:outline-none focus:border-white/60 transition-all duration-200"
                />
              </div>
            </div>

            {/* Add Images */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-mono text-white/70 tracking-wider">
                <svg className="w-3 h-3 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                ADD IMAGES
              </label>
              <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.multiple = true;
                  input.onchange = (e) => {
                    const target = e.target as HTMLInputElement;
                    handleAddImages(target.files);
                  };
                  input.click();
                }}
                className="w-full bg-black/50 border border-white/30 rounded-lg px-4 py-4 text-white/80 hover:bg-black/70 hover:border-white/50 transition-all duration-200 flex items-center justify-center gap-3 font-mono"
              >
                <span className="text-lg">+</span>
                <span>Choose Files</span>
              </button>
            </div>

            {/* Journal Text */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-mono text-white/70 tracking-wider">
                <svg className="w-3 h-3 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                YOUR THOUGHTS
              </label>
              <textarea
                placeholder="Pour your heart out..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={7}
                className="w-full bg-black/50 border border-white/30 rounded-lg px-4 py-4 text-white placeholder-white/50 focus:outline-none focus:border-white/60 transition-all duration-200 resize-none overflow-y-auto font-mono"
                style={{
                  maxHeight: '280px',
                  minHeight: '200px'
                }}
              />
            </div>

            {/* Text Colors */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-mono text-white/70 tracking-wider">
                <svg className="w-3 h-3 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17v4a2 2 0 002 2h4" />
                </svg>
                TEXT COLORS
              </label>
              <div className="bg-black/40 border border-white/30 rounded-lg p-4">
                <TempColorPicker
                  colors={colors}
                  onChange={setColors}
                  images={images}
                  compact={true}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Actions Section */}
        <section className="p-6 pb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-6 h-6 border border-white/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white font-mono tracking-wide">Actions</h2>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <button
              className="w-full flex items-center justify-center gap-4 py-4 bg-black/50 border border-white/30 rounded-lg text-white hover:bg-black/70 hover:border-white/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
              onClick={exportPDF}
              disabled={isExporting || !hasContent}
            >
              {isExporting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>EXPORTING...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>SAVE AS PDF</span>
                </>
              )}
            </button>

            <button
              className="w-full flex items-center justify-center gap-4 py-4 bg-black/50 border border-white/30 rounded-lg text-white hover:bg-black/70 hover:border-white/50 transition-all duration-200 font-mono"
              onClick={reset}
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>RESET ENTRY</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default MobileJournal;
