import { isAxiosError } from "axios";

import apiClient from "./apiClient";

const ROUTES_CONFIG_ENDPOINT = "/mobile/api/access_control/routes_config/get";

export type RouteConfigItem = {
  allowed_permission?: string | null;
  state?: string | null;
  title?: string | null;
  header_title?: string | null;
};

let cachedRoutesConfig: RouteConfigItem[] | null = null;

function toError(error: unknown): Error {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    return new Error(status ? `Request failed with status ${status}` : "Request failed");
  }

  return error instanceof Error ? error : new Error("Request failed");
}

export async function getRoutesConfig(forceRefresh = false): Promise<RouteConfigItem[]> {
  if (!forceRefresh && cachedRoutesConfig) {
    return cachedRoutesConfig;
  }

  try {
    const response = await apiClient.get<RouteConfigItem[] | string>(ROUTES_CONFIG_ENDPOINT, {
      headers: {
        version: "mobile",
      },
    });

    const data =
      typeof response.data === "string"
        ? (JSON.parse(response.data) as RouteConfigItem[])
        : response.data;

    cachedRoutesConfig = Array.isArray(data) ? data : [];
    return cachedRoutesConfig;
  } catch (error) {
    throw toError(error);
  }
}

export function clearRoutesConfigCache(): void {
  cachedRoutesConfig = null;
}

export default {
  getRoutesConfig,
  clearRoutesConfigCache,
};
