import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import JournalScreen from '../screens/JournalScreen';
import GalleryScreen from '../screens/GalleryScreen';
import JournalDetailScreen from '../screens/JournalDetailScreen';
import FeedScreen from '../screens/FeedScreen';
import FriendsScreen from '../screens/FriendsScreen';
import SignInScreen from '../screens/SignInScreen';
import ProfileScreen from '../screens/ProfileScreen';

export type RootStackParamList = {
  Home: undefined;
  Journal: { journalId?: string }; // undefined = create, string = edit
  JournalDetail: { journalId: string };
  Gallery: undefined;
  Feed: undefined;
  Friends: undefined;
  SignIn: undefined;
  Profile: undefined;
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
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ animation: 'fade' }}
        />
        <Stack.Screen
          name="Journal"
          component={JournalScreen}
          options={{
            animation: 'none',
            gestureEnabled: false
          }}
        />
        <Stack.Screen
          name="Gallery"
          component={GalleryScreen}
          options={{
            animation: 'none',
            gestureEnabled: false
          }}
        />
        <Stack.Screen
          name="Feed"
          component={FeedScreen}
          options={{
            animation: 'none',
            gestureEnabled: false
          }}
        />
        <Stack.Screen
          name="Friends"
          component={FriendsScreen}
          options={{
            animation: 'none',
            gestureEnabled: false
          }}
        />
        <Stack.Screen
          name="SignIn"
          component={SignInScreen}
          options={{
            animation: 'fade',
            gestureEnabled: true,
            gestureDirection: 'vertical'
          }}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            animation: 'slide_from_right',
            gestureEnabled: true
          }}
        />
        <Stack.Screen
          name="JournalDetail"
          component={JournalDetailScreen}
          options={{ animation: 'slide_from_right' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
