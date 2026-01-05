Object.defineProperty(globalThis, "__ExpoImportMetaRegistry", {
  value: { url: null },
  configurable: true,
  writable: true,
});

Object.defineProperty(globalThis, "structuredClone", {
  value: (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown,
  configurable: true,
  writable: true,
});

require("react-native-gesture-handler/jestSetup");

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

jest.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync: jest.fn(),
    Sound: {
      createAsync: jest.fn(),
    },
  },
}));

jest.mock("expo-file-system", () => ({
  deleteAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  EncodingType: {
    Base64: "base64",
  },
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
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
  Line: "Line",
  Fill: "Fill",
  Paint: "Paint",
  Blur: "Blur",
  BlurMask: "BlurMask",
  Shader: "Shader",
  LinearGradient: "LinearGradient",
  RadialGradient: "RadialGradient",
  vec: (x: number, y: number) => ({ x, y }),
  // biome-ignore lint/suspicious/noExplicitAny: mock
  useValue: (v: any) => ({ current: v }),
  // biome-ignore lint/suspicious/noExplicitAny: mock
  useComputedValue: (f: any) => ({ current: f() }),
  useClock: () => ({ value: 0 }),
  useClockValue: () => ({ current: 0 }),
  runTiming: jest.fn(),
  Easing: {
    linear: (t: number) => t,
    // biome-ignore lint/suspicious/noExplicitAny: mock
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
  parse: (url: string) => {
    try {
      if (url.startsWith("alfred://")) {
        return { path: url.slice("alfred://".length) };
      }

      const u = new URL(url);
      return { path: u.pathname.replace(/^\//, "") };
    } catch {
      return { path: undefined };
    }
  },
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
    getCookie: jest.fn().mockReturnValue(""),
    useSession: jest.fn().mockReturnValue({ data: null, isLoading: false }),
    signIn: {
      email: jest.fn(),
      passkey: jest.fn(),
    },
    signOut: jest.fn(),
    passkey: {
      addPasskey: jest.fn(),
      listUserPasskeys: jest.fn(),
      deletePasskey: jest.fn(),
      updatePasskey: jest.fn(),
    },
  }),
}));
