import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import useBack from "@/hooks/use-back";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { useAppLanguage } from "@/hooks/use-app-language";

export default function CostCalculatorPage() {
  const back = useBack();
  const styles = useThemeStyles();
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();

  const [tuition, setTuition] = useState("");
  const [fees, setFees] = useState("");
  const [housingFood, setHousingFood] = useState("");
  const [booksSupplies, setBooksSupplies] = useState("");
  const [personalTransport, setPersonalTransport] = useState("");
  const [years, setYears] = useState("4");
  const [annualIncrease, setAnnualIncrease] = useState("3");
  const [financialAid, setFinancialAid] = useState("");

  const { textClass, secondaryTextClass, borderClass, cardBgClass, inputBgClass, placeholderColor } = styles;

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

  const format = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

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

          <View className={`${cardBgClass} border rounded-2xl p-5 border-green-500/50`}>
            <Text className={`${secondaryTextClass} text-sm mb-1`}>
              {t("cost.estimatedTotal")}
            </Text>
            <Text className="text-2xl font-semibold text-green-500">
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
