import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { useAnalytics } from "@/src/analytics/AnalyticsProvider";

export function useScreenView(screen: string) {
  const { capture } = useAnalytics();

  useFocusEffect(
    useCallback(() => {
      capture("screen_view", { screen });
    }, [capture, screen]),
  );
}
