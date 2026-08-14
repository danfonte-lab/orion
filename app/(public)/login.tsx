import { Link, useRouter, type Href } from "expo-router";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

import { CustomTextInput } from "@/components/ui/custom-text-input";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { PrimaryButton } from "@/components/ui/primary-button";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAnalytics } from "@/src/analytics/AnalyticsProvider";
import { useScreenView } from "@/src/analytics/useScreenView";
import {
  clearSessionNotice,
  getSessionNotice,
  getStoredTokens,
  getStoredUser,
  hasBiometricsPreference,
} from "@/src/auth/auth-storage";
import { useAuth } from "@/src/auth/AuthContext";
import { captureException } from "@/src/monitoring/sentry";
import * as Sentry from "@sentry/react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { useEffect, useState } from "react";
import appJson from "../../app.json";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[A-Za-z0-9._-]{3,64}$/;
const MIN_PASSWORD_LENGTH = 6;
const DUMMY_USERNAME = "paulo.guimalan";
const DUMMY_PASSWORD = "YsVtGwmF42(T^@L";
const SHOW_LOGIN_ERROR_DETAILS = true;
const SHOW_TEST_CREDENTIALS = false;

type FieldErrors = {
  username: string | null;
  password: string | null;
};

const EMPTY_FIELD_ERRORS: FieldErrors = {
  username: null,
  password: null,
};

