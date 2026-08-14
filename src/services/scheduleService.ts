import { isAxiosError } from "axios";
import { captureException } from "@/src/monitoring/sentry";

import apiClient from "./apiClient";

const API_ENDPOINT = "/mobile/api/schedule/";

export type WeekScheduleDay = {
  id: string;
  isoDate: string;
  weekdayLabel: string;
  fullDateLabel: string;
  status: "ACT" | "OFF" | "PTO" | "NO_INFO";
  timeLabel: string;
  role?: string;
  site?: string;
  teamLeader?: string;
  breaks?: string;
};

export type WeekScheduleResponse = {
  weekStartIso: string;
  weekEndIso: string;
  days: WeekScheduleDay[];
};

export type TeamScheduleMember = {
  id: string;
  employeeId?: string;
  employeeName: string;
  status: "ACT" | "OFF" | "PTO" | "NO_INFO";
  timeLabel: string;
  role?: string;
  site?: string;
  teamLeader?: string;
  breaks?: string;
};

export type TeamScheduleDay = {
  id: string;
  isoDate: string;
  weekdayLabel: string;
  fullDateLabel: string;
  status: "HAS_DATA" | "NO_INFO";
  members: TeamScheduleMember[];
};

export type TeamWeekScheduleResponse = {
  weekStartIso: string;
  weekEndIso: string;
  days: TeamScheduleDay[];
};

type ApiTimesheet = {
  shift_date?: string | null;
  status?: string | null;
  is_day_off?: boolean | null;
  leave_type?: string | null;
  time_in?: string | null;
  time_out?: string | null;
  breaks?: string | Record<string, unknown> | null;
  specialty?: string | null;
  program?: string | null;
  site?: string | null;
  work_location?: string | null;
  tl_name?: string | null;
  employee_id?: string | null;
  agent_name?: string | null;
};

type ApiWeek = {
  week?: string | null;
  schedules?: ApiTimesheet[] | null;
};

type ApiTeamAgent = ApiTimesheet & {
  schedules?: ApiTimesheet[] | null;
};

type ApiPagination = {
  has_next?: boolean | null;
};

type ApiTeamWeek = {
  week?: string | null;
  agents?: ApiTeamAgent[] | null;
  schedules?: ApiTimesheet[] | null;
  paginations?: ApiPagination | null;
};

type EmployeeScheduleApiResponse = {
  employee?: ApiTimesheet | null;
  weeks?: ApiWeek[] | null;
};

type TeamScheduleApiResponse = {
  weeks?: ApiTeamWeek[] | null;
};

const OFF_STATUS_CODES = new Set(["OFF", "RD", "REST"]);
const PTO_STATUS_CODES = new Set(["PTO", "LOA", "MAL", "PAL", "PRM", "SUS"]);
const SCHEDULE_DEBUG_ENABLED =
  process.env.EXPO_PUBLIC_SCHEDULE_DEBUG === "true" ||
  (process.env.EXPO_PUBLIC_ENV ? process.env.EXPO_PUBLIC_ENV !== "PROD" : false);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfWeekMonday(date: Date): Date {
  const next = startOfDay(date);
  const mondayIndex = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - mondayIndex);
  return next;
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return startOfDay(next);
}

function toIsoDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = String(value).trim();
  const match = parsed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return startOfDay(date);
}

function toError(error: unknown): Error {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    return new Error(status ? `Request failed with status ${status}` : "Request failed");
  }
  return error instanceof Error ? error : new Error("Request failed");
}

function safeString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const next = value.trim();
  return next.length > 0 ? next : undefined;
}

