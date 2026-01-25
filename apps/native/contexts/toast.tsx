import type { ReactNode } from "react";

import React, { createContext, useContext, useState, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ToastType } from "../components/utility/Toast";

import { Toast } from "../components/utility/Toast";

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  show: (
    type: ToastType,
    title: string,
    message?: string,
    duration?: number
  ) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const insets = useSafeAreaInsets();

  const show = useCallback(
    (
      type: ToastType,
      title: string,
      message?: string,
      duration: number = 3000
    ) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      setToasts((prev) => {
        const newToasts = [...prev, { id, type, title, message, duration }];
        // Keep only the last MAX_TOASTS
        if (newToasts.length > MAX_TOASTS) {
          return newToasts.slice(-MAX_TOASTS);
        }
        return newToasts;
      });
    },
    []
  );

  const success = useCallback(
    (title: string, message?: string) => {
      show("success", title, message);
    },
    [show]
  );

  const error = useCallback(
    (title: string, message?: string) => {
      show("error", title, message, 5000); // Errors stay longer
    },
    [show]
  );

  const warning = useCallback(
    (title: string, message?: string) => {
      show("warning", title, message, 4000);
    },
    [show]
  );

  const info = useCallback(
    (title: string, message?: string) => {
      show("info", title, message);
    },
    [show]
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider
      value={{ show, success, error, warning, info, dismiss, dismissAll }}
    >
      {children}
      <View
        style={[styles.container, { top: insets.top }]}
        pointerEvents="box-none"
      >
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            id={toast.id}
            type={toast.type}
            title={toast.title}
            message={toast.message}
            duration={toast.duration}
            onDismiss={dismiss}
          />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 9999,
    gap: 8,
  },
});

export default ToastProvider;
