import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from "expo-router";
import * as SplashScreen from 'expo-splash-screen';
import "../global.css";
import "../services/i18n";
import { AppDataProvider } from "../hooks/use-app-data"; 
import { AppThemeProvider } from "../hooks/use-app-theme"; 
import StartupAnimation from '../components/pages/StartupAnimation';


SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [showAnimation, setShowAnimation] = useState(true);

  useEffect(() => {
    async function prepare() {
      try {

        await SplashScreen.hideAsync();
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  if (!appIsReady) return null;


  if (showAnimation) {
    return (
      <StartupAnimation onFinish={() => setShowAnimation(false)} />
    );
  }

  return (
    <AppThemeProvider>
      <AppDataProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="profile-setup" />
          <Stack.Screen name="language" />
        </Stack>
      </AppDataProvider>
    </AppThemeProvider>
  );
}