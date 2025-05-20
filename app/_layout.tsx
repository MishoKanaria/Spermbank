import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { ApiProvider } from './contexts/ApiContext';

import { useColorScheme } from './styles/useColorScheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ApiProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="welcome" />
            <Stack.Screen name="contacts" options={{ presentation: 'modal', animation: 'none' }} />
            <Stack.Screen name="add-contact" options={{ presentation: 'modal', animation: 'none' }} />
            <Stack.Screen name="profile" options={{ presentation: 'modal', animation: 'none' }} />
            <Stack.Screen name="tx-detail" options={{ presentation: 'modal', animation: 'none' }} />
            <Stack.Screen name="sign-message" options={{ presentation: 'modal', animation: 'none' }} />
            <Stack.Screen name="send" options={{ presentation: 'modal', animation: 'none' }} />
            <Stack.Screen name="receive" options={{ presentation: 'modal', animation: 'none' }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </ApiProvider>
    </GestureHandlerRootView>
  );
}
