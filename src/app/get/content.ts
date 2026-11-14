import { LANGUAGE_LABELS, UI_LANGUAGES } from '@immerse/i18n';

// Copy for /get, the "share the app" page. Kept here rather than in
// @immerse/i18n because it is a handful of web-only strings; the page offers
// exactly the app's interface languages so the menu matches the app's own.

export interface GetContent {
  metaTitle: string;
  metaDescription: string;
  tagline: string;
  availability: string;
  appStoreSmall: string;
  playSmall: string;
  or: string;
  readInBrowser: string;
  copyLink: string;
  copied: string;
  home: string;
  language: string;
}

const en: GetContent = {
  metaTitle: 'Get Immerse Research',
  metaDescription: 'Sacred texts from all traditions. Free on iPhone and Android.',
  tagline: 'Sacred texts from all traditions.',
  availability: 'Free on iPhone and Android.',
  appStoreSmall: 'Download on the',
  playSmall: 'GET IT ON',
  or: 'or',
  readInBrowser: 'read in your browser',
  copyLink: 'Copy link to share',
  copied: 'Link copied',
  home: 'Go to immerseresearch.app',
  language: 'Language',
};

export const getContent: Record<string, GetContent> = {
  en,
  es: {
    metaTitle: 'Descarga Immerse Research',
    metaDescription: 'Textos sagrados de todas las tradiciones. Gratis en iPhone y Android.',
    tagline: 'Textos sagrados de todas las tradiciones.',
    availability: 'Gratis en iPhone y Android.',
    appStoreSmall: 'Descárgalo en el',
    playSmall: 'DISPONIBLE EN',
    or: 'o',
    readInBrowser: 'lee en tu navegador',
    copyLink: 'Copiar enlace para compartir',
    copied: 'Enlace copiado',
    home: 'Ir a immerseresearch.app',
    language: 'Idioma',
  },
  de: {
    metaTitle: 'Immerse Research herunterladen',
    metaDescription: 'Heilige Texte aller Traditionen. Kostenlos für iPhone und Android.',
    tagline: 'Heilige Texte aller Traditionen.',
    availability: 'Kostenlos für iPhone und Android.',
    appStoreSmall: 'Laden im',
    playSmall: 'JETZT BEI',
    or: 'oder',
    readInBrowser: 'im Browser lesen',
    copyLink: 'Link zum Teilen kopieren',
    copied: 'Link kopiert',
    home: 'Zu immerseresearch.app',
    language: 'Sprache',
  },
  fr: {
    metaTitle: 'Télécharger Immerse Research',
    metaDescription: 'Textes sacrés de toutes les traditions. Gratuit sur iPhone et Android.',
    tagline: 'Textes sacrés de toutes les traditions.',
    availability: 'Gratuit sur iPhone et Android.',
    appStoreSmall: 'Télécharger dans l’',
    playSmall: 'DISPONIBLE SUR',
    or: 'ou',
    readInBrowser: 'lire dans votre navigateur',
    copyLink: 'Copier le lien à partager',
    copied: 'Lien copié',
    home: 'Aller sur immerseresearch.app',
    language: 'Langue',
  },
  ru: {
    metaTitle: 'Скачать Immerse Research',
    metaDescription: 'Священные тексты всех традиций. Бесплатно для iPhone и Android.',
    tagline: 'Священные тексты всех традиций.',
    availability: 'Бесплатно для iPhone и Android.',
    appStoreSmall: 'Загрузите в',
    playSmall: 'ДОСТУПНО В',
    or: 'или',
    readInBrowser: 'читайте в браузере',
    copyLink: 'Скопировать ссылку',
    copied: 'Ссылка скопирована',
    home: 'Перейти на immerseresearch.app',
    language: 'Язык',
  },
  zh: {
    metaTitle: '下载 Immerse Research',
    metaDescription: '汇集各大传统的神圣经典。iPhone 和 Android 免费使用。',
    tagline: '汇集各大传统的神圣经典。',
    availability: 'iPhone 和 Android 免费使用。',
    appStoreSmall: '下载于',
    playSmall: '下载应用，请到',
    or: '或',
    readInBrowser: '在浏览器中阅读',
    copyLink: '复制链接以分享',
    copied: '链接已复制',
    home: '前往 immerseresearch.app',
    language: '语言',
  },
  tr: {
    metaTitle: 'Immerse Research’i edinin',
    metaDescription: 'Tüm geleneklerden kutsal metinler. iPhone ve Android’de ücretsiz.',
    tagline: 'Tüm geleneklerden kutsal metinler.',
    availability: 'iPhone ve Android’de ücretsiz.',
    appStoreSmall: 'Hemen indirin',
    playSmall: 'BURADAN EDİNİN',
    or: 'veya',
    readInBrowser: 'tarayıcınızda okuyun',
    copyLink: 'Paylaşmak için bağlantıyı kopyala',
    copied: 'Bağlantı kopyalandı',
    home: 'immerseresearch.app’e git',
    language: 'Dil',
  },
  fa: {
    metaTitle: 'دریافت Immerse Research',
    metaDescription: 'متون مقدس همهٔ سنت‌ها. رایگان برای آیفون و اندروید.',
    tagline: 'متون مقدس همهٔ سنت‌ها.',
    availability: 'رایگان برای آیفون و اندروید.',
    appStoreSmall: 'دریافت از',
    playSmall: 'دریافت از',
    or: 'یا',
    readInBrowser: 'در مرورگر بخوانید',
    copyLink: 'کپی پیوند برای اشتراک‌گذاری',
    copied: 'پیوند کپی شد',
    home: 'رفتن به immerseresearch.app',
    language: 'زبان',
  },
  ar: {
    metaTitle: 'احصل على Immerse Research',
    metaDescription: 'نصوص مقدسة من جميع التقاليد. مجانًا على iPhone وAndroid.',
    tagline: 'نصوص مقدسة من جميع التقاليد.',
    availability: 'مجانًا على iPhone وAndroid.',
    appStoreSmall: 'حمّله من',
    playSmall: 'احصل عليه من',
    or: 'أو',
    readInBrowser: 'اقرأ في متصفحك',
    copyLink: 'انسخ الرابط للمشاركة',
    copied: 'تم نسخ الرابط',
    home: 'الانتقال إلى immerseresearch.app',
    language: 'اللغة',
  },
  pt: {
    metaTitle: 'Baixe o Immerse Research',
    metaDescription: 'Textos sagrados de todas as tradições. Grátis para iPhone e Android.',
    tagline: 'Textos sagrados de todas as tradições.',
    availability: 'Grátis para iPhone e Android.',
    appStoreSmall: 'Baixar na',
    playSmall: 'DISPONÍVEL NO',
    or: 'ou',
    readInBrowser: 'leia no seu navegador',
    copyLink: 'Copiar link para compartilhar',
    copied: 'Link copiado',
    home: 'Ir para immerseresearch.app',
    language: 'Idioma',
  },
  hi: {
    metaTitle: 'Immerse Research पाएं',
    metaDescription: 'सभी परंपराओं के पवित्र ग्रंथ। iPhone और Android पर निःशुल्क।',
    tagline: 'सभी परंपराओं के पवित्र ग्रंथ।',
    availability: 'iPhone और Android पर निःशुल्क।',
    appStoreSmall: 'डाउनलोड करें',
    playSmall: 'इसे पाएं',
    or: 'या',
    readInBrowser: 'अपने ब्राउज़र में पढ़ें',
    copyLink: 'शेयर करने के लिए लिंक कॉपी करें',
    copied: 'लिंक कॉपी हो गया',
    home: 'immerseresearch.app पर जाएं',
    language: 'भाषा',
  },
};

/** Menu order and labels: the app's interface languages, as the app lists them. */
export const GET_LANGUAGES = UI_LANGUAGES.filter(l => l.code in getContent).map(l => ({
  code: l.code,
  label: LANGUAGE_LABELS[l.code] ?? l.label,
}));

/**
 * Pick the page language: an explicit ?lang wins; otherwise the first
 * Accept-Language entry we have copy for, so a friend in Tehran who opens a
 * shared link reads it in Persian without touching the menu.
 */
export function resolveGetLocale(lang: string | string[] | undefined, acceptLanguage: string | null): string {
  const explicit = Array.isArray(lang) ? lang[0] : lang;
  if (explicit && explicit in getContent) return explicit;
  for (const part of (acceptLanguage ?? '').split(',')) {
    const code = part.split(';')[0].trim().split('-')[0].toLowerCase();
    if (code && code in getContent) return code;
  }
  return 'en';
}
