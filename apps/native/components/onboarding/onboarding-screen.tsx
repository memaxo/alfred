/**
 * Onboarding Screen Component
 *
 * First-time user experience with void aesthetic.
 */

import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback, memo } from "react";
import { Dimensions, View, StyleSheet, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { BiolumOrb } from "@/components/foundation/BiolumOrb";
import {
  DisplayText,
  BodyText,
  CaptionText,
} from "@/components/foundation/BiolumText";
import { FluidButton } from "@/components/foundation/FluidButton";
import { VoidContainer } from "@/components/foundation/VoidContainer";
import { useReducedMotion } from "@/hooks/use-void-theme";
import { haptics } from "@/lib/haptics";

const { width } = Dimensions.get("window");

interface OnboardingSlide {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
}

const slides: OnboardingSlide[] = [
  {
    title: "Signal in the Void",
    description:
      "Your self-hosted AI assistant. Private, personal, and always ready to help.",
    icon: "sparkles",
    iconColor: "#00D9FF",
  },
  {
    title: "Voice Conversations",
    description:
      "Speak naturally with Alfred. Just tap and talk—no typing required.",
    icon: "mic",
    iconColor: "#00D9FF",
  },
  {
    title: "Capture Everything",
    description:
      "Notes, reminders, and tasks—all organized and accessible instantly.",
    icon: "document-text",
    iconColor: "#00FF88",
  },
  {
    title: "Track & Save",
    description: "Timers for focus sessions and bookmarks for what matters.",
    icon: "timer",
    iconColor: "#FFB800",
  },
  {
    title: "Automate Workflows",
    description: "Create powerful workflows that Alfred executes for you.",
    icon: "git-branch",
    iconColor: "#00D9FF",
  },
];

interface DotIndicatorProps {
  index: number;
  isActive: boolean;
  onPress: (index: number) => void;
}

const DotIndicator = memo(function DotIndicator({
  index,
  isActive,
  onPress,
}: DotIndicatorProps) {
  const handlePress = useCallback(() => onPress(index), [index, onPress]);
  return (
    <Pressable
      onPress={handlePress}
      accessibilityLabel={`Go to slide ${index + 1}`}
      accessibilityRole="button"
      style={[styles.dot, isActive && styles.dotActive]}
    />
  );
});

export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const translateX = useSharedValue(0);
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  const handleNext = useCallback(() => {
    if (currentSlide < slides.length - 1) {
      haptics.light();
      const nextSlide = currentSlide + 1;
      setCurrentSlide(nextSlide);
      if (reduceMotion) {
        translateX.value = -nextSlide * width;
        progress.value = nextSlide / (slides.length - 1);
      } else {
        translateX.value = withSpring(-nextSlide * width, {
          damping: 30,
          stiffness: 200,
        });
        progress.value = withTiming(nextSlide / (slides.length - 1), {
          duration: 300,
        });
      }
    } else {
      haptics.success();
      onComplete();
    }
  }, [currentSlide, onComplete, translateX, progress, reduceMotion]);

  const handleSkip = useCallback(() => {
    haptics.medium();
    onComplete();
  }, [onComplete]);

  const handleDotPress = useCallback(
    (index: number) => {
      haptics.light();
      setCurrentSlide(index);
      if (reduceMotion) {
        translateX.value = -index * width;
        progress.value = index / (slides.length - 1);
      } else {
        translateX.value = withSpring(-index * width, {
          damping: 30,
          stiffness: 200,
        });
        progress.value = withTiming(index / (slides.length - 1), {
          duration: 300,
        });
      }
    },
    [translateX, progress, reduceMotion]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${interpolate(
      progress.value,
      [0, 1],
      [0, 100],
      Extrapolation.CLAMP
    )}%`,
  }));

  const isLastSlide = currentSlide === slides.length - 1;

  const skipButtonStyle = useCallback(
    ({ pressed }: { pressed: boolean }) => [
      styles.skipButton,
      pressed && styles.skipButtonPressed,
    ],
    []
  );

  return (
    <VoidContainer gradient="flat" noise={true} noiseOpacity={0.03}>
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        {/* Skip button */}
        <View style={styles.skipContainer}>
          <Pressable
            onPress={handleSkip}
            accessibilityLabel="Skip onboarding"
            accessibilityRole="button"
            style={skipButtonStyle}
          >
            <CaptionText color="dim">Skip</CaptionText>
          </Pressable>
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, progressStyle]} />
          </View>
        </View>

        {/* Slides */}
        <Animated.View
          style={[
            styles.slidesContainer,
            { width: width * slides.length },
            animatedStyle,
          ]}
        >
          {slides.map((slide) => (
            <View key={slide.title} style={[styles.slide, { width }]}>
              {/* Orb visualization */}
              <View style={styles.orbContainer}>
                <BiolumOrb
                  size={140}
                  pulsing={true}
                  active={slides.indexOf(slide) === currentSlide}
                />
                <View style={styles.iconOverlay}>
                  <Ionicons
                    name={slide.icon}
                    size={32}
                    color={slide.iconColor}
                  />
                </View>
              </View>

              {/* Text content */}
              <View style={styles.textContainer}>
                <DisplayText size="medium" style={styles.title}>
                  {slide.title}
                </DisplayText>
                <BodyText color="dim" style={styles.description}>
                  {slide.description}
                </BodyText>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* Bottom controls */}
        <View style={styles.bottomContainer}>
          {/* Dot indicators */}
          <View style={styles.dotsContainer}>
            {slides.map((slide, index) => (
              <DotIndicator
                key={slide.title}
                index={index}
                isActive={index === currentSlide}
                onPress={handleDotPress}
              />
            ))}
          </View>

          {/* Next/Get Started button */}
          <FluidButton
            label={isLastSlide ? "Get Started" : "Continue"}
            onPress={handleNext}
            variant="primary"
            size="large"
            style={styles.nextButton}
          />
        </View>
      </SafeAreaView>
    </VoidContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipContainer: {
    position: "absolute",
    top: 16,
    right: 20,
    zIndex: 10,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  skipButtonPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 60,
    marginBottom: 20,
  },
  progressTrack: {
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 1,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#00D9FF",
  },
  slidesContainer: {
    flex: 1,
    flexDirection: "row",
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  orbContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
  },
  iconOverlay: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    alignItems: "center",
    gap: 16,
  },
  title: {
    textAlign: "center",
  },
  description: {
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 280,
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 32,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  dotActive: {
    backgroundColor: "#00D9FF",
    width: 24,
  },
  nextButton: {
    width: "100%",
  },
});

export default OnboardingScreen;
