import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import CustomNotification from './CustomNotification';
import { useNotification } from '../hooks/useNotification';
import { TextColors } from './ColorPicker';
import JournalCanvas, { JournalCanvasHandle, ClickableTextArea } from './JournalCanvas';
import LayoutToggle from './LayoutToggle';
import { generateJournalPrompts } from '../services/gptService';
import html2canvas from 'html2canvas';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { jsPDF } from 'jspdf';
import { saveJournal, journalExistsForDate } from '../services/journalService';
import SimpleColorPicker from './TempColorPicker';
import { useNavigate } from 'react-router-dom';
import { clearJournalCache } from '../utils/storageUtils';
import { format } from 'date-fns';
import imageCompression from 'browser-image-compression';

// Memoized JournalCanvas to prevent unnecessary re-renders
const MemoizedJournalCanvas = memo(JournalCanvas);

// Enhanced date formatting function from sample.js
const formatDate = (date: Date): string => {
  // Create a new date object that preserves the selected day without timezone issues
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const adjustedDate = new Date(year, month, day, 12, 0, 0);
  
  // Helper function to get ordinal suffix
  const getOrdinalSuffix = (day: number): string => {
    if (day > 3 && day < 21) return 'TH';
    switch (day % 10) {
      case 1: return 'ST';
      case 2: return 'ND';
      case 3: return 'RD';
      default: return 'TH';
    }
  };

  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  
  // Format the date without ordinal first using adjusted date
  let dateStr = adjustedDate.toLocaleDateString('en-US', options);
  
  // Extract the day number and add the ordinal suffix
  const ordinalSuffix = getOrdinalSuffix(day);
  
  // Replace the day number with day + ordinal suffix
  dateStr = dateStr.replace(/(\d+)/, `$1${ordinalSuffix}`);
  
  // Fix double commas - remove any existing comma after the day before adding our own
  dateStr = dateStr.replace(/(\d+[A-Z]+),/, '$1');
  
  // Make sure there's a comma after the ordinal suffix
  dateStr = dateStr.replace(/(\d+[A-Z]+)/, '$1,');
  
  return dateStr.toUpperCase();
};

// Clean, modern calendar styles with dark theme
const datePickerStyles = `
  .react-datepicker {
    font-family: 'ZainCustomFont', 'zain.ttf', -apple-system, BlinkMacSystemFont, sans-serif !important;
    background-color: #111111 !important;
    color: #ffffff !important;
    border: 1px solid rgba(255, 255, 255, 0.15) !important;
    border-radius: 12px !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
    padding: 16px !important;
    backdrop-filter: blur(10px) !important;
  }
  
  .react-datepicker__header {
    background-color: transparent !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
    padding: 12px 0 16px 0 !important;
    margin-bottom: 8px !important;
  }
  
  .react-datepicker__current-month {
    color: #ffffff !important;
    font-size: 16px !important;
    font-weight: 600 !important;
    margin: 0 0 8px 0 !important;
    text-align: center !important;
  }
  
  .react-datepicker__day-names {
    display: grid !important;
    grid-template-columns: repeat(7, 1fr) !important;
    gap: 4px !important;
    margin-bottom: 8px !important;
  }
  
  .react-datepicker__day-name {
    color: #9ca3af !important;
    font-size: 12px !important;
    font-weight: 500 !important;
    text-align: center !important;
    padding: 8px 0 !important;
  }
  
  .react-datepicker__month {
    display: grid !important;
    grid-template-columns: repeat(7, 1fr) !important;
    gap: 4px !important;
  }
  
  .react-datepicker__week {
    display: contents !important;
  }
  
  .react-datepicker__day {
    color: #ffffff !important;
    font-size: 14px !important;
    font-weight: 400 !important;
    text-align: center !important;
    padding: 8px 0 !important;
    border-radius: 8px !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    background: transparent !important;
    border: none !important;
    margin: 0 !important;
    width: 32px !important;
    height: 32px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
  
  .react-datepicker__day:hover {
    background-color: rgba(255, 255, 255, 0.1) !important;
    transform: scale(1.05) !important;
  }
  
  .react-datepicker__day--selected {
    background-color: #3b82f6 !important;
    color: #ffffff !important;
    font-weight: 600 !important;
  }
  
  .react-datepicker__day--keyboard-selected {
    background-color: rgba(59, 130, 246, 0.3) !important;
    color: #ffffff !important;
  }
  
  .react-datepicker__day--today {
    background-color: rgba(59, 130, 246, 0.2) !important;
    color: #3b82f6 !important;
    font-weight: 600 !important;
  }
  
  .react-datepicker__day--outside-month {
    color: #6b7280 !important;
  }
  
  .react-datepicker__day--disabled {
    color: #4b5563 !important;
    cursor: not-allowed !important;
  }
  
  .react-datepicker__navigation {
    position: absolute !important;
    top: 16px !important;
    width: 32px !important;
    height: 32px !important;
    background-color: rgba(255, 255, 255, 0.1) !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    border-radius: 8px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    z-index: 10 !important;
  }
  
  .react-datepicker__navigation:hover {
    background-color: rgba(255, 255, 255, 0.2) !important;
    border-color: rgba(255, 255, 255, 0.3) !important;
    transform: scale(1.05) !important;
  }
  
  .react-datepicker__navigation--previous {
    left: 16px !important;
  }
  
  .react-datepicker__navigation--next {
    right: 16px !important;
  }
  
  .react-datepicker__navigation-icon {
    width: 12px !important;
    height: 12px !important;
    position: relative !important;
  }
  
  .react-datepicker__navigation-icon::before {
    display: none !important;
  }
  
  /* Left arrow (previous) - Chevron left */
  .react-datepicker__navigation--previous .react-datepicker__navigation-icon::after {
    content: '' !important;
    position: absolute !important;
    top: 50% !important;
    left: 50% !important;
    width: 8px !important;
    height: 8px !important;
    border-left: 2px solid #ffffff !important;
    border-bottom: 2px solid #ffffff !important;
    transform: translate(-25%, -50%) rotate(45deg) !important;
  }
  
  /* Right arrow (next) - Chevron right */
  .react-datepicker__navigation--next .react-datepicker__navigation-icon::after {
    content: '' !important;
    position: absolute !important;
    top: 50% !important;
    left: 50% !important;
    width: 8px !important;
    height: 8px !important;
    border-right: 2px solid #ffffff !important;
    border-top: 2px solid #ffffff !important;
    transform: translate(-75%, -50%) rotate(45deg) !important;
  }
  
  .react-datepicker__triangle {
    display: none !important;
  }
  
  .react-datepicker__month-container {
    background-color: transparent !important;
  }
  
  /* Mobile optimizations */
  @media (max-width: 768px) {
    .react-datepicker {
      padding: 12px !important;
      border-radius: 8px !important;
    }
    
    .react-datepicker__day {
      width: 28px !important;
      height: 28px !important;
      font-size: 13px !important;
    }
    
    .react-datepicker__navigation {
      width: 28px !important;
      height: 28px !important;
      top: 12px !important;
    }
    
    .react-datepicker__navigation--previous {
      left: 12px !important;
    }
    
    .react-datepicker__navigation--next {
      right: 12px !important;
    }
    
    .react-datepicker__current-month {
      font-size: 14px !important;
    }
  }
`;

// Simple function that returns the original image without enhancement
const enhanceImageWithAI = async (imageDataUrl: string): Promise<string> => {
  try {
    console.log("Enhancing image with AI...");
    // Simulate an AI processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Create an image element to load the original image
    const img = new Image();
    img.crossOrigin = "Anonymous";
    
    // Wait for the image to load
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = imageDataUrl;
    });
    
    // Create a canvas to apply AI-like enhancements
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return imageDataUrl;
    
    // Draw the original image
    ctx.drawImage(img, 0, 0);
    
    // Get image data for manipulation
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Apply "AI" enhancements - increase contrast and saturation
    for (let i = 0; i < data.length; i += 4) {
      // Increase contrast
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Calculate brightness
      const brightness = (r + g + b) / 3;
      
      // Apply contrast (make bright pixels brighter, dark pixels darker)
      const factor = 1.2; // Contrast factor
      const delta = factor * (brightness - 128) + 128;
      
      // Apply saturation boost
      const satFactor = 1.3; // Saturation boost
      const avg = (r + g + b) / 3;
      
      data[i] = Math.min(255, Math.max(0, r + (r - avg) * satFactor));
      data[i + 1] = Math.min(255, Math.max(0, g + (g - avg) * satFactor));
      data[i + 2] = Math.min(255, Math.max(0, b + (b - avg) * satFactor));
    }
    
    // Put enhanced image data back
    ctx.putImageData(imageData, 0, 0);
    
    // Convert to data URL
    console.log("AI enhancement complete!");
    return canvas.toDataURL('image/jpeg', 0.92);
  } catch (error) {
    console.error("Error enhancing image:", error);
    return imageDataUrl; // Return original on error
  }
};

// Interface for custom Window properties
interface CustomWindow extends Window {
  FORCE_CANVAS_REDRAW: boolean;
  CURRENT_COLORS: TextColors;
  forceCanvasRedraw?: () => void;
  shadowOffsetX?: number; // Add shadow X offset
  shadowOffsetY?: number; // Add shadow Y offset 
  shadowDarkness?: number; // Add shadow darkness level
}

// Declare global window properties for TypeScript
declare global {
  interface Window {
    FORCE_CANVAS_REDRAW: boolean;
    CURRENT_COLORS: TextColors;
    forceCanvasRedraw?: () => void;
    html2pdf: typeof html2pdf;
    shadowOffsetX?: number; // Add shadow X offset
    shadowOffsetY?: number; // Add shadow Y offset 
    shadowDarkness?: number; // Add shadow darkness level
  }
}

// Add global variables to track if we need to force redraw
window.FORCE_CANVAS_REDRAW = false;
window.CURRENT_COLORS = {
  locationColor: '#3498DB',
  locationShadowColor: '#AED6F1'
};

interface JournalFormProps {
  templateUrl?: string;
  saveButtonText?: string;
}

