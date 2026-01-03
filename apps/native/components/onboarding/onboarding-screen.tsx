/**
 * Onboarding Screen Component
 *
 * First-time user experience explaining key features.
 */

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Dimensions, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { haptics } from "@/lib/haptics";

const { width } = Dimensions.get("window");

type OnboardingSlide = {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

const slides: OnboardingSlide[] = [
  {
    title: "Welcome to Alfred",
    description:
      "Your AI assistant that helps you stay organized and productive.",
    icon: "sparkles",
    color: "#00D9FF",
  },
  {
    title: "Voice Calls",
    description:
      "Have natural conversations with Alfred through voice calls. Just tap the call button.",
    icon: "call",
    color: "#00D9FF",
  },
  {
    title: "Notes & Reminders",
    description:
      "Capture your thoughts, set reminders, and never forget important tasks.",
    icon: "document-text",
    color: "#00FF88",
  },
  {
    title: "Timers & Bookmarks",
    description:
      "Track your time and save important links for later reference.",
    icon: "timer",
    color: "#FFB800",
  },
  {
    title: "Workflows",
    description: "Create and manage workflows that Alfred can execute for you.",
    icon: "git-branch",
    color: "#00D9FF",
  },
];

export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const translateX = useSharedValue(0);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      haptics.light();
      setCurrentSlide(currentSlide + 1);
      translateX.value = withSpring(-(currentSlide + 1) * width);
    } else {
      haptics.success();
      onComplete();
    }
  };

  const handleSkip = () => {
    haptics.medium();
    onComplete();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View className="flex-1 bg-background">
      {/* Skip button */}
      <View className="absolute top-12 right-4 z-10">
        <TouchableOpacity
          accessibilityLabel="Skip onboarding"
          onPress={handleSkip}
        >
          <Text className="text-muted-foreground">Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <Animated.View
        className="flex-1 flex-row"
        style={[{ width: width * slides.length }, animatedStyle]}
      >
        {slides.map((slide, index) => (
          <View
            className="flex-1 items-center justify-center px-8"
            key={index}
            style={{ width }}
          >
            <View
              className="mb-8 h-24 w-24 items-center justify-center rounded-full"
              style={{ backgroundColor: `${slide.color}20` }}
            >
              <Ionicons color={slide.color} name={slide.icon} size={48} />
            </View>
            <Text className="mb-4 text-center font-bold text-3xl text-foreground">
              {slide.title}
            </Text>
            <Text className="text-center text-lg text-muted-foreground leading-7">
              {slide.description}
            </Text>
          </View>
        ))}
      </Animated.View>

      {/* Indicators */}
      <View className="mb-8 flex-row justify-center gap-2">
        {slides.map((_, index) => (
          <View
            className={`h-2 rounded-full ${
              index === currentSlide ? "w-8 bg-primary" : "w-2 bg-muted"
            }`}
            key={index}
          />
        ))}
      </View>

      {/* Next/Get Started button */}
      <View className="px-8 pb-8">
        <TouchableOpacity
          accessibilityLabel={
            currentSlide === slides.length - 1 ? "Get started" : "Next"
          }
          accessibilityRole="button"
          className="rounded-lg bg-primary px-8 py-4"
          onPress={handleNext}
        >
          <Text className="text-center font-semibold text-lg text-primary-foreground">
            {currentSlide === slides.length - 1 ? "Get Started" : "Next"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
