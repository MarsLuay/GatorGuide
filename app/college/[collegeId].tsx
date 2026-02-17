import React, { useEffect, useState, useMemo } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable, Linking, Alert, TextInput } from "react-native";
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

  // All-data UI state
  const [showAllDataCollapsed, setShowAllDataCollapsed] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [rowLimit, setRowLimit] = useState(300);

  const inputClass = `w-full ${cardBgClass} ${textClass} border ${borderClass} rounded-lg px-3 py-2`;

  // Flatten raw Scorecard JSON into path/value pairs (primitive leaves only)
  const flattened = useMemo(() => {
    if (!college?.raw) return [] as { path: string; value: any }[];
    const out: { path: string; value: any }[] = [];
    const visit = (obj: any, prefix = '') => {
      if (obj === null) {
        return; // skip null leaves entirely
      }
      if (typeof obj !== 'object') {
        out.push({ path: prefix || 'root', value: obj });
        return;
      }
      if (Array.isArray(obj)) {
        obj.forEach((item, i) => visit(item, prefix ? `${prefix}[${i}]` : `[${i}]`));
        return;
      }
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        const path = prefix ? `${prefix}.${key}` : key;
        if (val === null) {
          // skip nulls
          continue;
        }
        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
          out.push({ path, value: val });
        } else {
          visit(val, path);
        }
      }
    };
    visit(college.raw, '');
    return out;
  }, [college?.raw]);

  // filtered and display rows with truncation and url detection
  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const urlLike = (s: string) => {
      if (!s) return false;
      return /^https?:\/\//i.test(s) || /^www\./i.test(s) || /\.[a-z]{2,}(\/|$)/i.test(s);
    };

    return flattened
      .map((r) => {
        const v = r.value;
        const isUrl = typeof v === 'string' && urlLike(v);
        const str = v === null ? 'null' : String(v);
        const isTruncated = typeof v === 'string' && v.length > 120;
        const display = isTruncated ? `${str.slice(0, 120)}…` : str;
        // Hybrid label: try translations first, then fall back to humanized path
        const humanize = (p: string) =>
          p
            .replace(/\[\d+\]/g, '')
            .replace(/\./g, ' ')
            .replace(/_/g, ' ')
            .split(' ')
            .filter(Boolean)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');

        let label = humanize(r.path);
        try {
          const tKey1 = `scorecard.${r.path}`;
          const tKey2 = r.path;
          const trans1 = t(tKey1 as any);
          if (trans1 && trans1 !== tKey1) label = trans1;
          else {
            const trans2 = t(tKey2 as any);
            if (trans2 && trans2 !== tKey2) label = trans2;
          }
        } catch {
          // ignore missing translations and keep humanized label
        }

        return { path: r.path, label, value: v, display, isUrl, isTruncated };
      })
      .filter((r) => {
        if (!term) return true;
        return r.path.toLowerCase().includes(term) || String(r.value).toLowerCase().includes(term) || (r.label && String(r.label).toLowerCase().includes(term));
      });
  }, [flattened, searchTerm]);

  const displayRows = useMemo(() => filteredRows.slice(0, rowLimit), [filteredRows, rowLimit]);

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
            <View>
              {/* Key stats card (only show present fields) */}
              {(college.admissionRate != null || college.completionRate != null || college.studentSize != null) && (
                <View className={`${cardBgClass} border rounded-2xl p-4 mb-4`}>
                  <Text className={`text-sm ${secondaryTextClass} mb-3`}>{t("details.keyStats")}</Text>
                  <View className="flex-row gap-4">
                    {college.admissionRate != null ? (
                      <View style={{ flex: 1 }}>
                        <Text className={`${secondaryTextClass} text-xs`}>{t("details.admissionRate")}</Text>
                        <Text className={`${textClass} text-lg`}>{formatRate(college.admissionRate)}</Text>
                      </View>
                    ) : null}

                    {college.completionRate != null ? (
                      <View style={{ flex: 1 }}>
                        <Text className={`${secondaryTextClass} text-xs`}>{t("details.completionRate")}</Text>
                        <Text className={`${textClass} text-lg`}>{formatRate(college.completionRate ?? null)}</Text>
                      </View>
                    ) : null}
                  </View>

                  {college.studentSize != null ? (
                    <View className="mt-3">
                      <Text className={`${secondaryTextClass} text-xs`}>{t("details.studentSize")}</Text>
                      <Text className={`${textClass} text-lg`}>{String(college.studentSize)} ({college.size ?? 'unknown'})</Text>
                    </View>
                  ) : null}
                </View>
              )}

              {/* Cost card (only show if there is cost data) */}
              {(college.tuitionInState != null || college.tuitionOutOfState != null) && (
                <View className={`${cardBgClass} border rounded-2xl p-4 mb-4`}>
                  <Text className={`text-sm ${secondaryTextClass} mb-3`}>{t("details.cost")}</Text>
                  {college.tuitionInState != null ? (
                    <View className="flex-row justify-between items-center mb-3">
                      <Text className={secondaryTextClass}>{t("details.inStateTuition")}</Text>
                      <Text className={textClass}>{formatMoney((college as any).tuitionInState)}</Text>
                    </View>
                  ) : null}
                  {college.tuitionOutOfState != null ? (
                    <View className="flex-row justify-between items-center">
                      <Text className={secondaryTextClass}>{t("details.outOfStateTuition")}</Text>
                      <Text className={textClass}>{formatMoney((college as any).tuitionOutOfState)}</Text>
                    </View>
                  ) : null}
                </View>
              )}

              {/* Additional API fields (only show when present) */}
              {(college.degreesAwarded?.highest || college.degreesAwarded?.predominant || college.locale || (college.avgNetPriceOverall != null) || (college.attendanceAcademicYear != null) || (college.pellGrantRate != null) || (college.medianDebtCompletersOverall != null)) && (
                <View className={`${cardBgClass} border rounded-2xl p-4 mb-6`}>
                  <Text className={`text-sm ${secondaryTextClass} mb-3`}>{t("details.moreInfo") ?? "More details"}</Text>

                  {college.degreesAwarded?.highest ? (
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className={secondaryTextClass}>School type</Text>
                      <Text className={textClass}>{String(college.degreesAwarded.highest)}</Text>
                    </View>
                  ) : null}

                  {college.degreesAwarded?.predominant ? (
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className={secondaryTextClass}>Predominant degree</Text>
                      <Text className={textClass}>{String(college.degreesAwarded.predominant)}</Text>
                    </View>
                  ) : null}

                  {college.locale ? (
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className={secondaryTextClass}>Locale</Text>
                      <Text className={textClass}>{String(college.locale)}</Text>
                    </View>
                  ) : null}

                  {college.avgNetPriceOverall != null ? (
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className={secondaryTextClass}>Avg net price</Text>
                      <Text className={textClass}>{formatMoney(college.avgNetPriceOverall)}</Text>
                    </View>
                  ) : null}

                  {college.attendanceAcademicYear != null ? (
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className={secondaryTextClass}>Attendance year</Text>
                      <Text className={textClass}>{String(college.attendanceAcademicYear)}</Text>
                    </View>
                  ) : null}

                  {college.pellGrantRate != null ? (
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className={secondaryTextClass}>Pell grant rate</Text>
                      <Text className={textClass}>{formatRate(college.pellGrantRate)}</Text>
                    </View>
                  ) : null}

                  {college.medianDebtCompletersOverall != null ? (
                    <View className="flex-row justify-between items-center">
                      <Text className={secondaryTextClass}>Median debt (completers)</Text>
                      <Text className={textClass}>{formatMoney(college.medianDebtCompletersOverall)}</Text>
                    </View>
                  ) : null}
                </View>
              )}
              {/* Links card (only if website or price calculator present) */}
              {college.website ? (
                <View className={`${cardBgClass} border rounded-2xl p-4 mb-6`}>
                  <Text className={`text-sm ${secondaryTextClass} mb-3`}>{t("details.links")}</Text>

                  <Pressable onPress={() => openUrl(college.website)} className={`flex-row items-center justify-between py-3`}>
                    <View className="flex-1">
                      <Text className={secondaryTextClass}>{t("details.website")}</Text>
                      <Text className={textClass} numberOfLines={1}>{college.website}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={placeholderColor} />
                  </Pressable>
                </View>
              ) : null}

              {/* All Scorecard Data (collapsible, searchable) */}
              {flattened.length > 0 && <View className={`${cardBgClass} border rounded-2xl p-4 mb-6`}>
                <Pressable
                  onPress={() => setShowAllDataCollapsed((s) => !s)}
                  className="flex-row items-center justify-between mb-3"
                >
                  <Text className={`text-sm ${secondaryTextClass}`}>All data (Scorecard)</Text>
                  <Text className={`${secondaryTextClass}`}>{showAllDataCollapsed ? '+' : '-'}</Text>
                </Pressable>

                {!showAllDataCollapsed && (
                  <React.Fragment>
                    <TextInput
                      value={searchTerm}
                      onChangeText={setSearchTerm}
                      placeholder={t('details.searchData') ?? 'Search keys or values'}
                      placeholderTextColor={placeholderColor}
                      className={`${inputClass} mb-3`}
                    />

                    <ScrollView style={{ maxHeight: 420 }} nestedScrollEnabled>
                      {displayRows.length === 0 ? (
                        <Text className={secondaryTextClass}>{t('home.notAvailable')}</Text>
                      ) : (
                        displayRows.map((row, idx) => (
                          <View key={`${row.path}-${idx}`} className={`py-2 ${idx < displayRows.length - 1 ? 'border-b ' + borderClass : ''}`}>
                            <Text className={`${secondaryTextClass} text-xs`}>{row.label}</Text>
                            {row.isUrl ? (
                              <Pressable onPress={() => openUrl(row.value as string)}>
                                <Text className={`${textClass} text-sm underline`}>{String(row.value)}</Text>
                              </Pressable>
                            ) : (
                              <View className="flex-row items-center justify-between">
                                <Text className={`${textClass} text-sm`} numberOfLines={1} ellipsizeMode="tail">
                                  {row.display}
                                </Text>
                                {row.isTruncated && (
                                  <Pressable onPress={() => Alert.alert(row.path, String(row.value))} className="ml-2">
                                    <Text className={`${secondaryTextClass} text-xs`}>{t('details.showFull') ?? 'Show full'}</Text>
                                  </Pressable>
                                )}
                              </View>
                            )}
                          </View>
                        ))
                      )}
                    </ScrollView>

                    {filteredRows.length > rowLimit && (
                      <Pressable onPress={() => setRowLimit(filteredRows.length)} className="mt-3 rounded-lg py-2 items-center bg-green-500">
                        <Text className="text-black font-semibold">{t('details.showMore') ?? 'Show more'}</Text>
                      </Pressable>
                    )}
                  </React.Fragment>
                )}
              </View>}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
