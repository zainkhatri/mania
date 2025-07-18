import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import JournalCanvas, { ClickableTextArea, JournalCanvasHandle } from './JournalCanvas';
import SimpleColorPicker, { TextColors } from './TempColorPicker';
import LayoutToggle from './LayoutToggle';
// @ts-ignore
import html2canvas from 'html2canvas';
// Import html2pdf properly
import html2pdf from 'html2pdf.js';
// Add module imports at the top
import * as htmlToImage from 'html-to-image';
// Import jsPDF for direct PDF generation
// @ts-ignore
import { jsPDF } from 'jspdf';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
// Import from local copy of the library
// @ts-ignore
import imageCompression from '../lib/browser-image-compression';
import { clearJournalCache } from '../utils/storageUtils';
import { saveJournal, journalExistsForDate } from '../services/journalService';
import { format } from 'date-fns';
import JournalEnhancer from './JournalEnhancer';
import ColorPicker from './ColorPicker';
// Import DatePicker
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

// Apply custom styles to the DatePicker
const datePickerStyles = `
  .react-datepicker {
    font-family: 'ZainCustomFont', -apple-system, BlinkMacSystemFont, sans-serif !important;
    background-color: #121212 !important;
    color: white !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    border-radius: 0.5rem !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5) !important;
  }
  
  .react-datepicker__header {
    background-color: #1a1a1a !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
  }
  
  .react-datepicker__current-month, 
  .react-datepicker__day-name, 
  .react-datepicker__day, 
  .react-datepicker__time-name {
    color: white !important;
  }
  
  .react-datepicker__day:hover, 
  .react-datepicker__month-text:hover, 
  .react-datepicker__quarter-text:hover, 
  .react-datepicker__year-text:hover {
    background-color: rgba(255, 255, 255, 0.1) !important;
  }
  
  .react-datepicker__day--selected, 
  .react-datepicker__day--keyboard-selected {
    background-color: #3182ce !important;
    color: white !important;
  }
  
  .react-datepicker__navigation {
    color: white !important;
  }
  
  .react-datepicker__triangle {
    border-bottom-color: #1a1a1a !important;
  }
  
  .react-datepicker__navigation-icon::before,
  .react-datepicker__year-read-view--down-arrow,
  .react-datepicker__month-read-view--down-arrow {
    border-color: white !important;
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
  isAuthenticated?: boolean;
  saveButtonText?: string;
}

const JournalForm: React.FC<JournalFormProps> = ({ 
  templateUrl = '/templates/cream-black-template.jpg',
  isAuthenticated = false,
  saveButtonText = 'Create Journal'
}) => {
  const navigate = useNavigate();
  const [location, setLocation] = useState('');
  const [journalText, setJournalText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  
  // Initialize date with noon time to avoid timezone issues
  const initialDate = new Date();
  initialDate.setHours(12, 0, 0, 0);
  const [date, setDate] = useState(initialDate);
  
  const [layoutMode, setLayoutMode] = useState<'standard' | 'mirrored'>('standard');
  const [submitted, setSubmitted] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(false);

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
    layoutMode: 'standard' | 'mirrored';
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
    layoutMode: 'standard'
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
    if (!isAuthenticated) {
      toast.error("Please sign in to save your journal");
      navigate("/login");
      return;
    }

    // Show a loading toast
    const toastId = toast.loading("Saving your journal...");
    
    // Set a timeout for the saving process
    const saveTimeout = setTimeout(() => {
      toast.update(toastId, {
        render: "Still working... Processing images takes time. Please wait.",
        type: "info",
        isLoading: true
      });
    }, 5000);

    try {
      // Validate content before saving
      if (!location.trim()) {
        clearTimeout(saveTimeout);
        toast.update(toastId, { 
          render: "Location is required", 
          type: "error", 
          isLoading: false,
          autoClose: 3000
        });
        return;
      }

      // Break the journal text into paragraphs
      const textSections = journalText.split('\n\n').filter(section => section.trim().length > 0);
      
      if (textSections.length === 0) {
        clearTimeout(saveTimeout);
        toast.update(toastId, { 
          render: "Journal content is required", 
          type: "error", 
          isLoading: false,
          autoClose: 3000
        });
        return;
      }
      
      // Check if a journal with the same date already exists
      const dateStr = date.toISOString().split('T')[0]; // Get YYYY-MM-DD format
      const dateExists = await journalExistsForDate(date.toISOString());
      
      if (dateExists) {
        clearTimeout(saveTimeout);
        toast.update(toastId, { 
          render: "A journal entry for this date already exists in your gallery", 
          type: "error", 
          isLoading: false,
          autoClose: 3000
        });
        return;
      }
      
      // Update the toast to indicate we're processing images
      toast.update(toastId, { render: "Processing images..." });
      
      // Compress the images to reduce size
      const compressedImages = await compressJournalImages(images);
      
      // Update the toast to indicate we're generating the preview
      toast.update(toastId, { render: "Generating journal preview..." });
      
      // Generate a preview of the journal as a data URL for thumbnails
      const preview = await generateJournalPreview();
      
      if (!preview) {
        clearTimeout(saveTimeout);
        toast.update(toastId, { 
          render: "Failed to generate journal preview, please try again", 
          type: "error", 
          isLoading: false,
          autoClose: 3000
        });
        return;
      }
      
      // Update toast to indicate we're saving to Firestore
      toast.update(toastId, { render: "Saving to your account..." });
      
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
      
      // Update toast to success
      toast.update(toastId, { 
        render: `Journal saved successfully to your account!`, 
        type: "success", 
        isLoading: false,
        autoClose: 3000
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
      toast.update(toastId, { 
        render: `Failed to save journal: ${error instanceof Error ? error.message : "Please try again"}`, 
        type: "error", 
        isLoading: false,
        autoClose: 4000
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
        toast.error('Could not generate journal preview. Please try again.');
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
      toast.error('Could not generate journal preview. Please try again.');
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
        }
        console.log('Restored submitted journal from localStorage');
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
        }
        console.log('Restored draft journal from localStorage');
      } catch (error) {
        console.error('Error restoring draft journal:', error);
        clearLocalStorageItem('webjournal_draft');
      }
    }
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

  // Focus the appropriate input when editing starts
  useEffect(() => {
    if (activeEditField === 'location' && locationInputRef.current) {
      locationInputRef.current.focus();
    } else if (activeTextSection >= 0 && textSectionRefs.current[activeTextSection]) {
      textSectionRefs.current[activeTextSection]?.focus();
    }
  }, [activeEditField, activeTextSection]);

  // Auto-resize textarea on initial load and when content changes
  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = Math.max(80, textarea.scrollHeight) + 'px';
    }
  }, [journalText]);

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
      
      // Define compression options with more conservative settings for mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const options = {
        maxSizeMB: isMobile ? 0.8 : 1,              // Smaller size on mobile
        maxWidthOrHeight: isMobile ? 1000 : 1200,   // Smaller dimensions on mobile
        useWebWorker: false,                        // Disable web workers to avoid issues on mobile
        initialQuality: isMobile ? 0.7 : 0.8,       // Lower quality on mobile
        maxIteration: 2                            // Limit compression iterations
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
  
  // Update handleImageUpload to optimize images and show loading indicator
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    // Limit number of files to prevent overloading memory
    const maxFiles = 3 - images.length;
    if (maxFiles <= 0) {
      toast.error('Maximum of 3 images allowed');
      return;
    }
    
    // Process all selected files instead of just the first one
    let files = Array.from(e.target.files);
    
    // Limit to maximum allowed
    if (files.length > maxFiles) {
      files = files.slice(0, maxFiles);
      toast.info(`Only using ${maxFiles} image${maxFiles > 1 ? 's' : ''} (maximum 3 total)`);
    }
    
    // Show loading indicator 
    setIsLoadingImage(true);
    
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
          toast.error(error instanceof Error ? error.message : 'Failed to process image');
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
          
          // Update state with original images (we'll use enhanced ones for AI features)
          const newImages = [...images, ...originalImages];
          setImages(newImages);
          
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
                  // Force canvas redraw with memory cleanup
                  window.CURRENT_COLORS = newColors;
                  if (window.forceCanvasRedraw) {
                    // Request animation frame to ensure browser is ready
                    requestAnimationFrame(() => {
                      // Check again in case it was undefined between frames
                      if (typeof window.forceCanvasRedraw === 'function') {
                        window.forceCanvasRedraw();
                      }
                    });
                  }
                  
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
        } catch (error) {
          console.error('Error processing images:', error);
          toast.error('Could not process images. Please try again.');
        }
      })
      .catch(error => {
        console.error('Error processing images:', error);
        toast.error('There was an error processing one or more images. Please try a different image.');
      })
      .finally(() => {
        setIsLoadingImage(false);
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
    setImages(prev => prev.filter((_, i) => i !== index));
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
    
    // Check authentication first
    if (!isAuthenticated) {
      toast.error("Please sign in to create a journal");
      navigate("/login");
      return;
    }
    
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
    
    // Always save to backend if user is authenticated
    if (isAuthenticated) {
      saveJournalToBackend();
    }
  };
  
  const handleReset = () => {
    setLocation('');
    setJournalText('');
    setImages([]);
    
    // Create a new date with noon time to avoid timezone issues
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    setDate(today);
    
    setLayoutMode('standard');
    setSubmitted(false);
    setActiveEditField(null);
    setActiveTextSection(-1);
    
    // Clear all stored data when resetting
    clearLocalStorageItem('webjournal_submitted');
    clearLocalStorageItem('webjournal_draft');
  };
  
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
    
    // Try to force canvas redraw using the exposed method
    if (window.forceCanvasRedraw) {
      setTimeout(() => {
        // @ts-ignore
        window.forceCanvasRedraw();
      }, 50);
    }
    
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
    const updatedData = {
      ...submittedData,
      text: [...submittedData.text, '']
    };
    
    setSubmittedData(updatedData);
    setActiveTextSection(submittedData.text.length);
    
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
  

  
    // PDF export function
  const handleShare = async () => {
    // Check authentication first
    if (!isAuthenticated) {
      toast.error("Please sign in to download your journal");
      navigate("/login");
      return;
    }
    
    // Create a loading toast
    const toastId = toast.loading("Creating high-quality PDF...", {
      position: "bottom-center",
      autoClose: false,
      closeButton: false,
      style: { maxWidth: '320px', width: '100%' }
    });
    
    try {
      // Step 1: Find the journal element - try multiple strategies
      toast.update(toastId, {
        render: "Finding journal content...",
        isLoading: true
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
      toast.update(toastId, {
        render: "Capturing journal content...",
        isLoading: true
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
      toast.update(toastId, {
        render: "Generating PDF document...",
        isLoading: true
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
      toast.update(toastId, {
        render: "Downloading PDF...",
        isLoading: true
      });
      
      const filename = `journal-${format(date, 'yyyy-MM-dd')}.pdf`;
      
      // Save the PDF
      pdf.save(filename);
      
      // Success message
      toast.update(toastId, {
        render: "✅ High-quality PDF downloaded successfully!",
        type: "success",
        isLoading: false,
        autoClose: 3000,
        closeButton: true
      });
      
    } catch (error) {
      console.error("Error creating PDF:", error);
      toast.update(toastId, {
        render: `❌ Failed to create PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: "error",
        isLoading: false,
        autoClose: 8000,
        closeButton: true
      });
    }
  };
  
  // Handle PDF Save function (for dropdown menu)
  const handleSaveAsPDF = async () => {
    // Check authentication before saving as PDF
    if (!isAuthenticated) {
      toast.error("Please sign in to create a PDF");
      navigate("/login");
      return;
    }
    
    // Reuse the share functionality which now focuses on PDF export
    handleShare();
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
      layoutMode
    };
    
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
        layoutMode
      };
      
      saveToLocalStorage('webjournal_draft', dataToSave);
    }, 2000); // 2 second debounce
    
    return () => clearTimeout(autoSaveTimeout);
  }, [location, journalText, images, textColors, layoutMode, date]);

  // Format date for the input element without timezone issues
  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // months are 0-indexed
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
  
  // Detect if on mobile
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

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
    
    if (canvasRef.current) {
      try {
        // Pass all files to canvas component
        console.log("Canvas ref exists, adding stickers...");
        canvasRef.current.addMultipleStickers(fileArray);
      } catch (error) {
        console.error("Error adding stickers:", error);
        // Try accessing method differently as fallback
        // @ts-ignore - Force call for debugging
        if (typeof canvasRef.current.addMultipleStickers === 'function') {
          console.log("Method exists but failed, trying direct call");
          canvasRef.current.addMultipleStickers(fileArray);
        } else {
          console.error("Method doesn't exist on ref:", canvasRef.current);
        }
      }
    } else {
      console.error("Canvas ref is null - can't add stickers");
    }
    
    // Reset the input value so the same file can be selected again
    e.target.value = '';
  };

  return (
    <div className="bg-black min-h-screen w-full">
      <div className="relative journal-form-container">
        {/* Black background instead of video */}
        <div className="absolute w-full h-full bg-black z-0"></div>
        {/* Main content */}
        <div className="relative z-10">
          {/* Journal editor content - Now fully scrollable */}
          <div className="p-2 sm:p-4 lg:p-6 max-w-7xl mx-auto min-h-screen">
            {/* Side by side layout on desktop, stacked on mobile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-8 max-w-[1600px] mx-auto">
              
              {/* Journal Preview - Collapsible on mobile, top on mobile, right on desktop */}
              <div className="bg-black/90 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 overflow-hidden order-1 md:order-2 md:sticky md:top-8 md:h-fit">
                <div className="p-2 md:p-3 lg:p-6 border-b border-white/10 flex justify-between items-center">
                  <h3 className="text-base md:text-lg lg:text-2xl font-semibold text-white">
                    Journal Preview
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="text-xs md:text-sm text-gray-400 hidden md:block">
                      Updates as you type
            </div>
                                    {/* Collapse/Expand button - mobile only */}
                <button 
                  onClick={() => setIsJournalCollapsed(!isJournalCollapsed)}
                  className="md:hidden p-1 rounded-lg hover:bg-white/10 transition-colors duration-200"
                >
                  <svg 
                    width="16" 
                    height="16" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24" 
                    className={`text-white transition-transform duration-500 ease-in-out ${isJournalCollapsed ? 'rotate-180' : ''}`}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>
                  </div>
                </div>
                
                {/* Collapsible journal content */}
                <div className={`transition-all duration-700 ease-in-out overflow-hidden ${isJournalCollapsed ? 'max-h-0 opacity-0 md:max-h-none md:opacity-100' : 'max-h-[60vh] opacity-100 md:max-h-none'}`}>
                  <div className={`transition-all duration-700 ease-in-out ${isJournalCollapsed ? 'p-0 md:p-2 md:p-3 lg:p-6 scale-95 md:scale-100' : 'p-2 md:p-3 lg:p-6 scale-100'}`}>
                    <div className="relative bg-gradient-to-br from-[#1a1a1a]/70 to-[#2a2a2a]/70 rounded-xl overflow-hidden shadow-lg border border-white/10 min-h-[300px]" ref={journalRef} id="journal-container" data-journal-content>
                      <JournalCanvas
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
                        onImageDrag={(index, x, y) => {
                          console.log(`Image ${index} dragged to ${x},${y}`);
                        }}
                        onImageClick={handleCanvasImageClick}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Input Form - Left Side on desktop, bottom on mobile */}
              <div className="bg-black/90 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 overflow-hidden order-2 md:order-1">
                <div className="p-2 md:p-4 lg:p-6 border-b border-white/10">
                  <h2 className="text-lg md:text-xl lg:text-2xl font-semibold text-white text-center">Create Your Entry</h2>
                </div>
                <div className="p-2 md:p-3 lg:p-6">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                  >
                    {/* Compact mobile layout */}
                    <div className="space-y-1 md:space-y-3 lg:space-y-6">
                                              {/* Date and Location Row - Always side by side for compact layout */}
                        <div className="grid grid-cols-2 gap-2 md:gap-6">
                        {/* Date Picker */}
                          <div className="space-y-1">
                            <label htmlFor="date" className="block text-sm md:text-lg font-medium text-white flex items-center gap-1 md:gap-2">
                              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-gray-300">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                            <span>Date</span>
                          </label>
                          <DatePicker
                            selected={date}
                            onChange={(selectedDate: Date | null) => {
                              if (selectedDate) {
                                // Set time to noon to avoid timezone issues
                                const adjustedDate = new Date(selectedDate);
                                adjustedDate.setHours(12, 0, 0, 0);
                                setDate(adjustedDate);
                              }
                            }}
                              className="w-full rounded-lg border border-white/30 shadow-sm focus:border-white focus:ring-2 focus:ring-white/30 px-2 py-2 md:px-3 md:py-2 text-white transition-all duration-200 bg-black/40 backdrop-blur-sm text-sm md:text-base"
                            calendarClassName="black-theme-calendar"
                            dateFormat="yyyy-MM-dd"
                            popperClassName="black-theme-popper"
                            popperPlacement="bottom-start"
                            required
                          />
                        </div>
                        
                        {/* Location */}
                          <div className="space-y-1">
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
                              className="w-full rounded-lg border border-white/30 shadow-sm focus:border-white focus:ring-2 focus:ring-white/30 px-2 py-2 md:px-3 md:py-2 text-white transition-all duration-200 bg-black/40 backdrop-blur-sm text-sm md:text-base"
                            required
                          />
                        </div>
                      </div>

                                                                    {/* Images Section */}
                        <div className="space-y-1">
                          <label className="block text-sm md:text-lg font-medium text-white flex items-center gap-1 md:gap-2">
                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-gray-300">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                            <span>Images ({images.length}/3)</span>
                          </label>
                          
                          {/* Add Sticker button */}
                          {images.length > 0 && (
                            <div className="flex items-center mb-1">
                              <label className="bg-blue-600/80 hover:bg-blue-600 text-white py-1 px-2 md:py-1 md:px-3 lg:py-1 lg:px-3 rounded-lg cursor-pointer transition-all duration-200 backdrop-blur-sm border border-blue-500/30 text-xs md:text-sm lg:text-sm">
                                Add Stickers
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleStickerUpload}
                                  className="hidden"
                                  multiple
                                />
                              </label>
                            </div>
                          )}
                          
                          {/* Image upload area - only show when we have fewer than 3 images */}
                          {images.length < 3 && (
                            <div 
                              className="border-2 border-dashed border-white/30 rounded-xl p-3 md:p-4 lg:p-4 flex flex-col items-center justify-center cursor-pointer hover:border-white/50 transition-all duration-300 bg-black/30 backdrop-blur-sm hover:bg-black/40 relative group"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              {isLoadingImage && (
                                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
                                  <div className="animate-spin rounded-full h-6 w-6 lg:h-6 lg:w-6 border-4 border-white border-t-transparent"></div>
                                </div>
                              )}
                              <svg className="w-6 h-6 lg:w-6 lg:h-6 text-gray-300 mb-1 lg:mb-1 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                              </svg>
                              <p className="text-xs lg:text-sm text-gray-300 text-center group-hover:text-white transition-colors">Tap to upload</p>
                              <p className="text-xs lg:text-xs text-gray-400">PNG, JPG up to 10MB</p>
                              <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImageUpload}
                                accept="image/*"
                                multiple
                                style={{ display: 'none' }}
                                disabled={images.length >= 3}
                              />
                            </div>
                          )}

                          {images.length > 0 && (
                            <motion.div 
                              className="grid grid-cols-3 gap-1 mt-1"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3 }}
                            >
                              {images.map((image, index) => (
                                <div 
                                  key={index} 
                                  className="relative group overflow-hidden rounded-lg shadow-lg border border-white/20 aspect-square bg-black/20 backdrop-blur-sm"
                                >
                                  <img 
                                    src={image} 
                                    alt={`Upload ${index + 1}`} 
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeImage(index)}
                                    className="absolute top-0.5 right-0.5 bg-black/80 backdrop-blur-sm p-1 lg:p-1 rounded-full shadow-lg text-white opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-red-600 hover:scale-110"
                                  >
                                    <svg className="w-3 h-3 lg:w-3 lg:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </motion.div>
                          )}

                          {/* Layout Toggle - Under Images */}
                          <div className="flex justify-center md:justify-start mt-2">
                            <div className="scale-75 md:scale-90 lg:scale-100">
                              <LayoutToggle
                                layoutMode={layoutMode}
                                setLayoutMode={setLayoutMode}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Colors - Compact */}
                        <div className="space-y-1">
                          <label className="block text-sm md:text-sm font-medium text-white flex items-center gap-1 md:gap-2">
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-gray-300">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"></path>
                            </svg>
                            <span>Colors</span>
                          </label>
                          <div className="bg-black/40 backdrop-blur-sm rounded-lg shadow-sm border border-white/20 p-1 md:p-2">
                            <SimpleColorPicker 
                              colors={textColors}
                              onChange={handleColorChange}
                              images={submitted ? submittedData.images : images}
                              compact={true}
                            />
                      </div>
                    </div>

                                                                      {/* Journal Entry - Long and at bottom */}
                        <div className="space-y-1">
                          <label htmlFor="journalText" className="block text-sm md:text-lg font-medium text-white flex items-center gap-1 md:gap-2">
                          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-gray-300">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                        <span>Journal Entry</span>
                      </label>
                      <textarea
                            ref={textareaRef}
                        id="journalText"
                        value={journalText}
                            onChange={(e) => {
                              setJournalText(e.target.value);
                              // Auto-resize textarea
                              const textarea = e.target;
                              textarea.style.height = 'auto';
                              textarea.style.height = Math.max(80, textarea.scrollHeight) + 'px';
                            }}
                        placeholder="Write your journal entry here..."
                            className="w-full rounded-lg border border-white/30 shadow-sm focus:border-white focus:ring-2 focus:ring-white/30 px-2 py-2 md:px-3 md:py-2 lg:px-4 lg:py-3 min-h-[80px] text-white transition-all duration-200 bg-black/40 backdrop-blur-sm text-base md:text-lg resize-none overflow-hidden"
                            style={{ height: 'auto' }}
                        required
                      />
                      {journalText.trim().length > 0 && (
                        <JournalEnhancer
                          journalText={journalText}
                          location={location}
                          minWordCount={10}
                          showInitially={false}
                        />
                      )}
                        <p className="text-xs lg:text-xs text-gray-400 mt-1 lg:mt-1">Use double line breaks to create new paragraphs.</p>
              </div>

                      {/* Action Buttons - Under Journal Entry */}
                      <div className="space-y-2 pb-8">
                        <div className="flex justify-between items-center pt-2 mt-2 border-t border-white/10">
                    <button 
                      type="button"
                      onClick={handleReset} 
                            className="px-3 py-1.5 md:px-4 md:py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg flex items-center gap-1 md:gap-2 transition-all duration-200 backdrop-blur-sm border border-red-500/30 text-sm md:text-base"
                    >
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="md:w-4 md:h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                      Clear
                    </button>
                    <button 
                      type="button"
                      onClick={handleSubmit} 
                            className="px-4 py-1.5 md:px-6 md:py-2 bg-green-600/80 hover:bg-green-600 text-white rounded-lg flex items-center gap-1 md:gap-2 transition-all duration-200 backdrop-blur-sm border border-green-500/30 text-sm md:text-base"
                    >
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="md:w-4 md:h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      Create Journal
                    </button>
                  </div>
                        
                        {/* Download Options - Show when there's content to download */}
                        {(location.trim() || journalText.trim() || images.length > 0) && (
                          <div className="flex justify-center pt-2 border-t border-white/10">
                            <button 
                              type="button"
                              onClick={handleSaveAsPDF} 
                              className="px-4 py-2 md:px-6 md:py-3 bg-purple-600/80 hover:bg-purple-600 text-white rounded-lg flex items-center gap-2 transition-all duration-200 backdrop-blur-sm border border-purple-500/30 text-sm md:text-base font-medium"
                            >
                              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="md:w-5 md:h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                              </svg>
                              Download High-Quality PDF
                            </button>
                </div>
                        )}
              </div>
            </div>
                  </motion.div>
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