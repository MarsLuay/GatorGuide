import React, { useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useThemeStyles } from "@/hooks/use-theme-styles";

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
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  const { textClass, secondaryTextClass, borderClass, placeholderColor } = styles;
  const cardClass = styles.cardBgClass;
  const inputClass = styles.inputBgClass;
  const placeholderTextColor = placeholderColor;

  const sections: ResourceSection[] = useMemo(
    () => [
      {
        title: "Student Tools",
        icon: "account-circle",
        items: [
          {
            title: "ctcLink",
            description: "Login to registration, financials, and student account tools.",
            url: "https://myaccount.ctclink.us/",
            tags: ["portal", "ctclink", "registration", "financial aid"],
          },
          {
            title: "Canvas (eGator)",
            description: "Access course content, assignments, and announcements.",
            url: "https://egator.greenriver.edu/login/saml",
            tags: ["canvas", "egator", "classes", "lms"],
          },
          {
            title: "Work-Study & Student Employment (GRC)",
            description: "Eligibility and info for work-study and on-campus jobs.",
            url: "https://www.greenriver.edu/students/pay-for-college/financial-aid/student-employment/",
            tags: ["work-study", "jobs", "grc"],
          },
        ],
      },

      {
        title: "Green River Transfer Planning",
        icon: "school",
        items: [
          {
            title: "Transfer Students (GRC Advising)",
            description: "Transfer advising services and resources for Green River students.",
            url: "https://www.greenriver.edu/students/academics/career-and-advising-center/advising/transfer-students.html",
            tags: ["transfer", "advising", "grc"],
          },
          {
            title: "University & College Transfer Hub (GRC)",
            description: "Transfer planning sheets, pathways, and transfer info.",
            url: "https://www.greenriver.edu/students/academics/areas-of-interest/university-and-college-transfer/",
            tags: ["transfer", "planning", "grc"],
          },
        ],
      },

      {
        title: "Common WA 4-Year Universities (Transfer Pages)",
        icon: "map",
        items: [
          {
            title: "University of Washington (UW) — Apply as a Transfer",
            description: "Start here for UW transfer application info (all campuses).",
            url: "https://admit.washington.edu/apply/",
            tags: ["uw", "transfer", "apply"],
          },
          {
            title: "Western Washington University (WWU) — Transfer Students",
            description: "Transfer admissions overview and help for prospective transfer students.",
            url: "https://aasac.wwu.edu/transfer-students",
            tags: ["wwu", "transfer", "apply"],
          },
          {
            title: "Washington State University (WSU) — Transfer Admission",
            description: "Transfer admissions info for WSU.",
            url: "https://admission.wsu.edu/apply/transfer/",
            tags: ["wsu", "transfer", "apply"],
          },
          {
            title: "Central Washington University (CWU) — Transfer Admission",
            description: "Transfer admissions info for CWU.",
            url: "https://www.cwu.edu/admissions/transfer/",
            tags: ["cwu", "transfer", "apply"],
          },
          {
            title: "Eastern Washington University (EWU) — Transfer Admission",
            description: "Transfer admissions info for EWU.",
            url: "https://www.ewu.edu/admissions/transfer/",
            tags: ["ewu", "transfer", "apply"],
          },
          {
            title: "The Evergreen State College — Transfer Admission",
            description: "Transfer admissions info for Evergreen.",
            url: "https://www.evergreen.edu/admissions/transfer",
            tags: ["evergreen", "transfer", "apply"],
          },
        ],
      },

      {
        title: "Transfer Guides (Green River → Universities)",
        icon: "find-in-page",
        items: [
          {
            title: "University of Washington — Equivalency Guide (Green River)",
            description: "Course-by-course equivalencies from Green River to UW.",
            url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
            tags: ["uw", "equivalency", "transfer credit", "grc"],
          },
          {
            title: "UW Bothell — Green River Equivalency Guide",
            description: "How Green River courses transfer to UW Bothell.",
            url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
            tags: ["uw bothell", "equivalency", "transfer credit", "grc"],
          },
          {
            title: "Washington State University — Green River Transfer Pathway",
            description: "WSU pathway information specific to Green River.",
            url: "https://admission.wsu.edu/transfer/college/green-river-college/",
            tags: ["wsu", "transfer", "pathway", "grc"],
          },
          {
            title: "Central Washington University — Transfer Equivalency Guide (TES)",
            description: "Transfer guide (search/select Green River courses).",
            url: "https://tes.collegesource.com/publicview/TES_publicview01.aspx?aid=204fbfdc-36d3-495b-8c0a-5e589b47ca62&rid=e635e8c0-a2e6-4d02-9dd8-71fc4b65ae6b",
            tags: ["cwu", "tes", "equivalency", "transfer credit"],
          },
          {
            title: "Eastern Washington University — Transfer Equivalency Guide (TES)",
            description: "Transfer guide (search/select Green River courses).",
            url: "https://tes.collegesource.com/publicview/TES_publicview01.aspx?aid=e4fa59cc-4ed8-4ddc-8e34-d3b60be846ae&rid=7898eab1-11c4-4a29-9f3e-6c5b213ef38d",
            tags: ["ewu", "tes", "equivalency", "transfer credit"],
          },
          {
            title: "The Evergreen State College — Green River Transfer Guide (PDF)",
            description: "Evergreen transfer guide for Green River coursework.",
            url: "https://www.evergreen.edu/sites/default/files/2023-06/GreenRiver.pdf",
            tags: ["evergreen", "pdf", "transfer", "grc"],
          },
          {
            title: "Seattle University — Transfer Equivalency Guide (TES)",
            description: "Transfer guide (select/search for Green River courses).",
            url: "https://tes.collegesource.com/publicview/TES_publicview01.aspx?aid=6b93a5a2-545d-4118-89be-158a22166b20&rid=8bd9f4e6-e0c7-411f-9af8-d4e3527eed23",
            tags: ["seattle university", "tes", "equivalency", "transfer credit"],
          },
          {
            title: "Gonzaga University — Transfer Equivalency Guide (TES)",
            description: "Transfer guide (select/search for Green River courses).",
            url: "https://tes.collegesource.com/publicview/TES_publicview01.aspx?aid=edff7e4f-61c0-4b52-a4d2-375105e4d0c6&rid=4e6ce63c-d502-4d1e-9b85-4d01e8856f54",
            tags: ["gonzaga", "tes", "equivalency", "transfer credit"],
          },
          {
            title: "Saint Martin's University — Transfer Equivalency Guide (TES)",
            description: "Transfer guide (select/search for Green River courses).",
            url: "https://tes.collegesource.com/publicview/TES_publicview01.aspx?aid=3e9b8680-6a73-4ff5-a9d7-63b1b1f30bd5&rid=063b2c09-c18b-4df1-b05d-f2c587a6af63",
            tags: ["saint martin's", "tes", "equivalency", "transfer credit"],
          },
          {
            title: "Whitman College — Transfer Equivalency Guide (TES)",
            description: "Transfer guide (select/search for Green River courses).",
            url: "https://tes.collegesource.com/publicview/TES_publicview01.aspx?aid=ecf0ae06-9d88-40e0-a124-523fc3f61d73&rid=bacb278e-2efc-40d6-b6be-30126b3d5edd",
            tags: ["whitman", "tes", "equivalency", "transfer credit"],
          },
        ],
      },

      {
        title: "Scholarships (WA-focused)",
        icon: "attach-money",
        items: [
          {
            title: "CareerOneStop — Scholarship Finder (Washington)",
            description: "Scholarship search filtered to Washington opportunities.",
            url: "https://www.careeronestop.org/Toolkit/Training/find-scholarships.aspx?curPage=1&georestrictionfilter=Washington",
            tags: ["scholarships", "washington", "search"],
          },
          {
            title: "BigFuture — Scholarship Search (WA)",
            description: "College Board scholarship search filtered to Washington; nearest deadlines first.",
            url: "https://bigfuture.collegeboard.org/scholarship-search?sort=deadline-nearest-first&cntry=US&stt=WA",
            tags: ["scholarships", "washington", "deadline"],
          },
          {
            title: "Washington State Opportunity Scholarship (WSOS)",
            description: "Scholarships and support for eligible WA students (plus job board).",
            url: "https://waopportunityscholarship.org/",
            tags: ["wsos", "scholarships", "washington"],
          },
        ],
      },

      {
        title: "Internships & Jobs",
        icon: "work",
        items: [
          {
            title: "Washington State Government Internships (GovernmentJobs)",
            description: "Internship postings across WA state agencies (most recent first).",
            url: "https://www.governmentjobs.com/careers/washington?jobType[0]=Internship&sort=PostingDate%7CDescending",
            tags: ["internships", "washington", "government"],
          },
          {
            title: "WSOS Job Board",
            description: "Jobs and internships from WSOS partners and opportunities.",
            url: "https://waopportunityscholarship.org/jobs/",
            tags: ["wsos", "jobs", "internships", "washington"],
          },
          {
            title: "Parker Dewey Micro-Internships",
            description: "Short-term paid projects to build experience.",
            url: "https://www.parkerdewey.com/",
            tags: ["micro-internships", "experience"],
          },
        ],
      },

      {
        title: "International Internships",
        icon: "public",
        items: [
          {
            title: "AIESEC Global Talent",
            description: "International internships and placements.",
            url: "https://aiesec.org/global-talent",
            tags: ["international", "internships"],
          },
          {
            title: "Go Overseas — Internships Abroad",
            description: "Browse internship abroad programs and listings.",
            url: "https://www.gooverseas.com/internships-abroad",
            tags: ["international", "internships", "abroad"],
          },
          {
            title: "IAESTE — Internships",
            description: "International STEM-focused internships (availability varies).",
            url: "https://iaeste.org/internships",
            tags: ["international", "stem", "internships"],
          },
        ],
      },
    ],
    []
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
        Alert.alert("Cannot open link", "Your device could not open this link.");
        return;
      }
      await Linking.openURL(safeUrl);
    } catch {
      Alert.alert("Link error", "Something went wrong opening that link.");
    }
  };

  return (
    <ScreenBackground>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 96 }}>
        <View className="max-w-md w-full self-center px-6 pt-10">
          <Text className={`text-2xl ${textClass} mb-1`}>Resources</Text>
          <Text className={`${secondaryTextClass} mb-6`}>
            Official links for transfer planning, transfer guides, scholarships, and internships
          </Text>

          <View className="relative mb-6">
            <View className="absolute left-4 top-4 z-10">
              <Ionicons name="search" size={20} color={placeholderTextColor} />
            </View>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search resources (e.g., UW, work-study, scholarships)"
              placeholderTextColor={placeholderTextColor}
              className={`w-full ${inputClass} ${textClass} border rounded-2xl pl-12 pr-4 py-4`}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {filteredSections.length === 0 ? (
            <View className={`${cardClass} border rounded-2xl p-5`}>
              <Text className={`${textClass} mb-1`}>No matches found</Text>
              <Text className={`${secondaryTextClass} text-sm`}>Try a different search term.</Text>
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
