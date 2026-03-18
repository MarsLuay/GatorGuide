import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

import en from '../constants/locales/en.json';
import es from '../constants/locales/es.json';
import zh from '../constants/locales/zh.json';
import zhHant from '../constants/locales/zh-Hant.json';
import fr from '../constants/locales/fr.json';
import de from '../constants/locales/de.json';
import it from '../constants/locales/it.json';
import ja from '../constants/locales/ja.json';
import ko from '../constants/locales/ko.json';
import pt from '../constants/locales/pt.json';
import ru from '../constants/locales/ru.json';
import ar from '../constants/locales/ar.json';
import hi from '../constants/locales/hi.json';
import vi from '../constants/locales/vi.json';
import tl from '../constants/locales/tl.json';

const STORE_KEY = 'settings.lang';

const resources = {
  en: { translation: en },
  es: { translation: es },
  zh: { translation: zh },
  'zh-Hant': { translation: zhHant },
  fr: { translation: fr },
  de: { translation: de },
  it: { translation: it },
  ja: { translation: ja },
  ko: { translation: ko },
  pt: { translation: pt },
  ru: { translation: ru },
  ar: { translation: ar },
  hi: { translation: hi },
  vi: { translation: vi },
  tl: { translation: tl },
};

const languageDetector: any = {
  type: 'languageDetector',
  async: true,
  detect: async (callback: (lang: string) => void) => {
    try {
      const savedLang = await AsyncStorage.getItem(STORE_KEY);
      if (savedLang) return callback(savedLang);

      const systemLocales = Localization.getLocales();
      if (systemLocales && systemLocales.length > 0) {
        const fullCode = systemLocales[0].languageTag; // 例如 zh-Hant-HK
        const shortCode = systemLocales[0].languageCode; // 例如 zh
        
        if (fullCode && resources.hasOwnProperty(fullCode)) {
          return callback(fullCode);
        }
        return callback(shortCode || 'en');
      }
      callback('en');
    } catch (error) {
      callback('en');
    }
  },
  init: () => {},
  cacheUserLanguage: async (lng: string) => {
    try {
      await AsyncStorage.setItem(STORE_KEY, lng);
    } catch (error) {}
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: {
      useSuspense: false
    }
  });

export default i18n;