/*
 * authService.tsx
 *
 * Provides a small wrapper to authenticate a user against the API resolved
 * by the shared API base URL helper. The function below POSTs to /auth/login
 * and returns the normalized user + tokens shape used elsewhere in the app.
 */

import { isAxiosError } from "axios";
import { captureException } from "@/src/monitoring/sentry";
import { User } from "../models/user";
import apiClient from "./apiClient";

type LoginResponse = {
  user?: User;
  access?: string;
  refresh?: string;
  error?: string;
  message?: string;
  detail?: string;
  non_field_errors?: string[];
};

type Tokens = {
  refreshToken: string;
  accessToken: string;
};

type RefreshResponse = {
  access?: string;
  refresh?: string;
  error?: string;
};

type DetailedError = Error & {
  details?: string;
};

function parseApiError(data: unknown): LoginResponse | null {
  if (!data) return null;
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as LoginResponse;
    } catch {
      return { error: data };
    }
  }
  if (typeof data === "object") {
    return data as LoginResponse;
  }
  return null;
}

function firstArrayValue(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  const first = value[0];
  return typeof first === "string" ? first : undefined;
}

function summarizeHtmlError(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const plainText = withoutScripts
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();

  if (!plainText) {
    return "Server returned an HTML error page.";
  }
  const snippet = plainText.slice(0, 220);
  return `Server returned an HTML error page: ${snippet}${plainText.length > 220 ? "..." : ""}`;
}

function normalizeApiMessage(message: string | undefined): string | undefined {
  if (!message) return undefined;
  const trimmed = message.trim();
  if (!trimmed) return undefined;
  const looksLikeHtml =
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<html") ||
    /<body[\s>]/i.test(trimmed) ||
    /<h1[\s>]/i.test(trimmed);
  if (looksLikeHtml) {
    return summarizeHtmlError(trimmed);
  }
  return trimmed;
}

function createDetailedError(message: string, details?: string): Error {
  const err = new Error(message) as DetailedError;
  if (details && details !== message) {
    err.details = details;
  }
  return err;
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function hasHardLockoutSignal(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("account locked") ||
    normalized.includes("locked account") ||
    normalized.includes("temporarily locked") ||
    normalized.includes("suspended") ||
    normalized.includes("disabled") ||
    normalized.includes("blocked")
  );
}

function hasAttemptWarning(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("login attempts") ||
    normalized.includes("failed attempts") ||
    (normalized.includes("used ") &&
      normalized.includes("out of") &&
      normalized.includes("attempt")) ||
    /you have used\s+\d+\s+out of\s+\d+\s+login attempts?/i.test(message) ||
    /after\s+\d+\s+attempts?,\s+your account will be locked/i.test(message)
  );
}

function summarizeAttemptWarning(message: string): string {
  const normalized = normalizeSpaces(message);
  const match = normalized.match(
    /you have used\s+(\d+)\s+out of\s+(\d+)\s+login attempts?/i,
  );
  if (match) {
    return `You have used ${match[1]} out of ${match[2]} login attempts. After ${match[2]} failed attempts, the account will be locked.`;
  }

  const fallback = normalized.match(/after\s+\d+\s+attempts?,\s+your account will be locked/i);
  if (fallback) {
    return "After several failed attempts, the account will be locked.";
  }

  return normalized;
}

function mapLoginError(error: unknown): Error {
  if (!isAxiosError(error)) {
    return error instanceof Error ? error : new Error("Request failed");
  }

  if (!error.response || error.code === "ERR_NETWORK") {
    return new Error("No internet connection");
  }

  const status = error.response.status;
  const parsed = parseApiError(error.response.data);
  const apiMessage = normalizeApiMessage(
    parsed?.error ??
    parsed?.detail ??
    parsed?.message ??
    firstArrayValue(parsed?.non_field_errors),
  );
  const normalizedMessage = (apiMessage ?? "").toLowerCase();

  const looksLikeLockout =
    status === 423 ||
    status === 429 ||
    hasHardLockoutSignal(normalizedMessage) ||
    (status >= 400 && status < 500 && normalizedMessage.includes("too many"));
  if (looksLikeLockout) {
    return createDetailedError(
      "Access to this account is currently restricted. This may be due to too many failed attempts or regional access policies. Please contact support.",
      apiMessage ?? `Request failed with status ${status}`,
    );
  }

  if (status === 400 || status === 401 || status === 403) {
    if (apiMessage && hasAttemptWarning(apiMessage)) {
      return createDetailedError(
        "Invalid username or password.",
        summarizeAttemptWarning(apiMessage),
      );
    }

    return createDetailedError(
      "Invalid username or password.",
      apiMessage,
    );
  }

  if (status >= 500) {
    return createDetailedError(
      "Unable to sign in right now. Please try again.",
      apiMessage,
    );
  }

  return createDetailedError(
    apiMessage ??
      (status ? `Request failed with status ${status}` : "Request failed"),
  );
}

/**
 * Authenticate with email + password against the API.
 * Expects POST { username, password } -> { access, refresh, user }
 * Normalizes a few common response shapes so it's resilient.
 */
export async function authenticate(
  emailOrUsername: string,
  password: string,
): Promise<{ user: User; tokens: Tokens }> {
  const url = "/mobile/login/";
  let response: LoginResponse = {};
  try {
    const res = await apiClient.post(url, {
      username: emailOrUsername,
      password,
    });
    if (typeof res.data === "string") {
      response = res.data ? (JSON.parse(res.data) as LoginResponse) : {};
    } else {
      response = (res.data ?? {}) as LoginResponse;
    }
  } catch (error) {
    captureException(error, {
      scope: "auth_service",
      action: "authenticate",
    });
    throw mapLoginError(error);
  }

  const user = response.user as User | undefined;
  if (!user) throw new Error("Missing user in login response");

  return {
    user,
    tokens: { refreshToken: response.refresh ?? "", accessToken: response.access ?? "" },
  };
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  if (!refreshToken) {
    throw new Error("Missing refresh token");
  }

  const url = "/mobile/token/refresh/";
  try {
    const res = await apiClient.post(url, {
      refresh: refreshToken,
    });
    const data =
      typeof res.data === "string"
        ? (JSON.parse(res.data) as RefreshResponse)
        : (res.data as RefreshResponse | null);
    const nextAccess = data?.access;
    const nextRefresh = data?.refresh;
    if (!nextAccess) {
      throw new Error("Missing access token in refresh response");
    }
    if (!nextRefresh) {
      throw new Error("Missing refresh token in refresh response");
    }
    return { accessToken: nextAccess, refreshToken: nextRefresh };
  } catch (error) {
    captureException(error, {
      scope: "auth_service",
      action: "refresh_access_token",
    });
    if (isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;
      const parsed =
        typeof data === "string"
          ? (() => {
              try {
                return JSON.parse(data) as RefreshResponse;
              } catch {
                return null;
              }
            })()
          : (data as RefreshResponse | null);
      const message =
        parsed?.error ??
        (status ? `Request failed with status ${status}` : "Request failed");
      throw new Error(message);
    }
    throw error;
  }
}

export default { authenticate, refreshAccessToken };
