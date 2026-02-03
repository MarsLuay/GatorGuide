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

type ProfileFieldProps = TextFieldProps | UploadFieldProps | DisplayOnlyFieldProps | LinkFieldProps;

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

  return (
    <View className={`border-t ${borderClass} pt-4 mt-4`}>
      <View className="flex-row items-start">
        <MaterialIcons name={icon} size={20} color="#22C55E" />
        <View className="flex-1 ml-3">
          <Text className={`text-sm ${secondaryTextClass} mb-1`}>{label}</Text>

          {props.type === "link" ? (
            <Pressable onPress={props.onPress}>
              <Text className="text-green-500 underline">
                {props.linkText || value || resolvedEmptyText}
              </Text>
            </Pressable>
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
              <MaterialIcons name="upload" size={18} color="#22C55E" />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
