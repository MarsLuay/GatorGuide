import { useEffect, useState } from 'react';
import '../global.css';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import StartupAnimation from '@/components/pages/StartupAnimation';
import { Stack } from "expo-router";
import type { ErrorBoundaryProps } from "expo-router";
import { View, Text, Pressable, Alert, Platform, Share, Image } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppThemeProvider } from "@/hooks/use-app-theme";
import { AppLanguageProvider } from "@/hooks/use-app-language";
import { AppDataProvider } from "@/hooks/use-app-data";
import { OpportunitiesProvider } from "@/hooks/use-opportunities";
import { AuthEmailLinkHandler } from "@/components/AuthEmailLinkHandler";
import { UniversalDevMode } from "@/components/dev/UniversalDevMode";
import { STORAGE_KEYS } from "@/constants/schema";
import { cacheManagerService, errorLoggingService } from "@/services";

const HAS_SEEN_STARTUP_KEY = STORAGE_KEYS.hasSeenStartup;

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
  try {
    const result = await errorLoggingService.captureException(error, {
      category: 'app',
      operation: 'manual-error-boundary-send',
      severity: 'error',
      handled: true,
      source: 'client-error-boundary',
      screen: 'root-layout',
      route: '/_layout',
      metadata: {
        manualSend: true,
      },
    }, {
      transportPreference: 'webhook-first',
      allowQueue: false,
      bypassDedup: true,
    });

    if (result.status === 'sent') {
      Alert.alert('Sent', 'Error log sent to support.');
      return;
    }

    if (result.status === 'queued') {
      Alert.alert('Sent', 'Error log saved to support logs.');
      return;
    }

    Alert.alert(
      'Support endpoint not configured',
      'Set EXPO_PUBLIC_SUPPORT_ERROR_LOG_WEBHOOK or sign in so logs can be stored in Firestore.'
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

// Keep the native splash visible until we explicitly hide it.
SplashScreen.preventAutoHideAsync().catch(() => {});

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    void errorLoggingService.captureException(error, {
      category: 'app',
      operation: 'error-boundary',
      severity: 'error',
      handled: true,
      source: 'client-error-boundary',
      screen: 'root-layout',
      route: '/_layout',
    });
  }, [error]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0B0B', justifyContent: 'center', paddingHorizontal: 24 }}>
      <View style={{ width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: '#111827', borderRadius: 16, padding: 20 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '600', marginBottom: 8 }}>Something went wrong</Text>
        <Text style={{ color: '#D1D5DB', fontSize: 14, marginBottom: 16 }}>
          Please copy the error log and send it so we can fix this quickly.
        </Text>

        <Pressable
          onPress={() => copyErrorLog(error)}
          style={{ backgroundColor: '#22C55E', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 10 }}
        >
          <Text style={{ color: '#000000', fontWeight: '700' }}>Copy error log</Text>
        </Pressable>

        <Pressable
          onPress={() => sendErrorToSupport(error)}
          style={{ backgroundColor: '#1F2937', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 10 }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Send error log to support</Text>
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
        await cacheManagerService.runAutoClearMaintenance();
        await errorLoggingService.flushPendingLogs();
        const hasSeenStartup = await AsyncStorage.getItem(HAS_SEEN_STARTUP_KEY);
        setShowAnimation(hasSeenStartup === 'true' ? false : true);
      } catch (e) {
        void errorLoggingService.captureException(e, {
          category: 'app',
          operation: 'root-layout-prepare',
          severity: 'warn',
          handled: true,
          source: 'root-layout',
          screen: 'root-layout',
        });
        setShowAnimation(true);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  useEffect(() => {
    if (!appIsReady || showAnimation === null) return;
    SplashScreen.hideAsync().catch(() => {});
  }, [appIsReady, showAnimation]);

  const handleAnimationFinish = () => {
    AsyncStorage.setItem(HAS_SEEN_STARTUP_KEY, 'true').catch(() => {});
    setShowAnimation(false);
  };

  if (!appIsReady || showAnimation === null) {
    return (
      <View style={{ flex: 1, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
        <Image
          source={require("../assets/images/icon.png")}
          style={{ width: 96, height: 96, marginBottom: 16 }}
          resizeMode="contain"
        />
        <Text style={{ color: "#001f0f", fontSize: 16, fontWeight: "600" }}>Loading Gator Guide...</Text>
      </View>
    );
  }

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
            <OpportunitiesProvider>
              <AuthEmailLinkHandler />
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: 'slide_from_right',
                  animationDuration: 300,
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              </Stack>
              <UniversalDevMode />
            </OpportunitiesProvider>
          </AppDataProvider>
        </AppLanguageProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
