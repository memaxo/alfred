import GorhomBottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import React, { useCallback, useMemo } from "react";
import { StyleSheet, View, Pressable } from "react-native";

import { useVoidTheme } from "../../hooks/use-void-theme";

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  snapPoints?: (string | number)[];
  children: React.ReactNode;
  enablePanDownToClose?: boolean;
  showHandle?: boolean;
}

export function BottomSheet({
  isOpen,
  onClose,
  snapPoints: customSnapPoints,
  children,
  enablePanDownToClose = true,
  showHandle = true,
}: BottomSheetProps) {
  const theme = useVoidTheme();
  const bottomSheetRef = React.useRef<GorhomBottomSheet>(null);

  const snapPoints = useMemo(
    () => customSnapPoints ?? ["50%", "90%"],
    [customSnapPoints]
  );

  React.useEffect(() => {
    if (isOpen) {
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [isOpen]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
        opacity={0.7}
      />
    ),
    []
  );

  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <GorhomBottomSheet
      ref={bottomSheetRef}
      index={isOpen ? 0 : -1}
      snapPoints={snapPoints}
      enablePanDownToClose={enablePanDownToClose}
      onChange={handleSheetChanges}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: theme.colors.void.raised,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.colors.biolum.faint,
        width: 36,
        height: 4,
        borderRadius: 2,
        display: showHandle ? "flex" : "none",
      }}
      style={styles.sheet}
    >
      <BottomSheetView style={styles.contentContainer}>
        {children}
      </BottomSheetView>
    </GorhomBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  contentContainer: {
    flex: 1,
  },
});

export default BottomSheet;
