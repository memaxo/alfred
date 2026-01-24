import React from "react";
import { StyleSheet, View } from "react-native";

import { useVoidTheme } from "../../hooks/use-void-theme";
import { BiolumText, CaptionText } from "../foundation/BiolumText";
import { FluidButton } from "../foundation/FluidButton";
import { HUDSurface } from "../foundation/HUDSurface";

export interface ConfirmOption {
  id: string;
  label: string;
  variant?: "primary" | "secondary" | "ghost";
}

export interface ConfirmProps {
  title: string;
  message?: string;
  options: ConfirmOption[];
  onSelect: (optionId: string) => void;
  disabled?: boolean;
}

export function Confirm({
  title,
  message,
  options,
  onSelect,
  disabled = false,
}: ConfirmProps) {
  const theme = useVoidTheme();

  return (
    <HUDSurface elevation={2} style={styles.container}>
      <BiolumText variant="title" size="medium" color="full">
        {title}
      </BiolumText>
      {message && (
        <CaptionText size="large" color="dim" style={styles.message}>
          {message}
        </CaptionText>
      )}
      <View style={styles.buttonContainer}>
        {options.map((option, index) => (
          <FluidButton
            key={option.id}
            label={option.label}
            variant={option.variant ?? (index === 0 ? "primary" : "secondary")}
            size="large"
            onPress={() => onSelect(option.id)}
            disabled={disabled}
            style={styles.button}
          />
        ))}
      </View>
    </HUDSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginVertical: 8,
  },
  message: {
    marginTop: 8,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
  },
});

export default Confirm;
