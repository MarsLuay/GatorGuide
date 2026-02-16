import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { useAppLanguage } from "@/hooks/use-app-language";

export default function CostCalculatorPage() {
  const styles = useThemeStyles();
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();

  const [tuition, setTuition] = useState("");
  const [fees, setFees] = useState("");
  const [years, setYears] = useState("4");
  const [financialAid, setFinancialAid] = useState("");

  const { textClass, secondaryTextClass, borderClass, cardBgClass, inputBgClass, placeholderColor } = styles;

  const num = (s: string) => (s.trim() === "" ? 0 : Number(s.replace(/\D/g, "")) || 0);
  const tuitionNum = num(tuition);
  const feesNum = num(fees);
  const yearsNum = Math.max(1, Math.min(10, num(years) || 4));
  const aidNum = num(financialAid);

  const costPerYear = tuitionNum + feesNum;
  const totalBeforeAid = costPerYear * yearsNum;
  const totalAfterAid = Math.max(0, totalBeforeAid - aidNum);

  const format = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <ScreenBackground>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 96 }}
      >
        <View className="max-w-md w-full self-center px-6 pt-6">
          <Pressable
            onPress={() => router.back()}
            className="mb-4 flex-row items-center"
          >
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

          <View className={`${cardBgClass} border rounded-2xl p-4 mb-6`}>
            <Text className={`${secondaryTextClass} text-sm mb-2`}>
              {t("cost.financialAid")}
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
            {(totalBeforeAid > 0 && aidNum > 0) ? (
              <Text className={`${secondaryTextClass} text-xs mt-2`}>
                {t("cost.beforeAid")}: {format(totalBeforeAid)}
              </Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
