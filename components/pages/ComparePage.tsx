import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, TextInput } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import useBack from "@/hooks/use-back";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { useAppLanguage } from "@/hooks/use-app-language";
import { collegeService, College } from "@/services";

const MAX_SELECT = 3;

export default function ComparePage() {
  const back = useBack();
  const styles = useThemeStyles();
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const [colleges, setColleges] = useState<College[]>([]);
  const [selected, setSelected] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"match" | "tuition" | "admission">("match");

  const { textClass, secondaryTextClass, borderClass, cardBgClass, inputBgClass, placeholderColor } = styles;
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await collegeService.getMatches({});
        if (!cancelled) setColleges(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const getTuitionValue = (c: College) => {
    const n = typeof c.tuition === "number" ? c.tuition : c.tuitionInState ?? c.tuitionOutOfState ?? null;
    return typeof n === "number" ? n : null;
  };

  const toggle = (c: College) => {
    setSelected((prev) => {
      const idx = prev.findIndex((x) => x.id === c.id);
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      if (prev.length >= MAX_SELECT) return prev;
      return [...prev, c];
    });
  };

  const formatTuition = (n: number | null) => {
    if (n === null || typeof n !== 'number') return t("home.notAvailable");
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  };
  const formatRate = (r: number | null) => {
    if (r === null || typeof r !== 'number') return t("home.notAvailable");
    return Math.round(r * 100) + "%";
  };
  const formatSize = (c: College) => {
    if (typeof c.studentSize === "number") return c.studentSize.toLocaleString();
    if (c.size === "small" || c.size === "medium" || c.size === "large") return c.size;
    return t("home.notAvailable");
  };

  const filteredColleges = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const base = q
      ? colleges.filter((c) =>
          [c.name, c.location.city, c.location.state]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q)
        )
      : colleges;

    return [...base].sort((a, b) => {
      if (sortBy === "tuition") {
        const at = getTuitionValue(a);
        const bt = getTuitionValue(b);
        if (at === null && bt === null) return 0;
        if (at === null) return 1;
        if (bt === null) return -1;
        return at - bt;
      }
      if (sortBy === "admission") {
        const ar = typeof a.admissionRate === "number" ? a.admissionRate : -1;
        const br = typeof b.admissionRate === "number" ? b.admissionRate : -1;
        return br - ar;
      }
      const am = typeof a.matchScore === "number" ? a.matchScore : 0;
      const bm = typeof b.matchScore === "number" ? b.matchScore : 0;
      return bm - am;
    });
  }, [colleges, searchTerm, sortBy]);

  const cheapestSelected = useMemo(() => {
    const withCost = selected
      .map((c) => ({ c, cost: getTuitionValue(c) }))
      .filter((x) => x.cost !== null) as { c: College; cost: number }[];
    if (!withCost.length) return null;
    return withCost.reduce((best, cur) => (cur.cost < best.cost ? cur : best));
  }, [selected]);

  const highestAdmissionSelected = useMemo(() => {
    const withRate = selected
      .map((c) => ({ c, rate: c.admissionRate }))
      .filter((x) => typeof x.rate === "number") as { c: College; rate: number }[];
    if (!withRate.length) return null;
    return withRate.reduce((best, cur) => (cur.rate > best.rate ? cur : best));
  }, [selected]);

  return (
    <ScreenBackground>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 96 }}
      >
        <View className="max-w-md w-full self-center px-6 pt-6">
          <Pressable onPress={back} className="mb-4 flex-row items-center">
            <MaterialIcons name="arrow-back" size={24} color={styles.placeholderColor} />
            <Text className={secondaryTextClass + " ml-2"}>{t("general.back")}</Text>
          </Pressable>

          <Text className={"text-2xl " + textClass + " mb-1"}>
            {t("compare.title")}
          </Text>
          <Text className={secondaryTextClass + " mb-6"}>
            {t("compare.subtitle")}
          </Text>

          {loading ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" color="#22C55E" />
            </View>
          ) : (
            <>
              <View className={`${cardBgClass} border rounded-2xl p-4 mb-4`}>
                <TextInput
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  placeholder={t("compare.searchPlaceholder")}
                  placeholderTextColor={placeholderColor}
                  className={`${inputBgClass} ${textClass} border ${borderClass} rounded-xl px-4 py-3 mb-3`}
                />
                <View className="flex-row gap-2">
                  {(["match", "tuition", "admission"] as const).map((key) => (
                    <Pressable
                      key={key}
                      onPress={() => setSortBy(key)}
                      className={`px-3 py-2 rounded-lg border ${
                        sortBy === key ? "bg-green-500 border-green-500" : `${cardBgClass} ${borderClass}`
                      }`}
                    >
                      <Text className={sortBy === key ? "text-black font-medium" : textClass}>
                        {key === "match" ? t("compare.sortMatch") : key === "tuition" ? t("compare.sortTuition") : t("compare.sortAdmission")}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Text className={secondaryTextClass + " text-sm mb-2"}>
                {t("compare.selectedCount", { count: selected.length, max: MAX_SELECT })}
              </Text>
              <View className={cardBgClass + " border rounded-2xl overflow-hidden mb-6"}>
                {filteredColleges.map((c) => {
                  const isSelected = selected.some((x) => x.id === c.id);
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => toggle(c)}
                      className={"flex-row items-center justify-between px-4 py-4 border-b " + borderClass + " last:border-b-0"}
                    >
                      <View className="flex-1">
                        <Pressable onPress={(e: any) => { e?.stopPropagation?.(); router.push({ pathname: "/college/[collegeId]", params: { collegeId: String(c.id) } }); }}>
                          <Text className={textClass + " font-medium"}>{c.name}</Text>
                          <Text className={secondaryTextClass + " text-sm"} numberOfLines={1}>
                            {c.location.city}, {c.location.state} • {t("compare.tuition")}: {formatTuition(getTuitionValue(c))}
                          </Text>
                        </Pressable>
                      </View>
                      <View
                        className={
                          "w-8 h-8 rounded-full border-2 items-center justify-center " +
                          (isSelected ? "bg-green-500 border-green-500" : "border " + borderClass)
                        }
                      >
                        {isSelected && (
                          <MaterialIcons name="check" size={18} color="white" />
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {selected.length > 0 && (
                <View className={`${cardBgClass} border rounded-2xl p-4 mb-4`}>
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className={textClass + " font-semibold"}>{t("compare.selectedColleges")}</Text>
                    <Pressable onPress={() => setSelected([])}>
                      <Text className="text-red-500">{t("compare.clearSelection")}</Text>
                    </Pressable>
                  </View>
                  <View className="gap-2">
                    {selected.map((c) => (
                      <Text key={c.id} className={secondaryTextClass}>• {c.name}</Text>
                    ))}
                  </View>
                </View>
              )}

              {selected.length < 2 ? (
                <View className={`${cardBgClass} border rounded-2xl p-4`}>
                  <Text className={secondaryTextClass}>{t("compare.chooseAtLeastTwo")}</Text>
                </View>
              ) : (
                <View className={cardBgClass + " border rounded-2xl p-4"}>
                  <Text className={textClass + " font-semibold mb-4"}>
                    {t("compare.comparison")}
                  </Text>

                  <View className={`${cardBgClass} border rounded-xl p-3 mb-4`}>
                    <Text className={`${textClass} font-medium mb-2`}>{t("compare.quickHighlights")}</Text>
                    <Text className={secondaryTextClass}>
                      {t("compare.cheapest")}: {cheapestSelected ? `${cheapestSelected.c.name} (${formatTuition(cheapestSelected.cost)})` : t("home.notAvailable")}
                    </Text>
                    <Text className={secondaryTextClass}>
                      {t("compare.highestAdmission")}: {highestAdmissionSelected ? `${highestAdmissionSelected.c.name} (${formatRate(highestAdmissionSelected.rate)})` : t("home.notAvailable")}
                    </Text>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row gap-4">
                      {selected.map((c) => (
                        <View
                          key={c.id}
                          className="min-w-[180] border rounded-xl p-3 border-green-500/50"
                        >
                          <Text className={textClass + " font-medium mb-2"} numberOfLines={2}>
                            {c.name}
                          </Text>
                          <View className="gap-1">
                            <Text className={secondaryTextClass + " text-xs"}>
                              {t("compare.location")}: {c.location.city}, {c.location.state}
                            </Text>
                            <Text className={secondaryTextClass + " text-xs"}>
                              {t("compare.tuition")}: {formatTuition(getTuitionValue(c))}
                            </Text>
                            <Text className={secondaryTextClass + " text-xs"}>
                              {t("compare.admissionRate")}: {formatRate(c.admissionRate)}
                            </Text>
                            <Text className={secondaryTextClass + " text-xs"}>
                              {t("compare.size")}: {formatSize(c)}
                            </Text>
                            <Text className={secondaryTextClass + " text-xs"}>
                              {t("compare.setting")}: {c.setting}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
