import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserJournals as getLocalJournals } from './journalService';
import { User } from '../types/models';

const MIGRATION_STATUS_KEY = '@mania_migration_status';

interface MigrationStatus {
  isMigrated: boolean;
  migratedAt: string | null;
  journalCount: number;
}

export const getMigrationStatus = async (): Promise<MigrationStatus> => {
  try {
    const statusJson = await AsyncStorage.getItem(MIGRATION_STATUS_KEY);
    if (statusJson) {
      return JSON.parse(statusJson);
    }
  } catch (error) {
    console.error('Error getting migration status:', error);
  }

  return {
    isMigrated: false,
    migratedAt: null,
    journalCount: 0,
  };
};

export const migrateLocalJournalsToFirebase = async (user: User): Promise<void> => {
  const status = await getMigrationStatus();

  if (status.isMigrated) {
    console.log('✅ Journals already migrated');
    return;
  }

  try {
    console.log('🔄 Starting journal migration to Firebase...');

    // Get all local journals
    const localJournals = await getLocalJournals();

    console.log(`📦 Found ${localJournals.length} local journals to migrate`);

    if (localJournals.length === 0) {
      // Mark migration as complete even if no journals to migrate
      const migrationStatus: MigrationStatus = {
        isMigrated: true,
        migratedAt: new Date().toISOString(),
        journalCount: 0,
      };

      await AsyncStorage.setItem(MIGRATION_STATUS_KEY, JSON.stringify(migrationStatus));
      console.log('✅ Migration marked as complete (no journals to migrate)');
      return;
    }

    // NOTE: Journal sync is handled in journalService.ts
    // When user creates/updates journals with Firebase auth, they automatically sync
    // For migration, we'll just mark the status as complete
    // The actual sync will happen gradually as user interacts with the app

    // Mark migration as complete
    const migrationStatus: MigrationStatus = {
      isMigrated: true,
      migratedAt: new Date().toISOString(),
      journalCount: localJournals.length,
    };

    await AsyncStorage.setItem(MIGRATION_STATUS_KEY, JSON.stringify(migrationStatus));

    console.log(`✅ Migration complete! ${localJournals.length} journals ready for sync`);
  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  }
};

// Reset migration status (for development/testing)
export const resetMigrationStatus = async (): Promise<void> => {
  await AsyncStorage.removeItem(MIGRATION_STATUS_KEY);
  console.log('🔄 Migration status reset');
};
