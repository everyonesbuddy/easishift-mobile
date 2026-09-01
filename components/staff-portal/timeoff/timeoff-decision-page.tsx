import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import GuideHelpButton from "@/components/shared/guide-help-button";
import api from "@/config/api";
import { useGuideTour } from "@/context/guide-tour-context";

const TIMEOFF_DECISION_TOUR_STEPS = [
  {
    target: "timeoff-decision-filters",
    title: "Filter by status",
    body: "Focus on pending requests that need a decision, or review previous approvals and denials.",
  },
  {
    target: "timeoff-decision-list",
    title: "Review a request",
    body: "Open a pending request to approve or deny it, with an optional note for the staff member.",
  },
];

import {
  TimeOffRequest,
  formatDate,
  formatDateTime,
  getAvatarLabel,
  getEndValue,
  getRequestId,
  getStaffName,
  getStartValue,
  getStatusStyle,
  normalizeTimeOffPayload,
} from "./timeoff-shared";

export default function TimeOffDecisionPage() {
  const { startTourIfUnseen } = useGuideTour();
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<TimeOffRequest | null>(null);
  const [notes, setNotes] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "pending" | "approved" | "denied"
  >("all");

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/timeoff");
      setRequests(normalizeTimeOffPayload(res.data));
    } catch (requestError) {
      console.warn("Failed to fetch time off approvals", requestError);
      setError("Failed to load requests.");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    if (!loading) {
      void startTourIfUnseen("timeoff-decision", TIMEOFF_DECISION_TOUR_STEPS);
    }
  }, [loading, startTourIfUnseen]);

  const filtered = useMemo(
    () =>
      filterStatus === "all"
        ? requests
        : requests.filter((request) => request.status === filterStatus),
    [filterStatus, requests],
  );

  const handleOpen = (request: TimeOffRequest) => {
    setSelected(request);
    setNotes(request.reviewNotes || "");
    setError("");
  };

  const handleClose = () => {
    setSelected(null);
    setNotes("");
    setError("");
  };

  const handleDecision = async (id: string, status: "approved" | "denied") => {
    if (status === "denied" && !notes.trim()) {
      setError("Please add review notes when denying a request.");
      return;
    }

    try {
      setActionLoadingId(id);
      setError("");
      await api.patch(`/timeoff/${id}/review`, {
        status,
        reviewNotes: notes,
      });
      await fetchRequests();
      handleClose();
    } catch (requestError: unknown) {
      const message =
        typeof requestError === "object" &&
        requestError !== null &&
        "response" in requestError &&
        typeof (requestError as { response?: { data?: { message?: string } } })
          .response?.data?.message === "string"
          ? (requestError as { response?: { data?: { message?: string } } })
              .response?.data?.message || "Failed to submit decision"
          : "Failed to submit decision";

      setError(message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const pendingCount = requests.filter(
    (request) => request.status === "pending",
  ).length;
  const approvedCount = requests.filter(
    (request) => request.status === "approved",
  ).length;
  const deniedCount = requests.filter(
    (request) => request.status === "denied",
  ).length;

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <GuideHelpButton
          tourId="timeoff-decision"
          tourSteps={TIMEOFF_DECISION_TOUR_STEPS}
        />
        <View style={styles.headerRow}>
          <Text style={styles.title}>Time Off Approvals</Text>
          <Text style={styles.subtitle}>
            Review and manage time off requests
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.statsGrid}>
          <StatCard label="Total Requests" value={requests.length} />
          <StatCard
            label="Pending"
            value={pendingCount}
            badge={pendingCount > 0 ? "Action needed" : ""}
          />
          <StatCard label="Approved" value={approvedCount} />
          <StatCard label="Denied" value={deniedCount} />
        </View>

        <View style={styles.filterCard}>
          <Text style={styles.filterLabel}>Filter by status</Text>
          <View style={styles.filterPills}>
            {(["all", "pending", "approved", "denied"] as const).map(
              (status) => {
                const active = filterStatus === status;
                return (
                  <Pressable
                    key={status}
                    style={[
                      styles.filterPill,
                      active ? styles.filterPillActive : null,
                    ]}
                    onPress={() => setFilterStatus(status)}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        active ? styles.filterPillTextActive : null,
                      ]}
                    >
                      {status}
                    </Text>
                  </Pressable>
                );
              },
            )}
          </View>
        </View>

        <View style={styles.listContainer}>
          {loading ? (
            <View style={styles.centerCard}>
              <ActivityIndicator size="small" color="#2563eb" />
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.centerCard}>
              <Feather name="clock" size={34} color="#9ca3af" />
              <Text style={styles.emptyText}>No time off requests found</Text>
            </View>
          ) : (
            filtered.map((request) => {
              const statusStyle = getStatusStyle(request.status);

              return (
                <View key={getRequestId(request)} style={styles.requestCard}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {getAvatarLabel(request)}
                    </Text>
                  </View>

                  <View style={styles.requestBody}>
                    <View style={styles.requestTopRow}>
                      <Text style={styles.staffName}>
                        {getStaffName(request)}
                      </Text>
                      <View
                        style={[
                          styles.statusPill,
                          {
                            backgroundColor: statusStyle.bg,
                            borderColor: statusStyle.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            { color: statusStyle.color },
                          ]}
                        >
                          {request.status || "pending"}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.dateText}>
                      {formatDate(getStartValue(request))} -{" "}
                      {formatDate(getEndValue(request))}
                    </Text>

                    {request.reason ? (
                      <View style={styles.reasonCard}>
                        <Text style={styles.reasonText}>{request.reason}</Text>
                      </View>
                    ) : null}

                    <Text style={styles.captionText}>
                      {formatDateTime(request.requestedAt || request.createdAt)}
                      {request.reviewedBy ? " • Reviewed" : ""}
                    </Text>
                  </View>

                  {request.status === "pending" ? (
                    <Pressable
                      style={styles.reviewBtn}
                      onPress={() => handleOpen(request)}
                    >
                      <Text style={styles.reviewBtnText}>Review</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.readonlyStatus}>{request.status}</Text>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal
        visible={Boolean(selected)}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <Pressable style={styles.modalBackdrop} onPress={handleClose}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Review Time Off Request</Text>
              <Pressable onPress={handleClose} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#6b7280" />
              </Pressable>
            </View>

            {selected ? (
              <>
                <View style={styles.modalStaffRow}>
                  <View style={styles.modalAvatar}>
                    <Text style={styles.modalAvatarText}>
                      {getAvatarLabel(selected)}
                    </Text>
                  </View>
                  <View style={styles.modalStaffBody}>
                    <Text style={styles.modalStaffName}>
                      {getStaffName(selected)}
                    </Text>
                    <Text style={styles.modalMeta}>
                      {formatDateTime(getStartValue(selected))} -{" "}
                      {formatDateTime(getEndValue(selected))}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Reason</Text>
                  <Text style={styles.modalReason}>
                    {selected.reason || "-"}
                  </Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Review Notes</Text>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    style={styles.notesInput}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              </>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={handleClose}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, styles.denyBtn]}
                onPress={() => {
                  if (selected?._id) {
                    handleDecision(selected._id, "denied");
                  }
                }}
                disabled={selected ? actionLoadingId === selected._id : false}
              >
                <Text style={styles.actionText}>Deny</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, styles.approveBtn]}
                onPress={() => {
                  if (selected?._id) {
                    handleDecision(selected._id, "approved");
                  }
                }}
                disabled={selected ? actionLoadingId === selected._id : false}
              >
                <Text style={styles.actionText}>Approve</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  badge,
}: {
  label: string;
  value: number;
  badge?: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <Text style={styles.statValue}>{value}</Text>
        {badge ? <Text style={styles.badgeText}>{badge}</Text> : null}
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    padding: 16,
    paddingTop: 28,
    paddingBottom: 20,
    gap: 12,
  },
  headerRow: {
    gap: 2,
  },
  title: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
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
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    gap: 0,
  },
  statCard: {
    width: "50%",
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statValue: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "800",
  },
  statLabel: {
    color: "#6b7280",
    fontSize: 12,
  },
  badgeText: {
    color: "#92400e",
    fontSize: 11,
    fontWeight: "800",
    backgroundColor: "#fffbeb",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  filterCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 10,
    gap: 8,
  },
  filterLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
  },
  filterPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  filterPill: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
  },
  filterPillActive: {
    borderColor: "#2563eb",
    backgroundColor: "#dbeafe",
  },
  filterPillText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  filterPillTextActive: {
    color: "#2563eb",
  },
  listContainer: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  centerCard: {
    paddingVertical: 36,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 13,
  },
  requestCard: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  requestBody: {
    flex: 1,
    gap: 8,
  },
  requestTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  staffName: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  dateText: {
    color: "#6b7280",
    fontSize: 13,
  },
  reasonCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  reasonText: {
    color: "#111827",
    fontSize: 13,
  },
  captionText: {
    color: "#6b7280",
    fontSize: 11,
  },
  reviewBtn: {
    borderRadius: 8,
    backgroundColor: "#16a34a",
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  reviewBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  readonlyStatus: {
    color: "#6b7280",
    fontSize: 12,
    textTransform: "capitalize",
    alignSelf: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeBtn: {
    padding: 8,
    marginRight: 2,
  },
  modalTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
  },
  modalStaffRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
  },
  modalAvatarText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  modalStaffBody: {
    flex: 1,
    gap: 2,
  },
  modalStaffName: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  modalMeta: {
    color: "#6b7280",
    fontSize: 12,
  },
  modalSection: {
    gap: 6,
  },
  modalSectionTitle: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  modalReason: {
    color: "#111827",
    fontSize: 13,
  },
  notesInput: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
  },
  denyBtn: {
    backgroundColor: "#dc2626",
  },
  approveBtn: {
    backgroundColor: "#16a34a",
  },
  cancelText: {
    color: "#111827",
    fontWeight: "700",
  },
  actionText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