const JournalForm: React.FC<JournalFormProps> = ({
  templateUrl = '/templates/cream-black-template.jpg',
  saveButtonText = 'Create Journal'
}) => {
  // DEBUG: Track JournalForm lifecycle
  useEffect(() => {
    console.log('🟢🟢🟢 JOURNALFORM MOUNTED 🟢🟢🟢');
    console.log('🟢 Checking for duplicate JournalForm instances...');

    // Check for duplicate journal form containers
    const journalContainers = document.querySelectorAll('.journal-form-container');
    console.log('🟢 Number of .journal-form-container elements:', journalContainers.length);

    // Check for duplicate grids
    const gridElements = document.querySelectorAll('.grid.grid-cols-1');
    console.log('🟢 Number of .grid elements:', gridElements.length);

    // Log all children of root
    const root = document.getElementById('root');
    console.log('🟢 Root children:', root?.children.length);
    Array.from(root?.children || []).forEach((child, i) => {
      console.log(`🟢   [${i}]:`, child.className, child.tagName);
    });

    return () => {
      console.log('🟢🟢🟢 JOURNALFORM UNMOUNTED 🟢🟢🟢');
    };
  }, []);

  const navigate = useNavigate();
  const { notification, loading, success, error: showError, update, hide } = useNotification();
  const [location, setLocation] = useState('');

  const [journalText, setJournalText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  
  // Store image positions to preserve them when adding new images
  const [imagePositions, setImagePositions] = useState<Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>>([]);
  
  // Initialize date with noon time to avoid timezone issues
  const initialDate = new Date();
  initialDate.setHours(12, 0, 0, 0);
  const [date, setDate] = useState(initialDate);
  

  
  const [layoutMode, setLayoutMode] = useState<'standard' | 'mirrored' | 'freeflow'>('freeflow');
  const [submitted, setSubmitted] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [loadingImageCount, setLoadingImageCount] = useState(0);
  const [needInspiration, setNeedInspiration] = useState(false);
  
  // Logo state for typewriter effect
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const [typedText, setTypedText] = useState("");
  const fullText = "ania";
  
  // Typewriter effect for the logo
  useEffect(() => {
    if (isLogoHovered) {
      let currentIndex = 0;
      const typingInterval = setInterval(() => {
        if (currentIndex < fullText.length) {
          setTypedText(fullText.substring(0, currentIndex + 1));
          currentIndex++;
        } else {
          clearInterval(typingInterval);
        }
      }, 100); // Speed of typing
      
      return () => {
        clearInterval(typingInterval);
      };
    } else {
      setTypedText("");
    }
  }, [isLogoHovered]);
  
  // Render the logo with typewriter animation
  const renderLogo = () => {
    return (
      <div 
        className="flex items-center cursor-pointer hover:opacity-80 transition-opacity duration-300"
        onMouseEnter={() => setIsLogoHovered(true)}
        onMouseLeave={() => setIsLogoHovered(false)}
        onClick={() => window.open('https://www.maniajournal.org/', '_blank')}
        style={{ minWidth: "200px" }}
        title="Visit Mania Journal Website"
      >
        <span className="logo-m">m</span>
        <span className="logo-m">{typedText}</span>
      </div>
    );
  };
  
  // Inspiration questions that appear in the journal preview
  const [inspirationQuestion, setInspirationQuestion] = useState<string>("");
  const [isGeneratingInspiration, setIsGeneratingInspiration] = useState<boolean>(false);
  const [hasGeneratedInspiration, setHasGeneratedInspiration] = useState<boolean>(false);
  const [displayedQuestion, setDisplayedQuestion] = useState<string>("");
  const [showQuestionOverlay, setShowQuestionOverlay] = useState<boolean>(false);
  const [isQuestionTyping, setIsQuestionTyping] = useState<boolean>(false);

  // Generate inspiration question when journal text changes
  useEffect(() => {
    const generateInspiration = async () => {
      // Debug statement removed
      
      // Count words in journal text
      const wordCount = journalText.trim().split(/\s+/).filter(word => word.length > 0).length;
      
      // Auto-enable inspiration when word count reaches 10
      if (wordCount >= 10 && !needInspiration && !hasGeneratedInspiration) {
        // Debug statement removed
        setNeedInspiration(true);
        return; // Let the next effect run handle the generation
      }
      
      // Don't generate if already generated or if inspiration is off
      if (hasGeneratedInspiration || !needInspiration) {
        // Debug statement removed
        return;
      }
      
      // Only generate if we have at least 10 words and haven't generated yet
      if (wordCount < 10) {
        // Debug statement removed
        return;
      }

      if (isGeneratingInspiration) {
        // Debug statement removed
        return;
      }

      setIsGeneratingInspiration(true);
      console.log('🚀 Starting inspiration generation...');
      
      try {
        console.log('📞 Calling GPT service with:', { journalText: journalText.substring(0, 50) + '...', location });
        const questions = await generateJournalPrompts(journalText, location);
        // Debug statement removed
        const question = questions[0] || "";
        setInspirationQuestion(question);
        setHasGeneratedInspiration(true);
        
        // Don't automatically insert the question - let user choose from dropdown
        console.log('✅ Generated inspiration question:', question);
        
        // Keep inspiration enabled so the question shows in the dropdown
        // setNeedInspiration(false); // Removed - keep inspiration visible
      } catch (error) {
        console.error('Error generating inspiration question:', error);
        console.log('🔄 Using fallback questions due to error');
        const fallbackQuestions = [
          "What's really going on here?",
          "What's the real story?",
          "What happened?",
          "What's bothering you?",
          "What's on your mind?",
          "What's going through your head?",
          "What's the deal?",
          "What's up?",
          "What's happening?",
          "What's the situation?"
        ];
        const fallbackQuestion = fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
        // Debug statement removed
        setInspirationQuestion(fallbackQuestion);
        setHasGeneratedInspiration(true);
        
        // Don't automatically insert the fallback question - let user choose from dropdown
        console.log('✅ Generated fallback inspiration question:', fallbackQuestion);
        
        // Keep inspiration enabled so the question shows in the dropdown
        // setNeedInspiration(false); // Removed - keep inspiration visible
      } finally {
        setIsGeneratingInspiration(false);
      }
    };

    // Debounce the generation to avoid too many API calls
    const timeoutId = setTimeout(generateInspiration, 1000);
    return () => clearTimeout(timeoutId);
  }, [journalText, location, needInspiration, hasGeneratedInspiration, isGeneratingInspiration]);

  // Reset inspiration state when journal is reset
  useEffect(() => {
    if (!journalText.trim()) {
      setHasGeneratedInspiration(false);
      setInspirationQuestion("");
      setNeedInspiration(false); // Turn off inspiration when journal is cleared
    }
  }, [journalText]);

  const getInspirationQuestion = () => {
    return isGeneratingInspiration ? "Generating inspiration..." : inspirationQuestion;
  };
  
  const [isJournalCollapsed, setIsJournalCollapsed] = useState(false);
  

  const [textColors, setTextColors] = useState<TextColors>({
    locationColor: '#2D9CDB',
    locationShadowColor: '#1D3557',
  });
  const [submittedData, setSubmittedData] = useState<{
    date: Date;
    location: string;
    text: string[];
    images: string[];
    textColors: TextColors;
    layoutMode: 'standard' | 'mirrored' | 'freeflow';
    forceUpdate?: number;
  }>({
    date: (() => {
      const initialSubmittedDate = new Date();
      initialSubmittedDate.setHours(12, 0, 0, 0);
      return initialSubmittedDate;
    })(),
    location: '',
    text: [],
    images: [],
    textColors: {
      locationColor: '#2D9CDB',
      locationShadowColor: '#1D3557',
    },
    layoutMode: 'freeflow'
  });
  
  // Save notification state
    // Removed save notification functionality
  
  // Function to compress all images in the journal to reduce size
  const compressJournalImages = async (images: string[]): Promise<string[]> => {
    // If there are no images, return an empty array
    if (!images || images.length === 0) return [];
    
    try {
      // Process each image in parallel
      const compressedImages = await Promise.all(images.map(async (imageDataUrl) => {
        // If it's not a data URL, just return it
        if (!imageDataUrl.startsWith('data:image')) return imageDataUrl;
        
        // Create an image element to load the image
        const img = new Image();
        img.src = imageDataUrl;
        
        // Wait for the image to load
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve; // Continue even if there's an error
        });
        
        // Create a canvas to compress the image
        const canvas = document.createElement('canvas');
        
        // Calculate new dimensions (50% of original size, but min 800px on longest side)
        const maxDimension = Math.max(img.width, img.height);
        const scale = maxDimension > 1600 ? 800 / maxDimension : 0.5;
        
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        // Draw the image at the new size
        const ctx = canvas.getContext('2d');
        if (!ctx) return imageDataUrl; // Fallback to original if context fails
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Convert to JPEG with medium quality
        return canvas.toDataURL('image/jpeg', 0.6);
      }));
      
      return compressedImages;
    } catch (error) {
      console.error('Error compressing images:', error);
      return images; // Return original images if compression fails
    }
  };
  
  // Function to save journal entry to Firestore
  const saveJournalToBackend = async () => {

    // Show a loading notification
    const notificationId = loading("Saving your journal...");

    // Set a timeout for the saving process
    const saveTimeout = setTimeout(() => {
      update(notificationId, {
        render: "Still working... Processing images takes time. Please wait.",
        type: "loading"
      });
    }, 5000);

    try {
      // DEBUG: Log the current state when saving
      // Debug statements removed

      // Validate content before saving
      if (!location.trim()) {
        clearTimeout(saveTimeout);
        update(notificationId, {
          render: "Location is required",
          type: "error"
        });
        return;
      }

      // Break the journal text into paragraphs
      const textSections = journalText.split('\n\n').filter(section => section.trim().length > 0);
      // Debug statement removed
      
      if (textSections.length === 0) {
        clearTimeout(saveTimeout);
        update(notificationId, {
          render: "Journal content is required",
          type: "error"
        });
        return;
      }
      
      // Check if a journal with the same date already exists
      const dateStr = date.toISOString().split('T')[0]; // Get YYYY-MM-DD format
      const dateExists = await journalExistsForDate(date.toISOString());
      
      if (dateExists) {
        clearTimeout(saveTimeout);
        update(notificationId, {
          render: "A journal entry for this date already exists in your gallery",
          type: "error"
        });
        return;
      }
      
      // Update the notification to indicate we're processing images
      update(notificationId, { render: "Processing images..." });
      
      // Compress the images to reduce size
      const compressedImages = await compressJournalImages(images);
      
      // Update the notification to indicate we're generating the preview
      update(notificationId, { render: "Generating journal preview..." });
      
      // Generate a preview of the journal as a data URL for thumbnails
      const preview = await generateJournalPreview();
      
      if (!preview) {
        clearTimeout(saveTimeout);
        update(notificationId, {
          render: "Failed to generate journal preview, please try again",
          type: "error"
        });
        return;
      }
      
      // Update notification to indicate we're saving to Firestore
      update(notificationId, { render: "Saving to your account..." });
      
      // Prepare journal data for Firestore
      const journalData = {
        date: date.toISOString(),
        location: location,
        text: textSections,
        images: compressedImages, // Use compressed images
        textColors: textColors,
        layoutMode: layoutMode,
        preview: preview
      };
      
      // Save to Firestore database
      const journalId = await saveJournal(journalData);
      
      // Clear the timeout as we're done
      clearTimeout(saveTimeout);
      
      // Set as submitted data
      setSubmittedData({
        date,
        location,
        text: textSections,
        images,
        textColors,
        layoutMode,
        forceUpdate: Date.now(),
      });
      
      setSubmitted(true);
      
      // Update notification to success
      update(notificationId, {
        render: `Journal saved successfully to your account!`,
        type: "success"
      });
      
      // Clear journal caches to start fresh next time
      clearJournalCache();
      
      // Show success message and reset form after saving
      setTimeout(() => {
        handleReset();
        // Stay on the current page instead of navigating to gallery
      }, 2500);
    } catch (error) {
      // Clear the timeout
      clearTimeout(saveTimeout);
      
      console.error("Error saving journal:", error);
      update(notificationId, {
        render: `Failed to save journal: ${error instanceof Error ? error.message : "Please try again"}`,
        type: "error"
      });
    }
  };
  
  // Generate a thumbnail preview of the journal as a data URL
  const generateJournalPreview = async (): Promise<string> => {
    try {
      // Try to get journal element by ID (more reliable)
      const journalElement = document.getElementById('journal-container');
      
      if (!journalElement) {
        console.error('Journal container not found for preview generation');
        showError('Could not generate journal preview. Please try again.');
        return '';
      }

      // Apply high quality rendering to the element before capturing
      const originalTransform = journalElement.style.transform;
      journalElement.style.transform = 'none'; // Reset transform to avoid scaling issues
      
      // Generate a lower resolution preview for faster processing
      const canvas = await html2canvas(journalElement, {
        scale: 1.0, // Lower resolution for much faster processing
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f9f7f1',
        logging: false,
        imageTimeout: 20000, // Shorter timeout for faster saving
        letterRendering: true, // Better text rendering
        onclone: (documentClone: Document) => {
          // Enhance rendering in the cloned document
          const clonedElement = documentClone.getElementById('journal-container');
          if (clonedElement) {
            clonedElement.style.transform = 'none';
            clonedElement.style.textRendering = 'optimizeLegibility';
            (clonedElement.style as any)['-webkit-font-smoothing'] = 'antialiased';
            (clonedElement.style as any)['-moz-osx-font-smoothing'] = 'grayscale';
          }
        }
      });
      
      // Restore original transform after capture
      journalElement.style.transform = originalTransform;
      
      // Get data URL with moderate quality to reduce size
      return canvas.toDataURL('image/jpeg', 0.6);
    } catch (error) {
      console.error('Failed to generate journal preview:', error);
      showError('Could not generate journal preview. Please try again.');
      return '';
    }
  };
  
  // Removed save notification timer cleanup
  
  // Add utility functions for more reliable localStorage handling
  
  // Save data to localStorage with chunking for large objects
  const saveToLocalStorage = (key: string, data: any): boolean => {
    try {
      // Convert data to string
      const serializedData = JSON.stringify(data);
      
      // If data is small enough, save directly
      if (serializedData.length < 1000000) { // 1MB
        localStorage.setItem(key, serializedData);
        return true;
      }
      
      // For larger data, we'll split it into chunks
      // First, remove any existing chunks for this key
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);
        if (storageKey && storageKey.startsWith(`${key}_chunk_`)) {
          localStorage.removeItem(storageKey);
        }
      }
      
      // Save metadata
      localStorage.setItem(`${key}_meta`, JSON.stringify({
        chunkSize: 500000, // 500KB chunks
        totalChunks: Math.ceil(serializedData.length / 500000),
        totalSize: serializedData.length,
        timestamp: new Date().toISOString()
      }));
      
      // Split and save chunks
      const chunkSize = 500000;
      const totalChunks = Math.ceil(serializedData.length / chunkSize);
      
      for (let i = 0; i < totalChunks; i++) {
        const chunk = serializedData.substring(i * chunkSize, (i + 1) * chunkSize);
        localStorage.setItem(`${key}_chunk_${i}`, chunk);
      }
      
      return true;
    } catch (error) {
      console.error(`Error saving ${key} to localStorage:`, error);
      
      // Try to save without images if it fails
      if (data.images && data.images.length > 0) {
        try {
          const dataWithoutImages = { ...data, images: [] };
          localStorage.setItem(key, JSON.stringify(dataWithoutImages));
          console.warn(`Saved ${key} without images due to storage limitations`);
          return true;
        } catch (innerError) {
          console.error(`Unable to save ${key} at all:`, innerError);
          return false;
        }
      }
      
      return false;
    }
  };
  
  // Load data from localStorage, handling chunked data
  const loadFromLocalStorage = (key: string): any => {
    try {
      // Check if we have metadata for chunked data
      const metaString = localStorage.getItem(`${key}_meta`);
      
      if (metaString) {
        // We have chunked data
        const meta = JSON.parse(metaString);
        const { totalChunks, totalSize } = meta;
        
        // Reconstruct from chunks
        let data = '';
        for (let i = 0; i < totalChunks; i++) {
          const chunk = localStorage.getItem(`${key}_chunk_${i}`);
          if (!chunk) {
            throw new Error(`Missing chunk ${i} for ${key}`);
          }
          data += chunk;
        }
        
        // Validate total size
        if (data.length !== totalSize) {
          console.warn(`Size mismatch for ${key}: expected ${totalSize}, got ${data.length}`);
        }
        
        return JSON.parse(data);
      }
      
      // Regular data
      const dataString = localStorage.getItem(key);
      if (!dataString) return null;
      
      return JSON.parse(dataString);
    } catch (error) {
      console.error(`Error loading ${key} from localStorage:`, error);
      // Clear potentially corrupted data
      clearLocalStorageItem(key);
      return null;
    }
  };
  
  // Clear a localStorage item and its chunks
  const clearLocalStorageItem = (key: string): void => {
    // Remove main item
    localStorage.removeItem(key);
    
    // Remove metadata
    localStorage.removeItem(`${key}_meta`);
    
    // Remove chunks
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (storageKey && storageKey.startsWith(`${key}_chunk_`)) {
        localStorage.removeItem(storageKey);
      }
    }
  };
  
  // Load saved data from localStorage when component mounts
  useEffect(() => {
    const loadData = async () => {
      // Try to load submitted journal first
      const savedSubmittedJournal = loadFromLocalStorage('webjournal_submitted');
    if (savedSubmittedJournal) {
      try {
        // Convert the date string back to a Date object
        savedSubmittedJournal.date = new Date(savedSubmittedJournal.date);
        setSubmittedData(savedSubmittedJournal);
        setSubmitted(true);
        setTextColors(savedSubmittedJournal.textColors);
        if (savedSubmittedJournal.layoutMode) {
          setLayoutMode(savedSubmittedJournal.layoutMode);
        } else {
          // Default to freeflow if no saved layout mode
          setLayoutMode('freeflow');
        }

        // IMPORTANT: Reconstruct journalText from the text array
        // This is critical for saving to work properly later
        // Debug statement removed
        if (savedSubmittedJournal.text && Array.isArray(savedSubmittedJournal.text)) {
          const reconstructedText = savedSubmittedJournal.text.join('\n\n');
          // Debug statements removed
          setJournalText(reconstructedText);
        } else {
          // Debug statement removed
        }

        // Also restore location and images from submitted journal
        if (savedSubmittedJournal.location) {
          setLocation(savedSubmittedJournal.location);
        }
        if (savedSubmittedJournal.images) {
          setImages(savedSubmittedJournal.images);
        }
        if (savedSubmittedJournal.date) {
          const loadedDate = new Date(savedSubmittedJournal.date);
          loadedDate.setHours(12, 0, 0, 0);
          setDate(loadedDate);
        }

        console.log('Restored submitted journal from localStorage');
        
        // EXTRACT COLORS FROM EXISTING IMAGES (Mobile-friendly)
        if (savedSubmittedJournal.images && savedSubmittedJournal.images.length > 0) {
          try {
            console.log("Extracting colors from existing submitted images...");
            const extractedColors = await extractDominantColors(savedSubmittedJournal.images[0]);
            
            if (extractedColors.length > 0) {
              // Get the most vibrant color
              const newColor = extractedColors[0];
              
              // Create a complementary shadow color (30% darker)
              const r = parseInt(newColor.slice(1, 3), 16);
              const g = parseInt(newColor.slice(3, 5), 16);
              const b = parseInt(newColor.slice(5, 7), 16);
              
              const shadowR = Math.floor(r * 0.7);
              const shadowG = Math.floor(g * 0.7);
              const shadowB = Math.floor(b * 0.7);
              
              const shadowColor = `#${shadowR.toString(16).padStart(2, '0')}${
                shadowG.toString(16).padStart(2, '0')}${
                shadowB.toString(16).padStart(2, '0')}`;
              
              // Apply the new color scheme
              const newColors = {
                locationColor: newColor,
                locationShadowColor: shadowColor
              };
              
              console.log("Setting colors from existing submitted images:", newColors);
              setTextColors(newColors);

              // Update colors without forced redraw
              setTimeout(() => {
                window.CURRENT_COLORS = newColors;
                // Removed forceCanvasRedraw to prevent page flash
              }, 300);
            }
          } catch (colorError) {
            console.error("Error extracting colors from existing submitted images:", colorError);
          }
        }
        
        return; // Exit early if we found and restored a submitted journal
      } catch (error) {
        console.error('Error restoring submitted journal:', error);
        clearLocalStorageItem('webjournal_submitted');
      }
    }
    
    // If no submitted journal, try to load draft journal
    const savedDraftJournal = loadFromLocalStorage('webjournal_draft');
    if (savedDraftJournal) {
      try {
        setLocation(savedDraftJournal.location || '');
        setJournalText(savedDraftJournal.journalText || '');
        setImages(savedDraftJournal.images || []);
        
        // Parse the date string with timezone correction
        const loadedDate = new Date(savedDraftJournal.date);
        // Set time to noon to prevent date shifting
        loadedDate.setHours(12, 0, 0, 0);
        setDate(loadedDate);
        
        setTextColors(savedDraftJournal.textColors || {
          locationColor: '#2D9CDB',
          locationShadowColor: '#1D3557',
        });
        if (savedDraftJournal.layoutMode) {
          setLayoutMode(savedDraftJournal.layoutMode);
        } else {
          // Default to freeflow if no saved layout mode
          setLayoutMode('freeflow');
        }
        // Restore image positions if available
        if (savedDraftJournal.imagePositions) {
          // Debug statement removed
          setImagePositions(savedDraftJournal.imagePositions);
        } else {
          // Debug statement removed
        }
        console.log('Restored draft journal from localStorage');
      } catch (error) {
        console.error('Error restoring draft journal:', error);
        clearLocalStorageItem('webjournal_draft');
      }
    }
    };
    
    // Call the async function
    loadData();
  }, []);
  
  // Save draft journal to localStorage whenever form data changes
  useEffect(() => {
    if (!submitted) {
      const draftData = {
        location,
        journalText,
        images,
        date: date.toISOString(),
        textColors
      };
      
      if (saveToLocalStorage('webjournal_draft', draftData)) {
        // Removed save notification
      }
    }
  }, [location, journalText, images, date, textColors, submitted]);
  
  // Save submitted journal to localStorage when submission occurs
  useEffect(() => {
    if (submitted) {
      const dataToSave = {
        ...submittedData,
        date: submittedData.date.toISOString() // Convert Date to string for JSON
      };
      
      if (saveToLocalStorage('webjournal_submitted', dataToSave)) {
        // Removed save notification
        // Clear the draft when successfully submitted
        clearLocalStorageItem('webjournal_draft');
      }
    }
  }, [submitted, submittedData]);
  
  // Active editing states
  const [activeEditField, setActiveEditField] = useState<'location' | null>(null);
  const [activeTextSection, setActiveTextSection] = useState<number>(-1);
  const [isEyedropperActive, setIsEyedropperActive] = useState(false);
  const [eyedropperCallback, setEyedropperCallback] = useState<((color: string) => void) | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const textSectionRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Use proper type for canvasRef to ensure method exists
  const canvasRef = useRef<JournalCanvasHandle>(null);
  // const mobileCanvasRef = useRef<JournalCanvasHandle>(null); // Temporarily disabled

  // Helper function to get the current active canvas ref
  const getCurrentCanvasRef = () => {
    // Always return desktop canvas ref since mobile canvas is temporarily disabled
    return canvasRef.current;
  };

  // Debug state tracking removed to prevent unnecessary re-renders

  // Focus the appropriate input when editing starts
  useEffect(() => {
    if (activeEditField === 'location' && locationInputRef.current) {
      locationInputRef.current.focus();
    } else if (activeTextSection >= 0 && textSectionRefs.current[activeTextSection]) {
      textSectionRefs.current[activeTextSection]?.focus();
    }
  }, [activeEditField, activeTextSection]);

  // Fixed height textarea - no auto-resize, uses scrolling instead
  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      // Set fixed height - no auto-resize
      textarea.style.height = '200px'; // Fixed height, will scroll when content exceeds
    }
  }, []); // Only run once on mount

  // Function to clear eyedropper state
  const clearEyedropper = useCallback(() => {
    setIsEyedropperActive(false);
    setEyedropperCallback(null);
    
    // Remove overlay and all its children
    const overlay = document.getElementById('eyedropper-overlay');
    if (overlay) {
      overlay.remove();
    }
    
    console.log('Eyedropper state cleared');
  }, []);

  const activateEyedropper = useCallback((callback: (color: string) => void) => {
    // Clear any existing eyedropper state
    clearEyedropper();
    
    // Set the state
    setIsEyedropperActive(true);
    setEyedropperCallback(() => callback);
    
    // Get the journal canvas
    const journalCanvas = document.getElementById('journal-canvas') as HTMLCanvasElement;
    if (!journalCanvas) {
      console.error('Journal canvas not found for eyedropper');
      clearEyedropper();
      return;
    }
    
    // Create overlay with magnifier for precise color picking
    const overlay = document.createElement('div');
    overlay.id = 'eyedropper-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
    overlay.style.zIndex = '10000';
    overlay.style.cursor = 'crosshair';
    
    // Create magnifier element
    const magnifier = document.createElement('div');
    magnifier.id = 'color-magnifier';
    magnifier.style.position = 'absolute';
    magnifier.style.width = '150px';
    magnifier.style.height = '150px';
    magnifier.style.borderRadius = '50%';
    magnifier.style.border = '3px solid white';
    magnifier.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
    magnifier.style.overflow = 'hidden';
    magnifier.style.transform = 'translate(-50%, -50%)';
    magnifier.style.zIndex = '10001';
    magnifier.style.display = 'none';
    
    // Create color info element
    const colorInfo = document.createElement('div');
    colorInfo.id = 'color-info';
    colorInfo.style.position = 'absolute';
    colorInfo.style.left = '50%';
    colorInfo.style.bottom = '20px';
    colorInfo.style.transform = 'translateX(-50%)';
    colorInfo.style.padding = '10px 20px';
    colorInfo.style.borderRadius = '8px';
    colorInfo.style.backgroundColor = 'white';
    colorInfo.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
    colorInfo.style.fontFamily = 'system-ui, sans-serif';
    colorInfo.style.fontSize = '14px';
    colorInfo.style.color = '#333';
    colorInfo.style.zIndex = '10001';
    colorInfo.style.pointerEvents = 'none';
    colorInfo.innerHTML = '<strong>Click to pick a color</strong>';
    
    // Create magnifier canvas
    const magCanvas = document.createElement('canvas');
    magCanvas.width = 300;
    magCanvas.height = 300;
    magCanvas.style.position = 'absolute';
    magCanvas.style.top = '-75px';
    magCanvas.style.left = '-75px';
    magnifier.appendChild(magCanvas);
    
    // Add elements to DOM
    document.body.appendChild(overlay);
    overlay.appendChild(magnifier);
    overlay.appendChild(colorInfo);
    
    // Get canvas context for color detection
    const ctx = journalCanvas.getContext('2d', { willReadFrequently: true });
    const magCtx = magCanvas.getContext('2d');
    
    // Function to update magnifier view
    const updateMagnifier = (clientX: number, clientY: number) => {
      if (!ctx || !magCtx) return;
      
      // Get canvas bounds
      const rect = journalCanvas.getBoundingClientRect();
      
      // Calculate position within canvas
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      
      // Only show magnifier over the canvas
      if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        magnifier.style.display = 'block';
        magnifier.style.left = `${clientX}px`;
        magnifier.style.top = `${clientY}px`;
        
        // Clear magnifier canvas
        magCtx.clearRect(0, 0, magCanvas.width, magCanvas.height);
        
        // Draw zoomed portion of the original canvas
        magCtx.drawImage(
          journalCanvas,
          Math.max(0, x - 25), Math.max(0, y - 25),
          50, 50,
          0, 0,
          300, 300
        );
        
        // Draw crosshair
        magCtx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        magCtx.lineWidth = 2;
        magCtx.beginPath();
        magCtx.moveTo(150, 0);
        magCtx.lineTo(150, 300);
        magCtx.moveTo(0, 150);
        magCtx.lineTo(300, 150);
        magCtx.stroke();
        
        // Get color at center
        try {
          const pixel = ctx.getImageData(x, y, 1, 1).data;
          const r = pixel[0];
          const g = pixel[1];
          const b = pixel[2];
          const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          
          // Update color info
          colorInfo.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 20px; height: 20px; background-color: ${hex}; border: 1px solid #ddd;"></div>
              <strong>${hex.toUpperCase()}</strong>
            </div>
          `;
        } catch (e) {
          console.error('Error getting pixel data:', e);
        }
      } else {
        magnifier.style.display = 'none';
      }
    };
    
    // Handle mouse movement
    const handleMouseMove = (e: MouseEvent) => {
      updateMagnifier(e.clientX, e.clientY);
    };
    
    // Handle click to pick color
    const handleCanvasClick = (e: MouseEvent) => {
      if (!ctx) return;
      
      const rect = journalCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Only pick color if within canvas
      if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        try {
          const pixel = ctx.getImageData(x, y, 1, 1).data;
          const r = pixel[0];
          const g = pixel[1];
          const b = pixel[2];
          const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          
          // Save the callback before clearing
          const cb = eyedropperCallback;
          
          // Clear eyedropper state
          clearEyedropper();
          
          // Call callback with selected color
          if (cb) {
            cb(hex);
            // Removed save notification
          }
        } catch (e) {
          console.error('Error picking color:', e);
          clearEyedropper();
        }
      }
    };
    
    // Handle escape key to cancel
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearEyedropper();
      }
    };
    
    // Add event listeners
    overlay.addEventListener('mousemove', handleMouseMove);
    overlay.addEventListener('click', handleCanvasClick);
    document.addEventListener('keydown', handleKeyDown);
    
  }, [clearEyedropper]);
  
  // Function to process and optimize image data for more reliable storage
  const optimizeImageForStorage = async (imageDataUrl: string): Promise<string> => {
    try {
      // Convert data URL to Blob
      const fetchData = await fetch(imageDataUrl);
      const blob = await fetchData.blob();
      
      // Convert Blob to File object as required by imageCompression
      const file = new File([blob], "image.jpg", { type: "image/jpeg" });
      
      // Define compression options
      const options = {
        maxSizeMB: 1,                              // Standard size
        maxWidthOrHeight: 1200,                    // Standard dimensions
        useWebWorker: false,                       // Disable web workers to avoid issues
        initialQuality: 0.8,                       // Standard quality
        maxIteration: 2                           // Limit compression iterations
      };
      
      // Compress using browser-image-compression library with timeout
      const compressPromise = imageCompression(file, options);
      
      // Add timeout to avoid hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Image compression timed out')), 10000);
      });
      
      // Race the promises to handle timeout
      const compressedBlob = await Promise.race([compressPromise, timeoutPromise]) as File;
      
      // Convert back to data URL
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(compressedBlob);
      });
    } catch (error) {
      console.warn('Advanced compression failed, falling back to basic compression', error);
      
      // Fallback to original resize logic if compression fails
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
        // Create a canvas for simple resizing if needed
          const canvas = document.createElement('canvas');
          
        // Determine if we need to resize
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        
          let width = img.width;
          let height = img.height;
          
        // Resize if image is too large
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          if (width > height) {
            height = Math.floor(height * (MAX_WIDTH / width));
            width = MAX_WIDTH;
          } else {
            width = Math.floor(width * (MAX_HEIGHT / height));
            height = MAX_HEIGHT;
          }
        }
        
        // Set canvas dimensions
          canvas.width = width;
          canvas.height = height;
          
        // Draw resized image
          const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Return a moderately compressed JPEG for storage
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve(optimizedDataUrl);
        } else {
          // Fall back to original if context not available
          resolve(imageDataUrl);
        }
        };
        
        img.onerror = () => {
        console.error('Failed to load image for optimization');
        resolve(imageDataUrl);
        };
        
        img.src = imageDataUrl;
    });
    }
  };
  
  // Helper function to calculate proper initial dimensions based on image aspect ratio
  const calculateInitialImageDimensions = (imageUrl: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const aspectRatio = img.naturalWidth / img.naturalHeight;
        const maxDimension = 300; // Maximum dimension for initial size
        
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
        
        resolve({ width: Math.round(width), height: Math.round(height) });
      };
      img.onerror = () => {
        // Fallback to default dimensions if image fails to load
        resolve({ width: 200, height: 200 });
      };
      img.src = imageUrl;
    });
  };

  // Update handleImageUpload to optimize images and show loading indicator
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    // Process all selected files instead of just the first one
    let files = Array.from(e.target.files);
    
    // Allow unlimited images - no replacement logic needed
    const maxFiles = files.length; // Use all selected files

    // Show loading state in the Images section
    setIsLoadingImage(true);
    setLoadingImageCount(files.length);
    
    // Process files one at a time to reduce memory pressure on mobile
    const processFilesSequentially = async () => {
      const results = [];
      for (const file of files) {
        try {
          const result = await processImage(file);
          results.push(result);
          // Small delay between processing images to avoid UI freezes
          await new Promise(r => setTimeout(r, 100));
        } catch (error) {
          console.error('Error processing image:', error);
          showError(error instanceof Error ? error.message : 'Failed to process image');
        }
      }
      return results;
    };
    
    // Use sequential processing instead of Promise.all
    processFilesSequentially()
      .then(async (processedImages) => {
        try {
          if (processedImages.length === 0) {
            throw new Error('No images could be processed');
          }
          
          // Extract original images and enhanced images
          const originalImages = processedImages.map(img => img.originalImage);
          
          // Update state - always add new images to existing ones
          const newImages = [...images, ...originalImages];
          setImages(newImages);
          
          // Calculate proper initial dimensions for new images based on their aspect ratios
          const newImageDimensions = await Promise.all(
            originalImages.map(img => calculateInitialImageDimensions(img))
          );
          
          // Preserve existing image positions and add properly sized positions for new images
          setImagePositions(prev => {
            const newPositions = [...prev];
            const existingImageCount = prev.length; // Number of existing images
            // Add properly sized positions for any new images
            for (let i = 0; i < newImageDimensions.length; i++) {
              const dimensions = newImageDimensions[i];

              // Spread images out across the canvas to prevent overlap
              const canvasWidth = 3100; // Canvas width
              const canvasHeight = 4370; // Canvas height
              const centerX = (canvasWidth - dimensions.width) / 2;
              const centerY = (canvasHeight - dimensions.height) / 2;

              // Spread images out significantly more
              const offsetRange = 400; // Larger offset to spread images
              const imageIndex = existingImageCount + i; // Account for existing images

              // Use a grid-like pattern with randomness for better spread
              const gridCols = 3;
              const gridX = (imageIndex % gridCols) - 1; // -1, 0, 1
              const gridY = Math.floor(imageIndex / gridCols);

              const baseOffsetX = gridX * (dimensions.width + 100);
              const baseOffsetY = gridY * (dimensions.height + 100);

              // Add randomness to avoid perfect grid
              const randomOffsetX = (Math.random() - 0.5) * 100;
              const randomOffsetY = (Math.random() - 0.5) * 100;

              const x = centerX + baseOffsetX + randomOffsetX;
              const y = centerY + baseOffsetY + randomOffsetY;

              // Ensure images don't go off the canvas edges
              const finalX = Math.max(50, Math.min(x, canvasWidth - dimensions.width - 50));
              const finalY = Math.max(50, Math.min(y, canvasHeight - dimensions.height - 50));

              newPositions.push({
                x: finalX,
                y: finalY,
                width: dimensions.width,
                height: dimensions.height
              });
            }
            return newPositions;
          });

          // FORCE COLOR EXTRACTION: Extract colors from the first processed image
          if (originalImages.length > 0) {
            try {
              console.log("Extracting colors from newly uploaded image...");
              const extractedColors = await extractDominantColors(originalImages[0]);
              
              if (extractedColors.length > 0) {
                // Get the most vibrant color
                const newColor = extractedColors[0];
                
                // Create a complementary shadow color (30% darker)
                const r = parseInt(newColor.slice(1, 3), 16);
                const g = parseInt(newColor.slice(3, 5), 16);
                const b = parseInt(newColor.slice(5, 7), 16);
                
                const shadowR = Math.floor(r * 0.7);
                const shadowG = Math.floor(g * 0.7);
                const shadowB = Math.floor(b * 0.7);
                
                const shadowColor = `#${shadowR.toString(16).padStart(2, '0')}${
                  shadowG.toString(16).padStart(2, '0')}${
                  shadowB.toString(16).padStart(2, '0')}`;
                
                // Apply the new color scheme
                const newColors = {
                  locationColor: newColor,
                  locationShadowColor: shadowColor
                };
                
                console.log("Setting colors from image:", newColors);
                setTextColors(newColors);
                
                // Add a delay before forcing redraw to prevent UI freeze
                setTimeout(() => {
                  // Update colors without forced redraw to prevent blinking
                  window.CURRENT_COLORS = newColors;
                  // Removed forceCanvasRedraw to prevent page flash
                  // The canvas will update automatically when colors change
                  
                  // Show notification with the extracted color
                  // Removed save notification
                }, 300);
              }
            } catch (error) {
              console.error("Error extracting colors:", error);
            }
          }
          
          // Save to local storage
          saveJournalData();

          // Hide loading state
          setIsLoadingImage(false);
        } catch (error) {
          console.error('Error processing images:', error);
          setIsLoadingImage(false);
          showError('Could not process images. Please try again.');
        }
      })
      .catch(error => {
        console.error('Error processing images:', error);
        setIsLoadingImage(false);
        showError('There was an error processing one or more images. Please try a different image.');
      })
      .finally(() => {
        // Clear the file input
        if (e.target) {
          e.target.value = '';
        }
      });
  };
  
  // Handle replacing an image
  const handleReplaceImage = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files[0]) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (e.target?.result) {
        try {
          // Optimize the image before storing
          const optimizedImage = await optimizeImageForStorage(e.target.result as string);
          
          const newImages = [...submittedData.images];
          newImages[index] = optimizedImage;
          
          const updatedData = {
            ...submittedData,
            images: newImages
          };
          
          setSubmittedData(updatedData);
          
          // EXTRACT COLORS FROM THE REPLACED IMAGE (Mobile-friendly)
          try {
            console.log("Extracting colors from replaced image...");
            const extractedColors = await extractDominantColors(optimizedImage);
            
            if (extractedColors.length > 0) {
              // Get the most vibrant color
              const newColor = extractedColors[0];
              
              // Create a complementary shadow color (30% darker)
              const r = parseInt(newColor.slice(1, 3), 16);
              const g = parseInt(newColor.slice(3, 5), 16);
              const b = parseInt(newColor.slice(5, 7), 16);
              
              const shadowR = Math.floor(r * 0.7);
              const shadowG = Math.floor(g * 0.7);
              const shadowB = Math.floor(b * 0.7);
              
              const shadowColor = `#${shadowR.toString(16).padStart(2, '0')}${
                shadowG.toString(16).padStart(2, '0')}${
                shadowB.toString(16).padStart(2, '0')}`;
              
              // Apply the new color scheme
              const newColors = {
                locationColor: newColor,
                locationShadowColor: shadowColor
              };
              
              console.log("Setting colors from replaced image:", newColors);
              setTextColors(newColors);

              // Update colors without forced redraw
              setTimeout(() => {
                window.CURRENT_COLORS = newColors;
                // Removed forceCanvasRedraw to prevent page flash
              }, 300);
            }
          } catch (colorError) {
            console.error("Error extracting colors from replaced image:", colorError);
          }
          
          // Save to localStorage
          const dataToSave = {
            ...updatedData,
            date: updatedData.date.toISOString()
          };
          
          if (saveToLocalStorage('webjournal_submitted', dataToSave)) {
            // Removed save notification
          } else {
            console.error('Error saving image replacement');
          }
        } catch (error) {
          console.error('Error optimizing replacement image:', error);
        }
      }
    };
    reader.readAsDataURL(files[0]);
    
    // Reset the input
    e.target.value = '';
  };
  
  // Remove image from form before submission
  const removeImage = (index: number) => {
    // Batch updates to prevent multiple re-renders
    React.startTransition(() => {
      setImages(prev => prev.filter((_, i) => i !== index));
      setImagePositions(prev => prev.filter((_, i) => i !== index));
    });
  };
  
  // Add an image after journal generation
  const handleAddImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files[0]) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (e.target?.result) {
        try {
          // Optimize the image before storing
          const optimizedImage = await optimizeImageForStorage(e.target.result as string);
          
          const updatedData = {
            ...submittedData,
            images: [...submittedData.images, optimizedImage]
          };
          
          setSubmittedData(updatedData);
          
          // EXTRACT COLORS FROM THE NEW IMAGE (Mobile-friendly)
          try {
            console.log("Extracting colors from newly added image...");
            const extractedColors = await extractDominantColors(optimizedImage);
            
            if (extractedColors.length > 0) {
              // Get the most vibrant color
              const newColor = extractedColors[0];
              
              // Create a complementary shadow color (30% darker)
              const r = parseInt(newColor.slice(1, 3), 16);
              const g = parseInt(newColor.slice(3, 5), 16);
              const b = parseInt(newColor.slice(5, 7), 16);
              
              const shadowR = Math.floor(r * 0.7);
              const shadowG = Math.floor(g * 0.7);
              const shadowB = Math.floor(b * 0.7);
              
              const shadowColor = `#${shadowR.toString(16).padStart(2, '0')}${
                shadowG.toString(16).padStart(2, '0')}${
                shadowB.toString(16).padStart(2, '0')}`;
              
              // Apply the new color scheme
              const newColors = {
                locationColor: newColor,
                locationShadowColor: shadowColor
              };
              
              console.log("Setting colors from added image:", newColors);
              setTextColors(newColors);

              // Update colors without forced redraw
              setTimeout(() => {
                window.CURRENT_COLORS = newColors;
                // Removed forceCanvasRedraw to prevent page flash
              }, 300);
            }
          } catch (colorError) {
            console.error("Error extracting colors from added image:", colorError);
          }
          
          // Save to localStorage
          const dataToSave = {
            ...updatedData,
            date: updatedData.date.toISOString()
          };
          
          if (saveToLocalStorage('webjournal_submitted', dataToSave)) {
            // Removed save notification
          } else {
            console.error('Error saving new image');
          }
        } catch (error) {
          console.error('Error optimizing image:', error);
        }
      }
    };
    reader.readAsDataURL(files[0]);
    
    // Reset the input
    e.target.value = '';
  };
  
  // Handle removing an image
  const handleRemoveImage = (index: number) => {
    const newImages = [...submittedData.images];
    newImages.splice(index, 1);
    
    const updatedData = {
      ...submittedData,
      images: newImages
    };
    
    setSubmittedData(updatedData);
    
    // Save to localStorage
    const dataToSave = {
      ...updatedData,
      date: updatedData.date.toISOString()
    };
    
    if (saveToLocalStorage('webjournal_submitted', dataToSave)) {
      // Removed save notification
    } else {
      console.error('Error saving image removal');
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Break the journal text into paragraphs
    const textSections = journalText.split('\n\n').filter(section => section.trim().length > 0);
    
    const newSubmittedData = {
      date,
      location,
      text: textSections,
      images,
      textColors,
      layoutMode
    };
    
    setSubmittedData(newSubmittedData);
    setSubmitted(true);
    
    // Clear draft storage since we're now submitted
    clearLocalStorageItem('webjournal_draft');
    
    // Save to submitted storage
    const dataToSave = {
      ...newSubmittedData,
      date: date.toISOString()
    };
    
    if (saveToLocalStorage('webjournal_submitted', dataToSave)) {
      // Removed save notification
    } else {
      console.error('Error saving submitted journal');
    }
    
    // Save to backend
    saveJournalToBackend();
  };
  
  const handleReset = () => {
    setLocation('');
    setJournalText('');
    setImages([]);
    setImagePositions([]); // Clear image positions when resetting
    
    // Create a new date with noon time to avoid timezone issues
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    setDate(today);
    
    setLayoutMode('freeflow');
    setSubmitted(false);
    setActiveEditField(null);
    setActiveTextSection(-1);
    
    // Reset inspiration state
    setNeedInspiration(false);
    setHasGeneratedInspiration(false);
            setInspirationQuestion("");
    
    // Clear all stored data when resetting
    clearLocalStorageItem('webjournal_submitted');
    clearLocalStorageItem('webjournal_draft');
  };

  // Expose functions globally for header buttons
  useEffect(() => {
    window.handleHighQualityPDFExport = handleHighQualityPDFExport;
    window.handleReset = handleReset;
    
    return () => {
      delete window.handleHighQualityPDFExport;
      delete window.handleReset;
    };
  }, []);
  
  // Apply color changes
  const handleColorChange = (newColors: TextColors) => {
    console.log("Color change handler called with:", newColors);
    
    // Update state with new colors
    setTextColors(newColors);
    
    // Update submitted data with new colors
    const updatedData = {
      ...submittedData,
      textColors: newColors,
      forceUpdate: Date.now() // Force update with timestamp
    };
    
    setSubmittedData(updatedData);

    // Removed forceCanvasRedraw to prevent page flash
    // Canvas will update automatically when colors change

    // We're removing the auto-save logic here to allow experimenting with colors
    // without triggering automatic saves
  };
  
  // Handle location text edit
  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newLocation = e.target.value;
    
    const updatedData = {
      ...submittedData,
      location: newLocation
    };
    
    setSubmittedData(updatedData);
    
    // Save updated submittedData to localStorage
    const dataToSave = {
      ...updatedData,
      date: submittedData.date.toISOString()
    };
    
    if (saveToLocalStorage('webjournal_submitted', dataToSave)) {
      // Removed save notification
    } else {
      console.error('Error saving location change');
    }
  };
  
  // Handle text section change
  const handleTextSectionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const index = parseInt(e.target.dataset.index || '0', 10);

    const newTextSections = [...submittedData.text];
    newTextSections[index] = value;

    const updatedData = {
      ...submittedData,
      text: newTextSections
    };

    setSubmittedData(updatedData);

    // IMPORTANT: Keep journalText in sync with submittedData.text
    // This is critical for saving to work properly
    const updatedJournalText = newTextSections.join('\n\n');
    setJournalText(updatedJournalText);
    // Debug statement removed

    // Save to localStorage
    const dataToSave = {
      ...updatedData,
      date: updatedData.date.toISOString()
    };

    if (saveToLocalStorage('webjournal_submitted', dataToSave)) {
      // Removed save notification
    } else {
      console.error('Error saving text change');
    }
  };
  
  // Fix for layoutMode in the edit panel
  const handleTextClick = (area: ClickableTextArea) => {
    if (area.type === 'location') {
      setActiveEditField('location');
      setActiveTextSection(-1);
    } else if (area.type === 'text' && typeof area.index === 'number') {
      setActiveEditField(null);
      setActiveTextSection(area.index);
    }
  };
  
  // Add a new text section
  const addNewTextSection = () => {
    const newTextSections = [...submittedData.text, ''];
    const updatedData = {
      ...submittedData,
      text: newTextSections
    };

    setSubmittedData(updatedData);
    setActiveTextSection(submittedData.text.length);

    // IMPORTANT: Keep journalText in sync with submittedData.text
    const updatedJournalText = newTextSections.join('\n\n');
    setJournalText(updatedJournalText);
    // Debug statement removed

    // Save to localStorage
    const dataToSave = {
      ...updatedData,
      date: updatedData.date.toISOString()
    };

    if (saveToLocalStorage('webjournal_submitted', dataToSave)) {
      // Removed save notification
    } else {
      console.error('Error saving new text section');
    }
  };
  
  // Remove a text section
  const removeTextSection = (index: number) => {
    const newTextSections = [...submittedData.text];
    newTextSections.splice(index, 1);

    const updatedData = {
      ...submittedData,
      text: newTextSections
    };

    setSubmittedData(updatedData);
    setActiveTextSection(-1);

    // IMPORTANT: Keep journalText in sync with submittedData.text
    const updatedJournalText = newTextSections.join('\n\n');
    setJournalText(updatedJournalText);
    // Debug statement removed

    // Save to localStorage
    const dataToSave = {
      ...updatedData,
      date: updatedData.date.toISOString()
    };

    if (saveToLocalStorage('webjournal_submitted', dataToSave)) {
      // Removed save notification
    } else {
      console.error('Error saving text section removal');
    }
  };
  
  // Get complementary color (same function as in ColorPicker)
  const getComplementaryColor = (hex: string, offset: number = 180): string => {
    // Convert hex to RGB
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
        default: h = 0;
      }
      
      h = Math.round(h * 60);
    }
    
    // Create complementary hue (opposite or offset)
    h = (h + offset) % 360;
    s = Math.round(s * 100);
    l = Math.round(l * 100);
    
    // We want the shadow to be darker
    l = Math.max(20, l - 15);
    
    // Convert back to hex using HSL to RGB conversion
    const hslToRgb = (h: number, s: number, l: number): string => {
      const hueToRgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      h /= 360;
      s /= 100;
      l /= 100;
      
      let r, g, b;
      
      if (s === 0) {
        r = g = b = l;
      } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hueToRgb(p, q, h + 1/3);
        g = hueToRgb(p, q, h);
        b = hueToRgb(p, q, h - 1/3);
      }
      
      const toHex = (x: number) => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      };
      
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    };
    
    return hslToRgb(h, s, l);
  };
  
  // Add a new function to handle canvas image clicks
  const handleCanvasImageClick = (x: number, y: number) => {
    // This function is no longer needed for eyedropper - clicks handled directly on overlay
    console.log('Canvas image click at', x, y, 'Eyedropper active:', isEyedropperActive);
  };

  // Clean image manipulation handlers (like mobile version)
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


    // PDF export function
  const handleShare = async () => {
    
    // Create a loading notification
    const notificationId = loading("Creating high-quality PDF...");
    
    try {
      // Step 1: Find the journal element - try multiple strategies
      update(notificationId, {
        render: "Finding journal content..."
      });
      
      let journalElement: HTMLElement | null = null;
      
      // Strategy 1: Try to find the actual canvas element first
      const canvasElement = document.querySelector('canvas') as HTMLCanvasElement;
      if (canvasElement) {
        journalElement = canvasElement;
        console.log('Using canvas element:', journalElement);
      }
      
      // Strategy 2: Try the ref
      if (!journalElement && journalRef.current) {
        journalElement = journalRef.current;
        console.log('Using journalRef.current:', journalElement);
      }
      
      // Strategy 3: Try to find by ID
      if (!journalElement) {
        journalElement = document.getElementById('journal-container');
        console.log('Using journal-container ID:', journalElement);
      }
      
      // Strategy 4: Try to find the main form container
      if (!journalElement) {
        journalElement = document.querySelector('[data-journal-content]') as HTMLElement;
        console.log('Using data-journal-content:', journalElement);
      }
      
      // Strategy 5: Find the entire form
      if (!journalElement) {
        journalElement = document.querySelector('form') as HTMLElement;
        console.log('Using form element:', journalElement);
      }
      
      if (!journalElement) {
        throw new Error('Could not find journal element to capture');
      }
      
      console.log('Final element dimensions:', {
        width: journalElement.offsetWidth,
        height: journalElement.offsetHeight,
        scrollWidth: journalElement.scrollWidth,
        scrollHeight: journalElement.scrollHeight
      });
      
      // Step 2: Capture the journal with debugging
      update(notificationId, {
        render: "Capturing journal content..."
      });
      
      // Wait a moment to ensure everything is rendered
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Use maximum scale for 4K quality - fuck memory issues, we want quality
      const scale = 8; // 8x scale for ultra-high quality
      
      const canvas = await html2canvas(journalElement, {
        scale: scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false, // Disable logging for performance
        imageTimeout: 180000, // 3 minutes timeout for high quality
        letterRendering: true,
        foreignObjectRendering: false,
        removeContainer: false,
        // High quality rendering options
        width: journalElement.scrollWidth,
        height: journalElement.scrollHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc: Document) => {
          // Ensure all styles are applied in the cloned document
          const clonedElement = clonedDoc.querySelector('[data-journal-content]') || clonedDoc.querySelector('#journal-container');
          if (clonedElement) {
            (clonedElement as HTMLElement).style.minHeight = '300px';
            (clonedElement as HTMLElement).style.visibility = 'visible';
            (clonedElement as HTMLElement).style.opacity = '1';
            (clonedElement as HTMLElement).style.transform = 'none';
            (clonedElement as HTMLElement).style.filter = 'none';
          }
          
          // Ensure all canvas elements are properly rendered
          const canvasElements = clonedDoc.querySelectorAll('canvas');
          canvasElements.forEach(canvas => {
            canvas.style.imageRendering = 'pixelated';
            canvas.style.imageRendering = '-moz-crisp-edges';
            canvas.style.imageRendering = 'crisp-edges';
          });
          
          // Ensure all text is crisp
          const textElements = clonedDoc.querySelectorAll('*');
          textElements.forEach(element => {
            const htmlElement = element as HTMLElement;
            htmlElement.style.textRendering = 'optimizeLegibility';
            (htmlElement.style as any).fontSmooth = 'never';
            (htmlElement.style as any).webkitFontSmoothing = 'none';
          });
        }
      });
      
      console.log('Canvas created:', {
        width: canvas.width,
        height: canvas.height,
        isEmpty: canvas.width === 0 || canvas.height === 0
      });
      
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Generated canvas is empty - no content captured');
      }
      
      // Step 3: Generate PDF with debugging
      update(notificationId, {
        render: "Generating PDF document..."
      });
      
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      console.log('PDF dimensions:', {
        imgWidth,
        imgHeight,
        pageHeight,
        pagesNeeded: Math.ceil(imgHeight / pageHeight)
      });
      
      // Create PDF with high quality settings
      const pdf = new jsPDF({ 
        orientation: 'portrait', 
        unit: 'mm', 
        format: 'a4',
        compress: false // Disable compression for better quality
      });
      
      // Convert canvas to high quality image data
      const imgData = canvas.toDataURL('image/png', 1.0);
      
      console.log('Image data length:', imgData.length);
      
      if (imgData.length < 1000) {
        throw new Error('Generated image data is too small - likely blank');
      }
      
      // Add image to PDF
      if (imgHeight <= pageHeight) {
        // Single page
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      } else {
        // Multiple pages
        let heightLeft = imgHeight;
        let position = 0;
        const pagesNeeded = Math.ceil(imgHeight / pageHeight);
        
        for (let i = 0; i < pagesNeeded; i++) {
          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, -position, imgWidth, imgHeight);
          position += pageHeight;
          heightLeft -= pageHeight;
        }
      }
      
      // Step 4: Download the PDF
      update(notificationId, {
        render: "Downloading PDF..."
      });
      
      const filename = `journal-${format(date, 'yyyy-MM-dd')}.pdf`;
      
      // Save the PDF
      pdf.save(filename);
      
      // Success message
      update(notificationId, {
        render: "✅ High-quality PDF downloaded successfully!",
        type: "success"
      });
      
    } catch (error) {
      console.error("Error creating PDF:", error);
      update(notificationId, {
        render: `❌ Failed to create PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: "error"
      });
    }
  };
  
  // Handle PDF Save function (for dropdown menu)
  const handleSaveAsPDF = async () => {
    // Reuse the share functionality which now focuses on PDF export
    handleShare();
  };

  // New high-quality PDF export function using the canvas export
  const handleHighQualityPDFExport = async () => {
    const currentCanvas = getCurrentCanvasRef();
    if (currentCanvas && currentCanvas.exportUltraHDPDF) {
      currentCanvas.exportUltraHDPDF();
    } else {
      // Fallback to regular PDF export
      handleShare();
    }
  };
  
  const journalRef = useRef<HTMLDivElement>(null);
  
  // Save journal data to localStorage
  const saveJournalData = () => {
    const draftData = {
      location,
      journalText,
      images,
      date: date.toISOString(),
      textColors,
      layoutMode,
      imagePositions
    };
    
    // Debug statement removed
    saveToLocalStorage('webjournal_draft', draftData);
  };
  
  // Add a useEffect to ensure the location input gets and keeps focus when needed
  useEffect(() => {
    if (activeEditField === 'location' && locationInputRef.current) {
      // Set a short timeout to ensure focus happens after rendering
      const focusTimeout = setTimeout(() => {
        locationInputRef.current?.focus();
      }, 50);
      
      return () => clearTimeout(focusTimeout);
    }
  }, [activeEditField]);
  
  const [isSharing, setIsSharing] = useState(false);
  

  
  // Auto-save the journal as the user types
  useEffect(() => {
    // Don't save if no content has been entered yet
    if (!location && !journalText && images.length === 0) {
      return;
    }
    
    // Create a debounced auto-save
    const autoSaveTimeout = setTimeout(() => {
      // Store the draft in localStorage
      const dataToSave = {
        date: date.toISOString(),
        location,
        text: journalText.split('\n\n').filter(section => section.trim().length > 0),
        images,
        textColors,
        layoutMode,
        imagePositions
      };
      
      saveToLocalStorage('webjournal_draft', dataToSave);
    }, 2000); // 2 second debounce
    
    return () => clearTimeout(autoSaveTimeout);
  }, [location, journalText, images, textColors, layoutMode, date, imagePositions]);

  // Enhanced date formatting for input element using sample.js logic
  const formatDateForInput = (date: Date): string => {
    // Use the same date handling logic as sample.js
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const adjustedDate = new Date(year, month, day, 12, 0, 0);
    
    const monthStr = String(adjustedDate.getMonth() + 1).padStart(2, '0'); // months are 0-indexed
    const dayStr = String(adjustedDate.getDate()).padStart(2, '0');
    return `${adjustedDate.getFullYear()}-${monthStr}-${dayStr}`;
  };

  // Add the styles to the document
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.innerHTML = datePickerStyles;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // Create a ref for the camera input
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Helper functions for color extraction
  const extractDominantColors = (imageUrl: string): Promise<string[]> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      
      img.onload = () => {
        // Create a canvas to draw the image
        const canvas = document.createElement('canvas');
        const size = 150;
        canvas.width = size;
        canvas.height = size;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(['#3498DB']); // Fallback color
          return;
        }
        
        // Draw the image
        ctx.drawImage(img, 0, 0, size, size);
        
        // Sample colors from different regions
        const regions = [
          {x: size/4, y: size/4},  // Top-left
          {x: size*3/4, y: size/4},  // Top-right
          {x: size/2, y: size/2},  // Center
          {x: size/4, y: size*3/4},  // Bottom-left
          {x: size*3/4, y: size*3/4},  // Bottom-right
        ];
        
        // Extract colors
        const extractedColors: string[] = [];
        
        regions.forEach(({x, y}) => {
          const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
          const hex = `#${pixel[0].toString(16).padStart(2, '0')}${
            pixel[1].toString(16).padStart(2, '0')}${
            pixel[2].toString(16).padStart(2, '0')}`;
          
          // Skip colors that are too dark or too light
          const brightness = (pixel[0] * 299 + pixel[1] * 587 + pixel[2] * 114) / 1000;
          if (brightness > 30 && brightness < 220) {
            extractedColors.push(hex);
          }
        });
        
        // Add fallback if no good colors found
        if (extractedColors.length === 0) {
          extractedColors.push('#3498DB');
        }
        
        resolve(extractedColors);
      };
      
      img.onerror = () => {
        console.error("Failed to load image for color extraction");
        resolve(['#3498DB']); // Fallback color
      };
      
      img.src = imageUrl;
    });
  };
  
  // Process each file
  const processImage = async (file: File) => {
    return new Promise<{originalImage: string, enhancedImage: string}>((resolve, reject) => {
      // First check file size - reject oversized files immediately
      const maxSizeInMB = 10;
      if (file.size > maxSizeInMB * 1024 * 1024) {
        reject(new Error(`Image too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is ${maxSizeInMB}MB.`));
        return;
      }
      
      const reader = new FileReader();
      
      // Add timeout to prevent hanging on problematic files
      const timeoutId = setTimeout(() => {
        reader.abort();
        reject(new Error('Image reading timed out. Please try a different image.'));
      }, 15000);
      
      reader.onload = async (event) => {
        clearTimeout(timeoutId);
        
        if (!event.target || typeof event.target.result !== 'string') {
          reject(new Error('Failed to read file'));
          return;
        }
        
        try {
          // Optimize the image with memory management
          const optimizedImage = await optimizeImageForStorage(event.target.result);
          
          // Apply AI enhancement with fallback
          let enhancedImage;
          try {
            enhancedImage = await enhanceImageWithAI(optimizedImage);
          } catch (enhanceError) {
            console.error('Image enhancement failed, using original:', enhanceError);
            enhancedImage = optimizedImage;
          }
          
          // Return both versions
          resolve({
            originalImage: optimizedImage,
            enhancedImage: enhancedImage
          });
        } catch (error) {
          console.error('Image processing error:', error);
          reject(error);
        }
      };
      
      reader.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error('Error reading file'));
      };
      
      reader.onabort = () => {
        clearTimeout(timeoutId);
        reject(new Error('File reading was aborted'));
      };
      
      // Read as data URL with error handling
      try {
        reader.readAsDataURL(file);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(new Error('Failed to start reading file'));
      }
    });
  };

  // Removed showPreview state - no longer needed

  // 2. Handle sticker upload
  const handleStickerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Process all selected files
    const fileArray = Array.from(files);
    console.log(`Processing ${fileArray.length} stickers...`);
    
    const currentCanvas = getCurrentCanvasRef();
    if (currentCanvas) {
      try {
        // Pass all files to canvas component
        console.log("Canvas ref exists, adding stickers...");
        currentCanvas.addMultipleStickers(fileArray);
      } catch (error) {
        console.error("Error adding stickers:", error);
        // Try accessing method differently as fallback
        // @ts-ignore - Force call for debugging
        if (typeof currentCanvas.addMultipleStickers === 'function') {
          console.log("Method exists but failed, trying direct call");
          currentCanvas.addMultipleStickers(fileArray);
        } else {
          console.error("Method doesn't exist on ref:", currentCanvas);
        }
      }
    } else {
      console.error("Canvas ref is null - can't add stickers");
    }
    
    // Reset the input value so the same file can be selected again
    e.target.value = '';
  };



  // Debug statement removed to prevent unnecessary re-renders

  return (
    <div className="bg-black w-full min-h-dvh overflow-x-clip">
      {/* Custom notification component */}
      {notification && (
        <CustomNotification
          isVisible={notification.isVisible}
          message={notification.message}
          type={notification.type}
          progress={notification.progress}
        />
      )}

      {/* Mobile Navbar - Only visible on mobile */}
      <div className="md:hidden relative z-50 py-3 border-b border-white/20 bg-black/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center">
              <div className="text-4xl md:text-5xl text-white font-light">
                <span className="logo-m">m</span>
              </div>
            </div>

            {/* Mobile action buttons */}
            <div className="flex items-center gap-2">
              {/* Download Journal Button */}
              <button
                onClick={handleHighQualityPDFExport}
                className="inline-flex items-center justify-center p-2 rounded-lg text-white focus:outline-none transition-all duration-200"
                style={{
                  backgroundColor: textColors.locationColor,
                  opacity: 0.9
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.9'}
                title="Download Journal"
              >
                <svg className="block h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </button>

              {/* Clear Journal Button */}
              <button
                onClick={handleReset}
                className="inline-flex items-center justify-center p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white focus:outline-none transition-all duration-200"
                title="Clear Journal"
              >
                <svg className="block h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className="relative journal-form-container min-h-screen md:h-full"
        data-debug-component="journal-form-container"
        style={{
          boxSizing: 'border-box',
          position: 'relative'
        }}
      >
        {/* TV Static background video for professional ambiance */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-20"
          style={{ filter: 'contrast(1.1) brightness(0.4)' }}
        >
          <source src="/background/static.webm" type="video/webm" />
          <source src="/background/static.mp4" type="video/mp4" />
        </video>
        {/* Professional overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/75 to-black/80 z-1"></div>
        {/* Main content */}
        <div className="relative z-10 h-full flex flex-col overflow-hidden">
          {/* Journal editor content - Bounded container for desktop */}
          <div className="p-1 sm:p-2 md:p-2 lg:p-3 w-full max-w-[1600px] mx-auto h-full flex flex-col md:items-start items-center overflow-hidden">
            {/* Desktop: Side by side layout */}
            <div className="hidden md:grid gap-3 w-full max-w-[1600px] mx-auto h-full overflow-hidden" style={{ gridTemplateColumns: '700px 1fr' }}>

              {/* Journal Preview - Left side on desktop */}
              <div className="bg-black md:rounded-2xl md:shadow-2xl md:border md:border-white/20 overflow-hidden order-1 flex flex-col h-full">
                {/* Journal preview content with buttons directly underneath */}
                <div className="flex-1">
                  <div className="p-2 md:p-3 lg:p-6">
                    <div className="relative bg-gradient-to-br from-[#1a1a1a]/70 to-[#2a2a2a]/70 rounded-xl overflow-hidden shadow-lg border border-white/10 md:h-[calc(100vh*0.85-1rem)]" ref={journalRef} id="journal-container" data-journal-content>
                      {/* Debug statement removed */}
                      {/* Desktop canvas debug removed */}
                      <MemoizedJournalCanvas
                        key="desktop-journal-canvas"
                        ref={canvasRef}
                        date={date}
                        location={location}
                        textSections={journalText.split('\n\n').filter(section => section.trim().length > 0)}
                        images={images}
                        onNewEntry={handleReset}
                        templateUrl={templateUrl}
                        textColors={textColors}
                        layoutMode={layoutMode}
                        editMode={true}
                        onTextClick={handleTextClick}
                        onImageDrag={handleImageDrag}
                        onImageResize={handleImageResize}
                        onImageClick={handleCanvasImageClick}
                        onImageDelete={handleImageDelete}
                        needInspiration={needInspiration}
                        inspirationQuestion={inspirationQuestion}
                        savedImagePositions={imagePositions}
                      />
                    </div>
                    
                    {/* Action buttons directly underneath journal preview - each half width, side by side */}
                    <div className="mt-3 flex gap-2">
                      {/* Download Journal Button */}
                      <button
                        onClick={() => {
                          if (window.handleHighQualityPDFExport) {
                            window.handleHighQualityPDFExport();
                          }
                        }}
                        className="group flex items-center justify-center gap-2 flex-1 h-10 rounded text-white focus:outline-none transition-all duration-200"
                        style={{
                          backgroundColor: `${textColors.locationColor}90`,
                          borderColor: textColors.locationColor,
                          borderWidth: '1px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = textColors.locationColor;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = `${textColors.locationColor}90`;
                        }}
                        title="Download PDF"
                      >
                        <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                        <span className="text-sm font-medium">Download</span>
                      </button>

                      {/* Clear Journal Button */}
                      <button
                        onClick={() => {
                          if (window.handleReset) {
                            window.handleReset();
                          }
                        }}
                        className="group flex items-center justify-center gap-2 flex-1 h-10 rounded bg-red-600 border border-red-500 text-white hover:bg-red-700 hover:border-red-600 focus:outline-none transition-all duration-200"
                        title="Clear Journal"
                      >
                        <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                        <span className="text-sm font-medium">Clear</span>
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              {/* Input Form - Full width on mobile, left side on desktop */}
              <div className="bg-black md:rounded-2xl md:shadow-2xl md:border md:border-white/20 overflow-hidden order-2 md:order-1 flex flex-col h-full">

                <div className="p-2 md:p-3 lg:p-4 border-b border-white/10 flex-shrink-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <label htmlFor="location" className="block text-sm md:text-lg font-medium text-white flex items-center gap-1 md:gap-2">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-gray-300">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                        <span>Location</span>
                      </label>
                                              <input
                          type="text"
                          id="location"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="e.g., MANIA, LA JOLLA, CA"
                          className="w-full rounded-lg border border-white/30 shadow-sm focus:border-white focus:ring-2 focus:ring-white/30 px-2 py-2 md:px-3 md:py-2 text-gray-400 transition-all duration-200 bg-black/40 backdrop-blur-sm text-sm md:text-base location-input-responsive placeholder-gray-400"
                          required
                        />
                    </div>
                    <div className="flex-shrink-0">
                      <label className="block text-sm md:text-lg font-medium text-white flex items-center gap-1 md:gap-2">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-gray-300">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                        <span>Date</span>
                      </label>
                      <DatePicker
                        selected={date}
                        onChange={(selectedDate: Date | null) => {
                          if (selectedDate) {
                            // Use the same date handling logic as sample.js
                            const year = selectedDate.getFullYear();
                            const month = selectedDate.getMonth();
                            const day = selectedDate.getDate();
                            const adjustedDate = new Date(year, month, day, 12, 0, 0);
                            setDate(adjustedDate);
                          }
                        }}
                        className="rounded-lg border border-white/30 shadow-sm focus:border-white focus:ring-2 focus:ring-white/30 px-3 py-2 text-gray-400 transition-all duration-200 bg-black/40 backdrop-blur-sm text-sm w-full min-w-[180px]"
                        dateFormat="MMMM dd, yyyy"
                        popperPlacement="bottom-end"
                        required
                        wrapperClassName="text-gray-400 w-full"
                      />
                    </div>
                  </div>
                </div>
                <div className="p-2 md:p-3 lg:p-4 flex-1 overflow-y-auto relative" style={{ scrollbarGutter: 'stable' }}>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                  >
                    {/* Desktop layout */}
                    <div className="space-y-4 md:space-y-5 lg:space-y-6 md:pb-8 md:max-w-full">
                      {/* Images and Colors side by side - Hidden on mobile */}
                      <div className="hidden md:grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                        {/* Images */}
                        <div className="bg-black/40 backdrop-blur-sm rounded-lg shadow-sm border border-white/20 p-3 flex flex-col">
                          <label className="block text-lg font-medium text-white flex items-center gap-2 mb-2">
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-gray-300">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                            <span>Images ({images.length})</span>
                          </label>
                          <div
                            className="border-2 border-dashed rounded-xl py-4 px-2 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 relative group border-white/30 bg-black/40 backdrop-blur-sm hover:border-white/50 hover:bg-black/50 flex-1"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {isLoadingImage && (
                              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center z-10 gap-2">
                                <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent"></div>
                                <p className="text-white text-sm">Processing {loadingImageCount} image{loadingImageCount > 1 ? 's' : ''}...</p>
                              </div>
                            )}
                            <svg className="w-6 h-6 mb-1 transition-colors text-gray-300 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                            </svg>
                            <p className="text-sm text-center transition-colors text-gray-300 group-hover:text-white">
                              Upload Images
                            </p>
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={handleImageUpload}
                              accept="image/*"
                              multiple
                              style={{ display: 'none' }}
                            />
                          </div>
                        </div>

                        {/* Colors */}
                        <div className="bg-black/40 backdrop-blur-sm rounded-lg shadow-sm border border-white/20 p-3 flex flex-col">
                          <label className="block text-lg font-medium text-white flex items-center gap-2 mb-2">
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-gray-300">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"></path>
                            </svg>
                            <span>Colors</span>
                          </label>
                          <div className="flex justify-center items-center flex-1">
                            <SimpleColorPicker
                              colors={textColors}
                              onChange={handleColorChange}
                              images={submitted ? submittedData.images : images}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Journal Entry Header */}
                      <div className="flex justify-between items-center relative">
                        <label htmlFor="journalText" className="block text-sm md:text-lg font-medium text-white flex items-center gap-1 md:gap-2 whitespace-nowrap">
                          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-gray-300">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                          </svg>
                          <span>Journal Entry</span>
                        </label>
                      </div>

                      {/* Journal Entry */}
                      <div className="space-y-3">
                        <div className="relative">
                          <textarea
                            ref={textareaRef}
                            id="journalText"
                            value={journalText}
                            onChange={(e) => {
                              setJournalText(e.target.value);
                              // Hide the AI question when user starts typing
                              if (showQuestionOverlay && e.target.value.length > journalText.length) {
                                setShowQuestionOverlay(false);
                                setDisplayedQuestion("");
                                setIsQuestionTyping(false);
                              }
                            }}
                            disabled={isQuestionTyping}
                            placeholder="Write your journal entry here..."
                            className="w-full rounded-lg border border-white/30 shadow-sm focus:border-white focus:ring-2 focus:ring-white/30 px-3 py-3 h-[280px] transition-all duration-200 resize-none overflow-y-auto bg-black/40 text-white"
                            style={{ fontSize: '18px' }}
                            required
                          />
                        </div>

                        {/* AI Button and Question Box - Unified Container */}
                        <div className="w-full mt-4">
                          <div className="flex items-center w-full bg-black/40 backdrop-blur-sm rounded-lg border border-white/20 overflow-hidden shadow-lg transition-all duration-300">
                            <button
                              type="button"
                              onClick={async () => {
                                  const wordCount = journalText.trim().split(/\s+/).filter(word => word.length > 0).length;

                                  setIsGeneratingInspiration(true);
                                  setIsQuestionTyping(true);

                                  try {
                                    let question = "";

                                    // If journal is empty, use critical thinking starter questions
                                    if (wordCount === 0) {
                                      const starterQuestions = [
                                        "What's one thing that surprised you today?",
                                        "If you could relive one moment from today, which would it be and why?",
                                        "What's something you've been avoiding thinking about?",
                                        "What would you do differently if you could start this day over?",
                                        "What's the most honest thing you can say about how you're feeling right now?",
                                        "What's something you learned about yourself recently?",
                                        "If you had to describe today in one word, what would it be and why?",
                                        "What's a question you've been asking yourself lately?",
                                        "What's one thing you're grateful for that you haven't acknowledged yet?",
                                        "What would your future self want to remember about this moment?",
                                        "What's something you did today that made you proud, even if it was small?",
                                        "What's been taking up the most mental space in your mind?",
                                        "If you could have a conversation with anyone right now, who would it be and what would you say?",
                                        "What's a belief you held strongly that's starting to change?",
                                        "What's something you wish someone would ask you about?"
                                      ];
                                      question = starterQuestions[Math.floor(Math.random() * starterQuestions.length)];
                                    } else if (wordCount < 10) {
                                      // Less than 10 words, give encouraging prompt
                                      const encouragementQuestions = [
                                        "Tell me more about that...",
                                        "What else is on your mind?",
                                        "Keep going... what happened next?",
                                        "Interesting... can you expand on that?",
                                        "What made you think of that?"
                                      ];
                                      question = encouragementQuestions[Math.floor(Math.random() * encouragementQuestions.length)];
                                    } else {
                                      // 10+ words, generate AI-based question
                                      const questions = await generateJournalPrompts(journalText, location);
                                      question = questions[0] || "What's really going on here?";
                                    }

                                    // Show overlay and type question character by character
                                    setShowQuestionOverlay(true);
                                    setDisplayedQuestion("");

                                    let currentIndex = 0;
                                    const typeInterval = setInterval(() => {
                                      if (currentIndex < question.length) {
                                        setDisplayedQuestion(question.substring(0, currentIndex + 1));
                                        currentIndex++;
                                      } else {
                                        clearInterval(typeInterval);
                                        // Keep disabled for 1 second after typing finishes
                                        setTimeout(() => {
                                          setIsQuestionTyping(false);
                                        }, 1000);
                                      }
                                    }, 30);

                                  } catch (error) {
                                    console.error('Error generating AI question:', error);
                                    const fallbackQuestions = [
                                      "What's really going on here?",
                                      "What's the real story?",
                                      "What happened?",
                                      "What's bothering you?",
                                      "What's on your mind?"
                                    ];
                                    const fallbackQuestion = fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];

                                    // Show overlay and type fallback question
                                    setShowQuestionOverlay(true);
                                    setDisplayedQuestion("");

                                    let currentIndex = 0;
                                    const typeInterval = setInterval(() => {
                                      if (currentIndex < fallbackQuestion.length) {
                                        setDisplayedQuestion(fallbackQuestion.substring(0, currentIndex + 1));
                                        currentIndex++;
                                      } else {
                                        clearInterval(typeInterval);
                                        // Keep disabled for 1 second after typing finishes
                                        setTimeout(() => {
                                          setIsQuestionTyping(false);
                                        }, 1000);
                                      }
                                    }, 30);
                                  } finally {
                                    setIsGeneratingInspiration(false);
                                  }
                                }}
                                disabled={isGeneratingInspiration || isQuestionTyping}
                                className={`flex items-center justify-center gap-2 px-4 py-3 transition-all duration-300 ease-in-out font-semibold flex-shrink-0 text-white ${
                                  isGeneratingInspiration || isQuestionTyping
                                    ? 'cursor-not-allowed opacity-60'
                                    : ''
                                }`}
                                style={{
                                  backgroundColor: isGeneratingInspiration || isQuestionTyping ? `${textColors.locationColor}60` : `${textColors.locationColor}90`,
                                  borderRight: showQuestionOverlay ? `1px solid ${textColors.locationColor}30` : 'none'
                                }}
                                onMouseEnter={(e) => {
                                  if (!isGeneratingInspiration && !isQuestionTyping) {
                                    e.currentTarget.style.backgroundColor = textColors.locationColor;
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isGeneratingInspiration && !isQuestionTyping) {
                                    e.currentTarget.style.backgroundColor = `${textColors.locationColor}90`;
                                  }
                                }}
                                title="Get AI-powered journal prompts"
                              >
                              {isGeneratingInspiration ? (
                                <div
                                  className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent border-white"
                                ></div>
                              ) : (
                                <span className="text-base">AI+</span>
                              )}
                              </button>

                            {/* AI Question - Slides in from left */}
                            <AnimatePresence>
                              {showQuestionOverlay && (
                                <motion.div
                                  initial={{ opacity: 0, x: -20, width: 0 }}
                                  animate={{ opacity: 1, x: 0, width: '100%' }}
                                  exit={{ opacity: 0, x: -20, width: 0 }}
                                  transition={{
                                    type: "spring",
                                    stiffness: 300,
                                    damping: 30,
                                    duration: 0.4
                                  }}
                                  className="flex items-center px-4 py-3 overflow-hidden"
                                  style={{ backgroundColor: `${textColors.locationColor}05` }}
                                >
                                  <p
                                    className="text-lg leading-relaxed flex-1 whitespace-normal"
                                    style={{
                                      color: textColors.locationColor,
                                      fontWeight: 500,
                                      fontSize: '18px'
                                    }}
                                  >
                                    {displayedQuestion}
                                    {isQuestionTyping && (
                                      <motion.span
                                        animate={{ opacity: [1, 0] }}
                                        transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
                                        className="ml-0.5"
                                      >
                                        |
                                      </motion.span>
                                    )}
                                  </p>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Mobile Single Page Layout */}
            <div className="md:hidden w-full flex justify-center px-4 -ml-2.5">
              <div className="w-full max-w-sm space-y-4">
              {/* Journal Preview at Top */}
              <div className="bg-black rounded-2xl shadow-2xl border border-white/20 overflow-hidden w-full max-w-sm mx-auto">
                <div className="p-4 border-b border-white/10">
                  <h3 className="text-lg font-medium text-white flex items-center gap-2">
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-gray-300">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <span>Journal Preview</span>
                  </h3>
                </div>
                <div className="p-4">
                  <div className="relative bg-gradient-to-br from-[#1a1a1a]/70 to-[#2a2a2a]/70 rounded-xl overflow-hidden shadow-lg border border-white/10 min-h-[400px]" id="journal-container" data-journal-content>
                    {/* Mobile canvas debug temporarily disabled */}
                    {/* TEMPORARILY DISABLED TO FIX GLITCHING ISSUE */}
                    {/* <JournalCanvas
                      key="mobile-journal-canvas"
                      ref={mobileCanvasRef}
                      date={date}
                      location={location}
                      textSections={journalText.split('\n\n').filter(section => section.trim().length > 0)}
                      images={images}
                      onNewEntry={handleReset}
                      templateUrl={templateUrl}
                      textColors={textColors}
                      layoutMode={layoutMode}
                      editMode={true}
                      onTextClick={handleTextClick}
                      onImageDrag={handleImageDrag}
                      onImageResize={handleImageResize}
                      onImageClick={handleCanvasImageClick}
                      onImageDelete={handleImageDelete}
                      needInspiration={needInspiration}
                      inspirationQuestion={inspirationQuestion}
                      savedImagePositions={imagePositions}
                    /> */}
                    <div className="flex items-center justify-center h-64 text-white/50">
                      <p>Mobile preview temporarily disabled to fix glitching</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Journal Editing Form */}
              <div className="bg-black rounded-2xl shadow-2xl border border-white/20 overflow-hidden w-full max-w-sm mx-auto">
                <div className="p-4 border-b border-white/10">
                  <h3 className="text-lg font-medium text-white flex items-center gap-2">
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-gray-300">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                    <span>Journal Editing</span>
                  </h3>
                </div>
                <div className="p-4">
                  <div className="space-y-4">
                    {/* Location and Date */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <label htmlFor="location" className="block text-sm md:text-lg font-medium text-white flex items-center gap-1 md:gap-2">
                          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-gray-300">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                          </svg>
                          <span>Location</span>
                        </label>
                                                   <input
                             type="text"
                             id="location"
                             value={location}
                             onChange={(e) => setLocation(e.target.value)}
                             placeholder="e.g., MANIA, LA JOLLA, CA"
                             className="w-full h-10 rounded-lg border border-white/30 shadow-sm focus:border-white focus:ring-2 focus:ring-white/30 px-2 py-2 md:px-3 md:py-2 text-gray-400 transition-all duration-200 bg-black/40 backdrop-blur-sm text-sm md:text-base placeholder-gray-400"
                             required
                           />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm md:text-lg font-medium text-white flex items-center gap-1 md:gap-2">
                          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-gray-300">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                          </svg>
                          <span>Date</span>
                        </label>
                        <DatePicker
                          selected={date}
                          onChange={(selectedDate: Date | null) => {
                            if (selectedDate) {
                              const year = selectedDate.getFullYear();
                              const month = selectedDate.getMonth();
                              const day = selectedDate.getDate();
                              const adjustedDate = new Date(year, month, day, 12, 0, 0);
                              setDate(adjustedDate);
                            }
                          }}
                          className="w-full h-10 rounded-lg border border-white/30 shadow-sm focus:border-white focus:ring-2 focus:ring-white/30 px-2 py-2 md:px-3 md:py-2 text-gray-400 transition-all duration-200 bg-black/40 backdrop-blur-sm text-sm md:text-base"
                          dateFormat="MMM dd, yyyy"
                          popperPlacement="bottom-end"
                          required
                          wrapperClassName="text-gray-400"
                        />
                      </div>
                    </div>

                    {/* Images */}
                    <div className="space-y-3">
                      <label className="block text-sm md:text-lg font-medium text-white flex items-center gap-1 md:gap-2">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-gray-300">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                        <span>Images ({images.length})</span>
                      </label>
                      
                      <div 
                        className="border-2 border-dashed rounded-xl p-4 md:p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 relative group border-white/30 bg-black/30 backdrop-blur-sm hover:border-white/50 hover:bg-black/40"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {isLoadingImage && (
                          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center z-10 gap-2">
                            <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent"></div>
                            <p className="text-white text-sm">Processing {loadingImageCount} image{loadingImageCount > 1 ? 's' : ''}...</p>
                          </div>
                        )}
                        <svg className="w-6 h-6 mb-2 transition-colors text-gray-300 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                        </svg>
                        <p className="text-sm text-center transition-colors text-gray-300 group-hover:text-white">
                          Upload Images
                        </p>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleImageUpload}
                          accept="image/*"
                          multiple
                          style={{ display: 'none' }}
                        />
                      </div>
                    </div>

                    {/* Colors - Mobile Horizontal Scroll */}
                    <div className="space-y-3">
                      <label className="block text-sm md:text-lg font-medium text-white flex items-center gap-1 md:gap-2">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-gray-300">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"></path>
                        </svg>
                        <span>Colors</span>
                      </label>
                      <div className="overflow-x-auto pb-2 scrollbar-hide" style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}>
                        <div className="flex gap-3 min-w-max px-1" style={{ paddingRight: '20px' }}>
                          {[
                            '#FF6B6B', '#FF8E53', '#FFD93D', '#6BCF7F', 
                            '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
                            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE',
                            '#85C1E9', '#F8C471', '#F1948A', '#A9DFBF'
                          ].map((color, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                const newColors = {
                                  ...textColors,
                                  locationColor: color,
                                  locationShadowColor: getComplementaryColor(color, 30)
                                };
                                handleColorChange(newColors);
                              }}
                              className={`w-12 h-12 rounded-full border-2 transition-all duration-200 hover:scale-110 ${
                                textColors.locationColor === color 
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

                    {/* Journal Entry */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center relative">
                        <label htmlFor="journalText" className="block text-sm md:text-lg font-medium text-white flex items-center gap-1 md:gap-2 whitespace-nowrap">
                          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-gray-300">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                          </svg>
                          <span>Journal Entry</span>
                        </label>
                      </div>
                      <div className="relative">
                        <textarea
                          id="journalText"
                          value={journalText}
                          onChange={(e) => {
                            setJournalText(e.target.value);
                            // Don't fade away question when user types in main journal
                          }}
                          disabled={isQuestionTyping}
                          placeholder="Write your journal entry here..."
                          className="w-full rounded-lg border border-white/30 shadow-sm focus:border-white focus:ring-2 focus:ring-white/30 px-3 py-3 h-[280px] transition-all duration-200 resize-none overflow-y-auto bg-black/40 text-white"
                          style={{ fontSize: '18px', minHeight: '100px' }}
                          required
                        />
                      </div>

                      {/* AI Button Below Journal Box */}
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={async () => {
                            const wordCount = journalText.trim().split(/\s+/).filter(word => word.length > 0).length;

                            setIsGeneratingInspiration(true);
                            setIsQuestionTyping(true);

                              try {
                                let question = "";

                                // If journal is empty, use critical thinking starter questions
                                if (wordCount === 0) {
                                  const starterQuestions = [
                                    "What's one thing that surprised you today?",
                                    "If you could relive one moment from today, which would it be and why?",
                                    "What's something you've been avoiding thinking about?",
                                    "What would you do differently if you could start this day over?",
                                    "What's the most honest thing you can say about how you're feeling right now?",
                                    "What's something you learned about yourself recently?",
                                    "If you had to describe today in one word, what would it be and why?",
                                    "What's a question you've been asking yourself lately?",
                                    "What's one thing you're grateful for that you haven't acknowledged yet?",
                                    "What would your future self want to remember about this moment?",
                                    "What's something you did today that made you proud, even if it was small?",
                                    "What's been taking up the most mental space in your mind?",
                                    "If you could have a conversation with anyone right now, who would it be and what would you say?",
                                    "What's a belief you held strongly that's starting to change?",
                                    "What's something you wish someone would ask you about?"
                                  ];
                                  question = starterQuestions[Math.floor(Math.random() * starterQuestions.length)];
                                } else if (wordCount < 10) {
                                  // Less than 10 words, give encouraging prompt
                                  const encouragementQuestions = [
                                    "Tell me more about that...",
                                    "What else is on your mind?",
                                    "Keep going... what happened next?",
                                    "Interesting... can you expand on that?",
                                    "What made you think of that?"
                                  ];
                                  question = encouragementQuestions[Math.floor(Math.random() * encouragementQuestions.length)];
                                } else {
                                  // 10+ words, generate AI-based question
                                  const questions = await generateJournalPrompts(journalText, location);
                                  question = questions[0] || "What's really going on here?";
                                }

                                // Show overlay and type question character by character
                                setShowQuestionOverlay(true);
                                setDisplayedQuestion("");

                                let currentIndex = 0;
                                const typeInterval = setInterval(() => {
                                  if (currentIndex < question.length) {
                                    setDisplayedQuestion(question.substring(0, currentIndex + 1));
                                    currentIndex++;
                                  } else {
                                    clearInterval(typeInterval);
                                    // Keep disabled for 1 second after typing finishes
                                    setTimeout(() => {
                                      setIsQuestionTyping(false);
                                    }, 1000);
                                  }
                                }, 30);

                              } catch (error) {
                                console.error('Error generating AI question:', error);
                                const fallbackQuestions = [
                                  "What's really going on here?",
                                  "What's the real story?",
                                  "What happened?",
                                  "What's bothering you?",
                                  "What's on your mind?"
                                ];
                                const fallbackQuestion = fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];

                                // Show overlay and type fallback question
                                setShowQuestionOverlay(true);
                                setDisplayedQuestion("");

                                let currentIndex = 0;
                                const typeInterval = setInterval(() => {
                                  if (currentIndex < fallbackQuestion.length) {
                                    setDisplayedQuestion(fallbackQuestion.substring(0, currentIndex + 1));
                                    currentIndex++;
                                  } else {
                                    clearInterval(typeInterval);
                                    // Keep disabled for 1 second after typing finishes
                                    setTimeout(() => {
                                      setIsQuestionTyping(false);
                                    }, 1000);
                                  }
                                }, 30);
                              } finally {
                                setIsGeneratingInspiration(false);
                              }
                            }}
                            disabled={isGeneratingInspiration || isQuestionTyping}
                            className={`flex items-center gap-2 px-4 py-2 transition-all duration-300 ease-in-out text-sm font-medium rounded-lg ${
                              isGeneratingInspiration || isQuestionTyping
                                ? 'cursor-not-allowed opacity-50'
                                : 'hover:opacity-80 hover:scale-105'
                            }`}
                            style={{
                              color: textColors.locationColor,
                              backgroundColor: `${textColors.locationColor}20`
                            }}
                            title="Get AI-powered journal prompts"
                          >
                          {isGeneratingInspiration ? (
                            <div
                              className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent"
                              style={{ borderColor: textColors.locationColor }}
                            ></div>
                          ) : (
                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                            </svg>
                          )}
                            <span className="text-sm">
                              AI Question
                            </span>
                          </button>
                        </div>

                      {/* AI Question Text Box Below */}
                      <AnimatePresence>
                        {showQuestionOverlay && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -20 }}
                            transition={{
                              type: "spring",
                              stiffness: 300,
                              damping: 25,
                              duration: 0.5
                            }}
                            className="relative"
                          >
                            <textarea
                              value={displayedQuestion}
                              readOnly
                              className="w-full rounded-lg border shadow-lg focus:border-white focus:ring-2 focus:ring-white/30 px-3 py-3 h-[120px] transition-all duration-200 resize-none overflow-y-auto backdrop-blur-sm"
                              style={{
                                fontSize: '18px',
                                color: textColors.locationColor,
                                backgroundColor: `${textColors.locationColor}10`,
                                borderColor: textColors.locationColor
                              }}
                            />
                            {isQuestionTyping && (
                              <motion.div
                                className="absolute bottom-3 right-3"
                                animate={{ opacity: [1, 0] }}
                                transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
                              >
                                <span style={{ color: textColors.locationColor, fontSize: '18px' }}>|</span>
                              </motion.div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JournalForm; 