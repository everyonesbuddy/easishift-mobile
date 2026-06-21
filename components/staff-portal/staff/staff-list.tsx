import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
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

import ConfirmDialog from "@/components/shared/confirm-dialog";
import api from "@/config/api";
import {
  getCertificationTagDisplayName,
  getRoleColor,
  getRoleDisplayName,
  getRoleOptionsFromFacilityPreferences,
  getRolesForIndustry,
  getUnitAreaDisplayName,
} from "@/constants/industry-roles";
import { useAuth } from "@/context/auth-context";

import BulkStaffModal from "./bulk-staff-modal";
import StaffCreateAndEditForm from "./staff-create-and-edit-form";
import {
  StaffMember,
  getInitials,
  getPhoneText,
  getStaffId,
} from "./staff-shared";

const ROWS_PER_PAGE = 10;

export default function StaffListPage() {
  const { role, tenant } = useAuth();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [page, setPage] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [facilityPreferences, setFacilityPreferences] = useState<{
    roleFamilies?: unknown[];
  } | null>(null);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/auth/users");
      setStaff(Array.isArray(res.data) ? (res.data as StaffMember[]) : []);
      setError("");
    } catch (requestError) {
      console.warn("Failed to fetch staff", requestError);
      setError("Failed to load staff.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

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
    setPage(0);
  }, [staff, searchTerm, filterRole]);

  const handleOpenEdit = (staffUser: StaffMember) => {
    setEditingStaff(staffUser);
    setOpen(true);
  };

  const handleAskDelete = (id: string) => {
    setDeleteId(id);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) {
      return;
    }

    try {
      await api.delete(`/auth/${deleteId}`);
      await fetchStaff();
    } catch (requestError) {
      console.warn("Failed to delete staff", requestError);
      setError("Failed to delete staff member.");
    } finally {
      setConfirmOpen(false);
      setDeleteId(null);
    }
  };

  const handleModalClose = (refresh = false) => {
    setOpen(false);
    setEditingStaff(null);
    if (refresh) {
      fetchStaff();
    }
  };

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return staff.filter((member) => {
      const matchesSearch =
        !term ||
        member.name?.toLowerCase().includes(term) ||
        member.email?.toLowerCase().includes(term);

      const matchesRole = filterRole === "all" || member.role === filterRole;

      return Boolean(matchesSearch && matchesRole);
    });
  }, [staff, searchTerm, filterRole]);

  const roles = useMemo(() => {
    const facilityRoleValues = getRoleOptionsFromFacilityPreferences(
      facilityPreferences,
      { includeAdmin: true },
    ).map((option) => option.value);

    const industryRoles = facilityRoleValues.length
      ? facilityRoleValues
      : getRolesForIndustry(tenant?.industry, {
          includeAdmin: true,
        });
    const existingRoles = staff
      .map((member) => member.role)
      .filter((roleValue): roleValue is string => Boolean(roleValue));

    const normalizedRoles = Array.from(
      new Set([...industryRoles, ...existingRoles]),
    ).filter(
      (roleValue): roleValue is string =>
        typeof roleValue === "string" && roleValue.length > 0,
    );

    return ["all", ...normalizedRoles];
  }, [facilityPreferences, staff, tenant?.industry]);

  const formatStringArray = (
    values: unknown,
    formatter?: (v: unknown) => string,
  ) => {
    if (!Array.isArray(values)) {
      return "-";
    }

    const normalized = values
      .map((value) => {
        const str = String(value || "").trim();
        if (!str) return "";
        return formatter ? formatter(str) : str;
      })
      .filter(Boolean);

    return normalized.length ? normalized.join(", ") : "-";
  };

  const pageCount = Math.max(
    1,
    Math.ceil(filteredUsers.length / ROWS_PER_PAGE),
  );
  const paginated = filteredUsers.slice(
    page * ROWS_PER_PAGE,
    page * ROWS_PER_PAGE + ROWS_PER_PAGE,
  );

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Staff Management</Text>
            <Text style={styles.subtitle}>Manage your healthcare team</Text>
          </View>

          {role === "admin" ? (
            <View style={styles.headerActions}>
              <Pressable
                style={styles.bulkBtn}
                onPress={() => setBulkOpen(true)}
              >
                <Text style={styles.bulkBtnText}>Bulk Add Staff</Text>
              </Pressable>
              <Pressable
                style={styles.addBtn}
                onPress={() => {
                  setEditingStaff(null);
                  setOpen(true);
                }}
              >
                <Feather name="users" size={14} color="#ffffff" />
                <Text style={styles.addBtnText}>Add Staff Member</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.filterCard}>
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Search</Text>
            <View style={styles.searchWrap}>
              <Feather name="search" size={16} color="#9ca3af" />
              <TextInput
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Search by name or email..."
                style={styles.searchInput}
              />
            </View>
          </View>

          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Role</Text>
            <Pressable
              style={styles.selectBtn}
              onPress={() => setRolePickerOpen(true)}
            >
              <Text style={styles.selectText}>
                {filterRole === "all"
                  ? "All Roles"
                  : getRoleDisplayName(filterRole)}
              </Text>
              <Feather name="chevron-down" size={16} color="#6b7280" />
            </Pressable>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {loading ? (
          <View style={styles.centerCard}>
            <ActivityIndicator size="small" color="#2563eb" />
          </View>
        ) : paginated.length === 0 ? (
          <View style={styles.centerCard}>
            <Text style={styles.emptyText}>No staff members found</Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {paginated.map((member) => {
              const id = getStaffId(member);
              const disabledDelete = member.role === "admin";

              return (
                <View key={id} style={styles.staffCard}>
                  <View style={styles.staffTop}>
                    <View
                      style={[
                        styles.avatar,
                        {
                          backgroundColor:
                            getRoleColor(member.role) || "#6b7280",
                        },
                      ]}
                    >
                      {typeof member.profilePicture === "string" &&
                      member.profilePicture ? (
                        <Image
                          source={{ uri: member.profilePicture }}
                          style={styles.avatarImage}
                          contentFit="cover"
                        />
                      ) : (
                        <Text style={styles.avatarText}>
                          {getInitials(member.name)}
                        </Text>
                      )}
                    </View>

                    <View style={styles.staffBody}>
                      <Text style={styles.staffName}>
                        {member.name || "Unknown"}
                      </Text>
                      <View style={styles.roleRow}>
                        <View
                          style={[
                            styles.roleDot,
                            {
                              backgroundColor:
                                getRoleColor(member.role) || "#6b7280",
                            },
                          ]}
                        />
                        <Text style={styles.staffRole}>
                          {getRoleDisplayName(member.role)}
                        </Text>
                      </View>
                      <Text style={styles.staffMeta}>
                        {member.email || "No email"}
                      </Text>
                      <Text style={styles.staffMeta}>
                        {getPhoneText(member)}
                      </Text>
                      <Text style={styles.staffMeta}>
                        Areas:{" "}
                        {formatStringArray(
                          member.allowedAreas,
                          getUnitAreaDisplayName,
                        )}
                      </Text>
                      <Text style={styles.staffMeta}>
                        Certs:{" "}
                        {formatStringArray(
                          member.certificationTags,
                          getCertificationTagDisplayName,
                        )}
                      </Text>
                    </View>
                  </View>

                  {role === "admin" ? (
                    <View style={styles.cardActions}>
                      <Pressable
                        style={styles.editBtn}
                        onPress={() => handleOpenEdit(member)}
                      >
                        <Feather name="edit-2" size={13} color="#0c4a6e" />
                        <Text style={styles.editBtnText}>Edit</Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.deleteBtn,
                          disabledDelete ? styles.deleteBtnDisabled : null,
                        ]}
                        disabled={disabledDelete}
                        onPress={() => handleAskDelete(id)}
                      >
                        <Feather name="trash-2" size={13} color="#ffffff" />
                        <Text style={styles.deleteBtnText}>Delete</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.paginationRow}>
          <Pressable
            style={[styles.pageBtn, page <= 0 ? styles.pageBtnDisabled : null]}
            disabled={page <= 0}
            onPress={() => setPage((prev) => Math.max(0, prev - 1))}
          >
            <Text style={styles.pageBtnText}>Prev</Text>
          </Pressable>
          <Text style={styles.pageText}>
            Page {page + 1} of {pageCount}
          </Text>
          <Pressable
            style={[
              styles.pageBtn,
              page + 1 >= pageCount ? styles.pageBtnDisabled : null,
            ]}
            disabled={page + 1 >= pageCount}
            onPress={() => setPage((prev) => Math.min(pageCount - 1, prev + 1))}
          >
            <Text style={styles.pageBtnText}>Next</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => handleModalClose()}
      >
        <SafeAreaView style={styles.modalPage}>
          <StaffCreateAndEditForm
            staff={editingStaff}
            staffList={staff}
            onClose={() => handleModalClose()}
            onSuccess={() => handleModalClose(true)}
          />
        </SafeAreaView>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete Staff Member?"
        message="This action cannot be undone."
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
      />

      <BulkStaffModal
        open={bulkOpen}
        staffList={staff}
        onClose={() => setBulkOpen(false)}
        onSuccess={fetchStaff}
      />

      <PickerModal
        open={rolePickerOpen}
        title="Filter by Role"
        value={filterRole}
        onClose={() => setRolePickerOpen(false)}
        onSelect={setFilterRole}
        options={roles.map((roleOption) => ({
          value: roleOption,
          label:
            roleOption === "all" ? "All Roles" : getRoleDisplayName(roleOption),
        }))}
      />
    </SafeAreaView>
  );
}

function PickerModal({
  open,
  title,
  value,
  onClose,
  onSelect,
  options,
}: {
  open: boolean;
  title: string;
  value: string;
  onClose: () => void;
  onSelect: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.pickerBackdrop} onPress={onClose}>
        <Pressable style={styles.pickerCard} onPress={() => {}}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={18} color="#6b7280" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.pickerList}>
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  style={[
                    styles.pickerItem,
                    selected ? styles.pickerItemActive : null,
                  ]}
                  onPress={() => {
                    onSelect(option.value);
                    onClose();
                  }}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      selected ? styles.pickerItemTextActive : null,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {selected ? (
                    <Feather name="check" size={16} color="#2563eb" />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
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
    flexWrap: "wrap",
    gap: 8,
  },
  bulkBtn: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  bulkBtnText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
  },
  addBtn: {
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  filterCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 10,
    gap: 10,
  },
  fieldWrap: {
    gap: 6,
  },
  label: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  searchWrap: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: "#111827",
    fontSize: 13,
  },
  selectBtn: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: {
    color: "#111827",
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
  staffCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 10,
  },
  staffTop: {
    flexDirection: "row",
    gap: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
  },
  staffBody: {
    flex: 1,
    gap: 3,
  },
  staffName: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  roleDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  staffRole: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
  },
  staffMeta: {
    color: "#6b7280",
    fontSize: 12,
    lineHeight: 17,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
  },
  editBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bae6fd",
    backgroundColor: "#f0f9ff",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  editBtnText: {
    color: "#0c4a6e",
    fontSize: 12,
    fontWeight: "700",
  },
  deleteBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  deleteBtnDisabled: {
    opacity: 0.45,
  },
  deleteBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  pageBtn: {
    minHeight: 34,
    minWidth: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  pageBtnDisabled: {
    opacity: 0.5,
  },
  pageBtnText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  pageText: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
  },
  modalPage: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 14,
    paddingTop: 28,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 20,
  },
  pickerCard: {
    maxHeight: "70%",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    gap: 8,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeBtn: {
    padding: 8,
    marginRight: 2,
  },
  pickerTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  pickerList: {
    gap: 6,
  },
  pickerItem: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerItemActive: {
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
  },
  pickerItemText: {
    color: "#111827",
    fontSize: 13,
  },
  pickerItemTextActive: {
    color: "#1d4ed8",
    fontWeight: "700",
  },
});
