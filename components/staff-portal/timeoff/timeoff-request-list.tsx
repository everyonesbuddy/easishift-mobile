import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import api from "@/config/api";
import { useAuth } from "@/context/auth-context";

import TimeOffRequestModal from "./timeoff-request-modal";
import {
  TimeOffRequest,
  calculateDaysInclusive,
  formatDate,
  formatDateTime,
  getEndValue,
  getRequestId,
  getStaffUserId,
  getStartValue,
  getStatusIconName,
  getStatusStyle,
  normalizeTimeOffPayload,
} from "./timeoff-shared";

export default function TimeOffRequestListPage() {
  const { user, can } = useAuth();
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/timeoff");
      setRequests(normalizeTimeOffPayload(res.data));
    } catch (requestError) {
      console.warn("Failed to fetch time off requests", requestError);
      setError("Failed to load time off requests.");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const isAdmin = can("timeoff.review");

  const userId = typeof user?._id === "string" ? user._id : "";

  const myRequests = useMemo(
    () =>
      requests.filter((request) => {
        const reqUserId = getStaffUserId(request);
        return !userId ? true : String(reqUserId) === String(userId);
      }),
    [requests, userId],
  );

  const pendingRequests = myRequests.filter(
    (request) => request.status === "pending",
  );
  const approvedRequests = myRequests.filter(
    (request) => request.status === "approved",
  );
  const deniedRequests = myRequests.filter(
    (request) => request.status === "denied",
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const handleReview = async (id: string, newStatus: "approved" | "denied") => {
    try {
      setActionLoadingId(id);
      await api.patch(`/timeoff/${id}/review`, { status: newStatus });
      await fetchRequests();
    } catch (requestError) {
      console.warn("Failed to review time off request", requestError);
      setError("Failed to update request status.");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Time Off Requests</Text>
          <Pressable style={styles.newBtn} onPress={() => setOpenModal(true)}>
            <Feather name="plus" size={14} color="#ffffff" />
            <Text style={styles.newBtnText}>Request Time Off</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.statsGrid}>
          <StatCard label="Total Requests" value={myRequests.length} />
          <StatCard
            label="Awaiting Review"
            value={pendingRequests.length}
            badge={pendingRequests.length > 0 ? "Pending" : ""}
          />
          <StatCard label="Approved" value={approvedRequests.length} />
          <StatCard label="Denied" value={deniedRequests.length} />
        </View>

        {loading ? (
          <View style={styles.centerCard}>
            <ActivityIndicator size="small" color="#2563eb" />
          </View>
        ) : myRequests.length === 0 ? (
          <View style={styles.centerCard}>
            <Feather name="calendar" size={34} color="#9ca3af" />
            <Text style={styles.emptyText}>No time off requests</Text>
            <Pressable
              style={styles.emptyBtn}
              onPress={() => setOpenModal(true)}
            >
              <Text style={styles.emptyBtnText}>Submit your first request</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {myRequests.map((request) => {
              const id = getRequestId(request);
              const start = getStartValue(request);
              const end = getEndValue(request);
              const days = calculateDaysInclusive(start, end);
              const isPast = (() => {
                const parsedEnd = new Date(end);
                return !Number.isNaN(parsedEnd.getTime()) && parsedEnd < today;
              })();
              const status = request.status || "pending";
              const statusStyle = getStatusStyle(status);
              const iconName = getStatusIconName(status);

              return (
                <View key={id || `${start}-${end}`} style={styles.requestCard}>
                  <View style={styles.iconWrap}>
                    <Feather
                      name={iconName}
                      size={20}
                      color={statusStyle.color}
                    />
                  </View>

                  <View style={styles.requestBody}>
                    <View style={styles.requestTopRow}>
                      <Text style={styles.requestTitle}>
                        {formatDate(start)} - {formatDate(end)}
                      </Text>
                      <View style={styles.requestPills}>
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
                            {status}
                          </Text>
                        </View>
                        {isPast ? (
                          <View style={styles.pastPill}>
                            <Text style={styles.pastPillText}>Past</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    <View style={styles.metaRow}>
                      <View style={styles.metaItem}>
                        <Feather name="clock" size={13} color="#6b7280" />
                        <Text style={styles.metaText}>
                          {days} day{days !== 1 ? "s" : ""}
                        </Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Feather name="calendar" size={13} color="#6b7280" />
                        <Text style={styles.metaText}>{formatDate(start)}</Text>
                      </View>
                    </View>

                    {request.reason ? (
                      <View style={styles.reasonCard}>
                        <Text style={styles.reasonText}>{request.reason}</Text>
                      </View>
                    ) : null}

                    {request.reviewNotes ? (
                      <View
                        style={[
                          styles.reviewCard,
                          request.status === "approved"
                            ? styles.reviewApproved
                            : styles.reviewDenied,
                        ]}
                      >
                        <Text style={styles.reviewText}>
                          Admin response: {request.reviewNotes}
                        </Text>
                      </View>
                    ) : null}

                    <Text style={styles.captionText}>
                      Submitted{" "}
                      {formatDateTime(request.requestedAt || request.createdAt)}
                      {request.reviewedAt
                        ? ` • Reviewed ${formatDateTime(request.reviewedAt)}`
                        : ""}
                    </Text>
                  </View>

                  {isAdmin && request.status === "pending" && id ? (
                    <View style={styles.adminActions}>
                      <Pressable
                        style={styles.approveBtn}
                        disabled={actionLoadingId === id}
                        onPress={() => handleReview(id, "approved")}
                      >
                        <Feather name="check" size={14} color="#ffffff" />
                      </Pressable>
                      <Pressable
                        style={styles.denyBtn}
                        disabled={actionLoadingId === id}
                        onPress={() => handleReview(id, "denied")}
                      >
                        <Feather name="x" size={14} color="#ffffff" />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <TimeOffRequestModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onSuccess={fetchRequests}
      />
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "800",
  },
  newBtn: {
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  newBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
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
  centerCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    paddingVertical: 34,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 13,
  },
  emptyBtn: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  emptyBtnText: {
    color: "#374151",
    fontWeight: "700",
    fontSize: 12,
  },
  listWrap: {
    gap: 10,
  },
  requestCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 12,
    flexDirection: "row",
    gap: 10,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
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
  requestTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  requestPills: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  pastPill: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "#ffffff",
  },
  pastPillText: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    gap: 14,
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    color: "#6b7280",
    fontSize: 12,
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
  reviewCard: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  reviewApproved: {
    backgroundColor: "#ecfdf5",
  },
  reviewDenied: {
    backgroundColor: "#fff1f2",
  },
  reviewText: {
    color: "#374151",
    fontSize: 12,
  },
  captionText: {
    color: "#6b7280",
    fontSize: 11,
  },
  adminActions: {
    gap: 8,
  },
  approveBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
  },
  denyBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
  },
});
