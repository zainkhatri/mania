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
  const [activeTextArea, setActiveTextArea] = useState<number | null>(null);
  const [textColors, setTextColors] = useState({
    locationColor: '#3498DB',
    locationShadowColor: '#AED6F1'
  });
  const [layoutMode, setLayoutMode] = useState<'standard' | 'mirrored'>('standard');
  
  const journalCanvasRef = useRef(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Function to handle image selection
  const handleImageSelect = async (imageIndex: number) => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('data-index', imageIndex.toString());
      fileInputRef.current.click();
    }
  };

  // Function to handle image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const imageIndex = parseInt(event.target.getAttribute('data-index') || '0');
    
    if (file) {
      // Create a copy of the images array
      const newImages = [...images];
      // Update the image at the specified index
      newImages[imageIndex] = file;
      setImages(newImages);
      
      // Update parent component
      onUpdate({ date, location, images: newImages, textSections });
    }
  };

  // Function to handle taking a photo
  const handleTakePhoto = async (imageIndex: number) => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('data-index', imageIndex.toString());
      fileInputRef.current.setAttribute('capture', 'environment');
      fileInputRef.current.click();
    }
  };

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

    const handleClick = () => {
      if (type === 'location') {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = location;
        input.className = 'fixed top-0 left-0 w-full p-4 bg-black/90 text-white text-lg';
        input.placeholder = 'Enter location...';
        
        input.addEventListener('input', (e) => {
          const target = e.target as HTMLInputElement;
          setLocation(target.value.toUpperCase());
        });
        
        input.addEventListener('blur', () => {
          document.body.removeChild(input);
        });
        
        document.body.appendChild(input);
        input.focus();
      } else if (type === 'text') {
        const textIndex = Number(regionId.split('-')[1]) - 1;
        const input = document.createElement('textarea');
        input.value = textSections[textIndex] || '';
        input.className = 'fixed inset-0 w-full h-full p-4 bg-black/90 text-white text-lg';
        input.placeholder = 'Write your thoughts...';
        
        input.addEventListener('input', (e) => {
          const target = e.target as HTMLTextAreaElement;
          const newSections = [...textSections];
          newSections[textIndex] = target.value;
          setTextSections(newSections);
        });
        
        input.addEventListener('blur', () => {
          document.body.removeChild(input);
        });
        
        document.body.appendChild(input);
        input.focus();
      } else if (type === 'image') {
        const imageIndex = Number(regionId.split('-')[1]) - 1;
        // Show image options modal
        const modal = document.createElement('div');
        modal.className = 'fixed bottom-0 left-0 right-0 bg-black/90 p-4 rounded-t-2xl';
        modal.innerHTML = `
          <div class="flex flex-col gap-4">
            <button id="takePhoto" class="w-full py-3 bg-blue-500 text-white rounded-lg flex items-center justify-center gap-2">
              <i class="fas fa-camera"></i>Take Photo
            </button>
            <button id="choosePhoto" class="w-full py-3 bg-purple-500 text-white rounded-lg flex items-center justify-center gap-2">
              <i class="fas fa-image"></i>Choose from Library
            </button>
            <button id="cancelPhoto" class="w-full py-3 bg-gray-500 text-white rounded-lg">Cancel</button>
          </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('takePhoto')?.addEventListener('click', () => {
          handleTakePhoto(imageIndex);
          document.body.removeChild(modal);
        });
        
        document.getElementById('choosePhoto')?.addEventListener('click', () => {
          handleImageSelect(imageIndex);
          document.body.removeChild(modal);
        });
        
        document.getElementById('cancelPhoto')?.addEventListener('click', () => {
          document.body.removeChild(modal);
        });
      }
    };

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
        onClick={handleClick}
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

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />
    </div>
  );
};

export default MobileJournalEditor;