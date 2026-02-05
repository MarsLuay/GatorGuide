import React from "react";
import { View, Text, TextInput, type TextInputProps } from "react-native";

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
  editable?: boolean; 
} & Partial<Pick<TextInputProps, "keyboardType" | "autoCapitalize" | "autoCorrect" | "returnKeyType" | "secureTextEntry">>;

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
  editable = true, 
  ...textInputProps
}: FormInputProps) {
  return (
    <View className="mb-4">
      <Text className={`text-sm ${secondaryTextClass} mb-2 font-medium`}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
       
        className={`w-full ${inputBgClass} ${textClass} border ${
          error ? 'border-red-400' : 'border-transparent'
        } rounded-lg px-4 py-3 ${!editable ? 'opacity-50' : ''}`}
        editable={editable} 
        {...textInputProps}
      />
      {error && <Text className="text-xs text-red-400 mt-1">{error}</Text>}
    </View>
  );
}