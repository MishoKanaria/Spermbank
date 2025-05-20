import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import Svg, { Path as SvgPath } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(SvgPath);

export default function AnimatedCheckmark({ size = 100, color = '#4CAF50', duration = 600 }) {
  const strokeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(strokeAnim, {
      toValue: 1,
      duration,
      useNativeDriver: false,
    }).start();
  }, [strokeAnim, duration]);

  const strokeDasharray = 44; // Length of the checkmark path
  const strokeDashoffset = strokeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [strokeDasharray, 0],
  });

  return (
    <Svg width={size} height={size} viewBox="0 0 52 52">
      <AnimatedPath
        d="M14 27 L22 35 L38 19"
        stroke={color}
        strokeWidth={5}
        fill="none"
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
      />
    </Svg>
  );
} 