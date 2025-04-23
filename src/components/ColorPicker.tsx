import React, { useEffect } from 'react';

export interface TextColors {
  locationColor: string;
  locationShadowColor: string;
}

interface ColorPickerProps {
  colors: TextColors;
  onChange: (colors: TextColors) => void;
  onActivateEyedropper?: (callback: (color: string) => void) => void;
  isEyedropperActive?: boolean;
  onClearEyedropperState?: () => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({
  colors,
  onChange,
  onActivateEyedropper,
  isEyedropperActive = false,
  onClearEyedropperState
}) => {
  // Force all color values to be valid hex
  useEffect(() => {
    // Make sure we have valid hex colors
    const validatedColors = {
      locationColor: colors.locationColor || '#3498DB',
      locationShadowColor: colors.locationShadowColor || '#1D3557'
    };
    
    // If colors were invalid, update them
    if (validatedColors.locationColor !== colors.locationColor || 
        validatedColors.locationShadowColor !== colors.locationShadowColor) {
      onChange(validatedColors);
    }
  }, []);
  
  // Get shadow color from main color (30% darker)
  const getShadowColor = (hexColor: string): string => {
    if (!hexColor || !hexColor.startsWith('#') || hexColor.length !== 7) {
      return '#1D3557'; // Default shadow color if invalid input
    }

    // Convert hex to RGB
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    
    // Create a darker shadow (30% darker)
    const shadowR = Math.max(0, Math.floor(r * 0.7));
    const shadowG = Math.max(0, Math.floor(g * 0.7));
    const shadowB = Math.max(0, Math.floor(b * 0.7));
    
    // Convert to hex
    return `#${shadowR.toString(16).padStart(2, '0')}${shadowG.toString(16).padStart(2, '0')}${shadowB.toString(16).padStart(2, '0')}`;
  };
  
  // Handle main color change
  const handleMainColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    const shadowColor = getShadowColor(newColor);
    
    // Call the onChange handler with updated colors
    onChange({
      locationColor: newColor,
      locationShadowColor: shadowColor
    });
  };
  
  // Handle shadow color change
  const handleShadowColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newShadowColor = e.target.value;
    
    // Call the onChange handler with updated colors
    onChange({
      ...colors,
      locationShadowColor: newShadowColor
    });
  };
  
  // Handle preset color selection
  const handlePresetClick = (mainColor: string) => {
    const shadowColor = getShadowColor(mainColor);
    onChange({
      locationColor: mainColor,
      locationShadowColor: shadowColor
    });
  };
  
  // Color presets
  const colorPresets = [
    '#3498DB', // Blue
    '#E74C3C', // Red
    '#2ECC71', // Green
    '#F1C40F', // Yellow
    '#9B59B6', // Purple
    '#1ABC9C', // Teal
    '#34495E', // Navy
    '#E67E22'  // Orange
  ];
  
  return (
    <div className="p-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium mb-2">Location Text Color</h3>
        
        {/* Color presets */}
        <div className="flex flex-wrap gap-2 mb-4">
          {colorPresets.map((color, index) => (
            <button
              key={index}
              type="button"
              className="w-8 h-8 rounded-md border shadow hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
              onClick={() => handlePresetClick(color)}
            />
          ))}
        </div>
        
        {/* Main color */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Main Color</label>
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-md border shadow"
              style={{ backgroundColor: colors.locationColor }}
            />
            <input
              type="color"
              value={colors.locationColor}
              onChange={handleMainColorChange}
              className="h-10"
            />
            <span className="text-sm text-gray-500 font-mono">{colors.locationColor}</span>
          </div>
        </div>
        
        {/* Shadow color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Shadow Color</label>
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-md border shadow"
              style={{ backgroundColor: colors.locationShadowColor }}
            />
            <input
              type="color"
              value={colors.locationShadowColor}
              onChange={handleShadowColorChange}
              className="h-10"
            />
            <span className="text-sm text-gray-500 font-mono">{colors.locationShadowColor}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColorPicker; 