/**
 * Library Layout
 *
 * Handles nested routing for Library features (Notes, Reminders, Timers, Bookmarks).
 */

import { Stack } from "expo-router";

export default function LibraryLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="notes"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="notes/[id]"
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="notes/new"
        options={{
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="reminders"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="reminders/[id]"
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="reminders/new"
        options={{
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="timers"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="bookmarks"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
