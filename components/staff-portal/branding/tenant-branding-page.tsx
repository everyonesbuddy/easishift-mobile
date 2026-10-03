import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import ConfirmDialog from "@/components/shared/confirm-dialog";
import api, { API_BASE } from "@/config/api";
import { getBrandColors } from "@/config/branding-colors";
import { useAuth } from "@/context/auth-context";

type Branding = {
  displayName?: string;
  name?: string;
  primaryColor?: string;
  secondaryColor?: string;
  subdomain?: string;
  logoUrl?: string;
  appUrl?: string;
};

type Values = {
  displayName: string;
  primaryColor: string;
  secondaryColor: string;
  subdomain: string;
};

const EMPTY_VALUES: Values = {
  displayName: "",
  primaryColor: "",
  secondaryColor: "",
  subdomain: "",
};
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const BRAND_COLORS = ["#2563eb", "#0f766e", "#b45309", "#be123c", "#111827"];

function errorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: unknown } } })
    ?.response?.data?.message;
  return typeof message === "string" ? message : fallback;
}

function BrandColorField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string;
  fallback: string;
  onChange: (color: string) => void;
}) {
  return (
    <View style={styles.colorRow}>
      <View style={styles.colorInputWrap}>
        <Text style={styles.label}>{label} hex</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={fallback}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={7}
          style={styles.input}
        />
        {value && !HEX_COLOR.test(value) ? (
          <Text style={styles.errorText}>Use a hex value like #2563eb</Text>
        ) : null}
      </View>
      <View
        accessibilityLabel={`${label} color`}
        style={[
          styles.swatch,
          { backgroundColor: HEX_COLOR.test(value) ? value : fallback },
        ]}
      />
      <View style={styles.colorChoices}>
        {BRAND_COLORS.map((color) => (
          <Pressable
            key={color}
            accessibilityLabel={`Choose ${label.toLowerCase()} ${color}`}
            onPress={() => onChange(color)}
            style={[styles.colorChoice, { backgroundColor: color }]}
          />
        ))}
      </View>
    </View>
  );
}

