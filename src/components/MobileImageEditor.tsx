import React, { useState, useRef, useCallback, useEffect } from 'react';

// Icons component
const Icons = {
  FaHandPointer: ({ className }: { className?: string }) => <span className={`text-lg ${className || ''}`}>👆</span>,
  FaExpandArrowsAlt: ({ className }: { className?: string }) => <span className={`text-lg ${className || ''}`}>🔀</span>,
  FaTrash: ({ className }: { className?: string }) => <span className={`text-lg ${className || ''}`}>🗑️</span>,
  FaImage: ({ className }: { className?: string }) => <span className={`text-lg ${className || ''}`}>🖼️</span>,
};

interface ImagePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MobileImageEditorProps {
  images: (string | Blob)[];
  imagePositions: Record<string, ImagePosition>;
  onImageUpdate: (positions: Record<string, ImagePosition>) => void;
  onImageDelete: (index: number) => void;
  canvasWidth: number;
  canvasHeight: number;
}

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

    console.log('Touch start:', { imageKey, x, y, clientX: touch.clientX, clientY: touch.clientY });

    setSelectedImage(imageKey);
    setTouchStart({ x, y });
    setDragStart({ x, y });
    setResizeStart({ 
      x: imagePositions[imageKey]?.x || 0, 
      y: imagePositions[imageKey]?.y || 0,
      width: imagePositions[imageKey]?.width || 100,
      height: imagePositions[imageKey]?.height || 100
    });

    if (e.touches.length === 2) {
      setLastTouchDistance(getTouchDistance(e.touches));
    }
  }, [imagePositions]);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedImage || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    if (e.touches.length === 1) {
      // Single touch - move image
      const deltaX = x - touchStart.x;
      const deltaY = y - touchStart.y;

      console.log('Touch move:', { deltaX, deltaY, x, y, touchStart });

      const newPositions = { ...imagePositions };
      const currentPos = newPositions[selectedImage];
      if (currentPos) {
        const newX = Math.max(0, Math.min(canvasWidth - currentPos.width, currentPos.x + deltaX));
        const newY = Math.max(0, Math.min(canvasHeight - currentPos.height, currentPos.y + deltaY));
        
        newPositions[selectedImage] = {
          ...currentPos,
          x: newX,
          y: newY
        };
        onImageUpdate(newPositions);
      }
    } else if (e.touches.length === 2) {
      // Two touches - resize image
      const currentDistance = getTouchDistance(e.touches);
      if (lastTouchDistance > 0) {
        const scale = currentDistance / lastTouchDistance;
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
          onImageUpdate(newPositions);
        }
      }
      setLastTouchDistance(currentDistance);
    }
  }, [selectedImage, imagePositions, touchStart, lastTouchDistance, canvasWidth, canvasHeight, onImageUpdate]);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    setSelectedImage(null);
    setIsDragging(false);
    setIsResizing(false);
    setLastTouchDistance(0);
  }, []);

  // Handle long press for delete
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  const handleLongPress = useCallback((imageKey: string) => {
    setLongPressTimer(setTimeout(() => {
      if (window.confirm('Delete this image?')) {
        const imageIndex = Object.keys(imagePositions).indexOf(imageKey);
        onImageDelete(imageIndex);
      }
    }, 1000));
  }, [onImageDelete, imagePositions]);

  const handleTouchStartWithLongPress = useCallback((e: React.TouchEvent, imageKey: string) => {
    handleTouchStart(e, imageKey);
    handleLongPress(imageKey);
  }, [handleTouchStart, handleLongPress]);

  const handleTouchEndWithLongPress = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    handleTouchEnd();
  }, [longPressTimer, handleTouchEnd]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
    };
  }, [longPressTimer]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl overflow-hidden select-none touch-none"
      style={{ width: canvasWidth, height: canvasHeight }}
      onTouchStart={(e) => e.preventDefault()}
      onTouchMove={(e) => e.preventDefault()}
    >
      {/* Instructions */}
      <div className="absolute top-2 left-2 right-2 bg-black/50 text-white text-xs p-2 rounded-lg z-10">
        <div className="flex items-center gap-2 mb-1">
          <Icons.FaHandPointer className="text-blue-400" />
          <span>Tap and drag to move</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <Icons.FaExpandArrowsAlt className="text-green-400" />
          <span>Two fingers to resize</span>
        </div>
        <div className="flex items-center gap-2">
          <Icons.FaTrash className="text-red-400" />
          <span>Long press to delete</span>
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
            className={`absolute cursor-move select-none touch-none ${isSelected ? 'ring-2 ring-blue-400 ring-opacity-75' : ''}`}
            style={{
              left: position.x,
              top: position.y,
              width: position.width,
              height: position.height,
              zIndex: isSelected ? 10 : 1
            }}
            onTouchStart={(e) => handleTouchStartWithLongPress(e, imageKey)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEndWithLongPress}
          >
            <img
              src={imageUrl}
              alt={`Image ${index + 1}`}
              className="w-full h-full object-cover rounded-lg"
              draggable={false}
            />
            
            {/* Resize handles */}
            {isSelected && (
              <>
                <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-400 rounded-full border-2 border-white" />
                <div className="absolute -top-2 -left-2 w-4 h-4 bg-green-400 rounded-full border-2 border-white" />
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-400 rounded-full border-2 border-white" />
              </>
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
    </div>
  );
};

export default MobileImageEditor;
