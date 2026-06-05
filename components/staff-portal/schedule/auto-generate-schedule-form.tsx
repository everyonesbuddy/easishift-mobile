import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import api from "@/config/api";
import {
  getRoleDisplayName,
  getRoleOptionsForIndustry,
  getRoleOptionsFromFacilityPreferences,
  isRoleCompatible,
} from "@/constants/industry-roles";
import { useAuth } from "@/context/auth-context";

import { CoverageItem } from "./schedule-types";

type Props = {
  onSuccess?: () => void;
  onClose: () => void;
};

function toNumberOrNull(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function AutoGenerateScheduleForm({
  onSuccess,
  onClose,
}: Props) {
  const { tenant } = useAuth();

  const [coverages, setCoverages] = useState<CoverageItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [fetching, setFetching] = useState(false);
  const [resultSummary, setResultSummary] = useState("");
  const [facilityPreferences, setFacilityPreferences] = useState<{
    roleFamilies?: unknown[];
  } | null>(null);

  const roleOptions = useMemo(() => {
    const facilityOptions =
      getRoleOptionsFromFacilityPreferences(facilityPreferences);
    if (facilityOptions.length) {
      return facilityOptions;
    }

    return getRoleOptionsForIndustry(tenant?.industry);
  }, [facilityPreferences, tenant?.industry]);

  const selectableCoverageIds = useMemo(
    () =>
      coverages
        .filter((coverage) => Number(coverage.remaining) > 0)
        .map((coverage) => coverage._id || "")
        .filter(Boolean),
    [coverages],
  );

  const selectedSelectableCount = useMemo(
    () => selectedIds.filter((id) => selectableCoverageIds.includes(id)).length,
    [selectedIds, selectableCoverageIds],
  );

  const allSelectableSelected =
    selectableCoverageIds.length > 0 &&
    selectedSelectableCount === selectableCoverageIds.length;
  const hasSomeSelectableSelected =
    selectedSelectableCount > 0 && !allSelectableSelected;

  useEffect(() => {
    let mounted = true;

    async function loadFacilityPreferences() {
      try {
        const res = await api.get("/facility-preferences");
        if (!mounted) {
          return;
        }

        setFacilityPreferences(
          (res.data || null) as { roleFamilies?: unknown[] } | null,
        );
      } catch {
        if (!mounted) {
          return;
        }

        setFacilityPreferences(null);
      }
    }

    loadFacilityPreferences();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    async function loadCoverages() {
      setFetching(true);
      try {
        const res = await api.get("/coverage/unfilled-auto", {
          params: selectedRole ? { role: selectedRole } : {},
        });

        const now = new Date();
        const raw = Array.isArray(res.data) ? (res.data as CoverageItem[]) : [];
        const upcoming = raw
          .filter((coverage) => {
            const end = new Date(coverage.endTime || "");
            return (
              !Number.isNaN(end.getTime()) &&
              end >= now &&
              (!selectedRole || isRoleCompatible(selectedRole, coverage.role))
            );
          })
          .map((coverage) => {
            const requiredCount = Number(coverage.requiredCount) || 0;
            const assignedCount = Number(coverage.assignedCount);
            const directRemaining = Number(coverage.remaining);

            const computedRemaining = Number.isFinite(assignedCount)
              ? Math.max(0, requiredCount - assignedCount)
              : Math.max(0, requiredCount);

            const spotsRemaining = Number.isFinite(directRemaining)
              ? Math.max(0, directRemaining)
              : computedRemaining;

            return {
              ...coverage,
              remaining: spotsRemaining,
            };
          });

        setCoverages(upcoming);
        setSelectedIds([]);
      } catch (error) {
        console.warn("Failed to load unfilled coverages", error);
        setCoverages([]);
      } finally {
        setFetching(false);
      }
    }

    loadCoverages();
  }, [selectedRole]);

  const sortedCoverages = useMemo(
    () =>
      coverages.slice().sort((a, b) => {
        const aZero = Number(a.remaining ?? 0) <= 0;
        const bZero = Number(b.remaining ?? 0) <= 0;
        if (aZero === bZero) {
          const ta = new Date(a.startTime || "").getTime();
          const tb = new Date(b.startTime || "").getTime();
          return ta - tb;
        }
        return aZero ? 1 : -1;
      }),
    [coverages],
  );

  const toggleSelect = (id?: string) => {
    if (!id) {
      return;
    }

    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleToggleSelectAll = (nextChecked: boolean) => {
    if (nextChecked) {
      setSelectedIds((prev) =>
        Array.from(new Set([...prev, ...selectableCoverageIds])),
      );
      return;
    }

    setSelectedIds((prev) =>
      prev.filter((id) => !selectableCoverageIds.includes(id)),
    );
  };

  const handleSubmit = async () => {
    if (!selectedIds.length) {
      setErrorMsg("Select at least one coverage.");
      return;
    }

    setErrorMsg("");
    setResultSummary("");
    setLoading(true);

    try {
      const res = await api.post("/schedules/auto-generate", {
        coverageIds: selectedIds,
      });

      const data = res.data as {
        generatedCount?: number;
        coverageResults?: Record<string, unknown>[];
      };
      const generatedCount = data.generatedCount ?? 0;
      const coverageResults = Array.isArray(data.coverageResults)
        ? data.coverageResults
        : [];

      const selectedCoverageMap = new Map(
        coverages
          .filter(
            (coverage) => coverage._id && selectedIds.includes(coverage._id),
          )
          .map((coverage) => [coverage._id as string, coverage]),
      );

      const findSourceCoverage = (item: Record<string, unknown>) => {
        const resultId = String(item.coverageId || item._id || item.id || "");
        if (resultId && selectedCoverageMap.has(resultId)) {
          return selectedCoverageMap.get(resultId) || null;
        }

        const resultStart = new Date(String(item.startTime || "")).getTime();
        const resultEnd = new Date(String(item.endTime || "")).getTime();
        if (!Number.isFinite(resultStart) || !Number.isFinite(resultEnd)) {
          return null;
        }

        return (
          coverages.find((coverage) => {
            const sameRole = (coverage.role || "") === String(item.role || "");
            const coverageStart = new Date(coverage.startTime || "").getTime();
            const coverageEnd = new Date(coverage.endTime || "").getTime();
            return (
              sameRole &&
              coverageStart === resultStart &&
              coverageEnd === resultEnd
            );
          }) || null
        );
      };

      const statusLabelMap: Record<string, string> = {
        filled: "Scheduled",
        partially_filled: "Partially Scheduled",
        already_filled: "Already Full",
        skipped: "Skipped",
      };

      const lines = coverageResults.slice(0, 3).map((item) => {
        const sourceCoverage = findSourceCoverage(item);
        const role = getRoleDisplayName(
          String(item.role || sourceCoverage?.role || ""),
        );
        const startTime = String(
          item.startTime || sourceCoverage?.startTime || "",
        );
        const endTime = String(item.endTime || sourceCoverage?.endTime || "");

        const startParsed = new Date(startTime);
        const endParsed = new Date(endTime);
        const dateText = Number.isNaN(startParsed.getTime())
          ? "Unknown date"
          : startParsed.toLocaleDateString();

        const startText = Number.isNaN(startParsed.getTime())
          ? "--:--"
          : startParsed.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
        const endText = Number.isNaN(endParsed.getTime())
          ? "--:--"
          : endParsed.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

        const status = statusLabelMap[String(item.status || "")] || "Processed";
        const reason = String(item.message || "");

        const requiredFromResult = toNumberOrNull(item.requiredCount);
        const requiredFromSource = toNumberOrNull(
          sourceCoverage?.requiredCount,
        );
        const required = requiredFromResult ?? requiredFromSource;

        const startFilledFromResult = toNumberOrNull(item.alreadyAssignedCount);
        const startFilledFromSource = toNumberOrNull(
          sourceCoverage?.assignedCount,
        );
        const startFilled = startFilledFromResult ?? startFilledFromSource;

        const assignedNow = toNumberOrNull(item.assignedCount) ?? 0;
        const endFilled =
          startFilled != null ? startFilled + assignedNow : null;

        const endRemainingFromResult = toNumberOrNull(item.unfilledCount);
        const endRemaining =
          endRemainingFromResult ??
          (required != null && endFilled != null
            ? Math.max(0, required - endFilled)
            : null);

        const startState =
          required != null && startFilled != null
            ? `Started: required ${required}, filled ${startFilled}`
            : "Started: state unavailable";

        const endState =
          required != null && endFilled != null && endRemaining != null
            ? `Ended: required ${required}, filled ${endFilled}, remaining ${endRemaining}`
            : "Ended: state unavailable";

        return `- ${role} | ${status}\n  ${dateText} | ${startText} to ${endText}\n  ${startState}\n  ${endState}${reason ? `\n  ${reason}` : ""}`;
      });

      if (coverageResults.length > 3) {
        lines.push(`- +${coverageResults.length - 3} more item(s)`);
      }

      setResultSummary(
        lines.length
          ? `Generated ${generatedCount} schedules.\n\n${lines.join("\n\n")}`
          : `Generated ${generatedCount} schedules.`,
      );

      setSelectedIds([]);
      onSuccess?.();
    } catch (error: unknown) {
      const backendMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } })
          .response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message || "Failed to auto-generate"
          : "Failed to auto-generate";

      setErrorMsg(backendMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>AI Generated Schedule</Text>
          <Text style={styles.subtitle}>
            Automatically assign staff to selected coverage windows.
          </Text>
        </View>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Feather name="x" size={20} color="#6b7280" />
        </Pressable>
      </View>

      <Text style={styles.filterLabel}>Role Filter</Text>
      <View style={styles.rolesWrap}>
        <RolePill
          active={selectedRole === ""}
          label="All"
          onPress={() => setSelectedRole("")}
        />
        {roleOptions.map((item) => (
          <RolePill
            key={item.value}
            active={selectedRole === item.value}
            label={item.label}
            onPress={() => setSelectedRole(item.value)}
          />
        ))}
      </View>

      {fetching ? <ActivityIndicator size="small" color="#1d4ed8" /> : null}

      {!fetching && coverages.length === 0 ? (
        <Text style={styles.emptyText}>No unfilled coverages available.</Text>
      ) : null}

      {coverages.length > 0 ? (
        <Pressable
          style={styles.selectAllBtn}
          onPress={() => handleToggleSelectAll(!allSelectableSelected)}
        >
          <View
            style={[
              styles.checkbox,
              allSelectableSelected || hasSomeSelectableSelected
                ? styles.checkboxActive
                : null,
            ]}
          >
            {allSelectableSelected ? (
              <Feather name="check" size={13} color="#1d4ed8" />
            ) : hasSomeSelectableSelected ? (
              <Feather name="minus" size={13} color="#1d4ed8" />
            ) : null}
          </View>
          <Text style={styles.selectAllText}>
            Select all ({selectedSelectableCount}/{selectableCoverageIds.length}
            )
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.listWrap}>
        {sortedCoverages.map((coverage) => {
          const selected = Boolean(
            coverage._id && selectedIds.includes(coverage._id),
          );
          const isZero = Number(coverage.remaining ?? 0) <= 0;
          const date = new Date(coverage.date || coverage.startTime || "");
          const start = new Date(coverage.startTime || "");
          const end = new Date(coverage.endTime || "");

          return (
            <Pressable
              key={coverage._id}
              style={[
                styles.coverageCard,
                selected ? styles.coverageCardSelected : null,
                isZero ? styles.coverageCardDisabled : null,
              ]}
              onPress={() => {
                if (!isZero) {
                  toggleSelect(coverage._id);
                }
              }}
            >
              <View style={styles.coverageLeft}>
                <View
                  style={[
                    styles.checkbox,
                    selected ? styles.checkboxActive : null,
                  ]}
                >
                  {selected ? (
                    <Feather name="check" size={13} color="#1d4ed8" />
                  ) : null}
                </View>
                <View style={styles.coverageTextWrap}>
                  <Text style={styles.coverageTitle} numberOfLines={1}>
                    {Number.isNaN(date.getTime())
                      ? "Unknown date"
                      : date.toLocaleDateString()}{" "}
                    - {getRoleDisplayName(coverage.role)}
                  </Text>
                  <Text style={styles.coverageMeta} numberOfLines={1}>
                    {Number.isNaN(start.getTime())
                      ? "--:--"
                      : start.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                    {" to "}
                    {Number.isNaN(end.getTime())
                      ? "--:--"
                      : end.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                    {coverage.shiftType ? ` - ${coverage.shiftType}` : ""}
                    {coverage.shiftTag ? ` - ${coverage.shiftTag}` : ""}
                    {coverage.unitArea ? ` - ${coverage.unitArea}` : ""}
                  </Text>
                </View>
              </View>

              <View style={styles.coverageStats}>
                <Text style={styles.statLabel}>
                  Req {coverage.requiredCount ?? 0}
                </Text>
                <Text
                  style={[
                    styles.statValue,
                    isZero ? styles.statValueMuted : null,
                  ]}
                >
                  Left {coverage.remaining ?? 0}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
      {resultSummary ? (
        <Text style={styles.success}>{resultSummary}</Text>
      ) : null}

      <Pressable
        style={[
          styles.submitBtn,
          loading || fetching ? styles.submitBtnDisabled : null,
        ]}
        onPress={handleSubmit}
        disabled={loading || fetching}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.submitText}>Generate with AI</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function RolePill({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.rolePill, active ? styles.rolePillActive : null]}
    >
      <Text
        style={[styles.rolePillText, active ? styles.rolePillTextActive : null]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  closeBtn: {
    padding: 8,
    marginRight: 2,
  },
  title: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "800",
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 2,
  },
  filterLabel: {
    color: "#374151",
    fontWeight: "700",
    fontSize: 12,
  },
  rolesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rolePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
  },
  rolePillActive: {
    borderColor: "#1d4ed8",
    backgroundColor: "#dbeafe",
  },
  rolePillText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  rolePillTextActive: {
    color: "#1d4ed8",
  },
  selectAllBtn: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectAllText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  listWrap: {
    gap: 8,
  },
  coverageCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#f9fafb",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  coverageCardSelected: {
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
  },
  coverageCardDisabled: {
    opacity: 0.58,
  },
  coverageLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#9ca3af",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  checkboxActive: {
    borderColor: "#1d4ed8",
    backgroundColor: "#dbeafe",
  },
  coverageTextWrap: {
    flex: 1,
    gap: 2,
  },
  coverageTitle: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },
  coverageMeta: {
    color: "#6b7280",
    fontSize: 12,
  },
  coverageStats: {
    alignItems: "flex-end",
    gap: 2,
  },
  statLabel: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "600",
  },
  statValue: {
    color: "#047857",
    fontSize: 12,
    fontWeight: "800",
  },
  statValueMuted: {
    color: "#6b7280",
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 13,
  },
  error: {
    color: "#b91c1c",
    backgroundColor: "#fee2e2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  success: {
    color: "#065f46",
    backgroundColor: "#d1fae5",
    borderColor: "#a7f3d0",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    lineHeight: 18,
  },
  submitBtn: {
    minHeight: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#b45309",
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
});
