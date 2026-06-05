import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import api from "@/config/api";
import {
  getRoleDisplayName,
  getRoleOptionsForIndustry,
  getRoleOptionsFromFacilityPreferences,
} from "@/constants/industry-roles";
import { useAuth } from "@/context/auth-context";

import { PHONE_COUNTRY_CODES, StaffMember } from "./staff-shared";

type Props = {
  staff: StaffMember | null;
  onSuccess: () => void;
  onClose: () => void;
  staffList?: StaffMember[];
};

type FormState = {
  name: string;
  email: string;
  phoneCountryCode: string;
  phone: string;
  allowedAreas: string[];
  allowedShiftTags: string[];
  allowedShiftTypes: string[];
  certificationTags: string[];
  role: string;
};

type ShiftSlot = {
  tag?: unknown;
  label?: unknown;
  startLocalTime?: unknown;
  endLocalTime?: unknown;
};

type ShiftTypeDefinition = {
  key?: unknown;
  label?: unknown;
  timeSlots?: ShiftSlot[];
};

type FacilityPreferences = {
  roleFamilies?: unknown[];
  unitAreas?: unknown[];
  certificationTags?: unknown[];
  shiftTypeDefinitions?: ShiftTypeDefinition[];
};

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeStringArray(values: unknown) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

