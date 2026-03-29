import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, useWindowDimensions } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ROUTES } from "@/constants/routes";
import useBack from "@/hooks/use-back";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useAppData } from "@/hooks/use-app-data";
import type { College } from "@/services/college.service";
import { formatLocalizedCurrency } from "@/utils/locale-format";

type ResidencyMode = "inState" | "outOfState";

function getTuitionValue(college: College): number | null {
  const tuition =
    typeof college.tuition === "number" ? college.tuition : college.tuitionInState ?? college.tuitionOutOfState ?? null;
  return typeof tuition === "number" ? tuition : null;
}

function getDefaultResidencyMode(residencyType?: string): ResidencyMode {
  return residencyType === "outOfState" || residencyType === "international" ? "outOfState" : "inState";
}

function getOfficialTuitionValue(college: College | null, residencyMode: ResidencyMode): number | null {
  if (!college) return null;

  const preferred = residencyMode === "inState" ? college.tuitionInState : college.tuitionOutOfState;
  const fallback = residencyMode === "inState" ? college.tuitionOutOfState : college.tuitionInState;
  const tuition = preferred ?? college.tuition ?? fallback ?? null;
  return typeof tuition === "number" ? tuition : null;
}

export default function CostCalculatorPage() {
  const router = useRouter();
  const styles = useThemeStyles();
  const back = useBack(ROUTES.tabsResources);
  const { t, language } = useAppLanguage();
  const { getScrollContentPadding } = useResponsiveLayout();
  const { width } = useWindowDimensions();
  const { state } = useAppData();
  const savedColleges = useMemo(() => state.savedColleges ?? [], [state.savedColleges]);
  const userResidencyDefault = useMemo(() => getDefaultResidencyMode(state.user?.residencyType), [state.user?.residencyType]);

  const [residencyMode, setResidencyMode] = useState<ResidencyMode>(userResidencyDefault);
  const [tuition, setTuition] = useState("");
  const [fees, setFees] = useState("");
  const [housingFood, setHousingFood] = useState("");
  const [booksSupplies, setBooksSupplies] = useState("");
  const [transportation, setTransportation] = useState("");
  const [miscellaneous, setMiscellaneous] = useState("");
  const [years, setYears] = useState("4");
  const [annualIncrease, setAnnualIncrease] = useState("3");
  const [financialAid, setFinancialAid] = useState("");
  const [selectedCollegeId, setSelectedCollegeId] = useState<string | null>(null);

  const { textClass, secondaryTextClass, borderClass, cardBgClass, inputBgClass, placeholderColor } = styles;
  const isCompactPhone = width < 390;
  const isTablet = width >= 768;
  const isWideLayout = width >= 1180;
  const showTwoColumnLayout = width >= 1180;
  const showInputGrid = width >= 900;
  const showChipWrap = width >= 860;
  const showOfficialGrid = width >= 840;
  const showYearGrid = width >= 980;
  const shellHorizontalPadding = width >= 1280 ? 32 : isTablet ? 24 : isCompactPhone ? 16 : 20;
  const pageMaxWidth = isWideLayout ? 1320 : isTablet ? 1040 : 720;
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
    extraTop: 12,
  });
  const inputCardWidth = showInputGrid ? (isWideLayout ? "48.8%" : "48.2%") : "100%";
  const chipCardWidth = isWideLayout ? "31.8%" : isTablet ? "48.4%" : "100%";
  const officialRowWidth = isWideLayout ? "48.6%" : "48.2%";
  const yearlyCardWidth = isWideLayout ? "48.8%" : "48.2%";

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
  const transportationNum = currencyNum(transportation);
  const miscellaneousNum = currencyNum(miscellaneous);
  const yearsNum = Math.max(1, Math.min(10, currencyNum(years) || 4));
  const aidPerYearNum = currencyNum(financialAid);
  const annualIncreasePct = percentNum(annualIncrease);

  const baseYearCost = tuitionNum + feesNum + housingFoodNum + booksSuppliesNum + transportationNum + miscellaneousNum;
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
  const officialTuition = useMemo(
    () => getOfficialTuitionValue(selectedCollege, residencyMode),
    [selectedCollege, residencyMode]
  );
  const officialNetPrice = typeof selectedCollege?.avgNetPriceOverall === "number" ? selectedCollege.avgNetPriceOverall : null;
  const attendanceYear = String(selectedCollege?.attendanceAcademicYear ?? "").trim();
  const notAvailable = t("home.notAvailable");

  const format = (n: number) => formatLocalizedCurrency(n, language);
  const formatMoney = (n: number | null | undefined) => (typeof n === "number" ? format(n) : notAvailable);
  const selectedResidencyLabel = residencyMode === "inState" ? t("cost.inState") : t("cost.outOfState");

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
    setResidencyMode(userResidencyDefault);
  }, [userResidencyDefault]);

  useEffect(() => {
    if (!selectedCollege) {
      setTuition("");
      return;
    }

    setTuition(officialTuition != null ? String(officialTuition) : "");
  }, [selectedCollegeId, selectedCollege, officialTuition]);

  const renderInputCard = ({
    label,
    value,
    onChangeText,
    helperText,
    keyboardType = "number-pad",
    placeholder = "0",
  }: {
    label: string;
    value: string;
    onChangeText: (value: string) => void;
    helperText?: string;
    keyboardType?: "number-pad" | "decimal-pad";
    placeholder?: string;
  }) => (
    <View className={`${cardBgClass} border rounded-2xl p-4`} style={{ width: inputCardWidth }}>
      <Text className={`${secondaryTextClass} text-sm mb-2`}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        keyboardType={keyboardType}
        className={`${inputBgClass} ${textClass} border ${borderClass} rounded-xl px-4 py-3`}
      />
      {helperText ? (
        <Text className={`${secondaryTextClass} text-xs mt-2`}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );

  const officialRows = [
    {
      label: `${t("cost.selectedTuition")} (${selectedResidencyLabel})`,
      value: formatMoney(officialTuition),
      highlight: true,
    },
    { label: t("compare.inStateTuition"), value: formatMoney(selectedCollege?.tuitionInState) },
    { label: t("compare.outOfStateTuition"), value: formatMoney(selectedCollege?.tuitionOutOfState) },
    { label: t("compare.netPrice"), value: formatMoney(officialNetPrice) },
    {
      label: t("compare.attendanceYear"),
      value: attendanceYear || notAvailable,
    },
  ];

  const emptyStateSection = savedColleges.length === 0 ? (
    <View className={`${cardBgClass} border rounded-2xl p-6 mb-6`}>
      <MaterialIcons name="bookmark-border" size={48} color={placeholderColor} style={{ alignSelf: "center", marginBottom: 12 }} />
      <Text className={`${textClass} text-center font-medium mb-2`}>
        {t("tools.saveCollegesFirst")}
      </Text>
      <Text className={`${secondaryTextClass} text-center text-sm`} style={{ lineHeight: 20 }}>
        {t("tools.saveCollegesFirstHint")}
      </Text>
      <Pressable
        onPress={() => router.push(ROUTES.tabs)}
        className="mt-4 self-center flex-row items-center rounded-xl bg-emerald-500 px-4 py-3"
      >
        <MaterialIcons name="search" size={18} color="#FFFFFF" />
        <Text className="ml-2 text-white font-semibold">{t("home.search")}</Text>
      </Pressable>
    </View>
  ) : null;

  const savedCollegeSection = savedColleges.length > 0 ? (
    <View className={`${cardBgClass} border rounded-2xl p-4 mb-6`}>
      <Text className={`${secondaryTextClass} text-sm mb-3`}>
        {t("cost.selectFromSaved")}
      </Text>
      {showChipWrap ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {savedColleges.map((c) => {
            const tuitionVal = getOfficialTuitionValue(c, residencyMode);
            const isSelected = String(c.id) === selectedCollegeId;
            return (
              <Pressable
                key={c.id}
                onPress={() => {
                  setSelectedCollegeId(String(c.id));
                }}
                className={`rounded-xl border px-3 py-3 ${
                  isSelected ? "bg-emerald-500 border-emerald-500" : borderClass
                }`}
                style={{ width: chipCardWidth, minHeight: isTablet ? 76 : 68, justifyContent: "center" }}
              >
                <Text className={`${isSelected ? "text-white font-medium" : `${textClass} text-sm`}`} numberOfLines={2}>
                  {c.name}
                </Text>
                <Text className={`${isSelected ? "text-white/80 text-xs" : `${secondaryTextClass} text-xs`}`} style={{ marginTop: 4 }}>
                  {formatMoney(tuitionVal)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-1">
          <View className="flex-row" style={{ gap: 12, paddingRight: 4 }}>
            {savedColleges.map((c) => {
              const tuitionVal = getOfficialTuitionValue(c, residencyMode);
              const isSelected = String(c.id) === selectedCollegeId;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    setSelectedCollegeId(String(c.id));
                  }}
                  className={`px-3 py-2 rounded-lg border ${
                    isSelected ? "bg-emerald-500 border-emerald-500" : borderClass
                  }`}
                  style={{ minWidth: 170, maxWidth: 260 }}
                >
                  <Text className={`${isSelected ? "text-white font-medium" : `${textClass} text-sm`}`} numberOfLines={2}>
                    {c.name}
                  </Text>
                  <Text className={`${isSelected ? "text-white/80 text-xs" : `${secondaryTextClass} text-xs`}`} style={{ marginTop: 4 }}>
                    {formatMoney(tuitionVal)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
      {selectedCollege ? (
        <Text className={`${secondaryTextClass} text-sm mt-3`} style={{ lineHeight: 20 }}>
          {t("cost.prefillHint", { college: selectedCollege.name })}
        </Text>
      ) : null}
    </View>
  ) : null;

  const officialDataSection = selectedCollege ? (
    <View className={`${cardBgClass} border rounded-2xl p-4 mb-5`}>
      <View
        style={{
          flexDirection: isTablet ? "row" : "column",
          alignItems: isTablet ? "center" : "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <Text className={`${textClass} text-base font-semibold`}>
          {t("cost.officialData")}
        </Text>
        <View className="rounded-full bg-emerald-500/10 px-3 py-1">
          <Text className="text-xs font-medium text-emerald-600">
            {t("cost.officialSource")}
          </Text>
        </View>
      </View>

      <Text className={`${secondaryTextClass} text-sm mb-4`} style={{ lineHeight: 20 }}>
        {t("cost.officialDataHint", { college: selectedCollege.name })}
      </Text>

      <Text className={`${secondaryTextClass} text-sm mb-2`}>
        {t("cost.residencyLabel")}
      </Text>

      <View className="mb-4" style={{ flexDirection: "row", gap: 12 }}>
        {(["inState", "outOfState"] as const).map((option) => {
          const isSelected = option === residencyMode;
          const label = option === "inState" ? t("cost.inState") : t("cost.outOfState");

          return (
            <Pressable
              key={option}
              onPress={() => setResidencyMode(option)}
              className={`rounded-xl border px-4 py-3 ${
                isSelected ? "border-emerald-500 bg-emerald-500/10" : borderClass
              }`}
              style={{ flex: 1 }}
            >
              <Text className={`${isSelected ? "text-emerald-600 font-medium" : textClass} text-center`}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {showOfficialGrid ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {officialRows.map((row) => (
            <View
              key={row.label}
              className={`${inputBgClass} border ${borderClass} rounded-xl p-4`}
              style={{ width: officialRowWidth, minHeight: 88 }}
            >
              <Text className={`${secondaryTextClass} text-xs mb-1`} style={{ lineHeight: 18 }}>
                {row.label}
              </Text>
              <Text className={`${row.highlight ? "text-emerald-500" : textClass} font-medium`} style={{ lineHeight: 22 }}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View className={`overflow-hidden rounded-xl border ${borderClass}`}>
          {officialRows.map((row, index, rows) => (
            <View
              key={row.label}
              className={`px-4 py-3 ${index !== rows.length - 1 ? `border-b ${borderClass}` : ""}`}
            >
              <Text className={`${secondaryTextClass} text-xs mb-1`}>
                {row.label}
              </Text>
              <Text className={`${row.highlight ? "text-emerald-500" : textClass} font-medium`}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Text className={`${secondaryTextClass} text-xs mt-3`} style={{ lineHeight: 18 }}>
        {t("cost.netPriceHint")}
      </Text>
    </View>
  ) : null;

  const estimateInputsSection = (
    <View>
      <View
        style={{
          flexDirection: isTablet ? "row" : "column",
          alignItems: isTablet ? "center" : "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <Text className={`${textClass} text-base font-semibold`}>
          {t("cost.estimateInputs")}
        </Text>
        <View className="rounded-full bg-amber-500/10 px-3 py-1">
          <Text className="text-xs font-medium text-amber-700">
            {t("cost.userEstimate")}
          </Text>
        </View>
      </View>
      <Text className={`${secondaryTextClass} text-sm mb-4`} style={{ lineHeight: 20 }}>
        {t("cost.estimateInputsHint")}
      </Text>

      <View
        style={{
          flexDirection: showInputGrid ? "row" : "column",
          flexWrap: showInputGrid ? "wrap" : "nowrap",
          gap: 16,
        }}
      >
        {renderInputCard({
          label: t("cost.tuitionPerYear"),
          value: tuition,
          onChangeText: (value) => setTuition(value.replace(/\D/g, "")),
          helperText: selectedCollege
            ? officialTuition != null
              ? t("cost.tuitionPrefillHint", { college: selectedCollege.name, type: selectedResidencyLabel })
              : t("cost.noOfficialTuitionHint")
            : undefined,
        })}

        {renderInputCard({
          label: t("cost.feesPerYear"),
          value: fees,
          onChangeText: (value) => setFees(value.replace(/\D/g, "")),
        })}

        {renderInputCard({
          label: t("cost.housingFoodPerYear"),
          value: housingFood,
          onChangeText: (value) => setHousingFood(value.replace(/\D/g, "")),
        })}

        {renderInputCard({
          label: t("cost.booksSuppliesPerYear"),
          value: booksSupplies,
          onChangeText: (value) => setBooksSupplies(value.replace(/\D/g, "")),
        })}

        {renderInputCard({
          label: t("cost.transportationPerYear"),
          value: transportation,
          onChangeText: (value) => setTransportation(value.replace(/\D/g, "")),
        })}

        {renderInputCard({
          label: t("cost.miscellaneousPerYear"),
          value: miscellaneous,
          onChangeText: (value) => setMiscellaneous(value.replace(/\D/g, "")),
        })}

        {renderInputCard({
          label: t("cost.years"),
          value: years,
          onChangeText: (value) => setYears(value.replace(/\D/g, "")),
          placeholder: "4",
        })}

        {renderInputCard({
          label: t("cost.annualIncrease"),
          value: annualIncrease,
          onChangeText: (value) => setAnnualIncrease(value.replace(/[^0-9.]/g, "")),
          keyboardType: "decimal-pad",
        })}

        {renderInputCard({
          label: t("cost.aidPerYear"),
          value: financialAid,
          onChangeText: (value) => setFinancialAid(value.replace(/\D/g, "")),
        })}
      </View>
    </View>
  );

  const resultSummarySection = (
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
      {officialNetPrice != null ? (
        <Text className={`${secondaryTextClass} text-xs mt-1`}>
          {t("compare.netPrice")} ({t("cost.officialSource")}): {format(officialNetPrice)}
        </Text>
      ) : null}
      <Text className={`${secondaryTextClass} text-xs mt-3`} style={{ lineHeight: 18 }}>
        {t("cost.resultNote")}
      </Text>
    </View>
  );

  const breakdownSection = (
    <View className={`${cardBgClass} border rounded-2xl p-4 mt-4`}>
      <Text className={`${secondaryTextClass} text-sm mb-3`}>{t("cost.costBreakdown")}</Text>
      {showYearGrid ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {yearlyRows.map((row) => (
            <View
              key={row.year}
              className={`${inputBgClass} border ${borderClass} rounded-xl p-4`}
              style={{ width: yearlyCardWidth, minHeight: 112 }}
            >
              <Text className={`${textClass} font-medium mb-2`}>
                {t("cost.year")} {row.year}
              </Text>
              <Text className={`${secondaryTextClass} text-xs`} style={{ lineHeight: 18 }}>
                {t("cost.beforeAid")}: {format(row.beforeAid)}
              </Text>
              <Text className={`${secondaryTextClass} text-xs mt-1`} style={{ lineHeight: 18 }}>
                {t("cost.financialAid")}: {format(row.aid)}
              </Text>
              <Text className={`${secondaryTextClass} text-xs mt-1`} style={{ lineHeight: 18 }}>
                {t("cost.netPerYear")}: {format(row.net)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        yearlyRows.map((row) => (
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
        ))
      )}
    </View>
  );

  return (
    <ScreenBackground includeBottomInset={false}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={scrollContentPadding}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            width: "100%",
            maxWidth: pageMaxWidth,
            alignSelf: "center",
            paddingHorizontal: shellHorizontalPadding,
          }}
        >
          <Pressable onPress={back} className="mb-4 flex-row items-center self-start">
            <MaterialIcons name="arrow-back" size={24} color={placeholderColor} />
            <Text className={`${secondaryTextClass} ml-2`}>{t("general.back")}</Text>
          </Pressable>

          <Text className={`text-2xl ${textClass} mb-1`}>
            {t("cost.title")}
          </Text>
          <Text className={`${secondaryTextClass} mb-6`}>
            {t("cost.subtitle")}
          </Text>

          {emptyStateSection}
          {savedCollegeSection}

          <View
            style={{
              flexDirection: showTwoColumnLayout ? "row" : "column",
              alignItems: "flex-start",
              gap: 24,
            }}
          >
            {showTwoColumnLayout ? (
              <View style={{ width: "37%", minWidth: 0 }}>
                {officialDataSection}
                {resultSummarySection}
                {breakdownSection}
              </View>
            ) : null}

            <View style={{ flex: 1, minWidth: 0, width: showTwoColumnLayout ? undefined : "100%" }}>
              {!showTwoColumnLayout ? officialDataSection : null}
              {estimateInputsSection}
              {!showTwoColumnLayout ? (
                <>
                  <View className="mt-4">
                    {resultSummarySection}
                  </View>
                  {breakdownSection}
                </>
              ) : null}
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
