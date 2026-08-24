import { Feather } from "@expo/vector-icons";
import {
  openBrowserAsync,
  WebBrowserPresentationStyle,
} from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type GuideVideo = {
  id: string;
  label: string;
  title?: string;
  description?: string;
  embedUrl: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  videos: GuideVideo[];
};

export default function GuideVideoDialog({
  open,
  onClose,
  title,
  videos,
}: Props) {
  const availableVideos = useMemo(
    () => videos.filter((video) => video?.embedUrl),
    [videos],
  );
  const [activeVideoId, setActiveVideoId] = useState(
    availableVideos[0]?.id || "",
  );

  useEffect(() => {
    if (open && availableVideos.length > 0) {
      setActiveVideoId(availableVideos[0].id);
    }
  }, [availableVideos, open]);

  const activeVideo =
    availableVideos.find((video) => video.id === activeVideoId) ||
    availableVideos[0];

  if (!activeVideo) {
    return null;
  }

  const openVideo = async () => {
    await openBrowserAsync(activeVideo.embedUrl, {
      presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
    });
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>Select a guide to watch.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={20} color="#64748b" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.videoOptions}>
              {availableVideos.map((video) => (
                <Pressable
                  key={video.id}
                  style={[
                    styles.videoOption,
                    video.id === activeVideo.id
                      ? styles.videoOptionActive
                      : null,
                  ]}
                  onPress={() => setActiveVideoId(video.id)}
                >
                  <Feather
                    name="play-circle"
                    size={17}
                    color={video.id === activeVideo.id ? "#1d4ed8" : "#64748b"}
                  />
                  <Text
                    style={[
                      styles.videoOptionText,
                      video.id === activeVideo.id
                        ? styles.videoOptionTextActive
                        : null,
                    ]}
                  >
                    {video.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {activeVideo.description ? (
              <Text style={styles.description}>{activeVideo.description}</Text>
            ) : null}

            <Pressable style={styles.watchButton} onPress={openVideo}>
              <Feather name="play" size={16} color="#ffffff" />
              <Text style={styles.watchButtonText}>Watch Guide</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  card: {
    maxHeight: "82%",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: "#ffffff",
    padding: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 3,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    gap: 14,
    paddingTop: 16,
    paddingBottom: 12,
  },
  videoOptions: {
    gap: 8,
  },
  videoOption: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 9,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  videoOptionActive: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  videoOptionText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
  },
  videoOptionTextActive: {
    color: "#1d4ed8",
  },
  description: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 19,
  },
  watchButton: {
    minHeight: 44,
    borderRadius: 9,
    backgroundColor: "#2563eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  watchButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
});