function formatClockTime(hours: number, minutes: number): string {
  const period = hours >= 12 ? "PM" : "AM";
  const normalizedHours = hours % 12 || 12;
  return `${normalizedHours}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatTimeValue(value?: string | null): string | undefined {
  const raw = safeString(value);
  if (!raw) return undefined;

  const hhmmss = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hhmmss) {
    const hours = Number(hhmmss[1]);
    const minutes = Number(hhmmss[2]);
    if (Number.isInteger(hours) && Number.isInteger(minutes)) {
      return formatClockTime(hours, minutes);
    }
  }

  const isoTime = raw.match(/T(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (isoTime) {
    const hours = Number(isoTime[1]);
    const minutes = Number(isoTime[2]);
    if (Number.isInteger(hours) && Number.isInteger(minutes)) {
      return formatClockTime(hours, minutes);
    }
  }

  return raw;
}

function toTitleWords(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function prettifyLeaveType(value?: string | null): string {
  const next = safeString(value);
  if (!next) return "Paid Time Off";
  return toTitleWords(next);
}

function formatBreaks(value: ApiTimesheet["breaks"]): string | undefined {
  const stringValue = safeString(value);
  if (stringValue) return stringValue;
  if (!isRecord(value)) return undefined;

  const preferredOrder = ["break_1", "lunch_break", "break_2"];
  const entries = Object.entries(value);
  if (entries.length === 0) return undefined;

  const sortedEntries = [...entries].sort(([keyA], [keyB]) => {
    const indexA = preferredOrder.indexOf(keyA);
    const indexB = preferredOrder.indexOf(keyB);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  const parts = sortedEntries
    .map(([fallbackKey, entryValue]) => {
      if (!isRecord(entryValue)) return null;

      const rawLabel = safeString(entryValue.label) ?? fallbackKey;
      const rawTime = safeString(entryValue.time);
      const label = toTitleWords(rawLabel);
      const time = formatTimeValue(rawTime);

      if (!label && !time) return null;
      if (!time) return label;
      return `${label} ${time}`;
    })
    .filter((part): part is string => Boolean(part));

  if (parts.length === 0) return undefined;
  return parts.join("\n");
}

function normalizeStatus(item: ApiTimesheet): "ACT" | "OFF" | "PTO" {
  const leaveType = safeString(item.leave_type);
  const statusCode = safeString(item.status)?.toUpperCase();

  if (leaveType) return "PTO";
  if (item.is_day_off) return "OFF";
  if (statusCode === "ACT") return "ACT";
  if (statusCode && PTO_STATUS_CODES.has(statusCode)) return "PTO";
  if (statusCode && OFF_STATUS_CODES.has(statusCode)) return "OFF";
  if (item.time_in || item.time_out) return "ACT";

  return "OFF";
}

function buildTimeLabel(item: ApiTimesheet, status: "ACT" | "OFF" | "PTO"): string {
  if (status === "OFF") return "Rest Day";
  if (status === "PTO") return prettifyLeaveType(item.leave_type);

  const timeIn = formatTimeValue(item.time_in);
  const timeOut = formatTimeValue(item.time_out);

  if (timeIn && timeOut) return `${timeIn} - ${timeOut}`;
  if (timeIn) return timeIn;

  return "Shift Assigned";
}

function mapTimesheetToDay(item: ApiTimesheet, date: Date): WeekScheduleDay {
  const isoDate = toIsoDay(date);
  const status = normalizeStatus(item);

  return {
    id: isoDate,
    isoDate,
    weekdayLabel: date.toLocaleDateString(undefined, { weekday: "long" }),
    fullDateLabel: date.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "2-digit",
    }),
    status,
    timeLabel: buildTimeLabel(item, status),
    role: safeString(item.specialty) ?? safeString(item.program),
    site: safeString(item.site) ?? safeString(item.work_location),
    teamLeader: safeString(item.tl_name),
    breaks: formatBreaks(item.breaks),
  };
}

function buildDefaultDay(date: Date): WeekScheduleDay {
  const isoDate = toIsoDay(date);
  const missingDateLabel = date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "2-digit",
  });

  return {
    id: isoDate,
    isoDate,
    weekdayLabel: date.toLocaleDateString(undefined, { weekday: "long" }),
    fullDateLabel: date.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "2-digit",
    }),
    status: "NO_INFO",
    timeLabel: `No information for ${missingDateLabel}`,
  };
}

function buildTeamDefaultDay(date: Date): TeamScheduleDay {
  const isoDate = toIsoDay(date);

  return {
    id: isoDate,
    isoDate,
    weekdayLabel: date.toLocaleDateString(undefined, { weekday: "long" }),
    fullDateLabel: date.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "2-digit",
    }),
    status: "NO_INFO",
    members: [],
  };
}

function mergeDays(current: WeekScheduleDay | undefined, incoming: WeekScheduleDay): WeekScheduleDay {
  if (!current) return incoming;
  if (current.status !== "ACT" && incoming.status === "ACT") return incoming;
  if (current.status === "ACT" && incoming.status !== "ACT") return current;

  return {
    ...current,
    ...incoming,
    timeLabel:
      current.status === "ACT" &&
      incoming.status === "ACT" &&
      current.timeLabel !== incoming.timeLabel
        ? `${current.timeLabel} / ${incoming.timeLabel}`
        : current.timeLabel,
    breaks: current.breaks ?? incoming.breaks,
  };
}

function buildTeamMemberName(item: ApiTimesheet): string {
  return safeString(item.agent_name) ?? safeString(item.employee_id) ?? "Unknown employee";
}

function mapTimesheetToTeamMember(item: ApiTimesheet): TeamScheduleMember {
  const status = normalizeStatus(item);
  const employeeId = safeString(item.employee_id);
  const employeeName = buildTeamMemberName(item);

  return {
    id: `${employeeId ?? employeeName}-${safeString(item.shift_date) ?? "shift"}`,
    employeeId,
    employeeName,
    status,
    timeLabel: buildTimeLabel(item, status),
    role: safeString(item.specialty) ?? safeString(item.program),
    site: safeString(item.site) ?? safeString(item.work_location),
    teamLeader: safeString(item.tl_name),
    breaks: formatBreaks(item.breaks),
  };
}

function mergeTeamMembers(
  current: TeamScheduleMember | undefined,
  incoming: TeamScheduleMember,
): TeamScheduleMember {
  if (!current) return incoming;
  if (current.status !== "ACT" && incoming.status === "ACT") return incoming;
  if (current.status === "ACT" && incoming.status !== "ACT") return current;

  return {
    ...current,
    ...incoming,
    timeLabel:
      current.status === "ACT" &&
      incoming.status === "ACT" &&
      current.timeLabel !== incoming.timeLabel
        ? `${current.timeLabel} / ${incoming.timeLabel}`
        : current.timeLabel,
    breaks: current.breaks ?? incoming.breaks,
  };
}

function extractTeamTimesheets(payload: unknown): ApiTimesheet[] {
  if (Array.isArray(payload)) {
    return payload.filter((entry) => isRecord(entry)) as ApiTimesheet[];
  }

  if (!isRecord(payload)) return [];

  const data = payload as EmployeeScheduleApiResponse & TeamScheduleApiResponse;
  const schedulesFromWeeks = (data.weeks ?? []).flatMap((week) => [
    ...(week.schedules ?? []),
    ...((week as ApiTeamWeek).agents ?? []),
    ...(((week as ApiTeamWeek).agents ?? []).flatMap((agent) => agent.schedules ?? [])),
  ]);
  if (schedulesFromWeeks.length > 0) return schedulesFromWeeks;

  if (isRecord(data.employee) && safeString((data.employee as ApiTimesheet).shift_date)) {
    return [data.employee as ApiTimesheet];
  }

  return [];
}

function extractPersonalTimesheets(
  payload: unknown,
  employeeId?: string,
): ApiTimesheet[] {
  if (Array.isArray(payload)) {
    return payload.filter((entry) => isRecord(entry)) as ApiTimesheet[];
  }

  if (!isRecord(payload)) return [];

  const data = payload as EmployeeScheduleApiResponse;

  if (isRecord(data.employee) && safeString((data.employee as ApiTimesheet).shift_date)) {
    return [data.employee as ApiTimesheet];
  }

  const weeks = data.weeks ?? [];
  const schedulesFromWeeks = weeks.flatMap((week) => {
    const weekSchedules = week.schedules ?? [];
    const agents = Array.isArray((week as ApiTeamWeek).agents)
      ? (week as ApiTeamWeek).agents ?? []
      : [];
    const agentSchedules = agents.flatMap((agent) =>
      Array.isArray(agent.schedules) && agent.schedules.length > 0 ? agent.schedules : [agent],
    );

    return [...weekSchedules, ...agentSchedules];
  });
  if (schedulesFromWeeks.length > 0) {
    const normalizedEmployeeId = safeString(employeeId);
    if (!normalizedEmployeeId) return schedulesFromWeeks;

    const matchedSchedules = schedulesFromWeeks.filter(
      (item) => safeString(item.employee_id) === normalizedEmployeeId,
    );
    if (SCHEDULE_DEBUG_ENABLED) {
      console.log("[schedule:personal] matched personal schedules", {
        employeeId: normalizedEmployeeId,
        totalSchedules: schedulesFromWeeks.length,
        matchedSchedules: matchedSchedules.length,
      });
    }
    return matchedSchedules;
  }

  return [];
}

function extractTeamWeeks(payload: unknown): ApiTeamWeek[] {
  if (!isRecord(payload)) return [];
  const weeks = (payload as TeamScheduleApiResponse).weeks;
  if (!Array.isArray(weeks)) return [];
  return weeks.filter((entry): entry is ApiTeamWeek => isRecord(entry));
}

function shouldLoadNextTeamPage(weeks: ApiTeamWeek[]): boolean {
  return weeks.some((week) => Boolean(week.paginations?.has_next));
}

async function fetchSchedulePayload(
  searchDate: string,
  weekStartIso: string,
  employeeId?: string,
): Promise<unknown> {
  if (employeeId) {
    try {
      const response = await apiClient.get<unknown>("/mobile/api/schedule/team/", {
        params: {
          employee_id: employeeId,
          page: 1,
          page_size: 50,
          week: weekStartIso,
          schedule: searchDate,
        },
      });
      return response.data;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 400) {
        const fallbackResponse = await apiClient.get<unknown>("/mobile/api/schedule/team/", {
          params: {
            employee_id: employeeId,
            page: 1,
            page_size: 50,
            week: weekStartIso,
          },
        });
        return fallbackResponse.data;
      }
      throw toError(error);
    }
  }

  try {
    const response = await apiClient.get<unknown>(API_ENDPOINT, {
      params: { search_date: searchDate },
    });
    if (SCHEDULE_DEBUG_ENABLED) {
      const data = isRecord(response.data) ? response.data : null;
      const weeks = data && Array.isArray((data as { weeks?: unknown }).weeks)
        ? ((data as { weeks: unknown[] }).weeks)
        : [];
      const firstWeek = weeks.length > 0 && isRecord(weeks[0]) ? weeks[0] : null;

      console.log("[schedule:personal] /mobile/api/schedule response", {
        searchDate,
        response: response.data,
      });
      console.log("[schedule:personal] response shape", {
        topLevelKeys: data ? Object.keys(data) : [],
        weeksLength: weeks.length,
        firstWeekKeys: firstWeek ? Object.keys(firstWeek) : [],
        firstWeek,
      });
    }
    return response.data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 400) {
      try {
        const fallbackResponse = await apiClient.get<unknown>(API_ENDPOINT);
        return fallbackResponse.data;
      } catch (fallbackError) {
        captureException(fallbackError, {
          scope: "schedule_service",
          action: "fetch_schedule_payload_fallback",
          extras: { searchDate },
        });
        throw toError(fallbackError);
      }
    }

    captureException(error, {
      scope: "schedule_service",
      action: "fetch_schedule_payload",
      extras: { searchDate },
    });
    throw toError(error);
  }
}

async function fetchTeamSchedulePayload(searchDate: string): Promise<TeamScheduleApiResponse> {
  try {
    const aggregatedWeeks: ApiTeamWeek[] = [];
    let page = 1;
    let hasNext = true;

    while (hasNext && page <= 20) {
      const response = await apiClient.get<TeamScheduleApiResponse>("/mobile/api/schedule/team/", {
        params: {
          schedule: searchDate,
          page,
          page_size: 100,
        },
      });

      const pageWeeks = extractTeamWeeks(response.data);
      aggregatedWeeks.push(...pageWeeks);
      hasNext = shouldLoadNextTeamPage(pageWeeks);
      page += 1;
    }

    return { weeks: aggregatedWeeks };
  } catch (error) {
    captureException(error, {
      scope: "schedule_service",
      action: "fetch_team_schedule_payload",
      extras: { searchDate },
    });
    throw toError(error);
  }
}

export async function getWeekSchedule(
  weekStartDate: Date,
  options?: { employeeId?: string; source?: "personal" | "team" },
): Promise<WeekScheduleResponse> {
  const weekStart = startOfWeekMonday(weekStartDate);
  const weekEnd = addDays(weekStart, 6);
  const weekStartIso = toIsoDay(weekStart);
  const weekEndIso = toIsoDay(weekEnd);
  const today = startOfDay(new Date());
  const todayIso = toIsoDay(today);
  const currentWeekStartIso = toIsoDay(startOfWeekMonday(today));
  const searchDate = weekStartIso === currentWeekStartIso ? todayIso : weekStartIso;

  const payload = await fetchSchedulePayload(
    searchDate,
    weekStartIso,
    options?.source === "team" ? options?.employeeId : undefined,
  );
  const timesheets =
    options?.source === "team"
      ? extractTeamTimesheets(payload)
      : extractPersonalTimesheets(payload, options?.employeeId);

  const startMs = weekStart.getTime();
  const endMs = weekEnd.getTime();

  const daysMap = new Map<string, WeekScheduleDay>();

  for (const item of timesheets) {
    const shiftDate = parseDateOnly(item.shift_date);
    if (!shiftDate) continue;

    const dateMs = shiftDate.getTime();
    if (dateMs < startMs || dateMs > endMs) continue;

    const mapped = mapTimesheetToDay(item, shiftDate);
    daysMap.set(mapped.isoDate, mergeDays(daysMap.get(mapped.isoDate), mapped));
  }

  const days = Array.from({ length: 7 }, (_, dayIndex) => {
    const date = addDays(weekStart, dayIndex);
    const iso = toIsoDay(date);
    return daysMap.get(iso) ?? buildDefaultDay(date);
  });

  return {
    weekStartIso,
    weekEndIso,
    days,
  };
}

export async function getTeamWeekSchedule(
  weekStartDate: Date,
): Promise<TeamWeekScheduleResponse> {
  const weekStart = startOfWeekMonday(weekStartDate);
  const weekEnd = addDays(weekStart, 6);
  const weekStartIso = toIsoDay(weekStart);
  const weekEndIso = toIsoDay(weekEnd);

  const payload = await fetchTeamSchedulePayload(weekStartIso);
  const weeks = extractTeamWeeks(payload);

  const startMs = weekStart.getTime();
  const endMs = weekEnd.getTime();
  const dayMembersMap = new Map<string, Map<string, TeamScheduleMember>>();

  for (const week of weeks) {
    const agents = week.agents ?? [];
    for (const agent of agents) {
      const sourceSchedules =
        Array.isArray(agent.schedules) && agent.schedules.length > 0 ? agent.schedules : [agent];

      for (const scheduleItem of sourceSchedules) {
        const shiftDate = parseDateOnly(scheduleItem.shift_date);
        if (!shiftDate) continue;

        const dateMs = shiftDate.getTime();
        if (dateMs < startMs || dateMs > endMs) continue;

        const isoDate = toIsoDay(shiftDate);
        const currentDayMap = dayMembersMap.get(isoDate) ?? new Map<string, TeamScheduleMember>();
        const mapped = mapTimesheetToTeamMember({
          ...scheduleItem,
          employee_id: scheduleItem.employee_id ?? agent.employee_id,
          agent_name: scheduleItem.agent_name ?? agent.agent_name,
          tl_name: scheduleItem.tl_name ?? agent.tl_name,
          specialty: scheduleItem.specialty ?? agent.specialty,
          program: scheduleItem.program ?? agent.program,
          site: scheduleItem.site ?? agent.site,
          work_location: scheduleItem.work_location ?? agent.work_location,
          breaks: scheduleItem.breaks ?? agent.breaks,
        });
        const memberKey = mapped.employeeId ?? mapped.employeeName;
        currentDayMap.set(memberKey, mergeTeamMembers(currentDayMap.get(memberKey), mapped));
        dayMembersMap.set(isoDate, currentDayMap);
      }
    }
  }

  const days = Array.from({ length: 7 }, (_, dayIndex) => {
    const date = addDays(weekStart, dayIndex);
    const isoDate = toIsoDay(date);
    const members = Array.from(dayMembersMap.get(isoDate)?.values() ?? []).sort((left, right) =>
      left.employeeName.localeCompare(right.employeeName),
    );

    if (members.length === 0) {
      return buildTeamDefaultDay(date);
    }

    return {
      id: isoDate,
      isoDate,
      weekdayLabel: date.toLocaleDateString(undefined, { weekday: "long" }),
      fullDateLabel: date.toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "2-digit",
      }),
      status: "HAS_DATA" as const,
      members,
    };
  });

  return {
    weekStartIso,
    weekEndIso,
    days,
  };
}

export default { getWeekSchedule, getTeamWeekSchedule };
