import { Feather } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type GuideSection = {
  title: string;
  purpose: string;
  steps: string[];
};

type Guide = {
  label: string;
  tone: string;
  audience: string;
  gettingStarted: string[];
  sections: GuideSection[];
  dailyChecklist: string[];
  commonMistakes: string[];
};

const GUIDE_DATA: Record<"admin" | "staff", Guide> = {
  admin: {
    label: "Admin",
    tone: "#1d4ed8",
    audience:
      "For administrators responsible for staffing strategy, schedules, approvals, communication, and billing.",
    gettingStarted: [
      "Log in and open Overview to confirm you are in the correct tenant workspace.",
      "Open Facility Preferences and verify role families, unit areas, shift types, shift definitions, and certification tags.",
      "Check Staff Management to confirm active staff profiles are complete and current.",
      "Open Coverage Planning and validate upcoming required staffing levels.",
    ],
    sections: [
      {
        title: "1. Dashboard and Alerts",
        purpose:
          "Use the dashboard as your control center for daily operational awareness.",
        steps: [
          "Review KPI cards first: staffing totals, pending decisions, unread messages, and upcoming shifts.",
          "Review chart trends to spot under-coverage risk before it becomes a scheduling issue.",
          "Use dashboard insights to prioritize actions, then complete tasks from Staff Management, Coverage Planning, and Schedule Builder pages.",
          "Revisit Overview after approvals or publishing to confirm metrics updated as expected.",
        ],
      },
      {
        title: "2. Facility Preferences and Taxonomy",
        purpose:
          "Maintain one source of truth for role and shift structure used across the app.",
        steps: [
          "Define role families and unit areas based on your facility's operational model.",
          "Create shift types and slot definitions that match real staffing windows.",
          "Add certification tags for compliance-sensitive assignments.",
          "Update taxonomy before schedule cycles so coverage and assignment rules remain consistent.",
        ],
      },
      {
        title: "3. Staff Management",
        purpose:
          "Keep accurate staff records to improve scheduling quality and reduce manual corrections.",
        steps: [
          "Use search and role filters to quickly locate profiles.",
          "Create or edit staff records with capability fields like allowed areas, shift tags, and certifications.",
          "Use CSV bulk import for onboarding waves and seasonal hiring periods.",
          "Regularly clean up inactive records to avoid accidental assignments.",
        ],
      },
      {
        title: "4. Coverage Planning",
        purpose:
          "Define staffing demand accurately so schedules can be built against real requirements.",
        steps: [
          "Use list view for quick updates and calendar view for time-based validation.",
          "For each coverage item, set role, date range, shift slot, and required headcount.",
          "Use the Time Slot select as a searchable field: type to filter, then choose an existing configured slot.",
          "Add unit area, shift type, shift tag, and certification requirements where needed.",
          "Choose the right submit action: save requirement only, or save and generate a draft schedule.",
          "Adjust headcount quickly when census or acuity changes.",
        ],
      },
      {
        title: "5. Schedule Builder and Draft Workflow",
        purpose:
          "Publish safer, higher-quality schedules through review-first drafting.",
        steps: [
          "Create single shifts manually for urgent edits or one-off assignments.",
          "Use auto-generate to produce draft schedules from selected open coverage records.",
          "Use open coverage card actions to create a draft directly from one specific coverage item when needed.",
          "Use the always-visible calendar workspace to compare live schedules, open coverage, and draft impact before publishing.",
          "Use Fill with AI on unfilled draft slots to retry one assignment without rerunning the full draft.",
          "Review each assignment for overtime warnings, consecutive day risks, and role compatibility.",
          "Edit draft assignments as needed, then publish selected items or publish all when publishable counts are available.",
        ],
      },
      {
        title: "6. Time Off Decisions",
        purpose:
          "Resolve requests quickly to keep schedules stable and predictable.",
        steps: [
          "Open pending requests at least once per shift handover.",
          "Approve or deny based on staffing impact and policy.",
          "After decisions, review open coverage and adjust schedule where needed.",
          "Use My Time Off Requests for your own personal requests.",
        ],
      },
      {
        title: "7. Shift Swaps, Messages, and Billing",
        purpose:
          "Maintain communication and service continuity while keeping account status healthy.",
        steps: [
          "Monitor shift swap statuses and intervene when requests remain pending too long.",
          "Use Messages for urgent staffing coordination and tenant-wide updates.",
          "Visit Billing to maintain active subscription and avoid operational lockout.",
          "After billing updates, confirm full feature access is restored.",
        ],
      },
    ],
    dailyChecklist: [
      "Start with Overview and urgent alerts.",
      "Process Time Off Decisions.",
      "Review open coverage and adjust requirements.",
      "Finalize draft schedules and publish approved updates.",
      "Clear important messages and unresolved swaps.",
    ],
    commonMistakes: [
      "Skipping Facility Preferences before major scheduling cycles.",
      "Publishing drafts without reviewing warnings.",
      "Leaving pending time-off decisions unresolved for too long.",
      "Ignoring capability and certification fields in staff profiles.",
    ],
  },
  staff: {
    label: "Non-Admin Staff",
    tone: "#047857",
    audience:
      "For staff users managing personal schedules, swaps, time-off, messages, and preferences.",
    gettingStarted: [
      "Log in and open Overview to review your current day and upcoming shifts.",
      "Open My Schedule to confirm this week's assignments.",
      "Open Preferences and update preferred days and notifications.",
      "Open Messages to catch unread updates from managers or teammates.",
    ],
    sections: [
      {
        title: "1. Overview and Daily Readiness",
        purpose: "Start each shift day with a quick readiness check.",
        steps: [
          "Review upcoming shifts and any new alerts visible on your dashboard.",
          "Check for newly published schedule changes.",
          "If something conflicts, open shift swaps or submit time-off as needed.",
          "Return to Overview after taking actions to verify your day is clear.",
        ],
      },
      {
        title: "2. My Schedule",
        purpose: "Track assignments and stay aligned with published updates.",
        steps: [
          "Review date, start and end times, and assigned role details.",
          "Use schedule views regularly so late changes do not get missed.",
          "If you find a conflict, start a swap request immediately.",
          "If details look incorrect, message your manager from the Messages page.",
        ],
      },
      {
        title: "3. Shift Swaps",
        purpose: "Handle unavoidable conflicts without losing visibility.",
        steps: [
          "Open a swap request directly from your assigned shift.",
          "Choose a colleague and submit a clear, accurate request.",
          "Monitor Inbox for requests sent to you and respond promptly.",
          "Use Sent to track requests you created and cancel when no longer needed.",
        ],
      },
      {
        title: "4. My Time Off Requests",
        purpose:
          "Request planned leave and track approval status transparently.",
        steps: [
          "Create a request with exact start and end date-time values.",
          "Add a concise reason when useful for decision context.",
          "Track request status as pending, approved, or denied.",
          "Submit early when possible to increase approval success and reduce schedule disruption.",
        ],
      },
      {
        title: "5. Messages",
        purpose:
          "Communicate clearly about staffing, swaps, and schedule updates.",
        steps: [
          "Check unread conversations at the beginning and end of each workday.",
          "Reply in-thread to keep conversation history intact.",
          "Use concise message subjects so conversations are easy to find later.",
          "When urgent, message early and include specific shift details.",
        ],
      },
      {
        title: "6. Preferences",
        purpose:
          "Improve schedule fit by keeping your availability signals current.",
        steps: [
          "Set preferred work days and update them when your routine changes.",
          "Verify notification preferences so you do not miss updates.",
          "Review preferences at least once per month.",
          "Remember: updated preferences improve planning, but do not guarantee every request.",
        ],
      },
    ],
    dailyChecklist: [
      "Open Overview and verify upcoming shifts.",
      "Check My Schedule for newly published changes.",
      "Respond to swap requests in Inbox and Sent.",
      "Track pending time-off requests.",
      "Read and reply to important messages.",
    ],
    commonMistakes: [
      "Submitting swap requests too late.",
      "Not checking messages after schedule publishes.",
      "Entering incorrect date-times for time-off requests.",
      "Leaving preferences outdated for long periods.",
    ],
  },
};

