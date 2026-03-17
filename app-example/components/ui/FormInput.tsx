import { View, Text, TextInput, TextInputProps } from "react-native";

type FormInputProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  error?: string;
  textClass: string;
  secondaryTextClass: string;
  inputBgClass: string;
  placeholderColor: string;
  isEnabled?: boolean;
} & Pick<TextInputProps, "keyboardType" | "autoCapitalize" | "autoCorrect" | "returnKeyType" | "secureTextEntry">;

export function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  textClass,
  secondaryTextClass,
  inputBgClass,
  placeholderColor,
  isEnabled = true,
  ...textInputProps
}: FormInputProps) {
  return (
    <View>
      <Text className={`text-sm ${secondaryTextClass} mb-2`}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        className={`w-full ${inputBgClass} ${textClass} border rounded-lg px-4 py-3`}
        editable={isEnabled}
        {...textInputProps}
      />
      {error ? <Text className="text-xs text-red-400 mt-2">{error}</Text> : null}
    </View>
  );
}
