import { Tabs } from "expo-router";
import React, { useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { UserHeader } from "@/components/user-header";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  getRoutesConfig,
  type RouteConfigItem,
} from "@/src/services/accessControlService";

type ManagedTabKey = "newsFeed" | "my-team" | "my-schedule" | "payslip";

const TAB_ROUTE_CONFIG: Record<
  ManagedTabKey,
  {
    allowedPermission: string;
    fallbackTitle: string;
    iconName: React.ComponentProps<typeof IconSymbol>["name"];
  }
> = {
  newsFeed: {
    allowedPermission: "newsfeed_view_access",
    fallbackTitle: "Home",
    iconName: "house",
  },
  "my-team": {
    allowedPermission: "tl_schedule_view_access",
    fallbackTitle: "My Team",
    iconName: "person.2",
  },
  "my-schedule": {
    allowedPermission: "schedule_view_access",
    fallbackTitle: "Schedules",
    iconName: "calendar",
  },
  payslip: {
    allowedPermission: "employee_payslip_view_access",
    fallbackTitle: "Payslip",
    iconName: "doc.text",
  },
};

function normalizeValue(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const insets = useSafeAreaInsets();
  const [routesConfig, setRoutesConfig] = useState<RouteConfigItem[]>([]);

  useEffect(() => {
    let mounted = true;

    const loadRoutesConfig = async () => {
      try {
        const modules = await getRoutesConfig();
        if (!mounted) return;
        setRoutesConfig(modules);
      } catch {
        if (mounted) setRoutesConfig([]);
      }
    };

    loadRoutesConfig();

    return () => {
      mounted = false;
    };
  }, []);

  const getTabConfig = (tabKey: ManagedTabKey) => {
    const expectedPermission = TAB_ROUTE_CONFIG[tabKey].allowedPermission;
    const match = routesConfig.find(
      (item) => normalizeValue(item.allowed_permission) === expectedPermission,
    );

    return {
      isVisible: Boolean(match),
      title: match?.title?.trim() || TAB_ROUTE_CONFIG[tabKey].fallbackTitle,
      iconName: TAB_ROUTE_CONFIG[tabKey].iconName,
    };
  };

  const newsFeedTab = getTabConfig("newsFeed");
  const myTeamTab = getTabConfig("my-team");
  const scheduleTab = getTabConfig("my-schedule");
  const payslipTab = getTabConfig("payslip");

  return (
    <Tabs
      initialRouteName="newsFeed"
      screenOptions={{
        header: () => <UserHeader />,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: theme.tabIconSelected,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        },
        sceneStyle: {
          backgroundColor: theme.background,
        },
        tabBarStyle: {
          backgroundColor: colorScheme === "dark" ? "#2b1c18" : "#FFFFFF",
          borderTopColor: theme.border,
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 10),
          height: 58 + Math.max(insets.bottom, 10),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="newsFeed"
        options={{
          href: newsFeedTab.isVisible ? undefined : null,
          title: newsFeedTab.title,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name={newsFeedTab.iconName} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-team"
        options={{
          href: myTeamTab.isVisible ? undefined : null,
          title: myTeamTab.title,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name={myTeamTab.iconName} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-schedule"
        options={{
          href: scheduleTab.isVisible ? undefined : null,
          title: scheduleTab.title,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name={scheduleTab.iconName} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="payslip"
        options={{
          href: payslipTab.isVisible ? undefined : null,
          title: payslipTab.title,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name={payslipTab.iconName} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
