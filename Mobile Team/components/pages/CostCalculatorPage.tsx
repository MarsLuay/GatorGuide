import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import useBack from "@/hooks/use-back";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useAppData } from "@/hooks/use-app-data";
import type { College } from "@/services/college.service";

function getTuitionValue(college: College): number | null {
  const tuition = typeof college.tuition === "number" ? college.tuition : college.tuitionInState ?? college.tuitionOutOfState ?? null;
  return typeof tuition === "number" ? tuition : null;
}

export default function CostCalculatorPage() {
  const styles = useThemeStyles();
  const back = useBack("/(tabs)/resources");
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const { state } = useAppData();
  const savedColleges = useMemo(() => state.savedColleges ?? [], [state.savedColleges]);
  const hasAutoPrefilledTuitionRef = useRef(false);

  const [tuition, setTuition] = useState("");
  const [fees, setFees] = useState("");
  const [housingFood, setHousingFood] = useState("");
  const [booksSupplies, setBooksSupplies] = useState("");
  const [personalTransport, setPersonalTransport] = useState("");
  const [years, setYears] = useState("4");
  const [annualIncrease, setAnnualIncrease] = useState("3");
  const [financialAid, setFinancialAid] = useState("");
  const [selectedCollegeId, setSelectedCollegeId] = useState<string | null>(null);

  const { textClass, secondaryTextClass, borderClass, cardBgClass, inputBgClass, placeholderColor } = styles;

  // Input helpers sanitize user text into bounded numeric values for calculations.
  const currencyNum = (s: string) => (s.trim() === "" ? 0 : Number(s.replace(/\D/g, "")) || 0);
  const percentNum = (s: string) => {
    if (s.trim() === "") return 0;
    const n = Number(s.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(25, n));
  };
  const tuitionNum = currencyNum(tuition);
  const feesNum = currencyNum(fees);
  const housingFoodNum = currencyNum(housingFood);
  const booksSuppliesNum = currencyNum(booksSupplies);
  const personalTransportNum = currencyNum(personalTransport);
  const yearsNum = Math.max(1, Math.min(10, currencyNum(years) || 4));
  const aidPerYearNum = currencyNum(financialAid);
  const annualIncreasePct = percentNum(annualIncrease);

  const baseYearCost = tuitionNum + feesNum + housingFoodNum + booksSuppliesNum + personalTransportNum;
  // Compound annual increase, then apply yearly aid to estimate net out-of-pocket cost.
  const yearlyRows = Array.from({ length: yearsNum }, (_, idx) => {
    const beforeAid = Math.round(baseYearCost * Math.pow(1 + annualIncreasePct / 100, idx));
    const aid = Math.min(beforeAid, aidPerYearNum);
    const net = Math.max(0, beforeAid - aid);
    return { year: idx + 1, beforeAid, aid, net };
  });

  const totalBeforeAid = yearlyRows.reduce((sum, row) => sum + row.beforeAid, 0);
  const totalAid = yearlyRows.reduce((sum, row) => sum + row.aid, 0);
  const totalAfterAid = Math.max(0, totalBeforeAid - totalAid);
  const monthlyEstimate = Math.round(totalAfterAid / Math.max(1, yearsNum * 12));
  const selectedCollege = savedColleges.find((college) => String(college.id) === selectedCollegeId) ?? null;

  const format = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  useEffect(() => {
    if (!savedColleges.length) {
      setSelectedCollegeId(null);
      return;
    }

    if (selectedCollegeId && savedColleges.some((college) => String(college.id) === selectedCollegeId)) return;

    const defaultCollege = savedColleges.find((college) => getTuitionValue(college) !== null) ?? savedColleges[0];
    setSelectedCollegeId(String(defaultCollege.id));
  }, [savedColleges, selectedCollegeId]);

  useEffect(() => {
    if (!selectedCollege || hasAutoPrefilledTuitionRef.current) return;

    const tuitionValue = getTuitionValue(selectedCollege);
    if (tuitionValue != null) {
      setTuition(String(tuitionValue));
    }

    hasAutoPrefilledTuitionRef.current = true;
  }, [selectedCollege]);

  return (
    <ScreenBackground>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 96 }}
      >
        <View className="max-w-md w-full self-center px-6 pt-6">
          <Pressable onPress={back} className="mb-4 flex-row items-center">
            <MaterialIcons name="arrow-back" size={24} color={placeholderColor} />
            <Text className={`${secondaryTextClass} ml-2`}>{t("general.back")}</Text>
          </Pressable>

          <Text className={`text-2xl ${textClass} mb-1`}>
            {t("cost.title")}
          </Text>
          <Text className={`${secondaryTextClass} mb-6`}>
            {t("cost.subtitle")}
          </Text>

          {savedColleges.length === 0 ? (
            <View className={`${cardBgClass} border rounded-2xl p-6 mb-6`}>
              <MaterialIcons name="bookmark-border" size={48} color={placeholderColor} style={{ alignSelf: "center", marginBottom: 12 }} />
              <Text className={`${textClass} text-center font-medium mb-2`}>
                {t("tools.saveCollegesFirst")}
              </Text>
              <Text className={`${secondaryTextClass} text-center text-sm`}>
                {t("tools.saveCollegesFirstHint")}
              </Text>
            </View>
          ) : (
            <View className={`${cardBgClass} border rounded-2xl p-4 mb-4`}>
              <Text className={`${secondaryTextClass} text-sm mb-2`}>
                {t("cost.selectFromSaved")}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
                <View className="flex-row gap-2">
                  {savedColleges.map((c) => {
                    const tuitionVal = getTuitionValue(c);
                    const isSelected = String(c.id) === selectedCollegeId;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => {
                          setSelectedCollegeId(String(c.id));
                          setTuition(String(tuitionVal ?? ""));
                        }}
                        className={`px-3 py-2 rounded-lg border ${
                          isSelected ? "bg-emerald-500 border-emerald-500" : borderClass
                        }`}
                      >
                        <Text className={`${isSelected ? "text-white font-medium" : `${textClass} text-sm`}`} numberOfLines={1}>
                          {c.name}
                        </Text>
                        <Text className={`${isSelected ? "text-white/80 text-xs" : `${secondaryTextClass} text-xs`}`}>
                          {tuitionVal != null ? `$${tuitionVal.toLocaleString()}` : t("home.notAvailable")}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
              {selectedCollege ? (
                <Text className={`${secondaryTextClass} text-sm`}>
                  {t("cost.prefillHint", { college: selectedCollege.name })}
                </Text>
              ) : null}
            </View>
          )}

          <View className={`${cardBgClass} border rounded-2xl p-4 mb-4`}>
            <Text className={`${secondaryTextClass} text-sm mb-2`}>
              {t("cost.tuitionPerYear")}
            </Text>
            <TextInput
              value={tuition}
              onChangeText={(v) => setTuition(v.replace(/\D/g, ""))}
              placeholder="0"
              placeholderTextColor={placeholderColor}
              keyboardType="number-pad"
              className={`${inputBgClass} ${textClass} border ${borderClass} rounded-xl px-4 py-3`}
            />
          </View>

          <View className={`${cardBgClass} border rounded-2xl p-4 mb-4`}>
            <Text className={`${secondaryTextClass} text-sm mb-2`}>
              {t("cost.feesPerYear")}
            </Text>
            <TextInput
              value={fees}
              onChangeText={(v) => setFees(v.replace(/\D/g, ""))}
              placeholder="0"
              placeholderTextColor={placeholderColor}
              keyboardType="number-pad"
              className={`${inputBgClass} ${textClass} border ${borderClass} rounded-xl px-4 py-3`}
            />
          </View>

          <View className={`${cardBgClass} border rounded-2xl p-4 mb-4`}>
            <Text className={`${secondaryTextClass} text-sm mb-2`}>
              {t("cost.housingFoodPerYear")}
            </Text>
            <TextInput
              value={housingFood}
              onChangeText={(v) => setHousingFood(v.replace(/\D/g, ""))}
              placeholder="0"
              placeholderTextColor={placeholderColor}
              keyboardType="number-pad"
              className={`${inputBgClass} ${textClass} border ${borderClass} rounded-xl px-4 py-3`}
            />
          </View>

          <View className={`${cardBgClass} border rounded-2xl p-4 mb-4`}>
            <Text className={`${secondaryTextClass} text-sm mb-2`}>
              {t("cost.booksSuppliesPerYear")}
            </Text>
            <TextInput
              value={booksSupplies}
              onChangeText={(v) => setBooksSupplies(v.replace(/\D/g, ""))}
              placeholder="0"
              placeholderTextColor={placeholderColor}
              keyboardType="number-pad"
              className={`${inputBgClass} ${textClass} border ${borderClass} rounded-xl px-4 py-3`}
            />
          </View>

          <View className={`${cardBgClass} border rounded-2xl p-4 mb-4`}>
            <Text className={`${secondaryTextClass} text-sm mb-2`}>
              {t("cost.personalTransportPerYear")}
            </Text>
            <TextInput
              value={personalTransport}
              onChangeText={(v) => setPersonalTransport(v.replace(/\D/g, ""))}
              placeholder="0"
              placeholderTextColor={placeholderColor}
              keyboardType="number-pad"
              className={`${inputBgClass} ${textClass} border ${borderClass} rounded-xl px-4 py-3`}
            />
          </View>

          <View className={`${cardBgClass} border rounded-2xl p-4 mb-4`}>
            <Text className={`${secondaryTextClass} text-sm mb-2`}>
              {t("cost.years")}
            </Text>
            <TextInput
              value={years}
              onChangeText={(v) => setYears(v.replace(/\D/g, ""))}
              placeholder="4"
              placeholderTextColor={placeholderColor}
              keyboardType="number-pad"
              className={`${inputBgClass} ${textClass} border ${borderClass} rounded-xl px-4 py-3`}
            />
          </View>

          <View className={`${cardBgClass} border rounded-2xl p-4 mb-4`}>
            <Text className={`${secondaryTextClass} text-sm mb-2`}>
              {t("cost.annualIncrease")}
            </Text>
            <TextInput
              value={annualIncrease}
              onChangeText={(v) => setAnnualIncrease(v.replace(/[^0-9.]/g, ""))}
              placeholder="0"
              placeholderTextColor={placeholderColor}
              keyboardType="decimal-pad"
              className={`${inputBgClass} ${textClass} border ${borderClass} rounded-xl px-4 py-3`}
            />
          </View>

          <View className={`${cardBgClass} border rounded-2xl p-4 mb-6`}>
            <Text className={`${secondaryTextClass} text-sm mb-2`}>
              {t("cost.aidPerYear")}
            </Text>
            <TextInput
              value={financialAid}
              onChangeText={(v) => setFinancialAid(v.replace(/\D/g, ""))}
              placeholder="0"
              placeholderTextColor={placeholderColor}
              keyboardType="number-pad"
              className={`${inputBgClass} ${textClass} border ${borderClass} rounded-xl px-4 py-3`}
            />
          </View>

          <View className={`${cardBgClass} border rounded-2xl p-5 border-emerald-500/50`}>
            <Text className={`${secondaryTextClass} text-sm mb-1`}>
              {t("cost.estimatedTotal")}
            </Text>
            <Text className="text-2xl font-semibold text-emerald-500">
              {format(totalAfterAid)}
            </Text>
            <Text className={`${secondaryTextClass} text-xs mt-2`}>
              {t("cost.beforeAid")}: {format(totalBeforeAid)}
            </Text>
            <Text className={`${secondaryTextClass} text-xs mt-1`}>
              {t("cost.financialAid")}: {format(totalAid)}
            </Text>
            <Text className={`${secondaryTextClass} text-xs mt-1`}>
              {t("cost.monthlyEstimate")}: {format(monthlyEstimate)}
            </Text>
          </View>

          <View className={`${cardBgClass} border rounded-2xl p-4 mt-4`}>
            <Text className={`${secondaryTextClass} text-sm mb-3`}>{t("cost.costBreakdown")}</Text>
            {yearlyRows.map((row) => (
              <View key={row.year} className={`py-3 ${row.year !== yearlyRows.length ? `border-b ${borderClass}` : ""}`}>
                <Text className={`${textClass} font-medium mb-1`}>
                  {t("cost.year")} {row.year}
                </Text>
                <Text className={`${secondaryTextClass} text-xs`}>
                  {t("cost.beforeAid")}: {format(row.beforeAid)}
                </Text>
                <Text className={`${secondaryTextClass} text-xs`}>
                  {t("cost.financialAid")}: {format(row.aid)}
                </Text>
                <Text className={`${secondaryTextClass} text-xs`}>
                  {t("cost.netPerYear")}: {format(row.net)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
