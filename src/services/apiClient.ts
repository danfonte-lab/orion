import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { expireSession, SessionExpiredError } from "@/src/auth/auth-session";
import { captureException } from "@/src/monitoring/sentry";

import {
  getStoredRefreshToken,
  getStoredTokens,
  setStoredTokens,
} from "../auth/auth-storage";
import { resolveApiBaseUrl } from "./apiBaseUrl";
const API_KEY = process.env.EXPO_PUBLIC_API_KEY || "";
const CSRF_TOKEN = process.env.EXPO_PUBLIC_CSRF_TOKEN || "";
const AUTH_REQUEST_TRACE_ENABLED =
  process.env.EXPO_PUBLIC_AUTH_REQUEST_TRACE === "true";
let authRequestTraceActive = false;

const PUBLIC_URL_PATHS = ["/mobile/login/", "/mobile/token/refresh/"];

function normalizePath(pathname: string): string {
  let normalized = pathname.split("?")[0] || "";
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  if (!normalized.endsWith("/")) normalized = `${normalized}/`;
  return normalized;
}

function isPublicUrl(url: string, baseURL: string): boolean {
  try {
    const resolved = new URL(url, baseURL);
    const normalizedPath = normalizePath(resolved.pathname);
    return PUBLIC_URL_PATHS.some(
      (entry) => normalizePath(entry) === normalizedPath,
    );
  } catch (error) {
    captureException(error, {
      scope: "api_client",
      action: "is_public_url",
      extras: { url, baseURL },
    });
    return false;
  }
}

function setHeader(
  config: InternalAxiosRequestConfig,
  key: string,
  value: string,
) {
  if (!config.headers) {
    config.headers = {} as InternalAxiosRequestConfig["headers"];
  }
  if (typeof config.headers.set === "function") {
    config.headers.set(key, value);
  } else {
    (config.headers as Record<string, string>)[key] = value;
  }
}

function hasHeader(config: InternalAxiosRequestConfig, key: string): boolean {
  if (!config.headers) return false;
  if (typeof config.headers.get === "function") {
    return Boolean(config.headers.get(key));
  }
  return Boolean((config.headers as Record<string, string>)[key]);
}

function safeSerialize(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;

  try {
    const serialized = JSON.stringify(value);
    return serialized.length > 1500
      ? `${serialized.slice(0, 1500)}...`
      : serialized;
  } catch {
    return "[unserializable]";
  }
}

function traceAuthRequest(message: string, payload?: Record<string, unknown>) {
  if (!AUTH_REQUEST_TRACE_ENABLED || !authRequestTraceActive) return;
  if (payload) {
    console.log(`[auth-http] ${message}`, payload);
    return;
  }
  console.log(`[auth-http] ${message}`);
}

export function setAuthRequestTraceActive(active: boolean): void {
  authRequestTraceActive = active;
}

const apiClient: AxiosInstance = axios.create({
});

const ACCESS_TOKEN_TTL_MS = 60_000;
let refreshPromise:
  | Promise<{ accessToken: string; refreshToken: string }>
  | null = null;

async function requestTokenRefresh(): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) {
    throw new Error("Missing refresh token");
  }
  const baseURL = await resolveApiBaseUrl();
  const res = await axios.post(
    `${baseURL}/mobile/token/refresh/`,
    { refresh: refreshToken },
    {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(API_KEY ? { "x-api-key": API_KEY } : {}),
        ...(CSRF_TOKEN ? { "X-CSRFTOKEN": CSRF_TOKEN } : {}),
      },
    },
  );
  const data =
    typeof res.data === "string"
      ? (JSON.parse(res.data) as { access?: string; refresh?: string })
      : (res.data as { access?: string; refresh?: string } | null);
  if (!data?.access || !data?.refresh) {
    throw new Error("Invalid refresh response");
  }
  await setStoredTokens({
    accessToken: data.access,
    refreshToken: data.refresh,
    accessTokenExpiry: Date.now() + ACCESS_TOKEN_TTL_MS,
  });
  return { accessToken: data.access, refreshToken: data.refresh };
}

async function getRefreshedTokens(): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  if (!refreshPromise) {
    refreshPromise = requestTokenRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

apiClient.interceptors.request.use(
  async (config): Promise<InternalAxiosRequestConfig> => {
    const baseURL = await resolveApiBaseUrl();
    config.baseURL = baseURL;
    setHeader(config, "Accept", "application/json");
    if (config.data != null && !hasHeader(config, "Content-Type")) {
      setHeader(config, "Content-Type", "application/json");
    }
    if (API_KEY) setHeader(config, "x-api-key", API_KEY);
    if (CSRF_TOKEN) setHeader(config, "X-CSRFTOKEN", CSRF_TOKEN);

    const requestBaseURL = config.baseURL;
    const url = config.url || "";
    if (AUTH_REQUEST_TRACE_ENABLED) {
      traceAuthRequest("request", {
        method: (config.method || "get").toUpperCase(),
        url,
        baseURL,
        params: config.params ?? null,
        data: safeSerialize(config.data),
      });
    }
    if (requestBaseURL && url && !isPublicUrl(url, requestBaseURL)) {
      const tokens = await getStoredTokens();
      const accessToken = tokens?.accessToken;
      if (accessToken && !hasHeader(config, "Authorization")) {
        setHeader(config, "Authorization", `Bearer ${accessToken}`);
      }
    }

    return config;
  },
);

apiClient.interceptors.response.use(
  (response) => {
    if (AUTH_REQUEST_TRACE_ENABLED) {
      traceAuthRequest("response", {
        method: (response.config.method || "get").toUpperCase(),
        url: response.config.url || "",
        status: response.status,
        data: safeSerialize(response.data),
      });
    }
    return response;
  },
  async (error) => {
    if (!axios.isAxiosError(error)) {
      captureException(error, {
        scope: "api_client",
        action: "response_interceptor_non_axios_error",
      });
      return Promise.reject(error);
    }
    const response = error.response;
    const originalConfig = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    if (!response || !originalConfig) {
      captureException(error, {
        scope: "api_client",
        action: "response_interceptor_missing_response_or_config",
      });
      return Promise.reject(error);
    }

    const status = response.status;
    const requestBaseURL = originalConfig.baseURL;
    const url = originalConfig.url || "";
    const isPublic = requestBaseURL && url ? isPublicUrl(url, requestBaseURL) : false;

    const isAuthFailure = (status === 401 || status === 403) && !isPublic;

    if (AUTH_REQUEST_TRACE_ENABLED) {
      traceAuthRequest("error", {
        method: (originalConfig.method || "get").toUpperCase(),
        url,
        status,
        data: safeSerialize(response.data),
      });
    }

    if (isAuthFailure && !originalConfig._retry) {
      originalConfig._retry = true;
      try {
        const refreshed = await getRefreshedTokens();
        setHeader(
          originalConfig,
          "Authorization",
          `Bearer ${refreshed.accessToken}`,
        );
        return apiClient.request(originalConfig);
      } catch (refreshError) {
        captureException(refreshError, {
          scope: "api_client",
          action: "token_refresh_retry_failed",
          extras: { status, url },
        });
        await expireSession();
        return Promise.reject(new SessionExpiredError());
      }
    }

    if (isAuthFailure) {
      captureException(error, {
        scope: "api_client",
        action: "auth_failure_after_retry",
        extras: { status, url },
      });
      await expireSession();
      return Promise.reject(new SessionExpiredError());
    }

    return Promise.reject(error);
  },
);

export default apiClient;
