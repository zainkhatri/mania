import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Journal, getUserJournals, deleteJournal } from '../services/journalService';
import LiveJournalCanvas from '../components/LiveJournalCanvas';
import { haptics } from '../utils/haptics';

const { width } = Dimensions.get('window');
const CANVAS_WIDTH = width - 32;
const CANVAS_HEIGHT = CANVAS_WIDTH * (2620 / 1860);

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const getOrdinalSuffix = (day: number): string => {
    if (day > 3 && day < 21) return 'TH';
    switch (day % 10) {
      case 1: return 'ST';
      case 2: return 'ND';
      case 3: return 'RD';
      default: return 'TH';
    }
  };

  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };

  let dateStr = date.toLocaleDateString('en-US', options);
  const day = date.getDate();
  const ordinal = getOrdinalSuffix(day);
  dateStr = dateStr.replace(/(\d+)/, `$1${ordinal}`);
  return dateStr.toUpperCase();
};

export default function JournalDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const canvasRef = useRef<View>(null);

  const journalId = (route.params as { journalId: string })?.journalId;
  const [journal, setJournal] = useState<Journal | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    loadJournal();
  }, [journalId]);

  const loadJournal = async () => {
    try {
      const journals = await getUserJournals();
      const found = journals.find(j => j.id === journalId);
      setJournal(found || null);
    } catch (error) {
      console.error('Error loading journal:', error);
      Alert.alert('Error', 'Could not load journal.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!canvasRef.current) return;

    try {
      setSharing(true);
      haptics.medium();

      // Capture the canvas as an image
      const uri = await captureRef(canvasRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      // Share the image
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share Journal',
      });

      haptics.success();
    } catch (error) {
      console.error('Error sharing journal:', error);
      haptics.error();
      Alert.alert('Error', 'Could not share journal. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  const handleEdit = () => {
    haptics.medium();
    navigation.navigate('Journal' as never, { journalId: journal?.id } as never);
  };

  const handleDelete = () => {
    haptics.medium();
    Alert.alert(
      'Delete Journal',
      'Are you sure? This cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              haptics.heavy();
              await deleteJournal(journalId);
              haptics.success();
              navigation.navigate('Gallery' as never);
            } catch (error) {
              haptics.error();
              Alert.alert('Error', 'Could not delete journal. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleBack = () => {
    haptics.light();
    navigation.goBack();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!journal) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Journal not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {formatDate(journal.date)}
        </Text>
        <View style={styles.headerButton} />
      </View>

      {/* Journal Canvas */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View ref={canvasRef} collapsable={false} style={styles.canvasWrapper}>
          <LiveJournalCanvas
            date={formatDate(journal.date)}
            location={journal.location || ''}
            text={journal.text}
            locationColor={journal.colors.locationColor}
            images={journal.images}
            canvasWidth={CANVAS_WIDTH}
            canvasHeight={CANVAS_HEIGHT}
          />
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.shareButton]}
          onPress={handleShare}
          disabled={sharing}
        >
          {sharing ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Ionicons name="share-outline" size={20} color="#000" />
              <Text style={styles.actionButtonText}>Share</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={handleEdit}
        >
          <Ionicons name="create-outline" size={20} color="#000" />
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={20} color="#ff3b30" />
          <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    fontFamily: 'TitleFont',
    color: '#fff',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 100,
  },
  backButtonText: {
    fontSize: 16,
    fontFamily: 'TitleFont',
    color: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: StatusBar.currentHeight || 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'ZainCustomFont',
    color: '#fff',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  canvasWrapper: {
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  shareButton: {
    backgroundColor: '#fff',
  },
  editButton: {
    backgroundColor: '#fff',
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderWidth: 1,
    borderColor: '#ff3b30',
  },
  actionButtonText: {
    fontSize: 15,
    fontFamily: 'TitleFont',
    color: '#000',
    letterSpacing: -0.5,
  },
  deleteButtonText: {
    color: '#ff3b30',
  },
});
