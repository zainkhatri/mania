import * as FileSystem from 'expo-file-system/legacy';

const IMAGE_DIR = `${FileSystem.documentDirectory}mania_images/`;

// Ensure the images directory exists
export const ensureImageDirectory = async (): Promise<void> => {
  const dirInfo = await FileSystem.getInfoAsync(IMAGE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
  }
};

// Save an image from a URI (could be data URI or file URI) to the file system
export const saveImageToFileSystem = async (imageUri: string): Promise<string> => {
  await ensureImageDirectory();

  const filename = `image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
  const fileUri = `${IMAGE_DIR}${filename}`;

  // If it's a data URI, we need to write it directly
  if (imageUri.startsWith('data:')) {
    // Extract base64 data from data URI
    const base64Data = imageUri.split(',')[1];
    await FileSystem.writeAsStringAsync(fileUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } else {
    // If it's already a file URI, copy it
    await FileSystem.copyAsync({
      from: imageUri,
      to: fileUri,
    });
  }

  return fileUri;
};

// Delete an image from the file system
export const deleteImageFromFileSystem = async (fileUri: string): Promise<void> => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(fileUri);
    }
  } catch (error) {
    console.error('Error deleting image:', error);
  }
};

// Delete all images for a journal
export const deleteJournalImages = async (imageUris: string[]): Promise<void> => {
  await Promise.all(imageUris.map(uri => deleteImageFromFileSystem(uri)));
};

// Clean up orphaned images (images that aren't referenced in any journal)
export const cleanupOrphanedImages = async (allJournalImageUris: string[]): Promise<void> => {
  try {
    await ensureImageDirectory();
    const files = await FileSystem.readDirectoryAsync(IMAGE_DIR);

    const orphanedFiles = files.filter(filename => {
      const fullPath = `${IMAGE_DIR}${filename}`;
      return !allJournalImageUris.includes(fullPath);
    });

    await Promise.all(
      orphanedFiles.map(filename =>
        FileSystem.deleteAsync(`${IMAGE_DIR}${filename}`, { idempotent: true })
      )
    );

    console.log(`Cleaned up ${orphanedFiles.length} orphaned images`);
  } catch (error) {
    console.error('Error cleaning up orphaned images:', error);
  }
};
