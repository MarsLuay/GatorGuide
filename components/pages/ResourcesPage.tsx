import React, { useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { useAppLanguage } from "@/hooks/use-app-language";

type ResourceItem = {
  title: string;
  description: string;
  url: string;
  tags?: string[];
};

type ResourceSection = {
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  items: ResourceItem[];
};

export default function ResourcesPage() {
  const styles = useThemeStyles();
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  const { textClass, secondaryTextClass, borderClass, placeholderColor } = styles;
  const cardClass = styles.cardBgClass;
  const inputClass = styles.inputBgClass;
  const placeholderTextColor = placeholderColor;

  const sections: ResourceSection[] = useMemo(
    () => [
      {
        title: t("resources.studentTools"),
        icon: "account-circle",
        items: [
          {
            title: t("resources.ctcLink"),
            description: t("resources.ctcLinkDesc"),
            url: "https://myaccount.ctclink.us/",
            tags: ["portal", "ctclink", "registration", "financial aid"],
          },
          {
            title: t("resources.canvas"),
            description: t("resources.canvasDesc"),
            url: "https://egator.greenriver.edu/login/saml",
            tags: ["canvas", "egator", "classes", "lms"],
          },
          {
            title: t("resources.workStudy"),
            description: t("resources.workStudyDesc"),
            url: "https://www.greenriver.edu/students/pay-for-college/financial-aid/student-employment/",
            tags: ["work-study", "jobs", "grc"],
          },
        ],
      },

      {
        title: t("resources.greenRiverTransfer"),
        icon: "school",
        items: [
          {
            title: t("resources.transferAdvising"),
            description: t("resources.transferAdvisingDesc"),
            url: "https://www.greenriver.edu/students/academics/career-and-advising-center/advising/transfer-students.html",
            tags: ["transfer", "advising", "grc"],
          },
          {
            title: t("resources.transferHub"),
            description: t("resources.transferHubDesc"),
            url: "https://www.greenriver.edu/students/academics/areas-of-interest/university-and-college-transfer/",
            tags: ["transfer", "planning", "grc"],
          },
        ],
      },

      {
        title: t("resources.commonWaUniversities"),
        icon: "map",
        items: [
          {
            title: t("resources.uw"),
            description: t("resources.uwDesc"),
            url: "https://admit.washington.edu/apply/",
            tags: ["uw", "transfer", "apply"],
          },
          {
            title: t("resources.wwu"),
            description: t("resources.wwuDesc"),
            url: "https://aasac.wwu.edu/transfer-students",
            tags: ["wwu", "transfer", "apply"],
          },
          {
            title: t("resources.wsu"),
            description: t("resources.wsuDesc"),
            url: "https://admission.wsu.edu/apply/transfer/",
            tags: ["wsu", "transfer", "apply"],
          },

          {
            title: t("resources.evergreen"),
            description: t("resources.evergreenDesc"),
            url: "https://www.evergreen.edu/admissions/transfer",
            tags: ["evergreen", "transfer", "apply"],
          },
        ],
      },

      {
        title: t("resources.transferGuides"),
        icon: "find-in-page",
        items: [
          {
            title: t("resources.uwEquivalency"),
            description: t("resources.uwEquivalencyDesc"),
            url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
            tags: ["uw", "equivalency", "transfer credit", "grc"],
          },
          {
            title: t("resources.uwBothell"),
            description: t("resources.uwBothellDesc"),
            url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
            tags: ["uw bothell", "equivalency", "transfer credit", "grc"],
          },
          {
            title: t("resources.evergreenGuide"),
            description: t("resources.evergreenGuideDesc"),
            url: "https://www.evergreen.edu/sites/default/files/2023-06/GreenRiver.pdf",
            tags: ["evergreen", "pdf", "transfer", "grc"],
          },
        ],
      },

      {
        title: t("resources.scholarships"),
        icon: "attach-money",
        items: [
          {
            title: t("resources.careerOneStop"),
            description: t("resources.careerOneStopDesc"),
            url: "https://www.careeronestop.org/Toolkit/Training/find-scholarships.aspx?curPage=1&georestrictionfilter=Washington",
            tags: ["scholarships", "washington", "search"],
          },
          {
            title: t("resources.bigFuture"),
            description: t("resources.bigFutureDesc"),
            url: "https://bigfuture.collegeboard.org/scholarship-search?sort=deadline-nearest-first&cntry=US&stt=WA",
            tags: ["scholarships", "washington", "deadline"],
          },
          {
            title: t("resources.wsos"),
            description: t("resources.wsosDesc"),
            url: "https://waopportunityscholarship.org/",
            tags: ["wsos", "scholarships", "washington"],
          },
        ],
      },

      {
        title: t("resources.internships"),
        icon: "work",
        items: [
          {
            title: t("resources.waGovernment"),
            description: t("resources.waGovernmentDesc"),
            url: "https://www.governmentjobs.com/careers/washington?jobType[0]=Internship&sort=PostingDate%7CDescending",
            tags: ["internships", "washington", "government"],
          },
          {
            title: t("resources.wsosJobs"),
            description: t("resources.wsosJobsDesc"),
            url: "https://waopportunityscholarship.org/jobs/",
            tags: ["wsos", "jobs", "internships", "washington"],
          },
          {
            title: t("resources.parkerDewey"),
            description: t("resources.parkerDeweyDesc"),
            url: "https://www.parkerdewey.com/",
            tags: ["micro-internships", "experience"],
          },
        ],
      },

      {
        title: t("resources.internationalInternships"),
        icon: "public",
        items: [
          {
            title: t("resources.aiesec"),
            description: t("resources.aiesecDesc"),
            url: "https://aiesec.org/global-talent",
            tags: ["international", "internships"],
          },
          {
            title: t("resources.goOverseas"),
            description: t("resources.goOverseasDesc"),
            url: "https://www.gooverseas.com/internships-abroad",
            tags: ["international", "internships", "abroad"],
          },
          {
            title: t("resources.iaeste"),
            description: t("resources.iaesteDesc"),
            url: "https://iaeste.org/internships",
            tags: ["international", "stem", "internships"],
          },
        ],
      },
    ],
    [t]
  );

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;

    const matches = (item: ResourceItem) => {
      const haystack = (item.title + " " + item.description + " " + (item.tags ?? []).join(" ")).toLowerCase();
      return haystack.includes(q);
    };

    return sections
      .map((s) => ({ ...s, items: s.items.filter(matches) }))
      .filter((s) => s.items.length > 0);
  }, [query, sections]);

  const openLink = async (url: string) => {
    const safeUrl = url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
    try {
      const can = await Linking.canOpenURL(safeUrl);
      if (!can) {
        Alert.alert(t('resources.cannotOpenLink'), t('resources.couldNotOpenLink'));
        return;
      }
      await Linking.openURL(safeUrl);
    } catch {
      Alert.alert(t('resources.linkError'), t('resources.linkErrorMessage'));
    }
  };

  return (
    <ScreenBackground>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 96 }}>
        <View className="max-w-md w-full self-center px-6 pt-10">
          <Text className={`text-2xl ${textClass} mb-1`}>{t("resources.resources")}</Text>
          <Text className={`${secondaryTextClass} mb-6`}>
            {t("resources.resourcesDescription")}
          </Text>

          <View className="relative mb-6">
            <View className="absolute left-4 top-4 z-10">
              <Ionicons name="search" size={20} color={placeholderTextColor} />
            </View>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("resources.searchPlaceholder")}
              placeholderTextColor={placeholderTextColor}
              className={`w-full ${inputClass} ${textClass} border rounded-2xl pl-12 pr-4 py-4`}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {filteredSections.length === 0 ? (
            <View className={`${cardClass} border rounded-2xl p-5`}>
              <Text className={`${textClass} mb-1`}>{t("resources.noMatches")}</Text>
              <Text className={`${secondaryTextClass} text-sm`}>{t("resources.tryDifferentSearch")}</Text>
            </View>
          ) : (
            <View className="gap-6">
              {filteredSections.map((section) => (
                <View key={section.title}>
                  <View className="flex-row items-center mb-3 px-2">
                    <MaterialIcons name={section.icon} size={18} color={placeholderColor} />
                    <Text className={`${textClass} ml-2`}>{section.title}</Text>
                  </View>

                  <View className={`${cardClass} border rounded-2xl overflow-hidden`}>
                    {section.items.map((item, idx) => (
                      <Pressable
                        key={`${section.title}-${item.title}`}
                        onPress={() => openLink(item.url)}
                        className={`px-4 py-5 flex-row items-start ${idx !== section.items.length - 1 ? `border-b ${borderClass}` : ""}`}
                        accessibilityRole="link"
                      >
                        <View className="mt-0.5">
                          <Ionicons name="link-outline" size={18} color={placeholderColor} />
                        </View>

                        <View className="flex-1 ml-3">
                          <Text className={`${textClass} font-medium mb-1`}>{item.title}</Text>
                          <Text className={`${secondaryTextClass} text-sm`}>{item.description}</Text>
                        </View>

                        <MaterialIcons name="open-in-new" size={18} color={placeholderColor} />
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          <View className="mt-8">
            <Text className={`text-xs ${secondaryTextClass} text-center`}>
              Links open in your device’s browser.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
