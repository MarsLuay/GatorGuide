import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function TermsOfServicePage() {
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

            <Text className={`text-2xl ${textClass}`}>Terms of Service</Text>
            <Text className={`${secondaryTextClass} mt-2 text-sm`}>Last updated: {lastUpdated}</Text>
          </View>

          {/* Summary */}
          <View className="px-6 mb-6">
            <View className={`${cardBgClass} border rounded-2xl p-6 gap-3`}>
              <Text className={`${secondaryTextClass} text-sm leading-relaxed`}>
                GatorGuide provides planning tools, recommendations, and AI-assisted guidance for transfer applications.
              </Text>
              <Text className={`${secondaryTextClass} text-sm leading-relaxed`}>
                It is for informational purposes and does not guarantee admission or outcomes.
              </Text>
            </View>
          </View>

          <Section title="Eligibility" textClass={textClass}>
            <Card cardBgClass={cardBgClass}>
              <Text className={`${secondaryTextClass} text-sm leading-relaxed`}>
                The App is intended for college students planning to transfer. You agree to follow applicable laws and any school rules
                that apply to your use.
              </Text>
            </Card>
          </Section>

          <Section title="Acceptable use" textClass={textClass}>
            <Card cardBgClass={cardBgClass}>
              <Bullet textClass={secondaryTextClass}>Do not misuse the App, attempt to hack it, or disrupt other users.</Bullet>
              <Bullet textClass={secondaryTextClass}>Do not reverse engineer, scrape, or abuse the service.</Bullet>
              <Bullet textClass={secondaryTextClass}>
                Use AI guidance responsibly and verify important details (deadlines, requirements) with official university sources.
              </Bullet>
            </Card>
          </Section>

          <Section title="Accounts" textClass={textClass}>
            <Card cardBgClass={cardBgClass}>
              <Bullet textClass={secondaryTextClass}>You are responsible for activity under your account.</Bullet>
              <Bullet textClass={secondaryTextClass}>Keep your login credentials secure.</Bullet>
            </Card>
          </Section>

          <Section title="AI features" textClass={textClass}>
            <Card cardBgClass={cardBgClass}>
              <Text className={`${secondaryTextClass} text-sm leading-relaxed`}>
                The App may provide AI-assisted writing guidance and recommendations. AI output can be inaccurate or incomplete, and you
                are responsible for how you use it and for verifying information.
              </Text>
            </Card>
          </Section>

          <Section title="Intellectual property" textClass={textClass}>
            <Card cardBgClass={cardBgClass}>
              <Text className={`${secondaryTextClass} text-sm leading-relaxed`}>
                The App’s design and original content belong to the GatorGuide team and are protected by applicable laws. You may not copy
                or redistribute the App except as permitted by law.
              </Text>
            </Card>
          </Section>

          <Section title="Disclaimers" textClass={textClass}>
            <Card cardBgClass={cardBgClass}>
              <Text className={`${secondaryTextClass} text-sm leading-relaxed`}>
                The App is provided “as is” without warranties. We do not guarantee availability, accuracy, or results related to admissions,
                scholarships, or transfer outcomes.
              </Text>
            </Card>
          </Section>

          <Section title="Limitation of liability" textClass={textClass}>
            <Card cardBgClass={cardBgClass}>
              <Text className={`${secondaryTextClass} text-sm leading-relaxed`}>
                To the fullest extent permitted by law, we are not liable for indirect, incidental, special, or consequential damages arising
                from your use of the App.
              </Text>
            </Card>
          </Section>

          <Section title="Changes to these Terms" textClass={textClass}>
            <Card cardBgClass={cardBgClass}>
              <Text className={`${secondaryTextClass} text-sm leading-relaxed`}>
                We may update these Terms from time to time. Continued use after changes means you accept the updated Terms.
              </Text>
            </Card>
          </Section>

          <Section title="Contact us" textClass={textClass}>
            <Card cardBgClass={cardBgClass}>
              <Text className={`${secondaryTextClass} text-sm leading-relaxed`}>
                Questions about these Terms? Contact us at <Text className={textClass}>{contactEmail}</Text>.
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
