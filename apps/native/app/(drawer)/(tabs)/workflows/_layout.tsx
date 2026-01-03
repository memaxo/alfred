/**
 * Workflows Layout
 *
 * Handles nested routing for Workflow screens.
 */

import { Stack } from "expo-router";

export default function WorkflowsLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="[id]"
        options={{
          presentation: "card",
        }}
      />
    </Stack>
  );
}
