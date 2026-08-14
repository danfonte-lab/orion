import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/src/auth/AuthContext";
import { useTaskNotifications } from "@/src/notifications/TaskNotificationsContext";
import { useRouter } from "expo-router";
import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function UserHeader() {
  const { user } = useAuth();
  const { pendingTaskCount } = useTaskNotifications();
  const router = useRouter();
  const isDark = useColorScheme() === "dark";

  if (!user) return null;

  const profilePictureSource = user.profilePicture?.startsWith("http")
    ? { uri: user.profilePicture }
    : user.profilePicture
      ? { uri: `data:image/png;base64,${user.profilePicture}` }
      : undefined;

  return (
    <SafeAreaView edges={["top"]} className="bg-background-light dark:bg-background-dark">
      <View className="flex-row items-center justify-between px-4 pb-3 pt-1 border-b border-primary/10 dark:border-primary/20">
        <Pressable onPress={() => router.push("/(private)/profile")}>
          <View className="h-10 w-10 rounded-full overflow-hidden border-2 border-primary/20 bg-primary/10 items-center justify-center">
            {profilePictureSource ? (
              <Image source={profilePictureSource} className="h-10 w-10" />
            ) : (
              <Text className="font-sans font-bold text-neutral-dark dark:text-[#F6EDE8]">
                {user.username?.[0]?.toUpperCase() ?? "U"}
              </Text>
            )}
          </View>
        </Pressable>

        <Image
          source={
            isDark
              ? require("../assets/images/logo-dark.png")
              : require("../assets/images/logo-light.png")
          }
          className="h-7 w-32"
          resizeMode="contain"
          accessibilityLabel="Ubiquity logo"
        />

        <Pressable
          className="relative h-10 w-10 rounded-full bg-primary/5 dark:bg-primary/10 items-center justify-center"
          onPress={() => router.push("/(private)/notifications")}
          accessibilityLabel="Open notifications"
        >
          <IconSymbol
            name="bell"
            size={22}
            color={isDark ? "#F6EDE8" : "#181210"}
          />
          {pendingTaskCount > 0 ? (
            <View className="absolute right-0 top-0 min-h-5 min-w-5 rounded-full bg-primary px-1 items-center justify-center">
              <Text className="font-sans text-[10px] font-bold text-white">
                {pendingTaskCount > 99 ? "99+" : pendingTaskCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