export default function TenantBrandingPage() {
  const { updatePublicBranding, publicBranding } = useAuth();
  const brand = getBrandColors(publicBranding);
  const [values, setValues] = useState<Values>(EMPTY_VALUES);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [originalSubdomain, setOriginalSubdomain] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState("");
  const [availability, setAvailability] = useState("");

  const applyBranding = useCallback(
    (next: Branding | null) => {
      if (!next) return;
      updatePublicBranding(next);
      setBranding(next);
      setOriginalSubdomain(next.subdomain || "");
      setValues({
        displayName: next.displayName || "",
        primaryColor: next.primaryColor || "",
        secondaryColor: next.secondaryColor || "",
        subdomain: next.subdomain || "",
      });
      setAvailability("");
    },
    [updatePublicBranding],
  );

  useEffect(() => {
    let active = true;
    api
      .get("/tenants/me/branding")
      .then((res) => {
        if (active) applyBranding(res.data?.branding || null);
      })
      .catch((err) => {
        if (active)
          setError(errorMessage(err, "Failed to load tenant branding"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applyBranding]);

  const checkSubdomain = async () => {
    const subdomain = values.subdomain.trim().toLowerCase();
    if (!subdomain) {
      setAvailability("Enter a subdomain to check.");
      return false;
    }
    if (subdomain === originalSubdomain) {
      setAvailability("This is your current subdomain.");
      return true;
    }
    try {
      const res = await api.get("/public/subdomain-availability", {
        params: { subdomain },
      });
      const available = res.data?.available === true;
      setAvailability(
        available
          ? `${subdomain} is available.`
          : res.data?.reason || "That subdomain is unavailable.",
      );
      return available;
    } catch (err) {
      setAvailability(
        errorMessage(err, "Could not check subdomain availability."),
      );
      return false;
    }
  };

  const save = async () => {
    setError("");
    const subdomain = values.subdomain.trim().toLowerCase();
    if (originalSubdomain && !subdomain) {
      setError("An assigned subdomain cannot be removed.");
      return;
    }
    if (
      [values.primaryColor, values.secondaryColor].some(
        (color) => color && !HEX_COLOR.test(color),
      )
    ) {
      setError("Use a six-digit hex value for each color.");
      return;
    }
    setSaving(true);
    try {
      if (
        subdomain !== originalSubdomain &&
        subdomain &&
        !(await checkSubdomain())
      ) {
        setError("Choose an available subdomain before saving.");
        return;
      }
      const res = await api.patch("/tenants/me/branding", {
        displayName: values.displayName.trim() || null,
        primaryColor: values.primaryColor.trim() || null,
        secondaryColor: values.secondaryColor.trim() || null,
        ...(subdomain ? { subdomain } : {}),
      });
      applyBranding(res.data?.branding || null);
    } catch (err) {
      setError(errorMessage(err, "Failed to save tenant branding"));
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async () => {
    setError("");
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Allow photo library access to upload a logo.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
      if (result.canceled || !result.assets.length) return;
      const asset = result.assets[0];
      const mimeType = asset.mimeType || "";
      if (!IMAGE_TYPES.includes(mimeType)) {
        setError("Logo must be a PNG, JPEG, or WebP image.");
        return;
      }
      const imageBlob =
        Platform.OS === "web" ? await (await fetch(asset.uri)).blob() : null;
      const fileSize = asset.fileSize ?? imageBlob?.size;
      if (fileSize === undefined) {
        setError("Unable to verify logo size. Choose another image.");
        return;
      }
      if (fileSize > 512 * 1024) {
        setError("Logo must be 512 KB or smaller.");
        return;
      }

      setLogoBusy(true);
      const formData = new FormData();
      const filename = asset.fileName || `logo.${mimeType.split("/")[1]}`;
      if (imageBlob) {
        formData.append("logo", imageBlob, filename);
      } else {
        formData.append("logo", {
          uri: asset.uri,
          name: filename,
          type: mimeType,
        } as unknown as Blob);
      }
      const res = await api.put("/tenants/me/logo", formData);
      applyBranding(res.data?.branding || null);
    } catch (err) {
      setError(errorMessage(err, "Failed to upload logo"));
    } finally {
      setLogoBusy(false);
    }
  };

  const removeLogo = async () => {
    setConfirmRemove(false);
    setLogoBusy(true);
    setError("");
    try {
      const res = await api.delete("/tenants/me/logo");
      applyBranding(res.data?.branding || null);
    } catch (err) {
      setError(errorMessage(err, "Failed to remove logo"));
    } finally {
      setLogoBusy(false);
    }
  };

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );

  const logoUrl = branding?.logoUrl?.startsWith("/")
    ? `${API_BASE}${branding.logoUrl}`
    : branding?.logoUrl;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Tenant Branding</Text>
      {error ? <Text style={styles.errorBox}>{error}</Text> : null}
      {!branding ? null : (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Logo</Text>
            <View style={styles.logoRow}>
              <View style={styles.logoFrame}>
                {logoUrl ? (
                  <Image
                    source={{ uri: logoUrl }}
                    style={styles.logo}
                    contentFit="contain"
                  />
                ) : (
                  <Text style={styles.logoInitial}>
                    {(branding.displayName || branding.name || "T").slice(0, 1)}
                  </Text>
                )}
              </View>
              <View style={styles.logoActions}>
                <Pressable
                  onPress={uploadLogo}
                  disabled={logoBusy}
                  style={styles.outlineButton}
                >
                  <Feather name="upload" size={16} color={brand.primary} />
                  <Text style={[styles.outlineText, { color: brand.primary }]}>
                    {logoBusy ? "Working..." : "Upload logo"}
                  </Text>
                </Pressable>
                {logoUrl ? (
                  <Pressable
                    onPress={() => setConfirmRemove(true)}
                    disabled={logoBusy}
                    style={styles.outlineButton}
                  >
                    <Feather name="trash-2" size={16} color="#b91c1c" />
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
            <Text style={styles.hint}>PNG, JPEG, or WebP; maximum 512 KB.</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Brand identity</Text>
            <Text style={styles.label}>Display name</Text>
            <TextInput
              value={values.displayName}
              onChangeText={(displayName) =>
                setValues((prev) => ({ ...prev, displayName }))
              }
              maxLength={80}
              placeholder={branding.name || "Facility name"}
              style={styles.input}
            />
            <BrandColorField
              label="Primary color"
              value={values.primaryColor}
              fallback="#2563eb"
              onChange={(primaryColor) =>
                setValues((prev) => ({ ...prev, primaryColor }))
              }
            />
            <BrandColorField
              label="Secondary color"
              value={values.secondaryColor}
              fallback="#1e40af"
              onChange={(secondaryColor) =>
                setValues((prev) => ({ ...prev, secondaryColor }))
              }
            />
            <Text style={styles.label}>Portal subdomain</Text>
            <TextInput
              value={values.subdomain}
              onChangeText={(subdomain) => {
                setValues((prev) => ({ ...prev, subdomain }));
                setAvailability("");
              }}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={40}
              style={styles.input}
            />
            {branding.appUrl ? (
              <Pressable onPress={() => Linking.openURL(branding.appUrl!)}>
                <Text
                  style={[styles.link, { color: brand.primary }]}
                  numberOfLines={2}
                >
                  {branding.appUrl}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={checkSubdomain}
              disabled={!values.subdomain.trim()}
              style={styles.outlineButton}
            >
              <Text style={[styles.outlineText, { color: brand.primary }]}>
                Check availability
              </Text>
            </Pressable>
            {availability ? (
              <Text style={styles.hint}>{availability}</Text>
            ) : null}
          </View>
          <Pressable
            onPress={save}
            disabled={saving}
            style={[styles.saveButton, { backgroundColor: brand.primary }]}
          >
            {saving ? (
              <ActivityIndicator color={brand.onPrimary} />
            ) : (
              <Feather name="save" size={18} color={brand.onPrimary} />
            )}
            <Text style={[styles.saveText, { color: brand.onPrimary }]}>
              {saving ? "Saving..." : "Save branding"}
            </Text>
          </Pressable>
        </>
      )}
      <ConfirmDialog
        open={confirmRemove}
        title="Remove logo"
        message="Remove the tenant logo?"
        onCancel={() => setConfirmRemove(false)}
        onConfirm={removeLogo}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#fff" },
  content: {
    width: "100%",
    maxWidth: 740,
    alignSelf: "center",
    padding: 20,
    paddingBottom: 48,
    gap: 20,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 26, fontWeight: "700", color: "#111827" },
  section: {
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    gap: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  label: { fontSize: 14, fontWeight: "600", color: "#374151" },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    padding: 12,
    color: "#111827",
    fontSize: 16,
    backgroundColor: "#fff",
  },
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },
  colorInputWrap: { flex: 1, gap: 6 },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  colorChoices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    width: "100%",
  },
  colorChoice: {
    width: 28,
    height: 28,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  logoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 16,
  },
  logoFrame: {
    width: 144,
    height: 88,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: "100%", height: "100%" },
  logoInitial: { fontSize: 32, color: "#6b7280" },
  logoActions: { gap: 8 },
  outlineButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "flex-start",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  outlineText: { color: "#1d4ed8", fontWeight: "600" },
  removeText: { color: "#b91c1c", fontWeight: "600" },
  hint: { color: "#64748b", fontSize: 13 },
  link: { color: "#1d4ed8", fontSize: 14 },
  errorText: { color: "#b91c1c", fontSize: 12 },
  errorBox: {
    color: "#991b1b",
    backgroundColor: "#fee2e2",
    padding: 12,
    borderRadius: 6,
  },
  saveButton: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    padding: 14,
    backgroundColor: "#2563eb",
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
