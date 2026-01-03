import "react-native-gesture-handler/jestSetup";

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock Expo constants
jest.mock("expo-constants", () => ({
  expoConfig: {
    extra: {
      posthogKey: "test-key",
    },
  },
}));

// Mock Expo SecureStore
jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock Expo Notifications
jest.mock("expo-notifications", () => ({
  requestPermissionsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
}));

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Mock Expo Haptics
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  NotificationFeedbackType: {
    Success: "success",
    Error: "error",
    Warning: "warning",
  },
  ImpactFeedbackStyle: {
    Light: "light",
    Medium: "medium",
    Heavy: "heavy",
  },
}));

// Mock Skia
jest.mock("@shopify/react-native-skia", () => ({
  Canvas: "Canvas",
  Rect: "Rect",
  Circle: "Circle",
  Group: "Group",
  LinearGradient: "LinearGradient",
  vec: (x: number, y: number) => ({ x, y }),
  useValue: (v: any) => ({ current: v }),
  useComputedValue: (f: any) => ({ current: f() }),
  useClockValue: () => ({ current: 0 }),
  runTiming: jest.fn(),
  Easing: {
    linear: (t: number) => t,
    inOut: (f: any) => f,
  },
  Skia: {
    RuntimeEffect: {
      Make: jest.fn().mockReturnValue({}),
    },
    Paint: jest.fn().mockReturnValue({}),
    Color: jest.fn(),
  },
}));

// Mock expo-linking
jest.mock("expo-linking", () => ({
  createURL: (path: string) => `alfred://${path}`,
  parse: jest.fn(),
  addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  getInitialURLAsync: jest.fn(),
}));

// Mock Better Auth
jest.mock("@better-auth/expo", () => ({
  expoClient: jest.fn(),
}));

jest.mock("@better-auth/expo/client", () => ({
  expoClient: jest.fn(),
}));

jest.mock("better-auth/react", () => ({
  createAuthClient: jest.fn().mockReturnValue({
    useSession: jest.fn().mockReturnValue({ data: null, isLoading: false }),
    signIn: {
      email: jest.fn(),
    },
    signOut: jest.fn(),
  }),
}));
