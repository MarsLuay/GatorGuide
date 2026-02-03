// global.css is required
import "../global.css";
import React from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppThemeProvider } from "@/hooks/use-app-theme";
import { AppLanguageProvider } from "@/hooks/use-app-language";
import { AppDataProvider } from "@/hooks/use-app-data";

export default function RootLayout() {
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
