import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";
import { useColorScheme as useNativewindColorScheme } from "nativewind";

import { getThemePreference, setThemePreference } from "@/src/auth/auth-storage";

const AppColorSchemeContext = createContext(null);

export function AppColorSchemeProvider({ children }) {
  const systemColorScheme = useSystemColorScheme();
  const { setColorScheme: setNativewindColorScheme } = useNativewindColorScheme();
  const [preference, setPreferenceState] = useState("system");
  const [lastSystemScheme, setLastSystemScheme] = useState(
    systemColorScheme === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    let mounted = true;

    getThemePreference().then((storedPreference) => {
      if (!mounted) return;
      setPreferenceState(storedPreference);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (systemColorScheme === "dark" || systemColorScheme === "light") {
      setLastSystemScheme(systemColorScheme);
    }
  }, [systemColorScheme]);

  const setPreference = async (next) => {
    await setThemePreference(next);
    setPreferenceState(next);
  };

  const resolvedSystemScheme =
    systemColorScheme === "dark" || systemColorScheme === "light"
      ? systemColorScheme
      : lastSystemScheme;

  const colorScheme = preference === "system" ? resolvedSystemScheme : preference;

  useEffect(() => {
    setNativewindColorScheme(colorScheme);
  }, [colorScheme, setNativewindColorScheme]);

  const value = useMemo(
    () => ({ colorScheme, preference, setPreference }),
    [colorScheme, preference],
  );

  return React.createElement(AppColorSchemeContext.Provider, { value }, children);
}

export function useThemePreference() {
  const context = useContext(AppColorSchemeContext);
  if (!context) {
    throw new Error("useThemePreference must be used within AppColorSchemeProvider");
  }

  return {
    preference: context.preference,
    setPreference: context.setPreference,
  };
}

export function useColorScheme() {
  const context = useContext(AppColorSchemeContext);
  if (!context) {
    const systemColorScheme = useSystemColorScheme();
    return systemColorScheme === "dark" ? "dark" : "light";
  }

  return context.colorScheme;
}
