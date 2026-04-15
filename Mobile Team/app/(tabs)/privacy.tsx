import type { ComponentProps, ReactNode } from "react";
import {
  Linking,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { SUPPORT_EMAIL } from "@/constants/support";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { AnimatedIconPressable } from "@/components/ui/AnimatedPressables";
import { GatorGuideMark } from "@/components/ui/GatorGuideMark";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";

export default function PrivacyPolicyPage() {
  const { isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const router = useRouter();
  const { getScrollContentPadding } = useResponsiveLayout();
  const { width } = useWindowDimensions();

  const textClass = isDark ? "text-white" : "text-emerald-900";
  const secondaryTextClass = isDark ? "text-white/90" : "text-emerald-700";
  const cardBgClass = isDark
    ? "bg-gray-900/80 border-gray-800"
    : "bg-white border-emerald-200";
  const mutedCardClass = isDark
    ? "bg-neutral-800 border-neutral-700"
    : "bg-gray-50 border-gray-200";
  const accentCardClass = isDark
    ? "bg-emerald-900/25 border-emerald-800"
    : "bg-emerald-50 border-emerald-200";
  const iconColor = isDark ? "#9ae6b4" : "#1f8a5d";
  const isCompactPhone = width < 390;
  const isTablet = width >= 768;
  const isWideLayout = width >= 1120;
  const showSplitHero = width >= 980;
  const showTwoColumnGrid = width >= 860;
  const showThreeColumnGrid = width >= 1080;
  const shellHorizontalPadding =
    width >= 1280 ? 32 : isTablet ? 24 : isCompactPhone ? 16 : 20;
  const pageMaxWidth = isWideLayout ? 1140 : isTablet ? 920 : 700;
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
    extraTop: 16,
  });
  const sectionGap = isTablet ? 24 : 20;
  const cardPadding = isTablet ? 24 : 20;
  const heroPanelWidth = showSplitHero ? 290 : "100%";
  const twoColumnWidth = showTwoColumnGrid ? "48.6%" : "100%";
  const threeColumnWidth = showThreeColumnGrid
    ? "31.8%"
    : showTwoColumnGrid
      ? "48.6%"
      : "100%";
  const gridCardMinHeight = isWideLayout ? 156 : isTablet ? 148 : undefined;

  const contactEmail = SUPPORT_EMAIL;
  const mailtoUrl = `mailto:${contactEmail}`;

  const heroBadges = [
    "No sale of personal info",
    "Guest mode available",
    "Transcript stored locally",
    "Delete account supported",
  ];

  const privacySteps = [
    {
      n: "1",
      title: "Choose your mode",
      body: "Use guest mode to keep planning on this device, or sign in if you want account-based syncing across Firebase-backed features.",
    },
    {
      n: "2",
      title: "Add only what you need",
      body: "Profile details, saved schools, deadlines, and uploads come from what you choose to enter. Resume, avatar, and transcript uploads are optional.",
    },
    {
      n: "3",
      title: "Keep local files local-first",
      body: "Unofficial transcripts, reminder records, and several app caches stay on your device instead of being broadly synced.",
    },
    {
      n: "4",
      title: "Send data only for active tools",
      body: "AI chat, ranking help, roadmap generation, and document review send the request and selected context to the app's AI gateway when used.",
    },
  ];

  const collectionCards: DetailCardItem[] = [
    {
      icon: "person-outline",
      title: "Account",
      body: "Name, email, sign-in provider, and Firebase account details when you create or use an account.",
    },
    {
      icon: "school",
      title: "Planning data",
      body: "Major, GPA, preferences, questionnaire answers, saved colleges, deadlines, opportunity status, and roadmap progress.",
    },
    {
      icon: "description",
      title: "Files you upload",
      body: "Optional resume, avatar image, unofficial transcript PDF, and other planning documents you choose to attach.",
    },
    {
      icon: "bug-report",
      title: "Support and diagnostics",
      body: "Support messages plus limited app diagnostics used to troubleshoot issues, with obvious secrets redacted before logging.",
    },
  ];

  const storageCards: DetailCardItem[] = [
    {
      icon: "smartphone",
      title: "Stored on your device",
      bullets: [
        "Guest-mode data, local app state, AI response cache, and reminder records.",
        "Unofficial transcript files, avatar images, roadmap documents, and some fallback file storage.",
      ],
    },
    {
      icon: "cloud-queue",
      title: "Stored in Firebase or cloud services",
      bullets: [
        "Firebase Authentication, Firestore, and Storage can hold signed-in account data, synced planning data, and some uploaded files.",
        "The AI gateway keeps quota and usage records tied to your account or a device-generated client ID when AI features are used.",
      ],
    },
  ];

  const controlCards: DetailCardItem[] = [
    {
      icon: "auto-awesome",
      title: "AI features",
      bullets: [
        "Chat, roadmap, ranking help, and document analysis send the prompt and selected planning context through a Firebase-hosted gateway backed by Google Gemini.",
        "If you ask the app to read a resume or transcript, the file contents and metadata are sent for extraction while the transcript file still remains stored locally on your device.",
      ],
    },
    {
      icon: "share",
      title: "Sharing and services",
      bullets: [
        "Data is shared only with services needed to run the feature you are using, including Firebase / Google Cloud, Google Gemini, Google or Microsoft sign-in, College Scorecard, and support delivery tools.",
        "We do not sell your personal information and the app does not currently register a remote push token for push notifications.",
      ],
    },
    {
      icon: "tune",
      title: "Your choices",
      bullets: [
        "Use guest mode, skip optional AI features, edit or remove planning fields, and turn notifications on or off in the app and device settings.",
        "Delete Account is designed to remove Firebase account data and synced files, while local files on your current device may remain until app storage is cleared or the app is uninstalled.",
      ],
    },
  ];

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
          <View className="pb-6">
            <AnimatedIconPressable
              onPress={() => router.back()}
              containerClassName="mb-4 self-start"
              className="flex-row items-center"
            >
              <MaterialIcons name="arrow-back" size={20} color={iconColor} />
              <Text className={`${secondaryTextClass} ml-2`}>
                {t("general.back")}
              </Text>
            </AnimatedIconPressable>

            <Text className={`text-2xl ${textClass}`}>Privacy Policy</Text>
          </View>

          <View
            className={`${cardBgClass} border rounded-3xl`}
            style={{
              padding: isTablet ? 28 : 22,
              marginBottom: sectionGap,
            }}
          >
            <View
              style={{
                flexDirection: showSplitHero ? "row" : "column",
                alignItems: showSplitHero ? "stretch" : "flex-start",
                gap: sectionGap,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <View
                  style={{
                    alignItems: showSplitHero ? "flex-start" : "center",
                  }}
                >
                  <View style={{ marginBottom: 18 }}>
                    <GatorGuideMark size={isTablet ? 112 : 100} darkMode={isDark} />
                  </View>
                  <Text
                    className={`${secondaryTextClass} text-sm`}
                    style={{
                      maxWidth: showSplitHero ? 620 : 680,
                      lineHeight: 22,
                      textAlign: showSplitHero ? "left" : "center",
                    }}
                  >
                    This page explains what GatorGuide collects, where it is
                    stored, and when it moves between your device, Firebase,
                    and the outside services needed to run features you choose
                    to use.
                  </Text>
                  <Text
                    className={`${secondaryTextClass} text-sm`}
                    style={{
                      maxWidth: showSplitHero ? 620 : 680,
                      lineHeight: 22,
                      textAlign: showSplitHero ? "left" : "center",
                      marginTop: 10,
                    }}
                  >
                    The app is designed to keep some sensitive items local,
                    especially unofficial transcript files, while still syncing
                    account and planning data when you sign in.
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 10,
                    marginTop: 18,
                    justifyContent: showSplitHero ? "flex-start" : "center",
                  }}
                >
                  {heroBadges.map((badge) => (
                    <Badge
                      key={badge}
                      text={badge}
                      textClass={textClass}
                      cardBgClass={accentCardClass}
                    />
                  ))}
                </View>
              </View>

              <View
                className={`${mutedCardClass} border rounded-2xl`}
                style={{
                  width: heroPanelWidth,
                  padding: isTablet ? 22 : 18,
                  alignSelf: showSplitHero ? "stretch" : "auto",
                }}
              >
                <View className="flex-row items-center justify-between mb-4">
                  <Text className={`${textClass} font-semibold`}>
                    Policy information
                  </Text>
                  <View className="w-9 h-9 rounded-xl bg-emerald-500/10 items-center justify-center">
                    <MaterialIcons
                      name="shield"
                      size={18}
                      color="#008f4e"
                    />
                  </View>
                </View>

                <View className={`${cardBgClass} border rounded-2xl px-4 py-4`}>
                  <Text
                    className={`${secondaryTextClass} text-sm`}
                    style={{ lineHeight: 20 }}
                  >
                    Questions, privacy concerns, or deletion requests can be
                    sent to support.
                  </Text>
                </View>

                <AnimatedIconPressable
                  onPress={() => {
                    void Linking.openURL(mailtoUrl);
                  }}
                  accessibilityRole="link"
                  containerClassName="mt-4"
                  className={`${accentCardClass} flex-row items-center justify-center rounded-2xl border px-4 py-3`}
                >
                  <MaterialIcons
                    name="mail-outline"
                    size={18}
                    color={iconColor}
                  />
                  <Text className={`${textClass} ml-2`}>{contactEmail}</Text>
                </AnimatedIconPressable>
              </View>
            </View>
          </View>

          <PolicySection
            title="How privacy works"
            textClass={textClass}
            cardBgClass={cardBgClass}
            sectionGap={sectionGap}
            padding={cardPadding}
          >
            <View
              style={{
                flexDirection: showTwoColumnGrid ? "row" : "column",
                flexWrap: showTwoColumnGrid ? "wrap" : "nowrap",
                gap: 16,
              }}
            >
              {privacySteps.map((item) => (
                <View
                  key={item.n}
                  className={`${mutedCardClass} border rounded-2xl`}
                  style={{
                    width: twoColumnWidth,
                    minHeight: gridCardMinHeight,
                    padding: 18,
                  }}
                >
                  <View className="flex-row items-center mb-3">
                    <View className="w-7 h-7 rounded-full bg-emerald-500 items-center justify-center mr-3">
                      <Text
                        className={`${isDark ? "text-white" : "text-emerald-900"} text-sm font-semibold`}
                      >
                        {item.n}
                      </Text>
                    </View>
                    <Text className={`${textClass} font-medium flex-1`}>
                      {item.title}
                    </Text>
                  </View>
                  <Text
                    className={`text-sm ${secondaryTextClass}`}
                    style={{ lineHeight: 20 }}
                  >
                    {item.body}
                  </Text>
                </View>
              ))}
            </View>
          </PolicySection>

          <PolicySection
            title="What we collect"
            textClass={textClass}
            cardBgClass={cardBgClass}
            sectionGap={sectionGap}
            padding={cardPadding}
          >
            <View
              style={{
                flexDirection: showTwoColumnGrid ? "row" : "column",
                flexWrap: showTwoColumnGrid ? "wrap" : "nowrap",
                gap: 16,
              }}
            >
              {collectionCards.map((item) => (
                <DetailCard
                  key={item.title}
                  item={item}
                  width={twoColumnWidth}
                  minHeight={gridCardMinHeight}
                  cardClass={mutedCardClass}
                  textClass={textClass}
                  secondaryTextClass={secondaryTextClass}
                  iconColor={iconColor}
                />
              ))}
            </View>
          </PolicySection>

          <PolicySection
            title="Where your data lives"
            textClass={textClass}
            cardBgClass={cardBgClass}
            sectionGap={sectionGap}
            padding={cardPadding}
          >
            <View
              style={{
                flexDirection: showTwoColumnGrid ? "row" : "column",
                gap: 16,
              }}
            >
              {storageCards.map((item) => (
                <DetailCard
                  key={item.title}
                  item={item}
                  width={twoColumnWidth}
                  cardClass={mutedCardClass}
                  textClass={textClass}
                  secondaryTextClass={secondaryTextClass}
                  iconColor={iconColor}
                />
              ))}
            </View>
          </PolicySection>

          <PolicySection
            title="AI, sharing, and your controls"
            textClass={textClass}
            cardBgClass={cardBgClass}
            sectionGap={sectionGap}
            padding={cardPadding}
          >
            <View
              style={{
                flexDirection: showTwoColumnGrid ? "row" : "column",
                flexWrap: showTwoColumnGrid ? "wrap" : "nowrap",
                gap: 16,
              }}
            >
              {controlCards.map((item) => (
                <DetailCard
                  key={item.title}
                  item={item}
                  width={threeColumnWidth}
                  cardClass={mutedCardClass}
                  textClass={textClass}
                  secondaryTextClass={secondaryTextClass}
                  iconColor={iconColor}
                />
              ))}
            </View>
          </PolicySection>

        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

function PolicySection({
  title,
  children,
  textClass,
  cardBgClass,
  sectionGap,
  padding,
}: {
  title: string;
  children: ReactNode;
  textClass: string;
  cardBgClass: string;
  sectionGap: number;
  padding: number;
}) {
  return (
    <View
      className={`${cardBgClass} border rounded-3xl`}
      style={{ padding, marginBottom: sectionGap }}
    >
      <Text className={`${textClass} mb-4`}>{title}</Text>
      {children}
    </View>
  );
}

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

type DetailCardItem = {
  icon: MaterialIconName;
  title: string;
  body?: string;
  bullets?: string[];
};

function DetailCard({
  item,
  width,
  minHeight,
  cardClass,
  textClass,
  secondaryTextClass,
  iconColor,
}: {
  item: DetailCardItem;
  width: ViewStyle["width"];
  minHeight?: number;
  cardClass: string;
  textClass: string;
  secondaryTextClass: string;
  iconColor: string;
}) {
  return (
    <View
      className={`${cardClass} border rounded-2xl`}
      style={{ width, minHeight, padding: 18, gap: 10 }}
    >
      <View className="flex-row items-center mb-3">
        <View className="w-9 h-9 rounded-xl bg-emerald-500/10 items-center justify-center mr-3">
          <MaterialIcons name={item.icon} size={18} color={iconColor} />
        </View>
        <Text className={`${textClass} font-medium flex-1`}>{item.title}</Text>
      </View>

      {item.body ? (
        <Text
          className={`${secondaryTextClass} text-sm`}
          style={{ lineHeight: 20 }}
        >
          {item.body}
        </Text>
      ) : null}

      {item.bullets?.map((bullet) => (
        <Bullet key={bullet} textClass={secondaryTextClass}>
          {bullet}
        </Bullet>
      ))}
    </View>
  );
}

function Bullet({
  children,
  textClass,
}: {
  children: ReactNode;
  textClass: string;
}) {
  return (
    <View className="flex-row items-start">
      <Text className={`${textClass} mr-2`}>{"\u2022"}</Text>
      <Text className={`${textClass} flex-1 text-sm`} style={{ lineHeight: 22 }}>
        {children}
      </Text>
    </View>
  );
}

function Badge({
  text,
  textClass,
  cardBgClass,
}: {
  text: string;
  textClass: string;
  cardBgClass: string;
}) {
  return (
    <View className={`${cardBgClass} rounded-full border px-3 py-2`}>
      <Text className={`${textClass} text-xs`}>{text}</Text>
    </View>
  );
}
