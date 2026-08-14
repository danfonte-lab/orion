/*
 * profileService.tsx
 *
 * Fetches the employee profile after login.
 */

import { captureException } from "@/src/monitoring/sentry";
import axios from "axios";
import apiClient from "./apiClient";

export type EmployeeProfileResponse = {
  is_pending?: boolean;
  is_sent_back?: boolean;
  request_data?: Record<string, unknown>;
  profile?: {
    employee_id?: string;
    legal_sex?: string;
    legal_sex_display?: string;
    gender?: string;
    gender_display?: string;
    birth_place?: string;
    birth_date?: string;
    primary_nationality?: string;
    primary_nationality_id?: number;
    pronouns?: string | null;
    marital_status?: string;
    age?: number;
    content_type?: number;
    preferred_name?: string;
    full_name?: string;
    hierarchy_of_managers?: string[];
    manager?: string;
    work_ids?: Array<{
      id_number?: string;
      national_id_name?: string;
    }>;
  };
};

export type EmployeeManagerResponse = {
  manager_id?: string;
  full_name?: string;
  job_title?: string;
  business_title?: string;
};

let cachedEmployeeProfile: EmployeeProfileResponse | null = null;

export async function getEmployeeProfile(
  accessToken?: string,
): Promise<EmployeeProfileResponse> {
  const url = "/mobile/api/employee/profile/";
  try {
    const res = await apiClient.get<EmployeeProfileResponse>(url, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    const nextProfile = res.data ?? {};
    cachedEmployeeProfile = nextProfile;
    return nextProfile;
  } catch (error) {
    captureException(error, {
      scope: "profile_service",
      action: "get_employee_profile",
      extras: { hasAccessToken: Boolean(accessToken) },
    });
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      throw new Error(
        status ? `Request failed with status ${status}` : "Request failed",
      );
    }
    throw error;
  }
}

export async function getCachedEmployeeProfile(
  forceRefresh = false,
): Promise<EmployeeProfileResponse> {
  if (!forceRefresh && cachedEmployeeProfile) {
    return cachedEmployeeProfile;
  }
  return getEmployeeProfile();
}

export async function getEmployeeManager(
  employeeId: string,
  accessToken?: string,
): Promise<EmployeeManagerResponse> {
  if (!employeeId) {
    throw new Error("Missing employee_id");
  }

  const url = "/mobile/api/employee/manager/";
  try {
    const res = await apiClient.get<EmployeeManagerResponse>(url, {
      params: { employee_id: employeeId },
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    const data = res.data ?? {};

    return data;
  } catch (error) {
    captureException(error, {
      scope: "profile_service",
      action: "get_employee_manager",
      extras: { employeeId: Boolean(employeeId) },
    });
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      throw new Error(
        status ? `Request failed with status ${status}` : "Request failed",
      );
    }
    throw error;
  }
}

export function clearCachedEmployeeProfile(): void {
  cachedEmployeeProfile = null;
}

export default {
  getEmployeeProfile,
  getCachedEmployeeProfile,
  getEmployeeManager,
  clearCachedEmployeeProfile,
};
