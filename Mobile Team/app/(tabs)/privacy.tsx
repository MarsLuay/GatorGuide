import type { ReactNode } from "react";
import { View, Text, ScrollView, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { ROUTES } from "@/constants/routes";
import { SUPPORT_EMAIL } from "@/constants/support";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { AnimatedIconPressable } from "@/components/ui/AnimatedPressables";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";

export default function PrivacyPolicyPage() {
  const { isDark } = useAppTheme();
  const router = useRouter();
  const { getScrollContentPadding } = useResponsiveLayout();
  const { width } = useWindowDimensions();

  const textClass = isDark ? "text-white" : "text-emerald-900";
  const secondaryTextClass = isDark ? "text-white/90" : "text-emerald-700";
  const cardBgClass = isDark ? "bg-gray-900/80 border-gray-800" : "bg-white border-emerald-200";
  const borderClass = isDark ? "border-gray-800" : "border-emerald-300";
  const isCompactPhone = width < 390;
  const isTablet = width >= 768;
  const isWideLayout = width >= 1100;
  const shellHorizontalPadding = width >= 1280 ? 32 : isTablet ? 24 : isCompactPhone ? 16 : 20;
  const pageMaxWidth = isWideLayout ? 1080 : isTablet ? 920 : 720;
  const readableMaxWidth = isWideLayout ? 860 : isTablet ? 800 : 720;
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
    extraTop: 16,
  });
  const cardPadding = isTablet ? 24 : 20;
  const sectionGap = 24;

  const lastUpdated = "February 11, 2026";
  const contactEmail = SUPPORT_EMAIL;

  return (
    <ScreenBackground includeBottomInset={false}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={scrollContentPadding}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            width: "100%",
            maxWidth: pageMaxWidth,
            alignSelf: "center",
            paddingHorizontal: shellHorizontalPadding,
          }}
        >
          <View style={{ width: "100%", maxWidth: readableMaxWidth, alignSelf: "center", paddingBottom: 24 }}>
            <AnimatedIconPressable
              onPress={() => router.replace(ROUTES.tabsSettings)}
              containerClassName="mb-4 self-start"
              className="flex-row items-center"
            >
              <MaterialIcons name="arrow-back" size={20} color={isDark ? "#b6e2b6" : "#1f8a5d"} />
              <Text className={`${secondaryTextClass} ml-2`}>Back</Text>
            </AnimatedIconPressable>

            <Text className={`text-2xl ${textClass}`}>Privacy Policy</Text>
            <Text className={`${secondaryTextClass} mt-2 text-sm`}>Last updated: {lastUpdated}</Text>
          </View>

          <View style={{ width: "100%", maxWidth: readableMaxWidth, alignSelf: "center", marginBottom: sectionGap }}>
            <View className={`${cardBgClass} border rounded-2xl gap-3`} style={{ padding: cardPadding }}>
              <Text className={`${secondaryTextClass} text-sm`} style={{ lineHeight: 22 }}>
                GatorGuide helps Green River College students plan transfers by providing personalized university suggestions,
                portfolio guidance, deadline reminders, and an AI chat feature.
              </Text>
              <Text className={`${secondaryTextClass} text-sm`} style={{ lineHeight: 22 }}>
                We do <Text className={textClass}>not sell</Text> your personal information.
              </Text>
            </View>
          </View>

          <Section title="Information we collect" textClass={textClass} maxWidth={readableMaxWidth}>
            <Card cardBgClass={cardBgClass} cardPadding={cardPadding}>
              <Bullet textClass={secondaryTextClass}>Account details (such as name and email) when you create an account or log in.</Bullet>
              <Bullet textClass={secondaryTextClass}>
                Profile information you provide: intended major/field of study, GPA (optional), test scores (optional), and transcript upload (optional).
              </Bullet>
              <Bullet textClass={secondaryTextClass}>Questionnaire responses used to understand preferences and strengths.</Bullet>
              <Bullet textClass={secondaryTextClass}>Goal university list, comparisons, and saved preferences.</Bullet>
              <Bullet textClass={secondaryTextClass}>Notification preferences for deadline alerts and reminders.</Bullet>
              <Bullet textClass={secondaryTextClass}>
                AI chat prompts and responses (depending on how the app is configured, chats may be processed to provide responses and may be stored to
                improve reliability and support).
              </Bullet>
              <Bullet textClass={secondaryTextClass}>Basic technical data (app version, device type, crash logs) to improve stability.</Bullet>
            </Card>
          </Section>

          <Section title="How we use information" textClass={textClass} maxWidth={readableMaxWidth}>
            <Card cardBgClass={cardBgClass} cardPadding={cardPadding}>
              <Bullet textClass={secondaryTextClass}>Provide core features: recommendations, portfolio guidance, AI chat, and alerts.</Bullet>
              <Bullet textClass={secondaryTextClass}>Personalize results based on your profile, goals, and preferences.</Bullet>
              <Bullet textClass={secondaryTextClass}>Troubleshoot, secure the app, and fix bugs.</Bullet>
              <Bullet textClass={secondaryTextClass}>Respond to support requests if you contact us.</Bullet>
            </Card>
          </Section>

          <Section title="Sharing of information" textClass={textClass} maxWidth={readableMaxWidth}>
            <Card cardBgClass={cardBgClass} cardPadding={cardPadding}>
              <Text className={`${secondaryTextClass} text-sm`} style={{ lineHeight: 22 }}>
                We may share limited information only when needed:
              </Text>
              <View className={`my-2 border-t ${borderClass}`} />
              <Bullet textClass={secondaryTextClass}>
                With service providers that help operate the app (hosting, authentication, analytics/crash reporting, file storage for resumes), only as needed.
              </Bullet>
              <Bullet textClass={secondaryTextClass}>If required by law or to protect the safety and security of users and the app.</Bullet>
              <Bullet textClass={secondaryTextClass}>With your consent.</Bullet>
            </Card>
          </Section>

          <Section title="Data retention" textClass={textClass} maxWidth={readableMaxWidth}>
            <Card cardBgClass={cardBgClass} cardPadding={cardPadding}>
              <Text className={`${secondaryTextClass} text-sm`} style={{ lineHeight: 22 }}>
                We retain information for as long as necessary to provide the app and for legitimate purposes such as security,
                troubleshooting, and compliance. If account deletion is available, deleting your account will remove or anonymize
                associated data within a reasonable period, unless certain records must be kept for legal or security reasons.
              </Text>
            </Card>
          </Section>

          <Section title="Your choices" textClass={textClass} maxWidth={readableMaxWidth}>
            <Card cardBgClass={cardBgClass} cardPadding={cardPadding}>
              <Bullet textClass={secondaryTextClass}>Edit your profile information inside the app.</Bullet>
              <Bullet textClass={secondaryTextClass}>Turn notifications on/off in Settings and your device settings.</Bullet>
              <Bullet textClass={secondaryTextClass}>Uninstall the app to stop further collection from your device.</Bullet>
              <Bullet textClass={secondaryTextClass}>Use Delete Account (if enabled) to request deletion of your account and related data.</Bullet>
            </Card>
          </Section>

          <Section title="Contact us" textClass={textClass} maxWidth={readableMaxWidth}>
            <Card cardBgClass={cardBgClass} cardPadding={cardPadding}>
              <Text className={`${secondaryTextClass} text-sm`} style={{ lineHeight: 22 }}>
                Questions about this Privacy Policy? Contact us at <Text className={textClass}>{contactEmail}</Text>.
              </Text>
            </Card>
          </Section>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

function Section({
  title,
  children,
  textClass,
  maxWidth,
}: {
  title: string;
  children: ReactNode;
  textClass: string;
  maxWidth: number;
}) {
  return (
    <View style={{ width: "100%", maxWidth, alignSelf: "center", marginBottom: 24 }}>
      <Text className={`${textClass} mb-3 px-2`}>{title}</Text>
      {children}
    </View>
  );
}

function Card({
  children,
  cardBgClass,
  cardPadding,
}: {
  children: ReactNode;
  cardBgClass: string;
  cardPadding: number;
}) {
  return <View className={`${cardBgClass} border rounded-2xl gap-3`} style={{ padding: cardPadding }}>{children}</View>;
}

function Bullet({ children, textClass }: { children: ReactNode; textClass: string }) {
  return (
    <View className="flex-row items-start">
      <Text className={`${textClass} mr-2`}>{"\u2022"}</Text>
      <Text className={`${textClass} flex-1 text-sm`} style={{ lineHeight: 22 }}>
        {children}
      </Text>
    </View>
  );
}
