import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import JournalCanvas, { ClickableTextArea } from './JournalCanvas';
import SimpleColorPicker, { TextColors } from './TempColorPicker';
// @ts-ignore
import html2canvas from 'html2canvas';

// Declare global window properties for TypeScript
declare global {
  interface Window {
    FORCE_CANVAS_REDRAW: boolean;
    CURRENT_COLORS: TextColors;
    forceCanvasRedraw?: () => void;
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
}

const JournalForm: React.FC<JournalFormProps> = ({ 
  templateUrl = '/templates/cream-black-template.jpg' 
}) => {
  const [location, setLocation] = useState('');
  const [journalText, setJournalText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [date, setDate] = useState(new Date());
  const [submitted, setSubmitted] = useState(false);
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
    forceUpdate?: number;
  }>({
    date: new Date(),
    location: '',
    text: [],
    images: [],
    textColors: {
      locationColor: '#2D9CDB',
      locationShadowColor: '#1D3557',
    }
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
  const optimizeImageForStorage = (imageDataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        img.onload = () => {
          // Create a canvas to resize the image
          const canvas = document.createElement('canvas');
          
          // Calculate new dimensions - max width/height of 800px
          const MAX_SIZE = 800;
          let width = img.width;
          let height = img.height;
          
          if (width > height && width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Draw the resized image
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(imageDataUrl); // Fallback to original if context fails
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // Get the resized image with reduced quality
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(optimizedDataUrl);
        };
        
        img.onerror = () => {
          console.error('Error loading image for optimization');
          resolve(imageDataUrl); // Return original if optimization fails
        };
        
        img.src = imageDataUrl;
      } catch (error) {
        console.error('Error optimizing image:', error);
        resolve(imageDataUrl); // Return original if optimization fails
      }
    });
  };
  
  // Update handleImageUpload to optimize images
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const remainingSlots = 3 - images.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    
    filesToProcess.forEach(file => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (e.target?.result) {
          try {
            // Optimize the image before storing
            const optimizedImage = await optimizeImageForStorage(e.target.result as string);
            setImages(prev => [...prev, optimizedImage]);
          } catch (error) {
            console.error('Error processing image:', error);
            // Use original as fallback
            setImages(prev => [...prev, e.target!.result as string]);
          }
        }
      };
      reader.readAsDataURL(file);
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
    
    // Break the journal text into paragraphs
    const textSections = journalText.split('\n\n').filter(section => section.trim().length > 0);
    
    const newSubmittedData = {
      date,
      location,
      text: textSections,
      images,
      textColors
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
  };
  
  const handleReset = () => {
    setLocation('');
    setJournalText('');
    setImages([]);
    setDate(new Date());
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
    
    // Save to localStorage (either draft or submitted based on current state)
    if (submitted) {
      const dataToSave = {
        ...updatedData,
        date: updatedData.date.toISOString()
      };
      
      if (saveToLocalStorage('webjournal_submitted', dataToSave)) {
        showSavedNotification(newColors.locationColor);
      } else {
        console.error('Error saving color changes to submitted journal');
      }
    } else {
      // For draft, we need to save to the draft format
      const draftData = {
        location,
        journalText,
        images,
        date: date.toISOString(),
        textColors: newColors,
        forceUpdate: Date.now()  // Add timestamp here too
      };
      
      if (saveToLocalStorage('webjournal_draft', draftData)) {
        showSavedNotification(newColors.locationColor);
      } else {
        console.error('Error saving color changes to draft');
      }
    }
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
  
  // Handle clicking on text areas in the canvas
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
  
  return (
    <div className="w-full max-w-6xl mx-auto relative">
      {/* Save notification */}
      {showSaveNotification && (
        <motion.div 
          className="save-notification fixed top-4 right-4 bg-green-100 border border-green-300 text-green-800 px-4 py-2 rounded-md shadow-md z-50 flex items-center gap-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          style={{
            transition: 'all 0.3s ease'
          }}
        >
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
          <span>Journal saved</span>
        </motion.div>
      )}
      
      {/* Add styles for the color-picked animation */}
      <style dangerouslySetInnerHTML={{__html: `
        .save-notification.color-picked {
          background-color: #f0f9ff !important;
          border-color: #93c5fd !important;
          color: #1e40af !important;
        }
        
        .save-notification.color-picked svg {
          color: #3b82f6 !important;
        }
        
        .save-notification.color-picked .color-sample {
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          transition: all 0.2s ease;
        }
        
        .save-notification.color-picked .color-sample:hover {
          transform: scale(1.2);
        }

        @media print {
          .edit-panel {
            display: none;
          }
          .journal-preview {
            width: 100%;
            max-width: 100%;
          }
        }
      `}} />
      
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Journal Preview - Left side, 3/5 width on desktop */}
        <div className="lg:col-span-3 journal-preview">
          <div className="bg-white rounded-2xl shadow-xl border border-[#d1cdc0] overflow-hidden">
            <div className="p-4 border-b border-[#e8e4d5] flex justify-between items-center">
              <h3 className="text-xl font-semibold text-[#1a1a1a]">
                {submitted ? "Your Journal" : "Journal Preview"}
              </h3>
              <div className="flex gap-3">
                <button 
                  onClick={() => window.print()} 
                  className="px-3 py-1.5 bg-[#f8f8f8] hover:bg-[#efefef] text-[#333] rounded-lg flex items-center gap-2 transition-colors shadow-sm border border-[#ddd] text-sm"
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
                  </svg>
                  Print
                </button>
                {submitted && (
                  <button 
                    onClick={handleReset} 
                    className="px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#333] text-white rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm"
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    New Entry
                  </button>
                )}
              </div>
            </div>
            
            <div className="p-4">
              <div className="relative bg-[#f9f7f1] rounded-xl overflow-hidden shadow-lg">
                <JournalCanvas
                  date={submitted ? submittedData.date : date}
                  location={submitted ? submittedData.location : location}
                  textSections={submitted ? submittedData.text : journalText.split('\n\n').filter(section => section.trim().length > 0)}
                  images={submitted ? submittedData.images : images}
                  onNewEntry={handleReset}
                  templateUrl={templateUrl}
                  textColors={submitted ? submittedData.textColors : textColors}
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
        </div>
        
        {/* Edit Panel - Right side, 2/5 width on desktop */}
        <div className="lg:col-span-2 edit-panel">
          {submitted ? (
            // Editor panel for submitted journal
            <div className="space-y-6">
              {/* Color Editor */}
              <div className="bg-white rounded-xl shadow-md overflow-hidden border border-[#d1cdc0]">
                <div className="px-4 py-3 bg-[#f9f7f1] border-b border-[#d1cdc0]">
                  <h3 className="font-medium text-[#1a1a1a]">Customize Colors</h3>
                </div>
                <div className="p-4">
                  <SimpleColorPicker 
                    colors={submittedData.textColors}
                    onChange={handleColorChange}
                    images={submittedData.images}
                  />
                </div>
              </div>
              
              {/* Text Editor */}
              <div className="bg-white rounded-xl shadow-md overflow-hidden border border-[#d1cdc0]">
                <div className="px-4 py-3 bg-[#f9f7f1] border-b border-[#d1cdc0]">
                  <h3 className="font-medium text-[#1a1a1a]">Edit Content</h3>
                </div>
                <div className="p-4 space-y-4">
                  {/* Location editing */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Location
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={submittedData.location}
                        onChange={handleLocationChange}
                        ref={locationInputRef}
                        className="flex-1 rounded-md border border-gray-300 shadow-sm focus:border-[#1a1a1a] focus:ring-[#1a1a1a] px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  
                  {/* Text sections editing */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium text-gray-700">
                        Text Sections
                      </label>
                      <button
                        type="button"
                        onClick={addNewTextSection}
                        className="text-xs px-2 py-1 bg-[#f9f7f1] text-[#1a1a1a] rounded hover:bg-[#e8e4d5] transition-colors flex items-center gap-1"
                      >
                        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                        </svg>
                        Add
                      </button>
                    </div>
                    
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                      {submittedData.text.map((section, index) => (
                        <div key={index} className="relative bg-white rounded-md border border-gray-300 transition-all duration-200 hover:shadow-sm">
                          <textarea
                            value={section}
                            onChange={(e) => handleTextSectionChange(e)}
                            data-index={index}
                            ref={(el) => {
                              textSectionRefs.current[index] = el;
                              if (activeTextSection === index && el) {
                                el?.focus();
                              }
                            }}
                            className="w-full rounded-md border-0 px-3 py-2 text-sm focus:ring-1 focus:ring-[#1a1a1a] min-h-[80px] resize-y"
                          />
                          <button
                            type="button"
                            onClick={() => removeTextSection(index)}
                            className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Images editing */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium text-gray-700">
                        Images
                      </label>
                      {submittedData.images.length < 3 && (
                        <label className="text-xs px-2 py-1 bg-[#f9f7f1] text-[#1a1a1a] rounded hover:bg-[#e8e4d5] transition-colors flex items-center gap-1 cursor-pointer">
                          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                          </svg>
                          Add
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleAddImage(e)}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      {submittedData.images.map((img, index) => (
                        <div key={index} className="relative group bg-gray-100 aspect-square rounded-md overflow-hidden">
                          <img
                            src={img}
                            alt={`Journal image ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                            <label className="w-8 h-8 rounded-full bg-white flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors">
                              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                              </svg>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleReplaceImage(index, e)}
                                className="hidden"
                              />
                            </label>
                            <button
                              onClick={() => handleRemoveImage(index)}
                              className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-gray-100 transition-colors"
                            >
                              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Input form for creating journal
            <div className="bg-white rounded-2xl shadow-xl border border-[#d1cdc0] overflow-hidden">
              <div className="p-6 border-b border-[#e8e4d5]">
                <h3 className="text-xl font-semibold text-[#1a1a1a]">New Journal Entry</h3>
                <p className="text-[#4a4a4a] mt-1">Fill in the details to create your journal</p>
              </div>
              
              <div className="p-6">
                <motion.form 
                  onSubmit={handleSubmit} 
                  className="space-y-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
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
                        placeholder="e.g., NEW YORK, BRONX, CARTI"
                        className="w-full rounded-lg border border-[#d1cdc0] shadow-sm focus:border-[#1a1a1a] focus:ring-[#1a1a1a] px-4 py-3 text-[#1a1a1a] transition-all duration-200 bg-white/50 backdrop-blur-sm"
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
                          className="border-2 border-dashed border-[#d1cdc0] rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-[#4a4a4a] transition-all duration-300 bg-white/30 backdrop-blur-sm hover:bg-white/50"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <svg className="w-8 h-8 text-[#4a4a4a] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                          </svg>
                          <p className="text-sm text-[#4a4a4a] text-center mb-2">Click to upload images</p>
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
                                className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm p-1.5 rounded-full shadow-sm text-[#1a1a1a] opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-[#1a1a1a] hover:text-white"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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
                        className="w-full rounded-lg border border-[#d1cdc0] shadow-sm focus:border-[#1a1a1a] focus:ring-[#1a1a1a] px-4 py-3 min-h-[180px] text-[#1a1a1a] transition-all duration-200 bg-white/50 backdrop-blur-sm"
                        required
                      />
                      <p className="text-xs text-gray-500">Use double line breaks to create new paragraphs.</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-end pt-4 border-t border-[#e8e4d5]">
                    <motion.button
                      type="submit"
                      className="px-6 py-3 bg-[#1a1a1a] text-white text-base font-medium rounded-lg shadow-lg flex items-center gap-2 overflow-hidden relative"
                      whileHover={{ 
                        scale: 1.03,
                        boxShadow: "0 0 15px rgba(26, 26, 26, 0.2)"
                      }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <span>Save Journal</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path>
                      </svg>
                    </motion.button>
                  </div>
                </motion.form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JournalForm; 