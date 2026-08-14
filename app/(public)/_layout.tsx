import { Stack } from "expo-router";

export default function PublicLayout() {
  // Public routes are still protected by AuthGate (e.g., redirect to private if already logged in)
  return <Stack screenOptions={{ headerShown: false }} />;
}
