import { Feather } from "@expo/vector-icons";
import {
  CameraType,
  CameraView,
  type BarcodeScanningResult,
  useCameraPermissions,
} from "expo-camera";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const SCAN_WARMUP_MS = 1200;

type Props = {
  open: boolean;
  onClose?: () => void;
  onScan?: (value: string) => void;
  title?: string;
  description?: string;
};

function toFriendlyCameraError(message: unknown) {
  const lower = String(message || "").toLowerCase();

  if (lower.includes("permission") || lower.includes("not allowed")) {
    return "Camera permission was blocked. Allow camera access in system settings.";
  }

  if (lower.includes("camera") && lower.includes("in use")) {
    return "Camera is already in use by another app.";
  }

  if (lower.includes("not found") || lower.includes("unavailable")) {
    return "No camera is available on this device.";
  }

  if (lower) {
    return `Camera error: ${String(message)}`;
  }

  return "Unable to start camera scanner.";
}

export default function QrScannerDialog({
  open,
  onClose,
  onScan,
  title = "Scan QR Code",
  description = "Point your camera at the facility QR code.",
}: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [starting, setStarting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanReady, setScanReady] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [facing, setFacing] = useState<CameraType>("back");

  const hasPermission = Boolean(permission?.granted);

  useEffect(() => {
    if (!open) {
      setScanning(false);
      setScanLocked(false);
      setErrorMessage("");
      return;
    }

    let active = true;

    async function prepare() {
      if (hasPermission) {
        return;
      }

      try {
        setStarting(true);
        const result = await requestPermission();
        if (!active) {
          return;
        }

        if (!result.granted) {
          setErrorMessage(
            "Camera permission is required to scan attendance QR codes.",
          );
        }
      } catch (requestError) {
        if (!active) {
          return;
        }

        setErrorMessage(toFriendlyCameraError(requestError));
      } finally {
        if (active) {
          setStarting(false);
        }
      }
    }

    prepare();

    return () => {
      active = false;
    };
  }, [hasPermission, open, requestPermission]);

  const handleClose = () => {
    setScanning(false);
    setScanLocked(false);
    setErrorMessage("");
    onClose?.();
  };

  const handleStartScanner = () => {
    if (!hasPermission) {
      setErrorMessage("Allow camera access, then try Start Camera again.");
      return;
    }

    setErrorMessage("");
    setScanReady(false);
    setScanLocked(false);
    setScanning(true);
  };

  useEffect(() => {
    if (!scanning) {
      setScanReady(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      setScanReady(true);
    }, SCAN_WARMUP_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [scanning]);

  const handleScanned = ({ data }: BarcodeScanningResult) => {
    if (!scanning || !scanReady || scanLocked) {
      return;
    }

    const value = String(data || "").trim();
    if (!value) {
      return;
    }

    setScanLocked(true);
    setScanning(false);
    onScan?.(value);
  };

  return (
    <Modal
      visible={open}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{description}</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={handleClose}>
              <Feather name="x" size={18} color="#6b7280" />
            </Pressable>
          </View>

          <View style={styles.previewWrap}>
            {scanning ? (
              <CameraView
                style={styles.camera}
                facing={facing}
                barcodeScannerSettings={{
                  barcodeTypes: ["qr"],
                }}
                onBarcodeScanned={handleScanned}
              />
            ) : (
              <View style={styles.idleWrap}>
                {starting ? (
                  <>
                    <ActivityIndicator size="small" color="#ffffff" />
                    <Text style={styles.idleText}>Preparing camera...</Text>
                  </>
                ) : (
                  <Text style={styles.idleText}>
                    Tap Start Camera to begin scanning.
                  </Text>
                )}
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() =>
                setFacing((prev) => (prev === "back" ? "front" : "back"))
              }
            >
              <Feather name="refresh-cw" size={14} color="#1f2937" />
              <Text style={styles.secondaryBtnText}>Flip</Text>
            </Pressable>

            <Pressable style={styles.primaryBtn} onPress={handleStartScanner}>
              <Feather name="camera" size={14} color="#ffffff" />
              <Text style={styles.primaryBtnText}>
                {scanning ? "Restart Camera" : "Start Camera"}
              </Text>
            </Pressable>
          </View>

          {scanning ? (
            <View style={styles.infoSuccess}>
              <Text style={styles.infoSuccessText}>
                {scanReady
                  ? "Camera ready. Hold the QR code steady in view."
                  : "Stabilizing camera... hold for a second."}
              </Text>
            </View>
          ) : null}

          {errorMessage ? (
            <View style={styles.infoError}>
              <Text style={styles.infoErrorText}>{errorMessage}</Text>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 10,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 12,
  },
  closeBtn: {
    padding: 6,
  },
  previewWrap: {
    borderRadius: 10,
    overflow: "hidden",
    minHeight: 300,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#000000",
  },
  camera: {
    width: "100%",
    height: 300,
  },
  idleWrap: {
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 8,
  },
  idleText: {
    color: "#e5e7eb",
    fontSize: 13,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
  },
  primaryBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  secondaryBtn: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
  },
  secondaryBtnText: {
    color: "#1f2937",
    fontSize: 12,
    fontWeight: "700",
  },
  infoSuccess: {
    borderWidth: 1,
    borderColor: "#86efac",
    backgroundColor: "#dcfce7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  infoSuccessText: {
    color: "#166534",
    fontSize: 12,
  },
  infoError: {
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fee2e2",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  infoErrorText: {
    color: "#b91c1c",
    fontSize: 12,
  },
});
