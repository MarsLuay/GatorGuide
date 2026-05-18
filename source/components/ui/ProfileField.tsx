import { useEffect, useState } from "react";
import {
  Platform,
  View,
  Text,
  TextInput,
  TextInputProps,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAppLanguage } from "@/hooks/use-app-language";
import {
  AnimatedCardPressable,
  AnimatedChipPressable,
  AnimatedIconPressable,
} from "@/components/ui/AnimatedPressables";
import {
  SearchableSelect,
  type SearchableSelectOption,
  type SelectorOverlayStrategy,
} from "@/components/ui/SearchableSelect";

type BaseFieldProps = {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string | undefined;
  isEditing: boolean;
  responsiveSectionSpacing?: boolean;
  textClass: string;
  secondaryTextClass: string;
  borderClass: string;
  emptyText?: string;
  noTopSpacing?: boolean;
  noDivider?: boolean;
};

type TextFieldProps = BaseFieldProps & {
  type: "text" | "textarea";
  editValue: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  placeholderColor: string;
  inputBgClass: string;
  inputClass: string;
  keyboardType?: TextInputProps["keyboardType"];
};

type UploadFieldProps = BaseFieldProps & {
  type: "upload";
  editValue: string;
  onPress: () => void;
  inputBgClass: string;
  uploadText?: string;
};

type DisplayOnlyFieldProps = BaseFieldProps & {
  type: "display";
};

type LinkFieldProps = BaseFieldProps & {
  type: "link";
  onPress: () => void;
  linkText?: string;
};

type RadioFieldProps = BaseFieldProps & {
  type: "radio";
  options: { key: string; labelKey: string }[];
  editValue: string;
  onSelect: (key: string) => void;
};

type SelectFieldProps = BaseFieldProps & {
  type: "select";
  editValue: string;
  displayEditValue?: string;
  selectedOptionId?: string | null;
  options: SearchableSelectOption[];
  onSelect: (id: string) => void;
  selectOpen?: boolean;
  onSelectOpenChange?: (open: boolean) => void;
  searchPlaceholder?: string;
  placeholderColor: string;
  dropdownBackgroundColor: string;
  overlayStrategy?: SelectorOverlayStrategy;
};

type ProfileFieldProps =
  | TextFieldProps
  | UploadFieldProps
  | DisplayOnlyFieldProps
  | LinkFieldProps
  | RadioFieldProps
  | SelectFieldProps;

export function getResponsiveFieldControlSpacingStyle({
  responsiveSectionSpacing,
  viewportWidth,
  viewportHeight,
}: {
  responsiveSectionSpacing?: boolean;
  viewportWidth: number;
  viewportHeight: number;
}): ViewStyle | undefined {
  const shouldUseResponsiveSectionSpacing =
    responsiveSectionSpacing && Platform.OS === "web" && viewportWidth >= 1080;

  if (!shouldUseResponsiveSectionSpacing) return undefined;

  const widthDrivenPaddingTop = Math.round(Math.min(28, Math.max(10, viewportWidth * 0.012)));
  const verticalRoomScale = Math.min(1, Math.max(0.55, (viewportHeight - 640) / 320));

  return {
    paddingTop: Math.max(8, Math.round(widthDrivenPaddingTop * verticalRoomScale)),
  };
}

