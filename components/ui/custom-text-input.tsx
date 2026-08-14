import React from "react";
import { TextInput, TextInputProps } from "react-native";

interface CustomTextInputProps extends TextInputProps {
  className?: string;
}

export function CustomTextInput({
  className,
  placeholderTextColor,
  ...props
}: CustomTextInputProps) {
  return (
    <TextInput
      className={`rounded-2xl border border-primary/15 bg-white dark:bg-surface-dark px-4 py-3.5 font-sans text-neutral-dark dark:text-[#F6EDE8] ${className ?? ""}`}
      placeholderTextColor={placeholderTextColor ?? "#8d665e"}
      {...props}
    />
  );
}
