import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions, Image } from 'react-native';
import { Canvas, Text as SkiaText, useFont, Group, Rect, useImage, Image as SkiaImage, Skia } from '@shopify/react-native-skia';

const { width } = Dimensions.get('window');

// EXACT dimensions from web version
const WEB_CANVAS_WIDTH = 1860;
const WEB_CANVAS_HEIGHT = 2620;

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
  images?: Array<{uri: string; x: number; y: number; scale: number}>;
  title?: string;
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

// Calculate text wrapping around images
const calculateTextWrapping = (
  currentY: number,
  fontSize: number,
  imagePositions: Array<{x: number; y: number; width: number; height: number}>,
  textWidth: number,
  leftMargin: number,
  rightMargin: number,
  canvasWidth: number
): { availableWidth: number; startX: number } => {
  let availableWidth = textWidth;
  let startX = leftMargin;

  const lineHeight = fontSize * 1.2;
  const textTop = currentY - lineHeight * 0.8;
  const textBottom = currentY + lineHeight * 0.2;

  const overlappingImages = imagePositions.filter(imagePos => {
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

  if (overlappingImages.length > 0) {
    overlappingImages.sort((a, b) => a.x - b.x);
    const textSegments = [];
    const firstImage = overlappingImages[0];
    const spaceBeforeFirst = firstImage.x - leftMargin;

    if (spaceBeforeFirst > 100) {
      textSegments.push({
        start: leftMargin,
        end: firstImage.x - 20,
        width: firstImage.x - leftMargin - 20
      });
    }

    for (let i = 0; i < overlappingImages.length - 1; i++) {
      const currentImage = overlappingImages[i];
      const nextImage = overlappingImages[i + 1];
      const gapStart = currentImage.x + currentImage.width + 20;
      const gapEnd = nextImage.x - 20;

      if (gapEnd > gapStart && gapEnd - gapStart > 100) {
        textSegments.push({
          start: gapStart,
          end: gapEnd,
          width: gapEnd - gapStart
        });
      }
    }

    const lastImage = overlappingImages[overlappingImages.length - 1];
    const spaceAfterLast = (canvasWidth - rightMargin) - (lastImage.x + lastImage.width);

    if (spaceAfterLast > 100) {
      textSegments.push({
        start: lastImage.x + lastImage.width + 20,
        end: canvasWidth - rightMargin,
        width: spaceAfterLast - 20
      });
    }

    if (textSegments.length > 0) {
      textSegments.sort((a, b) => b.width - a.width);
      const bestSegment = textSegments[0];
      startX = bestSegment.start;
      availableWidth = bestSegment.width;
    } else {
      availableWidth = 0;
      startX = leftMargin;
    }
  }

  if (availableWidth < 150) {
    availableWidth = 0;
  }

  return { availableWidth, startX };
};

export default function LiveJournalCanvas({
  date,
  location,
  text,
  locationColor,
  images = [],
  title = ''
}: LiveJournalCanvasProps) {
  const displayWidth = width - 48;
  const displayHeight = displayWidth * (WEB_CANVAS_HEIGHT / WEB_CANVAS_WIDTH);
  const scale = displayWidth / WEB_CANVAS_WIDTH;

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
    let low = 72;
    let high = 300;
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
    return images.map(img => ({
      x: img.x / scale,
      y: img.y / scale,
      width: (150 * img.scale) / scale,
      height: (150 * img.scale) / scale
    }));
  }, [images, scale]);

  // Layout text with image wrapping using ACTUAL text measurement
  const { textLines, finalFontSize } = useMemo(() => {
    if (!text || !bodyFontTest) return { textLines: [], finalFontSize: 50 };

    const words = text.split(' ');
    const textWidth = WEB_CANVAS_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;
    const minFontSize = 17;
    const maxFontSize = 84;
    let fontSize = maxFontSize;
    let fits = false;

    // Find optimal font size using ACTUAL measurements
    while (fontSize >= minFontSize && !fits) {
      let currentWord = 0;

      for (let lineIndex = 0; lineIndex < JOURNAL_LINE_Y_COORDS.length && currentWord < words.length; lineIndex++) {
        const currentY = JOURNAL_LINE_Y_COORDS[lineIndex];
        const { availableWidth } = calculateTextWrapping(
          currentY,
          fontSize,
          webImagePositions,
          textWidth,
          LEFT_MARGIN,
          RIGHT_MARGIN,
          WEB_CANVAS_WIDTH
        );

        if (availableWidth > 0) {
          let currentLine = '';
          while (currentWord < words.length) {
            const nextWord = words[currentWord];
            const testLine = currentLine ? `${currentLine} ${nextWord}` : nextWord;
            // Use ACTUAL font measurement, scaled from size 100 to fontSize
            const widthAt100 = bodyFontTest.getTextWidth(testLine);
            const actualWidth = (widthAt100 / 100) * fontSize * 1.05; // Add 5% safety margin

            if (actualWidth > availableWidth && currentLine) {
              break;
            } else {
              currentLine = testLine;
              currentWord++;
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
      const { availableWidth, startX } = calculateTextWrapping(
        currentY,
        fontSize,
        webImagePositions,
        textWidth,
        LEFT_MARGIN,
        RIGHT_MARGIN,
        WEB_CANVAS_WIDTH
      );

      if (availableWidth > 0) {
        let currentLine = '';
        while (currentWord < words.length) {
          const nextWord = words[currentWord];
          const testLine = currentLine ? `${currentLine} ${nextWord}` : nextWord;
          // Use ACTUAL font measurement, scaled from size 100 to fontSize
          const widthAt100 = bodyFontTest.getTextWidth(testLine);
          const actualWidth = (widthAt100 / 100) * fontSize * 1.05; // Add 5% safety margin

          if (actualWidth > availableWidth && currentLine) {
            break;
          } else {
            currentLine = testLine;
            currentWord++;
          }
        }

        if (currentLine) {
          lines.push({ text: currentLine, y: currentY, x: startX });
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

  if (!dateFont || !locationFont || !bodyFont) {
    return <View style={[styles.container, { height: displayHeight }]} />;
  }

  return (
    <View style={styles.container}>
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

          {/* DEBUG: Visual guide lines - BRIGHT and THICK */}
          <Rect x={LEFT_MARGIN} y={0} width={8} height={WEB_CANVAS_HEIGHT} color="#FF0000" />
          <Rect x={WEB_CANVAS_WIDTH - RIGHT_MARGIN} y={0} width={8} height={WEB_CANVAS_HEIGHT} color="#FF0000" />
          <Rect x={LEFT_MARGIN} y={150} width={WEB_CANVAS_WIDTH - LEFT_MARGIN - RIGHT_MARGIN} height={8} color="#0000FF" />
          <Rect x={LEFT_MARGIN} y={420} width={WEB_CANVAS_WIDTH - LEFT_MARGIN - RIGHT_MARGIN} height={8} color="#00FF00" />

          <SkiaText x={LEFT_MARGIN} y={150} text={date} font={dateFont} color="#000000" />

          {location && location.trim() && (
            <>
              <SkiaText
                x={LEFT_MARGIN + 18}
                y={163 + maxDateFontSize + 30}
                text={location.toUpperCase()}
                font={locationFont}
                color={getDarkerColor(locationColor)}
                opacity={1.0}
              />
              <SkiaText
                x={LEFT_MARGIN}
                y={150 + maxDateFontSize + 30}
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

      {images && images.length > 0 && images.map((img, index) => (
        <Image
          key={`img-${index}`}
          source={{ uri: img.uri }}
          style={{
            position: 'absolute',
            left: img.x,
            top: img.y,
            width: 150 * img.scale,
            height: 150 * img.scale,
            borderRadius: 8,
          }}
          resizeMode="cover"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f2e9',
    borderRadius: 8,
  },
});
