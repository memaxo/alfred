/**
 * Analytics Module
 *
 * Provides analytics tracking for user behavior.
 * Currently a no-op implementation - add PostHog or other providers as needed.
 *
 * To enable PostHog analytics:
 * 1. Run: bun add posthog-react-native
 * 2. Set EXPO_PUBLIC_POSTHOG_KEY in your .env
 * 3. Uncomment the PostHog implementation below
 */

declare const __DEV__: boolean;

type AnalyticsEvent = {
  name: string;
  properties?: Record<string, unknown>;
};

type AnalyticsUser = {
  id: string;
  email?: string;
  name?: string;
};

class Analytics {
  private enabled = false;
  private userId: string | null = null;

  /**
   * Initialize analytics (call this after user logs in)
   */
  async initialize(userId: string, _userProperties?: Partial<AnalyticsUser>) {
    this.enabled = process.env.EXPO_PUBLIC_ANALYTICS_ENABLED === "true";
    if (!this.enabled) {
      return;
    }

    this.userId = userId;

    // Analytics initialization - add providers here when needed
    if (__DEV__) {
    }
  }

  /**
   * Track an event
   */
  track(_event: AnalyticsEvent) {
    if (!this.enabled) {
      return;
    }

    // Log events in dev mode for debugging
    if (__DEV__) {
    }

    // Add analytics providers here (PostHog, Mixpanel, etc.)
  }

  /**
   * Set user properties
   */
  identify(userId: string, _properties?: Partial<AnalyticsUser>) {
    if (!this.enabled) {
      return;
    }

    this.userId = userId;

    if (__DEV__) {
    }
  }

  /**
   * Track screen view
   */
  screen(name: string, properties?: Record<string, unknown>) {
    this.track({
      name: "screen_view",
      properties: {
        screen_name: name,
        ...properties,
      },
    });
  }

  /**
   * Reset analytics (call on logout)
   */
  reset() {
    if (!this.enabled) {
      return;
    }

    if (__DEV__) {
    }

    this.userId = null;
  }
}

export const analytics = new Analytics();

// Convenience functions
export const trackEvent = (
  name: string,
  properties?: Record<string, unknown>
) => {
  analytics.track({ name, properties });
};

export const trackScreen = (
  name: string,
  properties?: Record<string, unknown>
) => {
  analytics.screen(name, properties);
};
