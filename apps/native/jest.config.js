module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: [
    "@testing-library/jest-native/extend-expect",
    "./__tests__/setup.ts",
  ],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@shopify/react-native-skia|@better-auth|better-auth)",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@better-auth/expo/(.*)$":
      "<rootDir>/../../node_modules/@better-auth/expo/dist/$1",
    "^@alfred/metrics/(.*)$": "<rootDir>/../../packages/metrics/src/$1",
    "^@alfred/voice/(.*)$": "<rootDir>/../../packages/voice/src/$1",
    "^@alfred/type/(.*)$": "<rootDir>/../../packages/type/src/$1",
    "^@alfred/ui/(.*)$": "<rootDir>/../../packages/ui/src/$1",
  },
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": "babel-jest",
  },
  testPathIgnorePatterns: [
    "/node_modules/",
    "/e2e/",
    "setup.ts",
    "mock-factories.ts",
  ],
};
