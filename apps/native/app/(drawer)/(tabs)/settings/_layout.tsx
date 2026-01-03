/**
 * Settings Layout
 *
 * Handles nested routing for Settings screens.
 */

import { Stack } from "expo-router";

export default function SettingsLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="preferences"
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="privacy"
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="voice"
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="memory"
        options={{
          presentation: "card",
        }}
      />
    </Stack>
  );
}
