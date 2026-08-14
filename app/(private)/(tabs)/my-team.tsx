import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import ScheduleView from "@/components/schedule/schedule-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useScreenView } from "@/src/analytics/useScreenView";
import { isSessionExpiredError } from "@/src/auth/auth-session";
import {
  getRoutesConfig,
  type RouteConfigItem,
} from "@/src/services/accessControlService";
import {
  getEmployeeOrgChart,
  type OrgChartPerson,
} from "@/src/services/teamService";

const TEAM_VIEW_PERMISSION = "tl_schedule_view_access";

function normalizeValue(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function hasTeamAccess(routesConfig: RouteConfigItem[]): boolean {
  return routesConfig.some(
    (item) => normalizeValue(item.allowed_permission) === TEAM_VIEW_PERMISSION,
  );
}

function getFullName(person: OrgChartPerson): string {
  if (person.full_name?.trim()) return person.full_name.trim();
  const first = person.first_name?.trim() ?? "";
  const last = person.last_name?.trim() ?? "";
  const fallback = `${first} ${last}`.trim();
  return fallback || person.employee_id || "Unknown";
}

function getInitials(person: OrgChartPerson): string {
  if (person.initials?.trim()) return person.initials.trim().toUpperCase();
  const name = getFullName(person);
  const parts = name.split(" ").filter(Boolean);
  const fromParts = parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return fromParts || "--";
}

export default function MyTeamScreen() {
  useScreenView("my_team");
  const [manager, setManager] = useState<OrgChartPerson | null>(null);
  const [directReports, setDirectReports] = useState<OrgChartPerson[]>([]);
  const [selectedReport, setSelectedReport] = useState<OrgChartPerson | null>(null);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [canViewTeamTab, setCanViewTeamTab] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const routesConfig = await getRoutesConfig(true);
      const canViewTeam = hasTeamAccess(routesConfig);

      setCanViewTeamTab(canViewTeam);
      if (!canViewTeam) {
        setManager(null);
        setDirectReports([]);
        return;
      }

      const orgChartResponse = await getEmployeeOrgChart(true);

      setManager(orgChartResponse.manager ?? null);
      setDirectReports(orgChartResponse.direct_reports ?? []);
    } catch (nextError) {
      if (isSessionExpiredError(nextError)) return;
      setError(nextError instanceof Error ? nextError.message : "Failed to load team.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (selectedReport) {
    return (
      <ScheduleView
        title={getFullName(selectedReport)}
        employeeId={selectedReport.employee_id ?? undefined}
        onBack={() => setSelectedReport(null)}
      />
    );
  }

  return (
    <View className="flex-1 bg-background-light dark:bg-background-dark">
      <View className="px-4 pt-6 pb-2">
        <Text className="font-serif text-3xl text-neutral-dark dark:text-[#F6EDE8]">My Team</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#ff5d38" />
        </View>
      ) : null}

      {!isLoading && error ? (
        <View className="px-4 pt-3">
          <View className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4">
            <Text className="font-sans text-sm text-red-700 dark:text-red-300">{error}</Text>
            <Pressable onPress={loadData} className="mt-3 self-start rounded-xl bg-red-600 px-4 py-2">
              <Text className="font-sans text-xs font-bold uppercase tracking-wide text-white">
                Retry
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {!isLoading && !error && !canViewTeamTab ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center font-sans text-sm text-neutral-soft dark:text-neutral-soft-dark">
            You do not currently have access to view direct report schedules.
          </Text>
        </View>
      ) : null}

      {!isLoading && !error && canViewTeamTab ? (
        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 20 }}>
          {manager ? (
            <View className="mb-2 rounded-2xl border border-neutral-dark/10 bg-surface-light p-4 dark:border-white/10 dark:bg-surface-dark">
              <Text className="font-sans text-[10px] font-bold uppercase tracking-widest text-neutral-dark/40 dark:text-white/40">
                Manager
              </Text>
              <Text className="mt-1 font-sans text-lg font-bold text-neutral-dark dark:text-[#F6EDE8]">
                {getFullName(manager)}
              </Text>
              <Text className="mt-0.5 font-sans text-sm text-neutral-soft dark:text-neutral-soft-dark">
                {manager.job_title || "Team"} • {directReports.length} direct reports
              </Text>
            </View>
          ) : null}

          <View className="gap-2">
            {directReports.map((report) => {
              const employeeId = report.employee_id ?? "";
              const isExpanded = expandedReportId === employeeId;

              return (
                <Pressable
                  key={employeeId || getFullName(report)}
                  onPress={() => setExpandedReportId(isExpanded ? null : employeeId)}
                  className="rounded-2xl border border-neutral-dark/10 bg-surface-light p-4 dark:border-white/10 dark:bg-surface-dark"
                >
                  <View className="flex-row items-center">
                    <View className="h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                      <Text className="font-sans text-sm font-bold text-primary">{getInitials(report)}</Text>
                    </View>

                    <View className="ml-3 flex-1">
                      <Text className="font-sans text-base font-bold text-neutral-dark dark:text-[#F6EDE8]">
                        {getFullName(report)}
                      </Text>
                      <Text className="mt-0.5 font-sans text-xs text-neutral-soft dark:text-neutral-soft-dark">{report.job_title || "—"}</Text>
                    </View>

                    <Pressable
                      onPress={() => setSelectedReport(report)}
                      accessibilityRole="button"
                      accessibilityLabel={`View schedule for ${getFullName(report)}`}
                      className="h-9 w-9 items-center justify-center rounded-full border border-neutral-dark/15 bg-surface-light dark:border-white/15 dark:bg-surface-dark"
                    >
                      <IconSymbol name="calendar" size={19} color="#ff5d38" />
                    </Pressable>
                  </View>

                  {isExpanded ? (
                    <View className="mt-3 border-t border-neutral-dark/10 pt-3 dark:border-white/10">
                      <Text className="font-sans text-xs text-neutral-soft dark:text-neutral-soft-dark">
                        Employee ID: {report.employee_id || "—"}
                      </Text>
                      <Text className="mt-1 font-sans text-xs text-neutral-soft dark:text-neutral-soft-dark">Email: {report.email || "—"}</Text>
                      <Text className="mt-1 font-sans text-xs text-neutral-soft dark:text-neutral-soft-dark">
                        Location: {report.location || "—"}
                      </Text>
                      <Text className="mt-1 font-sans text-xs text-neutral-soft dark:text-neutral-soft-dark">
                        Direct Reports: {report.direct_reports_count ?? 0}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}
