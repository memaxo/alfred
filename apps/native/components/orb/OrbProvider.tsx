import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

import { FloatingOrb } from "./FloatingOrb";
import { QuickActionsOverlay } from "./QuickActionsOverlay";

interface OrbContextValue {
  showOrb: boolean;
  setShowOrb: (show: boolean) => void;
  isExpanded: boolean;
  expand: () => void;
  collapse: () => void;
}

const OrbContext = createContext<OrbContextValue | null>(null);

export function useOrb() {
  const ctx = useContext(OrbContext);
  if (!ctx) {
    throw new Error("useOrb must be used within OrbProvider");
  }
  return ctx;
}

interface OrbProviderProps {
  children: ReactNode;
}

export function OrbProvider({ children }: OrbProviderProps) {
  const [showOrb, setShowOrb] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const expand = useCallback(() => setIsExpanded(true), []);
  const collapse = useCallback(() => setIsExpanded(false), []);

  const handleOrbPress = useCallback(() => {
    // Start voice session - navigate to call screen
    // This will be handled by the caller via navigation
  }, []);

  const handleOrbLongPress = useCallback(() => {
    expand();
  }, [expand]);

  return (
    <OrbContext.Provider
      value={{ showOrb, setShowOrb, isExpanded, expand, collapse }}
    >
      {children}
      {showOrb && (
        <>
          <FloatingOrb
            onPress={handleOrbPress}
            onLongPress={handleOrbLongPress}
          />
          <QuickActionsOverlay visible={isExpanded} onClose={collapse} />
        </>
      )}
    </OrbContext.Provider>
  );
}
