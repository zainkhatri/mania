import React from 'react';
import { Rnd } from 'react-rnd';

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
  const [aspectRatio, setAspectRatio] = React.useState(1);
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const ratio = img.naturalWidth / img.naturalHeight;
    setAspectRatio(ratio);
    setImageLoaded(true);
  };

  // Preload image to get aspect ratio immediately
  React.useEffect(() => {
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
  }, [src, width, height]);

  // Get the scale factor between canvas and display
  const getScaleFactor = () => {
    const container = containerRef.current?.parentElement;
    if (!container) return 1;
    
    const rect = container.getBoundingClientRect();
    return rect.width / canvasWidth;
  };

  const scaleFactor = getScaleFactor();
  const displayWidth = width * scaleFactor;
  const displayHeight = height * scaleFactor;
  const displayX = x * scaleFactor;
  const displayY = y * scaleFactor;

  return (
    <div ref={containerRef}>
      <Rnd
        key={`${src}-${aspectRatio}-${imageLoaded}`} // Force re-render when aspect ratio changes
        size={{ width: displayWidth, height: displayHeight }}
        position={{ x: displayX, y: displayY }}
        onDragStop={(e, d) => {
          const canvasX = d.x / scaleFactor;
          const canvasY = d.y / scaleFactor;
          onDragStop(canvasX, canvasY);
        }}
        onResizeStop={(e, direction, ref, delta, position) => {
          const newWidth = parseInt(ref.style.width) / scaleFactor;
          const newHeight = parseInt(ref.style.height) / scaleFactor;
          const canvasX = position.x / scaleFactor;
          const canvasY = position.y / scaleFactor;
          onResizeStop(newWidth, newHeight, canvasX, canvasY);
        }}
        bounds="parent"
        lockAspectRatio={aspectRatio}
        minWidth={50}
        minHeight={50}
        enableResizing={isSelected}
        disableDragging={!isSelected}
        style={{
          border: isSelected ? '2px solid #007AFF' : 'none',
          borderRadius: '4px',
        }}
        resizeHandleStyles={{
          bottomRight: {
            bottom: '-10px',
            right: '-10px',
            width: '20px',
            height: '20px',
            backgroundColor: '#007AFF',
            border: '2px solid white',
            borderRadius: '50%',
            cursor: 'se-resize',
          },
          topLeft: {
            top: '-10px',
            left: '-10px',
            width: '20px',
            height: '20px',
            backgroundColor: '#007AFF',
            border: '2px solid white',
            borderRadius: '50%',
            cursor: 'nw-resize',
          },
          topRight: {
            top: '-10px',
            right: '-10px',
            width: '20px',
            height: '20px',
            backgroundColor: '#007AFF',
            border: '2px solid white',
            borderRadius: '50%',
            cursor: 'ne-resize',
          },
          bottomLeft: {
            bottom: '-10px',
            left: '-10px',
            width: '20px',
            height: '20px',
            backgroundColor: '#007AFF',
            border: '2px solid white',
            borderRadius: '50%',
            cursor: 'sw-resize',
          },
        }}
        onClick={onSelect}
      >
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <img
          ref={imgRef}
          src={src}
          alt="Draggable"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
          onLoad={handleImageLoad}
          draggable={false}
        />
        
        {/* Delete button - only show when selected */}
        {isSelected && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{
              position: 'absolute',
              top: '-12px',
              right: '-12px',
              width: '24px',
              height: '24px',
              backgroundColor: '#ff4444',
              color: 'white',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 'bold',
              zIndex: 1000,
            }}
          >
            ×
          </button>
        )}
      </div>
    </Rnd>
    </div>
  );
};

export default DraggableResizableImage; 