import { Redirect, type Href } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";

import { useAuth } from "@/src/auth/AuthContext";

export default function Index() {
  //useScreenView("index");
  const { user, isLoading, hasSeenOnboarding } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark px-6">
        <ActivityIndicator color="#ff5d38" />
        <Text className="mt-3 font-sans text-neutral-soft dark:text-neutral-soft-dark">Loading...</Text>
      </View>
    );
  }

  if (!hasSeenOnboarding) {
    return <Redirect href={"/(public)/onboarding" as Href} />;
  }

  if (!user) {
    return <Redirect href={"/(public)/login" as Href} />;
  }

  return <Redirect href={"/(private)/(tabs)/newsFeed" as Href} />;
}
