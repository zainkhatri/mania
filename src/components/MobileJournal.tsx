import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
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

// Icons
const Icons = {
  FaEye: () => <span className="text-lg">👁️</span>,
  FaPen: () => <span className="text-lg">✏️</span>,
  FaShare: () => <span className="text-lg">📤</span>,
  FaCalendarAlt: () => <span className="text-lg">📅</span>,
  FaMapMarkerAlt: () => <span className="text-lg">📍</span>,
  FaPalette: () => <span className="text-lg">🎨</span>,
  FaImage: () => <span className="text-lg">🖼️</span>,
  FaDownload: () => <span className="text-lg">⬇️</span>,
  FaTrash: () => <span className="text-lg">🗑️</span>,
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
  // Colors are now handled by TempColorPicker
  const [isExporting, setIsExporting] = useState(false);
  const [imagePositions, setImagePositions] = useState<ImagePosition[]>([]);

  const canvasRef = useRef<JournalCanvasHandle>(null);

  console.log('🔍 MOBILE DEBUG: MobileJournal render - date:', date, 'location:', location, 'text:', text);

  const hasContent = useMemo(() => {
    const content = Boolean(location.trim() || text.trim() || images.length > 0);
    console.log('🔍 INPUT DEBUG: hasContent memoized:', { location: location.trim(), text: text.trim(), imagesCount: images.length, hasContent: content });
    return content;
  }, [location, text, images]);

  // Calculate proper image dimensions while preserving aspect ratio
  const calculateImageDimensions = useCallback(async (image: string | Blob, maxDimension: number = 400): Promise<{ width: number; height: number; originalWidth: number; originalHeight: number }> => {
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
        resolve({ width: 300, height: 200, originalWidth: 300, originalHeight: 200 });
      };
      img.src = typeof image === 'string' ? image : URL.createObjectURL(image);
    });
  }, []);

  // Image handling
  const handleAddImages = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    console.log('🖼️ MOBILE DEBUG: Adding images:', files.length);
    
    const newImages: (string | Blob)[] = Array.from(files);
    const newPositions: ImagePosition[] = [];
    
    // Process each image to get proper dimensions
    for (let i = 0; i < newImages.length; i++) {
      const image = newImages[i];
      const dimensions = await calculateImageDimensions(image);
      
      // Position images with slight offsets to prevent overlap
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
      
      console.log('🖼️ MOBILE DEBUG: Created position for image', i, ':', newPosition);
      newPositions.push(newPosition);
    }
    
    console.log('🖼️ MOBILE DEBUG: Setting new images and positions');
    setImages(prev => [...prev, ...newImages]);
    setImagePositions(prev => [...prev, ...newPositions]);

    // TempColorPicker will handle color extraction automatically
  }, [images.length, calculateImageDimensions]);

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
    setDate(new Date());
    setLocation('');
    setText('');
    setImages([]);
    setImagePositions([]);
    setColors(DEFAULT_COLORS);
  }, []);

  // Convert imagePositions to the format expected by JournalCanvas
  const canvasImagePositions = useMemo(() => {
    console.log('🖼️ MOBILE DEBUG: Converting imagePositions to canvas format:', imagePositions);
    
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
        // Fallback position if none exists
        return {
          x: 100 + (index * 50),
          y: 200 + (index * 50),
          width: 400,
          height: 300,
          rotation: 0
        };
      }
    });
    
    console.log('🖼️ MOBILE DEBUG: Result:', result);
    return result;
  }, [images, imagePositions]);



  // Debug effect to track state changes
  useEffect(() => {
    console.log('🖼️ MOBILE DEBUG: State changed:', {
      images: images.length,
      imagePositions: imagePositions.length,
      canvasImagePositions: canvasImagePositions.length
    });
  }, [images, imagePositions, canvasImagePositions]);

  return (
    <div className="mobile-journal bg-black w-full min-h-screen flex flex-col relative">
      {/* Single scrollable page with all sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Journal Preview Section */}
        <section className="p-4 border-b border-white/10">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
            <Icons.FaEye />
            
          </h2>
          
          <div className="relative bg-gradient-to-br from-[#1a1a1a]/70 to-[#2a2a2a]/70 rounded-2xl overflow-hidden shadow-2xl border border-white/10"
               style={{ aspectRatio: '3/4', minHeight: '400px' }}>
            
            {/* Journal Canvas with Integrated Image Handling */}
            <div className="relative w-full h-full bg-white rounded-xl overflow-hidden">
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
        <section className="p-4 border-b border-white/10">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
            <Icons.FaPen />
            Write Your Entry
          </h2>

          <div className="space-y-4">
            {/* Date and Location Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-white/80">
                  <Icons.FaCalendarAlt />
                  Date
                </label>
                <input
                  type="date"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
                  value={new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0]}
                  onChange={(e) => setDate(new Date(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-white/80">
                  <Icons.FaMapMarkerAlt />
                  Location
                </label>
                <input
                  type="text"
                  placeholder="Where are you?"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
                />
              </div>
            </div>

            {/* Add Images */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-white/80">
                <Icons.FaImage />
                Add Images
              </label>
              <div className="space-y-3">
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
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white hover:bg-white/20 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <Icons.FaImage />
                  Choose Files
                </button>
              </div>
            </div>

            {/* Journal Text */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-white/80">
                <Icons.FaPen />
                Your Thoughts
              </label>
              <textarea
                placeholder="Pour your heart out..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 resize-none overflow-y-auto"
                style={{
                  maxHeight: '200px',
                  minHeight: '120px'
                }}
              />
            </div>

            {/* Text Colors */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-white/80">
                <Icons.FaPalette />
                Text Colors
              </label>
              <TempColorPicker
                colors={colors}
                onChange={setColors}
                images={images}
                compact={true}
              />
            </div>
          </div>
        </section>

        {/* Share Section */}
        <section className="p-4 pb-8">
          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 rounded-2xl text-white hover:from-blue-600/30 hover:to-cyan-600/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={exportPDF}
              disabled={isExporting || !hasContent}
            >
              {isExporting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="font-medium">Exporting...</span>
                </>
              ) : (
                <>
                  <Icons.FaDownload />
                  <span className="font-medium">Save as PDF</span>
                </>
              )}
            </button>
            


            <button
              className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-red-600/20 to-orange-600/20 border border-red-500/30 rounded-2xl text-white hover:from-red-600/30 hover:to-orange-600/30 transition-all duration-200"
              onClick={reset}
            >
              <Icons.FaTrash />
              <span className="font-medium">Reset Entry</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default MobileJournal;
