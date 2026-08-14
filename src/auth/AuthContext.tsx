import * as SplashScreen from "expo-splash-screen";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  clearStoredTokens,
  clearStoredAccessToken,
  clearStoredUser,
  clearSessionNotice,
  clearHasSeenOnboarding,
  clearUseBiometrics,
  getHasSeenOnboarding,
  getStoredAccessTokenExpiry,
  getStoredTokens,
  getStoredRefreshToken,
  getStoredUser,
  getUseBiometrics,
  setHasSeenOnboarding,
  setSessionNotice,
  setStoredTokens,
  setStoredUser,
  clearThemePreference,
  setUseBiometrics,
} from "@/src/auth/auth-storage";
import { registerSessionExpiredHandler } from "@/src/auth/auth-session";
import { captureException } from "@/src/monitoring/sentry";
import { clearRoutesConfigCache } from "@/src/services/accessControlService";
import {
  clearApiBaseUrlOverride,
  setApiBaseUrlForUsername,
} from "@/src/services/apiBaseUrl";
import { clearNewsFeedCache } from "@/src/services/newsFeedService";
import { clearTaskCache } from "@/src/services/taskService";
import { setAuthRequestTraceActive } from "@/src/services/apiClient";
import { User } from "../models/user";
import authService, { refreshAccessToken } from "../services/authService";
import profileService, { clearCachedEmployeeProfile } from "../services/profileService";

