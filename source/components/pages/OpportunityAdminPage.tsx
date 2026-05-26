import {
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import {
  AnimatedCardPressable,
  AnimatedChipPressable,
} from "@/components/ui/AnimatedPressables";
import { PageBackButton } from "@/components/ui/PageBackButton";
import {
  OPPORTUNITY_DEADLINE_TYPES,
  OPPORTUNITY_STATUSES,
  type Opportunity,
} from "@/constants/opportunities";
import { ROUTES } from "@/constants/routes";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import useBack from "@/hooks/use-back";
import {
  DEADLINE_TYPE_OPTIONS,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
  formatChoiceLabel,
  toDateInput,
} from "@/components/pages/opportunity-admin/opportunity-admin-draft";
import { useOpportunityAdminController } from "@/components/pages/opportunity-admin/useOpportunityAdminController";

function formatOpportunityMeta(opportunity: Opportunity) {
  return [opportunity.type, opportunity.status, opportunity.source.kind]
    .filter(Boolean)
    .join(" • ");
}

function formatOpportunityDue(opportunity: Opportunity) {
  if (opportunity.deadline.type === OPPORTUNITY_DEADLINE_TYPES.rolling) {
    return "Rolling deadline";
  }
  return toDateInput(opportunity.dueAt) || "No due date";
}

export default function OpportunityAdminPage() {
  const router = useRouter();
  const back = useBack(ROUTES.tabsResources);
  const styles = useThemeStyles();
  const { width } = useWindowDimensions();
  const { getScrollContentPadding } = useResponsiveLayout();
  const {
    access,
    accessError,
    canDeleteSelected,
    draft,
    exportMessage,
    filteredOpportunities,
    handleArchive,
    handleCreateNew,
    handleDelete,
    handleExportScholarships,
    handleSave,
    handleSelectOpportunity,
    isCheckingAccess,
    isExportingScholarships,
    isRefreshing,
    isSaving,
    loadAccess,
    opportunities,
    query,
    refreshOpportunities,
    saveMessage,
    scholarshipExportPreview,
    selectedOpportunity,
    selectedOpportunityId,
    setQuery,
    signedInUser,
    updateDraft,
  } = useOpportunityAdminController();

  const textClass = styles.textClass;
  const secondaryTextClass = styles.secondaryTextClass;
  const cardClass = `${styles.cardBgClass} border rounded-[28px]`;
  const inputClass = `${styles.inputBgClass} border ${styles.borderClass} rounded-2xl px-4 py-3 ${textClass}`;
  const placeholderTextColor = styles.placeholderColor;
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
    extraTop: 20,
  });
  const isDesktop = width >= 1180;
  const isTablet = width >= 768;
  const isPhone = width < 760;
  const pageMaxWidth = isDesktop ? 1360 : isTablet ? 1040 : 720;
  const phoneChipContainerStyle = isPhone ? ({ width: "100%" } as const) : undefined;
  const phoneChipStyle = isPhone
    ? ({
        width: "100%",
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
      } as const)
    : undefined;
  const renderChoiceRow = (
    label: string,
    value: string,
    onChange: (next: string) => void,
    options: readonly string[]
  ) => (
    <View className="gap-2">
      <Text className={`${textClass} font-semibold`}>{label}</Text>
      <View
        style={{
          flexDirection: isPhone ? "column" : "row",
          flexWrap: isPhone ? "nowrap" : "wrap",
          gap: 8,
        }}
      >
        {options.map((option) => {
          const isActive = value === option;
          return (
            <AnimatedChipPressable
              key={option}
              onPress={() => onChange(option)}
              className={`px-3 py-2 rounded-full border ${isActive ? "bg-emerald-500 border-emerald-500" : `${styles.inactiveButtonClass} ${styles.borderClass}`}`}
              containerStyle={phoneChipContainerStyle}
              style={phoneChipStyle}
            >
              <Text className={`${isActive ? "text-white" : textClass} text-sm font-medium`}>
                {formatChoiceLabel(option)}
              </Text>
            </AnimatedChipPressable>
          );
        })}
      </View>
    </View>
  );

  const renderBooleanRow = (
    label: string,
    value: boolean,
    onChange: (next: boolean) => void
  ) => (
    <View className="gap-2">
      <Text className={`${textClass} font-semibold`}>{label}</Text>
      <View
        style={{
          flexDirection: isPhone ? "column" : "row",
          gap: 8,
        }}
      >
        {[true, false].map((option) => {
          const isActive = value === option;
          const optionLabel = option ? "Yes" : "No";
          return (
            <AnimatedChipPressable
              key={optionLabel}
              onPress={() => onChange(option)}
              className={`px-3 py-2 rounded-full border ${isActive ? "bg-emerald-500 border-emerald-500" : `${styles.inactiveButtonClass} ${styles.borderClass}`}`}
              containerStyle={phoneChipContainerStyle}
              style={phoneChipStyle}
            >
              <Text className={`${isActive ? "text-white" : textClass} text-sm font-medium`}>
                {optionLabel}
              </Text>
            </AnimatedChipPressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <ScreenBackground>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: scrollContentPadding.paddingTop,
          paddingBottom: scrollContentPadding.paddingBottom,
          paddingHorizontal: width >= 1280 ? 32 : isTablet ? 24 : 16,
        }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width: "100%", maxWidth: pageMaxWidth, alignSelf: "center" }}>
          <View className="mb-6">
            <PageBackButton onPress={back} label="Back" textClassName={secondaryTextClass} />

            <Text className={`${textClass} text-3xl font-bold`}>Opportunity Admin</Text>
            <Text className={`${secondaryTextClass} mt-2`}>
              Add, edit, archive, and review opportunity records from the app instead of touching source files.
            </Text>
          </View>

          {!signedInUser ? (
            <View className={`${cardClass} p-6`}>
              <Text className={`${textClass} text-lg font-semibold`}>Sign in required</Text>
              <Text className={`${secondaryTextClass} mt-2 leading-6`}>
                This editor is only available to signed-in staff accounts.
              </Text>
              <AnimatedChipPressable
                onPress={() => router.push(ROUTES.profile)}
                containerClassName="mt-4 self-start"
                className="px-4 py-3 rounded-2xl bg-emerald-500"
                containerStyle={phoneChipContainerStyle}
                style={phoneChipStyle}
              >
                <Text className="text-white font-semibold">Open profile</Text>
              </AnimatedChipPressable>
            </View>
          ) : isCheckingAccess ? (
            <View className={`${cardClass} p-6`}>
              <Text className={`${textClass} text-lg font-semibold`}>Checking access...</Text>
              <Text className={`${secondaryTextClass} mt-2 leading-6`}>
                Verifying whether {signedInUser.email} can edit the shared opportunity catalog.
              </Text>
            </View>
          ) : accessError ? (
            <View className={`${cardClass} p-6`}>
              <Text className={`${textClass} text-lg font-semibold`}>
                Could not open the editor
              </Text>
              <Text className={`${secondaryTextClass} mt-2 leading-6`}>
                {accessError}
              </Text>
              <AnimatedChipPressable
                onPress={() => {
                  void loadAccess();
                }}
                containerClassName="mt-4 self-start"
                className="px-4 py-3 rounded-2xl bg-emerald-500"
                containerStyle={phoneChipContainerStyle}
                style={phoneChipStyle}
              >
                <Text className="text-white font-semibold">Retry</Text>
              </AnimatedChipPressable>
            </View>
          ) : !access?.authorized ? (
            <View className={`${cardClass} p-6`}>
              <Text className={`${textClass} text-lg font-semibold`}>
                Staff access not enabled
              </Text>
              <Text className={`${secondaryTextClass} mt-2 leading-6`}>
                {signedInUser.email} is signed in, but this account is not on the Functions allowlist. Add it to
                {" "}
                <Text className={textClass}>OPPORTUNITY_ADMIN_EMAILS</Text>
                {" "}
                or add the UID to
                {" "}
                <Text className={textClass}>OPPORTUNITY_ADMIN_UIDS</Text>
                {" "}
                before using this editor.
              </Text>
            </View>
          ) : (
            <View className="gap-6">
              <View className={`${cardClass} p-5`}>
                <View className={`gap-4 ${isDesktop ? "flex-row items-center justify-between" : ""}`}>
                  <View className="flex-1 min-w-0">
                    <Text className={`${textClass} text-lg font-semibold`}>
                      Editor access active
                    </Text>
                    <Text className={`${secondaryTextClass} mt-2 leading-6`}>
                      Signed in as {access.email ?? signedInUser.email}. Manual saves write to Firebase and appear in the shared catalog after refresh.
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: isPhone ? "column" : "row",
                      flexWrap: isPhone ? "nowrap" : "wrap",
                      gap: 8,
                    }}
                  >
                    <AnimatedChipPressable
                      onPress={handleCreateNew}
                      className={`px-4 py-3 rounded-2xl border ${styles.inactiveButtonClass} ${styles.borderClass}`}
                      containerStyle={phoneChipContainerStyle}
                      style={phoneChipStyle}
                    >
                      <Text className={`${textClass} font-semibold`}>New blank</Text>
                    </AnimatedChipPressable>
                    <AnimatedChipPressable
                      onPress={() => {
                        void refreshOpportunities();
                      }}
                      className="px-4 py-3 rounded-2xl bg-emerald-500"
                      containerStyle={phoneChipContainerStyle}
                      style={phoneChipStyle}
                    >
                      <Text className="text-white font-semibold">
                        {isRefreshing ? "Refreshing..." : "Refresh catalog"}
                      </Text>
                    </AnimatedChipPressable>
                  </View>
                </View>
              </View>

              <View className={`${cardClass} p-5`}>
                <View className={`gap-4 ${isDesktop ? "flex-row items-center justify-between" : ""}`}>
                  <View className="flex-1 min-w-0">
                    <View className="flex-row items-center">
                      <View className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 items-center justify-center mr-3">
                        <MaterialIcons name="table-chart" size={22} color="#008f4e" />
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text className={`${textClass} text-lg font-semibold`}>
                          Scholarship export
                        </Text>
                        <Text className={`${secondaryTextClass} mt-1`}>
                          {scholarshipExportPreview.scholarshipCount} scholarships, including {scholarshipExportPreview.legacyCount} legacy rows
                        </Text>
                      </View>
                    </View>
                    <Text className={`${secondaryTextClass} mt-3 leading-6`}>
                      Exports the requested scholarship tracker columns as an Excel-compatible TSV with separate catalog and legacy sections.
                    </Text>
                    {exportMessage ? (
                      <Text className={`${secondaryTextClass} mt-3`}>
                        {exportMessage}
                      </Text>
                    ) : null}
                  </View>
                  <AnimatedChipPressable
                    onPress={() => {
                      void handleExportScholarships();
                    }}
                    className={`px-4 py-3 rounded-2xl flex-row items-center ${scholarshipExportPreview.scholarshipCount ? "bg-emerald-500" : `${styles.inactiveButtonClass} border ${styles.borderClass}`}`}
                    containerStyle={phoneChipContainerStyle}
                    style={phoneChipStyle}
                    disabled={
                      isExportingScholarships ||
                      scholarshipExportPreview.scholarshipCount === 0
                    }
                  >
                    <MaterialIcons
                      name="file-download"
                      size={18}
                      color={scholarshipExportPreview.scholarshipCount ? "#FFFFFF" : placeholderTextColor}
                    />
                    <Text className={`${scholarshipExportPreview.scholarshipCount ? "text-white" : textClass} font-semibold ml-2`}>
                      {isExportingScholarships ? "Exporting..." : "Export file"}
                    </Text>
                  </AnimatedChipPressable>
                </View>
              </View>

              <View className={`gap-6 ${isDesktop ? "flex-row items-start" : ""}`}>
                <View
                  className={`${cardClass} p-5`}
                  style={isDesktop ? { width: 380, flexShrink: 0 } : undefined}
                >
                  <Text className={`${textClass} text-lg font-semibold`}>Catalog</Text>
                  <Text className={`${secondaryTextClass} mt-2`}>
                    {filteredOpportunities.length} of {opportunities.length} opportunities
                  </Text>

                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search title, source, or status"
                    placeholderTextColor={placeholderTextColor}
                    className={`${inputClass} mt-4`}
                  />

                  <View className="gap-3 mt-4">
                    {filteredOpportunities.map((opportunity) => {
                      const isSelected =
                        opportunity.opportunityId === selectedOpportunityId;
                      return (
                        <AnimatedCardPressable
                          key={opportunity.opportunityId}
                          onPress={() => handleSelectOpportunity(opportunity)}
                          className={`rounded-3xl border p-4 ${isSelected ? "border-emerald-500 bg-emerald-500/10" : `${styles.borderClass} ${styles.inactiveButtonClass}`}`}
                        >
                          <Text className={`${textClass} font-semibold`} numberOfLines={2}>
                            {opportunity.title}
                          </Text>
                          <Text className={`${secondaryTextClass} text-sm mt-2`} numberOfLines={2}>
                            {opportunity.organizationName || opportunity.opportunityId}
                          </Text>
                          <Text className={`${secondaryTextClass} text-xs mt-3`}>
                            {formatOpportunityMeta(opportunity)}
                          </Text>
                          <Text className={`${secondaryTextClass} text-xs mt-1`}>
                            {formatOpportunityDue(opportunity)}
                          </Text>
                        </AnimatedCardPressable>
                      );
                    })}

                    {!filteredOpportunities.length ? (
                      <View className={`rounded-3xl border p-4 ${styles.inactiveButtonClass} ${styles.borderClass}`}>
                        <Text className={`${textClass} font-semibold`}>
                          No opportunities matched
                        </Text>
                        <Text className={`${secondaryTextClass} mt-2`}>
                          Try a broader search or refresh the catalog.
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View className="flex-1 gap-6">
                  <View className={`${cardClass} p-5`}>
                    <Text className={`${textClass} text-lg font-semibold`}>
                      {selectedOpportunityId ? "Edit opportunity" : "Create opportunity"}
                    </Text>
                    <Text className={`${secondaryTextClass} mt-2 leading-6`}>
                      Use comma-separated lists for aid tags, majors, and residency filters. Saving from this tool stores the source as manual.
                    </Text>

                    <View className="gap-6 mt-6">
                      {renderChoiceRow("Type", draft.type, (value) => updateDraft("type", value), TYPE_OPTIONS)}
                      {renderChoiceRow("Catalog status", draft.status, (value) => updateDraft("status", value), STATUS_OPTIONS)}

                      <View className="gap-2">
                        <Text className={`${textClass} font-semibold`}>Opportunity ID</Text>
                        <TextInput
                          value={draft.opportunityId}
                          onChangeText={(value) => updateDraft("opportunityId", value)}
                          placeholder="Leave blank to auto-generate from the title"
                          placeholderTextColor={placeholderTextColor}
                          className={inputClass}
                          autoCapitalize="none"
                        />
                      </View>

                      <View className="gap-2">
                        <Text className={`${textClass} font-semibold`}>Title</Text>
                        <TextInput
                          value={draft.title}
                          onChangeText={(value) => updateDraft("title", value)}
                          placeholder="Opportunity title"
                          placeholderTextColor={placeholderTextColor}
                          className={inputClass}
                        />
                      </View>

                      <View className="gap-2">
                        <Text className={`${textClass} font-semibold`}>Organization</Text>
                        <TextInput
                          value={draft.organizationName}
                          onChangeText={(value) => updateDraft("organizationName", value)}
                          placeholder="Organization name"
                          placeholderTextColor={placeholderTextColor}
                          className={inputClass}
                        />
                      </View>

                      <View className="gap-2">
                        <Text className={`${textClass} font-semibold`}>Summary</Text>
                        <TextInput
                          value={draft.summary}
                          onChangeText={(value) => updateDraft("summary", value)}
                          placeholder="Short student-facing summary"
                          placeholderTextColor={placeholderTextColor}
                          className={`${inputClass} min-h-[120px]`}
                          multiline
                          textAlignVertical="top"
                        />
                      </View>
                    </View>
                  </View>
                  <View className={`${cardClass} p-5`}>
                    <Text className={`${textClass} text-lg font-semibold`}>
                      Links and deadline
                    </Text>
                    <View className="gap-6 mt-6">
                      <View className={`gap-4 ${isTablet ? "flex-row" : ""}`}>
                        <View className="flex-1 gap-2">
                          <Text className={`${textClass} font-semibold`}>External URL</Text>
                          <TextInput
                            value={draft.externalUrl}
                            onChangeText={(value) => updateDraft("externalUrl", value)}
                            placeholder="https://..."
                            placeholderTextColor={placeholderTextColor}
                            className={inputClass}
                            autoCapitalize="none"
                          />
                        </View>
                        <View className="flex-1 gap-2">
                          <Text className={`${textClass} font-semibold`}>Source URL</Text>
                          <TextInput
                            value={draft.sourceUrl}
                            onChangeText={(value) => updateDraft("sourceUrl", value)}
                            placeholder="https://..."
                            placeholderTextColor={placeholderTextColor}
                            className={inputClass}
                            autoCapitalize="none"
                          />
                        </View>
                      </View>

                      <View className="gap-2">
                        <Text className={`${textClass} font-semibold`}>Source label</Text>
                        <TextInput
                          value={draft.sourceLabel}
                          onChangeText={(value) => updateDraft("sourceLabel", value)}
                          placeholder="Example: Awardspring application page"
                          placeholderTextColor={placeholderTextColor}
                          className={inputClass}
                        />
                      </View>

                      {renderChoiceRow(
                        "Deadline type",
                        draft.deadlineType,
                        (value) => updateDraft("deadlineType", value),
                        DEADLINE_TYPE_OPTIONS
                      )}
                      {renderBooleanRow("Yearly recurrence", draft.isYearly, (value) => updateDraft("isYearly", value))}

                      <View className={`gap-4 ${isTablet ? "flex-row" : ""}`}>
                        <View className="flex-1 gap-2">
                          <Text className={`${textClass} font-semibold`}>Due date</Text>
                          <TextInput
                            value={draft.dueDate}
                            onChangeText={(value) => updateDraft("dueDate", value)}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor={placeholderTextColor}
                            className={inputClass}
                            autoCapitalize="none"
                          />
                        </View>
                        <View className="flex-1 gap-2">
                          <Text className={`${textClass} font-semibold`}>Timezone</Text>
                          <TextInput
                            value={draft.timezone}
                            onChangeText={(value) => updateDraft("timezone", value)}
                            placeholder="America/Los_Angeles"
                            placeholderTextColor={placeholderTextColor}
                            className={inputClass}
                            autoCapitalize="none"
                          />
                        </View>
                      </View>

                      <View className="gap-2">
                        <Text className={`${textClass} font-semibold`}>Deadline label</Text>
                        <TextInput
                          value={draft.deadlineLabel}
                          onChangeText={(value) => updateDraft("deadlineLabel", value)}
                          placeholder="Example: Annual scholarship deadline"
                          placeholderTextColor={placeholderTextColor}
                          className={inputClass}
                        />
                      </View>
                    </View>
                  </View>

                  <View className={`${cardClass} p-5`}>
                    <Text className={`${textClass} text-lg font-semibold`}>
                      Matching and requirements
                    </Text>
                    <View className="gap-6 mt-6">
                      <View className="gap-2">
                        <Text className={`${textClass} font-semibold`}>Financial-aid tags</Text>
                        <TextInput
                          value={draft.financialAidTags}
                          onChangeText={(value) => updateDraft("financialAidTags", value)}
                          placeholder="need_based, merit, fafsa_required"
                          placeholderTextColor={placeholderTextColor}
                          className={inputClass}
                        />
                      </View>

                      <View className="gap-2">
                        <Text className={`${textClass} font-semibold`}>Suggested majors</Text>
                        <TextInput
                          value={draft.suggestedMajors}
                          onChangeText={(value) => updateDraft("suggestedMajors", value)}
                          placeholder="computer science, nursing"
                          placeholderTextColor={placeholderTextColor}
                          className={inputClass}
                        />
                      </View>

                      {renderBooleanRow("Has to be a matching major", draft.hasToBeMajor, (value) => updateDraft("hasToBeMajor", value))}
                      {renderBooleanRow("Transfer-only", draft.transferOnly, (value) => updateDraft("transferOnly", value))}

                      <View className={`gap-4 ${isTablet ? "flex-row" : ""}`}>
                        <View className="flex-1 gap-2">
                          <Text className={`${textClass} font-semibold`}>Minimum GPA</Text>
                          <TextInput
                            value={draft.gpaMin}
                            onChangeText={(value) => updateDraft("gpaMin", value)}
                            placeholder="Example: 3.0"
                            placeholderTextColor={placeholderTextColor}
                            className={inputClass}
                            keyboardType="decimal-pad"
                          />
                        </View>
                        <View className="flex-1 gap-2">
                          <Text className={`${textClass} font-semibold`}>Residency types</Text>
                          <TextInput
                            value={draft.residencyTypes}
                            onChangeText={(value) => updateDraft("residencyTypes", value)}
                            placeholder="in state, out of state, international"
                            placeholderTextColor={placeholderTextColor}
                            className={inputClass}
                          />
                        </View>
                      </View>

                      <View className="gap-2">
                        <Text className={`${textClass} font-semibold`}>Community eligibility tags</Text>
                        <TextInput
                          value={draft.communityTags}
                          onChangeText={(value) => updateDraft("communityTags", value)}
                          placeholder="lgbtq"
                          placeholderTextColor={placeholderTextColor}
                          className={inputClass}
                          autoCapitalize="none"
                        />
                      </View>

                      <View className={`gap-4 ${isTablet ? "flex-row" : ""}`}>
                        <View className="flex-1 gap-2">
                          <Text className={`${textClass} font-semibold`}>Minimum recommendations</Text>
                          <TextInput
                            value={draft.recommendationCountMin}
                            onChangeText={(value) => updateDraft("recommendationCountMin", value)}
                            placeholder="0"
                            placeholderTextColor={placeholderTextColor}
                            className={inputClass}
                            keyboardType="number-pad"
                          />
                        </View>
                        <View className="flex-1 gap-2">
                          <Text className={`${textClass} font-semibold`}>Essay count</Text>
                          <TextInput
                            value={draft.essayCount}
                            onChangeText={(value) => updateDraft("essayCount", value)}
                            placeholder="0"
                            placeholderTextColor={placeholderTextColor}
                            className={inputClass}
                            keyboardType="number-pad"
                          />
                        </View>
                      </View>
                    </View>
                  </View>
                  <View className={`${cardClass} p-5`}>
                    <Text className={`${textClass} text-lg font-semibold`}>
                      Award and college metadata
                    </Text>
                    <View className="gap-6 mt-6">
                      <View className={`gap-4 ${isTablet ? "flex-row" : ""}`}>
                        <View className="flex-1 gap-2">
                          <Text className={`${textClass} font-semibold`}>Award minimum</Text>
                          <TextInput
                            value={draft.awardAmountMin}
                            onChangeText={(value) => updateDraft("awardAmountMin", value)}
                            placeholder="Example: 500"
                            placeholderTextColor={placeholderTextColor}
                            className={inputClass}
                            keyboardType="decimal-pad"
                          />
                        </View>
                        <View className="flex-1 gap-2">
                          <Text className={`${textClass} font-semibold`}>Award maximum</Text>
                          <TextInput
                            value={draft.awardAmountMax}
                            onChangeText={(value) => updateDraft("awardAmountMax", value)}
                            placeholder="Example: 5000"
                            placeholderTextColor={placeholderTextColor}
                            className={inputClass}
                            keyboardType="decimal-pad"
                          />
                        </View>
                        <View className="w-full gap-2" style={isTablet ? { maxWidth: 180 } : undefined}>
                          <Text className={`${textClass} font-semibold`}>Currency</Text>
                          <TextInput
                            value={draft.awardCurrency}
                            onChangeText={(value) => updateDraft("awardCurrency", value)}
                            placeholder="USD"
                            placeholderTextColor={placeholderTextColor}
                            className={inputClass}
                            autoCapitalize="characters"
                          />
                        </View>
                      </View>

                      <View className="gap-2">
                        <Text className={`${textClass} font-semibold`}>Award label</Text>
                        <TextInput
                          value={draft.awardAmountText}
                          onChangeText={(value) => updateDraft("awardAmountText", value)}
                          placeholder="Example: Amount varies by scholarship award"
                          placeholderTextColor={placeholderTextColor}
                          className={inputClass}
                        />
                      </View>

                      {renderChoiceRow(
                        "Renewable award",
                        draft.awardRenewable || "unset",
                        (value) =>
                          updateDraft(
                            "awardRenewable",
                            value === "unset" ? "" : (value as "true" | "false")
                          ),
                        ["unset", "true", "false"]
                      )}

                      <View className={`gap-4 ${isTablet ? "flex-row" : ""}`}>
                        <View className="flex-1 gap-2">
                          <Text className={`${textClass} font-semibold`}>College ID</Text>
                          <TextInput
                            value={draft.collegeId}
                            onChangeText={(value) => updateDraft("collegeId", value)}
                            placeholder="Optional scorecard or internal college ID"
                            placeholderTextColor={placeholderTextColor}
                            className={inputClass}
                          />
                        </View>
                        <View className="flex-1 gap-2">
                          <Text className={`${textClass} font-semibold`}>College name</Text>
                          <TextInput
                            value={draft.collegeName}
                            onChangeText={(value) => updateDraft("collegeName", value)}
                            placeholder="Optional college name"
                            placeholderTextColor={placeholderTextColor}
                            className={inputClass}
                          />
                        </View>
                      </View>

                      <View className={`gap-4 ${isTablet ? "flex-row" : ""}`}>
                        <View className="flex-1 gap-2">
                          <Text className={`${textClass} font-semibold`}>City</Text>
                          <TextInput
                            value={draft.collegeCity}
                            onChangeText={(value) => updateDraft("collegeCity", value)}
                            placeholder="Optional city"
                            placeholderTextColor={placeholderTextColor}
                            className={inputClass}
                          />
                        </View>
                        <View className="flex-1 gap-2">
                          <Text className={`${textClass} font-semibold`}>State</Text>
                          <TextInput
                            value={draft.collegeState}
                            onChangeText={(value) => updateDraft("collegeState", value)}
                            placeholder="Optional state"
                            placeholderTextColor={placeholderTextColor}
                            className={inputClass}
                          />
                        </View>
                      </View>

                      <View className="gap-2">
                        <Text className={`${textClass} font-semibold`}>College website</Text>
                        <TextInput
                          value={draft.collegeWebsite}
                          onChangeText={(value) => updateDraft("collegeWebsite", value)}
                          placeholder="https://..."
                          placeholderTextColor={placeholderTextColor}
                          className={inputClass}
                          autoCapitalize="none"
                        />
                      </View>
                    </View>
                  </View>

                  <View className={`${cardClass} p-5`}>
                    <View className={`gap-3 ${isTablet ? "flex-row items-center justify-between" : ""}`}>
                      <View className="flex-1 min-w-0">
                        <Text className={`${textClass} text-lg font-semibold`}>
                          Save actions
                        </Text>
                        <Text className={`${secondaryTextClass} mt-2 leading-6`}>
                          Save writes to Firebase immediately, then refreshes the shared catalog on this device.
                        </Text>
                        {saveMessage ? (
                          <Text className={`${secondaryTextClass} mt-3`}>
                            {saveMessage}
                          </Text>
                        ) : null}
                      </View>
                      <View
                        style={{
                          flexDirection: isPhone ? "column" : "row",
                          flexWrap: isPhone ? "nowrap" : "wrap",
                          gap: 8,
                        }}
                      >
                        <AnimatedChipPressable
                          onPress={() => {
                            void handleSave();
                          }}
                          className="px-4 py-3 rounded-2xl bg-emerald-500"
                          containerStyle={phoneChipContainerStyle}
                          style={phoneChipStyle}
                          disabled={isSaving}
                        >
                          <Text className="text-white font-semibold">
                            {isSaving ? "Saving..." : selectedOpportunityId ? "Save changes" : "Create opportunity"}
                          </Text>
                        </AnimatedChipPressable>
                        {selectedOpportunityId ? (
                          <AnimatedChipPressable
                            onPress={() => {
                              void handleArchive(draft.status !== OPPORTUNITY_STATUSES.archived);
                            }}
                            className={`px-4 py-3 rounded-2xl border ${styles.inactiveButtonClass} ${styles.borderClass}`}
                            containerStyle={phoneChipContainerStyle}
                            style={phoneChipStyle}
                            disabled={isSaving}
                          >
                            <Text className={`${textClass} font-semibold`}>
                              {draft.status === OPPORTUNITY_STATUSES.archived ? "Restore" : "Archive"}
                            </Text>
                          </AnimatedChipPressable>
                        ) : null}
                        {canDeleteSelected ? (
                          <AnimatedChipPressable
                            onPress={() => {
                              void handleDelete();
                            }}
                            className="px-4 py-3 rounded-2xl border border-red-500/40 bg-red-500/10"
                            containerStyle={phoneChipContainerStyle}
                            style={phoneChipStyle}
                            disabled={isSaving}
                          >
                            <Text className="text-red-500 font-semibold">Delete</Text>
                          </AnimatedChipPressable>
                        ) : null}
                      </View>
                    </View>

                    {selectedOpportunity && !canDeleteSelected ? (
                      <Text className={`${secondaryTextClass} mt-4 text-sm leading-6`}>
                        Starter and seeded records can be archived here, but true delete is limited to manual-only entries so base catalog items do not unexpectedly reappear.
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
