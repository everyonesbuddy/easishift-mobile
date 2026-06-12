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

import api from "@/config/api";
import { useAuth } from "@/context/auth-context";

import {
  formatWindow,
  getRoleDisplayName,
  StaffUser,
  SwapRequestItem,
} from "./schedule-types";
import ShiftSwapRequestModal from "./shift-swap-request-modal";

const STATUS_COLORS: Record<string, string> = {
  pending_admin: "#f59e0b",
  pending_receiver: "#0284c7",
  accepted: "#16a34a",
  denied: "#dc2626",
  admin_denied: "#dc2626",
  cancelled: "#6b7280",
  expired: "#6b7280",
};

const STATUS_LABELS: Record<string, string> = {
  pending_admin: "PENDING ADMIN",
  pending_receiver: "PENDING RECEIVER",
  accepted: "ACCEPTED",
  denied: "DENIED",
  admin_denied: "ADMIN DENIED",
  cancelled: "CANCELLED",
  expired: "EXPIRED",
};

export default function SwapShiftRequestsPage() {
  const { user, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<"inbox" | "sent">("inbox");
  const [loading, setLoading] = useState(false);
  const [inboxRequests, setInboxRequests] = useState<SwapRequestItem[]>([]);
  const [sentRequests, setSentRequests] = useState<SwapRequestItem[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);

  const [requestModalOpen, setRequestModalOpen] = useState(false);

  const [respondDialogOpen, setRespondDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] =
    useState<SwapRequestItem | null>(null);
  const [decision, setDecision] = useState<"approve" | "accept" | "deny">(
    "accept",
  );
  const [responseNote, setResponseNote] = useState("");
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [error, setError] = useState("");

  const loadStaff = async () => {
    try {
      const res = await api.get("/auth/users");
      setStaffList(Array.isArray(res.data) ? (res.data as StaffUser[]) : []);
    } catch (loadError) {
      console.warn("Failed to fetch staff list", loadError);
    }
  };

  const loadSwapRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      if (isAdmin) {
        const res = await api.get("/schedules/swap-requests");
        setInboxRequests(
          Array.isArray(res.data) ? (res.data as SwapRequestItem[]) : [],
        );
        setSentRequests([]);
      } else {
        const [inboxRes, outboxRes] = await Promise.all([
          api.get("/schedules/swap-requests?view=inbox"),
          api.get("/schedules/swap-requests?view=outbox"),
        ]);

        setInboxRequests(
          Array.isArray(inboxRes.data)
            ? (inboxRes.data as SwapRequestItem[])
            : [],
        );
        setSentRequests(
          Array.isArray(outboxRes.data)
            ? (outboxRes.data as SwapRequestItem[])
            : [],
        );
      }
    } catch (loadError) {
      console.warn("Failed to fetch swap requests", loadError);
      setError("Failed to load swap requests.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadSwapRequests();
    loadStaff();
  }, [loadSwapRequests]);

  const openRespondDialog = (
    request: SwapRequestItem,
    nextDecision: "approve" | "accept" | "deny",
  ) => {
    setSelectedRequest(request);
    setDecision(nextDecision);
    setResponseNote("");
    setRespondDialogOpen(true);
  };

  const closeRespondDialog = () => {
    setRespondDialogOpen(false);
    setSelectedRequest(null);
    setResponseNote("");
  };

  const submitDecision = async () => {
    if (!selectedRequest?._id) {
      return;
    }

    try {
      setSubmittingResponse(true);
      await api.post(
        `/schedules/swap-requests/${selectedRequest._id}/respond`,
        {
          decision,
          responseNote,
        },
      );
      closeRespondDialog();
      loadSwapRequests();
    } catch (submitError: unknown) {
      const message =
        typeof submitError === "object" &&
        submitError !== null &&
        "response" in submitError &&
        typeof (submitError as { response?: { data?: { message?: string } } })
          .response?.data?.message === "string"
          ? (submitError as { response?: { data?: { message?: string } } })
              .response?.data?.message || "Failed to submit response"
          : "Failed to submit response";

      setError(message);
    } finally {
      setSubmittingResponse(false);
    }
  };

  const activeRequests = useMemo(
    () => (activeTab === "inbox" ? inboxRequests : sentRequests),
    [activeTab, inboxRequests, sentRequests],
  );

  const isPendingForAdmin = (requestItem: SwapRequestItem) => {
    return isAdmin && requestItem.status === "pending_admin";
  };

  const isPendingForReceiver = (requestItem: SwapRequestItem) => {
    if (requestItem.status !== "pending_receiver") {
      return false;
    }

    if (isAdmin) {
      return false;
    }

    return String(requestItem.receiverStaffId?._id) === String(user?._id);
  };

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Shift Swap Requests</Text>
            <Text style={styles.subtitle}>
              Manage incoming requests and track sent requests.
            </Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable style={styles.refreshBtn} onPress={loadSwapRequests}>
              <Feather name="refresh-cw" size={14} color="#374151" />
              <Text style={styles.refreshText}>Refresh</Text>
            </Pressable>

            {!isAdmin ? (
              <Pressable
                style={styles.newBtn}
                onPress={() => setRequestModalOpen(true)}
              >
                <Feather name="send" size={14} color="#ffffff" />
                <Text style={styles.newText}>New Swap Request</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.tabsWrap}>
          <Pressable
            style={[
              styles.tabBtn,
              activeTab === "inbox" ? styles.tabBtnActive : null,
            ]}
            onPress={() => setActiveTab("inbox")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "inbox" ? styles.tabTextActive : null,
              ]}
            >
              Inbox ({inboxRequests.length})
            </Text>
          </Pressable>

          {!isAdmin ? (
            <Pressable
              style={[
                styles.tabBtn,
                activeTab === "sent" ? styles.tabBtnActive : null,
              ]}
              onPress={() => setActiveTab("sent")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "sent" ? styles.tabTextActive : null,
                ]}
              >
                Sent ({sentRequests.length})
              </Text>
            </Pressable>
          ) : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {loading ? (
          <View style={styles.centerCard}>
            <ActivityIndicator size="small" color="#1d4ed8" />
          </View>
        ) : activeRequests.length === 0 ? (
          <View style={styles.centerCard}>
            <Text style={styles.emptyText}>No swap requests found.</Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {activeRequests.map((requestItem) => {
              const requester = requestItem.requesterStaffId;
              const receiver = requestItem.receiverStaffId;
              const status = requestItem.status || "pending_admin";

              return (
                <View key={requestItem._id} style={styles.requestCard}>
                  <View style={styles.requestTopRow}>
                    <View style={styles.requestBody}>
                      <Text style={styles.requestTitle}>
                        {getRoleDisplayName(requestItem.role)} |{" "}
                        {formatWindow(
                          requestItem.shiftStartTime,
                          requestItem.shiftEndTime,
                        )}
                      </Text>
                      <Text style={styles.requestMeta}>
                        Requester: {requester?.name || "Unknown"} | Receiver:{" "}
                        {receiver?.name || "Unknown"}
                      </Text>

                      {requestItem.requestNote ? (
                        <Text style={styles.requestMeta}>
                          Request note: {requestItem.requestNote}
                        </Text>
                      ) : null}

                      {requestItem.responseNote ? (
                        <Text style={styles.requestMeta}>
                          Response note: {requestItem.responseNote}
                        </Text>
                      ) : null}
                    </View>

                    <View
                      style={[
                        styles.statusPill,
                        {
                          borderColor: STATUS_COLORS[status] || "#9ca3af",
                          backgroundColor: `${STATUS_COLORS[status] || "#9ca3af"}20`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: STATUS_COLORS[status] || "#6b7280" },
                        ]}
                      >
                        {STATUS_LABELS[status] || status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {isPendingForAdmin(requestItem) ? (
                    <View style={styles.actionRow}>
                      <Pressable
                        style={[styles.actionBtn, styles.acceptBtn]}
                        onPress={() =>
                          openRespondDialog(requestItem, "approve")
                        }
                      >
                        <Feather name="check" size={14} color="#ffffff" />
                        <Text style={styles.actionText}>Approve</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.actionBtn, styles.denyBtn]}
                        onPress={() => openRespondDialog(requestItem, "deny")}
                      >
                        <Feather name="x" size={14} color="#ffffff" />
                        <Text style={styles.actionText}>Deny</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {isPendingForReceiver(requestItem) ? (
                    <View style={styles.actionRow}>
                      <Pressable
                        style={[styles.actionBtn, styles.acceptBtn]}
                        onPress={() => openRespondDialog(requestItem, "accept")}
                      >
                        <Feather name="check" size={14} color="#ffffff" />
                        <Text style={styles.actionText}>Accept</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.actionBtn, styles.denyBtn]}
                        onPress={() => openRespondDialog(requestItem, "deny")}
                      >
                        <Feather name="x" size={14} color="#ffffff" />
                        <Text style={styles.actionText}>Deny</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <ShiftSwapRequestModal
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        onSuccess={loadSwapRequests}
        enableSchedulePicker
        staffList={staffList}
      />

      <Modal
        visible={respondDialogOpen}
        transparent
        animationType="fade"
        onRequestClose={submittingResponse ? undefined : closeRespondDialog}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={submittingResponse ? undefined : closeRespondDialog}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {decision === "approve"
                ? "Approve Swap Request"
                : decision === "accept"
                  ? "Accept Swap Request"
                  : "Deny Swap Request"}
            </Text>

            <TextInput
              multiline
              numberOfLines={3}
              value={responseNote}
              onChangeText={setResponseNote}
              placeholder="Response note (optional)"
              style={styles.modalInput}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={closeRespondDialog}
                disabled={submittingResponse}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalBtn,
                  decision === "accept"
                    ? styles.modalAcceptBtn
                    : styles.modalDenyBtn,
                ]}
                onPress={submitDecision}
                disabled={submittingResponse}
              >
                {submittingResponse ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitText}>
                    {decision === "approve"
                      ? "Approve"
                      : decision === "accept"
                        ? "Accept"
                        : "Deny"}
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
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
    gap: 10,
  },
  title: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  refreshBtn: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  refreshText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  newBtn: {
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: "#111827",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  newText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  tabsWrap: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    overflow: "hidden",
  },
  tabBtn: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9fafb",
  },
  tabBtnActive: {
    backgroundColor: "#dbeafe",
  },
  tabText: {
    color: "#6b7280",
    fontWeight: "700",
    fontSize: 12,
  },
  tabTextActive: {
    color: "#1d4ed8",
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
  centerCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 13,
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
    gap: 10,
  },
  requestTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  requestBody: {
    flex: 1,
    gap: 4,
  },
  requestTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
  },
  requestMeta: {
    color: "#6b7280",
    fontSize: 12,
    lineHeight: 18,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    minHeight: 36,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  acceptBtn: {
    backgroundColor: "#15803d",
  },
  denyBtn: {
    backgroundColor: "#dc2626",
  },
  actionText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
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
    gap: 10,
  },
  modalTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: "#111827",
    backgroundColor: "#ffffff",
    minHeight: 90,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
  },
  modalBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
  },
  modalAcceptBtn: {
    backgroundColor: "#15803d",
  },
  modalDenyBtn: {
    backgroundColor: "#dc2626",
  },
  modalCancelText: {
    color: "#111827",
    fontWeight: "700",
  },
  modalSubmitText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
