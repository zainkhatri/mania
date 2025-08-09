import React, { useRef, useState, useEffect, useCallback } from 'react';

interface DraggableResizableImageProps {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  onDragStop: (x: number, y: number) => void;
  onResizeStop: (width: number, height: number, x: number, y: number) => void;
  onSelect: () => void;
  onDelete: () => void;
  isSelected: boolean;
  canvasWidth: number;
  canvasHeight: number;
}

const DraggableResizableImage: React.FC<DraggableResizableImageProps> = ({
  src,
  x,
  y,
  width,
  height,
  onDragStop,
  onResizeStop,
  onSelect,
  onDelete,
  isSelected,
  canvasWidth,
  canvasHeight,
}) => {
  const [aspectRatio, setAspectRatio] = useState(1);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Preload image to get aspect ratio
  useEffect(() => {
    if (src) {
      const img = new Image();
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        setAspectRatio(ratio);
        setImageLoaded(true);
      };
      img.onerror = () => {
        setAspectRatio(1);
        setImageLoaded(true);
      };
      img.src = src;
    }
  }, [src]);

  // Get scale factor between canvas and display
  const getScaleFactor = useCallback(() => {
    const container = containerRef.current?.parentElement;
    if (!container) return 1;
    
    const rect = container.getBoundingClientRect();
    return rect.width / canvasWidth;
  }, [canvasWidth]);

  const scaleFactor = getScaleFactor();
  const displayWidth = width * scaleFactor;
  const displayHeight = height * scaleFactor;
  const displayX = x * scaleFactor;
  const displayY = y * scaleFactor;

  // Get coordinates from touch or mouse event
  const getEventCoords = useCallback((e: any) => {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    } else {
      return { x: e.clientX || 0, y: e.clientY || 0 };
    }
  }, []);

  // Handle start of touch/mouse interaction
  const handleStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const coords = getEventCoords(e);
    const relativeX = coords.x - rect.left;
    const relativeY = coords.y - rect.top;

    // Larger touch targets for mobile
    const resizeHandleSize = isMobile ? 40 : 20;
    const isInResizeHandle = 
      relativeX >= displayWidth - resizeHandleSize && 
      relativeY >= displayHeight - resizeHandleSize;

    if (isInResizeHandle && isSelected) {
      setIsResizing(true);
      setResizeStart({
        x: relativeX,
        y: relativeY,
        width: displayWidth,
        height: displayHeight
      });
    } else {
      setIsDragging(true);
      setDragOffset({
        x: relativeX - displayX,
        y: relativeY - displayY
      });
    }

    onSelect();
  }, [displayX, displayY, displayWidth, displayHeight, isSelected, onSelect, getEventCoords, isMobile]);

  // Handle move during touch/mouse interaction
  const handleMove = useCallback((e: TouchEvent | MouseEvent) => {
    if (!isDragging && !isResizing) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const coords = getEventCoords(e);
    const relativeX = coords.x - rect.left;
    const relativeY = coords.y - rect.top;

    if (isDragging) {
      const newX = (relativeX - dragOffset.x) / scaleFactor;
      const newY = (relativeY - dragOffset.y) / scaleFactor;
      
      // Constrain to canvas bounds
      const constrainedX = Math.max(0, Math.min(canvasWidth - width, newX));
      const constrainedY = Math.max(0, Math.min(canvasHeight - height, newY));
      
      onDragStop(constrainedX, constrainedY);
    } else if (isResizing) {
      const deltaX = relativeX - resizeStart.x;
      const deltaY = relativeY - resizeStart.y;
      
      // Use the larger delta to maintain aspect ratio
      const delta = Math.max(deltaX, deltaY);
      const newDisplayWidth = Math.max(50 * scaleFactor, resizeStart.width + delta);
      const newDisplayHeight = newDisplayWidth / aspectRatio;
      
      const newWidth = newDisplayWidth / scaleFactor;
      const newHeight = newDisplayHeight / scaleFactor;
      
      // Constrain to canvas bounds
      const maxWidth = canvasWidth - x;
      const maxHeight = canvasHeight - y;
      const constrainedWidth = Math.min(newWidth, maxWidth);
      const constrainedHeight = Math.min(newHeight, maxHeight);
      
      onResizeStop(constrainedWidth, constrainedHeight, x, y);
    }
  }, [isDragging, isResizing, dragOffset, scaleFactor, canvasWidth, canvasHeight, width, height, onDragStop, onResizeStop, resizeStart, aspectRatio, x, y, getEventCoords]);

  // Handle end of touch/mouse interaction
  const handleEnd = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  // Add event listeners for move and end events
  useEffect(() => {
    if (isDragging || isResizing) {
      const handleTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        handleMove(e);
      };
      
      const handleMouseMove = (e: MouseEvent) => {
        e.preventDefault();
        handleMove(e);
      };

      // Add both touch and mouse events
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('touchend', handleEnd);
      document.addEventListener('mouseup', handleEnd);
      
      return () => {
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('touchend', handleEnd);
        document.removeEventListener('mouseup', handleEnd);
      };
    }
  }, [isDragging, isResizing, handleMove, handleEnd]);

  // Handle delete button click
  const handleDeleteClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete();
  }, [onDelete]);

  // Handle hover states (desktop only)
  const handleMouseEnter = useCallback(() => {
    if (!isMobile) setIsHovered(true);
  }, [isMobile]);

  const handleMouseLeave = useCallback(() => {
    if (!isMobile) setIsHovered(false);
  }, [isMobile]);

  // Mobile-specific sizes
  const deleteButtonSize = isMobile ? 28 : 20;
  const resizeHandleSize = isMobile ? 20 : 16;

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'absolute',
        left: displayX,
        top: displayY,
        width: displayWidth,
        height: displayHeight,
        cursor: isSelected ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
        userSelect: 'none',
        touchAction: 'none',
        transition: isDragging || isResizing ? 'none' : 'all 0.2s ease',
        transform: isDragging || isResizing ? 'scale(1.02)' : 'scale(1)',
        zIndex: isSelected ? 1000 : 1,
      }}
      onTouchStart={handleStart}
      onMouseDown={!isMobile ? handleStart : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Image */}
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <img
          ref={imgRef}
          src={src}
          alt="Draggable"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
            borderRadius: '6px',
            filter: isDragging || isResizing ? 'brightness(1.1)' : 'none',
          }}
          draggable={false}
        />
        
        {/* Selection border - enhanced for mobile */}
        {isSelected && (
          <div
            style={{
              position: 'absolute',
              top: '-3px',
              left: '-3px',
              right: '-3px',
              bottom: '-3px',
              border: isMobile ? '4px solid #007AFF' : '3px solid #007AFF',
              borderRadius: '8px',
              pointerEvents: 'none',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.8)',
            }}
          />
        )}
        
        {/* Hover border (desktop only) */}
        {isHovered && !isSelected && !isMobile && (
          <div
            style={{
              position: 'absolute',
              top: '-2px',
              left: '-2px',
              right: '-2px',
              bottom: '-2px',
              border: '2px solid rgba(0,122,255,0.5)',
              borderRadius: '6px',
              pointerEvents: 'none',
            }}
          />
        )}
        
        {/* Delete button - larger for mobile */}
        {isSelected && (
          <button
            onTouchStart={handleDeleteClick}
            onClick={!isMobile ? handleDeleteClick : undefined}
            style={{
              position: 'absolute',
              top: '-10px',
              right: '-10px',
              width: `${deleteButtonSize}px`,
              height: `${deleteButtonSize}px`,
              backgroundColor: '#ff4444',
              color: 'white',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isMobile ? '16px' : '12px',
              fontWeight: 'bold',
              zIndex: 1000,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              transition: 'all 0.2s ease',
              touchAction: 'manipulation',
            }}
          >
            ×
          </button>
        )}
        
        {/* Resize handle - larger for mobile */}
        {isSelected && (
          <div
            style={{
              position: 'absolute',
              bottom: '-8px',
              right: '-8px',
              width: `${resizeHandleSize}px`,
              height: `${resizeHandleSize}px`,
              backgroundColor: '#007AFF',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'nwse-resize',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              transition: 'all 0.2s ease',
              zIndex: 1001,
              touchAction: 'none',
            }}
          />
        )}
      </div>
    </div>
  );
};

export default DraggableResizableImage; 