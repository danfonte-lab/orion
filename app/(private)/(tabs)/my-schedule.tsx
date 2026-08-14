import React from "react";

import ScheduleView from "@/components/schedule/schedule-view";
import { useScreenView } from "@/src/analytics/useScreenView";
import { useAuth } from "@/src/auth/AuthContext";

export default function MyScheduleScreen() {
  useScreenView("my_schedule");
  const { user } = useAuth();

  return (
    <ScheduleView
      title="My Schedules"
      employeeId={user?.employee_id ?? undefined}
      scheduleSource="personal"
    />
  );
}
