"use client";

import { PropsWithChildren, useEffect, useState } from "react";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "@/locales/en/common.json";
import zhCommon from "@/locales/zh/common.json";

// Initialize i18next only once
let initialized = false;

const initI18n = () => {
  if (initialized) return Promise.resolve();
  
  initialized = true;
  return i18next
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { common: enCommon },
        zh: { common: zhCommon },
      },
      fallbackLng: "zh",
      interpolation: { escapeValue: false },
      react: {
        useSuspense: false, // Disable suspense for faster initial render
      },
    });
};

// Pre-initialize on module load
initI18n();

export default function I18nProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(initialized);

  useEffect(() => {
    if (!ready) {
      initI18n().then(() => setReady(true));
    }
  }, [ready]);

  // Render children immediately since init is synchronous with pre-loaded resources
  return <I18nextProvider i18n={i18next}>{children}</I18nextProvider>;
}
