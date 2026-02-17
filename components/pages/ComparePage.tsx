import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
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

  const { textClass, secondaryTextClass, borderClass, cardBgClass } = styles;
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

  const toggle = (c: College) => {
    const idx = selected.findIndex((x) => x.id === c.id);
    if (idx >= 0) {
      setSelected(selected.filter((_, i) => i !== idx));
    } else if (selected.length < MAX_SELECT) {
      setSelected([...selected, c]);
    }
  };

  const formatTuition = (n: number | null) => {
    if (n === null || typeof n !== 'number') return t("home.notAvailable");
    return n >= 1000 ? "$" + (n / 1000).toFixed(0) + "k" : "$" + n;
  };
  const formatRate = (r: number | null) => {
    if (r === null || typeof r !== 'number') return t("home.notAvailable");
    return Math.round(r * 100) + "%";
  };

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
              <Text className={secondaryTextClass + " text-sm mb-2"}>
                {t("compare.selectUpTo")}
              </Text>
              <View className={cardBgClass + " border rounded-2xl overflow-hidden mb-6"}>
                {colleges.map((c) => {
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
                          <Text className={secondaryTextClass + " text-sm"}>
                            {c.location.city}, {c.location.state}
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

              {selected.length >= 2 && (
                <View className={cardBgClass + " border rounded-2xl p-4"}>
                  <Text className={textClass + " font-semibold mb-4"}>
                    {t("compare.comparison")}
                  </Text>
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
                              {t("compare.tuition")}: {formatTuition(c.tuition)}
                            </Text>
                            <Text className={secondaryTextClass + " text-xs"}>
                              {t("compare.admissionRate")}: {formatRate(c.admissionRate)}
                            </Text>
                            <Text className={secondaryTextClass + " text-xs"}>
                              {t("compare.size")}: {c.size === 'unknown' ? t('home.notAvailable') : c.size}
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
