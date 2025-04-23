import React, { useState, useEffect } from 'react';

export interface TextColors {
  locationColor: string;
  locationShadowColor: string;
}

interface ColorPickerProps {
  colors: TextColors;
  onChange: (colors: TextColors) => void;
  images?: string[]; // Add images prop to extract colors from
}

export default function SimpleColorPicker({ colors, onChange, images = [] }: ColorPickerProps) {
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);

  // Extract colors from images when the component mounts or images change
  useEffect(() => {
    if (images.length > 0) {
      extractColorsFromImages(images);
    }
  }, [images]);

  // Simplified function to get shadow color
  const getShadowColor = (color: string): string => {
    try {
      // Parse hex color
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      
      // Make it darker
      const newR = Math.floor(r * 0.7);
      const newG = Math.floor(g * 0.7);
      const newB = Math.floor(b * 0.7);
      
      // Convert back to hex
      return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    } catch (e) {
      console.error('Error parsing color', e);
      return '#333333';
    }
  };
  
  // Function to extract dominant colors from images
  const extractColorsFromImages = async (imageUrls: string[]) => {
    setIsExtracting(true);
    const colors: string[] = [];
    
    try {
      for (const imageUrl of imageUrls) {
        if (!imageUrl) continue;
        
        // Create an image element to load the image
        const img = new Image();
        img.crossOrigin = "Anonymous";
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            try {
              // Create a canvas to draw the image
              const canvas = document.createElement('canvas');
              // Use a smaller size for performance
              const size = 100;
              canvas.width = size;
              canvas.height = size;
              
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                resolve();
                return;
              }
              
              // Draw the image on the canvas
              ctx.drawImage(img, 0, 0, size, size);
              
              // Get the image data
              const imageData = ctx.getImageData(0, 0, size, size).data;
              
              // Sample pixels at different locations
              const samplePoints = [
                // Center
                Math.floor(size / 2) * (size * 4) + Math.floor(size / 2) * 4,
                // Top left
                20 * (size * 4) + 20 * 4,
                // Top right
                20 * (size * 4) + (size - 20) * 4,
                // Bottom left
                (size - 20) * (size * 4) + 20 * 4,
                // Bottom right
                (size - 20) * (size * 4) + (size - 20) * 4
              ];
              
              for (const point of samplePoints) {
                if (point >= 0 && point < imageData.length - 4) {
                  const r = imageData[point];
                  const g = imageData[point + 1];
                  const b = imageData[point + 2];
                  
                  // Convert to hex
                  const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                  
                  // Check if the color is not too dark or too light
                  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                  if (brightness > 30 && brightness < 220) {
                    colors.push(hex);
                  }
                }
              }
            } catch (err) {
              console.error("Error processing image:", err);
            }
            resolve();
          };
          
          img.onerror = () => {
            console.error("Failed to load image:", imageUrl);
            resolve();
          };
          
          img.src = imageUrl;
        });
      }
      
      // Remove duplicates and limit to 8 colors
      const uniqueColors = Array.from(new Set(colors));
      setExtractedColors(uniqueColors.slice(0, 8));
    } catch (err) {
      console.error("Error extracting colors:", err);
    }
    
    setIsExtracting(false);
  };
  
  const selectColor = (color: string) => {
    const shadowColor = getShadowColor(color);
    onChange({ 
      locationColor: color, 
      locationShadowColor: shadowColor 
    });
    
    // Force an immediate redraw
    if (window.forceCanvasRedraw) {
      setTimeout(() => window.forceCanvasRedraw?.(), 10);
    }
  };
  
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-4">Choose Title Color</h3>
      
      {/* Image-derived colors */}
      {extractedColors.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm text-gray-500 mb-2">Colors From Your Images</h4>
          <div className="grid grid-cols-4 gap-3">
            {extractedColors.map((color, i) => (
              <button
                key={`image-${i}`}
                className="w-14 h-14 rounded-lg border-2 shadow hover:scale-105 transition-transform"
                style={{ 
                  backgroundColor: color,
                  borderColor: colors.locationColor === color ? 'white' : 'transparent',
                  boxShadow: colors.locationColor === color ? '0 0 0 2px black' : 'none',
                }}
                onClick={() => selectColor(color)}
              />
            ))}
          </div>
        </div>
      )}
      
      {isExtracting && (
        <div className="text-sm text-gray-500 mb-4">
          Extracting colors from your images...
        </div>
      )}
      
      {/* Custom color picker */}
      <div className="mt-4">
        <label className="block text-sm font-medium mb-2">Custom Color</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={colors.locationColor}
            onChange={(e) => selectColor(e.target.value)}
            className="w-12 h-12"
          />
          <div className="flex-1">
            <div>Current: <span className="font-mono">{colors.locationColor}</span></div>
            <div>Shadow: <span className="font-mono">{colors.locationShadowColor}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
