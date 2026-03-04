import { useEffect, useState } from "react";

const STORAGE_KEY = "ls_language";
const DEFAULT_LANG = "en";

export const I18N_TEXT = {
  en: {
    nav: {
      report: "Report",
      feed: "Feed",
      heatmap: "Heatmap",
      analytics: "Analytics",
      safety: "Safety",
      howItWorks: "How It Works",
    },
    reportTemplates: [
      {
        key: "snatching",
        label: "Snatching Template",
        text: "A snatching incident occurred near [landmark] around [time]. Suspect details: [optional]. Immediate help required.",
      },
      {
        key: "harassment",
        label: "Harassment Template",
        text: "Harassment reported at [place] around [time]. The affected person is safe/unsafe: [status]. Requesting immediate intervention.",
      },
      {
        key: "theft",
        label: "Theft Template",
        text: "Theft incident reported at [location]. Item/property affected: [details]. Approx time: [time].",
      },
    ],
  },
  hi: {
    nav: {
      report: "रिपोर्ट",
      feed: "फ़ीड",
      heatmap: "हीटमैप",
      analytics: "एनालिटिक्स",
      safety: "सुरक्षा",
      howItWorks: "कैसे काम करता है",
    },
    reportTemplates: [
      {
        key: "snatching",
        label: "स्नैचिंग टेम्पलेट",
        text: "[स्थान] के पास [समय] पर स्नैचिंग हुई है। संदिग्ध विवरण: [वैकल्पिक]। तुरंत सहायता चाहिए।",
      },
      {
        key: "harassment",
        label: "उत्पीड़न टेम्पलेट",
        text: "[स्थान] पर [समय] के आसपास उत्पीड़न की घटना हुई है। प्रभावित व्यक्ति की स्थिति: [सुरक्षित/असुरक्षित]। तुरंत कार्रवाई करें।",
      },
      {
        key: "theft",
        label: "चोरी टेम्पलेट",
        text: "[स्थान] पर चोरी की घटना हुई है। प्रभावित वस्तु/संपत्ति: [विवरण]। अनुमानित समय: [समय]।",
      },
    ],
  },
};

export function getLanguage() {
  if (typeof window === "undefined") return DEFAULT_LANG;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "hi" ? "hi" : DEFAULT_LANG;
}

export function setLanguage(lang) {
  if (typeof window === "undefined") return;
  const value = lang === "hi" ? "hi" : DEFAULT_LANG;
  window.localStorage.setItem(STORAGE_KEY, value);
  window.dispatchEvent(new CustomEvent("ls-language-change", { detail: value }));
}

export function useLanguage() {
  const [language, setLang] = useState(DEFAULT_LANG);

  useEffect(() => {
    const current = getLanguage();
    setLang(current);
    const onChange = (event) => {
      const value = event?.detail === "hi" ? "hi" : DEFAULT_LANG;
      setLang(value);
    };
    window.addEventListener("ls-language-change", onChange);
    return () => window.removeEventListener("ls-language-change", onChange);
  }, []);

  return {
    language,
    setLanguage,
    t: I18N_TEXT[language] || I18N_TEXT.en,
  };
}

