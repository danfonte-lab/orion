import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/src/auth/AuthContext";
import { captureException } from "@/src/monitoring/sentry";
import {
  clearTaskCache,
  getEmployeeTaskCount,
  getEmployeeTasks,
  type EmployeeTask,
  type EmployeeTaskCountResponse,
} from "@/src/services/taskService";

type TaskNotificationsContextValue = {
  counts: EmployeeTaskCountResponse | null;
  openTasks: EmployeeTask[];
  isCountsLoading: boolean;
  isTasksLoading: boolean;
  refreshCounts: (forceRefresh?: boolean) => Promise<void>;
  refreshTasks: (forceRefresh?: boolean) => Promise<void>;
  pendingTaskCount: number;
};

const TaskNotificationsContext = createContext<TaskNotificationsContextValue | null>(null);

export function TaskNotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<EmployeeTaskCountResponse | null>(null);
  const [openTasks, setOpenTasks] = useState<EmployeeTask[]>([]);
  const [isCountsLoading, setIsCountsLoading] = useState(false);
  const [isTasksLoading, setIsTasksLoading] = useState(false);

  const refreshCounts = useCallback(async (forceRefresh = false) => {
    if (!user) return;

    setIsCountsLoading(true);
    try {
      const nextCounts = await getEmployeeTaskCount(forceRefresh);
      setCounts(nextCounts);
    } catch (error) {
      captureException(error, {
        scope: "task_notifications_context",
        action: "refresh_counts",
      });
      throw error;
    } finally {
      setIsCountsLoading(false);
    }
  }, [user]);

  const refreshTasks = useCallback(async (forceRefresh = false) => {
    if (!user) return;

    setIsTasksLoading(true);
    try {
      const response = await getEmployeeTasks(forceRefresh);
      setOpenTasks(response.open_tasks?.results ?? []);
    } catch (error) {
      captureException(error, {
        scope: "task_notifications_context",
        action: "refresh_tasks",
      });
      throw error;
    } finally {
      setIsTasksLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      clearTaskCache();
      setCounts(null);
      setOpenTasks([]);
      return;
    }

    refreshCounts().catch(() => {});
  }, [refreshCounts, user]);

  const value = useMemo<TaskNotificationsContextValue>(
    () => ({
      counts,
      openTasks,
      isCountsLoading,
      isTasksLoading,
      refreshCounts,
      refreshTasks,
      pendingTaskCount:
        counts?.pending_approval_tasks ?? counts?.new_tasks ?? openTasks.length,
    }),
    [counts, isCountsLoading, isTasksLoading, openTasks, refreshCounts, refreshTasks],
  );

  return (
    <TaskNotificationsContext.Provider value={value}>
      {children}
    </TaskNotificationsContext.Provider>
  );
}

export function useTaskNotifications() {
  const context = useContext(TaskNotificationsContext);
  if (!context) {
    throw new Error("useTaskNotifications must be used within TaskNotificationsProvider");
  }
  return context;
}
