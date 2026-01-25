import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import type { ReactNode } from "react";

import BottomSheetLib, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";

import { useVoidTheme } from "../hooks/use-void-theme";

interface SheetContextValue {
  open: (content: ReactNode, snapPoints?: (string | number)[]) => void;
  close: () => void;
  isOpen: boolean;
}

const SheetContext = createContext<SheetContextValue | null>(null);

const DEFAULT_SNAP_POINTS = ["50%", "90%"];

export function SheetProvider({ children }: { children: ReactNode }) {
  const theme = useVoidTheme();
  const [content, setContent] = useState<ReactNode | null>(null);
  const [snapPoints, setSnapPoints] =
    useState<(string | number)[]>(DEFAULT_SNAP_POINTS);
  const [isOpen, setIsOpen] = useState(false);
  const sheetRef = useRef<BottomSheetLib>(null);

  const open = useCallback(
    (newContent: ReactNode, newSnapPoints?: (string | number)[]) => {
      setContent(newContent);
      setSnapPoints(newSnapPoints ?? DEFAULT_SNAP_POINTS);
      setIsOpen(true);
      // Delay expand to allow state update
      setTimeout(() => {
        sheetRef.current?.expand();
      }, 0);
    },
    []
  );

  const close = useCallback(() => {
    sheetRef.current?.close();
  }, []);

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      setIsOpen(false);
      setContent(null);
    }
  }, []);

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

  return (
    <SheetContext.Provider value={{ open, close, isOpen }}>
      {children}
      <BottomSheetLib
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
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
        }}
      >
        <BottomSheetView style={{ flex: 1 }}>{content}</BottomSheetView>
      </BottomSheetLib>
    </SheetContext.Provider>
  );
}

export function useSheet(): SheetContextValue {
  const context = useContext(SheetContext);
  if (!context) {
    throw new Error("useSheet must be used within a SheetProvider");
  }
  return context;
}

export default SheetProvider;
