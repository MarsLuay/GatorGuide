import { AnimatedCardPressable } from "@/components/ui/AnimatedPressables";
import { ProfileField } from "@/components/ui/ProfileField";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { Dispatch, SetStateAction } from "react";
import { Text, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import type { User } from "@/hooks/use-app-data";
import type { SearchableSelectOption } from "@/components/ui/SearchableSelect";
import {
  formatProfileStateDisplayValue,
  resolveProfileStateName,
  type EditableProfileSnapshot,
} from "@/components/pages/profile/profile-state-utils";

type ProfileFieldsPanelProps = {
  borderClass: string;
  capitalizeWords: (text: string | undefined) => string;
  dropdownSurfaceColor: string;
  editData: EditableProfileSnapshot;
  formatMajorDisplayValue: (value: string | undefined) => string;
  greenRiverMajorOptions: SearchableSelectOption[];
  guestCtaBodyClass: string;
  guestCtaCardClass: string;
  guestCtaCardStyle: StyleProp<ViewStyle>;
  guestCtaIconColor: string;
  guestCtaTextClass: string;
  handleCreateAccount: () => void;
  handleGpaChange: (value: string) => void;
  inputBgClass: string;
  inputClass: string;
  isEditing: boolean;
  isMajorDropdownOpen: boolean;
  isStateDropdownOpen: boolean;
  isWideLayout: boolean;
  majorFieldOverlayStyle: StyleProp<ViewStyle>;
  placeholderColor: string;
  profileStateOptions: SearchableSelectOption[];
  resolveGreenRiverMajorId: (value: string | undefined) => string | null;
  responsiveSectionSpacing?: boolean;
  secondaryTextClass: string;
  setEditData: Dispatch<SetStateAction<EditableProfileSnapshot>>;
  setIsMajorDropdownOpen: (open: boolean) => void;
  setIsStateDropdownOpen: (open: boolean) => void;
  stateFieldOverlayStyle: StyleProp<ViewStyle>;
  t: (key: string) => string;
  textClass: string;
  user: User;
};

export function ProfileFieldsPanel({
  borderClass,
  capitalizeWords,
  dropdownSurfaceColor,
  editData,
  formatMajorDisplayValue,
  greenRiverMajorOptions,
  guestCtaBodyClass,
  guestCtaCardClass,
  guestCtaCardStyle,
  guestCtaIconColor,
  guestCtaTextClass,
  handleCreateAccount,
  handleGpaChange,
  inputBgClass,
  inputClass,
  isEditing,
  isMajorDropdownOpen,
  isStateDropdownOpen: _isStateDropdownOpen,
  isWideLayout,
  majorFieldOverlayStyle,
  placeholderColor,
  profileStateOptions,
  resolveGreenRiverMajorId,
  responsiveSectionSpacing,
  secondaryTextClass,
  setEditData,
  setIsMajorDropdownOpen,
  setIsStateDropdownOpen,
  stateFieldOverlayStyle,
  t,
  textClass,
  user,
}: ProfileFieldsPanelProps) {
  return (
    <>
      {!user.isGuest ? (
        <ProfileField
          responsiveSectionSpacing={responsiveSectionSpacing}
          noDivider
          noTopSpacing
          type="text"
          icon="person"
          label={t("profile.name")}
          value={capitalizeWords(user.name ?? "")}
          isEditing={isEditing}
          editValue={editData.name}
          onChangeText={(value) => setEditData((prev) => ({ ...prev, name: value }))}
          placeholder={t("profile.enterYourName")}
          placeholderColor={placeholderColor}
          inputBgClass={inputBgClass}
          inputClass={inputClass}
          textClass={textClass}
          secondaryTextClass={secondaryTextClass}
          borderClass={borderClass}
        />
      ) : null}

      {user.isGuest ? (
        <AnimatedCardPressable
          onPress={handleCreateAccount}
          className={`${guestCtaCardClass} rounded-xl p-5 mb-4`}
          style={[
            guestCtaCardStyle,
            {
              flexDirection: isWideLayout ? "row" : "column",
              alignItems: isWideLayout ? "center" : "stretch",
              justifyContent: "space-between",
              gap: 12,
            },
          ]}
        >
          <View style={{ flex: isWideLayout ? 1 : undefined, paddingRight: isWideLayout ? 12 : 0 }}>
            <View className="flex-row items-center mb-2">
              <MaterialIcons name="stars" size={20} color={guestCtaIconColor} />
              <Text className={`${guestCtaTextClass} font-bold text-base ml-2`}>{t("profile.createAccount")}</Text>
            </View>
            <Text className={`${guestCtaBodyClass} text-sm`}>{t("profile.saveDataMessage")}</Text>
          </View>
          <MaterialIcons
            name="arrow-forward"
            size={24}
            color={guestCtaIconColor}
            style={isWideLayout ? undefined : { alignSelf: "flex-end" }}
          />
        </AnimatedCardPressable>
      ) : (
        <ProfileField
          responsiveSectionSpacing={responsiveSectionSpacing}
          type="display"
          icon="mail"
          label={t("profile.email")}
          value={user.email ?? ""}
          isEditing={false}
          textClass={textClass}
          secondaryTextClass={secondaryTextClass}
          borderClass={borderClass}
        />
      )}

      <View style={majorFieldOverlayStyle}>
        <ProfileField
          responsiveSectionSpacing={responsiveSectionSpacing}
          type="select"
          icon="school"
          label={t("profile.major")}
          value={formatMajorDisplayValue(user.major) || t("profile.undecided")}
          isEditing={isEditing}
          editValue={editData.major}
          displayEditValue={formatMajorDisplayValue(editData.major)}
          selectedOptionId={resolveGreenRiverMajorId(editData.major)}
          options={greenRiverMajorOptions}
          onSelect={(value) => setEditData((prev) => ({ ...prev, major: value }))}
          selectOpen={isMajorDropdownOpen}
          onSelectOpenChange={(open) => {
            setIsMajorDropdownOpen(open);
            if (open) setIsStateDropdownOpen(false);
          }}
          searchPlaceholder={t("profile.majorSearchPlaceholder")}
          placeholderColor={placeholderColor}
          dropdownBackgroundColor={dropdownSurfaceColor}
          overlayStrategy="inline-isolated"
          textClass={textClass}
          secondaryTextClass={secondaryTextClass}
          borderClass={borderClass}
        />
      </View>

      <View style={stateFieldOverlayStyle}>
        <ProfileField
          responsiveSectionSpacing={responsiveSectionSpacing}
          type="select"
          icon="place"
          label={t("profile.state")}
          value={formatProfileStateDisplayValue(user.state)}
          isEditing={isEditing}
          editValue={editData.state}
          displayEditValue={formatProfileStateDisplayValue(editData.state)}
          selectedOptionId={resolveProfileStateName(editData.state)}
          options={profileStateOptions}
          onSelect={(value) => setEditData((prev) => ({ ...prev, state: value }))}
          selectOpen={_isStateDropdownOpen}
          onSelectOpenChange={(open) => {
            setIsStateDropdownOpen(open);
            if (open) setIsMajorDropdownOpen(false);
          }}
          searchPlaceholder={t("profile.stateSearchPlaceholder")}
          placeholderColor={placeholderColor}
          dropdownBackgroundColor={dropdownSurfaceColor}
          overlayStrategy="inline-isolated"
          textClass={textClass}
          secondaryTextClass={secondaryTextClass}
          borderClass={borderClass}
        />
      </View>

      <ProfileField
        responsiveSectionSpacing={responsiveSectionSpacing}
        type="radio"
        icon="wc"
        label={t("profile.gender")}
        value={user.gender}
        isEditing={isEditing}
        editValue={editData.gender}
        options={[
          { key: "woman", labelKey: "profile.genderWoman" },
          { key: "man", labelKey: "profile.genderMan" },
          { key: "nonbinary", labelKey: "profile.genderNonbinary" },
          { key: "preferNotToSay", labelKey: "profile.genderPreferNotToSay" },
        ]}
        onSelect={(key) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setEditData((prev) => ({ ...prev, gender: key }));
        }}
        textClass={textClass}
        secondaryTextClass={secondaryTextClass}
        borderClass={borderClass}
      />

      <ProfileField
        responsiveSectionSpacing={responsiveSectionSpacing}
        type="radio"
        icon="home"
        label={t("profile.residencyType")}
        value={user.residencyType}
        isEditing={isEditing}
        editValue={editData.residencyType}
        options={[
          { key: "inState", labelKey: "profile.residencyInState" },
          { key: "outOfState", labelKey: "profile.residencyOutOfState" },
          { key: "international", labelKey: "profile.residencyInternational" },
        ]}
        onSelect={(key) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setEditData((prev) => ({ ...prev, residencyType: key }));
        }}
        textClass={textClass}
        secondaryTextClass={secondaryTextClass}
        borderClass={borderClass}
      />

      <ProfileField
        responsiveSectionSpacing={responsiveSectionSpacing}
        type="text"
        icon="description"
        label={t("profile.gpa")}
        value={user.gpa ?? ""}
        isEditing={isEditing}
        editValue={editData.gpa}
        onChangeText={handleGpaChange}
        placeholder={t("profile.gpaPlaceholder")}
        placeholderColor={placeholderColor}
        inputBgClass={inputBgClass}
        inputClass={inputClass}
        keyboardType={"decimal-pad" as TextInputProps["keyboardType"]}
        textClass={textClass}
        secondaryTextClass={secondaryTextClass}
        borderClass={borderClass}
      />
    </>
  );
}
