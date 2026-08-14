import { useColorScheme } from "@/hooks/use-color-scheme";
import { useScreenView } from "@/src/analytics/useScreenView";
import { isSessionExpiredError } from "@/src/auth/auth-session";
import {
  buildTaskNotificationBody,
  getTaskDetailEntries,
} from "@/src/notifications/taskNotificationUtils";
import { getEmployeeTaskById, type EmployeeTask } from "@/src/services/taskService";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="border-b border-primary/10 py-2.5">
      <Text className="font-sans text-sm text-neutral-soft dark:text-neutral-soft-dark">{label}</Text>
      <Text className="mt-1 font-sans text-sm font-bold text-neutral-dark dark:text-[#F6EDE8]">
        {value}
      </Text>
    </View>
  );
}

export default function TaskDetailsScreen() {
  useScreenView("task_details");
  const router = useRouter();
  const colorScheme = useColorScheme();
  const params = useLocalSearchParams<{ taskId?: string }>();
  const [task, setTask] = useState<EmployeeTask | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTask = useCallback(async () => {
    if (!params.taskId) {
      setError("Missing task id.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextTask = await getEmployeeTaskById(params.taskId, false);
      if (!nextTask) {
        setError("Task not found.");
        return;
      }

      setTask(nextTask);
    } catch (nextError) {
      if (isSessionExpiredError(nextError)) return;
      setError(nextError instanceof Error ? nextError.message : "Failed to load task.");
    } finally {
      setIsLoading(false);
    }
  }, [params.taskId]);

  useFocusEffect(
    useCallback(() => {
      loadTask();
    }, [loadTask]),
  );

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
            Task
          </Text>
        </View>

        {isLoading ? (
          <View className="px-4 pt-10 items-center">
            <ActivityIndicator color="#ff5d38" />
          </View>
        ) : error ? (
          <View className="mx-4 mt-6 rounded-2xl border border-red-500/25 bg-red-500/10 p-4">
            <Text className="font-sans text-sm text-red-700 dark:text-red-300">{error}</Text>
            <Pressable onPress={loadTask} className="mt-3 self-start rounded-xl bg-red-600 px-4 py-2">
              <Text className="font-sans text-xs font-bold uppercase tracking-wide text-white">
                Retry
              </Text>
            </Pressable>
          </View>
        ) : task ? (
          <>
            <View className="mx-4 mt-4 rounded-3xl border border-primary/10 bg-white p-5 dark:bg-surface-dark">
              <Text className="font-sans text-xs font-bold uppercase tracking-widest text-primary/70">
                Summary
              </Text>
              <Text className="mt-3 font-sans text-lg font-bold text-neutral-dark dark:text-[#F6EDE8]">
                {task.name || `Task #${task.id}`}
              </Text>
              <Text className="mt-2 font-sans text-sm text-neutral-soft dark:text-neutral-soft-dark">
                {buildTaskNotificationBody(task)}
              </Text>
            </View>

            <View className="mx-4 mt-4 rounded-3xl border border-primary/10 bg-white p-5 dark:bg-surface-dark">
              <Text className="font-sans text-xs font-bold uppercase tracking-widest text-primary/70">
                Details
              </Text>
              <View className="mt-3">
                {getTaskDetailEntries(task).map((entry) => (
                  <FieldRow key={`${entry.label}-${entry.value}`} label={entry.label} value={entry.value} />
                ))}
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
