// #region agent log
// React shim that adds useEffectEvent polyfill for fumadocs-ui compatibility
// fumadocs-ui imports useEffectEvent from 'react' but React 19.1.0 stable doesn't export it
// This shim uses @radix-ui/react-use-effect-event's implementation as a polyfill
// #endregion

// Re-export everything from react
export * from "react";

// Import the polyfill from radix-ui (which has a working implementation)
import { useEffectEvent as useEffectEventPolyfill } from "@radix-ui/react-use-effect-event";

// Export the polyfill as useEffectEvent
export const useEffectEvent = useEffectEventPolyfill;

// Re-export default
export { default } from "react";
