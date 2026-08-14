import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Action = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "destructive";
};

export default function SheetModal({
  visible,
  onClose,
  title,
  children,
  actions,
  presentation = "auto",
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  actions?: Action[];
  presentation?: "formSheet" | "modal" | "auto";
}) {
  const screen = Dimensions.get("window");
  const resolvedPresentation = presentation === "auto" ? "modal" : presentation;

  const anim = useRef(new Animated.Value(0)).current;
  const [render, setRender] = useState(visible);

  useEffect(() => {
    if (visible) setRender(true);
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 240,
      useNativeDriver: true,
    }).start(() => {
      if (!visible) setRender(false);
    });
  }, [visible, anim]);

  if (!render) return null;

  const overlayOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.45],
  });

  const contentStyle =
    resolvedPresentation === "modal"
      ? {
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [screen.height, 0],
              }),
            },
          ],
        }
      : {
          transform: [
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.98, 1],
              }),
            },
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        };

  const containerClass =
    resolvedPresentation === "modal"
      ? "flex-1 justify-end"
      : "items-center justify-center px-6 py-8";

  return (
    <View className="absolute inset-0 z-50" pointerEvents={visible ? "auto" : "none"}>
      <Animated.View
        style={[
          { backgroundColor: "#000", position: "absolute", inset: 0 },
          { opacity: overlayOpacity },
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <SafeAreaView className={containerClass} pointerEvents="box-none">
        <Animated.View style={contentStyle}>
          <View
            className={
              resolvedPresentation === "modal"
                ? "absolute left-0 right-0 bottom-0 rounded-t-3xl bg-white dark:bg-surface-dark px-4 border border-primary/10"
                : "w-full max-w-lg rounded-3xl bg-white dark:bg-surface-dark border border-primary/10"
            }
            style={{ overflow: "hidden" }}
          >
            <View className="p-4">
              {title ? (
                <Text className="mb-2 font-serif text-3xl text-neutral-dark dark:text-[#F6EDE8]">
                  {title}
                </Text>
              ) : null}

              <View>{children}</View>

              {actions && actions.length > 0 ? (
                <View className="mt-4 flex-row justify-end">
                  {actions.map((a, idx) => {
                    const bgClass =
                      a.variant === "primary"
                        ? "bg-primary border-primary"
                        : a.variant === "destructive"
                          ? "bg-red-600 border-red-700"
                          : "bg-white dark:bg-surface-dark border-primary/20";

                    const textClass =
                      a.variant === "primary" || a.variant === "destructive"
                        ? "text-white"
                        : "text-neutral-dark dark:text-[#F6EDE8]";

                    return (
                      <Pressable
                        key={idx}
                        onPress={() => {
                          a.onPress?.();
                          onClose();
                        }}
                        className={`ml-2 rounded-xl border px-4 py-2.5 ${bgClass}`}
                      >
                        <Text className={`font-sans text-sm font-bold ${textClass}`}>
                          {a.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}
