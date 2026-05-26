import { useEffect, useState, type ComponentType } from 'react';
import '../global.css';
import * as SplashScreen from 'expo-splash-screen';
import { localStorageService } from "@/services/storage/local-storage.service";
import StartupAnimation from '@/components/pages/StartupAnimation';
import { Stack } from "expo-router";
import type { ErrorBoundaryProps } from "expo-router";
import { View, Text, Alert, InteractionManager, Platform, Share } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppThemeProvider, useAppTheme } from "@/hooks/use-app-theme";
import { AppLanguageProvider } from "@/hooks/use-app-language";
import { AppDataProvider } from "@/hooks/use-app-data";
import { OpportunitiesProvider } from "@/hooks/use-opportunities";
import { AuthRedirectHandler } from "@/components/AuthRedirectHandler";
import { STORAGE_KEYS } from "@/constants/schema";
import { errorLoggingService } from "@/services/logging/error-logging.service";
import { cacheManagerService } from "@/services/storage/cache-manager.service";
import { translations } from "@/services/app/translations";
import { AnimatedChipPressable, AnimatedIconPressable } from "@/components/ui/AnimatedPressables";
import { AppStartupScreen } from "@/components/AppStartupScreen";
import { VercelAnalytics } from "@/components/VercelAnalytics";

const HAS_SEEN_STARTUP_KEY = STORAGE_KEYS.hasSeenStartup;

function rootCopy(key: string) {
  return translations.English[key] ?? key;
}

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
      Alert.alert(rootCopy("errorBoundary.sentTitle"), rootCopy("errorBoundary.sentToSupport"));
      return;
    }

    if (result.status === 'queued') {
      Alert.alert(rootCopy("errorBoundary.sentTitle"), rootCopy("errorBoundary.savedToSupportLogs"));
      return;
    }

    Alert.alert(
      rootCopy("errorBoundary.supportEndpointMissingTitle"),
      rootCopy("errorBoundary.supportEndpointMissingMessage")
    );
  } catch {
    Alert.alert(
      rootCopy("errorBoundary.failedToSendTitle"),
      rootCopy("errorBoundary.failedToSendMessage")
    );
  }
};

const copyErrorLog = async (error: Error) => {
  const log = buildErrorLog(error);
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(log);
    Alert.alert(rootCopy("errorBoundary.copiedTitle"), rootCopy("errorBoundary.copiedMessage"));
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
        <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '600', marginBottom: 8 }}>{rootCopy("errorBoundary.title")}</Text>
        <Text style={{ color: '#D1D5DB', fontSize: 14, marginBottom: 16 }}>
          {rootCopy("errorBoundary.body")}
        </Text>

        <AnimatedChipPressable
          onPress={() => copyErrorLog(error)}
          containerStyle={{ marginBottom: 10 }}
          style={{ backgroundColor: '#22C55E', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
        >
          <Text style={{ color: '#000000', fontWeight: '700' }}>{rootCopy("errorBoundary.copyLog")}</Text>
        </AnimatedChipPressable>

        <AnimatedChipPressable
          onPress={() => sendErrorToSupport(error)}
          containerStyle={{ marginBottom: 10 }}
          style={{ backgroundColor: '#1F2937', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{rootCopy("errorBoundary.sendLog")}</Text>
        </AnimatedChipPressable>

        <AnimatedIconPressable onPress={retry} style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Text style={{ color: '#93C5FD', fontWeight: '600' }}>{rootCopy("errorBoundary.tryAgain")}</Text>
        </AnimatedIconPressable>
      </View>
    </View>
  );
}

function RootLayoutContent() {
  const { hydrated: themeHydrated } = useAppTheme();
  const [appIsReady, setAppIsReady] = useState(false);
  const [showAnimation, setShowAnimation] = useState<boolean | null>(null);
  const [DevModeComponent, setDevModeComponent] = useState<ComponentType | null>(null);

  useEffect(() => {
    async function prepare() {
      try {
        const hasSeenStartup = await localStorageService.getItem(HAS_SEEN_STARTUP_KEY);
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
    if (!appIsReady) return;

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;

      void cacheManagerService.runAutoClearMaintenance().catch((error) => {
        void errorLoggingService.captureException(error, {
          category: 'app',
          operation: 'startup-cache-maintenance',
          severity: 'warn',
          handled: true,
          source: 'root-layout',
          screen: 'root-layout',
        });
      });

      void errorLoggingService.flushPendingLogs();
    });

    return () => {
      cancelled = true;
      task.cancel?.();
    };
  }, [appIsReady]);

  useEffect(() => {
    if (!__DEV__ || !appIsReady) return;

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void import("@/components/dev/UniversalDevMode").then((module) => {
        if (!cancelled) {
          setDevModeComponent(() => module.UniversalDevMode);
        }
      });
    });

    return () => {
      cancelled = true;
      task.cancel?.();
    };
  }, [appIsReady]);

  useEffect(() => {
    if (!appIsReady || showAnimation === null || !themeHydrated) return;
    SplashScreen.hideAsync().catch(() => {});
  }, [appIsReady, showAnimation, themeHydrated]);

  const handleAnimationFinish = () => {
    localStorageService.setItem(HAS_SEEN_STARTUP_KEY, 'true').catch(() => {});
    setShowAnimation(false);
  };

  if (!appIsReady || showAnimation === null || !themeHydrated) {
    return <AppStartupScreen />;
  }

  if (showAnimation) {
    return (
      <StartupAnimation onFinish={handleAnimationFinish} />
    );
  }

  return (
    <AppDataProvider>
      <OpportunitiesProvider>
        <AuthRedirectHandler />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            animationDuration: 300,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        {DevModeComponent ? <DevModeComponent /> : null}
        <VercelAnalytics />
      </OpportunitiesProvider>
    </AppDataProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <AppLanguageProvider>
          <RootLayoutContent />
        </AppLanguageProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
