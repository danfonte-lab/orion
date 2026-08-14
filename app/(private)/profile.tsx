import { useColorScheme } from "@/hooks/use-color-scheme";
import { captureException } from "@/src/monitoring/sentry";
import { useScreenView } from "@/src/analytics/useScreenView";
import { useAuth } from "@/src/auth/AuthContext";
import { isSessionExpiredError } from "@/src/auth/auth-session";
import {
  getCachedEmployeeProfile,
  getEmployeeManager,
  type EmployeeManagerResponse,
  type EmployeeProfileResponse,
} from "@/src/services/profileService";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View className="flex-row items-center justify-between py-2.5 border-b border-primary/10">
      <Text className="font-sans text-sm text-neutral-soft dark:text-neutral-soft-dark">{label}</Text>
      <Text className="font-sans text-sm font-bold text-neutral-dark dark:text-[#F6EDE8] max-w-[55%] text-right">
        {value || "—"}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  useScreenView("profile");
  const { user, logout, getValidAccessToken } = useAuth() as any;
  const router = useRouter();
  const colorScheme = useColorScheme();

  const [profile, setProfile] = useState<EmployeeProfileResponse["profile"]>();
  const [manager, setManager] = useState<EmployeeManagerResponse | null>(null);
  const [isManagerLoading, setIsManagerLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const normalizeManager = (
    data: EmployeeManagerResponse | null | undefined,
  ): EmployeeManagerResponse | null => {
    if (!data) return null;
    return {
      manager_id: data.manager_id,
      full_name: data.full_name,
      job_title: data.job_title,
      business_title: data.business_title,
    };
  };

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await getCachedEmployeeProfile();
        if (!mounted) return;
        setProfile(res.profile);

        if (user?.employee_id) {
          setIsManagerLoading(true);
          try {
            const accessToken = await getValidAccessToken?.();
            const managerRes = await getEmployeeManager(
              user.employee_id,
              accessToken ?? undefined,
            );
            const nextManager = normalizeManager(managerRes);
            if (mounted) setManager(nextManager);
          } catch (e) {
            captureException(e, {
              scope: "profile_screen",
              action: "load_manager",
            });
            if (mounted) setManager(null);
          } finally {
            if (mounted) setIsManagerLoading(false);
          }
        }
      } catch (e) {
        captureException(e, {
          scope: "profile_screen",
          action: "load_profile",
        });
        if (!mounted) return;
        if (isSessionExpiredError(e)) return;
        setError(e instanceof Error ? e.message : "Failed to load profile.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadProfile();
    return () => {
      mounted = false;
    };
  }, []);

  if (!user) return null;

  const imageSource = user.profilePicture
    ? user.profilePicture.startsWith("http")
      ? { uri: user.profilePicture }
      : { uri: `data:image/png;base64,${user.profilePicture}` }
    : require("../../assets/images/icon.png");

  const fullName =
    profile?.full_name?.trim() ||
    profile?.preferred_name?.trim() ||
    user.name?.trim() ||
    user.username;

  const workIds = profile?.work_ids ?? [];

  return (
    <SafeAreaView
      edges={["top"]}
      className="flex-1 bg-background-light dark:bg-background-dark"
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View className="px-4 pt-2 flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-3 p-1">
            <MaterialIcons
              name="arrow-back"
              size={26}
              color={colorScheme === "dark" ? "#F6EDE8" : "#181210"}
            />
          </Pressable>
          <Text className="font-serif text-4xl text-neutral-dark dark:text-[#F6EDE8]">
            Profile
          </Text>
        </View>

        <View className="mx-4 mt-4 rounded-3xl border border-primary/10 bg-white dark:bg-surface-dark p-5">
          <View className="flex-row items-center">
            <Image source={imageSource} className="h-24 w-24 rounded-2xl" />

            <View className="ml-4 flex-1">
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 pr-3 font-sans text-2xl font-bold text-neutral-dark dark:text-[#F6EDE8]">
                  {fullName}
                </Text>
                <Pressable
                  onPress={() => router.push("/(private)/settings")}
                  className="rounded-full bg-primary p-2"
                >
                  <MaterialIcons name="settings" size={16} color="#FFFFFF" />
                </Pressable>
              </View>
              <Text className="mt-1 font-sans text-sm text-neutral-soft dark:text-neutral-soft-dark">{user.email}</Text>
              {profile?.employee_id ? (
                <Text className="mt-2 font-sans text-xs text-neutral-soft dark:text-neutral-soft-dark">
                  ID {profile.employee_id}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <View className="mx-4 mt-4 rounded-3xl border border-primary/10 bg-white dark:bg-surface-dark p-5">
          <Text className="font-sans text-xs font-bold uppercase tracking-widest text-primary/70">
            Job Details
          </Text>
          <View className="mt-3">
            <FieldRow label="Job title" value={user.job_title} />
            <FieldRow label="Job category" value={user.job_category} />
            <FieldRow
              label="Manager name"
              value={
                isManagerLoading
                  ? "Loading..."
                  : manager?.full_name || "—"
              }
            />
          </View>
        </View>

        <View className="mx-4 mt-4 rounded-3xl border border-primary/10 bg-white dark:bg-surface-dark p-5">
          <Text className="font-sans text-xs font-bold uppercase tracking-widest text-primary/70">
            Profile Overview
          </Text>

          {isLoading ? (
            <Text className="mt-4 font-sans text-neutral-soft dark:text-neutral-soft-dark">Loading profile...</Text>
          ) : error ? (
            <Text className="mt-4 font-sans text-red-600">{error}</Text>
          ) : (
            <View className="mt-3">
              <FieldRow label="Preferred name" value={profile?.preferred_name} />
              <FieldRow label="Full name" value={profile?.full_name} />
              <FieldRow label="Pronouns" value={profile?.pronouns} />
              <FieldRow
                label="Gender"
                value={profile?.gender_display || profile?.gender}
              />
              <FieldRow
                label="Legal sex"
                value={profile?.legal_sex_display || profile?.legal_sex}
              />
              <FieldRow label="Birth date" value={profile?.birth_date} />
              <FieldRow label="Birth place" value={profile?.birth_place} />
              <FieldRow
                label="Nationality"
                value={profile?.primary_nationality}
              />
              <FieldRow label="Marital status" value={profile?.marital_status} />
            </View>
          )}
        </View>

        <View className="mx-4 mt-4 rounded-3xl border border-primary/10 bg-white dark:bg-surface-dark p-5">
          <Text className="font-sans text-xs font-bold uppercase tracking-widest text-primary/70">
            Work IDs
          </Text>
          {isLoading ? (
            <Text className="mt-4 font-sans text-neutral-soft dark:text-neutral-soft-dark">Loading IDs...</Text>
          ) : workIds.length === 0 ? (
            <Text className="mt-4 font-sans text-neutral-soft dark:text-neutral-soft-dark">No work IDs on file.</Text>
          ) : (
            <View className="mt-3 gap-2">
              {workIds.map((workId, index) => (
                <View
                  key={`${workId.id_number ?? "id"}-${index}`}
                  className="rounded-2xl border border-primary/10 px-4 py-3 flex-row items-center justify-between"
                >
                  <Text className="font-sans text-sm text-neutral-soft dark:text-neutral-soft-dark">
                    {workId.national_id_name || "ID"}
                  </Text>
                  <Text className="font-sans text-sm font-bold text-neutral-dark dark:text-[#F6EDE8]">
                    {workId.id_number || "—"}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View className="mx-4 mt-6">
          <Pressable
            className="rounded-2xl border border-primary/20 bg-white dark:bg-surface-dark px-4 py-3 flex-row items-center justify-center"
            onPress={() => {
              Alert.alert("Confirm logout", "Are you sure you want to logout?", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Logout",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await logout?.();
                    } catch (error) {
                      captureException(error, {
                        scope: "profile_screen",
                        action: "logout",
                      });
                      Alert.alert("Error", "Logout failed. Please try again.");
                    }
                  },
                },
              ]);
            }}
          >
            <MaterialIcons name="logout" size={18} color="#E85D3F" />
            <Text className="ml-2 font-sans text-base font-bold text-primary">Logout</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
