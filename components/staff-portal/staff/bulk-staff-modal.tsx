import { Feather } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import api from "@/config/api";
import { useAuth } from "@/context/auth-context";

import { MAX_ROWS, SAMPLE_CSV, StaffMember, statusLabel } from "./staff-shared";

type BulkRow = {
  rowNumber?: number;
  email?: string;
  status?: string;
  reason?: string;
  warning?: string;
  message?: string;
  userId?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  staffList?: StaffMember[];
};

export default function BulkStaffModal({
  open,
  onClose,
  onSuccess,
  staffList = [],
}: Props) {
  const { tenant } = useAuth();

  const [csvInput, setCsvInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{
    total: number;
    created: number;
    skipped: number;
    failed: number;
  } | null>(null);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");

  const rowsToRender = useMemo(() => rows || [], [rows]);

  const resetState = () => {
    setSummary(null);
    setRows([]);
    setWarning("");
    setError("");
  };

  const handleClose = () => {
    setLoading(false);
    setCsvInput("");
    resetState();
    onClose();
  };

  const handleUseSample = () => {
    setCsvInput(SAMPLE_CSV);
  };

  const handleSubmit = async () => {
    setLoading(true);
    resetState();

    try {
      const trimmed = csvInput.trim();
      if (!trimmed) {
        throw new Error("Paste CSV content before importing staff");
      }

      const seatLimit = Number(tenant?.seatLimit);
      const hasSeatLimit = Number.isFinite(seatLimit) && seatLimit > 0;

      if (hasSeatLimit) {
        const existingStaffCount = Array.isArray(staffList)
          ? staffList.length
          : 0;
        const lines = trimmed
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        const incomingStaffCount = Math.max(lines.length - 1, 0);

        if (incomingStaffCount <= 0) {
          throw new Error("CSV must include at least one data row");
        }

        const availableSeats = Math.max(seatLimit - existingStaffCount, 0);

        if (existingStaffCount >= seatLimit) {
          throw new Error(
            `Staff seat limit reached (${existingStaffCount}/${seatLimit}). Upgrade your plan to add more staff.`,
          );
        }

        if (incomingStaffCount > availableSeats) {
          throw new Error(
            `Import exceeds seat limit. You can add up to ${availableSeats} more staff but CSV contains ${incomingStaffCount} row(s).`,
          );
        }
      }

      const res = await api.post("/auth/signup/staff/bulk", { csv: trimmed });
      const data = res?.data || {};

      const nextSummary = {
        total: Number(data?.total ?? 0),
        created: Number(data?.created ?? 0),
        skipped: Number(data?.skipped ?? 0),
        failed: Number(data?.failed ?? 0),
      };

      setSummary(nextSummary);
      setRows(Array.isArray(data?.rows) ? (data.rows as BulkRow[]) : []);
      setWarning(typeof data?.warning === "string" ? data.warning : "");

      if (nextSummary.created > 0) {
        onSuccess?.();
      }
    } catch (requestError: unknown) {
      const message =
        typeof requestError === "object" &&
        requestError !== null &&
        "response" in requestError &&
        typeof (requestError as { response?: { data?: { message?: string } } })
          .response?.data?.message === "string"
          ? (requestError as { response?: { data?: { message?: string } } })
              .response?.data?.message ||
            "We could not complete the staff import"
          : requestError instanceof Error
            ? requestError.message
            : "We could not complete the staff import";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={open} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.page}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>Import Staff in Bulk</Text>
              <Text style={styles.subtitle}>
                Paste CSV content below. Required columns: name, email, role.
              </Text>
            </View>
            <Pressable onPress={handleClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color="#6b7280" />
            </Pressable>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Optional columns are userPhone and userPhoneCountryCode. Maximum{" "}
              {MAX_ROWS} rows per import.
            </Text>
          </View>

          <View style={styles.inlineActions}>
            <Pressable style={styles.sampleBtn} onPress={handleUseSample}>
              <Text style={styles.sampleBtnText}>Use Sample Template</Text>
            </Pressable>
            <Pressable style={styles.clearBtn} onPress={() => setCsvInput("")}>
              <Text style={styles.clearBtnText}>Clear</Text>
            </Pressable>
          </View>

          <View style={styles.fieldWrap}>
            <Text style={styles.label}>CSV Content</Text>
            <TextInput
              multiline
              value={csvInput}
              onChangeText={setCsvInput}
              placeholder={SAMPLE_CSV}
              style={styles.textArea}
              textAlignVertical="top"
            />
            <Text style={styles.helperText}>
              File upload is not wired in mobile yet, so paste CSV content
              directly here.
            </Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {warning ? <Text style={styles.warning}>{warning}</Text> : null}

          {summary ? (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryItem}>Total: {summary.total}</Text>
                <Text style={styles.summaryItem}>
                  Created: {summary.created}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryItem}>
                  Skipped: {summary.skipped}
                </Text>
                <Text style={styles.summaryItem}>Failed: {summary.failed}</Text>
              </View>
            </View>
          ) : null}

          {rowsToRender.length > 0 ? (
            <View style={styles.resultsWrap}>
              {rowsToRender.map((row, index) => (
                <View
                  key={`${row.email || "row"}-${index}`}
                  style={styles.resultCard}
                >
                  <Text style={styles.resultTitle}>
                    Row {row.rowNumber ?? index + 1} - {row.email || "-"}
                  </Text>
                  <Text style={styles.resultMeta}>
                    Status: {statusLabel(row.status)}
                  </Text>
                  <Text style={styles.resultMeta}>
                    Details: {row.reason || row.warning || row.message || "-"}
                  </Text>
                  <Text style={styles.resultMeta}>
                    User ID: {row.userId || "-"}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.footerBtn, styles.cancelBtn]}
            onPress={handleClose}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[
              styles.footerBtn,
              styles.submitBtn,
              loading ? styles.submitDisabled : null,
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitText}>
              {loading ? "Importing Staff..." : "Import Staff"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    padding: 16,
    paddingTop: 40,
    paddingBottom: 96,
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
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 2,
  },
  infoCard: {
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    padding: 10,
  },
  infoText: {
    color: "#1e40af",
    fontSize: 13,
    lineHeight: 18,
  },
  inlineActions: {
    flexDirection: "row",
    gap: 8,
  },
  sampleBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sampleBtnText: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 12,
  },
  clearBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  clearBtnText: {
    color: "#374151",
    fontWeight: "700",
    fontSize: 12,
  },
  fieldWrap: {
    gap: 6,
  },
  label: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  textArea: {
    minHeight: 180,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  helperText: {
    color: "#6b7280",
    fontSize: 12,
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
  warning: {
    color: "#92400e",
    backgroundColor: "#fffbeb",
    borderColor: "#fcd34d",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 6,
  },
  summaryTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 16,
    flexWrap: "wrap",
  },
  summaryItem: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
  },
  resultsWrap: {
    gap: 8,
  },
  resultCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 10,
    gap: 4,
  },
  resultTitle: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "800",
  },
  resultMeta: {
    color: "#6b7280",
    fontSize: 12,
    lineHeight: 17,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    padding: 12,
    flexDirection: "row",
    gap: 8,
  },
  footerBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
  },
  submitBtn: {
    backgroundColor: "#2563eb",
  },
  submitDisabled: {
    opacity: 0.65,
  },
  cancelText: {
    color: "#111827",
    fontWeight: "700",
  },
  submitText: {
    color: "#ffffff",
    fontWeight: "800",
  },
});