function normalizeToken(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function toDisplayLabel(value: unknown) {
  const normalized = String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (!normalized) {
    return "";
  }

  return normalized
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildTimeSlotLabel(slot: ShiftSlot) {
  const tag = normalizeToken(slot?.tag);
  const label = String(slot?.label || "").trim();
  const start = String(slot?.startLocalTime || "").trim();
  const end = String(slot?.endLocalTime || "").trim();
  const displayName = label || toDisplayLabel(tag);

  if (start && end) {
    return `${displayName} (${start}-${end})`;
  }

  return displayName;
}

export default function StaffCreateAndEditForm({
  staff,
  onSuccess,
  onClose,
  staffList = [],
}: Props) {
  const { user, role: loggedInRole, tenant } = useAuth();
  const canAssignAdminRole = loggedInRole === "admin";

  const [facilityPreferences, setFacilityPreferences] =
    useState<FacilityPreferences | null>(null);
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phoneCountryCode: "",
    phone: "",
    allowedAreas: [],
    allowedShiftTags: [],
    allowedShiftTypes: [],
    certificationTags: [],
    role: "",
  });
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [codePickerOpen, setCodePickerOpen] = useState(false);

  const [areaPickerOpen, setAreaPickerOpen] = useState(false);
  const [shiftSlotPickerOpen, setShiftSlotPickerOpen] = useState(false);
  const [certPickerOpen, setCertPickerOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadFacilityPreferences() {
      try {
        const res = await api.get("/facility-preferences");
        if (!mounted) {
          return;
        }

        setFacilityPreferences(
          (res.data || null) as FacilityPreferences | null,
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

  const facilityRoleOptions = useMemo(
    () => getRoleOptionsFromFacilityPreferences(facilityPreferences),
    [facilityPreferences],
  );

  const roleOptions = useMemo(() => {
    if (facilityRoleOptions.length > 0) {
      return facilityRoleOptions;
    }

    return getRoleOptionsForIndustry(tenant?.industry);
  }, [facilityRoleOptions, tenant?.industry]);

  const selectableRoleOptions = useMemo(() => {
    const options = canAssignAdminRole
      ? [...roleOptions, { value: "admin", label: getRoleDisplayName("admin") }]
      : roleOptions;

    const dedupedOptions = Array.from(
      new Map(options.map((item) => [item.value, item])).values(),
    );

    if (
      !staff?.role ||
      dedupedOptions.some((item) => item.value === staff.role)
    ) {
      return dedupedOptions;
    }

    return [
      ...dedupedOptions,
      { value: staff.role, label: getRoleDisplayName(staff.role) },
    ];
  }, [canAssignAdminRole, roleOptions, staff?.role]);

  const allowedAreaOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...(normalizeStringArray(facilityPreferences?.unitAreas) || []),
          ...(Array.isArray(form.allowedAreas) ? form.allowedAreas : []),
        ]),
      ),
    [facilityPreferences?.unitAreas, form.allowedAreas],
  );

  const certificationTagOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...(normalizeStringArray(facilityPreferences?.certificationTags) ||
            []),
          ...(Array.isArray(form.certificationTags)
            ? form.certificationTags
            : []),
        ]),
      ),
    [facilityPreferences?.certificationTags, form.certificationTags],
  );

  const shiftSlotOptions = useMemo(() => {
    const optionsByTag = new Map<
      string,
      {
        value: string;
        label: string;
        shiftType: string;
        shiftTypeLabel: string;
      }
    >();

    (facilityPreferences?.shiftTypeDefinitions || []).forEach((definition) => {
      const shiftType = normalizeToken(definition?.key);
      if (!shiftType) {
        return;
      }

      const shiftTypeLabel =
        String(definition?.label || "").trim() || toDisplayLabel(shiftType);

      const slots = Array.isArray(definition?.timeSlots)
        ? definition.timeSlots
        : [];

      slots.forEach((slot) => {
        const tag = normalizeToken(slot?.tag);
        if (!tag) {
          return;
        }

        optionsByTag.set(tag, {
          value: tag,
          label: buildTimeSlotLabel(slot),
          shiftType,
          shiftTypeLabel,
        });
      });
    });

    (Array.isArray(form.allowedShiftTags) ? form.allowedShiftTags : []).forEach(
      (rawTag) => {
        const tag = normalizeToken(rawTag);
        if (!tag || optionsByTag.has(tag)) {
          return;
        }

        optionsByTag.set(tag, {
          value: tag,
          label: toDisplayLabel(tag),
          shiftType: "",
          shiftTypeLabel: "",
        });
      },
    );

    return Array.from(optionsByTag.values());
  }, [facilityPreferences?.shiftTypeDefinitions, form.allowedShiftTags]);

  const shiftSlotTypeLookup = useMemo(() => {
    const lookup = new Map<string, string>();

    shiftSlotOptions.forEach((option) => {
      lookup.set(option.value, option.shiftType);
    });

    return lookup;
  }, [shiftSlotOptions]);

  const areaLabelLookup = useMemo(
    () =>
      new Map(
        allowedAreaOptions.map((value) => [value, toDisplayLabel(value)]),
      ),
    [allowedAreaOptions],
  );

  const certificationLabelLookup = useMemo(
    () =>
      new Map(
        certificationTagOptions.map((value) => [value, toDisplayLabel(value)]),
      ),
    [certificationTagOptions],
  );

  const shiftSlotLabelLookup = useMemo(() => {
    const lookup = new Map<string, string>();

    shiftSlotOptions.forEach((option) => {
      lookup.set(
        option.value,
        option.shiftTypeLabel
          ? `${option.shiftTypeLabel} - ${option.label}`
          : option.label,
      );
    });

    return lookup;
  }, [shiftSlotOptions]);

  const isEditingSelf = Boolean(staff && staff._id === user?._id);
  const disableRoleChange = isEditingSelf && loggedInRole === "admin";

  useEffect(() => {
    if (!staff) {
      return;
    }

    setForm({
      name: staff.name || "",
      email: staff.email || "",
      phoneCountryCode:
        staff.userPhoneCountryCode || staff.phoneCountryCode || "",
      phone: staff.userPhone || staff.phone || "",
      allowedAreas: normalizeStringArray(staff.allowedAreas),
      allowedShiftTags:
        normalizeStringArray(staff.allowedShiftTags).length > 0
          ? normalizeStringArray(staff.allowedShiftTags)
          : normalizeStringArray(staff.allowedShiftTypes)
              .map((value) => {
                const colonIndex = value.indexOf(":");
                return colonIndex !== -1 ? value.slice(colonIndex + 1) : value;
              })
              .filter(Boolean),
      allowedShiftTypes: normalizeStringArray(staff.allowedShiftTypes),
      certificationTags: normalizeStringArray(staff.certificationTags),
      role: staff.role || "doctor",
    });
  }, [staff]);

  useEffect(() => {
    if (staff) {
      return;
    }

    setForm((prev) => {
      if (!roleOptions.length) {
        if (prev.role) {
          return prev;
        }

        return { ...prev, role: "staff" };
      }

      if (prev.role && roleOptions.some((item) => item.value === prev.role)) {
        return prev;
      }

      return { ...prev, role: roleOptions[0].value };
    });
  }, [roleOptions, staff]);

  const handleSubmit = async () => {
    setEmailError("");
    setPhoneError("");
    setError("");

    const normalizedPhone = form.phone.trim();
    const normalizedPhoneCountryCode = form.phoneCountryCode.trim();

    if (!validateEmail(form.email)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    if (
      (normalizedPhone && !normalizedPhoneCountryCode) ||
      (!normalizedPhone && normalizedPhoneCountryCode)
    ) {
      setPhoneError("Please provide both country code and phone number");
      return;
    }

    setLoading(true);

    try {
      const normalizedShiftTags = normalizeStringArray(
        form.allowedShiftTags,
      ).map((value) => normalizeToken(value));

      const slotSpecificShiftValues = Array.from(
        new Set(
          normalizedShiftTags.map((tag) => {
            const shiftType = shiftSlotTypeLookup.get(tag);
            return shiftType ? `${shiftType}:${tag}` : tag;
          }),
        ),
      );

      const normalizedShiftTypes = slotSpecificShiftValues.length
        ? slotSpecificShiftValues
        : normalizeStringArray(form.allowedShiftTypes).map((value) =>
            normalizeToken(value),
          );

      if (staff?._id) {
        const payload: Record<string, unknown> = {
          name: form.name,
          email: form.email,
          role: disableRoleChange ? staff.role || form.role : form.role,
          allowedAreas: normalizeStringArray(form.allowedAreas),
          allowedShiftTags: normalizedShiftTags,
          allowedShiftTypes: normalizedShiftTypes,
          certificationTags: normalizeStringArray(form.certificationTags),
        };

        if (normalizedPhone && normalizedPhoneCountryCode) {
          payload.userPhoneCountryCode = normalizedPhoneCountryCode;
          payload.userPhone = normalizedPhone;
          payload.phoneCountryCode = normalizedPhoneCountryCode;
          payload.phone = normalizedPhone;
        }

        await api.put(`/auth/${staff._id}`, payload);
      } else {
        const seatLimit = Number(tenant?.seatLimit);
        const hasSeatLimit = Number.isFinite(seatLimit) && seatLimit > 0;
        const existingStaffCount = Array.isArray(staffList)
          ? staffList.length
          : 0;

        if (hasSeatLimit && existingStaffCount >= seatLimit) {
          setError(
            `Staff seat limit reached (${existingStaffCount}/${seatLimit}). Upgrade your plan to add more staff.`,
          );
          setLoading(false);
          return;
        }

        await api.post("/auth/signup/staff", {
          name: form.name,
          email: form.email,
          role: form.role,
          allowedAreas: normalizeStringArray(form.allowedAreas),
          allowedShiftTags: normalizedShiftTags,
          allowedShiftTypes: normalizedShiftTypes,
          certificationTags: normalizeStringArray(form.certificationTags),
          ...(normalizedPhone && normalizedPhoneCountryCode
            ? {
                userPhoneCountryCode: normalizedPhoneCountryCode,
                userPhone: normalizedPhone,
                phoneCountryCode: normalizedPhoneCountryCode,
                phone: normalizedPhone,
              }
            : {}),
        });
      }

      onSuccess();
    } catch (requestError: unknown) {
      const message =
        typeof requestError === "object" &&
        requestError !== null &&
        "response" in requestError &&
        typeof (requestError as { response?: { data?: { message?: string } } })
          .response?.data?.message === "string"
          ? (requestError as { response?: { data?: { message?: string } } })
              .response?.data?.message || "Failed to save staff"
          : "Failed to save staff";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>
            {staff ? "Edit Staff Member" : "Add Staff Member"}
          </Text>
          <Text style={styles.subtitle}>
            Create and manage healthcare team member accounts.
          </Text>
        </View>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Feather name="x" size={20} color="#6b7280" />
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          value={form.name}
          onChangeText={(value) =>
            setForm((prev) => ({ ...prev, name: value }))
          }
          style={styles.input}
          placeholder="Full name"
        />
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          value={form.email}
          onChangeText={(value) => {
            setForm((prev) => ({ ...prev, email: value }));
            setEmailError("");
          }}
          style={styles.input}
          placeholder="Email address"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {emailError ? (
          <Text style={styles.fieldError}>{emailError}</Text>
        ) : null}
      </View>

      <View style={styles.row}>
        <View style={[styles.fieldWrap, styles.rowField]}>
          <Text style={styles.label}>Country Code</Text>
          <Pressable
            style={styles.selectBtn}
            onPress={() => setCodePickerOpen(true)}
          >
            <Text style={styles.selectText}>
              {form.phoneCountryCode || "Select code"}
            </Text>
            <Feather name="chevron-down" size={16} color="#6b7280" />
          </Pressable>
        </View>

        <View style={[styles.fieldWrap, styles.rowField]}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            value={form.phone}
            onChangeText={(value) => {
              setForm((prev) => ({ ...prev, phone: value }));
              setPhoneError("");
            }}
            style={styles.input}
            placeholder="Phone number"
            keyboardType="phone-pad"
          />
        </View>
      </View>
      {phoneError ? <Text style={styles.fieldError}>{phoneError}</Text> : null}

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Role</Text>
        <Pressable
          style={[
            styles.selectBtn,
            disableRoleChange ? styles.selectDisabled : null,
          ]}
          onPress={() => {
            if (!disableRoleChange) {
              setRolePickerOpen(true);
            }
          }}
        >
          <Text style={styles.selectText}>{getRoleDisplayName(form.role)}</Text>
          <Feather name="chevron-down" size={16} color="#6b7280" />
        </Pressable>
      </View>

      {allowedAreaOptions.length > 0 ? (
        <MultiChipSelector
          label="Allowed Unit Areas"
          helperText="Tap chips to select or remove unit areas"
          options={allowedAreaOptions}
          values={form.allowedAreas}
          onChange={(values) =>
            setForm((prev) => ({ ...prev, allowedAreas: values }))
          }
          getOptionValue={(option) => option}
          getOptionLabel={(option) =>
            areaLabelLookup.get(option) || toDisplayLabel(option)
          }
          onOpenPicker={() => setAreaPickerOpen(true)}
        />
      ) : null}

      <MultiChipSelector
        label="Allowed Shift Time Slots"
        helperText={
          shiftSlotOptions.length > 0
            ? "Select exact slots, e.g. Day - Day 1 or Day - Day 2"
            : "No shift definitions configured yet. Configure shift slots in Facility Preferences."
        }
        options={shiftSlotOptions}
        values={form.allowedShiftTags}
        onChange={(values) =>
          setForm((prev) => ({ ...prev, allowedShiftTags: values }))
        }
        getOptionValue={(option) => option.value}
        getOptionLabel={(option) =>
          shiftSlotLabelLookup.get(option.value) || option.label
        }
        onOpenPicker={() => setShiftSlotPickerOpen(true)}
      />

      <MultiChipSelector
        label="Certification Tags"
        helperText={
          certificationTagOptions.length > 0
            ? "Tap chips to select or remove certifications"
            : "No certification tags configured yet."
        }
        options={certificationTagOptions}
        values={form.certificationTags}
        onChange={(values) =>
          setForm((prev) => ({ ...prev, certificationTags: values }))
        }
        getOptionValue={(option) => option}
        getOptionLabel={(option) =>
          certificationLabelLookup.get(option) || toDisplayLabel(option)
        }
        onOpenPicker={() => setCertPickerOpen(true)}
      />

      <View style={styles.actions}>
        <Pressable
          style={[styles.actionBtn, styles.cancelBtn]}
          onPress={onClose}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[
            styles.actionBtn,
            styles.submitBtn,
            loading ? styles.submitDisabled : null,
          ]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitText}>
            {loading ? "Saving..." : staff ? "Save Changes" : "Create Staff"}
          </Text>
        </Pressable>
      </View>

      <PickerModal
        open={rolePickerOpen}
        title="Select Role"
        value={form.role}
        onClose={() => setRolePickerOpen(false)}
        onSelect={(value) => setForm((prev) => ({ ...prev, role: value }))}
        options={selectableRoleOptions}
      />

      <PickerModal
        open={codePickerOpen}
        title="Select Country Code"
        value={form.phoneCountryCode}
        onClose={() => setCodePickerOpen(false)}
        onSelect={(value) => {
          setForm((prev) => ({ ...prev, phoneCountryCode: value }));
          setPhoneError("");
        }}
        options={PHONE_COUNTRY_CODES.map((item) => ({
          value: item.code,
          label: item.label,
        }))}
      />

      <MultiSelectPickerModal
        open={areaPickerOpen}
        title="Select Unit Areas"
        values={form.allowedAreas}
        onClose={() => setAreaPickerOpen(false)}
        onChange={(values) =>
          setForm((prev) => ({ ...prev, allowedAreas: values }))
        }
        options={allowedAreaOptions.map((value) => ({
          value,
          label: areaLabelLookup.get(value) || toDisplayLabel(value),
        }))}
      />

      <MultiSelectPickerModal
        open={shiftSlotPickerOpen}
        title="Select Shift Slots"
        values={form.allowedShiftTags}
        onClose={() => setShiftSlotPickerOpen(false)}
        onChange={(values) =>
          setForm((prev) => ({ ...prev, allowedShiftTags: values }))
        }
        options={shiftSlotOptions.map((option) => ({
          value: option.value,
          label: shiftSlotLabelLookup.get(option.value) || option.label,
        }))}
      />

      <MultiSelectPickerModal
        open={certPickerOpen}
        title="Select Certifications"
        values={form.certificationTags}
        onClose={() => setCertPickerOpen(false)}
        onChange={(values) =>
          setForm((prev) => ({ ...prev, certificationTags: values }))
        }
        options={certificationTagOptions.map((value) => ({
          value,
          label: certificationLabelLookup.get(value) || toDisplayLabel(value),
        }))}
      />
    </ScrollView>
  );
}

