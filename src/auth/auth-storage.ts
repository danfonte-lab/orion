import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { User } from "../models/user";

// Centralized keys for SecureStore.
const KEYS = {
  user: "auth.user",
  hasSeenOnboarding: "onboarding.hasSeenOnboarding",
  accessToken: "auth.accessToken",
  accessTokenExpiry: "auth.accessTokenExpiry",
  refreshToken: "auth.refreshToken",
  legacyTokens: "auth.tokens",
  useBiometrics: "auth.useBiometrics",
  sessionNotice: "auth.sessionNotice",
  themePreference: "app.themePreference",
} as const;

export type ThemePreference = "system" | "light" | "dark";


// Web fallback:
// - expo-secure-store is not available on web in this project setup
// - expo-router can server-render routes, so we must also guard window usage
async function getItemAsync(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem(key);
    // console.debug(`[auth-storage] getItemAsync web ${key} =>`, v);
    return v;
  }

  try {
    const v = await SecureStore.getItemAsync(key);
    // console.debug(`[auth-storage] getItemAsync native ${key} =>`, v);
    return v;
  } catch {
    return null;
  }
}

async function setItemAsync(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
    // console.debug(`[auth-storage] setItemAsync web ${key} <=`, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
  // console.debug(`[auth-storage] setItemAsync native ${key} <=`, value);
}

async function deleteItemAsync(key: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
    // console.debug(`[auth-storage] deleteItemAsync web ${key}`);
    return;
  }

  await SecureStore.deleteItemAsync(key);
  // console.debug(`[auth-storage] deleteItemAsync native ${key}`);
}

export async function getStoredUser(): Promise<User | null> {
  const raw = await getItemAsync(KEYS.user);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as User;
  } catch {
    // If parsing fails, consider data corrupted and clear it.
    await deleteItemAsync(KEYS.user);
    return null;
  }
}

export async function setStoredUser(user: User): Promise<void> {
  // SecureStore usage: persist serialized user after login.
  await setItemAsync(KEYS.user, JSON.stringify(user));
}

export async function clearStoredUser(): Promise<void> {
  await deleteItemAsync(KEYS.user);
}

export type Tokens = {
  accessToken: string;
  refreshToken: string;
  // epoch ms when accessToken expires
  accessTokenExpiry: number;
};

type LegacyTokens = Partial<Tokens>;

async function readLegacyTokens(): Promise<LegacyTokens | null> {
  const raw = await getItemAsync(KEYS.legacyTokens);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as LegacyTokens;
  } catch {
    await deleteItemAsync(KEYS.legacyTokens);
    return null;
  }
}

export async function getStoredTokens(): Promise<Tokens | null> {
  const [accessToken, refreshToken, accessTokenExpiry] = await Promise.all([
    getStoredAccessToken(),
    getStoredRefreshToken(),
    getStoredAccessTokenExpiry(),
  ]);

  if (!accessToken || !refreshToken || !accessTokenExpiry) return null;

  return {
    accessToken,
    refreshToken,
    accessTokenExpiry,
  };
}

export async function setStoredTokens(tokens: Tokens): Promise<void> {
  await Promise.all([
    setItemAsync(KEYS.accessToken, tokens.accessToken),
    setItemAsync(KEYS.refreshToken, tokens.refreshToken),
    setItemAsync(KEYS.accessTokenExpiry, String(tokens.accessTokenExpiry)),
    deleteItemAsync(KEYS.legacyTokens),
  ]);
}

export async function getStoredAccessToken(): Promise<string | null> {
  return getItemAsync(KEYS.accessToken);
}

export async function getStoredRefreshToken(): Promise<string | null> {
  const raw = await getItemAsync(KEYS.refreshToken);
  if (raw) return raw;

  const legacy = await readLegacyTokens();
  return legacy?.refreshToken ?? null;
}

export async function getStoredAccessTokenExpiry(): Promise<number | null> {
  const raw = await getItemAsync(KEYS.accessTokenExpiry);
  if (raw && !Number.isNaN(Number(raw))) return Number(raw);
  return null;
}

export async function clearStoredAccessToken(): Promise<void> {
  await Promise.all([
    deleteItemAsync(KEYS.accessToken),
    deleteItemAsync(KEYS.accessTokenExpiry),
  ]);
}

export async function clearStoredTokens(): Promise<void> {
  await Promise.all([
    deleteItemAsync(KEYS.accessToken),
    deleteItemAsync(KEYS.accessTokenExpiry),
    deleteItemAsync(KEYS.refreshToken),
    deleteItemAsync(KEYS.legacyTokens),
  ]);
}

export async function getSessionNotice(): Promise<string | null> {
  return getItemAsync(KEYS.sessionNotice);
}

export async function setSessionNotice(message: string): Promise<void> {
  await setItemAsync(KEYS.sessionNotice, message);
}

export async function clearSessionNotice(): Promise<void> {
  await deleteItemAsync(KEYS.sessionNotice);
}

export async function getThemePreference(): Promise<ThemePreference> {
  const raw = await getItemAsync(KEYS.themePreference);
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

export async function setThemePreference(value: ThemePreference): Promise<void> {
  await setItemAsync(KEYS.themePreference, value);
}

export async function clearThemePreference(): Promise<void> {
  await deleteItemAsync(KEYS.themePreference);
}

export async function getHasSeenOnboarding(): Promise<boolean> {
  const raw = await getItemAsync(KEYS.hasSeenOnboarding);
  return raw === "true";
}

export async function setHasSeenOnboarding(value: boolean): Promise<void> {
  // SecureStore usage: persist onboarding completion flag.
  await setItemAsync(KEYS.hasSeenOnboarding, value ? "true" : "false");
}

export async function clearHasSeenOnboarding(): Promise<void> {
  await deleteItemAsync(KEYS.hasSeenOnboarding);
}

export async function getUseBiometrics(): Promise<boolean> {
  const raw = await getItemAsync(KEYS.useBiometrics);
  console.debug(`[auth-storage] getUseBiometrics =>`, raw);
  return raw === "true";
}

export async function setUseBiometrics(value: boolean): Promise<void> {
  console.debug(`[auth-storage] setUseBiometrics <=`, value);
  await setItemAsync(KEYS.useBiometrics, value ? "true" : "false");
}

export async function clearUseBiometrics(): Promise<void> {
  await deleteItemAsync(KEYS.useBiometrics);
}

export async function hasBiometricsPreference(): Promise<boolean> {
  const raw = await getItemAsync(KEYS.useBiometrics);
  return raw !== null;
}

// Optional helper: check device biometric availability
export async function isBiometricHardwareAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  } catch {
    return false;
  }
}

export async function deleteAllItemAsync(): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return;
    window.localStorage.clear()
    // console.debug(`[auth-storage] deleteItemAsync web ${key}`);
    return;
  }

  await clearStoredTokens();
  await clearStoredUser();
  await clearHasSeenOnboarding();
  await clearUseBiometrics();
  await clearSessionNotice();
  await clearThemePreference();
}
