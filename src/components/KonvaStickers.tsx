import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Stage, Layer, Image as KonvaImage, Group, Transformer } from 'react-konva';
import Konva from 'konva';

// Optimize Konva for mobile performance
Konva.pixelRatio = window.devicePixelRatio > 2 ? 2 : window.devicePixelRatio;

// Custom hook for loading images with hardware acceleration
const useImageLoader = (src: string | File | null): [HTMLImageElement | null, boolean] => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }

    setIsLoading(true);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    // Hardware acceleration hints
    img.decoding = 'async';
    
    img.onload = () => {
      setImage(img);
      setIsLoading(false);
    };
    
    img.onerror = () => {
      console.error('Failed to load image:', src);
      setImage(null);
      setIsLoading(false);
    };

    // Load the image
    if (typeof src === 'string') {
      img.src = src;
    } else {
      img.src = URL.createObjectURL(src);
    }

    // Cleanup function
    return () => {
      if (typeof src !== 'string') {
        URL.revokeObjectURL(img.src);
      }
    };
  }, [src]);

  return [image, isLoading];
};

interface StickerData {
  id: string;
  src: string | File;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  originalWidth: number;
  originalHeight: number;
  zIndex: number;
}

interface KonvaStickersProps {
  width: number;
  height: number;
  stickers: StickerData[];
  onStickersChange: (stickers: StickerData[]) => void;
  isEditing?: boolean;
}

// Individual sticker component for optimal performance
const StickerItem: React.FC<{
  sticker: StickerData;
  isSelected: boolean;
  onSelect: () => void;
  onTransform: (attrs: any) => void;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}> = ({ 
  sticker, 
  isSelected, 
  onSelect, 
  onTransform, 
  isDragging,
  onDragStart,
  onDragEnd 
}) => {
  const imageRef = useRef<Konva.Image>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  
  // Load image with hardware-accelerated caching
  const [image, isImageLoading] = useImageLoader(sticker.src);

  // Apply transformer when selected
  useEffect(() => {
    if (isSelected && transformerRef.current && imageRef.current) {
      transformerRef.current.nodes([imageRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  // GoodNotes-style transform handling
  const handleTransform = useCallback(() => {
    const node = imageRef.current;
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    
    // Apply transform and reset scale (GoodNotes approach)
    const newWidth = Math.max(50, node.width() * scaleX);
    const newHeight = Math.max(50, node.height() * scaleY);
    
    onTransform({
      x: node.x(),
      y: node.y(),
      width: newWidth,
      height: newHeight,
      rotation: node.rotation(),
      scaleX: newWidth / sticker.originalWidth,
      scaleY: newHeight / sticker.originalHeight,
    });
    
    // Reset scale to 1 (apply scale to dimensions instead)
    node.scaleX(1);
    node.scaleY(1);
    node.width(newWidth);
    node.height(newHeight);
  }, [onTransform, sticker.originalWidth, sticker.originalHeight]);

  // Don't render if image is not loaded yet
  if (!image || isImageLoading) {
    return null;
  }

  return (
    <Group>
      <KonvaImage
        ref={imageRef}
        image={image}
        x={sticker.x}
        y={sticker.y}
        width={sticker.width}
        height={sticker.height}
        rotation={sticker.rotation}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onTransform={handleTransform}
        onTransformEnd={handleTransform}
        // GoodNotes-style performance optimizations
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
        hitStrokeWidth={0}
        // Hardware acceleration hints
        transformsEnabled="all"
        listening={true}
        // High-quality rendering during static state
        imageSmoothingEnabled={!isDragging}
        // Mobile-optimized touch handling
        {...(window.innerWidth <= 768 && {
          hitFunc: function(context: any, shape: any) {
            // Larger hit area for mobile
            context.beginPath();
            context.rect(-10, -10, shape.width() + 20, shape.height() + 20);
            context.closePath();
            context.fillStrokeShape(shape);
          }
        })}
      />
      {isSelected && (
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            // Minimum size constraint
            if (newBox.width < 50 || newBox.height < 50) {
              return oldBox;
            }
            return newBox;
          }}
          // GoodNotes-style transformer styling
          borderStroke="#0066cc"
          borderStrokeWidth={2}
          anchorStroke="#0066cc"
          anchorStrokeWidth={2}
          anchorFill="white"
          anchorSize={12}
          enabledAnchors={[
            'top-left',
            'top-right', 
            'bottom-left',
            'bottom-right'
          ]}
          rotateEnabled={true}
          rotationSnaps={[0, 90, 180, 270]}
          // Performance optimizations
          shouldOverdrawWholeArea={false}
          ignoreStroke={true}
        />
      )}
    </Group>
  );
};

const KonvaStickers: React.FC<KonvaStickersProps> = ({
  width,
  height,
  stickers,
  onStickersChange,
  isEditing = true
}) => {
  const stageRef = useRef<Konva.Stage>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Memoize stickers for performance
  const memoizedStickers = useMemo(() => stickers, [stickers]);

  // Handle sticker selection
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  // Handle sticker transform
  const handleTransform = useCallback((id: string, attrs: any) => {
    const newStickers = stickers.map(sticker => 
      sticker.id === id 
        ? { ...sticker, ...attrs }
        : sticker
    );
    onStickersChange(newStickers);
  }, [stickers, onStickersChange]);

  // Handle stage click (deselect)
  const handleStageClick = useCallback((e: any) => {
    // Deselect when clicking on empty area
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
    }
  }, []);

  // Performance optimization: batch layer updates
  const batchDraw = useCallback(() => {
    layerRef.current?.batchDraw();
  }, []);

  // GoodNotes-style smooth animations
  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.listening(isEditing);
    }
  }, [isEditing]);

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      onClick={handleStageClick}
      onTap={handleStageClick}
      // Hardware acceleration
      className="konva-stage"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: isEditing ? 'auto' : 'none',
        zIndex: 10
      }}
    >
      <Layer
        ref={layerRef}
        listening={isEditing}
        // Performance optimizations
        clearBeforeDraw={true}
        hitGraphEnabled={isEditing}
        perfectDrawEnabled={false}
      >
        {memoizedStickers.map((sticker) => (
          <StickerItem
            key={sticker.id}
            sticker={sticker}
            isSelected={selectedId === sticker.id}
            onSelect={() => handleSelect(sticker.id)}
            onTransform={(attrs) => handleTransform(sticker.id, attrs)}
            isDragging={isDragging}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => setIsDragging(false)}
          />
        ))}
      </Layer>
    </Stage>
  );
};

export default KonvaStickers;
export type { StickerData }; 