export function ProfileField(props: ProfileFieldProps) {
  const { t } = useAppLanguage();
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();

  const {
    icon,
    label,
    value,
    isEditing,
    textClass,
    secondaryTextClass,
    borderClass,
    emptyText,
  } = props;

  const resolvedEmptyText = emptyText ?? t("general.notSpecified");
  const resolvedSelectValue =
    props.type === "select" ? props.displayEditValue ?? props.editValue : "";
  const radioChipMinWidth =
    props.type === "radio"
      ? props.options.length >= 4
        ? 132
        : props.options.length === 3
          ? 152
          : 180
      : 0;
  const selectOnOpenChange = props.type === "select" ? props.onSelectOpenChange : undefined;
  const isControlledSelect =
    props.type === "select" &&
    typeof props.selectOpen === "boolean" &&
    typeof selectOnOpenChange === "function";
  const resolvedIsSelectOpen =
    props.type === "select"
      ? isControlledSelect
        ? Boolean(props.selectOpen)
        : isSelectOpen
      : false;
  const setResolvedSelectOpen = (nextOpen: boolean) => {
    if (props.type !== "select") return;

    if (isControlledSelect) {
      props.onSelectOpenChange?.(nextOpen);
      return;
    }

    setIsSelectOpen(nextOpen);
  };

  const wrapperClass = [
    props.noDivider ? "" : `border-t ${borderClass}`,
    props.noTopSpacing ? "" : "pt-4 mt-4",
  ]
    .filter(Boolean)
    .join(" ");
  const responsiveControlSpacingStyle = getResponsiveFieldControlSpacingStyle({
    responsiveSectionSpacing: props.responsiveSectionSpacing,
    viewportWidth,
    viewportHeight,
  });

  useEffect(() => {
    if (!isEditing && resolvedIsSelectOpen) {
      if (isControlledSelect) {
        selectOnOpenChange?.(false);
      } else {
        setIsSelectOpen(false);
      }
    }
  }, [isControlledSelect, isEditing, resolvedIsSelectOpen, selectOnOpenChange]);

  const fieldContent =
    props.type === "link" ? (
      <AnimatedIconPressable onPress={props.onPress} containerClassName="self-start">
        <Text className="text-emerald-500 underline">
          {props.linkText || value || resolvedEmptyText}
        </Text>
      </AnimatedIconPressable>
    ) : props.type === "radio" ? (
      <>
        {!isEditing ? (
          <Text className={textClass}>
            {value
              ? t(props.options.find((o) => o.key === value)?.labelKey ?? value)
              : resolvedEmptyText}
          </Text>
        ) : (
          <View className="flex-row flex-wrap gap-2" style={{ width: "100%" }}>
            {props.options.map((opt) => {
              const isSelected = props.editValue === opt.key;
              return (
                <AnimatedChipPressable
                  key={opt.key}
                  onPress={() => props.onSelect(opt.key)}
                  containerStyle={{
                    flexGrow: 1,
                    flexBasis: radioChipMinWidth,
                    minWidth: radioChipMinWidth,
                  }}
                  className={`px-4 py-2 rounded-lg border ${
                    isSelected ? "bg-emerald-500/10 border-emerald-500" : `border ${borderClass}`
                  }`}
                  style={{
                    width: "100%",
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    className={
                      isSelected ? "text-emerald-500 font-semibold" : secondaryTextClass
                    }
                    style={{ textAlign: "center" }}
                  >
                    {t(opt.labelKey)}
                  </Text>
                </AnimatedChipPressable>
              );
            })}
          </View>
        )}
      </>
    ) : !isEditing || props.type === "display" ? (
      <Text className={textClass} numberOfLines={props.type === "upload" ? 2 : undefined}>
        {value || resolvedEmptyText}
      </Text>
    ) : props.type === "select" ? (
      <View
        style={{
          width: "100%",
          ...(resolvedIsSelectOpen
            ? {
                position: "relative",
                overflow: "visible",
                zIndex: 130,
                elevation: 130,
              }
            : {
                position: "relative",
                overflow: "visible",
              }),
        }}
      >
        <SearchableSelect
          value={resolvedSelectValue}
          open={resolvedIsSelectOpen}
          onToggle={() => setResolvedSelectOpen(!resolvedIsSelectOpen)}
          onDismiss={() => setResolvedSelectOpen(false)}
          options={props.options}
          onSelect={(id) => {
            setResolvedSelectOpen(false);
            props.onSelect(id);
          }}
          selectedOptionId={props.selectedOptionId}
          searchable
          searchPlaceholder={props.searchPlaceholder}
          textClass={textClass}
          secondaryTextClass={secondaryTextClass}
          borderClass={borderClass}
          dropdownBackgroundColor={props.dropdownBackgroundColor}
          placeholderTextColor={props.placeholderColor}
          overlayStrategy={props.overlayStrategy}
        />
      </View>
    ) : props.type === "text" || props.type === "textarea" ? (
      <TextInput
        value={props.editValue}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={props.placeholderColor}
        keyboardType={props.keyboardType}
        multiline={props.type === "textarea"}
        textAlignVertical={props.type === "textarea" ? "top" : undefined}
        className={props.inputClass}
      />
    ) : props.type === "upload" ? (
      <AnimatedCardPressable
        onPress={props.onPress}
        className={`${props.inputBgClass} border rounded-lg px-3 py-3 flex-row items-center justify-between`}
      >
        <Text className={`${textClass} text-sm flex-1 mr-3`} numberOfLines={2}>
          {props.editValue || props.uploadText || t("general.uploadFile")}
        </Text>
        <MaterialIcons name="upload" size={18} color="#008f4e" />
      </AnimatedCardPressable>
    ) : null;

  return (
    <View className={wrapperClass}>
      <View className="flex-row items-start min-w-0">
        <MaterialIcons name={icon} size={20} color="#008f4e" />
        <View className="flex-1 ml-3 min-w-0">
          <Text className={`text-sm ${secondaryTextClass} mb-1`}>{label}</Text>
          <View className="min-w-0" style={responsiveControlSpacingStyle}>
            {fieldContent}
          </View>
        </View>
      </View>
    </View>
  );
}
