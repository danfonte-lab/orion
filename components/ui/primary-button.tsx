import React from "react";
import { Pressable, PressableProps, Text, View } from "react-native";

interface PrimaryButtonProps extends PressableProps {
  title: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
  textClassName?: string;
}

export function PrimaryButton({
  title,
  disabled,
  className,
  textClassName,
  icon,
  ...props
}: PrimaryButtonProps) {
  return (
    <Pressable
      className={`rounded-2xl px-5 py-3.5 items-center justify-center flex-row border border-primary/20 ${
        disabled
          ? "bg-primary/40"
          : "bg-primary active:bg-primary/90"
      } ${className ?? ""}`}
      disabled={disabled}
      {...props}
    >
      {icon ? <View className="mr-2">{icon}</View> : null}
      <Text
        className={`font-sans text-base font-bold text-white ${textClassName ?? ""}`}
      >
        {title}
      </Text>
    </Pressable>
  );
}
