import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";
import React, { useCallback, useState } from "react";
import { StyleSheet, View, Pressable, Modal, TextInput } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";
import { BiolumText, CaptionText } from "../foundation/BiolumText";
import { HUDSurface } from "../foundation/HUDSurface";
import { FormField } from "./FormField";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface SelectProps {
  label: string;
  options: SelectOption[];
  value?: string;
  placeholder?: string;
  onChange: (value: string) => void;
  error?: string;
  searchable?: boolean;
  required?: boolean;
}

export function Select({
  label,
  options,
  value,
  placeholder = "Select an option",
  onChange,
  error,
  searchable = false,
  required = false,
}: SelectProps) {
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions =
    searchable && searchQuery
      ? options.filter(
          (opt) =>
            opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            opt.description?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : options;

  const handleSelect = useCallback(
    (optionValue: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onChange(optionValue);
      setModalVisible(false);
      setSearchQuery("");
    },
    [onChange]
  );

  const renderOptionItem = useCallback(
    ({ item }: { item: SelectOption }) => {
      const isSelected = item.value === value;

      return (
        <Pressable
          onPress={() => handleSelect(item.value)}
          style={[
            styles.optionItem,
            isSelected && { backgroundColor: theme.colors.glass.hover },
          ]}
        >
          <View style={styles.optionContent}>
            <BiolumText
              variant="body"
              size="medium"
              color={isSelected ? "full" : "standard"}
            >
              {item.label}
            </BiolumText>
            {item.description && (
              <CaptionText size="small" color="dim">
                {item.description}
              </CaptionText>
            )}
          </View>
          {isSelected && (
            <Ionicons
              name="checkmark"
              size={20}
              color={theme.colors.semantic.success}
            />
          )}
        </Pressable>
      );
    },
    [value, theme, handleSelect]
  );

  return (
    <>
      <FormField
        label={label}
        error={error}
        required={required}
        focused={modalVisible}
        hasValue={!!value}
      >
        <Pressable
          onPress={() => setModalVisible(true)}
          style={styles.selectButton}
          accessibilityRole="combobox"
        >
          <BiolumText
            variant="body"
            size="medium"
            color={selectedOption ? "standard" : "faint"}
          >
            {selectedOption?.label ?? placeholder}
          </BiolumText>
          <Ionicons
            name="chevron-down"
            size={18}
            color={theme.colors.biolum.dim}
          />
        </Pressable>
      </FormField>

      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={() => setModalVisible(false)}
      >
        <Animated.View
          entering={!reduceMotion ? FadeIn : undefined}
          exiting={!reduceMotion ? FadeOut : undefined}
          style={[
            styles.modalOverlay,
            { backgroundColor: "rgba(0, 0, 0, 0.7)" },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setModalVisible(false)}
          />
          <Animated.View
            entering={!reduceMotion ? SlideInDown : undefined}
            exiting={!reduceMotion ? SlideOutDown : undefined}
            style={styles.modalContent}
          >
            <HUDSurface elevation={3} style={styles.pickerContainer}>
              <View style={styles.pickerHeader}>
                <BiolumText variant="title" size="medium" color="full">
                  {label}
                </BiolumText>
                <Pressable onPress={() => setModalVisible(false)}>
                  <Ionicons
                    name="close"
                    size={24}
                    color={theme.colors.biolum.dim}
                  />
                </Pressable>
              </View>

              {searchable && (
                <View
                  style={[
                    styles.searchContainer,
                    { backgroundColor: theme.colors.glass.surface },
                  ]}
                >
                  <Ionicons
                    name="search"
                    size={18}
                    color={theme.colors.biolum.faint}
                  />
                  <TextInput
                    style={[
                      styles.searchInput,
                      { color: theme.colors.biolum.standard },
                    ]}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search..."
                    placeholderTextColor={theme.colors.biolum.faint}
                  />
                </View>
              )}

              <FlashList
                data={filteredOptions}
                keyExtractor={(item) => item.value}
                style={styles.optionsList}
                // @ts-expect-error - estimatedItemSize exists at runtime but not in types for v2.2.0
                estimatedItemSize={50}
                renderItem={renderOptionItem}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <CaptionText size="medium" color="dim">
                      No options found
                    </CaptionText>
                  </View>
                }
              />
            </HUDSurface>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    maxHeight: "70%",
  },
  pickerContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: "hidden",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: 12,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  optionsList: {
    maxHeight: 400,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  optionContent: {
    flex: 1,
    gap: 2,
  },
  emptyContainer: {
    padding: 24,
    alignItems: "center",
  },
});

export default Select;
