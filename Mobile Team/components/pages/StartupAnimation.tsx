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
import { GatorGuideMark } from '@/components/ui/GatorGuideMark';

export default function StartupAnimation({ onFinish }: { onFinish: () => void }) {
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
    <View style={styles.container}>
      <Animated.View style={[styles.content, animatedStyle]}>
        <View style={styles.logo}>
          <GatorGuideMark size={160} />
        </View>
        <Text style={styles.title}>Gator Guide</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
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
    color: '#008f4e',
    marginTop: 16,
  },
});
