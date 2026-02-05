import { useEffect, useState } from 'react';
import { View } from 'react-native';
import '../global.css';
import * as SplashScreen from 'expo-splash-screen';
import StartupAnimation from '@/components/pages/StartupAnimation';
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppThemeProvider } from "@/hooks/use-app-theme";
import { AppLanguageProvider } from "@/hooks/use-app-language";
import { AppDataProvider } from "@/hooks/use-app-data";

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
    <SafeAreaProvider>
      <AppThemeProvider>
        <AppLanguageProvider>
          <AppDataProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
          </AppDataProvider>
        </AppLanguageProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}