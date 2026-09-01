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
import { getInitials } from "@/components/staff-portal/staff/staff-shared";
import api from "@/config/api";
import { getRoleColor } from "@/constants/industry-roles";
import { useAuth } from "@/context/auth-context";
import { useGuideTour } from "@/context/guide-tour-context";

import MessageComposer from "./message-composer";

const MESSAGES_TOUR_STEPS = [
  {
    target: "messages-new",
    title: "Send a new message",
    body: "Choose an individual, a role, or all staff in your facility to start a conversation.",
  },
  {
    target: "messages-tabs",
    title: "Inbox and sent",
    body: "Switch between messages you received and messages you sent.",
  },
  {
    target: "messages-search",
    title: "Search conversations",
    body: "Search by sender or recipient, subject, or message content.",
  },
];

type MessagePerson = {
  _id?: string;
  name?: string;
  role?: string;
  roles?: string[];
};

type MessageItem = {
  _id?: string;
  subject?: string;
  body?: string;
  read?: boolean;
  createdAt?: string;
  sentAt?: string;
  updatedAt?: string;
  senderId?: MessagePerson;
  receiverId?: MessagePerson;
};

function getPersonRoles(person?: MessagePerson) {
  return person?.roles?.length
    ? person.roles
    : person?.role
      ? [person.role]
      : [];
}

function formatMessageDate(message: MessageItem) {
  const value = message.createdAt || message.sentAt || message.updatedAt;
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime())
    ? parsed.toLocaleString()
    : "";
}

function formatReplySubject(subject?: string) {
  if (!subject) {
    return "";
  }

  return /^re:/i.test(subject) ? subject : `Re: ${subject}`;
}

