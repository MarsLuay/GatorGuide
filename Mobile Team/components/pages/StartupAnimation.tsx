import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
import { useAppTheme } from '@/hooks/use-app-theme';
import { useThemeStyles } from '@/hooks/use-theme-styles';
import { GatorGuideMark } from '@/components/ui/GatorGuideMark';

export default function StartupAnimation({ onFinish }: { onFinish: () => void }) {
  const { isDark, isGreen } = useAppTheme();
  const theme = useThemeStyles();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.3);

  useEffect(() => {
    // Intro sequence: animate in, hold, then fade out before handing control back.
    const timer = setTimeout(() => {
      scale.value = withTiming(1, {
        duration: 1000,
        easing: Easing.out(Easing.back(1.5)),
      });

      opacity.value = withSequence(
        withTiming(1, { duration: 600 }),
        withDelay(
          2000,
          withTiming(0, { duration: 600 }, (finished) => {
            if (finished) {
              runOnJS(onFinish)();
            }
          })
        )
      );
    }, 100);

    return () => clearTimeout(timer);
  }, [onFinish, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <ScreenBackground>
      <View style={styles.container}>
        <Animated.View style={[styles.content, animatedStyle]}>
          <View style={styles.logo}>
            <GatorGuideMark size={160} darkMode={isDark || isGreen} />
          </View>
          <Text style={[styles.title, { color: theme.textColor }]}>Gator Guide</Text>
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
    fontSize: 36,
    fontWeight: '800',
    marginTop: 16,
  },
});
