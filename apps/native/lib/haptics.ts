/**
 * Haptic Feedback Utilities
 *
 * Provides haptic feedback for important user actions.
 */

import * as Haptics from "expo-haptics";

export const haptics = {
  /**
   * Light impact feedback for subtle actions
   */
  light: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
      // Ignore errors on platforms that don't support haptics
    });
  },

  /**
   * Medium impact feedback for standard actions
   */
  medium: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {
      // Ignore errors
    });
  },

  /**
   * Heavy impact feedback for important actions
   */
  heavy: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {
      // Ignore errors
    });
  },

  /**
   * Success notification feedback
   */
  success: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {
        // Ignore errors
      }
    );
  },

  /**
   * Warning notification feedback
   */
  warning: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => {
        // Ignore errors
      }
    );
  },

  /**
   * Error notification feedback
   */
  error: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
      () => {
        // Ignore errors
      }
    );
  },

  /**
   * Selection feedback for picker/selector changes
   */
  selection: () => {
    Haptics.selectionAsync().catch(() => {
      // Ignore errors
    });
  },
};