type AuthContextValue = {
  // REQUIRED by spec
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;

  // Profile updates
  updateProfilePicture: (nextProfilePicture: string) => Promise<void>;

  // Needed for onboarding gating / route protection.
  hasSeenOnboarding: boolean;
  completeOnboarding: () => Promise<void>;
  // Returns a valid access token, refreshing with refresh token if needed.
  getValidAccessToken?: () => Promise<string | null>;
  // Biometrics helpers
  isBiometricAvailable?: boolean;
  enableBiometrics?: (value: boolean) => Promise<void>;
  clearAllAuthStorage?: () => Promise<void>;
  finalizeClearedAuthState?: () => void;
  clearAllAuthData?: () => Promise<void>;
  // Resume session using stored tokens (used by biometric sign-in)
  resumeWithTokens?: () => Promise<
    | { ok: true }
    | {
        ok: false;
        reason:
          | "biometrics_disabled"
          | "missing_refresh_token"
          | "missing_user"
          | "refresh_failed";
      }
  >;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [hasSeenOnboarding, setHasSeenOnboardingState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        // Authentication checks: read persisted values.
        const [storedUser, seenOnboarding, storedTokens, biometrics] =
          await Promise.all([
          getStoredUser(),
          getHasSeenOnboarding(),
          getStoredTokens(),
          getUseBiometrics(),
        ]);

        // Check if biometrics are enabled for this account
        setIsBiometricAvailable(biometrics);

        if (!isMounted) return;
        setHasSeenOnboardingState(seenOnboarding);

        const accessTokenExpiry = await getStoredAccessTokenExpiry();
        const isAccessTokenValid =
          Boolean(storedTokens?.accessToken) &&
          Boolean(storedUser) &&
          Boolean(accessTokenExpiry && accessTokenExpiry > Date.now());

        if (isAccessTokenValid && storedUser) {
          setApiBaseUrlForUsername(storedUser.username);
          setAuthRequestTraceActive(true);
          setUser(storedUser);
          return;
        }

        if (storedTokens?.accessToken && accessTokenExpiry && accessTokenExpiry <= Date.now()) {
          await clearStoredAccessToken();
        }
      } catch (error) {
        captureException(error, {
          scope: "auth_context",
          action: "bootstrap",
        });
      } finally {
        // Stop loading and hide splash only after we know where to route the user.
        if (!isMounted) return;
        setIsLoading(false);
        SplashScreen.hideAsync().catch((error) => {
          captureException(error, {
            scope: "auth_context",
            action: "splash_hide",
          });
        });
      }
    }

    bootstrap();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleSessionExpired = async () => {
      try {
        await setSessionNotice("Your session expired. Please sign in again.");
        await clearStoredUser();
        await clearStoredTokens();
        clearCachedEmployeeProfile();
        clearNewsFeedCache();
        clearApiBaseUrlOverride();
        clearRoutesConfigCache();
        clearTaskCache();
        setAuthRequestTraceActive(false);
      } catch (error) {
        captureException(error, {
          scope: "auth_context",
          action: "session_expired_clear_storage",
        });
      } finally {
        setUser(null);
        setIsLoading(false);
      }
    };

    registerSessionExpiredHandler(handleSessionExpired);
    return () => {
      registerSessionExpiredHandler(null);
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    // Dummy login credentials per spec.
    //const isValid = email === "test@test.com" && password === "123456";
    setIsLoading(true);
    try {
      clearCachedEmployeeProfile();
      clearNewsFeedCache();
      setApiBaseUrlForUsername(email);
      setAuthRequestTraceActive(true);
      const res = await authService.authenticate(email, password);
      console.log("[auth] accessToken", res.tokens.accessToken);
      if (!res.user) {
        setAuthRequestTraceActive(false);
        return false;
      }

      await clearSessionNotice();
      clearRoutesConfigCache();
      clearTaskCache();

      // Persist fresh tokens before any authenticated follow-up request.
      const now = Date.now();
      const tokens = {
        accessToken: res.tokens.accessToken,
        refreshToken: res.tokens.refreshToken,
        accessTokenExpiry: now + 60_000,
      };
      await setStoredTokens(tokens);

      const profileResponse = await profileService.getEmployeeProfile(
        res.tokens.accessToken,
      );
      const profile = profileResponse.profile;
      const displayName =
        profile?.full_name?.trim() || profile?.preferred_name?.trim();

      const nextUser = {
        ...res.user,
        name: displayName,
      };
      await setStoredUser(nextUser);
      setApiBaseUrlForUsername(nextUser.username);
      setUser(nextUser);
      return true;
    } catch (err) {
      // Avoid partial auth state when post-login requests fail.
      setAuthRequestTraceActive(false);
      await clearStoredTokens();
      await clearStoredUser();
      setUser(null);
      captureException(err, {
        scope: "auth_context",
        action: "login",
      });
      throw err;
    }
    finally {
      setIsLoading(false);
    }
  };

  const enableBiometrics = async (value: boolean) => {
    // Persist the choice first, then update in-memory state. If the
    // persist fails the UI won't change.
    try {
      await setUseBiometrics(value);
      setIsBiometricAvailable(value);
    } catch (e) {
      captureException(e, {
        scope: "auth_context",
        action: "enable_biometrics",
        extras: { value },
      });
      throw e;
    }
  };

  // Helper: get a valid access token, refresh if expired (dummy refresh)
  const getValidAccessToken = useCallback(async (): Promise<string | null> => {
    // console.debug("getValidAccessToken: start");
    const tokens = await getStoredTokens();
    // console.debug("getValidAccessToken: tokens=", tokens);
    if (!tokens) return null;

    const now = Date.now();
    if (tokens.accessTokenExpiry > now) return tokens.accessToken;

    // Access token expired -> refresh via API using refreshToken
    try {
      console.debug("[auth] refreshing access token");
      console.debug("[auth] stored refresh token?", Boolean(tokens.refreshToken));
      const refreshed = await refreshAccessToken(tokens.refreshToken);
      const newTokens = {
        ...tokens,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        accessTokenExpiry: now + 60_000,
      };
      await setStoredTokens(newTokens);
      console.debug("[auth] refresh succeeded, tokens updated");
      return newTokens.accessToken;
    } catch (e) {
      captureException(e, {
        scope: "auth_context",
        action: "get_valid_access_token_refresh",
      });
      console.debug(
        "[auth] refresh failed",
        e instanceof Error ? e.message : e,
      );
      return null;
    }
  }, []);

  const resumeWithTokens = useCallback(async (): Promise<
    | { ok: true }
    | {
        ok: false;
        reason:
          | "biometrics_disabled"
          | "missing_refresh_token"
          | "missing_user"
          | "refresh_failed";
      }
  > => {
    // Attempt to resume session using stored tokens + user
    // console.debug("resumeWithTokens: starting");
    // Respect user's biometric opt-in flag: if they opted out, refuse to
    // resume with biometrics even if tokens exist on device.
    const biometricsEnabled = await getUseBiometrics();
    if (!biometricsEnabled) {
      return { ok: false, reason: "biometrics_disabled" };
    }
    const storedUser = await getStoredUser();
    if (!storedUser) return { ok: false, reason: "missing_user" };

    const now = Date.now();
    const activeTokens = await getStoredTokens();
    if (!activeTokens || activeTokens.accessTokenExpiry <= now) {
      const refreshToken = activeTokens?.refreshToken ?? (await getStoredRefreshToken());
      if (!refreshToken) {
        return { ok: false, reason: "missing_refresh_token" };
      }

      try {
        const refreshed = await refreshAccessToken(refreshToken);
        await setStoredTokens({
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          accessTokenExpiry: now + 60_000,
        });
      } catch (e) {
        captureException(e, {
          scope: "auth_context",
          action: "resume_with_tokens_refresh_failed",
        });
        return { ok: false, reason: "refresh_failed" };
      }
    }

    setApiBaseUrlForUsername(storedUser.username);
    setAuthRequestTraceActive(true);

    setUser(storedUser);
    return { ok: true };
  }, []);

  const logout = async () => {
    setIsLoading(true);
    try {
      clearApiBaseUrlOverride();
      clearCachedEmployeeProfile();
      clearNewsFeedCache();
      clearRoutesConfigCache();
      clearTaskCache();
      const biometricsEnabled = await getUseBiometrics();

      if (biometricsEnabled) {
        await clearStoredAccessToken();
      } else {
        await clearStoredUser();
        await clearStoredTokens();
      }
      setAuthRequestTraceActive(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfilePicture = useCallback(
    async (nextProfilePicture: string) => {
      // Persist + update state so every consumer re-renders (header, profile, etc.)
      if (!user) return;

      const nextUser: User = {
        ...user,
        profilePicture: nextProfilePicture,
      };

      setIsLoading(true);
      try {
        await setStoredUser(nextUser);
        setUser(nextUser);
      } finally {
        setIsLoading(false);
      }
    },
    [user],
  );

  const completeOnboarding = async () => {
    await setHasSeenOnboarding(true);
    setHasSeenOnboardingState(true);
  };

  const clearAllAuthStorage = useCallback(async () => {
    await clearStoredUser();
    await clearStoredTokens();
    await clearSessionNotice();
    await clearHasSeenOnboarding();
    await clearUseBiometrics();
    await clearThemePreference();
    clearCachedEmployeeProfile();
    clearNewsFeedCache();
    clearApiBaseUrlOverride();
    clearRoutesConfigCache();
    clearTaskCache();
  }, []);

  const finalizeClearedAuthState = useCallback(() => {
    setUser(null);
    setHasSeenOnboardingState(false);
    setIsBiometricAvailable(false);
    setIsLoading(false);
  }, []);

  const clearAllAuthData = useCallback(async () => {
    await clearAllAuthStorage();
    setAuthRequestTraceActive(false);
    finalizeClearedAuthState();
  }, [clearAllAuthStorage, finalizeClearedAuthState]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      login,
      logout,
      updateProfilePicture,
      hasSeenOnboarding,
      completeOnboarding,
      // expose helpers for components that need to make authenticated requests
      // (not part of original type, but cast via any where needed)

      // @ts-ignore
      getValidAccessToken,
      // expose biometric flag helpers
      // @ts-ignore
      isBiometricAvailable,
      // @ts-ignore
      enableBiometrics,
      // @ts-ignore
      clearAllAuthStorage,
      // @ts-ignore
      finalizeClearedAuthState,
      // @ts-ignore
      clearAllAuthData,
      // @ts-ignore
      resumeWithTokens,
    }),
    [
      user,
      isLoading,
      hasSeenOnboarding,
      updateProfilePicture,
      getValidAccessToken,
      isBiometricAvailable,
      resumeWithTokens,
      clearAllAuthStorage,
      finalizeClearedAuthState,
      clearAllAuthData,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
