import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function PrivacyPolicyPage() {
  const { isDark } = useAppTheme();
  const router = useRouter();

  const textClass = isDark ? "text-white" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : "text-gray-600";
  const cardBgClass = isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200";
  const borderClass = isDark ? "border-gray-800" : "border-gray-200";

  const lastUpdated = "February 11, 2026";
  const contactEmail = "[wtv email/contact we have]"; // replace

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="max-w-md w-full self-center">
          {/* Header */}
          <View className="px-6 pt-8 pb-6">
            <Pressable onPress={() => router.back()} className="mb-4 flex-row items-center">
              <MaterialIcons name="arrow-back" size={20} color={isDark ? "#9CA3AF" : "#6B7280"} />
              <Text className={`${secondaryTextClass} ml-2`}>Back</Text>
            </Pressable>

            <Text className={`text-2xl ${textClass}`}>Privacy Policy</Text>
            <Text className={`${secondaryTextClass} mt-2 text-sm`}>Last updated: {lastUpdated}</Text>
          </View>

          {/* Summary */}
          <View className="px-6 mb-6">
            <View className={`${cardBgClass} border rounded-2xl p-6 gap-3`}>
              <Text className={`${secondaryTextClass} text-sm leading-relaxed`}>
                GatorGuide helps Green River College students plan transfers by providing personalized university suggestions,
                portfolio guidance, deadline reminders, and an AI chat feature.
              </Text>
              <Text className={`${secondaryTextClass} text-sm leading-relaxed`}>
                We do <Text className={textClass}>not sell</Text> your personal information.
              </Text>
            </View>
          </View>

          {/* Sections */}
          <Section title="Information we collect" textClass={textClass}>
            <Card cardBgClass={cardBgClass}>
              <Bullet textClass={secondaryTextClass}>Account details (such as name and email) when you create an account or log in.</Bullet>
              <Bullet textClass={secondaryTextClass}>
                Profile information you provide: intended major/field of study, GPA (optional), test scores (optional), and resume upload (optional).
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

          <Section title="How we use information" textClass={textClass}>
            <Card cardBgClass={cardBgClass}>
              <Bullet textClass={secondaryTextClass}>Provide core features: recommendations, portfolio guidance, AI chat, and alerts.</Bullet>
              <Bullet textClass={secondaryTextClass}>Personalize results based on your profile, goals, and preferences.</Bullet>
              <Bullet textClass={secondaryTextClass}>Troubleshoot, secure the app, and fix bugs.</Bullet>
              <Bullet textClass={secondaryTextClass}>Respond to support requests if you contact us.</Bullet>
            </Card>
          </Section>

          <Section title="Sharing of information" textClass={textClass}>
            <Card cardBgClass={cardBgClass}>
              <Text className={`${secondaryTextClass} text-sm leading-relaxed`}>
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

          <Section title="Data retention" textClass={textClass}>
            <Card cardBgClass={cardBgClass}>
              <Text className={`${secondaryTextClass} text-sm leading-relaxed`}>
                We retain information for as long as necessary to provide the app and for legitimate purposes such as security,
                troubleshooting, and compliance. If account deletion is available, deleting your account will remove or anonymize
                associated data within a reasonable period, unless certain records must be kept for legal or security reasons.
              </Text>
            </Card>
          </Section>

          <Section title="Your choices" textClass={textClass}>
            <Card cardBgClass={cardBgClass}>
              <Bullet textClass={secondaryTextClass}>Edit your profile information inside the app.</Bullet>
              <Bullet textClass={secondaryTextClass}>Turn notifications on/off in Settings and your device settings.</Bullet>
              <Bullet textClass={secondaryTextClass}>Uninstall the app to stop further collection from your device.</Bullet>
              <Bullet textClass={secondaryTextClass}>Use “Delete Account” (if enabled) to request deletion of your account and related data.</Bullet>
            </Card>
          </Section>

          <Section title="Contact us" textClass={textClass}>
            <Card cardBgClass={cardBgClass}>
              <Text className={`${secondaryTextClass} text-sm leading-relaxed`}>
                Questions about this Privacy Policy? Contact us at <Text className={textClass}>{contactEmail}</Text>.
              </Text>
            </Card>
          </Section>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

function Section({ title, children, textClass }: { title: string; children: React.ReactNode; textClass: string }) {
  return (
    <View className="px-6 mb-6">
      <Text className={`${textClass} mb-3 px-2`}>{title}</Text>
      {children}
    </View>
  );
}

function Card({ children, cardBgClass }: { children: React.ReactNode; cardBgClass: string }) {
  return <View className={`${cardBgClass} border rounded-2xl p-6 gap-3`}>{children}</View>;
}

function Bullet({ children, textClass }: { children: React.ReactNode; textClass: string }) {
  return (
    <View className="flex-row items-start">
      <Text className={`${textClass} mr-2`}>•</Text>
      <Text className={`${textClass} flex-1 text-sm leading-relaxed`}>{children}</Text>
    </View>
  );
}
