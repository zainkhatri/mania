import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import JournalCanvas, { JournalCanvasHandle } from './JournalCanvas';
import TempColorPicker, { TextColors } from './TempColorPicker';

// Default colors
const DEFAULT_COLORS: TextColors = {
  locationColor: '#3498DB',
  locationShadowColor: '#1D3557',
};

// Modern SVG Icons
const Icons = {
  Download: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Trash: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  Image: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Calendar: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Location: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Palette: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
  ),
  ChevronDown: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  Pen: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  ),
  CalendarLocation: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11v6m0 0l-2-2m2 2l2-2" />
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
  initialDate = new Date(),
  initialLocation = '',
  initialText = '',
  initialImages = [],
  initialColors = DEFAULT_COLORS
}) => {
  const [date, setDate] = useState<Date>(initialDate);
  const [location, setLocation] = useState<string>(initialLocation);
  const [text, setText] = useState<string>(initialText);
  const [images, setImages] = useState<(string | Blob)[]>(initialImages);
  const [colors, setColors] = useState<TextColors>(initialColors);
  const [isExporting, setIsExporting] = useState(false);
  const [imagePositions, setImagePositions] = useState<ImagePosition[]>([]);
  const [expandedSection, setExpandedSection] = useState<string>('entry');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [showGlitch, setShowGlitch] = useState(false);

  const canvasRef = useRef<JournalCanvasHandle>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Mania title animation effect
  useEffect(() => {
    const styleInterval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * 5);
      setHighlightIndex(randomIndex);
    }, 200);

    const glitchInterval = setInterval(() => {
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

  const hasContent = useMemo(() => {
    return Boolean(location.trim() || text.trim() || images.length > 0);
  }, [location, text, images]);

  const calculateImageDimensions = useCallback(async (image: string | Blob, maxDimension: number = 400): Promise<{ width: number; height: number; originalWidth: number; originalHeight: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const originalWidth = img.naturalWidth;
        const originalHeight = img.naturalHeight;
        const aspectRatio = originalWidth / originalHeight;

        let width, height;
        if (aspectRatio > 1) {
          width = maxDimension;
          height = maxDimension / aspectRatio;
        } else {
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
        resolve({ width: 300, height: 200, originalWidth: 300, originalHeight: 200 });
      };
      img.src = typeof image === 'string' ? image : URL.createObjectURL(image);
    });
  }, []);

  const handleAddImages = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newImages: (string | Blob)[] = Array.from(files);
    const newPositions: ImagePosition[] = [];

    for (let i = 0; i < newImages.length; i++) {
      const image = newImages[i];
      const dimensions = await calculateImageDimensions(image);

      const offsetX = i * 50;
      const offsetY = i * 50;

      const newPosition = {
        x: 100 + offsetX,
        y: 200 + offsetY,
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
  }, [images.length, calculateImageDimensions]);

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

  const reset = useCallback(() => {
    setDate(new Date());
    setLocation('');
    setText('');
    setImages([]);
    setImagePositions([]);
    setColors(DEFAULT_COLORS);
  }, []);

  const canvasImagePositions = useMemo(() => {
    return images.map((_, index) => {
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
        return {
          x: 100 + (index * 50),
          y: 200 + (index * 50),
          width: 400,
          height: 300,
          rotation: 0
        };
      }
    });
  }, [images, imagePositions]);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? '' : section);
  };

  // Render the mania title with animation
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

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* TV static background video - same as desktop */}
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        className="fixed inset-0 w-full h-full object-cover z-0 static-bg"
      >
        <source src="/background/static.webm" type="video/webm" />
      </video>

      {/* Dark overlay for content readability */}
      <div className="fixed inset-0 bg-black/60 z-0" />

      {/* Main Content with backdrop blur */}
      <div className="relative z-10">
        {/* Floating Action Buttons - Fixed at Bottom */}
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-black via-black/95 to-transparent backdrop-blur-xl border-t border-white/10">
          <div className="max-w-md mx-auto flex gap-3">
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              className="flex-1 flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-white/20 to-white/10 rounded-2xl text-white font-semibold shadow-2xl shadow-white/10 disabled:opacity-50 disabled:shadow-none backdrop-blur-lg border border-white/20 hover:border-white/40"
              onClick={exportPDF}
              disabled={isExporting || !hasContent}
            >
              {isExporting ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                  />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <motion.div
                    animate={{ y: [0, 3, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Icons.Download />
                  </motion.div>
                  <span>Save PDF</span>
                </>
              )}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              className="px-4 py-4 bg-white/10 border border-white/20 rounded-2xl text-white shadow-xl backdrop-blur-lg hover:bg-white/20 transition-colors"
              onClick={reset}
            >
              <Icons.Trash />
            </motion.button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="pb-32 overflow-y-auto">
          {/* Preview Section - Always Open */}
          <motion.div
            className="border-b border-white/10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-full p-4 text-white backdrop-blur-sm flex justify-center">
              <h1
                className="text-4xl font-bold text-flicker"
                style={{
                  filter: showGlitch ? 'hue-rotate(90deg) brightness(1.5)' : 'none',
                  transition: 'filter 0.1s'
                }}
              >
                {renderManiaTitle()}
              </h1>
            </div>

            <div className="p-4 pt-0">
              <motion.div
                className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/20"
                whileHover={{ scale: 1.01 }}
                transition={{ duration: 0.2 }}
                style={{ position: 'relative' }}
              >
                {/* Background video for preview */}
                <video
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover z-0"
                >
                  <source src="/background/static.webm" type="video/webm" />
                </video>

                <div className="relative w-full" style={{
                  paddingTop: '141.4%',
                  touchAction: 'none'
                }}>
                  <div className="absolute inset-0 bg-white" style={{ touchAction: 'none', userSelect: 'none', zIndex: 1 }}>
                    <JournalCanvas
                      ref={canvasRef}
                      date={date}
                      location={location}
                      textSections={[text]}
                      images={images}
                      onNewEntry={reset}
                      textColors={colors}
                      layoutMode="freeflow"
                      editMode={true}
                      savedImagePositions={canvasImagePositions}
                      onImageDrag={handleImageDrag}
                      onImageResize={handleImageResize}
                      onImageDelete={handleImageDelete}
                    />
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* 1. Date & Location Section - Collapsible */}
          <motion.div
            className="border-b border-white/10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => toggleSection('entry')}
              className="w-full p-4 flex items-center justify-between text-white backdrop-blur-sm"
            >
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Icons.CalendarLocation />
                Date & Location
              </h2>
              <motion.div
                animate={{ rotate: expandedSection === 'entry' ? 180 : 0 }}
                transition={{ duration: 0.3, type: "spring" }}
              >
                <Icons.ChevronDown />
              </motion.div>
            </motion.button>

            <AnimatePresence>
              {expandedSection === 'entry' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, type: "spring" }}
                  className="overflow-hidden"
                >
                  <div className="p-4 pt-0 space-y-4">
                    {/* 1. Date and Location */}
                    <div className="grid grid-cols-2 gap-3">
                      <motion.div
                        className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/20"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-400 mb-2">
                          <Icons.Calendar />
                          Date
                        </label>
                        <input
                          type="date"
                          className="w-full bg-transparent text-white text-sm focus:outline-none"
                          value={new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0]}
                          onChange={(e) => setDate(new Date(e.target.value))}
                        />
                      </motion.div>

                      <motion.div
                        className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/20"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-400 mb-2">
                          <Icons.Location />
                          Location
                        </label>
                        <input
                          type="text"
                          placeholder="Where?"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          className="w-full bg-transparent text-white text-sm placeholder-white/40 focus:outline-none"
                        />
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* 2. Colors Section - Collapsible */}
          <motion.div
            className="border-b border-white/10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => toggleSection('colors')}
              className="w-full p-4 flex items-center justify-between text-white backdrop-blur-sm"
            >
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Icons.Palette />
                Colors
              </h2>
              <motion.div
                animate={{ rotate: expandedSection === 'colors' ? 180 : 0 }}
                transition={{ duration: 0.3, type: "spring" }}
              >
                <Icons.ChevronDown />
              </motion.div>
            </motion.button>

            <AnimatePresence>
              {expandedSection === 'colors' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, type: "spring" }}
                  className="overflow-hidden"
                >
                  <div className="p-4 pt-0">
                    <motion.div
                      className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/20"
                      whileHover={{ scale: 1.01 }}
                    >
                      <TempColorPicker
                        colors={colors}
                        onChange={setColors}
                        images={images}
                        compact={true}
                      />
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* 3. Images Section - Collapsible */}
          <motion.div
            className="border-b border-white/10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => toggleSection('images')}
              className="w-full p-4 flex items-center justify-between text-white backdrop-blur-sm"
            >
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Icons.Image />
                Images
              </h2>
              <motion.div
                animate={{ rotate: expandedSection === 'images' ? 180 : 0 }}
                transition={{ duration: 0.3, type: "spring" }}
              >
                <Icons.ChevronDown />
              </motion.div>
            </motion.button>

            <AnimatePresence>
              {expandedSection === 'images' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, type: "spring" }}
                  className="overflow-hidden"
                >
                  <div className="p-4 pt-0">
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      whileHover={{ scale: 1.01 }}
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
                      className="w-full bg-white/5 backdrop-blur-md border border-white/20 border-dashed rounded-2xl p-4 text-white/60 hover:bg-white/10 hover:text-white transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <Icons.Image />
                      <span className="font-medium">Add Images</span>
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* 4. Journal Entry Section - Collapsible */}
          <motion.div
            className="border-b border-white/10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => toggleSection('text')}
              className="w-full p-4 flex items-center justify-between text-white backdrop-blur-sm"
            >
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Icons.Pen />
                Journal Entry
              </h2>
              <motion.div
                animate={{ rotate: expandedSection === 'text' ? 180 : 0 }}
                transition={{ duration: 0.3, type: "spring" }}
              >
                <Icons.ChevronDown />
              </motion.div>
            </motion.button>

            <AnimatePresence>
              {expandedSection === 'text' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, type: "spring" }}
                  className="overflow-hidden"
                >
                  <div className="p-4 pt-0">
                    <motion.div
                      className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/20"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <textarea
                        placeholder="What's on your mind?"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={6}
                        className="w-full bg-transparent text-white placeholder-white/40 focus:outline-none resize-none"
                      />
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default MobileJournal;
