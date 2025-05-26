import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import JournalCanvas from './JournalCanvas';
import 'react-datepicker/dist/react-datepicker.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faLocationDot, 
  faCamera, 
  faPencil,
  faPalette,
  faXmark
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

// Color palette based on MANIA's bold aesthetic
const MANIA_COLORS = {
  orange: 'rgba(255, 87, 34, 0.85)',  // Vibrant orange
  purple: 'rgba(156, 39, 176, 0.85)', // Bold purple
  teal: 'rgba(0, 150, 136, 0.85)',    // Deep teal
  background: '#f5f3e8',              // Warm vintage paper color
};

const MobileJournalEditor: React.FC<MobileJournalEditorProps> = ({ onUpdate, initialData }) => {
  const [date, setDate] = useState<Date>(initialData?.date || new Date());
  const [location, setLocation] = useState(initialData?.location || '');
  const [images, setImages] = useState<(string | Blob)[]>(initialData?.images || []);
  const [textSections, setTextSections] = useState<string[]>(initialData?.textSections || ['', '', '']);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [activeTextArea, setActiveTextArea] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'standard' | 'mirrored'>('standard');
  const [textColors, setTextColors] = useState({
    locationColor: '#3498DB',
    locationShadowColor: '#AED6F1'
  });
  
  const journalCanvasRef = useRef(null);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  // Hardcoded regions based on screenshot
  const regions = [
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
      x: 2,      // Left side with small margin
      y: 13,     // Below location
      width: 50, // Slightly less than half width
      height: 27 // Same height
    },
    { 
      id: 'text-1', 
      type: 'text',
      x: 54,     // Right side
      y: 13,     // Same as image-1
      width: 43, // Same width
      height: 27 // Same height
    },
    { 
      id: 'text-2', 
      type: 'text',
      x: 2,      // Left side
      y: 42,     // Below first row
      width: 43, // Same width
      height: 27 // Same height
    },
    { 
      id: 'image-2', 
      type: 'image',
      x: 47,     // Right side
      y: 42,     // Moved down to avoid text overlap
      width: 50, // Same width
      height: 27 // Same height
    },
    { 
      id: 'image-3', 
      type: 'image',
      x: 2,      // Left side
      y: 72,     // Moved down to avoid text overlap
      width: 50, // Same width
      height: 27 // Same height
    },
    { 
      id: 'text-3', 
      type: 'text',
      x: 54,     // Right side
      y: 72,     // Adjusted to align with image-3
      width: 43, // Same width
      height: 27 // Same height
    }
  ];

  // Update parent component whenever data changes
  useEffect(() => {
    onUpdate({ date, location, images, textSections });
  }, [date, location, images, textSections, onUpdate]);

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

  const renderRegionContent = (type: string, regionId: string) => {
    const iconStyle = {
      fontSize: type === 'location' ? '1.25rem' : '1.75rem',
      filter: 'drop-shadow(2px 2px 0px rgba(0,0,0,0.2))',
      transform: type === 'location' ? 'none' : 'rotate(-5deg)',
      marginBottom: type === 'location' ? '0.25rem' : '0.5rem'
    };

    // Check if any content exists in the corresponding section
    const hasContent = () => {
      if (type === 'location') {
        return location.length > 0;
      } else if (type === 'text') {
        // Get index of current text area
        const currentIndex = Number(regionId.split('-')[1]) - 1;
        
        // Check if any text area has content
        const hasAnyContent = textSections.some((text, index) => {
          // Only check sections up to current index
          return index <= currentIndex && text.length > 0;
        });
        
        return hasAnyContent;
      } else if (type === 'image') {
        // Get index of current image area
        const currentIndex = Number(regionId.split('-')[1]) - 1;
        
        // Check if any image slot has content
        const hasAnyContent = images.some((img, index) => {
          // Only check sections up to current index
          return index <= currentIndex && img !== undefined;
        });
        
        return hasAnyContent;
      }
      return false;
    };

    const containerStyle = (type: string) => {
      const isEmpty = !hasContent();
      
      return {
        background: isEmpty ? (
          type === 'location' ? MANIA_COLORS.orange :
          type === 'image' ? MANIA_COLORS.teal :
          MANIA_COLORS.purple
        ) : 'transparent',
        backgroundImage: isEmpty ? `
          linear-gradient(0deg, rgba(255,255,255,0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
        ` : 'none',
        backgroundSize: '20px 20px',
        boxShadow: isEmpty ? '2px 2px 0px rgba(0,0,0,0.2)' : 'none',
        border: isEmpty ? '2px solid rgba(255,255,255,0.3)' : 'none',
        opacity: isEmpty ? 1 : 0,
        transition: 'all 0.3s ease',
        display: 'flex',
        flexDirection: 'column' as const,
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        padding: type === 'location' ? '0.25rem' : '0.5rem'
      } as const;
    };

    // Only render content if the region should be visible
    if (hasContent()) {
      return null;
    }

    const getContent = (type: string) => {
      switch (type) {
        case 'location':
          return {
            icon: faLocationDot,
            title: "WHERE ARE YOU?",
            description: "(e.g., MANIA, LA JOLLA, CA)"
          };
        case 'image':
          return {
            icon: faCamera,
            title: "CAPTURE THE MOMENT",
            description: "Insert images that reflect your day"
          };
        case 'text':
          return {
            icon: faPencil,
            title: "WRITE YOUR STORY",
            description: "Write about your day!"
          };
      }
    };

    const content = getContent(type);
    if (!content) return null;

    return (
      <motion.div 
        className="h-full w-full cursor-pointer"
        style={containerStyle(type)}
        whileHover={{ 
          scale: 1.02,
          rotate: type === 'location' ? -1 :
                  type === 'image' ? 2 : -2
        }}
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          if (type === 'location' && locationInputRef.current) {
            locationInputRef.current.focus();
          } else if (type === 'text') {
            const textIndex = Number(regionId.split('-')[1]) - 1;
            setActiveTextArea(textIndex);
            setShowKeyboard(true);
          } else if (type === 'image') {
            // TODO: Add image upload functionality
            console.log('Image upload clicked');
          }
        }}
      >
        <motion.div
          className="flex flex-col items-center justify-center text-center w-full"
          whileHover={type === 'image' ? { rotate: [0, -10, 10, -10, 0] } : 
                     type === 'text' ? { x: [-2, 2, -2, 2, 0] } :
                     { y: [-2, 2, -2, 2, 0] }}
          transition={{ duration: 0.5 }}
        >
          <FontAwesomeIcon 
            icon={content.icon}
            style={iconStyle}
            className="text-white" 
          />
          <div className="flex flex-col gap-0.5 transform -rotate-1">
            <span className="text-white font-bold tracking-wide" style={{ 
              textShadow: '1px 1px 0px rgba(0,0,0,0.2)',
              fontFamily: "'Comic Sans MS', cursive",
              fontSize: type === 'location' ? '0.875rem' : '1rem'
            }}>
              {type === 'location' ? "LOCATION" : content.title}
            </span>
            <span className="text-white opacity-80 italic" style={{
              textShadow: '1px 1px 0px rgba(0,0,0,0.2)',
              fontSize: type === 'location' ? '0.625rem' : '0.75rem'
            }}>
              {content.description}
            </span>
          </div>
        </motion.div>
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
              {regions.map(region => (
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

      {/* Text Input Modal */}
      {showKeyboard && activeTextArea !== null && (
        <div className="fixed bottom-0 left-0 right-0 bg-white p-4 rounded-t-2xl shadow-lg z-50">
          <textarea
            ref={textInputRef}
            value={textSections[activeTextArea]}
            onChange={(e) => {
              const newSections = [...textSections];
              newSections[activeTextArea] = e.target.value;
              setTextSections(newSections);
            }}
            className="w-full h-40 p-4 border rounded-lg font-handwriting text-lg"
            placeholder="Write your thoughts..."
            autoFocus
          />
          <button
            onClick={() => {
              setShowKeyboard(false);
              setActiveTextArea(null);
            }}
            className="mt-2 w-full bg-blue-500 text-white py-2 rounded-lg"
          >
            Done
          </button>
        </div>
      )}

      {/* Hidden location input */}
      <input
        ref={locationInputRef}
        type="text"
        className="opacity-0 absolute top-0 left-0 w-1 h-1"
        onFocus={() => {
          const newLocation = prompt('Enter location:', location);
          if (newLocation !== null) {
            setLocation(newLocation.toUpperCase());
          }
          locationInputRef.current?.blur();
        }}
      />
    </div>
  );
};

export default MobileJournalEditor;