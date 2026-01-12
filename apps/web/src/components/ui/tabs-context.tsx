import * as React from "react";

export type TabsContextValue = {
  value: string;
  onValueChange: (value: string) => void;
};

export const TabsContext = React.createContext<TabsContextValue | null>(null);
