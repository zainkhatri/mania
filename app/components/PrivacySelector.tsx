import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { PrivacyLevel } from '../types/models';
import { scaleFont, scaleHeight, scaleWidth, scaleSize } from '../utils/responsive';

interface PrivacySelectorProps {
  selectedPrivacy: PrivacyLevel;
  onSelectPrivacy: (privacy: PrivacyLevel) => void;
  disabled?: boolean;
}

export default function PrivacySelector({
  selectedPrivacy,
  onSelectPrivacy,
  disabled = false,
}: PrivacySelectorProps) {
  const options: { value: PrivacyLevel; label: string; description: string; icon: string }[] = [
    {
      value: 'private',
      label: 'Private',
      description: 'Only you can see',
      icon: '🔒',
    },
    {
      value: 'friends',
      label: 'Friends',
      description: 'Friends can see',
      icon: '👥',
    },
    {
      value: 'public',
      label: 'Public',
      description: 'Everyone can see',
      icon: '🌍',
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Who can see this?</Text>
      <View style={styles.optionsContainer}>
        {options.map((option) => {
          const isSelected = selectedPrivacy === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.option,
                isSelected && styles.optionSelected,
                disabled && styles.optionDisabled,
              ]}
              onPress={() => !disabled && onSelectPrivacy(option.value)}
              disabled={disabled}
            >
              <View style={styles.optionContent}>
                <Text style={styles.optionIcon}>{option.icon}</Text>
                <View style={styles.optionText}>
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.optionDescription, isSelected && styles.optionDescriptionSelected]}>
                    {option.description}
                  </Text>
                </View>
              </View>
              {isSelected && <View style={styles.checkmark}>
                <Text style={styles.checkmarkText}>✓</Text>
              </View>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  title: {
    fontSize: scaleFont(18),
    fontFamily: 'TitleFont',
    color: '#fff',
    marginBottom: scaleHeight(12),
    textAlign: 'center',
  },
  optionsContainer: {
    width: '100%',
    gap: scaleHeight(8),
  },
  option: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scaleHeight(14),
    paddingHorizontal: scaleWidth(16),
    borderRadius: scaleSize(12),
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: scaleSize(1.5),
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: '#fff',
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(12),
  },
  optionIcon: {
    fontSize: scaleFont(24),
  },
  optionText: {
    gap: scaleHeight(2),
  },
  optionLabel: {
    fontSize: scaleFont(16),
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -0.5,
  },
  optionLabelSelected: {
    color: '#fff',
  },
  optionDescription: {
    fontSize: scaleFont(12),
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  optionDescriptionSelected: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  checkmark: {
    width: scaleSize(20),
    height: scaleSize(20),
    borderRadius: scaleSize(10),
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    fontSize: scaleFont(12),
    color: '#000',
    fontWeight: 'bold',
  },
});