export default function MessageListPage() {
  const { user } = useAuth();
  const { startTourIfUnseen } = useGuideTour();
  const [inboxMessages, setInboxMessages] = useState<MessageItem[]>([]);
  const [sentMessages, setSentMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [mainTab, setMainTab] = useState<"inbox" | "sent">("inbox");
  const [selectedMessage, setSelectedMessage] = useState<MessageItem | null>(
    null,
  );
  const [openComposerModal, setOpenComposerModal] = useState(false);
  const [composerDefaults, setComposerDefaults] = useState({
    recipientId: "",
    subject: "",
    lockRecipient: false,
  });
  const [error, setError] = useState("");

  const fetchInbox = useCallback(async () => {
    try {
      const res = await api.get(`/messages/receiver/${user?._id}`);
      setInboxMessages(
        Array.isArray(res.data) ? (res.data as MessageItem[]) : [],
      );
    } catch (requestError) {
      console.warn("Failed to fetch inbox", requestError);
    }
  }, [user?._id]);

  const fetchSent = useCallback(async () => {
    try {
      const res = await api.get(`/messages/sender/${user?._id}`);
      setSentMessages(
        Array.isArray(res.data) ? (res.data as MessageItem[]) : [],
      );
    } catch (requestError) {
      console.warn("Failed to fetch sent messages", requestError);
    }
  }, [user?._id]);

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      await Promise.all([fetchInbox(), fetchSent()]);
    } catch (requestError) {
      console.warn("Failed to load messages", requestError);
      setError("Failed to load messages.");
    } finally {
      setLoading(false);
    }
  }, [fetchInbox, fetchSent]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!loading) {
      void startTourIfUnseen("messages", MESSAGES_TOUR_STEPS);
    }
  }, [loading, startTourIfUnseen]);

  const handleNewMessage = () => {
    setComposerDefaults({ recipientId: "", subject: "", lockRecipient: false });
    setOpenComposerModal(true);
  };

  const handleReply = () => {
    if (!selectedMessage) {
      return;
    }

    const otherPersonId =
      mainTab === "inbox"
        ? selectedMessage.senderId?._id
        : selectedMessage.receiverId?._id;

    setComposerDefaults({
      recipientId: otherPersonId || "",
      subject: formatReplySubject(selectedMessage.subject),
      lockRecipient: true,
    });
    setOpenComposerModal(true);
  };

  const handleViewMessage = async (message: MessageItem) => {
    if (!message.read && mainTab === "inbox" && message._id) {
      try {
        await api.put(`/messages/${message._id}/read`, {});
        setInboxMessages((prev) =>
          prev.map((item) =>
            item._id === message._id ? { ...item, read: true } : item,
          ),
        );
      } catch (requestError) {
        console.warn("Failed to mark message as read", requestError);
      }
    }

    const source = mainTab === "inbox" ? inboxMessages : sentMessages;
    const fullMessage =
      source.find((item) => item._id === message._id) || message;
    setSelectedMessage(fullMessage);
  };

  const inboxFiltered = useMemo(() => {
    const query = searchTerm.toLowerCase();

    return inboxMessages
      .filter((message) => {
        const senderName = message.senderId?.name || "";
        const subject = message.subject || "";
        const body = message.body || "";
        return (
          subject.toLowerCase().includes(query) ||
          body.toLowerCase().includes(query) ||
          senderName.toLowerCase().includes(query)
        );
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt || b.sentAt || b.updatedAt || 0).getTime() -
          new Date(a.createdAt || a.sentAt || a.updatedAt || 0).getTime(),
      );
  }, [inboxMessages, searchTerm]);

  const sentFiltered = useMemo(() => {
    const query = searchTerm.toLowerCase();

    return sentMessages
      .filter((message) => {
        const receiverName = message.receiverId?.name || "";
        const subject = message.subject || "";
        const body = message.body || "";
        return (
          subject.toLowerCase().includes(query) ||
          body.toLowerCase().includes(query) ||
          receiverName.toLowerCase().includes(query)
        );
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt || b.sentAt || b.updatedAt || 0).getTime() -
          new Date(a.createdAt || a.sentAt || a.updatedAt || 0).getTime(),
      );
  }, [searchTerm, sentMessages]);

  const activeFiltered = mainTab === "inbox" ? inboxFiltered : sentFiltered;
  const unreadCount = inboxMessages.filter((message) => !message.read).length;

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <GuideHelpButton tourId="messages" tourSteps={MESSAGES_TOUR_STEPS} />
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Messages</Text>
            <Text style={styles.subtitle}>Internal team communication</Text>
          </View>

          <Pressable style={styles.newBtn} onPress={handleNewMessage}>
            <Feather name="plus" size={14} color="#ffffff" />
            <Text style={styles.newBtnText}>New Message</Text>
          </Pressable>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statValue}>{unreadCount}</Text>
              {unreadCount > 0 ? (
                <Text style={styles.statBadge}>New</Text>
              ) : null}
            </View>
            <Text style={styles.statLabel}>Unread Messages</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{inboxMessages.length}</Text>
            <Text style={styles.statLabel}>Inbox</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{sentMessages.length}</Text>
            <Text style={styles.statLabel}>Sent</Text>
          </View>
        </View>

        <View style={styles.panelWrap}>
          <View style={styles.leftPanel}>
            <View style={styles.tabsWrap}>
              <Pressable
                style={[
                  styles.tabBtn,
                  mainTab === "inbox" ? styles.tabBtnActive : null,
                ]}
                onPress={() => setMainTab("inbox")}
              >
                <Text
                  style={[
                    styles.tabText,
                    mainTab === "inbox" ? styles.tabTextActive : null,
                  ]}
                >
                  Inbox ({inboxMessages.length})
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.tabBtn,
                  mainTab === "sent" ? styles.tabBtnActive : null,
                ]}
                onPress={() => setMainTab("sent")}
              >
                <Text
                  style={[
                    styles.tabText,
                    mainTab === "sent" ? styles.tabTextActive : null,
                  ]}
                >
                  Sent ({sentMessages.length})
                </Text>
              </Pressable>
            </View>

            <View style={styles.searchWrap}>
              <Feather name="search" size={16} color="#9ca3af" />
              <TextInput
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Search messages..."
                style={styles.searchInput}
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {loading ? (
              <View style={styles.centerCard}>
                <ActivityIndicator size="small" color="#2563eb" />
              </View>
            ) : activeFiltered.length === 0 ? (
              <View style={styles.emptyCard}>
                <Feather name="mail" size={36} color="#9ca3af" />
                <Text style={styles.emptyText}>No messages</Text>
              </View>
            ) : (
              <View style={styles.listWrap}>
                {activeFiltered.map((message) => {
                  const isInbox = mainTab === "inbox";
                  const person = isInbox
                    ? message.senderId
                    : message.receiverId;
                  const dateLabel = formatMessageDate(message);

                  return (
                    <Pressable
                      key={message._id}
                      style={styles.messageCard}
                      onPress={() => handleViewMessage(message)}
                    >
                      <View
                        style={[
                          styles.avatar,
                          {
                            backgroundColor: getRoleColor(
                              getPersonRoles(person)[0],
                            ),
                          },
                        ]}
                      >
                        <Text style={styles.avatarText}>
                          {getInitials(person?.name)}
                        </Text>
                      </View>

                      <View style={styles.messageBody}>
                        <View style={styles.messageTopRow}>
                          <Text style={styles.messageName}>
                            {person?.name || "Unknown"}
                          </Text>
                          {!message.read && isInbox ? (
                            <View style={styles.unreadDot} />
                          ) : null}
                        </View>
                        <Text style={styles.messageSubject} numberOfLines={1}>
                          {message.subject || "(No subject)"}
                        </Text>
                        <Text style={styles.messageDate}>{dateLabel}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.rightPanel}>
            {selectedMessage ? (
              <>
                <View style={styles.detailHeader}>
                  <View
                    style={[
                      styles.detailAvatar,
                      {
                        backgroundColor: getRoleColor(
                          getPersonRoles(
                            mainTab === "inbox"
                              ? selectedMessage.senderId
                              : selectedMessage.receiverId,
                          )[0],
                        ),
                      },
                    ]}
                  >
                    <Text style={styles.detailAvatarText}>
                      {getInitials(
                        (mainTab === "inbox"
                          ? selectedMessage.senderId
                          : selectedMessage.receiverId
                        )?.name,
                      )}
                    </Text>
                  </View>
                  <View style={styles.detailHeaderText}>
                    <Text style={styles.detailTitle}>
                      {selectedMessage.subject}
                    </Text>
                    <Text style={styles.detailMeta}>
                      {mainTab === "inbox" ? "From" : "To"}:{" "}
                      {(mainTab === "inbox"
                        ? selectedMessage.senderId?.name
                        : selectedMessage.receiverId?.name) || "Unknown"}
                    </Text>
                    <Text style={styles.detailMeta}>
                      {formatMessageDate(selectedMessage)}
                    </Text>
                  </View>
                </View>

                <View style={styles.bodyCard}>
                  <Text style={styles.bodyText}>{selectedMessage.body}</Text>
                </View>

                <Pressable style={styles.replyBtn} onPress={handleReply}>
                  <Feather name="send" size={14} color="#ffffff" />
                  <Text style={styles.replyText}>Reply</Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.emptyDetailCard}>
                <Feather name="mail" size={48} color="#9ca3af" />
                <Text style={styles.emptyText}>Select a message to view</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={openComposerModal}
        animationType="slide"
        onRequestClose={() => setOpenComposerModal(false)}
      >
        <SafeAreaView style={styles.modalPage}>
          <MessageComposer
            onClose={() => setOpenComposerModal(false)}
            initialRecipientId={composerDefaults.recipientId}
            initialSubject={composerDefaults.subject}
            lockRecipient={composerDefaults.lockRecipient}
            onSuccess={() => {
              setOpenComposerModal(false);
              loadMessages();
            }}
          />
        </SafeAreaView>
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
  newBtn: {
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  newBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  statsGrid: {
    gap: 10,
  },
  statCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 4,
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statValue: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "800",
  },
  statBadge: {
    color: "#1d4ed8",
    fontSize: 11,
    fontWeight: "800",
    backgroundColor: "#dbeafe",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statLabel: {
    color: "#6b7280",
    fontSize: 13,
  },
  panelWrap: {
    gap: 12,
  },
  leftPanel: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  rightPanel: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 12,
  },
  tabsWrap: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tabBtn: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  tabBtnActive: {
    backgroundColor: "#eff6ff",
  },
  tabText: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
  },
  tabTextActive: {
    color: "#2563eb",
  },
  searchWrap: {
    margin: 12,
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
  error: {
    marginHorizontal: 12,
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
    paddingVertical: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    paddingVertical: 36,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 13,
  },
  listWrap: {
    gap: 1,
  },
  messageCard: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  messageBody: {
    flex: 1,
    gap: 2,
  },
  messageTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  messageName: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#2563eb",
  },
  messageSubject: {
    color: "#374151",
    fontSize: 13,
  },
  messageDate: {
    color: "#9ca3af",
    fontSize: 11,
  },
  detailHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  detailAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  detailAvatarText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  detailHeaderText: {
    flex: 1,
    gap: 2,
  },
  detailTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
  },
  detailMeta: {
    color: "#6b7280",
    fontSize: 12,
  },
  bodyCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#f9fafb",
    padding: 12,
  },
  bodyText: {
    color: "#111827",
    fontSize: 14,
    lineHeight: 20,
  },
  replyBtn: {
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  replyText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyDetailCard: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  modalPage: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 14,
    paddingTop: 28,
  },
});
