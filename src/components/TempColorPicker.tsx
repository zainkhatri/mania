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
              // Use a larger size for better color sampling
              const size = 200;
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
              
              // Use more sample points across the image for better color detection
              const candidateColors: {hex: string, hsl: {h: number, s: number, l: number}}[] = [];
              
              // Sample more points in a grid pattern
              const gridStep = Math.floor(size / 6); // 6x6 grid sampling
              
              for (let y = gridStep; y < size; y += gridStep) {
                for (let x = gridStep; x < size; x += gridStep) {
                  const point = (y * size + x) * 4;
                  const r = imageData[point];
                  const g = imageData[point + 1];
                  const b = imageData[point + 2];
                  const a = imageData[point + 3];
                  
                  // Skip transparent pixels
                  if (a < 128) continue;
                  
                  // Convert to hex
                  const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                  
                  // Convert RGB to HSL for better color comparison
                  const hsl = rgbToHsl(r, g, b);
                  
                  // Check brightness - exclude very dark or very light colors
                  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                  if (brightness > 40 && brightness < 225) {
                    candidateColors.push({ hex, hsl });
                  }
                }
              }
              
              // Sort and filter colors by uniqueness in HSL space
              const uniqueColors = filterDiverseColors(candidateColors);
              uniqueColors.forEach(color => colors.push(color));
              
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
      
      // Filter for unique, diverse colors
      const diverseColors = selectDiverseColors(colors);
      setExtractedColors(diverseColors.slice(0, 8));
    } catch (err) {
      console.error("Error extracting colors:", err);
    }
    
    setIsExtracting(false);
  };
  
  // Helper function to convert RGB to HSL
  const rgbToHsl = (r: number, g: number, b: number) => {
    r /= 255;
    g /= 255;
    b /= 255;
  
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
  
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      
      h /= 6;
    }
  
    return { h: h * 360, s: s * 100, l: l * 100 };
  };
  
  // Filter to reduce similar colors based on HSL difference
  const filterDiverseColors = (colors: {hex: string, hsl: {h: number, s: number, l: number}}[]) => {
    const result: string[] = [];
    const usedHueRanges: {min: number, max: number}[] = [];
    
    // Group colors by hue segments
    const hueGroups: {[key: string]: {hex: string, hsl: {h: number, s: number, l: number}}[]} = {};
    
    // First, group colors by similar hue (in 30° segments)
    colors.forEach(color => {
      const hueGroup = Math.floor(color.hsl.h / 30);
      if (!hueGroups[hueGroup]) {
        hueGroups[hueGroup] = [];
      }
      hueGroups[hueGroup].push(color);
    });
    
    // Take the most saturated color from each hue group
    Object.values(hueGroups).forEach(group => {
      if (group.length > 0) {
        // Sort by saturation (more saturated is visually more distinctive)
        group.sort((a, b) => b.hsl.s - a.hsl.s);
        result.push(group[0].hex);
      }
    });
    
    return result;
  };
  
  // Select a diverse set of colors from all the candidates
  const selectDiverseColors = (colors: string[]) => {
    // Remove duplicates
    const uniqueColors = Array.from(new Set(colors));
    
    // If we don't have many colors, return what we have
    if (uniqueColors.length <= 8) return uniqueColors;
    
    // Convert to RGB for analysis
    const colorData = uniqueColors.map(hex => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { hex, r, g, b };
    });
    
    // Sort colors by hue to get different color families
    colorData.sort((a, b) => {
      const aHue = rgbToHsl(a.r, a.g, a.b).h;
      const bHue = rgbToHsl(b.r, b.g, b.b).h;
      return aHue - bHue;
    });
    
    // Take an evenly distributed sample from the sorted array
    const result: string[] = [];
    const step = colorData.length / 8;
    
    for (let i = 0; i < 8; i++) {
      const index = Math.min(Math.floor(i * step), colorData.length - 1);
      result.push(colorData[index].hex);
    }
    
    return result;
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
