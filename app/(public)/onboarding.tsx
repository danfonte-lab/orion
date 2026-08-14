import { useRouter, type Href } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Animated, Image, Text, View } from "react-native";

import { PrimaryButton } from "@/components/ui/primary-button";
import { useScreenView } from "@/src/analytics/useScreenView";
import { useAuth } from "@/src/auth/AuthContext";

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeOnboarding } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useScreenView("onboarding");

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 900,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <View className="flex-1">
      <Image
        source={require("../../assets/images/background.jpg")}
        resizeMode="cover"
        className="absolute inset-0 h-full w-full"
      />

      <View className="flex-1 px-5 pb-12 pt-10">
        <Animated.View
          style={{ opacity: fadeAnim }}
          className="items-center pt-12"
        >
          <Image
            source={require("../../assets/images/Orion_White.png")}
            resizeMode="contain"
            className="h-[52px] w-[160px]"
          />
          <View className="mt-3">
            <Image
              source={require("../../assets/images/Powered_White.png")}
              resizeMode="contain"
              className="h-[38px] w-[116px]"
            />
          </View>
        </Animated.View>

        <View className="mt-8">
          <Animated.Text
            style={{ opacity: fadeAnim }}
            className="mt-6 font-serif text-4xl leading-tight text-white"
          >
            People-first HR experience in one place.
          </Animated.Text>
          <Text className="mt-4 font-sans text-base text-white/85">
            Manage schedule, payslips, and updates with a cleaner workflow.
          </Text>
        </View>

        <View className="flex-1 justify-end">
          <Animated.View style={{ opacity: fadeAnim }} className="pb-2">
            <PrimaryButton
              title="Get Started"
              onPress={async () => {
                await completeOnboarding();
                router.replace("/(public)/login" as Href);
              }}
            />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}
