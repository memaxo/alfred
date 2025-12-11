// #region agent log
// React shim that adds useEffectEvent polyfill for fumadocs-ui compatibility
// fumadocs-ui imports useEffectEvent from 'react' but React 19.1.0 stable doesn't export it
// This shim uses @radix-ui/react-use-effect-event's implementation as a polyfill
// #endregion

// Import and re-export React (using import/export pattern compatible with @types/react)
import React from "react";

// Import the polyfill from radix-ui (which has a working implementation)
import { useEffectEvent as useEffectEventPolyfill } from "@radix-ui/react-use-effect-event";

// Export the polyfill as useEffectEvent
export const useEffectEvent = useEffectEventPolyfill;

// Re-export default and commonly used exports
export default React;
export {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useContext,
  useReducer,
  useLayoutEffect,
  useImperativeHandle,
  useDebugValue,
  useDeferredValue,
  useTransition,
  useId,
  useSyncExternalStore,
  useInsertionEffect,
  createContext,
  createElement,
  createRef,
  forwardRef,
  lazy,
  memo,
  startTransition,
  Children,
  Component,
  Fragment,
  Profiler,
  PureComponent,
  StrictMode,
  Suspense,
  cloneElement,
  isValidElement,
  version,
} from "react";

// Re-export types
export type {
  FC,
  ReactNode,
  ReactElement,
  ComponentType,
  ComponentProps,
  PropsWithChildren,
  PropsWithRef,
  RefObject,
  MutableRefObject,
  Ref,
  ForwardedRef,
  Context,
  Dispatch,
  SetStateAction,
  ReducerState,
  CSSProperties,
  HTMLAttributes,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  FormHTMLAttributes,
  SVGAttributes,
  MouseEvent,
  KeyboardEvent,
  FormEvent,
  ChangeEvent,
  FocusEvent,
  SyntheticEvent,
} from "react";
