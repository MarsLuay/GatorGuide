import { useEffect, useState } from 'react';
import '../global.css';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import StartupAnimation from '@/components/pages/StartupAnimation';
import { Stack } from "expo-router";
import type { ErrorBoundaryProps } from "expo-router";
import { View, Text, Pressable, Alert, Platform, Share } from "react-native";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppThemeProvider } from "@/hooks/use-app-theme";
import { AppLanguageProvider } from "@/hooks/use-app-language";
import { AppDataProvider } from "@/hooks/use-app-data";
import { cacheManagerService } from "@/services";
import { db } from "@/services/firebase";

const HAS_SEEN_STARTUP_KEY = 'gatorguide:hasSeenStartup';
const SUPPORT_EMAIL = 'gatorguide_mobiledevelopmentteam@outlook.com';
const SUPPORT_ERROR_WEBHOOK =
  process.env.EXPO_PUBLIC_SUPPORT_ERROR_LOG_WEBHOOK ||
  'https://us-central1-gatorguide.cloudfunctions.net/sendSupportErrorLog';

const buildErrorLog = (error: Error) => {
  const lines = [
    `Timestamp: ${new Date().toISOString()}`,
    `Platform: ${Platform.OS}`,
    `Message: ${error?.message ?? 'Unknown error'}`,
    `Stack:`,
    `${error?.stack ?? 'No stack available'}`,
  ];
  return lines.join('\n');
};

const sendErrorToSupport = async (error: Error) => {
  const payload = {
    timestamp: new Date().toISOString(),
    platform: Platform.OS,
    message: error?.message ?? 'Unknown error',
    stack: error?.stack ?? 'No stack available',
    app: 'GatorGuide',
    supportEmail: SUPPORT_EMAIL,
  };

  try {
    if (SUPPORT_ERROR_WEBHOOK) {
      const res = await fetch(SUPPORT_ERROR_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Support endpoint error: ${res.status}`);
      Alert.alert('Sent', 'Error log sent to support.');
      return;
    }

    if (db) {
      await addDoc(collection(db, "supportErrorLogs"), {
        ...payload,
        createdAt: serverTimestamp(),
        source: "client-error-boundary",
      });
      Alert.alert('Sent', 'Error log saved to support logs.');
      return;
    }

    Alert.alert(
      'Support endpoint not configured',
      'Set EXPO_PUBLIC_SUPPORT_ERROR_LOG_WEBHOOK, or enable Firestore to store support logs automatically.'
    );
  } catch {
    Alert.alert(
      'Failed to send',
      'Could not send the error log to support. Verify your webhook endpoint (or Firestore rules) and try again.'
    );
  }
};

const copyErrorLog = async (error: Error) => {
  const log = buildErrorLog(error);
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(log);
    Alert.alert('Copied', 'Error log copied to clipboard.');
    return;
  }

  await Share.share({ message: log });
};

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: '#0B0B0B', justifyContent: 'center', paddingHorizontal: 24 }}>
      <View style={{ width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: '#111827', borderRadius: 16, padding: 20 }}>
        <Text style={{ color: 'white', fontSize: 24, fontWeight: '600', marginBottom: 8 }}>Something went wrong</Text>
        <Text style={{ color: '#D1D5DB', fontSize: 14, marginBottom: 16 }}>
          Please copy the error log and send it so we can fix this quickly.
        </Text>

        <Pressable
          onPress={() => copyErrorLog(error)}
          style={{ backgroundColor: '#22C55E', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 10 }}
        >
          <Text style={{ color: 'black', fontWeight: '700' }}>Copy error log</Text>
        </Pressable>

        <Pressable
          onPress={() => sendErrorToSupport(error)}
          style={{ backgroundColor: '#1F2937', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 10 }}
        >
          <Text style={{ color: 'white', fontWeight: '700' }}>Send error log to support</Text>
        </Pressable>

        <Pressable onPress={retry} style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Text style={{ color: '#93C5FD', fontWeight: '600' }}>Try again</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [showAnimation, setShowAnimation] = useState<boolean | null>(null);

  useEffect(() => {
    async function prepare() {
      try {
        await SplashScreen.hideAsync();
        await cacheManagerService.runAutoClearMaintenance();
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
