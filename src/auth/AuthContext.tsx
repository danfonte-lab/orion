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
  clearStoredUser,
  clearSessionNotice,
  getHasSeenOnboarding,
  getStoredTokens,
  getStoredUser,
  getUseBiometrics,
  setHasSeenOnboarding,
  setSessionNotice,
  setStoredTokens,
  setStoredUser,
  setUseBiometrics,
} from "@/src/auth/auth-storage";
import { registerSessionExpiredHandler } from "@/src/auth/auth-session";
import { captureException } from "@/src/monitoring/sentry";
import { clearRoutesConfigCache } from "@/src/services/accessControlService";
import { clearTaskCache } from "@/src/services/taskService";
import { User } from "../models/user";
import authService, { refreshAccessToken } from "../services/authService";
import profileService from "../services/profileService";

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
  // Resume session using stored tokens (used by biometric sign-in)
  resumeWithTokens?: () => Promise<boolean>;
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
        const [storedUser, seenOnboarding] = await Promise.all([
          getStoredUser(),
          getHasSeenOnboarding(),
        ]);

        // Check if biometrics are enabled for this account
        const biometrics = await getUseBiometrics();
        setIsBiometricAvailable(biometrics);

        if (!isMounted) return;
        setUser(storedUser);
        setHasSeenOnboardingState(seenOnboarding);
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
        clearRoutesConfigCache();
        clearTaskCache();
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
      const res = await authService.authenticate(email, password);
      console.log("[auth] accessToken", res.tokens.accessToken);
      if (!res.user) return false;

      await clearSessionNotice();
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
      setUser(nextUser);
      return true;
    } catch (err) {
      // Avoid partial auth state when post-login requests fail.
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
      if (!value) {
        try {
          await clearStoredTokens();
        } catch (e) {
          captureException(e, {
            scope: "auth_context",
            action: "enable_biometrics_clear_tokens",
            extras: { value },
          });
        }
      }
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

  const resumeWithTokens = useCallback(async (): Promise<boolean> => {
    // Attempt to resume session using stored tokens + user
    // console.debug("resumeWithTokens: starting");
    // Respect user's biometric opt-in flag: if they opted out, refuse to
    // resume with biometrics even if tokens exist on device.
    const biometricsEnabled = await getUseBiometrics();
    if (!biometricsEnabled) {
      return false;
    }
    // First try to read stored tokens. If none are present (could happen
    // if tokens were cleared), try to recover a session using the stored
    // user by issuing a dummy token set so the biometric flow can resume.
    const tokens = await getStoredTokens();
    // console.debug("resumeWithTokens: stored tokens:", tokens);

    if (!tokens) {
      return false;
    }

    // If tokens exist, ensure we have a valid access token (refresh if needed)
    const token = await getValidAccessToken();
    // console.debug("resumeWithTokens: getValidAccessToken returned:", token);
    // If we couldn't refresh (no token), fail. Otherwise, ensure a stored
    // user exists (create a fallback if necessary) and resume the in-memory
    // session. This makes the biometric resume resilient to prior clear
    // operations while preserving the refreshToken security model.
    if (!token) {
      return false;
    }

    const storedUser = await getStoredUser();
    if (!storedUser) return false;

    // Ensure tokens reflect the refreshed access token we just obtained.
    try {
      const currentTokens = await getStoredTokens();
      if (currentTokens) {
        // If access token is empty (e.g., after logout) write a refreshed one.
        if (!currentTokens.accessToken || currentTokens.accessToken === "") {
          await setStoredTokens({
            ...currentTokens,
            accessToken: token,
            accessTokenExpiry: Date.now() + 60_000,
          });
        }
      }
    } catch (e) {
      captureException(e, {
        scope: "auth_context",
        action: "resume_with_tokens_sync_tokens",
      });
    }

    setUser(storedUser);
    return true;
  }, [getValidAccessToken]);

  const logout = async () => {
    setIsLoading(true);
    try {
      clearRoutesConfigCache();
      clearTaskCache();
      // If biometrics are enabled, keep stored tokens so biometric sign-in
      // can resume the session. Otherwise clear all persisted auth data.
      const biometricsEnabled = await getUseBiometrics();

      if (biometricsEnabled) {
        // Keep tokens + stored user; just clear in-memory user.
      } else {
        await clearStoredUser();
        await clearStoredTokens();
      }
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
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
