import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from "react-native";

const HERO_IMAGE_URI =
  "https://images.pexels.com/photos/7579831/pexels-photo-7579831.jpeg?auto=compress&cs=tinysrgb&w=1200";

const INDUSTRIES = [
  "Healthcare",
  "Hospitality",
  "Retail",
  "Warehousing & Logistics",
  "Security Services",
  "Manufacturing",
  "Cleaning & Janitorial",
  "Home Care",
  "Construction",
  "Education",
  "Restaurants",
  "Events & Venues",
  "Transportation",
  "Customer Support",
] as const;

const BENEFITS = [
  {
    icon: "shuffle",
    title: "Handle call-outs calmly",
    text: "Fill gaps without cascading changes or guesswork.",
  },
  {
    icon: "clock",
    title: "See risk early",
    text: "Understand overtime impact before schedules go live.",
  },
  {
    icon: "users",
    title: "Rotating staff made manageable",
    text: "Keep part-time, float, and rotating roles organized.",
  },
  {
    icon: "check-circle",
    title: "Clear communication",
    text: "One publish updates everyone at once.",
  },
] as const;

const TESTIMONIALS = [
  {
    quote: "Call-outs used to derail the entire day. Now they are manageable.",
    name: "Nursing Home Operations Lead",
    role: "Outpatient services",
  },
  {
    quote: "We finally see overtime before it becomes a payroll problem.",
    name: "Practice Manager",
    role: "Specialty clinic",
  },
  {
    quote: "Rotating staff no longer means spreadsheet chaos.",
    name: "Scheduler",
    role: "Multi-site clinic",
  },
] as const;

type HomeScreenStyles = {
  safeArea: ViewStyle;
  content: ViewStyle;
  heroWrap: ViewStyle;
  heroLeft: ViewStyle;
  heroTitle: TextStyle;
  heroSubtitle: TextStyle;
  industryStripWrap: ViewStyle;
  industryStrip: ViewStyle;
  industryChip: ViewStyle;
  industryChipText: TextStyle;
  heroImage: ImageStyle;
  heroActionRow: ViewStyle;
  buttonBase: ViewStyle;
  buttonFilled: ViewStyle;
  buttonOutline: ViewStyle;
  buttonFilledText: TextStyle;
  buttonOutlineText: TextStyle;
  buttonIcon: TextStyle;
  buttonPressed: ViewStyle;
  buttonFullWidth: ViewStyle;
  divider: ViewStyle;
  heroRight: ViewStyle;
  scheduleCard: ViewStyle;
  scheduleCardTitle: TextStyle;
  healthRow: ViewStyle;
  healthLabel: TextStyle;
  healthChip: ViewStyle;
  healthChipWarning: ViewStyle;
  healthChipSuccess: ViewStyle;
  healthChipText: TextStyle;
  statRow: ViewStyle;
  statWrap: ViewStyle;
  statValue: TextStyle;
  statLabel: TextStyle;
  roiStripCard: ViewStyle;
  roiEyebrow: TextStyle;
  roiTitle: TextStyle;
  roiSubtitle: TextStyle;
  roiButtonWrap: ViewStyle;
  section: ViewStyle;
  sectionTitleWrap: ViewStyle;
  sectionEyebrow: TextStyle;
  sectionTitle: TextStyle;
  sectionSubtitle: TextStyle;
  benefitGrid: ViewStyle;
  iconBulletRow: ViewStyle;
  iconBulletIconWrap: ViewStyle;
  iconBulletCopy: ViewStyle;
  iconBulletTitle: TextStyle;
  iconBulletText: TextStyle;
  testimonialGrid: ViewStyle;
  testimonialCard: ViewStyle;
  testimonialQuote: TextStyle;
  testimonialAuthorRow: ViewStyle;
  avatarBubble: ViewStyle;
  avatarText: TextStyle;
  testimonialName: TextStyle;
  testimonialRole: TextStyle;
  ctaCard: ViewStyle;
  ctaTitle: TextStyle;
  ctaText: TextStyle;
  ctaActionStack: ViewStyle;
  mobileStickyCta: ViewStyle;
};

function Section({ children }: { children: React.ReactNode }) {
  return <View style={styles.section}>{children}</View>;
}

