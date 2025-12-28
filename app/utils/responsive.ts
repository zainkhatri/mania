import { Dimensions } from 'react-native';

// iPhone 16 Pro dimensions as reference
const REFERENCE_WIDTH = 393;
const REFERENCE_HEIGHT = 852;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Detect iPad
const isIPad = SCREEN_WIDTH >= 768;

// Calculate scale factors
const widthScale = SCREEN_WIDTH / REFERENCE_WIDTH;
const heightScale = SCREEN_HEIGHT / REFERENCE_HEIGHT;

// Use the smaller scale to ensure content fits on all screens
// On iPad, add a multiplier to make text and UI elements more appropriate for the larger screen
const baseScale = Math.min(widthScale, heightScale);
const scale = isIPad ? baseScale * 1.3 : baseScale; // 30% larger on iPad for better readability

/**
 * Scale a value based on screen width relative to iPhone 16 Pro
 * @param size - The size value from iPhone 16 Pro design
 * @returns Scaled size for current device
 */
export const scaleWidth = (size: number): number => {
  return size * widthScale;
};

/**
 * Scale a value based on screen height relative to iPhone 16 Pro
 * @param size - The size value from iPhone 16 Pro design
 * @returns Scaled size for current device
 */
export const scaleHeight = (size: number): number => {
  return size * heightScale;
};

/**
 * Scale a value proportionally (uses minimum of width/height scale)
 * Best for fonts, icons, and elements that should scale uniformly
 * @param size - The size value from iPhone 16 Pro design
 * @returns Scaled size for current device
 */
export const scaleSize = (size: number): number => {
  return size * scale;
};

/**
 * Scale font size - uses uniform scaling to maintain readability
 * @param size - The font size from iPhone 16 Pro design
 * @returns Scaled font size for current device
 */
export const scaleFont = (size: number): number => {
  return size * scale;
};

// Export dimensions for reference
export const DIMENSIONS = {
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,
  referenceWidth: REFERENCE_WIDTH,
  referenceHeight: REFERENCE_HEIGHT,
  widthScale,
  heightScale,
  scale,
};

