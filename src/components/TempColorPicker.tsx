import React, { useState, useEffect } from 'react';

export interface TextColors {
  locationColor: string;
  locationShadowColor: string;
}

interface ColorPickerProps {
  colors: TextColors;
  onChange: (colors: TextColors) => void;
  images?: (string | Blob)[]; // Update type to accept both strings and Blobs
}

export default function SimpleColorPicker({ colors, onChange, images = [] }: ColorPickerProps) {
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);

  // Extract colors from images when the component mounts or images change
  useEffect(() => {
    console.log('SimpleColorPicker: Images received:', images.length);
    // Always reset the extracted colors when images prop changes
    setExtractedColors([]);
    
    if (images && images.length > 0) {
      console.log('SimpleColorPicker: Extracting colors from images');
      // Force immediate color extraction with a clean state
      setIsExtracting(true);
      extractColorsFromImages(images);
    } else {
      console.log('SimpleColorPicker: No images available for color extraction');
      // Set default colors when no images are available
      setExtractedColors(getDefaultColors(12));
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
  const extractColorsFromImages = async (imageUrls: (string | Blob)[]) => {
    console.log('Starting color extraction from', imageUrls.length, 'images');
    setIsExtracting(true);
    const allColorCandidates: {hex: string, hsl: {h: number, s: number, l: number}, rgb: {r: number, g: number, b: number}}[] = [];
    
    try {
      if (!imageUrls || imageUrls.length === 0) {
        console.error('No valid images provided for color extraction');
        setIsExtracting(false);
        return;
      }

      for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i];
        if (!imageUrl) {
          console.warn('Empty image URL at index', i);
          continue;
        }
        
        console.log(`Processing image ${i+1}/${imageUrls.length}`);
        
        // Create an image element to load the image
        const img = new Image();
        img.crossOrigin = "Anonymous";
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            try {
              console.log(`Image ${i+1} loaded, size:`, img.width, 'x', img.height);
              // Create a canvas to draw the image
              const canvas = document.createElement('canvas');
              // Use a larger size for better color sampling
              const size = 300; // Increased for better sampling
              canvas.width = size;
              canvas.height = size;
              
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                console.error('Failed to get canvas context for image', i);
                resolve();
                return;
              }
              
              // Draw the image on the canvas
              ctx.drawImage(img, 0, 0, size, size);
              
              // Get the image data
              const imageData = ctx.getImageData(0, 0, size, size).data;
              
              // Use more sample points across the image for better color detection
              const candidateColors: {hex: string, hsl: {h: number, s: number, l: number}, rgb: {r: number, g: number, b: number}}[] = [];
              
              // Sample more points in a grid pattern
              const gridStep = Math.floor(size / 30); // More samples (30x30 grid)
              let colorCount = 0;
              
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
                  
                  // Store RGB values for color difference calculation
                  const rgb = { r, g, b };
                  
                  // Check brightness - exclude very dark or very light colors
                  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                  if (brightness > 30 && brightness < 230) { // Wider range for more colors
                    candidateColors.push({ hex, hsl, rgb });
                    colorCount++;
                  }
                }
              }
              
              console.log(`Found ${colorCount} potential colors in image ${i+1}`);
              // Add the candidate colors to our pool
              allColorCandidates.push(...candidateColors);
              
            } catch (err) {
              console.error("Error processing image:", err, "at index", i);
            }
            resolve();
          };
          
          img.onerror = (e) => {
            console.error("Failed to load image:", imageUrl, "at index", i, "Error:", e);
            resolve();
          };
          
          img.src = imageUrl instanceof Blob ? URL.createObjectURL(imageUrl) : imageUrl;
        });
      }
      
      console.log(`Total color candidates extracted: ${allColorCandidates.length}`);
      if (allColorCandidates.length === 0) {
        console.warn('No colors were extracted from images. Using default colors.');
        setExtractedColors(getDefaultColors(12));
        setIsExtracting(false);
        return;
      }
      
      // Create a palette with maximum color diversity
      const finalColors = createDiversePalette(allColorCandidates, 12);
      console.log('Final colors extracted:', finalColors);
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
    candidates: {hex: string, hsl: {h: number, s: number, l: number}, rgb: {r: number, g: number, b: number}}[],
    paletteSize: number
  ): string[] => {
    if (candidates.length === 0) {
      return getDefaultColors(paletteSize);
    }
    
    // Define color segments for better distribution
    // We'll try to get at least one color from each major segment
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
      
      // Skip very light or very dark colors
      if (color.hsl.l < 15 || color.hsl.l > 85) return;
      
      // Skip colors with very low saturation
      if (color.hsl.s < 15) return;
      
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
    
    // Get representative colors from each segment
    const representatives: typeof candidates = [];
    
    // For each segment, get the most vibrant and distinct colors
    Object.entries(segmentedColors).forEach(([segmentName, colors]) => {
      if (colors.length === 0) return;
      
      // Sort by saturation (most saturated first)
      colors.sort((a, b) => b.hsl.s - a.hsl.s);
      
      // Get the most saturated color
      representatives.push(colors[0]);
      
      // If we have many colors in this segment, also add one with different lightness
      if (colors.length > 3) {
        // Sort remaining colors by lightness
        const remainingColors = colors.slice(1);
        remainingColors.sort((a, b) => {
          // Find the most different lightness from the already selected color
          const lightnessDiffA = Math.abs(a.hsl.l - colors[0].hsl.l);
          const lightnessDiffB = Math.abs(b.hsl.l - colors[0].hsl.l);
          return lightnessDiffB - lightnessDiffA;
        });
        
        // Add a color with very different lightness if it's distinct enough
        if (remainingColors.length > 0 && 
            Math.abs(remainingColors[0].hsl.l - colors[0].hsl.l) > 30 &&
            calculateColorDifference(colors[0].rgb, remainingColors[0].rgb) > 120) {
          representatives.push(remainingColors[0]);
        }
      }
    });
    
    // Now select the most diverse set from our representatives
    const selectedColors: {hex: string, rgb: {r: number, g: number, b: number}}[] = [];
    
    // Sort representatives by saturation for better initial selection
    representatives.sort((a, b) => b.hsl.s - a.hsl.s);
    
    // Always include the most saturated color
    if (representatives.length > 0) {
      selectedColors.push({
        hex: representatives[0].hex,
        rgb: representatives[0].rgb
      });
    }
    
    // Use a greedy algorithm to add colors with maximum distance from existing ones
    const MINIMUM_DIFFERENCE = 120; // Higher threshold for much more diversity
    
    while (selectedColors.length < paletteSize && representatives.length > 0) {
      let bestIndex = -1;
      let maxMinDistance = -1;
      
      // For each candidate, find its minimum distance to any selected color
      for (let i = 0; i < representatives.length; i++) {
        const candidate = representatives[i];
        
        // Skip already selected
        if (selectedColors.some(c => c.hex === candidate.hex)) continue;
        
        // Find minimum distance to any selected color
        let minDistance = Number.MAX_VALUE;
        for (const selected of selectedColors) {
          const distance = calculateColorDifference(candidate.rgb, selected.rgb);
          minDistance = Math.min(minDistance, distance);
        }
        
        // If this candidate has a greater minimum distance, it's more distinct
        if (minDistance > maxMinDistance) {
          maxMinDistance = minDistance;
          bestIndex = i;
        }
      }
      
      // Add the best candidate if found and if it's distinct enough
      if (bestIndex !== -1 && maxMinDistance >= MINIMUM_DIFFERENCE) {
        selectedColors.push({
          hex: representatives[bestIndex].hex,
          rgb: representatives[bestIndex].rgb
        });
        
        // Remove this candidate from consideration
        representatives.splice(bestIndex, 1);
      } else {
        // If the best candidate isn't distinct enough, try the next best one
        if (bestIndex !== -1) {
          representatives.splice(bestIndex, 1);
        } else {
          // No more candidates left
          break;
        }
      }
    }
    
    // If we don't have enough colors, add generated ones
    if (selectedColors.length < paletteSize) {
      // Try to add colors from underrepresented hue segments
      const existingHues = selectedColors.map(c => {
        const hex = c.hex;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return rgbToHsl(r, g, b).h;
      });
      
      // Find which hue segments are not represented
      const missingSegments = HUE_SEGMENTS.filter(segment => {
        // Check if any selected color falls in this segment
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
        const rgb = hslToRgb(hue, 85, 60);
        const hex = `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`;
        
        additionalColors.push(hex);
      });
      
      // If we still need more colors, add some from default palette
      if (selectedColors.length + additionalColors.length < paletteSize) {
        const defaultColors = getDefaultColors(paletteSize * 2); // Get more default colors than needed
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
    <div className="p-5 bg-black/70 backdrop-blur-md rounded-lg border border-white/20">
      <h3 className="text-xl font-semibold mb-4 text-white">Choose Title Color</h3>
      
      {/* Image-derived colors */}
      {extractedColors.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm text-gray-300 mb-3 font-medium">Colors From Your Images</h4>
          <div className="grid grid-cols-4 gap-4">
            {sortedColors.map((color, i) => (
              <button
                key={`image-${i}`}
                className={`w-14 h-14 rounded-lg shadow hover:shadow-md transition-all duration-200 border-2 border-white ${
                  colors.locationColor === color 
                    ? 'ring-2 ring-offset-2 ring-white/70 transform scale-105' 
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
        <div className="text-sm text-gray-300 mb-4 flex items-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Extracting colors from your images...
        </div>
      )}
      
      {/* Custom color picker */}
      <div className="mt-6 pt-5 border-t border-white/10">
        <label className="block text-sm font-medium mb-3 text-gray-300">Custom Color</label>
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
            <div className="mb-1"><span className="text-gray-300 inline-block w-16">Current:</span> <span className="font-mono text-white">{colors.locationColor}</span></div>
            <div><span className="text-gray-300 inline-block w-16">Shadow:</span> <span className="font-mono text-white">{colors.locationShadowColor}</span></div>
          </div>
        </div>
        
        {/* Advanced Settings Toggle */}
        <button 
          onClick={() => setShowAdvancedSettings(prev => !prev)}
          className="mt-4 text-sm flex items-center text-gray-300 hover:text-white transition-colors gap-1"
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
          <div className="mt-3 space-y-4 pt-3 border-t border-white/10">
            <h4 className="text-sm font-medium text-gray-200">Shadow Effect</h4>
            
            <div>
              <label className="block text-xs text-gray-300 mb-1">Shadow Darkness: {Math.round((1 - shadowDarkness) * 100)}%</label>
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
                className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-300 mb-1">X Offset: {shadowOffsetX}px</label>
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
                  className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              
              <div>
                <label className="block text-xs text-gray-300 mb-1">Y Offset: {shadowOffsetY}px</label>
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
                  className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
