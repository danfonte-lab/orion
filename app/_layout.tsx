import {
  AppColorSchemeProvider,
  useColorScheme,
} from "@/hooks/use-color-scheme";
import { AnalyticsProvider } from "@/src/analytics/AnalyticsProvider";
import { AuthProvider } from "@/src/auth/AuthContext";
import { AuthGate } from "@/src/auth/AuthGate";
import { captureException } from "@/src/monitoring/sentry";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from "@expo-google-fonts/instrument-serif";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import * as Sentry from "@sentry/react-native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import "../global.css";

SplashScreen.preventAutoHideAsync().catch((error) => {
  captureException(error, {
    scope: "app",
    action: "splash_prevent_auto_hide",
  });
});

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: true,
  debug: false,
});

function RootLayoutContent() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    "DM Sans": DMSans_400Regular,
    "DM Sans Medium": DMSans_500Medium,
    "DM Sans Bold": DMSans_700Bold,
    Inter: Inter_400Regular,
    "Inter Medium": Inter_500Medium,
    "Inter Bold": Inter_700Bold,
    "Instrument Serif": InstrumentSerif_400Regular,
    "Instrument Serif Italic": InstrumentSerif_400Regular_Italic,
  });

  // Keep splash visible until fonts are ready; AuthProvider will hide it after bootstrap.
  if (!fontsLoaded) {
    return null;
  }

  return (
    <AnalyticsProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <AuthGate />

          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(public)" />
            <Stack.Screen name="(private)" />
          </Stack>
        </AuthProvider>

        <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      </ThemeProvider>
    </AnalyticsProvider>
  );
}

export default function RootLayout() {
  return (
    <AppColorSchemeProvider>
      <RootLayoutContent />
    </AppColorSchemeProvider>
  );
}
