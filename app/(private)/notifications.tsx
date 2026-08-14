import { useColorScheme } from "@/hooks/use-color-scheme";
import { useScreenView } from "@/src/analytics/useScreenView";
import { buildTaskNotificationBody, formatTaskTimestamp } from "@/src/notifications/taskNotificationUtils";
import { useTaskNotifications } from "@/src/notifications/TaskNotificationsContext";
import { isSessionExpiredError } from "@/src/auth/auth-session";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function NotificationsScreen() {
  useScreenView("notifications");
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { openTasks, isTasksLoading, refreshCounts, refreshTasks } = useTaskNotifications();
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setError(null);

    try {
      await Promise.all([refreshCounts(true), refreshTasks(true)]);
    } catch (nextError) {
      if (isSessionExpiredError(nextError)) return;
      setError(nextError instanceof Error ? nextError.message : "Failed to load notifications.");
    }
  }, [refreshCounts, refreshTasks]);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks]),
  );

  return (
    <SafeAreaView
      edges={["top"]}
      className="flex-1 bg-background-light dark:bg-background-dark"
    >
      <View className="px-4 pt-2 pb-4 flex-row items-center">
        <Pressable onPress={() => router.back()} className="mr-3 p-1">
          <MaterialIcons
            name="arrow-back"
            size={26}
            color={colorScheme === "dark" ? "#F6EDE8" : "#181210"}
          />
        </Pressable>
        <Text className="font-serif text-4xl text-neutral-dark dark:text-[#F6EDE8]">
          Notifications
        </Text>
      </View>

      <FlatList
        data={openTasks}
        keyExtractor={(item, index) => `${String(item.id)}-${index}`}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ListEmptyComponent={
          isTasksLoading ? (
            <View className="py-10 items-center">
              <ActivityIndicator color="#ff5d38" />
            </View>
          ) : error ? (
            <View className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4">
              <Text className="font-sans text-sm text-red-700 dark:text-red-300">{error}</Text>
              <Pressable onPress={loadTasks} className="mt-3 self-start rounded-xl bg-red-600 px-4 py-2">
                <Text className="font-sans text-xs font-bold uppercase tracking-wide text-white">
                  Retry
                </Text>
              </Pressable>
            </View>
          ) : (
            <View className="py-10">
              <Text className="text-center font-sans text-sm text-neutral-soft dark:text-neutral-soft-dark">
                No pending tasks.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(private)/task/[taskId]",
                params: { taskId: String(item.id) },
              })
            }
            className="mb-3 rounded-2xl border border-primary/10 bg-white dark:bg-surface-dark p-4 flex-row"
          >
            <View className="flex-1">
              <Text className="font-sans font-bold text-neutral-dark dark:text-[#F6EDE8]">
                {item.name?.trim() || `Task #${item.id}`}
              </Text>
              <Text className="mt-1 font-sans text-sm text-neutral-soft dark:text-neutral-soft-dark">
                {buildTaskNotificationBody(item)}
              </Text>
            </View>

            <View className="ml-3 w-20 items-end justify-between">
              <Text className="text-right font-sans text-xs text-neutral-soft dark:text-neutral-soft-dark">
                {formatTaskTimestamp(item.created_at)}
              </Text>
              <View className="flex-row items-center rounded-full bg-primary/10 px-2.5 py-1">
                <Ionicons name="notifications" size={12} color="#ff5d38" />
                <Text className="ml-1 font-sans text-[10px] font-bold uppercase tracking-wide text-primary">
                  task
                </Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
