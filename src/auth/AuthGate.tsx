import { useRouter, useSegments, type Href } from "expo-router";
import { useEffect } from "react";

import { useAuth } from "@/src/auth/AuthContext";

// Centralized route protection.
// Runs on every navigation and enforces:
// - onboarding must be completed before any other route
// - unauthenticated users can only be in (public)
// - authenticated users cannot go back to (public) screens
export function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const { user, isLoading, hasSeenOnboarding } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    // typedRoutes note: segments is typed based on the generated router types.
    // We keep this guard flexible to avoid dev-time stale unions.
    const [group] = segments as string[]; // first segment is the route group like "(public)" / "(private)"
    const inPublicGroup = group === "(public)";
    const inPrivateGroup = group === "(private)";

    // 1) Onboarding should always run first (only once)
    if (!hasSeenOnboarding) {
      const second = (segments as string[])[1];
      if (!(inPublicGroup && second === "onboarding")) {
        router.replace("/(public)/onboarding" as Href);
      }
      return;
    }

    // 2) If not logged in, keep the user in public auth screens
    if (!user) {
      if (inPrivateGroup) {
        router.replace("/(public)/login" as Href);
      }
      return;
    }

    // 3) If logged in, never allow going back to public routes
    if (user && inPublicGroup) {
      router.replace("/(private)/(tabs)/newsFeed" as Href);
    }
  }, [segments, user, isLoading, hasSeenOnboarding, router]);

  return null;
}
