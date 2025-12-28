import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions, Image, Text } from 'react-native';
import { Canvas, Text as SkiaText, useFont, Group, Rect, useImage, Image as SkiaImage, Skia } from '@shopify/react-native-skia';

const { width, height } = Dimensions.get('window');
const isIPad = width >= 768;

// EXACT dimensions from web version
const WEB_CANVAS_WIDTH = 1860;
const WEB_CANVAS_HEIGHT = 2620;

// Calculate the canvas size used in ImageStep - MUST match ImageStep exactly
const calculatedCanvasWidth = (width - 32) * 1.25; // 25% larger - matches ImageStep
const calculatedCanvasHeight = calculatedCanvasWidth * (2620 / 1860);
const MAX_CANVAS_HEIGHT_IPAD = height * 0.70;
const MAX_CANVAS_WIDTH_IPAD = MAX_CANVAS_HEIGHT_IPAD * (1860 / 2620);
const IMAGE_STEP_CANVAS_WIDTH = isIPad ? Math.min(calculatedCanvasWidth, MAX_CANVAS_WIDTH_IPAD) : calculatedCanvasWidth;

// This is the canvas size where images were originally placed
const ORIGINAL_CANVAS_WIDTH = IMAGE_STEP_CANVAS_WIDTH;

// Exact line Y coordinates from web version
const JOURNAL_LINE_Y_COORDS = [
  420, 534, 642, 750, 858, 966, 1080, 1188, 1296, 1404,
  1512, 1620, 1728, 1836, 1944, 2064, 2172, 2280, 2394, 2496, 2598
];

// Margins from web version
const LEFT_MARGIN = 48;
const RIGHT_MARGIN = 48;

interface LiveJournalCanvasProps {
  date: string;
  location: string;
  text: string;
  locationColor: string;
  images?: Array<{uri: string; x: number; y: number; scale: number; width: number; height: number}>;
  title?: string;
  canvasWidth?: number;
  canvasHeight?: number;
  hideImages?: boolean; // Hide images visually but still use them for text wrapping
}

