import { isAxiosError } from "axios";

import apiClient from "./apiClient";

export type EmployeeTaskCountResponse = {
  new_tasks?: number;
  pending_approval_tasks?: number;
};

export type EmployeeTaskChanges = {
  data?: Record<string, unknown>;
  after?: Record<string, string>;
  before?: Record<string, string>;
};

export type EmployeeTaskLmsData = {
  course_name?: string | null;
  course_due_date?: string | null;
  course_status?: string | null;
  course_completion_date?: string | null;
  retake?: boolean | null;
  is_expired?: boolean | null;
  archived?: boolean | null;
  archived_date?: string | null;
};

export type EmployeeTask = {
  id: number;
  created_by?: string | null;
  approver?: string | null;
  changes?: EmployeeTaskChanges | Record<string, never>;
  content_type?: number | null;
  name?: string | null;
  created_at?: string | null;
  status?: string | null;
  status_display?: string | null;
  requestor_comments?: string | null;
  affected_employee?: string | null;
  approver_comments?: string | null;
  updated_at?: string | null;
  requestor_documents?: string | null;
  requestor_documents_url?: string[] | null;
  effective_date?: string | null;
  affected_employee_eid?: string | null;
  workflow_name?: string | null;
  current_status?: string | null;
  lms_data?: EmployeeTaskLmsData | null;
  redirect_task?: boolean | null;
  personal_info_redirect_task?: boolean | null;
  [key: string]: unknown;
};

export type EmployeeTaskPage = {
  page?: number;
  page_size?: number;
  page_count?: number;
  items_count?: number;
  pg_pages?: string[];
  results?: EmployeeTask[];
};

export type EmployeeTaskResponse = {
  open_tasks?: EmployeeTaskPage;
  closed_tasks?: EmployeeTaskPage;
  role_code?: string | null;
  employee_id?: string | null;
  job_category?: string | null;
};

let taskCountCache: EmployeeTaskCountResponse | null = null;
let taskCountRequest: Promise<EmployeeTaskCountResponse> | null = null;
let employeeTasksCache: EmployeeTaskResponse | null = null;
let employeeTasksRequest: Promise<EmployeeTaskResponse> | null = null;

function dedupeTasks(tasks: EmployeeTask[]): EmployeeTask[] {
  const byId = new Map<string, EmployeeTask>();

  tasks.forEach((task) => {
    byId.set(String(task.id), task);
  });

  return Array.from(byId.values());
}

function toError(error: unknown): Error {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    return new Error(status ? `Request failed with status ${status}` : "Request failed");
  }

  return error instanceof Error ? error : new Error("Request failed");
}

async function getEmployeeTasksPage(page = 1): Promise<EmployeeTaskResponse> {
  const response = await apiClient.get<EmployeeTaskResponse>("/mobile/api/employee_task", {
    params: { page },
  });

  return response.data ?? {};
}

export async function getEmployeeTaskCount(
  forceRefresh = false,
): Promise<EmployeeTaskCountResponse> {
  if (!forceRefresh && taskCountCache) {
    return taskCountCache;
  }

  if (!forceRefresh && taskCountRequest) {
    return taskCountRequest;
  }

  taskCountRequest = (async () => {
    try {
      const response = await apiClient.get<EmployeeTaskCountResponse>(
        "/mobile/api/employee_task_count",
      );
      const data = response.data ?? {};
      taskCountCache = data;
      return data;
    } catch (error) {
      throw toError(error);
    } finally {
      taskCountRequest = null;
    }
  })();

  return taskCountRequest;
}

export async function getEmployeeTasks(
  forceRefresh = false,
): Promise<EmployeeTaskResponse> {
  if (!forceRefresh && employeeTasksCache) {
    return employeeTasksCache;
  }

  if (!forceRefresh && employeeTasksRequest) {
    return employeeTasksRequest;
  }

  employeeTasksRequest = (async () => {
    try {
      const firstPage = await getEmployeeTasksPage(1);
      const totalPages = Math.max(1, firstPage.open_tasks?.page_count ?? 1);
      const firstPageOpenTasks = dedupeTasks(firstPage.open_tasks?.results ?? []);

      if (totalPages === 1) {
        const dedupedFirstPage: EmployeeTaskResponse = {
          ...firstPage,
          open_tasks: {
            ...(firstPage.open_tasks ?? {}),
            results: firstPageOpenTasks,
          },
        };

        employeeTasksCache = dedupedFirstPage;
        return dedupedFirstPage;
      }

      const nextPages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) =>
          getEmployeeTasksPage(index + 2),
        ),
      );

      const allOpenTasks = dedupeTasks([
        ...firstPageOpenTasks,
        ...nextPages.flatMap((page) => page.open_tasks?.results ?? []),
      ]);

      const merged: EmployeeTaskResponse = {
        ...firstPage,
        open_tasks: {
          ...(firstPage.open_tasks ?? {}),
          page: 1,
          page_count: totalPages,
          items_count: firstPage.open_tasks?.items_count ?? allOpenTasks.length,
          results: allOpenTasks,
        },
      };

      employeeTasksCache = merged;
      return merged;
    } catch (error) {
      throw toError(error);
    } finally {
      employeeTasksRequest = null;
    }
  })();

  return employeeTasksRequest;
}

export function getTaskFromResponse(
  response: EmployeeTaskResponse | null | undefined,
  taskId: string | number,
): EmployeeTask | null {
  const normalizedId = String(taskId);
  const allTasks = [
    ...(response?.open_tasks?.results ?? []),
    ...(response?.closed_tasks?.results ?? []),
  ];

  return allTasks.find((task) => String(task.id) === normalizedId) ?? null;
}

export async function getEmployeeTaskById(
  taskId: string | number,
  forceRefresh = false,
): Promise<EmployeeTask | null> {
  if (!forceRefresh && employeeTasksCache) {
    const cachedTask = getTaskFromResponse(employeeTasksCache, taskId);
    if (cachedTask) {
      return cachedTask;
    }
  }

  const response = await getEmployeeTasks(forceRefresh);
  return getTaskFromResponse(response, taskId);
}

export function clearTaskCache(): void {
  taskCountCache = null;
  taskCountRequest = null;
  employeeTasksCache = null;
  employeeTasksRequest = null;
}

export default {
  getEmployeeTaskCount,
  getEmployeeTasks,
  getEmployeeTaskById,
  clearTaskCache,
};