function MultiChipSelector<
  T extends string | { value: string; label: string },
>({
  label,
  helperText,
  options,
  values,
  onChange,
  getOptionValue,
  getOptionLabel,
  onOpenPicker,
}: {
  label: string;
  helperText: string;
  options: T[];
  values: string[];
  onChange: (values: string[]) => void;
  getOptionValue: (option: T) => string;
  getOptionLabel: (option: T) => string;
  onOpenPicker: () => void;
}) {
  const selectedValues = normalizeStringArray(values);

  const toggleValue = (option: T) => {
    const value = getOptionValue(option);

    if (!value) {
      return;
    }

    const isSelected = selectedValues.includes(value);
    const nextValues = isSelected
      ? selectedValues.filter((item) => item !== value)
      : [...selectedValues, value];

    onChange(normalizeStringArray(nextValues));
  };

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.helperText}>{helperText}</Text>

      {options.length === 0 ? (
        <Text style={styles.emptyMeta}>No options configured yet</Text>
      ) : (
        <View style={styles.chipWrap}>
          {options.map((option) => {
            const value = getOptionValue(option);
            const selected = selectedValues.includes(value);

            return (
              <Pressable
                key={value}
                style={[styles.chip, selected ? styles.chipSelected : null]}
                onPress={() => toggleValue(option)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selected ? styles.chipTextSelected : null,
                  ]}
                >
                  {getOptionLabel(option)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {options.length > 0 ? (
        <Pressable style={styles.secondaryActionBtn} onPress={onOpenPicker}>
          <Text style={styles.secondaryActionText}>Open full selector</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function MultiSelectPickerModal({
  open,
  title,
  values,
  onClose,
  onChange,
  options,
}: {
  open: boolean;
  title: string;
  values: string[];
  onClose: () => void;
  onChange: (values: string[]) => void;
  options: { value: string; label: string }[];
}) {
  if (!open) {
    return null;
  }

  const selectedValues = normalizeStringArray(values);

  const toggleValue = (value: string) => {
    const isSelected = selectedValues.includes(value);
    const nextValues = isSelected
      ? selectedValues.filter((item) => item !== value)
      : [...selectedValues, value];

    onChange(normalizeStringArray(nextValues));
  };

  return (
    <View style={styles.pickerOverlay}>
      <Pressable style={styles.pickerBackdrop} onPress={onClose} />
      <View style={styles.pickerCard}>
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>{title}</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Feather name="x" size={18} color="#6b7280" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.pickerList}>
          {options.map((option) => {
            const selected = selectedValues.includes(option.value);

            return (
              <Pressable
                key={option.value}
                style={[
                  styles.pickerItem,
                  selected ? styles.pickerItemActive : null,
                ]}
                onPress={() => toggleValue(option.value)}
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
      </View>
    </View>
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
  if (!open) {
    return null;
  }

  return (
    <View style={styles.pickerOverlay}>
      <Pressable style={styles.pickerBackdrop} onPress={onClose} />
      <View style={styles.pickerCard}>
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
      </View>
    </View>
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
    gap: 8,
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
  fieldWrap: {
    gap: 6,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  rowField: {
    flex: 1,
  },
  label: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  selectBtn: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectDisabled: {
    backgroundColor: "#f9fafb",
    opacity: 0.7,
  },
  selectText: {
    color: "#111827",
    fontSize: 13,
  },
  helperText: {
    color: "#6b7280",
    fontSize: 12,
    lineHeight: 16,
  },
  emptyMeta: {
    color: "#6b7280",
    fontSize: 12,
  },
  chipWrap: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  chip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipSelected: {
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
  },
  chipText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextSelected: {
    color: "#1d4ed8",
  },
  secondaryActionBtn: {
    alignSelf: "flex-start",
    marginTop: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
  },
  secondaryActionText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  fieldError: {
    color: "#b91c1c",
    fontSize: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    minHeight: 42,
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
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    padding: 20,
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
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
