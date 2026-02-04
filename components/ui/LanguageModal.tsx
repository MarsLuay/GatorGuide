import React from 'react';
import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '简体中文' },
  { code: 'zh-Hant', label: '繁體中文' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'ko', label: '한국어' },
  { code: 'ja', label: '日本語' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ms', label: 'Bahasa Melayu' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ar', label: 'العربية' },
];

export function LanguageModal({ visible, onClose }: { visible: boolean, onClose: () => void }) {
  const { i18n } = useTranslation();

  const selectLanguage = (code: string) => {
    i18n.changeLanguage(code);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 justify-center items-center bg-black/60 px-6">
        <View className="bg-slate-900 w-full max-w-sm rounded-3xl p-6 border border-slate-800">
          <Text className="text-white text-xl font-bold mb-6 text-center">Select Language</Text>
          <ScrollView style={{ maxHeight: 400 }}>
            <View className="gap-2">
              {LANGUAGES.map((lang) => (
                <Pressable 
                  key={lang.code} 
                  onPress={() => selectLanguage(lang.code)}
                  className={`py-4 rounded-xl ${i18n.language === lang.code ? 'bg-green-500/10 border border-green-500/50' : 'bg-slate-800/50'}`}
                >
                  <Text className={`text-center text-base ${i18n.language === lang.code ? 'text-green-500 font-bold' : 'text-slate-300'}`}>
                    {lang.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <Pressable onPress={onClose} className="mt-6 bg-green-500 py-4 rounded-2xl active:opacity-80">
            <Text className="text-black text-center font-bold text-base">Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}