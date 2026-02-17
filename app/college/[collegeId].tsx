import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable, Linking, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppLanguage } from "@/hooks/use-app-language";
import { collegeService, College } from "@/services";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { Ionicons } from "@expo/vector-icons";

export default function CollegeDetailsPage() {
  const params = useLocalSearchParams<{ collegeId?: string | string[] }>();
  const rawId = params?.collegeId;
  const collegeId = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useAppLanguage();

  const [college, setCollege] = useState<College | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const styles = useThemeStyles();
  const { textClass, secondaryTextClass, cardBgClass, borderClass, placeholderColor } = styles;

  const fetchDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!collegeId) throw new Error("missing id");
      const c = await collegeService.getCollegeDetails(String(collegeId));
      setCollege(c);
    } catch (err: any) {
      setError(err?.message || "Error fetching");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collegeId]);

  const formatRate = (r: number | null) => {
    if (r === null || typeof r !== "number") return t("home.notAvailable");
    return Math.round(r * 100) + "%";
  };

  const formatMoney = (n: number | null) => {
    if (n === null || typeof n !== "number") return t("home.notAvailable");
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
    } catch {
      return "$" + Math.round(n).toString();
    }
  };

  const normalizeUrl = (url?: string | null) => {
    if (!url) return null;
    const s = String(url).trim();
    if (!/^https?:\/\//i.test(s)) return `https://${s}`;
    return s;
  };

  const openUrl = async (url?: string | null) => {
    const normalized = normalizeUrl(url);
    if (!normalized) return Alert.alert(t("resources.couldNotOpenLink"));
    try {
      const supported = await Linking.canOpenURL(normalized);
      if (supported) await Linking.openURL(normalized);
      else Alert.alert(t("resources.couldNotOpenLink"));
    } catch (e) {
      Alert.alert(t("resources.couldNotOpenLink"));
    }
  };

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 96 }} className="flex-1">
        <View className="max-w-md w-full self-center px-6 pt-2">
          {/* Header */}
          <View className="flex-row items-center gap-3 mb-4">
            <Pressable onPress={() => router.back()} className="p-2">
              <Ionicons name="chevron-back" size={22} color={placeholderColor} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text className={`text-2xl ${textClass} font-semibold`} numberOfLines={2}>{college?.name ?? t("home.notAvailable")}</Text>
              <Text className={`${secondaryTextClass} text-sm`}>{college?.location?.city ? `${college.location.city}, ` : ""}{college?.location?.state ?? ""}</Text>
            </View>
          </View>

          {/* Loading */}
          {loading ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" color="#22C55E" />
            </View>
          ) : error ? (
            <View className={`${cardBgClass} border rounded-2xl p-4 w-full mb-4`}>
              <Text className={`text-base ${textClass} mb-2`}>{t("general.error")}</Text>
              <Text className={`${secondaryTextClass} mb-4`}>{error}</Text>
              <Pressable onPress={fetchDetails} className="bg-green-500 rounded-lg py-2 items-center">
                <Text className="text-black font-semibold">{t("general.retry")}</Text>
              </Pressable>
            </View>
          ) : !college ? (
            <View className="py-12 items-center">
              <Text>{t("home.notAvailable")}</Text>
            </View>
          ) : (
            <>
              {/* Key stats card */}
              <View className={`${cardBgClass} border rounded-2xl p-4 mb-4`}>
                <Text className={`text-sm ${secondaryTextClass} mb-3`}>{t("details.keyStats")}</Text>
                <View className="flex-row gap-4">
                  <View style={{ flex: 1 }}>
                    <Text className={`${secondaryTextClass} text-xs`}>{t("details.admissionRate")}</Text>
                    <Text className={`${textClass} text-lg`}>{formatRate(college.admissionRate)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text className={`${secondaryTextClass} text-xs`}>{t("details.completionRate")}</Text>
                    <Text className={`${textClass} text-lg`}>{formatRate(college.completionRate ?? null)}</Text>
                  </View>
                </View>

                <View className="mt-3">
                  <Text className={`${secondaryTextClass} text-xs`}>{t("details.studentSize")}</Text>
                  <Text className={`${textClass} text-lg`}>{typeof college.studentSize === 'number' ? String(college.studentSize) : t("home.notAvailable")} ({college.size ?? 'unknown'})</Text>
                </View>
              </View>

              {/* Cost card */}
              <View className={`${cardBgClass} border rounded-2xl p-4 mb-4`}>
                <Text className={`text-sm ${secondaryTextClass} mb-3`}>{t("details.cost")}</Text>
                <View className="flex-row justify-between items-center mb-3">
                  <Text className={secondaryTextClass}>{t("details.inStateTuition")}</Text>
                  <Text className={textClass}>{formatMoney((college as any).tuitionInState ?? null)}</Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className={secondaryTextClass}>{t("details.outOfStateTuition")}</Text>
                  <Text className={textClass}>{formatMoney((college as any).tuitionOutOfState ?? null)}</Text>
                </View>
              </View>

              {/* Links card */}
              <View className={`${cardBgClass} border rounded-2xl p-4 mb-6`}>
                <Text className={`text-sm ${secondaryTextClass} mb-3`}>{t("details.links")}</Text>

                <Pressable onPress={() => openUrl(college.website)} className={`flex-row items-center justify-between py-3 border-b ${borderClass}`}>
                  <View className="flex-1">
                    <Text className={secondaryTextClass}>{t("details.website")}</Text>
                    <Text className={textClass} numberOfLines={1}>{college.website ?? t("home.notAvailable")}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={placeholderColor} />
                </Pressable>

                <Pressable onPress={() => openUrl(college.priceCalculator)} className="flex-row items-center justify-between py-3">
                  <View className="flex-1">
                    <Text className={secondaryTextClass}>{t("details.priceCalculator")}</Text>
                    <Text className={textClass} numberOfLines={1}>{college.priceCalculator ?? t("home.notAvailable")}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={placeholderColor} />
                </Pressable>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
