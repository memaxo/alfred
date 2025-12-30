/**
 * JARVIS-Style HUD Components
 *
 * Holographic UI elements inspired by Iron Man's JARVIS interface.
 * Provides ambient status, proactive notifications, and data visualization.
 *
 * @module hud
 */

export type {
  AmbientNotificationProps,
  NotificationType,
} from "./ambient-notification";
// Notifications
export {
  AmbientNotification,
  NotificationStack,
  useNotifications,
} from "./ambient-notification";
export type { DataStreamProps } from "./data-stream";
// Data visualization
export { DataBar, DataRing, DataStream } from "./data-stream";
export type { JarvisHUDConfig } from "./jarvis-hud";
// Unified JARVIS HUD
export {
  JarvisGreeting,
  JarvisHUDProvider,
  JarvisStatus,
  useJarvis,
} from "./jarvis-hud";
export type { StatusItem, StatusLevel, StatusPanelProps } from "./status-panel";
// Status display
export { StatusIndicator, StatusPanel } from "./status-panel";
