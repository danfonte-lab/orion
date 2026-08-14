import * as LocalAuthentication from "expo-local-authentication";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useScreenView } from "@/src/analytics/useScreenView";
import { isSessionExpiredError } from "@/src/auth/auth-session";
import { captureException } from "@/src/monitoring/sentry";
import payslipService, { type Payslip } from "@/src/services/payslipService";

function formatAmountParts(value?: string | null, currency?: string | null) {
  if (!value) return { currencyPrefix: "", amount: "—" };
  const num = Number(value);
  if (Number.isNaN(num)) return { currencyPrefix: "", amount: value };
  const currencyCode = currency?.trim().toUpperCase();
  const symbol = currencyCode === "PHP" ? "₱" : "$";
  const amount = `${symbol}${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  return {
    currencyPrefix: "", //currencyCode ? `${currencyCode} ` : "",
    amount,
  };
}

const MASKED_AMOUNT = "*****.**";

type SecureAmountProps = {
  value?: string | null;
  amountClassName: string;
  isVisible: boolean;
  currency?: string | null;
  currencyPrefixFontSize?: number;
};

function SecureAmount({
  value,
  amountClassName,
  isVisible,
  currency,
  currencyPrefixFontSize = 10,
}: SecureAmountProps) {
  if (!isVisible) return <Text className={amountClassName}>{MASKED_AMOUNT}</Text>;

  const { currencyPrefix, amount } = formatAmountParts(value, currency);
  return (
    <Text className={amountClassName}>
      {currencyPrefix ? <Text style={{ fontSize: currencyPrefixFontSize }}>{currencyPrefix}</Text> : null}
      {amount}
    </Text>
  );
}

type HistoryCardProps = {
  item: Payslip;
  isAmountsVisible: boolean;
};

function HistoryCard({ item, isAmountsVisible }: HistoryCardProps) {
  const period =
    item.period_start_date && item.period_end_date
      ? `${item.period_start_date} - ${item.period_end_date}`
      : "Period not available";

  return (
    <View className="rounded-2xl border border-primary/10 bg-white dark:bg-surface-dark p-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="font-sans text-sm font-bold text-neutral-dark dark:text-[#F6EDE8]">
            {item.company || "Payslip"}
          </Text>
          <Text className="mt-1 font-sans text-xs text-neutral-soft dark:text-neutral-soft-dark">{period}</Text>
        </View>
        <View className="items-end">
          <SecureAmount
            value={item.net_amount}
            currency={item.net_amount_currency}
            amountClassName="font-sans text-sm font-bold text-neutral-dark dark:text-[#F6EDE8]"
            isVisible={isAmountsVisible}
            currencyPrefixFontSize={10}
          />
          <View className="mt-1 flex-row items-center">
            <Text className="font-sans text-xs font-medium text-[#C0A97E]">Gross:</Text>
            <SecureAmount
              value={item.gross_amount}
              currency={item.gross_amount_currency}
              amountClassName="font-sans text-xs font-medium text-[#C0A97E] ml-1"
              isVisible={isAmountsVisible}
              currencyPrefixFontSize={10}
            />
          </View>
        </View>
      </View>

      <View className="mt-3 flex-row items-center justify-between">
        <Text className="font-sans text-xs text-neutral-soft dark:text-neutral-soft-dark">
          Paid: {item.payment_date ?? "N/A"}
        </Text>
        {item.payslip_file_url ? (
          <Pressable
            onPress={() =>
              Linking.openURL(item.payslip_file_url as string).catch((error) => {
                captureException(error, {
                  scope: "payslip_screen",
                  action: "open_history_payslip_url",
                });
              })
            }
          >
            <Text className="font-sans text-xs font-bold text-primary">Download</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function PayslipScreen() {
  useScreenView("payslip");
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAmountsVisible, setIsAmountsVisible] = useState(false);

  const authenticateUser = async () => {
    setIsAuthenticating(true);
    setAuthError(null);

    if (Platform.OS === "web") {
      setIsUnlocked(true);
      setIsAuthenticating(false);
      return;
    }

    try {
      const enrolledLevel = await LocalAuthentication.getEnrolledLevelAsync();

      // Allow direct access only when there is no enrolled local auth at all.
      // On Android, PIN/passcode may exist even without biometric hardware.
      if (enrolledLevel === LocalAuthentication.SecurityLevel.NONE) {
        setIsUnlocked(true);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Authenticate to view payslips",
        disableDeviceFallback: false,
        fallbackLabel: "Use passcode",
        cancelLabel: "Cancel",
      });

      if (!result.success) {
        setIsUnlocked(false);
        setAuthError("Authentication is required to view payslips.");
        return;
      }

      setIsUnlocked(true);
    } catch (error) {
      captureException(error, {
        scope: "payslip_screen",
        action: "authenticate_user",
      });
      setIsUnlocked(false);
      setAuthError("Unable to verify your identity. Please try again.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  useEffect(() => {
    authenticateUser();
  }, []);

  useEffect(() => {
    if (!isUnlocked) return;

    let mounted = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await payslipService.getPayslips(1, 10);
        if (!mounted) return;
        setPayslips(res.results ?? []);
        setHasNext(Boolean(res.next));
        setPage(1);
      } catch (e) {
        captureException(e, {
          scope: "payslip_screen",
          action: "initial_load",
        });
        if (!mounted) return;
        if (isSessionExpiredError(e)) return;
        setError(e instanceof Error ? e.message : "Failed to load payslips.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    load();

    return () => {
      mounted = false;
    };
  }, [isUnlocked]);

  const refresh = async () => {
    if (isRefreshing || !isUnlocked) return;
    setIsRefreshing(true);
    setError(null);

    try {
      const res = await payslipService.getPayslips(1, 10);
      setPayslips(res.results ?? []);
      setHasNext(Boolean(res.next));
      setPage(1);
    } catch (e) {
      captureException(e, {
        scope: "payslip_screen",
        action: "refresh",
      });
      if (isSessionExpiredError(e)) return;
      setError(e instanceof Error ? e.message : "Failed to refresh payslips.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const loadMore = async () => {
    if (isLoadingMore || isLoading || !hasNext || !isUnlocked) return;

    const nextPage = page + 1;
    setIsLoadingMore(true);

    try {
      const res = await payslipService.getPayslips(nextPage, 10);
      setPayslips((prev) => [...prev, ...(res.results ?? [])]);
      setHasNext(Boolean(res.next));
      setPage(nextPage);
    } catch (e) {
      captureException(e, {
        scope: "payslip_screen",
        action: "load_more",
        extras: { nextPage },
      });
      if (isSessionExpiredError(e)) return;
      setError(e instanceof Error ? e.message : "Failed to load more payslips.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const latest = payslips[0];
  const history = useMemo(() => payslips.slice(1), [payslips]);

  const header = (
    <View className="px-4 pt-6">
      <View className="flex-row items-center">
        <Text className="font-serif text-4xl text-neutral-dark dark:text-[#F6EDE8]">
          Latest Payslip
        </Text>
      </View>

      {latest ? (
        <View className="mt-4 overflow-hidden rounded-2xl border border-[#3A342F] bg-[#1F1B17] p-6">
          <View>
            <View className="mb-6 flex-row items-start justify-between">
              <View className="rounded-full border border-[#5A524A] bg-[#2A2520] px-3 py-1.5">
                <Text className="font-sans text-xs font-medium tracking-wide text-[#F6EDE8]">
                  {latest.period_start_date && latest.period_end_date
                    ? `${latest.period_start_date} - ${latest.period_end_date}`
                    : "Period not available"}
                </Text>
              </View>
            </View>

            <View className="mb-8">
              <Text className="mb-2 font-sans text-xs font-medium uppercase tracking-widest text-[#CFC3B8]">
                Total Net Pay
              </Text>
              <View className="flex-row items-center">
                <SecureAmount
                  value={latest.net_amount}
                  currency={latest.net_amount_currency}
                  amountClassName="font-serif text-5xl tracking-tight text-white pt-2"
                  isVisible={isAmountsVisible}
                  currencyPrefixFontSize={14}
                />
                <Pressable
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={isAmountsVisible ? "Hide all amounts" : "Show all amounts"}
                  onPress={() => setIsAmountsVisible((prev) => !prev)}
                  className="ml-3 mt-2"
                >
                  <IconSymbol
                    name={isAmountsVisible ? "eye.slash" : "eye"}
                    size={22}
                    color="#F6EDE8"
                  />
                </Pressable>
              </View>
            </View>

            <View className="flex-row border-t border-[#5A524A] pt-6">
              <View className="flex-1 pr-2">
                <Text className="mb-1 font-sans text-[10px] font-bold uppercase tracking-wider text-[#CFC3B8]">
                  Gross
                </Text>
                <SecureAmount
                  value={latest.gross_amount}
                  currency={latest.gross_amount_currency}
                  amountClassName="font-sans text-sm font-bold text-white"
                  isVisible={isAmountsVisible}
                  currencyPrefixFontSize={14}
                />
              </View>
              <View className="flex-1 pl-2">
                <Text className="mb-1 font-sans text-[10px] font-bold uppercase tracking-wider text-[#CFC3B8]">
                  Pay Date
                </Text>
                <Text className="font-sans text-sm font-bold text-[#FEB09D]">
                  {latest.payment_date ?? "—"}
                </Text>
              </View>
            </View>

            <Pressable
              className="mt-6 rounded-xl bg-[#FF5C39] py-3.5"
              onPress={() => {
                if (latest.payslip_file_url) {
                  Linking.openURL(latest.payslip_file_url).catch((error) => {
                    captureException(error, {
                      scope: "payslip_screen",
                      action: "open_latest_payslip_url",
                    });
                  });
                }
              }}
            >
              <Text className="text-center font-sans text-sm font-bold text-[#171512]">
                Detailed Breakdown
              </Text>
            </Pressable>
          </View>
        </View>
      ) : isLoading ? (
        <View className="mt-4 rounded-2xl border border-primary/10 bg-white dark:bg-surface-dark p-5 flex-row items-center">
          <ActivityIndicator color="#ff5d38" />
          <Text className="ml-3 font-sans text-neutral-soft dark:text-neutral-soft-dark">Loading latest payslip...</Text>
        </View>
      ) : (
        <View className="mt-4 rounded-2xl border border-primary/10 bg-white dark:bg-surface-dark p-5">
          <Text className="font-sans text-neutral-soft dark:text-neutral-soft-dark">No payslips yet.</Text>
        </View>
      )}

      <View className="mt-8 mb-3">
        <Text className="font-sans text-lg font-bold text-neutral-dark dark:text-[#F6EDE8]">
          Recent History
        </Text>
      </View>
    </View>
  );

  if (isAuthenticating) {
    return (
      <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark px-6">
        <ActivityIndicator color="#ff5d38" />
        <Text className="mt-3 font-sans text-neutral-soft dark:text-neutral-soft-dark">Authenticating...</Text>
      </View>
    );
  }

  if (!isUnlocked) {
    return (
      <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark px-6">
        <Text className="text-center font-sans text-base text-neutral-dark dark:text-[#F6EDE8]">
          Unlock payslips to continue.
        </Text>
        {authError ? (
          <Text className="mt-2 text-center font-sans text-sm text-red-600">{authError}</Text>
        ) : null}
        <Pressable
          className="mt-4 rounded-xl bg-[#FF5C39] px-5 py-3"
          onPress={authenticateUser}
        >
          <Text className="font-sans text-sm font-bold text-[#171512]">Authenticate</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background-light dark:bg-background-dark">
      <FlatList
        data={history}
        keyExtractor={(item, index) => `${item.payment_date ?? "payslip"}-${index}`}
        renderItem={({ item }) => (
          <View className="px-4 pb-3">
            <HistoryCard item={item} isAmountsVisible={isAmountsVisible} />
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          isLoading ? (
            <View className="px-4">
              <View className="rounded-2xl border border-primary/10 bg-white dark:bg-surface-dark p-4">
                <Text className="font-sans text-neutral-soft dark:text-neutral-soft-dark">Loading payslips...</Text>
              </View>
            </View>
          ) : error ? (
            <View className="px-4">
              <View className="rounded-2xl border border-red-200 bg-white dark:bg-surface-dark p-4">
                <Text className="font-sans text-red-600">{error}</Text>
                <Pressable className="mt-3" onPress={refresh}>
                  <Text className="font-sans font-bold text-primary">Try again</Text>
                </Pressable>
              </View>
            </View>
          ) : null
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListFooterComponent={
          isLoadingMore ? (
            <View className="px-4">
              <Text className="font-sans text-sm text-neutral-soft dark:text-neutral-soft-dark">Loading more...</Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#ff5d38" />
        }
      />
    </View>
  );
}
