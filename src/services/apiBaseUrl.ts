import { getStoredUser } from "@/src/auth/auth-storage";
import type { User } from "@/src/models/user";

const DEFAULT_API_URL = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/+$/, "");
const TRAINING_API_URL = (process.env.EXPO_PUBLIC_TRAINING_API_URL || "").replace(/\/+$/, "");
const TRAINING_USERNAME = "orion.app";

let apiBaseUrlOverride: string | null = null;

function normalizeBaseUrl(value?: string | null): string {
  return (value ?? "").replace(/\/+$/, "");
}

function isTrainingUsername(value?: string | null): boolean {
  return normalizeBaseUrl(value).toLowerCase() === TRAINING_USERNAME;
}

export function getDefaultApiBaseUrl(): string {
  return DEFAULT_API_URL;
}

export function getTrainingApiBaseUrl(): string {
  return TRAINING_API_URL;
}

export function getApiBaseUrlForUsername(username?: string | null): string {
  return isTrainingUsername(username) ? TRAINING_API_URL : DEFAULT_API_URL;
}

export function setApiBaseUrlOverride(baseUrl: string | null): void {
  const normalized = normalizeBaseUrl(baseUrl);
  apiBaseUrlOverride = normalized || null;
}

export function clearApiBaseUrlOverride(): void {
  apiBaseUrlOverride = null;
}

export function setApiBaseUrlForUsername(username?: string | null): void {
  setApiBaseUrlOverride(getApiBaseUrlForUsername(username));
}

export async function resolveApiBaseUrl(): Promise<string> {
  if (apiBaseUrlOverride) return apiBaseUrlOverride;

  const storedUser = await getStoredUser();
  if (storedUser && isTrainingUsername(storedUser.username)) {
    const training = getTrainingApiBaseUrl();
    if (training) {
      apiBaseUrlOverride = training;
      return training;
    }
  }

  const defaultUrl = getDefaultApiBaseUrl();
  if (defaultUrl) return defaultUrl;

  if (getTrainingApiBaseUrl()) return getTrainingApiBaseUrl();

  throw new Error("No API base URL is configured");
}

export function getStoredUserApiBaseUrl(user: User | null | undefined): string {
  return getApiBaseUrlForUsername(user?.username);
}