function validateCredentials(username: string, password: string): FieldErrors {
  const trimmedUsername = username.trim();
  const errors: FieldErrors = { ...EMPTY_FIELD_ERRORS };

  if (!trimmedUsername) {
    errors.username = "This field is required.";
  }

  if (!password.trim()) {
    errors.password = "This field is required.";
  }

  if (!errors.username) {
    const usernameIsValid = trimmedUsername.includes("@")
      ? EMAIL_REGEX.test(trimmedUsername)
      : USERNAME_REGEX.test(trimmedUsername);
    if (!usernameIsValid) {
      errors.username = "Invalid Username Format.";
    }
  }

  if (!errors.password && password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  return errors;
}

export default function LoginScreen() {
  const { capture, identify } = useAnalytics();
  useScreenView("login");

  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const {
    login,
    isLoading,
    isBiometricAvailable,
    resumeWithTokens,
    enableBiometrics,
  } = useAuth() as any;

  const auth = {
    isBiometricAvailable,
    resumeWithTokens,
    enableBiometrics,
  } as any;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(EMPTY_FIELD_ERRORS);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadSessionNotice = async () => {
      const storedNotice = await getSessionNotice();
      if (!mounted || !storedNotice) return;

      setSessionNotice(storedNotice);
      await clearSessionNotice();

      setTimeout(() => {
        if (mounted) {
          setSessionNotice(null);
        }
      }, 4000);
    };

    loadSessionNotice().catch((e) => {
      captureException(e, {
        scope: "login_screen",
        action: "load_session_notice",
      });
    });

    return () => {
      mounted = false;
    };
  }, []);

  const handleForgotPasswordPress = () => {
    Alert.alert(
      "Password reset",
      "Please log a ticket via the Service Portal to request a password reset. If you’re unable to access the portal, contact your manager for assistance.",
    );
  };

  const handlePopulateDummyCredentials = () => {
    setEmail(DUMMY_USERNAME);
    setPassword(DUMMY_PASSWORD);
    setError(null);
    setErrorDetails(null);
    setShowErrorDetails(false);
    setFieldErrors(EMPTY_FIELD_ERRORS);
  };

  const identifyAuthenticatedUser = async () => {
    const authenticatedUser = await getStoredUser();
    if (!authenticatedUser) return;

    const userId =
      authenticatedUser.employee_id ||
      authenticatedUser.id ||
      authenticatedUser.username;
    if (!userId) return;

    identify(userId, {
      email: authenticatedUser.email,
    });
  };

  const manualSignIn = async () => {
    setError(null);
    setErrorDetails(null);
    setShowErrorDetails(false);
    const username = email.trim();
    const validationErrors = validateCredentials(username, password);
    setFieldErrors(validationErrors);
    if (validationErrors.username || validationErrors.password) {
      return;
    }

    try {
      const ok = await login(username, password);
      if (!ok) {
        capture("login_failed", {
          method: "manual",
          reason: "authentication_failed",
        });
        setError("Invalid username or password");
        return;
      }

      capture("login_success", {
        method: "manual",
      });
      await identifyAuthenticatedUser();
    } catch (e) {
      captureException(e, {
        scope: "login_screen",
        action: "manual_sign_in",
      });
      const message =
        e instanceof Error ? e.message : "Invalid username or password";
      setError(message || "Invalid username or password");
      const details =
        typeof (e as { details?: unknown })?.details === "string"
          ? (e as { details: string }).details
          : null;
      setErrorDetails(details);
      if (details) {
        console.error("[login] auth error details:", details);
      }
      return;
    }

    try {
      const prefExists = await hasBiometricsPreference();
      if (prefExists) {
        router.replace("/(private)/(tabs)/newsFeed");
        return;
      }

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const supported =
        await LocalAuthentication.supportedAuthenticationTypesAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled && supported.length > 0) {
        Alert.alert(
          "Use biometrics",
          "Would you like to enable biometrics for faster sign-in?",
          [
            {
              text: "No",
              style: "cancel",
              onPress: async () => {
                try {
                  await enableBiometrics?.(false);
                } finally {
                  router.replace("/(private)/(tabs)/newsFeed");
                }
              },
            },
            {
              text: "Yes",
              onPress: async () => {
                try {
                  await enableBiometrics?.(true);
                } finally {
                  router.replace("/(private)/(tabs)/newsFeed");
                }
              },
            },
          ],
        );
      }
    } catch (err) {
      captureException(err, {
        scope: "login_screen",
        action: "post_login_biometric_prompt",
      });
      router.replace("/(private)/(tabs)/newsFeed");
    }
  };

  const biometricSignIn = async () => {
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: "Sign in",
      });

      if (!res.success) {
        capture("login_failed", {
          method: "biometric",
          reason: "authentication_failed",
        });

        setError("Biometric authentication failed.");
        return;
      }

      console.debug(
        "biometric: before resume - storedTokens=",
        await getStoredTokens(),
      );
      console.debug(
        "biometric: before resume - storedUser=",
        await getStoredUser(),
      );

      const ok = await auth.resumeWithTokens?.();
      console.debug("biometric: resumeWithTokens returned", ok);
      console.debug(
        "biometric: after resume - storedTokens=",
        await getStoredTokens(),
      );
      console.debug(
        "biometric: after resume - storedUser=",
        await getStoredUser(),
      );

      if (!ok) {
        setError(
          "We couldn't resume your session. Please sign in with your username and password.",
        );
        return;
      }

      capture("login_success", {
        method: "biometric",
      });
      await identifyAuthenticatedUser();

      router.replace("/(private)/(tabs)/newsFeed" as Href);
    } catch (error) {
      captureException(error, {
        scope: "login_screen",
        action: "biometric_sign_in",
      });
      setError("Biometric sign-in failed.");
    }
  };

  const sendSentryTestMessage = () => {
    Sentry.captureMessage("Sentry test message from Expo SDK 54");
    Alert.alert("Sentry", "Test message sent.");
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background-light dark:bg-background-dark"
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <View className="flex-1 items-center justify-center px-5">
        <View className="w-full max-w-md rounded-3xl border border-primary/10 bg-white dark:bg-surface-dark p-6">
          <View className="items-center">
            <Image
              source={
                isDark
                  ? require("../../assets/images/logo-dark.png")
                  : require("../../assets/images/logo-light.png")
              }
              className="h-10 w-44"
              resizeMode="contain"
              accessibilityLabel="Ubiquity logo"
            />
          </View>
          <Text className="mt-2 text-center font-sans text-base text-neutral-soft dark:text-neutral-soft-dark">
            
          </Text>

          {sessionNotice ? (
            <View className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <Text className="font-sans text-sm text-amber-900">{sessionNotice}</Text>
            </View>
          ) : null}

          <View className="mt-7 relative">
            <CustomTextInput
              placeholder="Username"
              autoCapitalize="none"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setFieldErrors((prev) => ({ ...prev, username: null }));
              }}
              className="pl-11"
            />
            <View className="absolute left-4 top-3">
              <IconSymbol name="person" size={21} color="#8d665e" />
            </View>
          </View>
          {fieldErrors.username ? (
            <Text className="mt-1 font-sans text-xs text-red-600">{fieldErrors.username}</Text>
          ) : null}

          <View className="mt-4 relative">
            <CustomTextInput
              placeholder="Password"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setFieldErrors((prev) => ({ ...prev, password: null }));
              }}
              contextMenuHidden
              selectTextOnFocus={false}
              className="pl-11 pr-11"
            />
            <View className="absolute left-4 top-3">
              <IconSymbol name="lock" size={21} color="#8d665e" />
            </View>
            <Pressable
              className="absolute right-4 top-3"
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={8}
            >
              <IconSymbol
                name={showPassword ? "eye.slash" : "eye"}
                size={21}
                color="#8d665e"
              />
            </Pressable>
          </View>
          {fieldErrors.password ? (
            <Text className="mt-1 font-sans text-xs text-red-600">{fieldErrors.password}</Text>
          ) : null}

          <View className="mt-3 items-end">
            <Pressable onPress={handleForgotPasswordPress}>
              <Text className="font-sans text-sm font-bold text-primary">
                Forgot password?
              </Text>
            </Pressable>
          </View>

          {error ? (
            <View className="mt-4">
              <Text className="font-sans text-red-600">{error}</Text>
              {SHOW_LOGIN_ERROR_DETAILS && errorDetails ? (
                <>
                  <Pressable
                    onPress={() => setShowErrorDetails((prev) => !prev)}
                    hitSlop={8}
                  >
                    <Text className="mt-1 font-sans text-xs text-primary underline">
                      {showErrorDetails ? "Hide details" : "View details"}
                    </Text>
                  </Pressable>
                  {showErrorDetails ? (
                    <Text className="mt-1 font-sans text-xs text-neutral-soft dark:text-neutral-soft-dark">
                      {errorDetails}
                    </Text>
                  ) : null}
                </>
              ) : null}
            </View>
          ) : null}

          <View className="mt-6">
            <PrimaryButton
              title={isLoading ? "Signing in..." : "Sign in"}
              disabled={isLoading}
              onPress={manualSignIn}
            />
          </View>

          {auth.isBiometricAvailable ? (
            <View className="mt-4">
              <PrimaryButton
                title="Sign in with biometrics"
                icon={<IconSymbol name="touchid" size={20} color="#ffffff" />}
                onPress={biometricSignIn}
                className="bg-neutral-dark border-neutral-dark"
              />
            </View>
          ) : null}

          {SHOW_TEST_CREDENTIALS ? (
            <Pressable onPress={handlePopulateDummyCredentials} hitSlop={8}>
              <Text className="mt-6 text-center font-sans text-xs text-neutral-soft dark:text-neutral-soft-dark underline">
                Test credentials: {DUMMY_USERNAME} / {DUMMY_PASSWORD}
              </Text>
            </Pressable>
          ) : null}

           {/*<View className="mt-4">
            <PrimaryButton
              title="Send Sentry test message"
              onPress={sendSentryTestMessage}
              className="bg-neutral-dark border-neutral-dark"
            />
          </View> */}

          <View className="mt-4">
            <Link href="/(public)/onboarding" asChild>
              <Text className="text-center font-sans text-sm font-bold text-primary underline">
                Go to Onboarding
              </Text>
            </Link>

            <Text className="mt-3 text-center font-sans text-sm text-neutral-soft dark:text-neutral-soft-dark">
              {`${process.env.EXPO_PUBLIC_ENV} - v${appJson.expo?.version ?? ""}`}
            </Text>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
