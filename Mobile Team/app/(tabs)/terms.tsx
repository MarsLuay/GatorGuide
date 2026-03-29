import type { ReactNode } from "react";
import { View, Text, Pressable, ScrollView, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { ROUTES } from "@/constants/routes";
import { SUPPORT_EMAIL } from "@/constants/support";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";

export default function TermsOfServicePage() {
  const { isDark } = useAppTheme();
  const router = useRouter();
  const { getScrollContentPadding } = useResponsiveLayout();
  const { width } = useWindowDimensions();

  const textClass = isDark ? "text-white" : "text-emerald-900";
  const secondaryTextClass = isDark ? "text-white/90" : "text-emerald-700";
  const cardBgClass = isDark ? "bg-gray-900/80 border-gray-800" : "bg-white border-emerald-200";
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
            <Pressable onPress={() => router.replace(ROUTES.tabsSettings)} className="mb-4 flex-row items-center self-start">
              <MaterialIcons name="arrow-back" size={20} color={isDark ? "#b6e2b6" : "#1f8a5d"} />
              <Text className={`${secondaryTextClass} ml-2`}>Back</Text>
            </Pressable>

            <Text className={`text-2xl ${textClass}`}>Terms of Service</Text>
            <Text className={`${secondaryTextClass} mt-2 text-sm`}>Last updated: {lastUpdated}</Text>
          </View>

          <View style={{ width: "100%", maxWidth: readableMaxWidth, alignSelf: "center", marginBottom: sectionGap }}>
            <View className={`${cardBgClass} border rounded-2xl gap-3`} style={{ padding: cardPadding }}>
              <Text className={`${secondaryTextClass} text-sm`} style={{ lineHeight: 22 }}>
                GatorGuide provides planning tools, recommendations, and AI-assisted guidance for transfer applications.
              </Text>
              <Text className={`${secondaryTextClass} text-sm`} style={{ lineHeight: 22 }}>
                It is for informational purposes and does not guarantee admission or outcomes.
              </Text>
            </View>
          </View>

          <Section title="Eligibility" textClass={textClass} maxWidth={readableMaxWidth}>
            <Card cardBgClass={cardBgClass} cardPadding={cardPadding}>
              <Text className={`${secondaryTextClass} text-sm`} style={{ lineHeight: 22 }}>
                The App is intended for college students planning to transfer. You agree to follow applicable laws and any school rules that
                apply to your use.
              </Text>
            </Card>
          </Section>

          <Section title="Acceptable use" textClass={textClass} maxWidth={readableMaxWidth}>
            <Card cardBgClass={cardBgClass} cardPadding={cardPadding}>
              <Bullet textClass={secondaryTextClass}>Do not misuse the App, attempt to hack it, or disrupt other users.</Bullet>
              <Bullet textClass={secondaryTextClass}>Do not reverse engineer, scrape, or abuse the service.</Bullet>
              <Bullet textClass={secondaryTextClass}>
                Use AI guidance responsibly and verify important details (deadlines, requirements) with official university sources.
              </Bullet>
            </Card>
          </Section>

          <Section title="Accounts" textClass={textClass} maxWidth={readableMaxWidth}>
            <Card cardBgClass={cardBgClass} cardPadding={cardPadding}>
              <Bullet textClass={secondaryTextClass}>You are responsible for activity under your account.</Bullet>
              <Bullet textClass={secondaryTextClass}>Keep your login credentials secure.</Bullet>
            </Card>
          </Section>

          <Section title="AI features" textClass={textClass} maxWidth={readableMaxWidth}>
            <Card cardBgClass={cardBgClass} cardPadding={cardPadding}>
              <Text className={`${secondaryTextClass} text-sm`} style={{ lineHeight: 22 }}>
                The App may provide AI-assisted writing guidance and recommendations. AI output can be inaccurate or incomplete, and you are
                responsible for how you use it and for verifying information.
              </Text>
            </Card>
          </Section>

          <Section title="Intellectual property" textClass={textClass} maxWidth={readableMaxWidth}>
            <Card cardBgClass={cardBgClass} cardPadding={cardPadding}>
              <Text className={`${secondaryTextClass} text-sm`} style={{ lineHeight: 22 }}>
                The design and original content of the App belong to the GatorGuide team and are protected by applicable laws. You may not copy or
                redistribute the App except as permitted by law.
              </Text>
            </Card>
          </Section>

          <Section title="Disclaimers" textClass={textClass} maxWidth={readableMaxWidth}>
            <Card cardBgClass={cardBgClass} cardPadding={cardPadding}>
              <Text className={`${secondaryTextClass} text-sm`} style={{ lineHeight: 22 }}>
                The App is provided as-is without warranties. We do not guarantee availability, accuracy, or results related to admissions,
                scholarships, or transfer outcomes.
              </Text>
            </Card>
          </Section>

          <Section title="Limitation of liability" textClass={textClass} maxWidth={readableMaxWidth}>
            <Card cardBgClass={cardBgClass} cardPadding={cardPadding}>
              <Text className={`${secondaryTextClass} text-sm`} style={{ lineHeight: 22 }}>
                To the fullest extent permitted by law, we are not liable for indirect, incidental, special, or consequential damages arising
                from your use of the App.
              </Text>
            </Card>
          </Section>

          <Section title="Changes to these Terms" textClass={textClass} maxWidth={readableMaxWidth}>
            <Card cardBgClass={cardBgClass} cardPadding={cardPadding}>
              <Text className={`${secondaryTextClass} text-sm`} style={{ lineHeight: 22 }}>
                We may update these Terms from time to time. Continued use after changes means you accept the updated Terms.
              </Text>
            </Card>
          </Section>

          <Section title="Contact us" textClass={textClass} maxWidth={readableMaxWidth}>
            <Card cardBgClass={cardBgClass} cardPadding={cardPadding}>
              <Text className={`${secondaryTextClass} text-sm`} style={{ lineHeight: 22 }}>
                Questions about these Terms? Contact us at <Text className={textClass}>{contactEmail}</Text>.
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
  return (
    <View className={`${cardBgClass} border rounded-2xl gap-3`} style={{ padding: cardPadding }}>
      {children}
    </View>
  );
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
