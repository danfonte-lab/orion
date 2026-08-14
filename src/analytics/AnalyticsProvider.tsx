import { captureException } from "@/src/monitoring/sentry";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";
import { PostHogProvider, usePostHog } from "posthog-react-native";

type AnalyticsProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

type AnalyticsContextValue = {
  isEnabled: boolean;
  capture: (event: string, properties?: AnalyticsProperties) => void;
  identify: (userId: string, properties?: AnalyticsProperties) => void;
};

const DISABLED_ANALYTICS: AnalyticsContextValue = {
  isEnabled: false,
  capture: () => {},
  identify: () => {},
};

const POSTHOG_HOST = "https://us.i.posthog.com";
const analyticsEnabled = process.env.EXPO_PUBLIC_ANALYTICS_ENABLED === "true";
const postHogApiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;

const AnalyticsContext =
  createContext<AnalyticsContextValue>(DISABLED_ANALYTICS);

function AnalyticsBridge({ children }: PropsWithChildren) {
  const posthog = usePostHog();

  const capture = useCallback(
    (event: string, properties?: AnalyticsProperties) => {
      posthog.capture(event, properties);
    },
    [posthog],
  );

  const identify = useCallback(
    (userId: string, properties?: AnalyticsProperties) => {
      posthog.identify(userId, properties);
    },
    [posthog],
  );

  const value = useMemo<AnalyticsContextValue>(
    () => ({
      isEnabled: true,
      capture,
      identify,
    }),
    [capture, identify],
  );

  return (
    <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>
  );
}

export function AnalyticsProvider({ children }: PropsWithChildren) {
  if (!analyticsEnabled) {
    return (
      <AnalyticsContext.Provider value={DISABLED_ANALYTICS}>
        {children}
      </AnalyticsContext.Provider>
    );
  }

  if (!postHogApiKey) {
    captureException(new Error("Analytics enabled but PostHog key is missing"), {
      scope: "analytics_provider",
      action: "missing_posthog_key",
    });
    return (
      <AnalyticsContext.Provider value={DISABLED_ANALYTICS}>
        {children}
      </AnalyticsContext.Provider>
    );
  }

  return (
    <PostHogProvider apiKey={postHogApiKey} options={{ host: POSTHOG_HOST }}>
      <AnalyticsBridge>{children}</AnalyticsBridge>
    </PostHogProvider>
  );
}

export function useAnalytics() {
  return useContext(AnalyticsContext);
}
