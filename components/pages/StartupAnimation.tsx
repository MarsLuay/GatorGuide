import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSequence,
  withDelay,
  Easing,
  runOnJS
} from 'react-native-reanimated';

export default function StartupAnimation({ onFinish }: { onFinish: () => void }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.3);

  useEffect(() => {

    const timer = setTimeout(() => {
      scale.value = withTiming(1, { 
        duration: 1000, 
        easing: Easing.out(Easing.back(1.5)) 
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
  }, [onFinish]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }]
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, animatedStyle]}>
        <Image 
         
          source={require('../../assets/images/icon.png')} 
          style={styles.logo} 
          resizeMode="contain"
        />
        <Text style={styles.title}>GatorGuide</Text>
        <Text style={styles.subtitle}>Your Transfer Guide for GRC Students.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
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
    color: '#2a7a57',
  },
  subtitle: {
    fontSize: 16,
    color: '#6a7f73',
    marginTop: 10,
  }
});