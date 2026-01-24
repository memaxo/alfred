import { Stack } from "expo-router";

import { useVoidTheme } from "@/hooks/use-void-theme";

export default function LibraryLayout() {
  const theme = useVoidTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.void.deep,
        },
        headerTintColor: theme.colors.biolum.full,
        headerTitleStyle: {
          color: theme.colors.biolum.full,
        },
        contentStyle: {
          backgroundColor: theme.colors.void.deep,
        },
      }}
    >
      <Stack.Screen name="notes" options={{ title: "Notes" }} />
      <Stack.Screen name="reminders" options={{ title: "Reminders" }} />
      <Stack.Screen name="timers" options={{ title: "Timers" }} />
      <Stack.Screen name="bookmarks" options={{ title: "Bookmarks" }} />
    </Stack>
  );
}
