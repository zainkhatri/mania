import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import JournalCanvas, { ClickableTextArea } from './JournalCanvas';
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

// Simple function that returns the original image without enhancement
const enhanceImageWithAI = async (imageDataUrl: string): Promise<string> => {
  return imageDataUrl;
};

// Interface for custom Window properties
interface CustomWindow extends Window {
  FORCE_CANVAS_REDRAW: boolean;
  CURRENT_COLORS: TextColors;
  forceCanvasRedraw?: () => void;
}

// Declare global window properties for TypeScript
declare global {
  interface Window {
    FORCE_CANVAS_REDRAW: boolean;
    CURRENT_COLORS: TextColors;
    forceCanvasRedraw?: () => void;
    html2pdf: typeof html2pdf;
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
  const [date, setDate] = useState(new Date());
  const [layoutMode, setLayoutMode] = useState<'standard' | 'mirrored'>('standard');
  const [submitted, setSubmitted] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
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
    date: new Date(),
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
  const [showSaveNotification, setShowSaveNotification] = useState(false);
  const saveNotificationTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Helper function to show save notification
  const showSavedNotification = (color?: string) => {
    setShowSaveNotification(true);
    
    // Update notification UI if a color is picked
    if (color) {
      const notification = document.querySelector('.save-notification') as HTMLElement;
      if (notification) {
        // Add color sample to notification
        const colorSample = document.createElement('div');
        colorSample.className = 'color-sample';
        colorSample.style.cssText = `
          display: inline-block;
          width: 15px;
          height: 15px;
          border-radius: 3px;
          margin-right: 6px;
          vertical-align: middle;
          background-color: ${color};
          border: 1px solid rgba(0,0,0,0.1);
        `;
        notification.querySelector('span')?.prepend(colorSample);
        
        // Update notification text
        const textNode = notification.querySelector('span');
        if (textNode) {
          textNode.textContent = `Color ${color.toUpperCase()} picked`;
        }
        
        // Apply a special animation for color picking
        notification.classList.add('color-picked');
      }
    }
    
    // Clear any existing timer
    if (saveNotificationTimer.current) {
      clearTimeout(saveNotificationTimer.current);
    }
    
    // Hide after 2 seconds
    saveNotificationTimer.current = setTimeout(() => {
      setShowSaveNotification(false);
    }, 2000);
  };
  
  // Function to save journal entry to backend (to be implemented)
  const saveJournalToBackend = async () => {
    if (!isAuthenticated) {
      toast.error("Please sign in to save your journal");
      navigate("/login");
      return;
    }

    try {
      toast.info("Saving your journal...");
      
      // Break the journal text into paragraphs
      const textSections = journalText.split('\n\n').filter(section => section.trim().length > 0);
      
      // Get existing journals or initialize empty array
      const existingJournals = JSON.parse(localStorage.getItem('journals') || '[]');
      
      // Get the journal count to create a sequential number
      let journalCount = parseInt(localStorage.getItem('journal_count') || '0');
      journalCount++; // Increment for the new journal
      
      // Create a unique ID for the journal entry with sequential numbering
      const journalId = `journal_${journalCount}`;
      
      // Check if a journal with the same date already exists
      const dateStr = date.toISOString().split('T')[0]; // Get YYYY-MM-DD format
      const journalWithSameDate = existingJournals.find((journal: { date: string }) => {
        const journalDate = new Date(journal.date).toISOString().split('T')[0];
        return journalDate === dateStr;
      });
      
      if (journalWithSameDate) {
        toast.error("A journal entry for this date already exists in your gallery");
        return;
      }
      
      // Generate a preview of the journal as a data URL for thumbnails
      const preview = await generateJournalPreview();
      
      // For now, save to localStorage
      const journalData = {
        id: journalId,
        number: journalCount, // Store the sequential number
        date: date.toISOString(),
        location: location,
        text: textSections,
        images: images,
        textColors: textColors,
        layoutMode: layoutMode,
        createdAt: new Date().toISOString(),
        preview: preview
      };
      
      // Add new journal
      existingJournals.push(journalData);
      
      // Save back to localStorage
      localStorage.setItem('journals', JSON.stringify(existingJournals));
      // Save the updated journal count
      localStorage.setItem('journal_count', journalCount.toString());
      
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
      
      toast.success(`Journal ${journalCount} saved successfully to your gallery!`);
    } catch (error) {
      console.error("Error saving journal:", error);
      toast.error("Failed to save journal. Please try again.");
    }
  };
  
  // Generate a thumbnail preview of the journal as a data URL
  const generateJournalPreview = async (): Promise<string> => {
    try {
      const journalElement = document.querySelector('.relative.bg-\\[\\#f9f7f1\\]') as HTMLElement;
      if (!journalElement) {
        console.error('Journal element not found for preview generation');
        return '';
      }
      
      // Generate a high-quality preview
      const canvas = await html2canvas(journalElement, {
        scale: 2, // Higher resolution for better quality (was 0.25)
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f9f7f1',
        logging: false,
        imageTimeout: 30000, // Longer timeout for higher quality
        letterRendering: true // Better text rendering
      });
      
      // Get data URL with higher quality
      return canvas.toDataURL('image/jpeg', 0.9); // Increased quality (was 0.5)
    } catch (error) {
      console.error('Failed to generate journal preview:', error);
      return '';
    }
  };
  
  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (saveNotificationTimer.current) {
        clearTimeout(saveNotificationTimer.current);
      }
    };
  }, []);
  
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
        setDate(new Date(savedDraftJournal.date));
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
        showSavedNotification();
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
        showSavedNotification();
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

  // Focus the appropriate input when editing starts
  useEffect(() => {
    if (activeEditField === 'location' && locationInputRef.current) {
      locationInputRef.current.focus();
    } else if (activeTextSection >= 0 && textSectionRefs.current[activeTextSection]) {
      textSectionRefs.current[activeTextSection]?.focus();
    }
  }, [activeEditField, activeTextSection]);

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
            showSavedNotification(hex);
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
    
  }, [clearEyedropper, showSavedNotification]);
  
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
        maxSizeMB: 1,              // Maximum size in MB
        maxWidthOrHeight: 1200,    // Resize to max dimensions
        useWebWorker: true,        // Use web worker for better performance
        initialQuality: 0.8        // Initial quality setting (0-1)
      };
      
      // Compress using browser-image-compression library
      const compressedBlob = await imageCompression(file, options);
      
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
    
    // Process all selected files instead of just the first one
    const files = Array.from(e.target.files);
    
    // Show loading indicator 
    setIsLoadingImage(true);
    
    // Process each file in parallel
    const processImage = async (file: File) => {
      return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
        
        reader.onload = async (event) => {
          if (!event.target || typeof event.target.result !== 'string') {
            reject(new Error('Failed to read file'));
            return;
          }
          
          try {
            // Use the optimized image processing function
            const optimizedImage = await optimizeImageForStorage(event.target.result);
            resolve(optimizedImage);
          } catch (error) {
            reject(error);
        }
      };
        
        reader.onerror = () => {
          reject(new Error('Error reading file'));
        };
        
      reader.readAsDataURL(file);
    });
    };
    
    // Process all images and add them to the state
    Promise.all(files.map(processImage))
      .then(optimizedImages => {
        setImages(prevImages => [...prevImages, ...optimizedImages]);
        
        // Save to local storage
        saveJournalData();
      })
      .catch(error => {
        console.error('Error processing images:', error);
        alert('There was an error processing one or more images. Please try different images or formats.');
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
            showSavedNotification();
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
            showSavedNotification();
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
      showSavedNotification();
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
      showSavedNotification();
    } else {
      console.error('Error saving submitted journal');
    }
    
    // If the button text includes "Gallery", also save to the backend
    if (saveButtonText && saveButtonText.includes("Gallery")) {
      saveJournalToBackend();
    }
  };
  
  const handleReset = () => {
    setLocation('');
    setJournalText('');
    setImages([]);
    setDate(new Date());
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
      showSavedNotification();
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
      showSavedNotification();
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
      showSavedNotification();
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
      showSavedNotification();
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
  
  // New state for save options
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  
  // New function to handle saving as image
  const handleSaveAsImage = () => {
    setShowSaveOptions(false);
    
    // Show toast with loading indicator
    const toastId = toast.loading('Creating ultra high definition image...', {
      position: 'top-right',
      autoClose: false
    });
    
    const journalElement = document.getElementById('journal-canvas');
    if (!journalElement) {
      toast.dismiss(toastId);
      toast.error('Journal element not found', {
        position: 'top-right',
        autoClose: 3000
      });
      return;
    }
    
    // Get exact dimensions of the journal
    const rect = journalElement.getBoundingClientRect();
    
    // Use a much higher scale for 4K quality
    const scale = 40; // Absolute maximum resolution for pixel perfection
    
    // Create a wrapper for better quality handling
    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.top = '-9999px';
    wrapper.style.left = '-9999px';
    wrapper.style.width = `${rect.width}px`;
    wrapper.style.height = `${rect.height}px`;
    document.body.appendChild(wrapper);
    
    // Clone the journal element into the wrapper to prevent display issues
    const clone = journalElement.cloneNode(true) as HTMLElement;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.transform = 'none';
    wrapper.appendChild(clone);
    
    // Create placeholder canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = rect.width * scale;
    tempCanvas.height = rect.height * scale;
    const ctx = tempCanvas.getContext('2d');
    
    if (ctx) {
      // Fill background white to ensure transparency doesn't cause issues
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    }
    
    // Use html2canvas with maximum quality settings
    html2canvas(clone, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 120000, // 2 minutes to ensure everything loads perfectly
      windowWidth: rect.width,
      windowHeight: rect.height,
      x: 0,
      y: 0,
      width: rect.width,
      height: rect.height,
      letterRendering: true,
      imageSmoothingEnabled: false,
      foreignObjectRendering: true,
      onclone: (documentClone: Document) => {
        // Apply better rendering settings to the cloned document
        const clonedElement = documentClone.getElementById('journal-canvas');
        if (clonedElement) {
          clonedElement.style.width = rect.width + 'px';
          clonedElement.style.height = rect.height + 'px';
          // Enhance text rendering
          clonedElement.style.textRendering = 'geometricPrecision';
          (clonedElement.style as any).fontSmooth = 'always';
          (clonedElement.style as any)['webkit-font-smoothing'] = 'antialiased';
          (clonedElement.style as any)['-webkit-font-smoothing'] = 'antialiased';
          (clonedElement.style as any)['-moz-osx-font-smoothing'] = 'grayscale';
          
          // Apply high quality image rendering to all images
          const images = clonedElement.querySelectorAll('img');
          images.forEach((img: HTMLImageElement) => {
            img.style.imageRendering = 'high-quality';
            img.style.imageRendering = '-webkit-optimize-contrast';
            img.style.transform = 'translateZ(0)';
            img.style.backfaceVisibility = 'hidden';
            img.style.willChange = 'transform';
          });
          
          // Apply high quality rendering to all text elements
          const textElements = clonedElement.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div');
          textElements.forEach((el: Element) => {
            const htmlEl = el as HTMLElement;
            htmlEl.style.textRendering = 'geometricPrecision';
            (htmlEl.style as any)['-webkit-font-smoothing'] = 'antialiased';
            (htmlEl.style as any)['-moz-osx-font-smoothing'] = 'grayscale';
          });
        }
      }
    }).then((canvas: HTMLCanvasElement) => {
      try {
        // Apply subtle image processing for clarity
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Slight sharpening effect
          ctx.globalCompositeOperation = 'source-over';
        }
        
        // Use direct canvas data to maintain highest quality - switched to PNG for lossless quality
        const imgData = canvas.toDataURL('image/png', 1.0);
        
        // Create download link
        const link = document.createElement('a');
        link.download = `journal-${new Date().toISOString().split('T')[0]}-ultrahd.png`;
        link.href = imgData;
        link.click();
        
        // Remove wrapper and update toast
        document.body.removeChild(wrapper);
        toast.dismiss(toastId);
        
        // Show success notification
        toast.success('Saved 4K Ultra HD image to your device', {
          position: 'top-right',
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true
        });
      } catch (err: any) {
        console.error('Error converting canvas to PNG:', err);
        document.body.removeChild(wrapper);
        toast.dismiss(toastId);
        retryImageSave(journalElement);
      }
    }).catch((err: any) => {
      console.error('Error with html2canvas:', err);
      document.body.removeChild(wrapper);
      toast.dismiss(toastId);
      retryImageSave(journalElement);
    });
  };
  
  // Retry function with fallback options
  const retryImageSave = (element: HTMLElement, attempts = 1) => {
    if (attempts > 3) {
      applyBasicFallback(element);
      return;
    }
    
    // Show retry notification with toast
    const toastId = toast.loading(`Retrying with alternative method (${attempts}/3)...`, {
      position: 'top-right',
      autoClose: false
    });
    
    // Get element dimensions
    const rect = element.getBoundingClientRect();
    const scale = 16 - attempts * 2; // Increased base scale but still reducing with each retry: 14, 12, 10
    
    // Create a wrapper for the clone to ensure clean rendering
    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.top = '-9999px';
    wrapper.style.left = '-9999px';
    wrapper.style.width = `${rect.width}px`;
    wrapper.style.height = `${rect.height}px`;
    document.body.appendChild(wrapper);
    
    // Clone the journal element into the wrapper
    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.transform = 'none';
    wrapper.appendChild(clone);
    
    // Different approach for retry
    html2canvas(clone, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 60000,
      onclone: (documentClone: Document) => {
        // Apply rendering optimizations
        const clonedElement = documentClone.getElementById('journal-canvas');
        if (clonedElement) {
          clonedElement.style.width = rect.width + 'px';
          clonedElement.style.height = rect.height + 'px';
        }
      }
    }).then((canvas: HTMLCanvasElement) => {
      try {
        // Convert to image
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        
        // Download
      const link = document.createElement('a');
        link.download = `journal-${new Date().toISOString().split('T')[0]}.jpg`;
      link.href = imgData;
      link.click();
      
      // Clean up
      document.body.removeChild(wrapper);
        toast.dismiss(toastId);
      
      // Show success notification
        toast.success('Image saved successfully', {
          position: 'top-right',
          autoClose: 3000
        });
      } catch (err: any) {
        console.error(`Error in retry ${attempts}:`, err);
        document.body.removeChild(wrapper);
        toast.dismiss(toastId);
      setTimeout(() => {
          retryImageSave(element, attempts + 1);
        }, 1000);
      }
    }).catch((err: any) => {
      console.error(`Retry ${attempts} with html2canvas failed:`, err);
      document.body.removeChild(wrapper);
      toast.dismiss(toastId);
      setTimeout(() => {
        retryImageSave(element, attempts + 1);
      }, 1000);
    });
  };
  
  // Most basic fallback with minimal options
  const applyBasicFallback = (element: HTMLElement) => {
    // Show final fallback notification
    const toastId = toast.loading('Trying simpler approach for compatibility...', {
      position: 'top-right',
      autoClose: false
    });
    
    try {
      // Get element dimensions
      const rect = element.getBoundingClientRect();
      
      // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.top = '-9999px';
    wrapper.style.left = '-9999px';
    document.body.appendChild(wrapper);
    
      // Clone element
      const clone = element.cloneNode(true) as HTMLElement;
    wrapper.appendChild(clone);
    
      // Use very basic settings
      html2canvas(element, {
        scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
        logging: false
      }).then((canvas: HTMLCanvasElement) => {
        // Get image data and download
        const imgData = canvas.toDataURL('image/jpeg', 0.9);
        const link = document.createElement('a');
        link.download = `journal-${new Date().toISOString().split('T')[0]}.jpg`;
        link.href = imgData;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
          document.body.removeChild(wrapper);
        toast.dismiss(toastId);
        
        // Show success
        toast.success('Image saved using compatibility mode', {
          position: 'top-right',
          autoClose: 3000
        });
      }).catch((err: Error) => {
        console.error('Final fallback failed:', err);
          document.body.removeChild(wrapper);
        toast.dismiss(toastId);
        
        // Show error with guidance
        toast.error(
          'Could not save as image. Try taking a screenshot instead.',
          {
            position: 'top-right',
            autoClose: 5000
          }
        );
      });
    } catch (err: unknown) {
      console.error('Error in basic fallback:', err);
      toast.dismiss(toastId);
      
      toast.error(
        'Could not save as image. Try taking a screenshot instead.',
        {
          position: 'top-right',
          autoClose: 5000
        }
      );
    }
  };
  
  // Completely rewritten share function - ultra simplified
  const handleShare = async () => {
    // Check authentication first
    if (!isAuthenticated) {
      toast.error("Please sign in to share or download your journal");
      navigate("/login");
      return;
    }
    
    if (!journalRef.current) return;
    
    const journalElement = journalRef.current;
    
    // Device detection
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isMobile = isIOS || isAndroid;
    
    // Create a toast notification with progress bar
    const toastId = toast.loading("Creating high-quality PDF...", {
      position: "bottom-center",
      autoClose: false,
      closeButton: false,
      style: { maxWidth: '320px', width: '100%' }
    });
    
    // Type alias for toast types used in update
    type ToastUpdateType = 'success' | 'error' | 'info' | 'warning' | 'default';

    const updateToast = (
      content: React.ReactNode, 
      type: ToastUpdateType = 'default', 
      options: Partial<import('react-toastify').UpdateOptions> = {}
    ) => {
      toast.update(toastId, {
        render: content,
        type: type, // Pass the type directly
        isLoading: false, // Assume no longer loading unless specified
        ...options, // Spread other options like autoClose, closeButton, etc.
      });
    };
    
    updateToast("Initializing PDF export..."); // Initial message (type defaults to 'default')
    
    try {
      // Step 1: Capture canvas with high quality
      updateToast("Capturing journal content (High Quality)...", 'default', { 
        progress: 0.2, 
        isLoading: true // Keep showing spinner
      }); 
      
      // Use higher scale for quality, consistent across devices if possible
      const scale = 4; // Let's try scale 4 for both, aiming for quality
      
      const canvas = await html2canvas(journalElement, {
          scale: scale,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 90000, // Increased timeout for higher scale
        letterRendering: true
      });
      
      // Step 2: Generate PDF
      updateToast("Generating PDF document...", 'default', { 
        progress: 0.5, 
        isLoading: true 
      });
      
      const imgWidth = 210; // A4 width mm
      const pageHeight = 297; // A4 height mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pagesNeeded = Math.ceil(imgHeight / pageHeight);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgData = canvas.toDataURL('image/jpeg', 1.0); // High quality JPEG
      
      // Add image to PDF pages
      updateToast("Adding content to PDF...", 'default', { 
        progress: 0.7, 
        isLoading: true 
      });
      let heightLeft = imgHeight;
      let position = 0;
      for (let i = 0; i < pagesNeeded; i++) {
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, -position, imgWidth, imgHeight);
        position += pageHeight;
        heightLeft -= pageHeight;
      }
      
      // Step 3: Prepare output & attempt display/download
      updateToast("Finalizing PDF...", 'default', { 
        progress: 0.9, 
        isLoading: true 
      });
      const filename = `journal-${new Date().toISOString().slice(0, 10)}.pdf`;
      
      // Determine browser on iOS
      const isChromeIOS = navigator.userAgent.match("CriOS");
      const isFirefoxIOS = navigator.userAgent.match("FxiOS");
      const isSafariIOS = isIOS && !isChromeIOS && !isFirefoxIOS;
      
      // Attempt download using the most reliable methods first
      try {
        // Method 1: Use pdf.save() - works well on Desktop, Android, and Safari iOS
        pdf.save(filename);
        
        // Update toast with instructions based on OS/browser
        if (isSafariIOS) {
          updateToast(
            <div>
              <p className="font-bold">✅ PDF Download Initiated!</p>
              <p className="text-sm">Check Safari downloads (⬇️ icon) or the Files app.</p>
              <p className="text-xs mt-1">Once downloaded, open the PDF and use Share &gt; &apos;Copy to Goodnotes&apos;.</p>
            </div>,
            'success',
            { autoClose: 15000, isLoading: false, closeButton: true }
          );
        } else if (isIOS) { // Chrome, Firefox, etc. on iOS
          updateToast(
            <div>
              <p className="font-bold">✅ PDF Download Attempted</p>
              <p className="text-sm">If download doesn&apos;t start, try opening:</p>
              {/* Add button to open data URI as fallback */}
              <button 
                onClick={() => {
                  try {
                    const pdfDataUri = pdf.output('datauristring');
                    window.open(pdfDataUri, '_blank');
                  } catch (e) { 
                    alert('Could not open PDF directly. Please check downloads.');
                  }
                }}
                className="mt-2 py-1 px-2 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
              >
                Open PDF in New Tab
              </button>
              <p className="text-xs mt-1">Then use Share &gt; &apos;Copy to Goodnotes&apos;. Check Files app if needed.</p>
            </div>,
            'info', // Use info as pdf.save might not work reliably here
            { autoClose: 20000, isLoading: false, closeButton: true }
          );
          } else {
          // Non-iOS (Desktop, Android)
          updateToast(
            <div>
              <p className="font-bold">✅ PDF Downloaded Successfully!</p>
              <p className="text-sm">Check your downloads folder.</p>
            </div>,
            'success',
            { autoClose: 5000, isLoading: false, closeButton: true }
          );
        }
      } catch (saveError) {
        console.error("pdf.save() failed:", saveError);
        // Fallback error message if pdf.save fails
        updateToast(
          <div>
            <p className="font-bold">Download Failed</p>
            <p className="text-sm">Could not save the PDF. Please try again.</p>
          </div>,
          'error',
          { autoClose: 7000, isLoading: false, closeButton: true }
        );
      }
      
    } catch (error) {
      console.error("Error creating PDF:", error);
      updateToast(
        <div>
          <p className="font-bold">PDF Generation Failed</p>
          <p className="text-sm">An error occurred. Please try again.</p>
        </div>,
        'error',
        { autoClose: 7000, isLoading: false, closeButton: true }
      );
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
    
    if (saveToLocalStorage('webjournal_draft', draftData)) {
      showSavedNotification();
    }
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
  
  return (
    <div className="w-full">
      {!submitted ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Form - Left Side */}
          <div className="bg-white rounded-2xl shadow-xl border border-[#d1cdc0] overflow-hidden">
            <div className="p-6 border-b border-[#e8e4d5] flex justify-between items-center">
              <h3 className="text-xl font-semibold text-[#1a1a1a]">New Journal Entry</h3>
              {!submitted && (
                <button 
                  type="button" // Prevent form submission
                  onClick={handleReset} 
                  className="px-4 py-2.5 bg-[#f8f8f8] hover:bg-[#efefef] text-[#333] rounded-lg flex items-center gap-2 transition-colors shadow-sm border border-[#ddd] text-base"
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                  </svg>
                  New Journal
                </button>
              )}
            </div>
            <div className="p-6">
              <motion.form
                onSubmit={handleSubmit}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="space-y-3">
                    <label htmlFor="date" className="block text-sm font-medium text-[#1a1a1a] flex items-center gap-2">
                      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-[#4a4a4a]">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                      <span>Date</span>
                    </label>
                    <input
                      type="date"
                      id="date"
                      value={date.toISOString().split('T')[0]}
                      onChange={(e) => setDate(new Date(e.target.value))}
                      className="w-full rounded-lg border border-[#d1cdc0] shadow-sm focus:border-[#1a1a1a] focus:ring-[#1a1a1a] px-4 py-3 text-[#1a1a1a] transition-all duration-200 bg-white/50 backdrop-blur-sm"
                      required
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <label htmlFor="location" className="block text-sm font-medium text-[#1a1a1a] flex items-center gap-2">
                      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-[#4a4a4a]">
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
                      className="w-full rounded-lg border border-[#d1cdc0] shadow-sm focus:border-[#1a1a1a] focus:ring-[#1a1a1a] px-4 py-4 text-[#1a1a1a] transition-all duration-200 bg-white/50 backdrop-blur-sm text-base"
                      required
                    />
                  </div>

                  {/* Images upload - moved up after location */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-[#1a1a1a] flex items-center gap-2">
                      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-[#4a4a4a]">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                      <span>Images {images.length > 0 && `(${images.length}/3)`}</span>
                    </label>
                    
                    {images.length < 3 && (
                      <div 
                        className="border-2 border-dashed border-[#d1cdc0] rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-[#4a4a4a] transition-all duration-300 bg-white/30 backdrop-blur-sm hover:bg-white/50"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <svg className="w-10 h-10 text-[#4a4a4a] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                        </svg>
                        <p className="text-base text-[#4a4a4a] text-center mb-2">Tap to upload images</p>
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
                        className="grid grid-cols-3 gap-2 mt-2"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        {images.map((image, index) => (
                          <div 
                            key={index} 
                            className="relative group overflow-hidden rounded-lg shadow-md border border-[#d1cdc0] aspect-square bg-white"
                          >
                            <img 
                              src={image} 
                              alt={`Upload ${index + 1}`} 
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-sm text-[#1a1a1a] opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-[#1a1a1a] hover:text-white sm:opacity-80"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                              </svg>
                            </button>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </div>

                  {/* Color Picker */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-[#1a1a1a] flex items-center gap-2">
                      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-[#4a4a4a]">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"></path>
                      </svg>
                      <span>Colors</span>
                    </label>
                    <div className="bg-white rounded-lg shadow-sm border border-[#d1cdc0] p-3">
                      <SimpleColorPicker 
                        colors={textColors}
                        onChange={handleColorChange}
                        images={images}
                      />
                    </div>
                  </div>

                  {/* Layout Style Toggle */}
                  <LayoutToggle
                    layoutMode={layoutMode}
                    setLayoutMode={setLayoutMode}
                  />
                
                  <div className="space-y-3">
                    <label htmlFor="journalText" className="block text-sm font-medium text-[#1a1a1a] flex items-center gap-2">
                      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-[#4a4a4a]">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                      </svg>
                      <span>Journal Entry</span>
                    </label>
                    <textarea
                      id="journalText"
                      value={journalText}
                      onChange={(e) => setJournalText(e.target.value)}
                      placeholder="Write your journal entry here..."
                      className="w-full rounded-lg border border-[#d1cdc0] shadow-sm focus:border-[#1a1a1a] focus:ring-[#1a1a1a] px-4 py-4 min-h-[180px] text-[#1a1a1a] transition-all duration-200 bg-white/50 backdrop-blur-sm text-base"
                      required
                    />
                    <p className="text-xs text-gray-500">Use double line breaks to create new paragraphs.</p>
                  </div>
                </div>
                
                <div className="flex justify-end pt-4 border-t border-[#e8e4d5]">
                  <motion.button
                    type="submit"
                    className="px-6 py-3 bg-[#1a1a1a] text-white rounded-lg hover:bg-[#333] focus:outline-none focus:ring-2 focus:ring-[#1a1a1a]"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={isLoadingImage}
                  >
                    {isLoadingImage ? 'Processing...' : saveButtonText}
                  </motion.button>
                  
                  <motion.button
                    onClick={handleSaveAsPDF}
                    className="px-6 py-3 bg-[#b5a890] text-white rounded-lg hover:bg-[#a39580] ml-3 focus:outline-none"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Download PDF
                  </motion.button>
                </div>
              </motion.form>
            </div>
          </div>
          
          {/* Live Preview - Right Side */}
          <div className="bg-white rounded-2xl shadow-xl border border-[#d1cdc0] overflow-hidden">
            <div className="p-4 border-b border-[#e8e4d5] flex justify-between items-center">
              <h3 className="text-xl font-semibold text-[#1a1a1a]">
                Journal Preview
              </h3>
              <div className="text-sm text-gray-500">
                Updates as you type
              </div>
            </div>
            
            <div className="p-4">
              <div className="relative bg-[#f9f7f1] rounded-xl overflow-hidden shadow-lg" ref={journalRef}>
                <JournalCanvas
                  date={date}
                  location={location}
                  textSections={journalText.split('\n\n').filter(section => section.trim().length > 0)}
                  images={images}
                  onNewEntry={handleReset}
                  templateUrl={templateUrl}
                  textColors={textColors}
                  layoutMode={layoutMode}
                  editMode={false}
                  onTextClick={() => {}}
                  onImageDrag={() => {}}
                  onImageClick={() => {}}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-xl border border-[#d1cdc0] overflow-hidden">
          <div className="p-4 border-b border-[#e8e4d5] flex justify-between items-center">
            <h3 className="text-xl font-semibold text-[#1a1a1a]">
              Your Journal
            </h3>
            <div className="flex gap-3">
              <div className="relative">
                <button 
                  onClick={() => {
                    // On mobile, directly share; on desktop, show options
                    const isMobile = window.innerWidth < 768;
                    if (isMobile) {
                      handleShare();
                    } else {
                      setShowSaveOptions(!showSaveOptions)
                    }
                  }} 
                  className="px-4 py-2.5 bg-[#f8f8f8] hover:bg-[#efefef] text-[#333] rounded-lg flex items-center gap-2 transition-colors shadow-sm border border-[#ddd] text-base"
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="hidden md:block">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
                  </svg>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="md:hidden">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path>
                  </svg>
                  <span className="hidden md:inline">Print</span>
                  <span className="md:hidden">Share</span>
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>
                
                {showSaveOptions && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                    <ul className="py-1">
                      <li className="hidden md:block">
                        <button 
                          onClick={() => window.print()}
                          className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z"></path>
                          </svg>
                          Print
                        </button>
                      </li>
                      <li className="hidden md:block">
                        <button 
                          onClick={handleSaveAsPDF} 
                          className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                          </svg>
                          Save as PDF
                        </button>
                      </li>
                      <li>
                        <button 
                          onClick={handleShare} 
                          className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path>
                          </svg>
                          Share
                        </button>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
              {submitted && (
                <button 
                  onClick={handleReset} 
                  className="px-4 py-2.5 bg-[#1a1a1a] hover:bg-[#333] text-white rounded-lg flex items-center gap-2 transition-colors shadow-sm text-base"
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                  </svg>
                  New Entry
                </button>
              )}
              
              {submitted && isAuthenticated && (
                <button 
                  onClick={saveJournalToBackend}
                  className="px-4 py-2.5 bg-[#b5a890] hover:bg-[#a39580] text-white rounded-lg flex items-center gap-2 transition-colors shadow-sm text-base"
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
                  </svg>
                  Save to Gallery
                </button>
              )}
            </div>
          </div>
          
          <div className="p-4">
            <div className="relative bg-[#f9f7f1] rounded-xl overflow-hidden shadow-lg" ref={journalRef}>
              <JournalCanvas
                date={submitted ? submittedData.date : date}
                location={submitted ? submittedData.location : location}
                textSections={submitted ? submittedData.text : journalText.split('\n\n').filter(section => section.trim().length > 0)}
                images={submitted ? submittedData.images : images}
                onNewEntry={handleReset}
                templateUrl={templateUrl}
                textColors={submitted ? submittedData.textColors : textColors}
                layoutMode={submitted ? submittedData.layoutMode : layoutMode}
                editMode={submitted}
                onTextClick={handleTextClick}
                onImageDrag={(index, x, y) => {
                  // Handle image dragging
                  console.log(`Image ${index} dragged to ${x},${y}`);
                }}
                onImageClick={handleCanvasImageClick}
                forceUpdate={submitted ? submittedData.forceUpdate : undefined}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JournalForm; 