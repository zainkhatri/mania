import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import JournalCanvas, { JournalCanvasHandle } from './JournalCanvas';
import { TextColors } from './ColorPicker';

// Helper function to get complementary shadow color
const getComplementaryColor = (hex: string, offset: number = 30): string => {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) {
    return '#1D3557'; // Default shadow color if invalid input
  }

  // Convert hex to RGB
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  // Create a darker shadow (offset% darker)
  const shadowR = Math.max(0, Math.floor(r * (1 - offset / 100)));
  const shadowG = Math.max(0, Math.floor(g * (1 - offset / 100)));
  const shadowB = Math.max(0, Math.floor(b * (1 - offset / 100)));
  
  // Convert to hex
  return `#${shadowR.toString(16).padStart(2, '0')}${shadowG.toString(16).padStart(2, '0')}${shadowB.toString(16).padStart(2, '0')}`;
};

// Default colors
const DEFAULT_COLORS: TextColors = {
  locationColor: '#3498DB',
  locationShadowColor: '#1D3557',
};

// Color presets (same as desktop version)
const COLOR_PRESETS = [
  '#FF6B6B', '#FF8E53', '#FFD93D', '#6BCF7F', 
  '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE',
  '#85C1E9', '#F8C471', '#F1948A', '#A9DFBF'
];

// Function to extract dominant colors from an image
const extractDominantColors = async (imageUrl: string): Promise<string[]> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(COLOR_PRESETS);
        return;
      }

      // Scale down image for faster processing
      const scale = Math.min(100 / img.width, 100 / img.height);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Sample pixels and count colors
      const colorCounts: { [key: string]: number } = {};
      const step = 4; // Sample every 4th pixel for performance

      for (let i = 0; i < data.length; i += step * 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Skip very light or very dark colors
        const brightness = (r + g + b) / 3;
        if (brightness < 30 || brightness > 225) continue;

        // Quantize colors to reduce similar shades
        const quantizedR = Math.round(r / 32) * 32;
        const quantizedG = Math.round(g / 32) * 32;
        const quantizedB = Math.round(b / 32) * 32;
        
        const colorKey = `#${quantizedR.toString(16).padStart(2, '0')}${quantizedG.toString(16).padStart(2, '0')}${quantizedB.toString(16).padStart(2, '0')}`;
        colorCounts[colorKey] = (colorCounts[colorKey] || 0) + 1;
      }

      // Get top 8 most common colors
      const sortedColors = Object.entries(colorCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8)
        .map(([color]) => color);

      resolve(sortedColors.length > 0 ? sortedColors : COLOR_PRESETS);
    };
    img.onerror = () => resolve(COLOR_PRESETS);
    img.src = imageUrl;
  });
};

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
  const [extractedColors, setExtractedColors] = useState<string[]>(COLOR_PRESETS);
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
        originalWidth: dimensions.originalWidth,
        originalHeight: dimensions.originalHeight
      };
      
      console.log('🖼️ MOBILE DEBUG: Created position for image', i, ':', newPosition);
      newPositions.push(newPosition);
    }
    
    console.log('🖼️ MOBILE DEBUG: Setting new images and positions');
    setImages(prev => [...prev, ...newImages]);
    setImagePositions(prev => [...prev, ...newPositions]);

    // Extract colors from the first image for color palette
    if (newImages.length > 0) {
      try {
        const firstImage = newImages[0];
        const imageUrl = typeof firstImage === 'string' ? firstImage : URL.createObjectURL(firstImage);
        const dominantColors = await extractDominantColors(imageUrl);
        setExtractedColors(dominantColors);
        
        // If this is the first image, also set the first extracted color as the current color
        if (images.length === 0 && dominantColors.length > 0) {
          setColors({
            locationColor: dominantColors[0],
            locationShadowColor: getComplementaryColor(dominantColors[0], 30)
          });
        }
      } catch (error) {
        console.error('Failed to extract colors from image:', error);
      }
    }
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

  // Share functionality - directly create and share PDF
  const share = useCallback(async () => {
    try {
      // Always create and share a PDF
      if (hasContent) {
        // Create the PDF first
        await exportPDF();
        
        // Show a success message with sharing instructions
        const shareToast = document.createElement('div');
        shareToast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg z-50 max-w-sm';
        shareToast.innerHTML = `
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
              <div class="font-semibold">PDF Created!</div>
              <div class="text-sm">Check your downloads folder to share via messages, email, etc.</div>
            </div>
          </div>
        `;
        document.body.appendChild(shareToast);
        
        // Remove the toast after 5 seconds
        setTimeout(() => {
          if (document.body.contains(shareToast)) {
            document.body.removeChild(shareToast);
          }
        }, 5000);
      }
    } catch (error) {
      console.error('Share failed:', error);
      // Fallback to regular export if share fails
      exportPDF();
    }
  }, [hasContent, exportPDF]);

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
          height: position.height
        };
      } else {
        // Fallback position if none exists
        return {
          x: 100 + (index * 50),
          y: 200 + (index * 50),
          width: 400,
          height: 300
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
            Journal Preview
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
              <div className="overflow-x-auto pb-2 scrollbar-hide" style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}>
                <div className="flex gap-2 min-w-max px-1" style={{ paddingRight: '20px' }}>
                  {extractedColors.map((color, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        const newColors = {
                          locationColor: color,
                          locationShadowColor: getComplementaryColor(color, 30)
                        };
                        setColors(newColors);
                      }}
                      className={`w-10 h-10 rounded-full border-2 transition-all duration-200 hover:scale-110 ${
                        colors.locationColor === color 
                          ? 'border-white shadow-lg shadow-white/50' 
                          : 'border-white/30 hover:border-white/60'
                      }`}
                      style={{ backgroundColor: color }}
                      title={`Color ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
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
              className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-2xl text-white hover:from-purple-600/30 hover:to-cyan-600/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={share}
              disabled={!hasContent}
            >
              <Icons.FaShare />
              <span className="font-medium">Share Journal</span>
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
