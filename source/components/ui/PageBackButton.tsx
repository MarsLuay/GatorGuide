import { MaterialIcons } from "@expo/vector-icons";
import { Text, type StyleProp, type ViewStyle } from "react-native";

import { AnimatedIconPressable } from "@/components/ui/AnimatedPressables";
import { useAppTheme } from "@/hooks/use-app-theme";

export const PAGE_BACK_ARROW_COLOR = "#047857";
export const PAGE_BACK_ARROW_COLOR_DARK = "#9ae6b4";

type PageBackButtonProps = {
  label: string;
  onPress: () => void;
  textClassName: string;
  accessibilityLabel?: string;
  containerClassName?: string;
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  isRTL?: boolean;
};

export function usePageBackArrowColor() {
  const { isDark } = useAppTheme();
  return isDark ? PAGE_BACK_ARROW_COLOR_DARK : PAGE_BACK_ARROW_COLOR;
}

export function PageBackButton({
  label,
  onPress,
  textClassName,
  accessibilityLabel,
  containerClassName = "mb-4",
  containerStyle,
  disabled,
  isRTL = false,
}: PageBackButtonProps) {
  const arrowColor = usePageBackArrowColor();

  return (
    <AnimatedIconPressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      containerClassName={containerClassName}
      className="items-center"
      disabled={disabled}
      style={{
        flexDirection: isRTL ? "row-reverse" : "row",
      }}
      containerStyle={[{ alignSelf: isRTL ? "flex-end" : "flex-start" }, containerStyle]}
    >
      <MaterialIcons name={isRTL ? "arrow-forward" : "arrow-back"} size={20} color={arrowColor} />
      <Text className={`${textClassName} ${isRTL ? "mr-2" : "ml-2"}`}>{label}</Text>
    </AnimatedIconPressable>
  );
}
