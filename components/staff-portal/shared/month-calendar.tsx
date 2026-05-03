import { Pressable, StyleSheet, Text, View } from "react-native";

type DayMeta = {
  count?: number;
  color?: string;
};

type Props = {
  month: Date;
  selectedDay?: string;
  dayMeta?: Record<string, DayMeta>;
  onSelectDay: (dayKey: string) => void;
  onChangeMonth: (nextMonth: Date) => void;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDayKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, diff: number) {
  return new Date(date.getFullYear(), date.getMonth() + diff, 1);
}

export default function MonthCalendar({
  month,
  selectedDay,
  dayMeta = {},
  onSelectDay,
  onChangeMonth,
}: Props) {
  const firstDay = startOfMonth(month);
  const firstWeekday = firstDay.getDay();
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstWeekday);

  const cells = Array.from({ length: 42 }).map((_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    const key = toDayKey(date);
    const inMonth = date.getMonth() === month.getMonth();
    const selected = selectedDay === key;
    const meta = dayMeta[key];

    return { date, key, inMonth, selected, meta };
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable
          style={styles.monthBtn}
          onPress={() => onChangeMonth(addMonths(month, -1))}
        >
          <Text style={styles.monthBtnText}>Prev</Text>
        </Pressable>
        <Text style={styles.monthTitle}>
          {month.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </Text>
        <Pressable
          style={styles.monthBtn}
          onPress={() => onChangeMonth(addMonths(month, 1))}
        >
          <Text style={styles.monthBtnText}>Next</Text>
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((label) => (
          <Text key={label} style={styles.weekdayText}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell) => (
          <Pressable
            key={cell.key}
            style={[
              styles.dayCell,
              cell.selected ? styles.dayCellSelected : null,
              !cell.inMonth ? styles.dayCellMuted : null,
            ]}
            onPress={() => onSelectDay(cell.key)}
          >
            <Text
              style={[
                styles.dayText,
                cell.selected ? styles.dayTextSelected : null,
                !cell.inMonth ? styles.dayTextMuted : null,
              ]}
            >
              {cell.date.getDate()}
            </Text>

            {cell.meta?.count ? (
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.badgeDot,
                    cell.meta?.color
                      ? { backgroundColor: cell.meta.color }
                      : null,
                  ]}
                />
                <Text style={styles.badgeText}>{cell.meta.count}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 10,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
  },
  monthBtnText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
  },
  monthTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
  },
  weekRow: {
    flexDirection: "row",
  },
  weekdayText: {
    width: "14.2857%",
    textAlign: "center",
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "700",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    overflow: "hidden",
  },
  dayCell: {
    width: "14.2857%",
    minHeight: 56,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
    paddingTop: 6,
    paddingHorizontal: 4,
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ffffff",
  },
  dayCellSelected: {
    backgroundColor: "#dbeafe",
  },
  dayCellMuted: {
    backgroundColor: "#f9fafb",
  },
  dayText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
  },
  dayTextSelected: {
    color: "#1d4ed8",
  },
  dayTextMuted: {
    color: "#9ca3af",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2563eb",
  },
  badgeText: {
    color: "#374151",
    fontSize: 10,
    fontWeight: "700",
  },
});
