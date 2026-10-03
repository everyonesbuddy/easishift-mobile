import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import ForgotPasswordModal from "@/components/auth/forgot-password-modal";
import api from "@/config/api";
import { getBrandColors } from "@/config/branding-colors";
import {
  getTenantLoginUrl,
  getWorkspaceDomainLabel,
  isRootWorkspaceHost,
  isTenantWorkspaceHost,
} from "@/config/tenant-workspace";
import { useAuth } from "@/context/auth-context";

const LAST_WORKSPACE_KEY = "lastWorkspace";
type RememberedWorkspace = { subdomain: string; displayName: string };

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response
      ?.data?.message === "string"
  ) {
    return (
      (error as { response?: { data?: { message?: string } } }).response?.data
        ?.message || "Invalid credentials, please try again."
    );
  }

  return "Invalid credentials, please try again.";
}

export default function LoginScreen() {
  const {
    login,
    publicBranding,
    publicBrandingLoading,
    workspaceSubdomain,
    selectWorkspace,
  } = useAuth();
  const brand = getBrandColors(publicBranding);
  const router = useRouter();
  const isWorkspaceFinder = Platform.OS !== "web" || isRootWorkspaceHost();
  const [workspaceReady, setWorkspaceReady] = useState(
    Platform.OS === "web" && isTenantWorkspaceHost(),
  );
  const [workspace, setWorkspace] = useState("");
  const [lastWorkspace, setLastWorkspace] =
    useState<RememberedWorkspace | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(LAST_WORKSPACE_KEY)
      .then((value) => {
        if (!active || !value) return;
        const remembered = JSON.parse(value) as RememberedWorkspace;
        if (remembered?.subdomain) {
          setLastWorkspace(remembered);
          setWorkspace(remembered.subdomain);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const continueToWorkspace = async () => {
    const subdomain = workspace.trim().toLowerCase();
    setError("");
    if (
      !/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(subdomain) ||
      subdomain.includes("--")
    ) {
      setError(
        "Enter a valid workspace name using letters, numbers, or single hyphens.",
      );
      return;
    }

    setLoading(true);
    try {
      const response = await api.get("/public/tenant-branding", {
        params: { subdomain },
      });
      const branding = response.data?.branding;
      if (!branding) throw new Error("Workspace not found");

      const remembered: RememberedWorkspace = {
        subdomain,
        displayName: branding.displayName || branding.name || subdomain,
      };
      await AsyncStorage.setItem(
        LAST_WORKSPACE_KEY,
        JSON.stringify(remembered),
      ).catch(() => {});
      setLastWorkspace(remembered);

      if (Platform.OS === "web") {
        window.location.assign(getTenantLoginUrl(subdomain));
      } else {
        selectWorkspace(subdomain, branding);
        setWorkspaceReady(true);
      }
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response
        ?.status;
      setError(
        status === 404
          ? "We couldn't find that workspace. Check the name and try again."
          : getErrorMessage(err) === "Invalid credentials, please try again."
            ? "Unable to find that workspace right now."
            : getErrorMessage(err),
      );
    } finally {
      setLoading(false);
    }
  };

  const returnToWorkspaceFinder = () => {
    setError("");
    if (Platform.OS === "web" && isTenantWorkspaceHost()) {
      const url = new URL("/login", window.location.href);
      url.hostname = window.location.hostname.endsWith(".localhost")
        ? "localhost"
        : getWorkspaceDomainLabel();
      window.location.assign(url.toString());
    } else {
      setWorkspaceReady(false);
    }
  };

  const handleSubmit = async () => {
    setError("");
    if (!workspaceSubdomain) {
      setError("Select a workspace before logging in.");
      return;
    }
    setLoading(true);

    try {
      const res = await api.post("/auth/login/staff", {
        email: email.trim(),
        password,
        tenantSubdomain: workspaceSubdomain,
      });

      await login(res.data);
      router.replace("/dashboard");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const showFinder = isWorkspaceFinder && !workspaceReady;

  if (!showFinder && publicBrandingLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#42a5f5" />
      </View>
    );
  }

  if (!showFinder && !publicBranding) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          This workspace could not be loaded. Check the name and try again.
        </Text>
        <Pressable onPress={returnToWorkspaceFinder} style={styles.linkButton}>
          <Text style={styles.linkText}>Find another workspace</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Pressable
            onPress={() => router.replace("/")}
            style={({ pressed }) => [
              styles.backButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.backButtonText}>← Back to home</Text>
          </Pressable>

          {showFinder ? (
            <>
              <Text style={styles.title}>Find your workspace</Text>
              <Text style={styles.helperText}>
                Enter your organization&apos;s workspace name to continue.
              </Text>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              <View style={styles.workspaceField}>
                <TextInput
                  placeholder="Workspace name"
                  accessibilityLabel="Workspace subdomain"
                  value={workspace}
                  onChangeText={(value) =>
                    setWorkspace(value.toLowerCase().replace(/\s/g, ""))
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={40}
                  style={styles.workspaceInput}
                />
                <Text style={styles.domainSuffix}>
                  .{getWorkspaceDomainLabel()}
                </Text>
              </View>
              <Pressable
                onPress={continueToWorkspace}
                disabled={loading || !workspace.trim()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed ? styles.pressed : null,
                  loading || !workspace.trim() ? styles.disabled : null,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {workspace.trim().toLowerCase() === lastWorkspace?.subdomain
                      ? `Continue to ${lastWorkspace.displayName}`
                      : "Continue"}
                  </Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              {publicBranding?.logoUrl ? (
                <Image
                  source={{ uri: publicBranding.logoUrl }}
                  style={styles.tenantLogo}
                  contentFit="contain"
                  accessibilityLabel="Tenant logo"
                />
              ) : null}
              <Text style={styles.title}>
                {typeof publicBranding?.displayName === "string"
                  ? publicBranding.displayName
                  : "Login"}
              </Text>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TextInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
              />

              <TextInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={styles.input}
              />

              <Pressable
                onPress={handleSubmit}
                disabled={loading || !email.trim() || !password.trim()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: brand.primary },
                  pressed ? styles.pressed : null,
                  loading || !email.trim() || !password.trim()
                    ? styles.disabled
                    : null,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text
                    style={[
                      styles.primaryButtonText,
                      { color: brand.onPrimary },
                    ]}
                  >
                    Login
                  </Text>
                )}
              </Pressable>

              <Text style={styles.helperText}>
                Don&apos;t have an account? Contact your facility admin.
              </Text>

              <Pressable
                onPress={() => setForgotPasswordOpen(true)}
                style={({ pressed }) => [
                  styles.linkButton,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={[styles.linkText, { color: brand.primary }]}>
                  Forgot password?
                </Text>
              </Pressable>
              <Pressable
                onPress={returnToWorkspaceFinder}
                style={styles.linkButton}
              >
                <Text style={styles.linkText}>Change workspace</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      <ForgotPasswordModal
        open={forgotPasswordOpen}
        onClose={() => setForgotPasswordOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 22,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.12)",
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    padding: 18,
    gap: 12,
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 2,
  },
  tenantLogo: {
    width: 180,
    height: 64,
    alignSelf: "center",
  },
  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  backButtonText: {
    color: "#1d4ed8",
    fontWeight: "700",
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: "#0f172a",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  workspaceField: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#0f172a",
    borderRadius: 8,
  },
  workspaceInput: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0f172a",
  },
  domainSuffix: {
    paddingRight: 12,
    color: "#475569",
    fontSize: 13,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: "#42a5f5",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  helperText: {
    textAlign: "center",
    color: "#0f172a",
    marginTop: 4,
  },
  linkButton: {
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  linkText: {
    color: "#42a5f5",
    fontWeight: "700",
  },
  errorBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fca5a5",
    backgroundColor: "#fee2e2",
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  errorText: {
    color: "#7f1d1d",
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.86,
  },
  disabled: {
    opacity: 0.58,
  },
});
