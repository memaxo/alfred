// #region agent log
// React shim that adds useEffectEvent polyfill for fumadocs-ui compatibility
// fumadocs-ui imports useEffectEvent from 'react' but React 19.1.0 stable doesn't export it
// This shim uses @radix-ui/react-use-effect-event's implementation as a polyfill
// #endregion

// Import the polyfill from radix-ui (which has a working implementation)
import { useEffectEvent as useEffectEventPolyfill } from "@radix-ui/react-use-effect-event";
// Import and re-export React (using import/export pattern compatible with @types/react)
import React from "react";

// Export the polyfill as useEffectEvent
export const useEffectEvent = useEffectEventPolyfill;

// Re-export default and commonly used exports
export default React;

// Re-export types
export type {
  ButtonHTMLAttributes,
  ChangeEvent,
  ComponentProps,
  ComponentType,
  Context,
  CSSProperties,
  Dispatch,
  FC,
  FocusEvent,
  FormEvent,
  FormHTMLAttributes,
  ForwardedRef,
  HTMLAttributes,
  InputHTMLAttributes,
  KeyboardEvent,
  MouseEvent,
  MutableRefObject,
  PropsWithChildren,
  PropsWithRef,
  ReactElement,
  ReactNode,
  ReducerState,
  Ref,
  RefObject,
  SetStateAction,
  SVGAttributes,
  SyntheticEvent,
} from "react";
export {
  Children,
  Component,
  cloneElement,
  createContext,
  createElement,
  createRef,
  Fragment,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  Profiler,
  PureComponent,
  StrictMode,
  Suspense,
  startTransition,
  useCallback,
  useContext,
  useDebugValue,
  useDeferredValue,
  useEffect,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  version,
} from "react";