function getRoleLabel(role: "admin" | "staff") {
  return role === "admin"
    ? "Admin Instructions"
    : "Non-Admin Staff Instructions";
}

export default function HowToUsePage() {
  const [activeRole, setActiveRole] = useState<"admin" | "staff">("admin");
  const [expandedPanel, setExpandedPanel] = useState<string>("panel-0");

  const guide = useMemo(() => GUIDE_DATA[activeRole], [activeRole]);

  return (
    <ScrollView contentContainerStyle={styles.pageContent} style={styles.page}>
      <View
        style={[
          styles.heroCard,
          activeRole === "admin" ? styles.heroAdmin : styles.heroStaff,
        ]}
      >
        <Text style={styles.heroTitle}>How to Use WiserShifts</Text>
        <Text style={styles.heroText}>
          This page is designed as an interactive training center. Pick your
          role, follow the quick-start path, then work through each learning
          module. Everything is organized for fast scanning on mobile.
        </Text>

        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {guide.sections.length} Training Modules
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Role-Specific Steps</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Daily Checklist Included</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Select Your Role</Text>
        <View style={styles.toggleRow}>
          {(["admin", "staff"] as const).map((role) => {
            const selected = activeRole === role;
            return (
              <TouchableOpacity
                key={role}
                onPress={() => {
                  setActiveRole(role);
                  setExpandedPanel("panel-0");
                }}
                style={[
                  styles.toggle,
                  selected ? styles.toggleSelected : styles.toggleIdle,
                ]}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.toggleText,
                    selected
                      ? styles.toggleTextSelected
                      : styles.toggleTextIdle,
                  ]}
                >
                  {getRoleLabel(role)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>{guide.label} Guide</Text>
          <Text style={styles.infoText}>{guide.audience}</Text>
        </View>
      </View>

      <View
        style={[
          styles.card,
          styles.quickStartCard,
          { borderLeftColor: guide.tone },
        ]}
      >
        <Text style={styles.sectionTitle}>First 10 Minutes: Quick Start</Text>
        {guide.gettingStarted.map((item, index) => (
          <View key={`${item}-${index}`} style={styles.quickItemRow}>
            <View style={[styles.stepBubble, { backgroundColor: guide.tone }]}>
              <Text style={styles.stepBubbleText}>{index + 1}</Text>
            </View>
            <Text style={styles.quickItemText}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Learning Path</Text>
        <Text style={styles.sectionSubText}>
          Tap a module shortcut to jump.
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shortcutRow}
        >
          {guide.sections.map((section, index) => {
            const panel = `panel-${index}`;
            const selected = expandedPanel === panel;
            return (
              <Pressable
                key={section.title}
                onPress={() => setExpandedPanel(panel)}
                style={[
                  styles.shortcut,
                  selected
                    ? { backgroundColor: guide.tone, borderColor: guide.tone }
                    : styles.shortcutIdle,
                ]}
              >
                <Text
                  style={[
                    styles.shortcutText,
                    selected ? styles.shortcutTextSelected : null,
                  ]}
                >
                  {section.title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Training Modules</Text>
        <Text style={styles.sectionSubText}>
          Expand each module for step-by-step instructions.
        </Text>

        {guide.sections.map((section, index) => {
          const panel = `panel-${index}`;
          const isOpen = expandedPanel === panel;

          return (
            <View key={section.title} style={styles.moduleCard}>
              <Pressable
                style={styles.moduleHeader}
                onPress={() => setExpandedPanel(isOpen ? "" : panel)}
              >
                <View style={styles.moduleHeaderTextWrap}>
                  <Text style={styles.moduleTitle}>{section.title}</Text>
                  <Text style={styles.modulePurpose}>{section.purpose}</Text>
                </View>
                <Feather
                  name={isOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#334155"
                />
              </Pressable>

              {isOpen ? (
                <View style={styles.moduleBody}>
                  {section.steps.map((step, stepIndex) => (
                    <View
                      key={`${step}-${stepIndex}`}
                      style={styles.moduleStepRow}
                    >
                      <View style={styles.stepTag}>
                        <Text style={styles.stepTagText}>
                          Step {stepIndex + 1}
                        </Text>
                      </View>
                      <Text style={styles.moduleStepText}>{step}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{guide.label} Daily Checklist</Text>
        {guide.dailyChecklist.map((item, index) => (
          <View key={`${item}-${index}`} style={styles.listRow}>
            <Text style={styles.listIndex}>{index + 1}.</Text>
            <Text style={styles.listText}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Common Mistakes to Avoid</Text>
        {guide.commonMistakes.map((item, index) => (
          <View key={`${item}-${index}`} style={styles.listRow}>
            <Text style={styles.listIndex}>{index + 1}.</Text>
            <Text style={styles.listText}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>Training Tip</Text>
        <Text style={styles.tipText}>
          For onboarding sessions, walk through Quick Start first, then complete
          one module at a time using the Learning Path shortcuts. This improves
          retention and reduces overwhelm.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  pageContent: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  heroAdmin: {
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  heroStaff: {
    borderColor: "#a7f3d0",
    backgroundColor: "#ecfdf5",
  },
  heroTitle: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },
  heroText: {
    color: "#334155",
    lineHeight: 22,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  badge: {
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: "#1e293b",
    fontSize: 12,
    fontWeight: "700",
  },
  guideButton: {
    alignSelf: "flex-start",
    marginTop: 14,
    minHeight: 40,
    borderWidth: 1,
    borderColor: "#93c5fd",
    borderRadius: 9,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  guideButtonText: {
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: "800",
  },
  card: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#ffffff",
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 8,
  },
  sectionSubText: {
    color: "#4b5563",
    lineHeight: 20,
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  toggle: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  toggleSelected: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  toggleIdle: {
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
  },
  toggleText: {
    fontSize: 13,
    fontWeight: "700",
  },
  toggleTextSelected: {
    color: "#ffffff",
  },
  toggleTextIdle: {
    color: "#111827",
  },
  infoBox: {
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    padding: 10,
  },
  infoTitle: {
    color: "#1e3a8a",
    fontWeight: "800",
    marginBottom: 4,
  },
  infoText: {
    color: "#1e40af",
    lineHeight: 20,
  },
  quickStartCard: {
    borderLeftWidth: 4,
  },
  quickItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  stepBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  stepBubbleText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  quickItemText: {
    flex: 1,
    color: "#374151",
    lineHeight: 21,
  },
  shortcutRow: {
    gap: 8,
    paddingBottom: 2,
  },
  shortcut: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: 260,
  },
  shortcutIdle: {
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
  },
  shortcutText: {
    fontSize: 13,
    fontWeight: "700",
  },
  shortcutTextSelected: {
    color: "#ffffff",
  },
  moduleCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    marginBottom: 8,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  moduleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  moduleHeaderTextWrap: {
    flex: 1,
  },
  moduleTitle: {
    color: "#0f172a",
    fontWeight: "800",
  },
  modulePurpose: {
    color: "#64748b",
    marginTop: 3,
    lineHeight: 19,
  },
  moduleBody: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 8,
  },
  moduleStepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  stepTag: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 1,
  },
  stepTagText: {
    color: "#1f2937",
    fontSize: 11,
    fontWeight: "700",
  },
  moduleStepText: {
    flex: 1,
    color: "#1f2937",
    lineHeight: 21,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 7,
  },
  listIndex: {
    color: "#1f2937",
    fontWeight: "700",
    minWidth: 18,
  },
  listText: {
    flex: 1,
    color: "#374151",
    lineHeight: 20,
  },
  tipCard: {
    borderWidth: 1,
    borderColor: "#86efac",
    borderRadius: 14,
    backgroundColor: "#f0fdf4",
    padding: 12,
    marginBottom: 8,
  },
  tipTitle: {
    color: "#14532d",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 5,
  },
  tipText: {
    color: "#166534",
    lineHeight: 21,
  },
});