function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionTitleWrap}>
      {eyebrow ? <Text style={styles.sectionEyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statWrap}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function IconBullet({
  icon,
  title,
  text,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  text: string;
}) {
  return (
    <View style={styles.iconBulletRow}>
      <View style={styles.iconBulletIconWrap}>
        <Feather name={icon} size={20} color="#1976d2" />
      </View>
      <View style={styles.iconBulletCopy}>
        <Text style={styles.iconBulletTitle}>{title}</Text>
        <Text style={styles.iconBulletText}>{text}</Text>
      </View>
    </View>
  );
}

function Testimonial({
  quote,
  name,
  role,
}: {
  quote: string;
  name: string;
  role: string;
}) {
  return (
    <View style={styles.testimonialCard}>
      <Text style={styles.testimonialQuote}>{`"${quote}"`}</Text>
      <View style={styles.testimonialAuthorRow}>
        <View style={styles.avatarBubble}>
          <Text style={styles.avatarText}>{name.charAt(0)}</Text>
        </View>
        <View>
          <Text style={styles.testimonialName}>{name}</Text>
          <Text style={styles.testimonialRole}>{role}</Text>
        </View>
      </View>
    </View>
  );
}

function ActionButton({
  label,
  variant,
  onPress,
  icon,
  fullWidth,
}: {
  label: string;
  variant: "filled" | "outline";
  onPress: () => void;
  icon?: React.ComponentProps<typeof Feather>["name"];
  fullWidth?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonBase,
        variant === "filled" ? styles.buttonFilled : styles.buttonOutline,
        fullWidth ? styles.buttonFullWidth : null,
        pressed ? styles.buttonPressed : null,
      ]}
    >
      {icon ? (
        <Feather
          name={icon}
          size={16}
          color={variant === "filled" ? "#ffffff" : "#0f172a"}
          style={styles.buttonIcon}
        />
      ) : null}
      <Text
        style={
          variant === "filled"
            ? styles.buttonFilledText
            : styles.buttonOutlineText
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const industryScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let offset = 0;
    const step = 148;
    const maxOffset = INDUSTRIES.length * step;

    const timer = setInterval(() => {
      offset = offset >= maxOffset ? 0 : offset + step;
      industryScrollRef.current?.scrollTo({ x: offset, animated: true });
    }, 3200);

    return () => clearInterval(timer);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroWrap}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroTitle}>
              Workforce Scheduling{"\n"}
              That Works For Your People and Your Profits.
            </Text>

            <Text style={styles.heroSubtitle}>
              We support various industries like:
            </Text>

            <View style={styles.industryStripWrap}>
              <ScrollView
                ref={industryScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.industryStrip}
              >
                {INDUSTRIES.map((industry) => (
                  <View key={industry} style={styles.industryChip}>
                    <Text style={styles.industryChipText}>{industry}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            <View style={styles.heroActionRow}>
              <ActionButton
                label="Sign Up"
                variant="filled"
                icon="user"
                onPress={() => router.push("/signup-tenant")}
              />
              <ActionButton
                label="Log in"
                variant="outline"
                icon="user"
                onPress={() => router.push("/login")}
              />
            </View>

            <View style={styles.divider} />
          </View>

          <View style={styles.heroRight}>
            <Image
              source={{ uri: HERO_IMAGE_URI }}
              style={styles.heroImage}
              contentFit="cover"
              transition={220}
            />

            <View style={styles.scheduleCard}>
              <Text style={styles.scheduleCardTitle}>
                Today&apos;s schedule health
              </Text>
              <View style={styles.healthRow}>
                <Text style={styles.healthLabel}>Coverage gaps</Text>
                <View style={styles.healthChip}>
                  <Text style={styles.healthChipText}>2</Text>
                </View>
              </View>
              <View style={styles.healthRow}>
                <Text style={styles.healthLabel}>Overtime risk</Text>
                <View style={[styles.healthChip, styles.healthChipWarning]}>
                  <Text style={styles.healthChipText}>Medium</Text>
                </View>
              </View>
              <View style={styles.healthRow}>
                <Text style={styles.healthLabel}>Last-minute change</Text>
                <View style={[styles.healthChip, styles.healthChipSuccess]}>
                  <Text style={styles.healthChipText}>Resolved</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.statRow}>
                <Stat value="↓" label="Fewer gaps" />
                <Stat value="⚡" label="Faster changes" />
                <Stat value="✓" label="Clear handoffs" />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.roiStripCard}>
          <Text style={styles.roiEyebrow}>New for operators</Text>
          <Text style={styles.roiTitle}>
            See your annual turnover cost in dollars
          </Text>
          <Text style={styles.roiSubtitle}>
            Use the LTC ROI Calculator to estimate turnover impact and projected
            WiserShifts savings in under 2 minutes.
          </Text>
          <View style={styles.roiButtonWrap}>
            <ActionButton
              label="Open LTC ROI Calculator"
              variant="filled"
              onPress={() => router.push("/turnover-roi-calculator")}
              fullWidth
            />
          </View>
        </View>

        <Section>
          <SectionTitle
            eyebrow="Why it works"
            title="Workforce Scheduling built for real senior living facility conditions"
            subtitle="Designed around constant change, not ideal scenarios."
          />
          <View style={styles.benefitGrid}>
            {BENEFITS.map((benefit) => (
              <IconBullet
                key={benefit.title}
                icon={benefit.icon}
                title={benefit.title}
                text={benefit.text}
              />
            ))}
          </View>
        </Section>

        <Section>
          <SectionTitle
            eyebrow="What teams experience"
            title="Less chaos. More predictability."
          />
          <View style={styles.testimonialGrid}>
            {TESTIMONIALS.map((testimonial) => (
              <Testimonial
                key={testimonial.name}
                quote={testimonial.quote}
                name={testimonial.name}
                role={testimonial.role}
              />
            ))}
          </View>
        </Section>

        <Section>
          <View style={styles.ctaCard}>
            <Text style={styles.ctaTitle}>Start Scheduling The Smart Way</Text>
            <Text style={styles.ctaText}>
              Walk through your staffing patterns in a short demo.
            </Text>
            <View style={styles.ctaActionStack}>
              <ActionButton
                label="Request a demo"
                variant="filled"
                icon="phone-call"
                onPress={() =>
                  Linking.openURL("https://calendly.com/wisershifts-info/30min")
                }
                fullWidth
              />
              <ActionButton
                label="Sign Up"
                variant="outline"
                onPress={() => router.push("/signup-tenant")}
                fullWidth
              />
            </View>
          </View>
        </Section>
      </ScrollView>

      <View style={styles.mobileStickyCta}>
        <ActionButton
          label="Book a demo"
          variant="filled"
          icon="phone-call"
          onPress={() =>
            Linking.openURL("https://calendly.com/wisershifts-info/30min")
          }
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create<HomeScreenStyles>({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 110,
    gap: 22,
  },
  heroWrap: {
    gap: 18,
  },
  heroLeft: {
    gap: 12,
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 37,
    fontWeight: "900",
    letterSpacing: -1,
    color: "#0f172a",
  },
  heroSubtitle: {
    fontSize: 17,
    lineHeight: 24,
    color: "#475569",
    marginTop: 6,
  },
  industryStripWrap: {
    marginTop: 2,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#e5e5ea",
    borderRadius: 16,
    backgroundColor: "#fafafc",
    overflow: "hidden",
  },
  industryStrip: {
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  industryChip: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "transparent",
  },
  industryChipText: {
    color: "#1d1d1f",
    fontSize: 13,
    fontWeight: "600",
  },
  heroImage: {
    height: 230,
    borderRadius: 24,
    backgroundColor: "#e2e8f0",
  },
  heroActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  buttonBase: {
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonFilled: {
    backgroundColor: "#1565c0",
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.2)",
    backgroundColor: "#ffffff",
  },
  buttonFilledText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },
  buttonOutlineText: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 14,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonFullWidth: {
    width: "100%",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(15, 23, 42, 0.08)",
    marginVertical: 4,
  },
  heroRight: {
    gap: 12,
  },
  scheduleCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.12)",
    padding: 14,
    gap: 10,
    backgroundColor: "#ffffff",
  },
  scheduleCardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
  },
  healthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  healthLabel: {
    color: "#0f172a",
    fontSize: 14,
  },
  healthChip: {
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.07)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  healthChipWarning: {
    backgroundColor: "#fef3c7",
  },
  healthChipSuccess: {
    backgroundColor: "#dcfce7",
  },
  healthChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  statWrap: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
  },
  statLabel: {
    fontSize: 12,
    color: "#475569",
    textAlign: "center",
  },
  roiStripCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(21, 101, 192, 0.18)",
    padding: 16,
    backgroundColor: "#eff6ff",
    gap: 8,
  },
  roiEyebrow: {
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "#475569",
    fontWeight: "700",
  },
  roiTitle: {
    fontSize: 24,
    lineHeight: 27,
    fontWeight: "900",
    color: "#0f172a",
  },
  roiSubtitle: {
    color: "#334155",
    lineHeight: 21,
  },
  roiButtonWrap: {
    marginTop: 6,
  },
  section: {
    gap: 14,
    paddingTop: 8,
  },
  sectionTitleWrap: {
    alignItems: "center",
    gap: 6,
  },
  sectionEyebrow: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    color: "#64748b",
    fontWeight: "700",
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 28,
    lineHeight: 31,
    fontWeight: "900",
    letterSpacing: -0.4,
    color: "#0f172a",
    textAlign: "center",
  },
  sectionSubtitle: {
    color: "#475569",
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
  },
  benefitGrid: {
    gap: 16,
  },
  iconBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconBulletIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(21, 101, 192, 0.09)",
  },
  iconBulletCopy: {
    flex: 1,
    gap: 2,
  },
  iconBulletTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
  },
  iconBulletText: {
    color: "#475569",
    lineHeight: 21,
  },
  testimonialGrid: {
    gap: 10,
  },
  testimonialCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.12)",
    padding: 14,
    gap: 12,
    backgroundColor: "#ffffff",
  },
  testimonialQuote: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 21,
  },
  testimonialAuthorRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  avatarBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dbeafe",
  },
  avatarText: {
    color: "#0f172a",
    fontWeight: "800",
  },
  testimonialName: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 13,
  },
  testimonialRole: {
    color: "#64748b",
    fontSize: 12,
  },
  ctaCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.12)",
    padding: 16,
    gap: 8,
    backgroundColor: "#f8fafc",
  },
  ctaTitle: {
    fontSize: 29,
    lineHeight: 33,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: -0.6,
  },
  ctaText: {
    color: "#475569",
    fontSize: 15,
  },
  ctaActionStack: {
    gap: 10,
    marginTop: 8,
  },
  mobileStickyCta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(15, 23, 42, 0.1)",
    backgroundColor: "#ffffff",
  },
});
