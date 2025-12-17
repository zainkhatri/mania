import React, { useState, useRef, useCallback, useEffect } from 'react';

// Icons component
const Icons = {
  FaHandPointer: ({ className }: { className?: string }) => <span className={`text-lg ${className || ''}`}>👆</span>,
  FaExpandArrowsAlt: ({ className }: { className?: string }) => <span className={`text-lg ${className || ''}`}>🔀</span>,
  FaTrash: ({ className }: { className?: string }) => <span className={`text-lg ${className || ''}`}>🗑️</span>,
  FaImage: ({ className }: { className?: string }) => <span className={`text-lg ${className || ''}`}>🖼️</span>,
  FaRotate: ({ className }: { className?: string }) => <span className={`text-lg ${className || ''}`}>🔄</span>,
};

interface ImagePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

interface MobileImageEditorProps {
  images: (string | Blob)[];
  imagePositions: Record<string, ImagePosition>;
  onImageUpdate: (positions: Record<string, ImagePosition>) => void;
  onImageDelete: (index: number) => void;
  canvasWidth: number;
  canvasHeight: number;
}

const DEBUG = false; // Set to true to enable focused debugging

const MobileImageEditor: React.FC<MobileImageEditorProps> = ({
  images,
  imagePositions,
  onImageUpdate,
  onImageDelete,
  canvasWidth,
  canvasHeight
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState(0);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate touch distance for pinch-to-resize
  const getTouchDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent, imageKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const touch = e.touches[0];
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    if (DEBUG) console.log('🔵 Touch start:', { imageKey, x, y, touchCount: e.touches.length });

    // Always select the image when touched
    setSelectedImage(imageKey);
    setTouchStart({ x, y });
    
    const currentPos = imagePositions[imageKey];
    if (currentPos) {
      setDragStart({ x, y });
      setDragOffset({
        x: x - currentPos.x,
        y: y - currentPos.y
      });
      setResizeStart({ 
        x: currentPos.x, 
        y: currentPos.y,
        width: currentPos.width,
        height: currentPos.height
      });
    }

    if (e.touches.length === 2) {
      setLastTouchDistance(getTouchDistance(e.touches));
    }
  }, [imagePositions]);

  // Handle touch move with real-time updates
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!selectedImage || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    if (e.touches.length === 1) {
      // Single touch - move image in real-time
      const deltaX = x - touchStart.x;
      const deltaY = y - touchStart.y;

      if (DEBUG && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
        console.log('🟢 Touch move (drag):', { deltaX, deltaY, isDragging });
      }

      // Set dragging state for visual feedback
      if (!isDragging && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
        setIsDragging(true);
      }

      const newPositions = { ...imagePositions };
      const currentPos = newPositions[selectedImage];
      if (currentPos) {
        const newX = Math.max(0, Math.min(canvasWidth - currentPos.width, currentPos.x + deltaX));
        const newY = Math.max(0, Math.min(canvasHeight - currentPos.height, currentPos.y + deltaY));

        // Update position in real-time
        newPositions[selectedImage] = {
          ...currentPos,
          x: newX,
          y: newY
        };

        // Call update immediately for real-time movement
        onImageUpdate(newPositions);

        // Update touch start for next move
        setTouchStart({ x, y });
      }
    } else if (e.touches.length === 2) {
      // Two touches - resize image in real-time
      const currentDistance = getTouchDistance(e.touches);
      if (lastTouchDistance > 0) {
        const scale = currentDistance / lastTouchDistance;

        if (DEBUG && Math.abs(scale - 1) > 0.05) {
          console.log('🔴 Touch move (resize):', { currentDistance, lastTouchDistance, scale, isResizing });
        }

        // Set resizing state for visual feedback
        if (!isResizing && Math.abs(scale - 1) > 0.05) {
          setIsResizing(true);
        }

        const newPositions = { ...imagePositions };
        const currentPos = newPositions[selectedImage];
        if (currentPos) {
          const newWidth = Math.max(50, Math.min(canvasWidth, currentPos.width * scale));
          const newHeight = Math.max(50, Math.min(canvasHeight, currentPos.height * scale));

          newPositions[selectedImage] = {
            ...currentPos,
            width: newWidth,
            height: newHeight
          };

          // Update size in real-time
          onImageUpdate(newPositions);
        }
      }
      setLastTouchDistance(currentDistance);
    }
  }, [selectedImage, imagePositions, touchStart, lastTouchDistance, canvasWidth, canvasHeight, onImageUpdate]);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    if (DEBUG) console.log('⚪ Touch end:', { isDragging, isResizing });
    // Don't deselect the image - keep it selected
    setIsDragging(false);
    setIsResizing(false);
    setLastTouchDistance(0);
  }, [isDragging, isResizing]);

  // Handle background tap to deselect
  const handleBackgroundTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (e.target === containerRef.current) {
      // Add a small delay to prevent accidental deselection
      setTimeout(() => {
        setSelectedImage(null);
      }, 100);
    }
  }, []);

  // Handle delete button click
  const handleDeleteClick = useCallback(async (e: React.MouseEvent | React.TouchEvent, imageKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (window.confirm('Delete this image?')) {
      setIsProcessing(true);
      try {
        const imageIndex = Object.keys(imagePositions).indexOf(imageKey);
        onImageDelete(imageIndex);
        setSelectedImage(null); // Deselect after deletion
      } catch (error) {
        console.error('Failed to delete image:', error);
      } finally {
        setIsProcessing(false);
      }
    }
  }, [onImageDelete, imagePositions]);

  // Handle rotate button click
  const handleRotateClick = useCallback(async (e: React.MouseEvent | React.TouchEvent, imageKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsProcessing(true);
    try {
      const newPositions = { ...imagePositions };
      const currentPos = newPositions[imageKey];
      if (currentPos) {
        const currentRotation = currentPos.rotation || 0;
        newPositions[imageKey] = {
          ...currentPos,
          rotation: (currentRotation + 90) % 360
        };
        onImageUpdate(newPositions);
      }
    } catch (error) {
      console.error('Failed to rotate image:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [imagePositions, onImageUpdate]);

  // Handle double tap to deselect
  const handleDoubleTap = useCallback((e: React.TouchEvent, imageKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (selectedImage === imageKey) {
      setSelectedImage(null);
    } else {
      setSelectedImage(imageKey);
    }
  }, [selectedImage]);

  // Track double tap timing
  const [lastTapTime, setLastTapTime] = useState(0);
  const [lastTapImage, setLastTapImage] = useState<string | null>(null);

  const handleTap = useCallback((e: React.TouchEvent, imageKey: string) => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapTime;
    
    if (tapLength < 300 && lastTapImage === imageKey) {
      // Double tap detected
      handleDoubleTap(e, imageKey);
    } else {
      // Single tap - select image
      handleTouchStart(e, imageKey);
    }
    
    setLastTapTime(currentTime);
    setLastTapImage(imageKey);
  }, [lastTapTime, lastTapImage, handleTouchStart, handleDoubleTap]);

  return (
    <div
      ref={containerRef}
      className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl overflow-hidden select-none touch-none mobile-image-editor"
      style={{ width: canvasWidth, height: canvasHeight }}
      onTouchStart={handleBackgroundTap}
      onClick={handleBackgroundTap}
    >
      {/* Instructions */}
      <div className="absolute top-2 left-2 right-2 bg-black/70 text-white text-xs p-3 rounded-lg z-10 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-2">
          <Icons.FaHandPointer className="text-blue-400" />
          <span className="font-medium">Tap to select, drag to move</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <Icons.FaExpandArrowsAlt className="text-green-400" />
          <span className="font-medium">Two fingers to resize</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <Icons.FaRotate className="text-blue-400" />
          <span className="font-medium">Use edit buttons when selected</span>
        </div>
        <div className="flex items-center gap-2">
          <Icons.FaTrash className="text-red-400" />
          <span className="font-medium">Double-tap to deselect</span>
        </div>
      </div>

      {/* Images */}
      {images.map((image, index) => {
        const imageKey = Object.keys(imagePositions)[index];
        const position = imagePositions[imageKey];
        
        if (!position) return null;

        const imageUrl = typeof image === 'string' ? image : URL.createObjectURL(image);
        const isSelected = selectedImage === imageKey;

        return (
          <div
            key={imageKey}
            className={`absolute cursor-move select-none touch-none transition-all duration-200 ${
              isSelected ? 'ring-2 ring-blue-400 ring-opacity-75 selected-image' : ''
            } ${isDragging || isResizing ? 'scale-105 shadow-2xl' : ''} ${
              isSelected ? 'animate-pulse' : ''
            }`}
            style={{
              left: position.x,
              top: position.y,
              width: position.width,
              height: position.height,
              zIndex: isSelected ? 10 : 1,
              transform: position.rotation ? `rotate(${position.rotation}deg)` : 'none'
            }}
            onTouchStart={(e) => handleTap(e, imageKey)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={imageUrl}
              alt={`Image ${index + 1}`}
              className="w-full h-full object-cover rounded-lg"
              draggable={false}
            />
            
            {/* Edit controls - only show when selected */}
            {isSelected && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg backdrop-blur-sm">
                <div className="flex flex-col gap-3 items-center">
                  <div className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded-full">
                    Selected
                  </div>
                  <div className="flex gap-3">
                    {/* Rotate button */}
                    <button
                      onClick={(e) => handleRotateClick(e, imageKey)}
                      className="w-10 h-10 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:bg-blue-300 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-200 touch-manipulation"
                      title="Rotate"
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Icons.FaRotate />
                      )}
                    </button>
                    
                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDeleteClick(e, imageKey)}
                      className="w-10 h-10 bg-red-500 hover:bg-red-600 active:bg-red-700 disabled:bg-red-300 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-200 touch-manipulation"
                      title="Delete"
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Icons.FaTrash />
                      )}
                    </button>
                  </div>
                  <div className="text-white text-xs text-center bg-black/50 px-2 py-1 rounded-full">
                    Double-tap to deselect
                  </div>
                </div>
              </div>
            )}
            
            {/* Selection indicator */}
            {isSelected && (
              <div className="absolute -inset-1 border-2 border-blue-400 border-dashed rounded-lg pointer-events-none" />
            )}
            
            {/* Glow effect for selected images */}
            {isSelected && (
              <div className="absolute -inset-2 bg-blue-400/20 rounded-lg pointer-events-none animate-pulse" />
            )}
          </div>
        );
      })}

      {/* No images message */}
      {images.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-white/50">
          <div className="text-center">
            <Icons.FaImage className="text-4xl mb-2 mx-auto" />
            <p>No images added yet</p>
            <p className="text-sm">Add images above to edit them here</p>
          </div>
        </div>
      )}

      {/* Processing overlay */}
      {isProcessing && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-white font-medium">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileImageEditor;
