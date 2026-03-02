import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const LOGO_SOURCE = require('../../assets/images/icon.png');

export default function StartupAnimation({ onFinish }: { onFinish: () => void }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.3);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
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
        {!imageError ? (
          <Image
            source={LOGO_SOURCE}
            style={styles.logo}
            resizeMode="contain"
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={styles.fallbackLogo}>
            <Text style={styles.fallbackIcon}>🎓</Text>
          </View>
        )}
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
  fallbackLogo: {
    width: 160,
    height: 160,
    marginBottom: 20,
    borderRadius: 80,
    backgroundColor: '#008f4e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackIcon: {
    fontSize: 80,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#008f4e',
    marginTop: 16,
  },
});