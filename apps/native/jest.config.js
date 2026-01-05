const path = require("node:path");
const babelConfigPath = path.resolve(__dirname, "babel.config.js");
const monorepoRoot = path.resolve(__dirname, "../..");

module.exports = {
  preset: "jest-expo",
  rootDir: __dirname,
  setupFilesAfterEnv: [
    "@testing-library/jest-native/extend-expect",
    "<rootDir>/test-jest/setup.ts",
  ],
  testMatch: ["<rootDir>/test-jest/**/*.test.{ts,tsx}"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@shopify/react-native-skia|@better-auth|better-auth)",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@better-auth/expo/(.*)$": `${monorepoRoot}/node_modules/@better-auth/expo/dist/$1`,
    "^@alfred/metrics/(.*)$": `${monorepoRoot}/packages/metrics/src/$1`,
    "^@alfred/voice/transport$": `${monorepoRoot}/packages/voice/src/transport/trpc.ts`,
    "^@alfred/voice/(.*)$": `${monorepoRoot}/packages/voice/src/$1`,
    "^@alfred/type/(.*)$": `${monorepoRoot}/packages/type/src/$1`,
    "^@alfred/ui/(.*)$": `${monorepoRoot}/packages/ui/src/$1`,
  },
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": ["babel-jest", { configFile: babelConfigPath }],
  },
  testPathIgnorePatterns: [
    "/node_modules/",
    "/e2e/",
    "setup.ts",
    "mock-factories.ts",
  ],
};
