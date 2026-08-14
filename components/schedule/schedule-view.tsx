import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { isSessionExpiredError } from "@/src/auth/auth-session";
import { getWeekSchedule, type WeekScheduleDay } from "@/src/services/scheduleService";

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type CalendarCell = {
  date: Date;
  inCurrentMonth: boolean;
};

type ScheduleViewProps = {
  title: string;
  employeeId?: string;
  scheduleSource?: "personal" | "team";
  onBack?: () => void;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfWeekMonday(date: Date): Date {
  const next = startOfDay(date);
  const mondayIndex = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - mondayIndex);
  return next;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return startOfDay(next);
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getWeekdayIndexMondayFirst(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function toIsoDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const left = weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const right = weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${left} - ${right}`;
}

function buildMonthCells(monthDate: Date): CalendarCell[] {
  const firstDayOfMonth = startOfMonth(monthDate);
  const firstWeekdayIndex = getWeekdayIndexMondayFirst(firstDayOfMonth);
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();

  const cells: CalendarCell[] = [];

  for (let i = 0; i < firstWeekdayIndex; i += 1) {
    const date = addDays(firstDayOfMonth, -(firstWeekdayIndex - i));
    cells.push({ date, inCurrentMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      date: new Date(monthDate.getFullYear(), monthDate.getMonth(), day),
      inCurrentMonth: true,
    });
  }

  const trailing = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
  for (let i = 1; i <= trailing; i += 1) {
    const date = addDays(new Date(monthDate.getFullYear(), monthDate.getMonth(), daysInMonth), i);
    cells.push({ date, inCurrentMonth: false });
  }

  return cells;
}

export default function ScheduleView({
  title,
  employeeId,
  scheduleSource = "personal",
  onBack,
}: ScheduleViewProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const scrollRef = useRef<ScrollView>(null);

  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));

  const [weekDays, setWeekDays] = useState<WeekScheduleDay[]>([]);
  const [isLoadingWeek, setIsLoadingWeek] = useState(true);
  const [weekError, setWeekError] = useState<string | null>(null);

  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [pendingScrollDayIndex, setPendingScrollDayIndex] = useState<number | null>(0);

  const weekStart = useMemo(() => startOfWeekMonday(selectedDate), [selectedDate]);
  const weekStartEpoch = useMemo(() => weekStart.getTime(), [weekStart]);
  const selectedIso = useMemo(() => toIsoDay(selectedDate), [selectedDate]);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const calendarCells = useMemo(() => buildMonthCells(calendarMonth), [calendarMonth]);
  const weekStatusByIso = useMemo(
    () => new Map(weekDays.map((day) => [day.isoDate, day.status])),
    [weekDays],
  );

  const maxScrollY = Math.max(contentHeight - viewportHeight, 0);
  const activeDayFloat =
    maxScrollY > 0
      ? clamp((scrollY / maxScrollY) * 6, 0, 6)
      : getWeekdayIndexMondayFirst(selectedDate);
  const activeBorderDayIndex = Math.round(activeDayFloat);

  useEffect(() => {
    let mounted = true;

    const loadWeek = async () => {
      setIsLoadingWeek(true);
      setWeekError(null);
      try {
        const response = await getWeekSchedule(
          new Date(weekStartEpoch),
          employeeId ? { employeeId, source: scheduleSource } : undefined,
        );
        if (!mounted) return;
        setWeekDays(response.days);
      } catch (error) {
        if (!mounted) return;
        if (isSessionExpiredError(error)) return;
        setWeekError(error instanceof Error ? error.message : "Failed to load weekly schedule.");
      } finally {
        if (mounted) setIsLoadingWeek(false);
      }
    };

    loadWeek();

    return () => {
      mounted = false;
    };
  }, [employeeId, scheduleSource, weekStartEpoch]);

  const scrollToDayIndex = useCallback(
    (dayIndex: number, animated = true) => {
      if (maxScrollY <= 0) return;
      const target = clamp(dayIndex / 6, 0, 1) * maxScrollY;
      scrollRef.current?.scrollTo({ y: target, animated });
    },
    [maxScrollY],
  );

  useEffect(() => {
    if (pendingScrollDayIndex === null) return;
    if (maxScrollY <= 0) return;
    scrollToDayIndex(pendingScrollDayIndex, true);
    setPendingScrollDayIndex(null);
  }, [pendingScrollDayIndex, maxScrollY, scrollToDayIndex, weekDays.length]);

  const handleDateSelection = useCallback((date: Date) => {
    const normalized = startOfDay(date);
    setSelectedDate(normalized);
    setPendingScrollDayIndex(getWeekdayIndexMondayFirst(normalized));
  }, []);

  const handleJumpWeek = useCallback(
    (direction: -1 | 1) => {
      const nextDate = addDays(selectedDate, direction * 7);
      handleDateSelection(nextDate);
    },
    [handleDateSelection, selectedDate],
  );

  const weekSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 14 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx >= 48) {
            handleJumpWeek(-1);
          } else if (gestureState.dx <= -48) {
            handleJumpWeek(1);
          }
        },
      }),
    [handleJumpWeek],
  );

  return (
    <View className="flex-1 bg-background-light dark:bg-background-dark">
      <View className="flex-row items-center px-4 pt-6 pb-2">
        <View className="mr-3 flex-1 flex-row items-center">
          {onBack ? (
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
              className="mr-2 h-8 w-8 items-center justify-center"
            >
              <MaterialIcons
                name="arrow-back"
                size={24}
                color={isDark ? "#F6EDE8" : "#181210"}
              />
            </Pressable>
          ) : null}
          <Text
            className="font-serif text-3xl text-neutral-dark dark:text-[#F6EDE8]"
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
      </View>

      <View className="px-4" {...weekSwipeResponder.panHandlers}>
        <View className="mb-2 flex-row items-center justify-between">
          <Pressable
            onPress={() => handleJumpWeek(-1)}
            className="h-8 w-8 items-center justify-center rounded-full border border-neutral-dark/15 bg-surface-light dark:border-white/15 dark:bg-surface-dark"
            accessibilityRole="button"
            accessibilityLabel="Previous week"
          >
            <Text className="font-sans text-base font-bold text-neutral-dark dark:text-[#F6EDE8]">{"<"}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open calendar"
            hitSlop={8}
            onPress={() => {
              setCalendarMonth(startOfMonth(selectedDate));
              setCalendarVisible(true);
            }}
            className="flex-row items-center rounded-full border border-neutral-dark/15 bg-surface-light px-3 py-1 dark:border-white/15 dark:bg-surface-dark"
          >
            <Text className="font-sans text-sm font-bold uppercase tracking-wider text-neutral-dark/70 dark:text-white/70">
              {formatWeekRange(weekStart)}
            </Text>
            <MaterialIcons
              name="keyboard-arrow-down"
              size={16}
              color={isDark ? "#F6EDE8" : "#181210"}
            />
          </Pressable>

          <Pressable
            onPress={() => handleJumpWeek(1)}
            className="h-8 w-8 items-center justify-center rounded-full border border-neutral-dark/15 bg-surface-light dark:border-white/15 dark:bg-surface-dark"
            accessibilityRole="button"
            accessibilityLabel="Next week"
          >
            <Text className="font-sans text-base font-bold text-neutral-dark dark:text-[#F6EDE8]">{">"}</Text>
          </Pressable>
        </View>

        <View className="flex-row pb-1" style={{ marginHorizontal: -2 }}>
          {weekDates.map((date, index) => {
            const isoDate = toIsoDay(date);
            const dayStatus = weekStatusByIso.get(isoDate);
            const isUnavailable =
              dayStatus === "OFF" || dayStatus === "PTO" || dayStatus === "NO_INFO";
            const isSelected = isoDate === selectedIso;
            const isBorderActive = index === activeBorderDayIndex;
            const focusStrength = clamp(1 - Math.abs(index - activeDayFloat) / 2, 0, 1);
            const backgroundAlpha = isUnavailable
              ? isDark
                ? isSelected
                  ? 0.3
                  : 0.2
                : isSelected
                  ? 0.25
                  : 0.14
              : Math.max(
                  isSelected ? 0.3 : 0.08,
                  0.08 + focusStrength * 0.8,
                );
            const borderColor = isBorderActive
              ? "#ff5d38"
              : isDark
                ? "rgba(255,255,255,0.12)"
                : "rgba(24,18,16,0.08)";
            const textColor = isUnavailable
              ? isDark
                ? "rgba(246,237,232,0.65)"
                : "rgba(24,18,16,0.52)"
              : focusStrength > 0.55 || isSelected
                ? "#FFFFFF"
                : isDark
                  ? "#F6EDE8"
                  : "#181210";
            const chipRgb = isUnavailable
              ? isDark
                ? "246, 237, 232"
                : "24, 18, 16"
              : "255, 93, 56";

            return (
              <Pressable
                key={isoDate}
                onPress={() => handleDateSelection(date)}
                className="h-16 items-center justify-center rounded-2xl"
                style={{
                  flex: 1,
                  marginHorizontal: 2,
                  backgroundColor: `rgba(${chipRgb}, ${backgroundAlpha})`,
                  borderWidth: isBorderActive ? 2 : 1,
                  borderColor,
                }}
              >
                <Text className="font-sans text-xs font-medium uppercase" style={{ color: textColor }}>
                  {WEEKDAY_SHORT[index]}
                </Text>
                <Text className="font-sans text-lg font-bold" style={{ color: textColor }}>
                  {String(date.getDate()).padStart(2, "0")}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="mt-3 px-4 pb-1">
        <Text className="font-sans text-sm font-bold uppercase tracking-widest text-neutral-dark/40 dark:text-white/40">
          Weekly Details
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 18 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
        onContentSizeChange={(_, height) => setContentHeight(height)}
        onScroll={(event) => setScrollY(event.nativeEvent.contentOffset.y)}
      >
        {isLoadingWeek ? (
          <View className="py-6">
            <ActivityIndicator color="#ff5d38" />
          </View>
        ) : null}

        {weekError ? (
          <View className="mb-2 rounded-2xl border border-red-500/25 bg-red-500/10 p-3">
            <Text className="font-sans text-sm text-red-700 dark:text-red-300">{weekError}</Text>
            <Pressable
              onPress={() => handleDateSelection(selectedDate)}
              className="mt-2 self-start rounded-xl bg-red-600 px-3 py-1.5"
            >
              <Text className="font-sans text-xs font-bold uppercase tracking-wide text-white">
                Retry
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View className="gap-2">
          {weekDays.map((day) => {
            if (day.status === "OFF" || day.status === "PTO" || day.status === "NO_INFO") {
              return (
                <View
                  key={day.id}
                  className="rounded-2xl border border-neutral-dark/20 bg-surface-light/60 p-4 dark:border-white/20 dark:bg-surface-dark/60"
                  style={{ borderStyle: "dashed" }}
                >
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className="flex-1 font-sans text-xs font-bold uppercase text-neutral-dark/40 dark:text-white/40">
                      {day.fullDateLabel}
                    </Text>
                    <Text className="font-sans text-base font-semibold text-neutral-dark dark:text-[#F6EDE8]">
                      {day.timeLabel}
                    </Text>
                  </View>
                </View>
              );
            }

            return (
              <View
                key={day.id}
                className="rounded-2xl border border-neutral-dark/10 bg-surface-light p-4 dark:border-white/10 dark:bg-surface-dark"
              >
                <View className="mb-2 flex-row items-center justify-between gap-3">
                  <Text className="flex-1 font-sans text-xs font-bold uppercase text-neutral-dark/50 dark:text-white/50">
                    {day.fullDateLabel}
                  </Text>
                  <Text className="font-sans text-base font-semibold text-neutral-dark dark:text-[#F6EDE8]">
                    {day.timeLabel}
                  </Text>
                </View>

                <View className="flex-row flex-wrap border-t border-neutral-dark/10 pt-2 dark:border-white/10">
                  <View className="mb-3 w-1/2 pr-2">
                    <Text className="font-sans text-[10px] font-bold uppercase text-neutral-dark/40 dark:text-white/40">
                      Role
                    </Text>
                    <Text className="font-sans text-sm font-semibold text-neutral-dark dark:text-[#F6EDE8]">
                      {day.role}
                    </Text>
                  </View>

                  <View className="mb-3 w-1/2 pr-2">
                    <Text className="font-sans text-[10px] font-bold uppercase text-neutral-dark/40 dark:text-white/40">
                      Site
                    </Text>
                    <Text className="font-sans text-sm font-semibold text-neutral-dark dark:text-[#F6EDE8]">
                      {day.site}
                    </Text>
                  </View>

                  <View className="w-1/2 pr-2">
                    <Text className="font-sans text-[10px] font-bold uppercase text-neutral-dark/40 dark:text-white/40">
                      Team Leader
                    </Text>
                    <Text className="font-sans text-sm font-semibold text-neutral-dark dark:text-[#F6EDE8]">
                      {day.teamLeader}
                    </Text>
                  </View>

                  <View className="w-1/2 pr-2">
                    <Text className="font-sans text-[10px] font-bold uppercase text-neutral-dark/40 dark:text-white/40">
                      Breaks
                    </Text>
                    <Text className="font-sans text-xs font-medium leading-4 text-neutral-dark/70 dark:text-white/70">
                      {day.breaks}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Modal
        visible={calendarVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarVisible(false)}
      >
        <View className="flex-1 items-center justify-center px-5" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
          <View className="w-full max-w-md rounded-3xl border border-neutral-dark/10 bg-surface-light p-4 dark:border-white/10 dark:bg-surface-dark">
            <View className="flex-row items-center justify-between">
              <Pressable
                onPress={() => setCalendarMonth((prev) => addMonths(prev, -1))}
                className="h-9 w-9 items-center justify-center rounded-full border border-neutral-dark/15 dark:border-white/15"
              >
                <Text className="font-sans text-lg font-bold text-neutral-dark dark:text-[#F6EDE8]">{"<"}</Text>
              </Pressable>

              <Text className="font-sans text-base font-bold text-neutral-dark dark:text-[#F6EDE8]">
                {calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </Text>

              <Pressable
                onPress={() => setCalendarMonth((prev) => addMonths(prev, 1))}
                className="h-9 w-9 items-center justify-center rounded-full border border-neutral-dark/15 dark:border-white/15"
              >
                <Text className="font-sans text-lg font-bold text-neutral-dark dark:text-[#F6EDE8]">{">"}</Text>
              </Pressable>
            </View>

            <View className="mt-4 flex-row">
              {WEEKDAY_SHORT.map((weekday) => (
                <View key={weekday} style={{ width: "14.285%" }} className="items-center">
                  <Text className="font-sans text-xs font-bold uppercase text-neutral-dark/50 dark:text-white/50">
                    {weekday}
                  </Text>
                </View>
              ))}
            </View>

            <View className="mt-2 flex-row flex-wrap">
              {calendarCells.map((cell) => {
                const isSelected = isSameDay(cell.date, selectedDate);
                const textColor = isSelected
                  ? "#FFFFFF"
                  : cell.inCurrentMonth
                    ? isDark
                      ? "#F6EDE8"
                      : "#181210"
                    : isDark
                      ? "rgba(246,237,232,0.45)"
                      : "rgba(24,18,16,0.35)";

                return (
                  <Pressable
                    key={toIsoDay(cell.date)}
                    onPress={() => {
                      handleDateSelection(cell.date);
                      setCalendarVisible(false);
                    }}
                    style={{ width: "14.285%" }}
                    className="items-center py-1"
                  >
                    <View
                      className="h-9 w-9 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: isSelected ? "#ff5d38" : "transparent",
                      }}
                    >
                      <Text className="font-sans text-sm font-semibold" style={{ color: textColor }}>
                        {cell.date.getDate()}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              className="mt-4 rounded-xl border border-neutral-dark/15 px-4 py-2.5 dark:border-white/15"
              onPress={() => setCalendarVisible(false)}
            >
              <Text className="text-center font-sans text-sm font-bold text-neutral-dark dark:text-[#F6EDE8]">
                Close
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
