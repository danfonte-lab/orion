import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { TaskNotificationsProvider } from "@/src/notifications/TaskNotificationsContext";

export default function PrivateLayout() {
  // Private routes are protected by AuthGate.
  return (
    <SafeAreaProvider>
      <TaskNotificationsProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </TaskNotificationsProvider>
    </SafeAreaProvider>
  );
}
