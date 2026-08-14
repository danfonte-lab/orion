import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { expireSession, SessionExpiredError } from "@/src/auth/auth-session";
import { captureException } from "@/src/monitoring/sentry";

import { getStoredTokens, setStoredTokens } from "../auth/auth-storage";

const API_URL = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/+$/, "");
const API_KEY = process.env.EXPO_PUBLIC_API_KEY || "";
const CSRF_TOKEN = process.env.EXPO_PUBLIC_CSRF_TOKEN || "";

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
    config.headers = {};
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

const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
});

const ACCESS_TOKEN_TTL_MS = 60_000;
let refreshPromise:
  | Promise<{ accessToken: string; refreshToken: string }>
  | null = null;

async function requestTokenRefresh(): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  if (!API_URL) {
    throw new Error("EXPO_PUBLIC_API_URL is not set");
  }
  const tokens = await getStoredTokens();
  const refreshToken = tokens?.refreshToken;
  if (!refreshToken) {
    throw new Error("Missing refresh token");
  }
  const res = await axios.post(
    `${API_URL}/mobile/token/refresh/`,
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
    setHeader(config, "Accept", "application/json");
    if (config.data != null && !hasHeader(config, "Content-Type")) {
      setHeader(config, "Content-Type", "application/json");
    }
    if (API_KEY) setHeader(config, "x-api-key", API_KEY);
    if (CSRF_TOKEN) setHeader(config, "X-CSRFTOKEN", CSRF_TOKEN);

    const baseURL = config.baseURL || API_URL;
    const url = config.url || "";
    if (baseURL && url && !isPublicUrl(url, baseURL)) {
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
  (response) => response,
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
    const baseURL = originalConfig.baseURL || API_URL;
    const url = originalConfig.url || "";
    const isPublic = baseURL && url ? isPublicUrl(url, baseURL) : false;

    const isAuthFailure = (status === 401 || status === 403) && !isPublic;

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
