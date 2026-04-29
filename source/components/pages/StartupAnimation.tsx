import React, { useEffect } from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { ScreenBackground } from '@/components/layouts/ScreenBackground';
import { AppStartupScreen } from '@/components/AppStartupScreen';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useThemeStyles } from '@/hooks/use-theme-styles';
import { GatorGuideMark } from '@/components/ui/GatorGuideMark';

export default function StartupAnimation({ onFinish }: { onFinish: () => void }) {
  const isWeb = Platform.OS === 'web';
  const { isDark, isGreen } = useAppTheme();
  const theme = useThemeStyles();
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.96);

  useEffect(() => {
    if (isWeb) {
      const timer = setTimeout(() => {
        onFinish();
      }, 2600);

      return () => clearTimeout(timer);
    }

    // Keep the loading content visible immediately, then ease it out.
    scale.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.back(1.1)),
    });

    opacity.value = withSequence(
      withDelay(
        2100,
        withTiming(0, { duration: 500 }, (finished) => {
          if (finished) {
            runOnJS(onFinish)();
          }
        })
      )
    );
  }, [isWeb, onFinish, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (isWeb) {
    return <AppStartupScreen />;
  }

  return (
    <ScreenBackground>
      <View style={styles.container}>
        <Animated.View style={[styles.content, animatedStyle]}>
          <View style={styles.logo}>
            <GatorGuideMark size={160} darkMode={isDark || isGreen} />
          </View>
          <Text style={[styles.title, { color: theme.textColor }]}>Loading Gator Guide...</Text>
        </Animated.View>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
  },
  logo: {
    width: 160,
    height: 160,
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
});