// Helper to create darker version of color
const getDarkerColor = (hexColor: string): string => {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const darkerR = Math.max(0, r - 50);
  const darkerG = Math.max(0, g - 50);
  const darkerB = Math.max(0, b - 50);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(darkerR)}${toHex(darkerG)}${toHex(darkerB)}`;
};

// Calculate optimal font size using measurement from loaded font
// For TitleFont, char width is approximately 0.52x font size
// For body text (Zain), char width is approximately 0.48x font size
const calculateOptimalFontSize = (
  text: string,
  maxWidth: number,
  charWidthRatio: number,
  minSize: number,
  maxSize: number
): number => {
  // Binary search for largest font that fits
  let low = minSize;
  let high = maxSize;
  let optimalSize = minSize;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const estimatedWidth = text.length * mid * charWidthRatio;

    if (estimatedWidth <= maxWidth) {
      optimalSize = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return optimalSize;
};

// Calculate text wrapping around images - returns ALL available segments
const calculateTextWrapping = (
  currentY: number,
  fontSize: number,
  imagePositions: Array<{x: number; y: number; width: number; height: number}>,
  textWidth: number,
  leftMargin: number,
  rightMargin: number,
  canvasWidth: number
): Array<{ startX: number; availableWidth: number }> => {
  const lineHeight = fontSize * 1.3;
  const textTop = currentY - lineHeight * 0.85;
  const textBottom = currentY + lineHeight * 0.25;

  const overlappingImages = imagePositions.filter(imagePos => {
    // Check if text line overlaps with image vertically
    // Don't add padding to top - that causes false positives for lines above the image
    const imageTop = imagePos.y;
    const imageBottom = imagePos.y + imagePos.height;
    const verticalOverlap = textBottom > imageTop && textTop < imageBottom;
    if (!verticalOverlap) return false;

    const imageLeft = imagePos.x;
    const imageRight = imagePos.x + imagePos.width;
    const textAreaLeft = leftMargin;
    const textAreaRight = canvasWidth - rightMargin;
    const horizontalOverlap = imageRight > textAreaLeft && imageLeft < textAreaRight;
    return horizontalOverlap;
  });

  if (overlappingImages.length === 0) {
    // No images overlapping - return full width
    return [{ startX: leftMargin, availableWidth: textWidth }];
  }

  overlappingImages.sort((a, b) => a.x - b.x);
  const textSegments = [];
  const firstImage = overlappingImages[0];
  const spaceBeforeFirst = firstImage.x - leftMargin;
  const padding = 15; // Horizontal padding between text and images

  // Minimum width needed to fit at least a few characters (increased from 15 to 100)
  const MIN_USABLE_WIDTH = 100;

  // Add space before first image if there's enough room
  if (spaceBeforeFirst > MIN_USABLE_WIDTH) {
    textSegments.push({
      startX: leftMargin,
      availableWidth: firstImage.x - leftMargin - padding
    });
  }

  // Check gaps between images
  for (let i = 0; i < overlappingImages.length - 1; i++) {
    const currentImage = overlappingImages[i];
    const nextImage = overlappingImages[i + 1];
    const gapStart = currentImage.x + currentImage.width + padding;
    const gapEnd = nextImage.x - padding;
    const gapWidth = gapEnd - gapStart;

    if (gapWidth > MIN_USABLE_WIDTH) {
      textSegments.push({
        startX: gapStart,
        availableWidth: gapWidth
      });
    }
  }

  // Add space after last image if there's enough room
  const lastImage = overlappingImages[overlappingImages.length - 1];
  const spaceAfterLast = (canvasWidth - rightMargin) - (lastImage.x + lastImage.width);

  if (spaceAfterLast > MIN_USABLE_WIDTH) {
    textSegments.push({
      startX: lastImage.x + lastImage.width + padding,
      availableWidth: spaceAfterLast - padding
    });
  }

  // If no usable segments found, return empty array to skip this line entirely
  return textSegments;
};

export default function LiveJournalCanvas({
  date,
  location,
  text,
  locationColor,
  images = [],
  title = '',
  canvasWidth,
  canvasHeight,
  hideImages = false
}: LiveJournalCanvasProps) {
  const displayWidth = canvasWidth ?? (width - 48);
  const displayHeight = canvasHeight ?? (displayWidth * (WEB_CANVAS_HEIGHT / WEB_CANVAS_WIDTH));
  const scale = displayWidth / WEB_CANVAS_WIDTH;

  // Safety check for invalid dimensions
  if (!displayWidth || !displayHeight || !scale || isNaN(scale) || scale <= 0) {
    console.warn('⚠️ Invalid canvas dimensions:', { displayWidth, displayHeight, scale });
    return (
      <View style={[styles.container, { 
        width: displayWidth || 100, 
        height: displayHeight || 100,
        backgroundColor: '#f5f2e9',
        justifyContent: 'center',
        alignItems: 'center'
      }]}>
        <Text style={{ fontSize: 14, color: '#999' }}>Invalid dimensions</Text>
      </View>
    );
  }

  // Load fonts at multiple sizes for measurement
  const dateFontTest = useFont(require('../../assets/fonts/titles.ttf'), 100);

  // Calculate date font size using ACTUAL font measurements
  const maxDateFontSize = useMemo(() => {
    if (!dateFontTest) return 96;

    const availableWidth = WEB_CANVAS_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;
    let low = 96;
    let high = 360;
    let optimalSize = 96;

    // Binary search for largest font that fits using ACTUAL measurements
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      // Measure at size 100, then scale to mid
      const widthAt100 = dateFontTest.getTextWidth(date);
      const estimatedWidth = (widthAt100 / 100) * mid * 1.05; // Add 5% safety margin

      if (estimatedWidth <= availableWidth) {
        optimalSize = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    console.log('📅 Date font:', optimalSize, 'px for', date.length, 'chars');
    return optimalSize;
  }, [date, dateFontTest]);

  // Calculate location font size using ACTUAL font measurements
  const maxLocationFontSize = useMemo(() => {
    if (!location || !location.trim() || !dateFontTest) return 72;

    const availableWidth = WEB_CANVAS_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;
    const locationLength = location.trim().length;
    
    // Reference: "MANIA, LA JOLLA, CA" is ~20 chars and should be around 140px
    // Scale max size based on character count
    let maxSize = 200; // Cap maximum size
    if (locationLength < 15) {
      maxSize = 140; // Short text shouldn't be huge
    } else if (locationLength < 25) {
      maxSize = 180;
    }
    
    let low = 72;
    let high = maxSize;
    let optimalSize = 72;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const widthAt100 = dateFontTest.getTextWidth(location.toUpperCase());
      const estimatedWidth = (widthAt100 / 100) * mid * 1.05; // Add 5% safety margin

      if (estimatedWidth <= availableWidth) {
        optimalSize = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    console.log('📍 Location font:', optimalSize, 'px for', location);
    return optimalSize;
  }, [location, dateFontTest]);

  // Load fonts at calculated sizes
  const dateFont = useFont(require('../../assets/fonts/titles.ttf'), maxDateFontSize);
  const locationFont = useFont(require('../../assets/fonts/titles.ttf'), maxLocationFontSize);

  // Load body fonts for measurement
  const bodyFontTest = useFont(require('../../assets/fonts/zain.ttf'), 100);

  const bodyFont84 = useFont(require('../../assets/fonts/zain.ttf'), 84);
  const bodyFont70 = useFont(require('../../assets/fonts/zain.ttf'), 70);
  const bodyFont60 = useFont(require('../../assets/fonts/zain.ttf'), 60);
  const bodyFont50 = useFont(require('../../assets/fonts/zain.ttf'), 50);
  const bodyFont40 = useFont(require('../../assets/fonts/zain.ttf'), 40);
  const bodyFont30 = useFont(require('../../assets/fonts/zain.ttf'), 30);
  const bodyFont20 = useFont(require('../../assets/fonts/zain.ttf'), 20);
  const bodyFont17 = useFont(require('../../assets/fonts/zain.ttf'), 17);

  const templateImage = useImage(require('../../assets/templates/goodnotes-a6-yellow.jpg'));

  // Convert display image positions to web canvas coordinates
  const webImagePositions = useMemo(() => {
    if (!scale || isNaN(scale) || scale <= 0) return [];

    // Images are stored in IMAGE_STEP_CANVAS_WIDTH coordinates
    // We need to convert them to WEB_CANVAS_WIDTH coordinates for text layout
    const scaleFactor = WEB_CANVAS_WIDTH / ORIGINAL_CANVAS_WIDTH;

    return images.map(img => {
      // Calculate display size preserving aspect ratio
      const aspectRatio = img.width / img.height;
      const baseSize = 150;
      let displayWidth: number;
      let displayHeight: number;

      if (aspectRatio > 1) {
        // Landscape
        displayWidth = baseSize;
        displayHeight = baseSize / aspectRatio;
      } else {
        // Portrait or square
        displayHeight = baseSize;
        displayWidth = baseSize * aspectRatio;
      }

      return {
        x: (img.x || 0) * scaleFactor,
        y: (img.y || 0) * scaleFactor,
        width: (displayWidth * (img.scale || 1)) * scaleFactor,
        height: (displayHeight * (img.scale || 1)) * scaleFactor
      };
    });
  }, [images, scale, width]);

  // Layout text with image wrapping using ACTUAL text measurement
  const { textLines, finalFontSize } = useMemo(() => {
    if (!text || !bodyFontTest) return { textLines: [], finalFontSize: 50 };

    const words = text.split(' ');
    const textWidth = WEB_CANVAS_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;
    const minFontSize = 50; // Increased from 17 to keep text larger
    const maxFontSize = 84;
    let fontSize = maxFontSize;
    let fits = false;

    // Find optimal font size using ACTUAL measurements with multi-segment support
    while (fontSize >= minFontSize && !fits) {
      let currentWord = 0;

      for (let lineIndex = 0; lineIndex < JOURNAL_LINE_Y_COORDS.length && currentWord < words.length; lineIndex++) {
        const currentY = JOURNAL_LINE_Y_COORDS[lineIndex];
        const segments = calculateTextWrapping(
          currentY,
          fontSize,
          webImagePositions,
          textWidth,
          LEFT_MARGIN,
          RIGHT_MARGIN,
          WEB_CANVAS_WIDTH
        );

        // Skip this line if no usable segments (images block the entire line)
        if (segments.length === 0) {
          continue;
        }

        // Try to fill all segments on this line
        for (const segment of segments) {
          if (currentWord >= words.length) break;

          let currentLine = '';
          let wordsInSegment = 0;
          
          while (currentWord < words.length) {
            const nextWord = words[currentWord];
            const testLine = currentLine ? `${currentLine} ${nextWord}` : nextWord;
            // Use ACTUAL font measurement, scaled from size 100 to fontSize
            const widthAt100 = bodyFontTest.getTextWidth(testLine);
            const actualWidth = (widthAt100 / 100) * fontSize * 1.05; // Add 5% safety margin

            if (actualWidth > segment.availableWidth) {
              // If we can't fit even one word in this segment, skip it
              if (wordsInSegment === 0) {
                break;
              }
              // Otherwise, move to next segment
              if (currentLine) {
                break;
              }
            } else {
              currentLine = testLine;
              currentWord++;
              wordsInSegment++;
            }
          }
        }
      }

      fits = currentWord >= words.length;
      if (!fits) fontSize -= 0.5;
    }

    fontSize = Math.max(minFontSize, fontSize);

    // Layout text with optimal font size using ACTUAL measurements
    const lines: Array<{ text: string; y: number; x: number }> = [];
    let currentWord = 0;

    for (let lineIndex = 0; lineIndex < JOURNAL_LINE_Y_COORDS.length && currentWord < words.length; lineIndex++) {
      const currentY = JOURNAL_LINE_Y_COORDS[lineIndex];
      const segments = calculateTextWrapping(
        currentY,
        fontSize,
        webImagePositions,
        textWidth,
        LEFT_MARGIN,
        RIGHT_MARGIN,
        WEB_CANVAS_WIDTH
      );

      // Skip this line if no usable segments (images block the entire line)
      if (segments.length === 0) {
        continue;
      }

      // Fill all available segments on this line from left to right
      for (const segment of segments) {
        if (currentWord >= words.length) break;

        let currentLine = '';
        let wordsInSegment = 0;
        
        while (currentWord < words.length) {
          const nextWord = words[currentWord];
          const testLine = currentLine ? `${currentLine} ${nextWord}` : nextWord;
          // Use ACTUAL font measurement, scaled from size 100 to fontSize
          const widthAt100 = bodyFontTest.getTextWidth(testLine);
          const actualWidth = (widthAt100 / 100) * fontSize * 1.05; // Add 5% safety margin

          if (actualWidth > segment.availableWidth) {
            // If we can't fit even one word in this segment, skip it
            if (wordsInSegment === 0) {
              break;
            }
            // Otherwise, move to next segment
            if (currentLine) {
              break;
            }
          } else {
            currentLine = testLine;
            currentWord++;
            wordsInSegment++;
          }
        }

        if (currentLine) {
          lines.push({ text: currentLine, y: currentY, x: segment.startX });
        }
      }
    }

    console.log('📝 Body text:', fontSize, 'px,', lines.length, 'lines');
    return { textLines: lines, finalFontSize: fontSize };
  }, [text, webImagePositions, bodyFontTest]);

  const getBodyFont = () => {
    if (finalFontSize >= 80) return bodyFont84;
    if (finalFontSize >= 65) return bodyFont70;
    if (finalFontSize >= 55) return bodyFont60;
    if (finalFontSize >= 45) return bodyFont50;
    if (finalFontSize >= 35) return bodyFont40;
    if (finalFontSize >= 25) return bodyFont30;
    if (finalFontSize >= 18) return bodyFont20;
    return bodyFont17;
  };

  const bodyFont = getBodyFont();

  // Show loading placeholder if fonts or template aren't ready yet
  const allFontsLoaded = dateFont && locationFont && bodyFontTest && 
                         bodyFont84 && bodyFont70 && bodyFont60 && bodyFont50 && 
                         bodyFont40 && bodyFont30 && bodyFont20 && bodyFont17;
  
  if (!allFontsLoaded || !templateImage) {
    console.log('⏳ Loading journal... fonts:', !!allFontsLoaded, 'template:', !!templateImage);
    return (
      <View style={[styles.container, { width: displayWidth, height: displayHeight, backgroundColor: '#f5f2e9' }]}>
        <Text style={{ textAlign: 'center', marginTop: 50, fontSize: 16, color: '#999' }}>
          Loading journal...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: displayWidth, height: displayHeight }]}>
      <Canvas style={{ width: displayWidth, height: displayHeight }}>
        <Group transform={[{ scale }]}>
          <Rect x={0} y={0} width={WEB_CANVAS_WIDTH} height={WEB_CANVAS_HEIGHT} color="#f5f2e9" />

          {templateImage && (
            <SkiaImage
              image={templateImage}
              x={0}
              y={0}
              width={WEB_CANVAS_WIDTH}
              height={WEB_CANVAS_HEIGHT}
              fit="fill"
            />
          )}

          <SkiaText x={LEFT_MARGIN} y={130} text={date} font={dateFont} color="#000000" />

          {location && location.trim() && (
            <>
              <SkiaText
                x={LEFT_MARGIN + 18}
                y={143 + maxDateFontSize + 40}
                text={location.toUpperCase()}
                font={locationFont}
                color={getDarkerColor(locationColor)}
                opacity={1.0}
              />
              <SkiaText
                x={LEFT_MARGIN}
                y={130 + maxDateFontSize + 40}
                text={location.toUpperCase()}
                font={locationFont}
                color={locationColor}
              />
            </>
          )}

          {textLines.map((line, index) => (
            <SkiaText
              key={index}
              x={line.x}
              y={line.y}
              text={line.text}
              font={bodyFont}
              color="#000000"
            />
          ))}
        </Group>
      </Canvas>

      {!hideImages && images && images.length > 0 && images.map((img, index) => {
        // Images are stored in coordinates for IMAGE_STEP_CANVAS_WIDTH
        // We need to scale them to match the current display size
        // The 'scale' variable represents: currentDisplayWidth / WEB_CANVAS_WIDTH
        // But images were placed at a different display width, so we need to scale them proportionally

        // Calculate the scale factor between the current canvas and the canvas where images were placed
        // Images were placed at: IMAGE_STEP_CANVAS_WIDTH
        // Current canvas is at: displayWidth
        // So we need to scale images by: (displayWidth / IMAGE_STEP_CANVAS_WIDTH)

        const imageScaleFactor = displayWidth / ORIGINAL_CANVAS_WIDTH;

        // Calculate display size preserving aspect ratio
        const aspectRatio = img.width / img.height;
        const baseSize = 150;
        let imgDisplayWidth: number;
        let imgDisplayHeight: number;

        if (aspectRatio > 1) {
          // Landscape
          imgDisplayWidth = baseSize;
          imgDisplayHeight = baseSize / aspectRatio;
        } else {
          // Portrait or square
          imgDisplayHeight = baseSize;
          imgDisplayWidth = baseSize * aspectRatio;
        }

        const imgWidth = imgDisplayWidth * (img.scale || 1) * imageScaleFactor;
        const imgHeight = imgDisplayHeight * (img.scale || 1) * imageScaleFactor;
        const imgX = (img.x || 0) * imageScaleFactor;
        const imgY = (img.y || 0) * imageScaleFactor;

        // Skip if any values are invalid
        if (isNaN(imgWidth) || isNaN(imgHeight) || isNaN(imgX) || isNaN(imgY)) {
          console.warn(`⚠️ Invalid image ${index}:`, { x: imgX, y: imgY, width: imgWidth, height: imgHeight });
          return null;
        }

        return (
          <Image
            key={`img-${index}`}
            source={{ uri: img.uri }}
            style={{
              position: 'absolute',
              left: imgX,
              top: imgY,
              width: imgWidth,
              height: imgHeight,
              borderRadius: 8 * imageScaleFactor,
            }}
            resizeMode="cover"
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f2e9',
    borderRadius: 8,
    overflow: 'hidden',
  },
});
