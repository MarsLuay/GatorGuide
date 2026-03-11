import { View, Text, TextInput, Pressable, TextInputProps } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAppLanguage } from "@/hooks/use-app-language";

type BaseFieldProps = {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string | undefined;
  isEditing: boolean;
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
  options: Array<{ key: string; labelKey: string }>;
  editValue: string;
  onSelect: (key: string) => void;
};

type ProfileFieldProps =
  | TextFieldProps
  | UploadFieldProps
  | DisplayOnlyFieldProps
  | LinkFieldProps
  | RadioFieldProps;

export function ProfileField(props: ProfileFieldProps) {
  const { t } = useAppLanguage();

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

  const wrapperClass = [
    props.noDivider ? "" : `border-t ${borderClass}`,
    props.noTopSpacing ? "" : "pt-4 mt-4",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <View className={wrapperClass}>
      <View className="flex-row items-start">
        <MaterialIcons name={icon} size={20} color="#008f4e" />
        <View className="flex-1 ml-3">
          <Text className={`text-sm ${secondaryTextClass} mb-1`}>{label}</Text>

          {props.type === "link" ? (
            <Pressable onPress={props.onPress}>
              <Text className="text-emerald-500 underline">
                {props.linkText || value || resolvedEmptyText}
              </Text>
            </Pressable>
          ) : props.type === "radio" ? (
            <>
              {!isEditing ? (
                <Text className={textClass}>
                  {value
                    ? t(props.options.find((o) => o.key === value)?.labelKey ?? value)
                    : resolvedEmptyText}
                </Text>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  {props.options.map((opt) => {
                    const isSelected = props.editValue === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        onPress={() => props.onSelect(opt.key)}
                        className={`px-4 py-2 rounded-lg border ${
                          isSelected ? "bg-emerald-500/10 border-emerald-500" : `border ${borderClass}`
                        }`}
                      >
                        <Text
                          className={
                            isSelected ? "text-emerald-500 font-semibold" : secondaryTextClass
                          }
                        >
                          {t(opt.labelKey)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </>
          ) : !isEditing || props.type === "display" ? (
            <Text className={textClass}>{value || resolvedEmptyText}</Text>
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
            <Pressable
              onPress={props.onPress}
              className={`${props.inputBgClass} border rounded-lg px-3 py-3 flex-row items-center justify-between`}
            >
              <Text className={`${textClass} text-sm`}>
                {props.editValue || props.uploadText || t("general.uploadFile")}
              </Text>
              <MaterialIcons name="upload" size={18} color="#008f4e" />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
