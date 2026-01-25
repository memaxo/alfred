import type { TextInputProps as RNTextInputProps } from "react-native";

import React, { useState } from "react";
import { StyleSheet, TextInput as RNTextInput, View } from "react-native";

import { useVoidTheme } from "../../hooks/use-void-theme";
import { CaptionText } from "../foundation/BiolumText";
import { FormField } from "../genui/FormField";

export interface TextInputProps extends Omit<RNTextInputProps, "onChange"> {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  showCharacterCount?: boolean;
  onChange?: (text: string) => void;
}

export function TextInput({
  label,
  error,
  hint,
  required = false,
  showCharacterCount = false,
  value,
  maxLength,
  multiline = false,
  onChange,
  ...props
}: TextInputProps) {
  const theme = useVoidTheme();
  const [focused, setFocused] = useState(false);

  return (
    <FormField
      label={label}
      error={error}
      hint={hint}
      required={required}
      focused={focused}
      hasValue={!!value && value.length > 0}
    >
      <View style={styles.inputContainer}>
        <RNTextInput
          style={[
            styles.input,
            multiline && styles.multiline,
            { color: theme.colors.biolum.standard },
          ]}
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor={theme.colors.biolum.faint}
          selectionColor={theme.colors.biolum.standard}
          cursorColor={theme.colors.biolum.full}
          multiline={multiline}
          maxLength={maxLength}
          {...props}
        />
        {showCharacterCount && maxLength && (
          <CaptionText size="small" color="faint" style={styles.charCount}>
            {value?.length ?? 0}/{maxLength}
          </CaptionText>
        )}
      </View>
    </FormField>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    position: "relative",
  },
  input: {
    fontSize: 16,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 14,
    minHeight: 48,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: "top",
    paddingTop: 16,
  },
  charCount: {
    position: "absolute",
    right: 12,
    bottom: 8,
  },
});

export default TextInput;
