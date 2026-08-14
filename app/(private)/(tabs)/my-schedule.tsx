import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import ScheduleView from "@/components/schedule/schedule-view";
import TeamScheduleView from "@/components/schedule/team-schedule-view";
import { useScreenView } from "@/src/analytics/useScreenView";
import { canAccessMyTeam, getEmployeeJob } from "@/src/services/teamService";

export default function MyScheduleScreen() {
  useScreenView("my_schedule");
  const [isLoadingRole, setIsLoadingRole] = useState(true);
  const [isTeamLeader, setIsTeamLeader] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadRole = async () => {
      try {
        const job = await getEmployeeJob();
        if (!mounted) return;
        setIsTeamLeader(canAccessMyTeam(job.job_profile));
      } catch {
        if (mounted) setIsTeamLeader(false);
      } finally {
        if (mounted) setIsLoadingRole(false);
      }
    };

    loadRole();

    return () => {
      mounted = false;
    };
  }, []);

  if (isLoadingRole) {
    return (
      <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
        <ActivityIndicator color="#ff5d38" />
      </View>
    );
  }

  if (isTeamLeader) {
    return <TeamScheduleView title="My Team's Schedule" />;
  }

  return <ScheduleView title="My Schedules" />;
}
