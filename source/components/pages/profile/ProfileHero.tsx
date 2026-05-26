import { AnimatedIconPressable } from "@/components/ui/AnimatedPressables";
import { MaterialIcons } from "@expo/vector-icons";
import { Image, Text, View } from "react-native";
import type { User } from "@/hooks/use-app-data";
import type { EditableProfileSnapshot } from "@/components/pages/profile/profile-state-utils";

type ProfileHeroProps = {
  avatarFallbackSize: number;
  avatarSize: number;
  capitalizeWords: (text: string | undefined) => string;
  editData: EditableProfileSnapshot;
  handlePickAvatar: () => void;
  isDark: boolean;
  isEditing: boolean;
  isWideLayout: boolean;
  profileContentPadding: number;
  secondaryTextClass: string;
  t: (key: string) => string;
  textClass: string;
  user: User;
};

export function ProfileHero({
  avatarFallbackSize,
  avatarSize,
  capitalizeWords,
  editData,
  handlePickAvatar,
  isDark,
  isEditing,
  isWideLayout,
  profileContentPadding,
  secondaryTextClass,
  t,
  textClass,
  user,
}: ProfileHeroProps) {
  return (
    <View
      className="bg-emerald-500/5 py-5 border-b border-emerald-500/20"
      style={{ paddingHorizontal: profileContentPadding }}
    >
      <View className="flex-row items-center">
        <View className="relative mr-4 pb-1 pr-1">
          <AnimatedIconPressable
            onPress={isEditing ? handlePickAvatar : undefined}
            disabled={!isEditing}
            className="rounded-full overflow-hidden border border-emerald-500/20 bg-emerald-500/10"
            style={{ width: avatarSize, height: avatarSize }}
          >
            {user.avatar ? (
              <Image source={{ uri: user.avatar }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <View className="w-full h-full bg-emerald-500 items-center justify-center">
                {user.isGuest ? (
                  <MaterialIcons name="person" size={avatarFallbackSize} color="#001f0f" />
                ) : (
                  <Text className={`${isDark ? "text-white" : "text-emerald-900"} ${isWideLayout ? "text-2xl" : "text-lg"} font-bold`}>
                    {(user.name?.[0] ?? "").toUpperCase()}
                  </Text>
                )}
              </View>
            )}
          </AnimatedIconPressable>
        </View>

        <View className="flex-1 min-w-0">
          <Text className={`${textClass} ${isWideLayout ? "text-xl" : "text-lg"} font-semibold`} numberOfLines={2}>
            {capitalizeWords(editData.name || user.name || "") || t("general.notSpecified")}
          </Text>

          {user.isGuest ? (
            <View className="mt-2 flex-row flex-wrap items-center gap-2">
              <View className="bg-emerald-500/20 rounded-full px-3 py-1 self-start">
                <Text className="text-emerald-500 text-xs font-semibold">{t("profile.guestMode")}</Text>
              </View>
              <Text className={`${secondaryTextClass} text-xs`}>{t("profile.yourDataSaved")}</Text>
            </View>
          ) : (
            <Text className={`${secondaryTextClass} text-sm mt-1`} numberOfLines={1}>
              {user.email ?? t("profile.yourDataSaved")}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
