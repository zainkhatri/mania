import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

// Match the web version proportions
const WEB_CANVAS_WIDTH = 1860;
const WEB_CANVAS_HEIGHT = 2620;

// Line Y coordinates from web version - exact positions
const JOURNAL_LINE_Y_COORDS = [
  420, 534, 642, 750, 858, 966, 1080, 1188, 1296, 1404,
  1512, 1620, 1728, 1836, 1944, 2064, 2172, 2280, 2394, 2496, 2598
];

// Margins
const LEFT_MARGIN = 48;
const RIGHT_MARGIN = 48;

// Page styling - cream/beige color like the PNG
const PAGE_BACKGROUND = '#f5f2e9';
const LINE_COLOR = 'rgba(200, 180, 150, 0.3)'; // Subtle brown-gray lines

interface SimpleJournalPageProps {
  date: string;
  location?: string;
  text: string;
  locationColor?: string;
  canvasWidth?: number;
  canvasHeight?: number;
}

export default function SimpleJournalPage({
  date,
  location,
  text,
  locationColor = '#FF1493',
  canvasWidth,
  canvasHeight,
}: SimpleJournalPageProps) {
  const displayWidth = canvasWidth ?? (width - 48);
  const displayHeight = canvasHeight ?? (displayWidth * (WEB_CANVAS_HEIGHT / WEB_CANVAS_WIDTH));
  const scale = displayWidth / WEB_CANVAS_WIDTH;

  // Helper to create darker version of color for shadow
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

  // Simple text wrapping - split into lines
  const wrapText = (text: string, maxCharsPerLine: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length > maxCharsPerLine && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  };

  const textLines = wrapText(text, 70); // Approximately 70 chars per line

  return (
    <View style={[styles.container, { width: displayWidth, height: displayHeight }]}>
      {/* Journal lines - matching the PNG style */}
      {JOURNAL_LINE_Y_COORDS.map((y, index) => (
        <View
          key={`line-${index}`}
          style={[
            styles.line,
            {
              top: y * scale,
              left: LEFT_MARGIN * scale,
              right: RIGHT_MARGIN * scale,
            },
          ]}
        />
      ))}

      {/* Date */}
      <Text
        style={[
          styles.date,
          {
            top: 150 * scale,
            left: LEFT_MARGIN * scale,
            right: RIGHT_MARGIN * scale,
            fontSize: 96 * scale,
          },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {date}
      </Text>

      {/* Location with shadow effect */}
      {location && location.trim() && (
        <>
          {/* Shadow layer */}
          <Text
            style={[
              styles.location,
              {
                top: (150 + 96 + 43) * scale,
                left: (LEFT_MARGIN + 18) * scale,
                right: RIGHT_MARGIN * scale,
                fontSize: 72 * scale,
                color: getDarkerColor(locationColor),
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {location.toUpperCase()}
          </Text>
          {/* Main layer */}
          <Text
            style={[
              styles.location,
              {
                top: (150 + 96 + 30) * scale,
                left: LEFT_MARGIN * scale,
                right: RIGHT_MARGIN * scale,
                fontSize: 72 * scale,
                color: locationColor,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {location.toUpperCase()}
          </Text>
        </>
      )}

      {/* Body text */}
      {textLines.slice(0, JOURNAL_LINE_Y_COORDS.length).map((line, index) => (
        <Text
          key={`text-${index}`}
          style={[
            styles.bodyText,
            {
              top: JOURNAL_LINE_Y_COORDS[index] * scale,
              left: LEFT_MARGIN * scale,
              right: RIGHT_MARGIN * scale,
              fontSize: 50 * scale,
            },
          ]}
        >
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: PAGE_BACKGROUND,
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  line: {
    position: 'absolute',
    height: 1.5,
    backgroundColor: LINE_COLOR,
  },
  date: {
    position: 'absolute',
    fontFamily: 'TitleFont',
    color: '#000000',
    fontWeight: '400',
  },
  location: {
    position: 'absolute',
    fontFamily: 'TitleFont',
    fontWeight: '400',
  },
  bodyText: {
    position: 'absolute',
    fontFamily: 'ZainCustomFont',
    color: '#000000',
  },
});
