import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import JournalScreen from '../screens/JournalScreen';
import GalleryScreen from '../screens/GalleryScreen';
import JournalDetailScreen from '../screens/JournalDetailScreen';

export type RootStackParamList = {
  Gallery: undefined;
  JournalDetail: { journalId: string };
  Journal: { journalId?: string }; // undefined = create, string = edit
  Home: undefined; // Keep for backwards compatibility
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: '#000' },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Gallery" component={GalleryScreen} />
        <Stack.Screen
          name="JournalDetail"
          component={JournalDetailScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Journal"
          component={JournalScreen}
          options={{
            animation: 'slide_from_bottom',
            presentation: 'modal'
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
