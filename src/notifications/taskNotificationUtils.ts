import type { EmployeeTask } from "@/src/services/taskService";

export function formatTaskTimestamp(value?: string | null): string {
  if (!value) return "";

  const [datePart, timePart] = value.split(" ");
  const [month, day, year] = (datePart ?? "").split("/");
  const isoCandidate = `${year}-${month}-${day}T${timePart ?? "00:00:00"}`;
  const parsed = new Date(isoCandidate);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function buildTaskNotificationBody(task: EmployeeTask): string {
  const summaryParts = [
    task.name?.trim(),
    task.affected_employee?.trim() ? `for ${task.affected_employee.trim()}` : "",
    task.status_display?.trim() || task.current_status?.trim(),
    task.effective_date?.trim() ? `Effective ${task.effective_date.trim()}` : "",
  ].filter(Boolean);

  if (summaryParts.length > 0) {
    return summaryParts.join(" • ");
  }

  const fallback = task.requestor_comments?.trim() || task.approver_comments?.trim();
  if (fallback) {
    return fallback;
  }

  return `Task #${task.id}`;
}

export function getTaskDetailEntries(
  task: EmployeeTask,
): { label: string; value: string }[] {
  const entries: { label: string; value: string }[] = [];
  const pushEntry = (label: string, value: unknown) => {
    if (value == null) return;
    const normalized = String(value).trim();
    if (!normalized) return;
    entries.push({ label, value: normalized });
  };

  pushEntry("Task ID", task.id);
  pushEntry("Name", task.name);
  pushEntry("Status", task.status_display || task.current_status || task.status);
  pushEntry("Affected employee", task.affected_employee);
  pushEntry("Employee ID", task.affected_employee_eid);
  pushEntry("Created by", task.created_by);
  pushEntry("Approver", task.approver);
  pushEntry("Created at", formatTaskTimestamp(task.created_at));
  pushEntry("Updated at", formatTaskTimestamp(task.updated_at));
  pushEntry("Effective date", task.effective_date);
  pushEntry("Workflow", task.workflow_name);
  pushEntry("Requestor comments", task.requestor_comments);
  pushEntry("Approver comments", task.approver_comments);

  const afterChanges = task.changes && "after" in task.changes ? task.changes.after : undefined;
  Object.entries(afterChanges ?? {}).forEach(([label, value]) => {
    pushEntry(label, value);
  });

  const lmsData = task.lms_data ?? undefined;
  pushEntry("Course", lmsData?.course_name);
  pushEntry("Course due date", lmsData?.course_due_date);
  pushEntry("Course status", lmsData?.course_status);
  pushEntry("Completion date", lmsData?.course_completion_date);

  return entries;
}
