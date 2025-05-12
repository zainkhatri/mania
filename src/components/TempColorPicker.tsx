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
  const getShadowColor = (color: string, darknessLevel: number = 0.7): string => {
    try {
      // Parse hex color
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      
      // Make it darker based on the darkness level
      const newR = Math.floor(r * darknessLevel);
      const newG = Math.floor(g * darknessLevel);
      const newB = Math.floor(b * darknessLevel);
      
      // Convert back to hex
      return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    } catch (e) {
      console.error('Error parsing color', e);
      return '#333333';
    }
  };
  
  // Function to calculate color difference (Delta E)
  const calculateColorDifference = (color1: {r: number, g: number, b: number}, color2: {r: number, g: number, b: number}): number => {
    // Use a more perceptually accurate color difference formula (CIE76 Delta E)
    const rMean = (color1.r + color2.r) / 2;
    const rDiff = color1.r - color2.r;
    const gDiff = color1.g - color2.g;
    const bDiff = color1.b - color2.b;
    
    // Weighted differences based on human perception
    return Math.sqrt(
      (2 + rMean / 256) * Math.pow(rDiff, 2) + 
      4 * Math.pow(gDiff, 2) + 
      (2 + (255 - rMean) / 256) * Math.pow(bDiff, 2)
    );
  };
  
  // Function to extract dominant colors from images
  const extractColorsFromImages = async (imageUrls: string[]) => {
    setIsExtracting(true);
    const allColorCandidates: {hex: string, hsl: {h: number, s: number, l: number}, rgb: {r: number, g: number, b: number}, source: 'image' | 'generated'}[] = [];
    
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
              const size = Math.max(300, Math.min(img.width, img.height));
              canvas.width = size;
              canvas.height = size;
              
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                resolve();
                return;
              }
              
              // Draw the image on the canvas - centered and scaled to fit
              const scale = size / Math.max(img.width, img.height);
              const scaledWidth = img.width * scale;
              const scaledHeight = img.height * scale;
              const offsetX = (size - scaledWidth) / 2;
              const offsetY = (size - scaledHeight) / 2;
              
              ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
              
              // Get the image data
              const imageData = ctx.getImageData(0, 0, size, size).data;
              
              // Extract colors using adaptive sampling
              // More pixels for larger images, fewer for smaller ones
              const sampleCount = Math.max(500, Math.min(2000, img.width * img.height / 100));
              const candidateColors: {hex: string, hsl: {h: number, s: number, l: number}, rgb: {r: number, g: number, b: number}, source: 'image' | 'generated'}[] = [];
              
              // Sample different areas of the image
              // Use multiple strategies to find meaningful colors:
              
              // 1. Grid sampling - regular grid across the image
              const gridStep = Math.floor(Math.sqrt(size * size / (sampleCount * 0.5)));
              for (let y = 0; y < size; y += gridStep) {
                for (let x = 0; x < size; x += gridStep) {
                  const point = (y * size + x) * 4;
                  const r = imageData[point];
                  const g = imageData[point + 1];
                  const b = imageData[point + 2];
                  const a = imageData[point + 3];
                  
                  // Skip transparent or near-transparent pixels
                  if (a < 200) continue;
                  
                  // Convert to hex
                  const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                  
                  // Convert RGB to HSL for better color analysis
                  const hsl = rgbToHsl(r, g, b);
                  
                  // Store RGB values for color difference calculation
                  const rgb = { r, g, b };
                  
                  // Keep all colors except pure black/white/gray
                  // Skip very desaturated colors (grays)
                  if (hsl.s > 5) {
                    candidateColors.push({ hex, hsl, rgb, source: 'image' });
                  }
                }
              }
              
              // 2. Edge detection - sample pixels near edges for more interesting colors
              // Simple edge detection by looking for color changes
              for (let y = 1; y < size - 1; y += gridStep) {
                for (let x = 1; x < size - 1; x += gridStep) {
                  const pointC = (y * size + x) * 4;  // Center pixel
                  const pointL = (y * size + (x-1)) * 4;  // Left pixel
                  const pointR = (y * size + (x+1)) * 4;  // Right pixel
                  const pointT = ((y-1) * size + x) * 4;  // Top pixel
                  const pointB = ((y+1) * size + x) * 4;  // Bottom pixel
                  
                  // Calculate color differences between center and neighbors
                  const diffL = Math.abs(imageData[pointC] - imageData[pointL]) + 
                              Math.abs(imageData[pointC+1] - imageData[pointL+1]) + 
                              Math.abs(imageData[pointC+2] - imageData[pointL+2]);
                              
                  const diffR = Math.abs(imageData[pointC] - imageData[pointR]) + 
                              Math.abs(imageData[pointC+1] - imageData[pointR+1]) + 
                              Math.abs(imageData[pointC+2] - imageData[pointR+2]);
                              
                  const diffT = Math.abs(imageData[pointC] - imageData[pointT]) + 
                              Math.abs(imageData[pointC+1] - imageData[pointT+1]) + 
                              Math.abs(imageData[pointC+2] - imageData[pointT+2]);
                              
                  const diffB = Math.abs(imageData[pointC] - imageData[pointB]) + 
                              Math.abs(imageData[pointC+1] - imageData[pointB+1]) + 
                              Math.abs(imageData[pointC+2] - imageData[pointB+2]);
                  
                  // If this is an edge pixel (big color difference), sample it
                  if (diffL > 30 || diffR > 30 || diffT > 30 || diffB > 30) {
                    const r = imageData[pointC];
                    const g = imageData[pointC+1];
                    const b = imageData[pointC+2];
                    const a = imageData[pointC+3];
                    
                    // Skip transparent pixels
                    if (a < 200) continue;
                    
                    // Convert to hex
                    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                    
                    // Convert RGB to HSL for better color analysis
                    const hsl = rgbToHsl(r, g, b);
                    
                    // Store RGB values for color difference calculation
                    const rgb = { r, g, b };
                    
                    // Keep colors that have some saturation
                    if (hsl.s > 5) {
                      candidateColors.push({ hex, hsl, rgb, source: 'image' });
                    }
                  }
                }
              }
              
              // Group similar colors to find dominant ones
              // This reduces the number of near-duplicates
              const groupedColors: typeof candidateColors = [];
              const GROUPING_THRESHOLD = 25; // Threshold for considering colors as similar
              
              for (const color of candidateColors) {
                // Check if this color is similar to any in our grouped colors
                let foundSimilar = false;
                
                for (const groupedColor of groupedColors) {
                  const distance = calculateColorDifference(color.rgb, groupedColor.rgb);
                  if (distance < GROUPING_THRESHOLD) {
                    foundSimilar = true;
                    break;
                  }
                }
                
                // If no similar color was found, add this to our grouped colors
                if (!foundSimilar) {
                  groupedColors.push(color);
                }
              }
              
              // Add the candidate colors to our pool
              allColorCandidates.push(...groupedColors);
              
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
      
      // Create a palette with maximum color diversity, prioritizing image colors
      const finalColors = createDiversePalette(allColorCandidates, 12);
      setExtractedColors(finalColors);
      
    } catch (err) {
      console.error("Error extracting colors:", err);
      
      // Fallback to ensure we always have 12 diverse colors
      const fallbackColors = [
        '#E74C3C', // Red
        '#3498DB', // Blue
        '#2ECC71', // Green
        '#F1C40F', // Yellow
        '#9B59B6', // Purple
        '#E67E22', // Orange
        '#1ABC9C', // Teal
        '#34495E', // Navy
        '#D35400', // Dark Orange
        '#27AE60', // Emerald
        '#7F8C8D', // Gray
        '#C0392B'  // Dark Red
      ];
      setExtractedColors(fallbackColors);
    }
    
    setIsExtracting(false);
  };
  
  // Create a diverse palette with good color distribution
  const createDiversePalette = (
    candidates: {hex: string, hsl: {h: number, s: number, l: number}, rgb: {r: number, g: number, b: number}, source?: 'image' | 'generated'}[],
    paletteSize: number
  ): string[] => {
    if (candidates.length === 0) {
      return getDefaultColors(paletteSize);
    }
    
    // Define color segments for better distribution
    const HUE_SEGMENTS = [
      { name: 'reds', min: 355, max: 10 },
      { name: 'oranges', min: 10, max: 45 },
      { name: 'yellows', min: 45, max: 70 },
      { name: 'yellowGreens', min: 70, max: 100 },
      { name: 'greens', min: 100, max: 150 },
      { name: 'teals', min: 150, max: 195 },
      { name: 'cyans', min: 195, max: 220 },
      { name: 'blues', min: 220, max: 260 },
      { name: 'purples', min: 260, max: 290 },
      { name: 'magentas', min: 290, max: 330 },
      { name: 'pinkReds', min: 330, max: 355 }
    ];
    
    // Remove exact duplicates
    const uniqueColors = Array.from(new Map(candidates.map(c => [c.hex, c])).values());
    
    // Sort candidates into hue segments
    const segmentedColors: Record<string, typeof candidates> = {};
    HUE_SEGMENTS.forEach(segment => {
      segmentedColors[segment.name] = [];
    });
    
    // Group colors by hue segments
    uniqueColors.forEach(color => {
      let h = color.hsl.h;
      
      // More lenient filtering - keep more image colors
      // Skip only extremely dark/light or extremely desaturated colors
      if (color.hsl.l < 5 || color.hsl.l > 95 || color.hsl.s < 3) return;
      
      // Find which segment this color belongs to
      for (const segment of HUE_SEGMENTS) {
        if (segment.min > segment.max) {
          // Handle segments that wrap around 360 (e.g. reds)
          if (h >= segment.min || h <= segment.max) {
            segmentedColors[segment.name].push(color);
            break;
          }
        } else if (h >= segment.min && h <= segment.max) {
          segmentedColors[segment.name].push(color);
          break;
        }
      }
    });
    
    // First, prioritize getting at least one color from each segment
    const primarySelections: typeof candidates = [];
    
    // For each segment, get the most representative color
    Object.entries(segmentedColors).forEach(([segmentName, colors]) => {
      if (colors.length === 0) return;
      
      // Sort colors by saturation (most saturated first)
      colors.sort((a, b) => b.hsl.s - a.hsl.s);
      
      // Prioritize image colors over generated ones
      const imageColors = colors.filter(c => c.source === 'image' || !c.source);
      if (imageColors.length > 0) {
        // Select most saturated image color
        primarySelections.push(imageColors[0]);
      } else if (colors.length > 0) {
        // Fall back to most saturated generated color if no image colors
        primarySelections.push(colors[0]);
      }
    });
    
    // Now select the most diverse set from our representatives
    const selectedColors: {hex: string, rgb: {r: number, g: number, b: number}, source?: 'image' | 'generated'}[] = [];
    
    // Higher priority for image-sourced colors
    primarySelections.sort((a, b) => {
      // First sort by source (image colors first)
      if ((a.source === 'image' || !a.source) && (b.source !== 'image' && b.source)) return -1;
      if ((b.source === 'image' || !b.source) && (a.source !== 'image' && a.source)) return 1;
      
      // Then by saturation
      return b.hsl.s - a.hsl.s;
    });
    
    // Select diverse colors, but prioritizing image-derived ones
    // Use a greedy algorithm that considers both diversity and source
    const MINIMUM_DIFFERENCE = 70; // Use a more moderate difference threshold to include more image colors
    
    for (const candidate of primarySelections) {
      // Skip if we already have enough colors
      if (selectedColors.length >= paletteSize) break;
      
      // Check if this color is distinct enough from already selected colors
      let isDistinct = true;
      for (const selected of selectedColors) {
        const distance = calculateColorDifference(candidate.rgb, selected.rgb);
        if (distance < MINIMUM_DIFFERENCE) {
          isDistinct = false;
          break;
        }
      }
      
      // Add color if it's distinct
      if (isDistinct) {
        selectedColors.push({
          hex: candidate.hex,
          rgb: candidate.rgb,
          source: candidate.source
        });
      }
    }
    
    // If we don't have enough colors, go through all candidates to find more
    if (selectedColors.length < paletteSize) {
      // Create a flat list of all colors
      const allCandidates = uniqueColors.filter(c => {
        // Remove colors that are too similar to selected ones
        for (const selected of selectedColors) {
          const distance = calculateColorDifference(c.rgb, selected.rgb);
          if (distance < MINIMUM_DIFFERENCE) return false;
        }
        return true;
      });
      
      // Sort candidates prioritizing image colors and saturation
      allCandidates.sort((a, b) => {
        // First sort by source (image colors first)
        if ((a.source === 'image' || !a.source) && (b.source !== 'image' && b.source)) return -1;
        if ((b.source === 'image' || !b.source) && (a.source !== 'image' && a.source)) return 1;
        
        // Then by saturation
        return b.hsl.s - a.hsl.s;
      });
      
      // Add as many additional colors as needed
      const needed = paletteSize - selectedColors.length;
      for (let i = 0; i < Math.min(needed, allCandidates.length); i++) {
        selectedColors.push({
          hex: allCandidates[i].hex,
          rgb: allCandidates[i].rgb,
          source: allCandidates[i].source
        });
      }
    }
    
    // If we still don't have enough colors, add generated colors from missing segments
    if (selectedColors.length < paletteSize) {
      // Find which hue segments are not represented
      const existingHues = selectedColors.map(c => {
        const hex = c.hex;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return rgbToHsl(r, g, b).h;
      });
      
      const missingSegments = HUE_SEGMENTS.filter(segment => {
        return !existingHues.some(h => {
          if (segment.min > segment.max) {
            return h >= segment.min || h <= segment.max;
          }
          return h >= segment.min && h <= segment.max;
        });
      });
      
      // Generate colors for missing segments
      const additionalColors: string[] = [];
      
      missingSegments.forEach(segment => {
        if (selectedColors.length + additionalColors.length >= paletteSize) return;
        
        // Generate a color in the middle of the segment
        let hue = (segment.min + segment.max) / 2;
        if (hue > 360) hue -= 360;
        
        // Create a very saturated color
        const rgb = hslToRgb(hue, 75, 55);
        const hex = `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`;
        
        additionalColors.push(hex);
      });
      
      // If we still need more colors, add some from default palette
      if (selectedColors.length + additionalColors.length < paletteSize) {
        const defaultColors = getDefaultColors(paletteSize * 2);
        const needed = paletteSize - (selectedColors.length + additionalColors.length);
        
        // Filter defaults that are different enough from our selected colors
        const filteredDefaults = defaultColors.filter(defaultColor => {
          const r = parseInt(defaultColor.slice(1, 3), 16);
          const g = parseInt(defaultColor.slice(3, 5), 16);
          const b = parseInt(defaultColor.slice(5, 7), 16);
          
          return !selectedColors.some(selected => {
            const diff = calculateColorDifference(
              { r, g, b },
              selected.rgb
            );
            return diff < MINIMUM_DIFFERENCE;
          });
        });
        
        // Add needed colors
        additionalColors.push(...filteredDefaults.slice(0, needed));
      }
      
      // Combine selected and additional colors
      const finalHexColors = [...selectedColors.map(c => c.hex), ...additionalColors];
      return finalHexColors.slice(0, paletteSize);
    }
    
    return selectedColors.map(c => c.hex);
  };
  
  // Get a preset palette of diverse colors for fallback
  const getDefaultColors = (count: number = 12): string[] => {
    const defaultPalette = [
      '#E74C3C', // Bright Red
      '#3498DB', // Bright Blue
      '#2ECC71', // Emerald Green
      '#F1C40F', // Bright Yellow
      '#9B59B6', // Purple
      '#E67E22', // Orange
      '#1ABC9C', // Turquoise
      '#34495E', // Dark Blue
      '#CB4335', // Dark Red
      '#16A085', // Dark Teal
      '#8E44AD', // Violet
      '#D35400', // Dark Orange
      '#27AE60', // Medium Green
      '#2980B9', // Medium Blue
      '#F39C12', // Medium Orange
      '#7D3C98', // Medium Purple
      '#C0392B', // Crimson
      '#196F3D', // Forest Green
      '#A569BD', // Light Purple
      '#5DADE2'  // Light Blue
    ];
    
    return defaultPalette.slice(0, count);
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
  
  // Helper function to convert HSL to RGB
  const hslToRgb = (h: number, s: number, l: number) => {
    h /= 360;
    s /= 100;
    l /= 100;
    
    let r, g, b;
    
    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  };
  
  // Add shadow effect customization
  const [shadowDarkness, setShadowDarkness] = useState<number>(0.7); // Default 0.7 (30% darker)
  const [shadowOffsetX, setShadowOffsetX] = useState<number>(5); 
  const [shadowOffsetY, setShadowOffsetY] = useState<number>(8);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);
  
  // Modified select color to use custom shadow settings
  const selectColor = (color: string) => {
    const shadowColor = getShadowColor(color, shadowDarkness);
    onChange({ 
      locationColor: color, 
      locationShadowColor: shadowColor 
    });
    
    // Force an immediate redraw
    if (window.forceCanvasRedraw) {
      window.shadowOffsetX = shadowOffsetX;
      window.shadowOffsetY = shadowOffsetY;
      window.shadowDarkness = shadowDarkness;
      setTimeout(() => window.forceCanvasRedraw?.(), 10);
    }
  };
  
  // Sort colors by hue for gradient layout
  const sortColorsByHue = (colors: string[]): string[] => {
    return [...colors].sort((a, b) => {
      // Convert colors to HSL for comparison
      const aRGB = {
        r: parseInt(a.slice(1, 3), 16),
        g: parseInt(a.slice(3, 5), 16),
        b: parseInt(a.slice(5, 7), 16)
      };
      
      const bRGB = {
        r: parseInt(b.slice(1, 3), 16),
        g: parseInt(b.slice(3, 5), 16),
        b: parseInt(b.slice(5, 7), 16)
      };
      
      const aHSL = rgbToHsl(aRGB.r, aRGB.g, aRGB.b);
      const bHSL = rgbToHsl(bRGB.r, bRGB.g, bRGB.b);
      
      return aHSL.h - bHSL.h;
    });
  };
  
  // Sort the extracted colors for display
  const sortedColors = sortColorsByHue(extractedColors);
  
  return (
    <div className="p-5 bg-white rounded-lg">
      <h3 className="text-xl font-semibold mb-4 text-gray-800">Choose Title Color</h3>
      
      {/* Image-derived colors */}
      {extractedColors.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm text-gray-600 mb-3 font-medium">Colors From Your Images</h4>
          <div className="grid grid-cols-4 gap-4">
            {sortedColors.map((color, i) => (
              <button
                key={`image-${i}`}
                className={`w-14 h-14 rounded-lg shadow hover:shadow-md transition-all duration-200 ${
                  colors.locationColor === color 
                    ? 'ring-2 ring-offset-2 ring-gray-500 transform scale-105' 
                    : 'hover:scale-105'
                }`}
                style={{
                  backgroundColor: color,
                }}
                onClick={() => selectColor(color)}
                title={color}
              />
            ))}
          </div>
        </div>
      )}
      
      {isExtracting && (
        <div className="text-sm text-gray-500 mb-4 flex items-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Extracting colors from your images...
        </div>
      )}
      
      {/* Custom color picker */}
      <div className="mt-6 pt-5 border-t border-gray-200">
        <label className="block text-sm font-medium mb-3 text-gray-600">Custom Color</label>
        <div className="flex items-center gap-4">
          <input
            type="color"
            value={colors.locationColor}
            onChange={(e) => selectColor(e.target.value)}
            className="w-14 h-14 rounded-lg cursor-pointer border-0 shadow"
            style={{ 
              appearance: 'none',
              padding: 0
            }}
          />
          <div className="flex-1 text-sm">
            <div className="mb-1"><span className="text-gray-600 inline-block w-16">Current:</span> <span className="font-mono">{colors.locationColor}</span></div>
            <div><span className="text-gray-600 inline-block w-16">Shadow:</span> <span className="font-mono">{colors.locationShadowColor}</span></div>
          </div>
        </div>
        
        {/* Advanced Settings Toggle */}
        <button 
          onClick={() => setShowAdvancedSettings(prev => !prev)}
          className="mt-4 text-sm flex items-center text-gray-600 hover:text-gray-800 transition-colors gap-1"
        >
          <span>Advanced Settings</span>
          <svg 
            width="16" 
            height="16" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
            className={`transition-transform duration-200 ${showAdvancedSettings ? 'rotate-180' : ''}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </button>
        
        {/* Shadow Effect Controls - Only shown when advanced settings are expanded */}
        {showAdvancedSettings && (
          <div className="mt-3 space-y-4 pt-3 border-t border-gray-100">
            <h4 className="text-sm font-medium text-gray-700">Shadow Effect</h4>
            
            <div>
              <label className="block text-xs text-gray-500 mb-1">Shadow Darkness: {Math.round((1 - shadowDarkness) * 100)}%</label>
              <input 
                type="range" 
                min="0.4" 
                max="0.9" 
                step="0.05"
                value={shadowDarkness}
                onChange={(e) => {
                  const newValue = parseFloat(e.target.value);
                  setShadowDarkness(newValue);
                  const newShadowColor = getShadowColor(colors.locationColor, newValue);
                  onChange({
                    locationColor: colors.locationColor,
                    locationShadowColor: newShadowColor
                  });
                  
                  if (window.forceCanvasRedraw) {
                    window.shadowDarkness = newValue;
                    setTimeout(() => window.forceCanvasRedraw?.(), 10);
                  }
                }}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">X Offset: {shadowOffsetX}px</label>
                <input 
                  type="range" 
                  min="0" 
                  max="15" 
                  step="1"
                  value={shadowOffsetX}
                  onChange={(e) => {
                    const newValue = parseInt(e.target.value);
                    setShadowOffsetX(newValue);
                    if (window.forceCanvasRedraw) {
                      window.shadowOffsetX = newValue;
                      setTimeout(() => window.forceCanvasRedraw?.(), 10);
                    }
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              
              <div>
                <label className="block text-xs text-gray-500 mb-1">Y Offset: {shadowOffsetY}px</label>
                <input 
                  type="range" 
                  min="0" 
                  max="15" 
                  step="1"
                  value={shadowOffsetY}
                  onChange={(e) => {
                    const newValue = parseInt(e.target.value);
                    setShadowOffsetY(newValue);
                    if (window.forceCanvasRedraw) {
                      window.shadowOffsetY = newValue;
                      setTimeout(() => window.forceCanvasRedraw?.(), 10);
                    }
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
