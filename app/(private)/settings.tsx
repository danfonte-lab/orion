import { useColorScheme, useThemePreference } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import { useScreenView } from "@/src/analytics/useScreenView";
import { deleteAllItemAsync, getUseBiometrics } from "@/src/auth/auth-storage";
import { useAuth } from "@/src/auth/AuthContext";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsScreen() {
  useScreenView("settings");
  const { isBiometricAvailable, enableBiometrics, logout } = useAuth() as any;
  const colorScheme = useColorScheme();
  const { preference, setPreference } = useThemePreference();
  const [value, setValue] = useState<boolean>(!!isBiometricAvailable);
  const [saving, setSaving] = useState(false);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const primaryColor = Colors[colorScheme ?? "light"].tint;
  const themeOptions = [
    { key: "system", label: "System" },
    { key: "light", label: "Light" },
    { key: "dark", label: "Dark" },
  ] as const;

  useEffect(() => {
    let mounted = true;
    getUseBiometrics().then((v) => {
      if (mounted) setValue(!!v);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const toggle = async (next: boolean) => {
    setSaving(true);

    try {
      await enableBiometrics?.(next);
      setValue(next);
      Alert.alert("Settings", `Biometrics ${next ? "enabled" : "disabled"}`);
    } catch {
      Alert.alert("Error", "Failed to update biometrics setting.");
    } finally {
      setSaving(false);
    }
  };

  const router = useRouter();

  const handleThemePreferenceChange = async (
    nextPreference: (typeof themeOptions)[number]["key"],
  ) => {
    if (nextPreference === preference) return;

    setIsSavingTheme(true);

    try {
      await setPreference(nextPreference);
    } catch {
      Alert.alert("Error", "Failed to update theme preference.");
    } finally {
      setIsSavingTheme(false);
    }
  };

  const clearAllData = async () => {
    Alert.alert(
      "Clear all data",
      "This will remove all stored user data and tokens. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAllItemAsync();
              await logout?.();
              router.replace("/(public)/onboarding");
            } catch {
              Alert.alert("Error", "Failed to clear stored data.");
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView
      edges={["top"]}
      className="flex-1 bg-background-light dark:bg-background-dark px-4 pt-2"
    >
      <View className="flex-row items-center">
        <Pressable onPress={() => router.back()} className="mr-3 p-1">
          <MaterialIcons
            name="arrow-back"
            size={26}
            color={colorScheme === "dark" ? "#F6EDE8" : "#181210"}
          />
        </Pressable>
        <Text className="font-serif text-4xl text-neutral-dark dark:text-[#F6EDE8]">
          Settings
        </Text>
      </View>

      <View className="mt-6 rounded-2xl border border-primary/10 bg-white dark:bg-surface-dark p-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="font-sans text-base font-bold text-neutral-dark dark:text-[#F6EDE8]">
              Use biometrics
            </Text>
            <Text className="mt-1 font-sans text-sm text-neutral-soft dark:text-neutral-soft-dark">
              Use face/fingerprint to sign in.
            </Text>
          </View>
          <Switch
            value={!!value}
            onValueChange={toggle}
            disabled={saving}
            trackColor={{ false: "#8d665e", true: primaryColor }}
          />
        </View>
      </View>

      <View className="mt-5 rounded-2xl border border-primary/10 bg-white dark:bg-surface-dark p-4">
        <Text className="font-sans text-base font-bold text-neutral-dark dark:text-[#F6EDE8]">
          Appearance
        </Text>
        <Text className="mt-1 font-sans text-sm text-neutral-soft dark:text-neutral-soft-dark">
          Choose how the app theme should be displayed.
        </Text>

        <View className="mt-3 flex-row rounded-xl border border-primary/15 p-1">
          {themeOptions.map((option) => {
            const isSelected = preference === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => handleThemePreferenceChange(option.key)}
                disabled={isSavingTheme}
                className={`flex-1 rounded-lg px-2 py-2 ${
                  isSelected ? "bg-primary" : "bg-transparent"
                } ${isSavingTheme ? "opacity-70" : ""}`}
              >
                <Text
                  className={`text-center font-sans text-sm font-bold ${
                    isSelected
                      ? "text-white"
                      : "text-neutral-dark dark:text-[#F6EDE8]"
                  }`}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="mt-5 rounded-2xl border border-red-200 bg-white dark:bg-surface-dark p-4">
        <Text className="font-sans text-sm text-neutral-soft dark:text-neutral-soft-dark">
          This deletes persisted auth state and local profile data.
        </Text>
        <Text
          className="mt-3 font-sans text-base font-bold text-red-600"
          onPress={clearAllData}
          accessibilityRole="button"
        >
          Clear all stored data
        </Text>
      </View>
    </SafeAreaView>
  );
}
