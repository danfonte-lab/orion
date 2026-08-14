import { isAxiosError } from "axios";

import apiClient from "./apiClient";

const JOB_ENDPOINTS = ["/mobile/api/employee/job/", "/mobile/api/job/"];
const ORG_CHART_ENDPOINTS = ["/mobile/api/employee/org_chart/", "/mobile/api/org_chart/"];

export const MY_TEAM_ALLOWED_JOB_PROFILES = ["Team Leader"];

export type EmployeeJobResponse = {
  manager?: string | null;
  job_profile?: string | null;
  position?: string | null;
  business_title?: string | null;
  employee_id?: string | null;
  email?: string | null;
};

export type OrgChartPerson = {
  employee_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  job_title?: string | null;
  email?: string | null;
  initials?: string | null;
  direct_reports_count?: number | null;
  full_name?: string | null;
  location?: string | null;
  employee_documents?: { file_url?: string | null }[] | null;
  thumbnail_url?: string | null;
};

export type OrgChartResponse = {
  manager?: OrgChartPerson | null;
  direct_reports?: OrgChartPerson[] | null;
};

let cachedJob: EmployeeJobResponse | null = null;
let cachedOrgChart: OrgChartResponse | null = null;

function toError(error: unknown): Error {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    return new Error(status ? `Request failed with status ${status}` : "Request failed");
  }

  return error instanceof Error ? error : new Error("Request failed");
}

async function getFirstSuccessful<T>(endpoints: string[]): Promise<T> {
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await apiClient.get<T>(endpoint);
      return (response.data ?? {}) as T;
    } catch (error) {
      lastError = toError(error);
    }
  }

  throw lastError ?? new Error("Request failed");
}

function normalizeValue(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

export function canAccessMyTeam(
  jobProfile?: string | null,
  allowedProfiles: string[] = MY_TEAM_ALLOWED_JOB_PROFILES,
): boolean {
  const current = normalizeValue(jobProfile);
  if (!current) return false;

  return allowedProfiles.some((profile) => normalizeValue(profile) === current);
}

export async function getEmployeeJob(forceRefresh = false): Promise<EmployeeJobResponse> {
  if (!forceRefresh && cachedJob) {
    return cachedJob;
  }

  const job = await getFirstSuccessful<EmployeeJobResponse>(JOB_ENDPOINTS);
  cachedJob = job;
  return job;
}

export async function getEmployeeOrgChart(forceRefresh = false): Promise<OrgChartResponse> {
  if (!forceRefresh && cachedOrgChart) {
    return cachedOrgChart;
  }

  const orgChart = await getFirstSuccessful<OrgChartResponse>(ORG_CHART_ENDPOINTS);
  cachedOrgChart = orgChart;
  return orgChart;
}

export function clearTeamCache(): void {
  cachedJob = null;
  cachedOrgChart = null;
}

export default {
  canAccessMyTeam,
  getEmployeeJob,
  getEmployeeOrgChart,
  clearTeamCache,
};
