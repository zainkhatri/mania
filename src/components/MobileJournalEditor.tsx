import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import JournalCanvas from './JournalCanvas';
import 'react-datepicker/dist/react-datepicker.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faLocationDot, 
  faCamera, 
  faPencil,
  faImage
} from '@fortawesome/free-solid-svg-icons';
import SimpleColorPicker from './TempColorPicker';
import LayoutToggle from './LayoutToggle';

interface Region {
  id: string;
  type: 'location' | 'image' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  index?: number;
  locked?: boolean;
}

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

const GRID_SIZE = 1; // 1% grid

// Add shuffle text utility function
const shuffleText = (text: string): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return text
    .split('')
    .map(char => char === ' ' ? ' ' : chars[Math.floor(Math.random() * chars.length)])
    .join('');
};

// Color constants
const MANIA_COLORS = {
  black: 'rgba(0, 0, 0, 0.85)',
  white: 'rgba(255, 255, 255, 0.85)',
  background: '#f5f3e8',
};

const MobileJournalEditor: React.FC<MobileJournalEditorProps> = ({ onUpdate, initialData }) => {
  const [date, setDate] = useState<Date>(initialData?.date || new Date());
  const [location, setLocation] = useState(initialData?.location || '');
  const [images, setImages] = useState<(string | Blob)[]>(initialData?.images || []);
  const [textSections, setTextSections] = useState<string[]>(initialData?.textSections || ['', '', '']);
  const [activeTextArea, setActiveTextArea] = useState<number | null>(null);
  const [textColors, setTextColors] = useState({
    locationColor: '#3498DB',
    locationShadowColor: '#AED6F1'
  });
  const [layoutMode, setLayoutMode] = useState<'standard' | 'mirrored'>('standard');
  const [shuffledTitles, setShuffledTitles] = useState<{ [key: string]: string }>({});
  const shuffleIntervalsRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  
  const journalCanvasRef = useRef(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const textInputRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  // Updated regions based on layout mode
  const getRegions = (layoutMode: 'standard' | 'mirrored') => {
    const isStandard = layoutMode === 'standard';
    
    return [
      { 
        id: 'location', 
        type: 'location', 
        x: 0,      // Full width at top
        y: 5,      // Just below date
        width: 100,// Full width
        height: 6  // Reduced height for location
      },
      { 
        id: 'image-1', 
        type: 'image',
        x: isStandard ? 2 : 54,     // Swap sides based on layout
        y: 13,     // Below location
        width: 50, // Consistent width
        height: 27 // Same height
      },
      { 
        id: 'text-1', 
        type: 'text',
        x: isStandard ? 55 : 2,     // Swap sides based on layout
        y: 13,     // Same as image-1
        width: 44, // Consistent width
        height: 27 // Same height
      },
      { 
        id: 'text-2', 
        type: 'text',
        x: isStandard ? 2 : 54,     // Swap sides based on layout
        y: 42,     // Below first row
        width: 44, // Consistent width
        height: 27 // Same height
      },
      { 
        id: 'image-2', 
        type: 'image',
        x: isStandard ? 47 : 2,     // Swap sides based on layout
        y: 42,     // Same vertical position
        width: 50, // Consistent width
        height: 27 // Same height
      },
      { 
        id: 'image-3', 
        type: 'image',
        x: isStandard ? 2 : 54,     // Swap sides based on layout
        y: 72,     // Below second row
        width: 50, // Consistent width
        height: 27 // Same height
      },
      { 
        id: 'text-3', 
        type: 'text',
        x: isStandard ? 55 : 2,     // Swap sides based on layout
        y: 72,     // Same vertical position
        width: 44, // Consistent width
        height: 27 // Same height
      }
    ];
  };

  useEffect(() => {
    // Ensure the body can scroll
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    document.getElementById('root')!.style.overflow = 'auto';
    
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.getElementById('root')!.style.overflow = '';
    };
  }, []);

  // Function to start title shuffle animation
  const startTitleShuffle = (regionId: string, originalTitle: string) => {
    let iterations = 0;
    const maxIterations = 10;
    const interval = 50;

    if (shuffleIntervalsRef.current[regionId]) {
      clearInterval(shuffleIntervalsRef.current[regionId]);
    }

    shuffleIntervalsRef.current[regionId] = setInterval(() => {
      if (iterations >= maxIterations) {
        clearInterval(shuffleIntervalsRef.current[regionId]);
        setShuffledTitles(prev => ({ ...prev, [regionId]: originalTitle }));
        return;
      }

      setShuffledTitles(prev => ({ ...prev, [regionId]: shuffleText(originalTitle) }));
      iterations++;
    }, interval);
  };

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(shuffleIntervalsRef.current).forEach(interval => clearInterval(interval));
    };
  }, []);

  // Function to handle image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    const imageIndex = parseInt(event.target.getAttribute('data-index') || '0');
    
    if (files && files.length > 0) {
      // Get up to 3 files starting from the current image index
      const newImages = [...images];
      for (let i = 0; i < Math.min(files.length, 3); i++) {
        const targetIndex = (imageIndex + i) % 3;  // Wrap around if needed
        newImages[targetIndex] = files[i];
      }
      setImages(newImages);
      onUpdate({ date, location, images: newImages, textSections });
    }
  };

  const renderRegionContent = (type: string, regionId: string) => {
    const iconStyle = {
      fontSize: type === 'location' ? '1.25rem' : '1.75rem',
      filter: 'drop-shadow(2px 2px 0px rgba(0,0,0,0.2))',
      transform: type === 'location' ? 'none' : 'rotate(-5deg)',
      marginBottom: type === 'location' ? '0.25rem' : '0.5rem'
    };

    const hasContent = () => {
      if (type === 'location') {
        return location.length > 0;
      } else if (type === 'text') {
        const currentIndex = Number(regionId.split('-')[1]) - 1;
        return textSections[currentIndex]?.length > 0;
      } else if (type === 'image') {
        const currentIndex = Number(regionId.split('-')[1]) - 1;
        return images[currentIndex] !== undefined;
      }
      return false;
    };

    const containerStyle = (type: string) => {
      const isEmpty = !hasContent();
      const regionIndex = Number(regionId.split('-')[1]) - 1;
      const isFirstRegion = regionIndex === 0;
      
      return {
        background: isEmpty ? (type === 'image' ? MANIA_COLORS.white : MANIA_COLORS.black) : 'transparent',
        backgroundImage: isEmpty ? `
          linear-gradient(0deg, rgba(0,0,0,0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)
        ` : 'none',
        backgroundSize: '20px 20px',
        boxShadow: isEmpty ? '2px 2px 0px rgba(0,0,0,0.1)' : 'none',
        border: isEmpty ? `2px solid ${type === 'image' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.3)'}` : 'none',
        opacity: isEmpty ? 1 : 0,
        pointerEvents: isEmpty ? 'auto' : 'none',
        transition: 'all 0.3s ease',
        display: 'flex',
        flexDirection: 'column' as const,
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        padding: type === 'location' ? '0.25rem' : '0.5rem',
        position: 'relative' as const,
        zIndex: isEmpty ? 1 : 0  // Ensure empty containers are above content
      } as const;
    };

    const getContent = (type: string, regionId: string) => {
      const regionIndex = Number(regionId.split('-')[1]) - 1;
      const isFirstRegion = regionIndex === 0;

      switch (type) {
        case 'location':
          return {
            icon: null,
            title: "LOCATION",
            description: "Tap to add location"
          };
        case 'image':
          return {
            icon: faCamera,
            title: isFirstRegion ? "CAPTURE THE MOMENT" : "",
            description: isFirstRegion ? "Tap to add up to 3 photos" : ""
          };
        case 'text':
          return {
            icon: faPencil,
            title: isFirstRegion ? "WRITE YOUR STORY" : "",
            description: isFirstRegion ? "Tap to write your story" : ""
          };
      }
    };

    const content = getContent(type, regionId);
    if (!content) return null;

    const handleClick = () => {
      if (type === 'location') {
        if (locationInputRef.current) {
          locationInputRef.current.focus();
        }
      } else if (type === 'text') {
        const textIndex = Number(regionId.split('-')[1]) - 1;
        if (textInputRefs.current[textIndex]) {
          textInputRefs.current[textIndex]?.focus();
        }
      } else if (type === 'image') {
        const imageIndex = Number(regionId.split('-')[1]) - 1;
        if (fileInputRef.current) {
          fileInputRef.current.setAttribute('data-index', imageIndex.toString());
          fileInputRef.current.click();
        }
      }
    };

    return (
      <motion.div 
        className="h-full w-full cursor-pointer"
        style={containerStyle(type)}
        whileHover={{ 
          scale: 1.02,
          rotate: type === 'location' ? 0 :
                  type === 'image' ? 2 : -2
        }}
        whileTap={{ scale: 0.98 }}
        onClick={handleClick}
        onMouseEnter={() => content.title && startTitleShuffle(regionId, content.title)}
        onTouchStart={() => content.title && startTitleShuffle(regionId, content.title)}
      >
        <motion.div
          className="flex flex-col items-center justify-center text-center w-full"
          whileHover={type === 'image' ? { rotate: [0, -10, 10, -10, 0] } : 
                     type === 'text' ? { x: [-2, 2, -2, 2, 0] } :
                     { y: [-2, 2, -2, 2, 0] }}
          transition={{ duration: 0.5 }}
        >
          {content.icon && (
            <FontAwesomeIcon 
              icon={content.icon}
              style={{
                fontSize: '1.75rem',
                filter: type === 'image' ? 'drop-shadow(2px 2px 0px rgba(0,0,0,0.1))' : 'drop-shadow(2px 2px 0px rgba(0,0,0,0.2))',
                transform: 'rotate(-5deg)',
                marginBottom: content.title ? '0.5rem' : '0',
                color: type === 'image' ? '#333' : '#fff'
              }}
            />
          )}
          {content.title && (
            <div className={`flex ${type === 'location' ? 'flex-row items-center gap-2' : 'flex-col gap-0.5'} transform -rotate-1`}>
              <span className="font-bold tracking-wide" style={{ 
                textShadow: type === 'image' ? '1px 1px 0px rgba(0,0,0,0.1)' : '1px 1px 0px rgba(0,0,0,0.2)',
                fontFamily: "'Comic Sans MS', cursive",
                fontSize: type === 'location' ? '1.25rem' : '1rem',
                color: type === 'image' ? '#333' : '#fff'
              }}>
                {shuffledTitles[regionId] || content.title}
              </span>
              {content.description && (
                <span className="opacity-80 italic" style={{
                  textShadow: type === 'image' ? '1px 1px 0px rgba(0,0,0,0.1)' : '1px 1px 0px rgba(0,0,0,0.2)',
                  fontSize: type === 'location' ? '0.75rem' : '0.75rem',
                  color: type === 'image' ? '#666' : '#fff',
                  marginTop: type === 'location' ? '0' : '0'
                }}>
                  {content.description}
                </span>
              )}
            </div>
          )}
        </motion.div>

        {/* Hidden inputs for direct interaction */}
        {type === 'location' && (
          <input
            ref={locationInputRef}
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value.toUpperCase())}
            className="opacity-0 absolute inset-0 w-full h-full"
            placeholder="Enter location..."
          />
        )}
        {type === 'text' && (
          <textarea
            ref={(el) => {
              const index = Number(regionId.split('-')[1]) - 1;
              textInputRefs.current[index] = el;
            }}
            value={textSections[Number(regionId.split('-')[1]) - 1] || ''}
            onChange={(e) => {
              const index = Number(regionId.split('-')[1]) - 1;
              const newSections = [...textSections];
              newSections[index] = e.target.value;
              setTextSections(newSections);
              onUpdate({ date, location, images, textSections: newSections });
            }}
            className="opacity-0 absolute inset-0 w-full h-full resize-none"
            placeholder="Write your thoughts..."
          />
        )}
      </motion.div>
    );
  };

  return (
    <div className="w-full bg-black" style={{ minHeight: '101vh' }}>
      {/* Main Content */}
      <div className="w-full pb-32">
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className="relative bg-cream rounded-lg overflow-hidden" style={{ 
            aspectRatio: '1240/1748',
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)'
          }}>
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

            {/* Fixed Position Regions */}
            <div className="absolute inset-0">
              {getRegions(layoutMode).map(region => (
                <div
                  key={region.id}
                  style={{
                    position: 'absolute',
                    left: `${region.x}%`,
                    top: `${region.y}%`,
                    width: `${region.width}%`,
                    height: `${region.height}%`,
                  }}
                  className="rounded-xl overflow-hidden"
                >
                  {renderRegionContent(region.type, region.id)}
                </div>
              ))}
            </div>
          </div>

          {/* Controls Below Journal */}
          <div className="mt-6 space-y-6">
            {/* Color Picker */}
            <SimpleColorPicker
              colors={textColors}
              onChange={setTextColors}
              images={images}
            />

            {/* Layout Toggle */}
            <LayoutToggle
              layoutMode={layoutMode}
              setLayoutMode={setLayoutMode}
            />
          </div>
        </div>
      </div>

      {/* Hidden file input for image upload */}
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