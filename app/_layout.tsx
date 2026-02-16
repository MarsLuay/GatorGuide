import { useEffect, useState } from 'react';
import '../global.css';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import StartupAnimation from '@/components/pages/StartupAnimation';
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppThemeProvider } from "@/hooks/use-app-theme";
import { AppLanguageProvider } from "@/hooks/use-app-language";
import { AppDataProvider } from "@/hooks/use-app-data";

const HAS_SEEN_STARTUP_KEY = 'gatorguide:hasSeenStartup';

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [showAnimation, setShowAnimation] = useState<boolean | null>(null);

  useEffect(() => {
    async function prepare() {
      try {
        await SplashScreen.hideAsync();
        const hasSeenStartup = await AsyncStorage.getItem(HAS_SEEN_STARTUP_KEY);
        setShowAnimation(hasSeenStartup === 'true' ? false : true);
      } catch (e) {
        console.warn(e);
        setShowAnimation(true);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  const handleAnimationFinish = () => {
    AsyncStorage.setItem(HAS_SEEN_STARTUP_KEY, 'true').catch(() => {});
    setShowAnimation(false);
  };

  if (!appIsReady || showAnimation === null) return null;

  if (showAnimation) {
    return (
      <StartupAnimation onFinish={handleAnimationFinish} />
    );
  }

  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <AppLanguageProvider>
          <AppDataProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                animationDuration: 300,
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
          </AppDataProvider>
        </AppLanguageProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}