// i18n System for Comments Plugin
// Automatically detects browser language and loads translations

import enTranslations from './en.json';
import esTranslations from './es.json';

// Available translations
const translations = {
  en: enTranslations,
  es: esTranslations,
};

// Supported languages
const supportedLanguages = ['en', 'es'];

// Default language
const defaultLanguage = 'en';

/**
 * Detect user's preferred language from browser or settings
 */
export function detectLanguage() {
  // Check if we're in browser environment
  if (typeof window === 'undefined') {
    return defaultLanguage;
  }

  // Try to get language from localStorage (user preference)
  try {
    const savedLanguage = window.localStorage.getItem('comments-plugin-language');
    if (savedLanguage && supportedLanguages.includes(savedLanguage)) {
      return savedLanguage;
    }
  } catch (error) {
    // localStorage not available
  }

  // Get browser language
  const browserLang = navigator.language || navigator.userLanguage || defaultLanguage;

  // Extract base language (e.g., 'en' from 'en-US')
  const baseLang = browserLang.split('-')[0].toLowerCase();

  // Return supported language or default
  return supportedLanguages.includes(baseLang) ? baseLang : defaultLanguage;
}

/**
 * Set user's preferred language
 */
export function setLanguage(lang) {
  if (!supportedLanguages.includes(lang)) {
    console.warn(`Language '${lang}' not supported. Using default.`);
    return;
  }

  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('comments-plugin-language', lang);
    }
  } catch (error) {
    // localStorage not available
  }
}

/**
 * Get translation for a key
 * @param {string} key - Translation key (e.g., 'comments.reply')
 * @param {object} replacements - Variables to replace in translation (e.g., {count: 5})
 * @param {string} lang - Language code (optional, auto-detects if not provided)
 */
export function t(key, replacements = {}, lang = null) {
  const language = lang || detectLanguage();
  const langTranslations = translations[language] || translations[defaultLanguage];

  // Navigate through nested object using key path
  const keys = key.split('.');
  let value = langTranslations;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Key not found, return key itself as fallback
      console.warn(`Translation key '${key}' not found for language '${language}'`);
      return key;
    }
  }

  // Replace variables in translation string
  if (typeof value === 'string' && replacements) {
    return value.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
      return replacements[variable] !== undefined ? replacements[variable] : match;
    });
  }

  return value;
}

/**
 * Get all translations for a specific section
 * @param {string} section - Section key (e.g., 'comments')
 * @param {string} lang - Language code (optional)
 */
export function getSection(section, lang = null) {
  const language = lang || detectLanguage();
  const langTranslations = translations[language] || translations[defaultLanguage];

  return langTranslations[section] || {};
}

/**
 * Format relative time (e.g., "2 hours ago")
 * @param {Date|string|number} date - Date to format
 * @param {string} lang - Language code (optional)
 */
export function formatRelativeTime(date, lang = null) {
  const language = lang || detectLanguage();

  // Handle invalid dates
  if (!date) {
    return t('comments.time.just_now', {}, language);
  }

  // Handle MongoDB extended JSON format: { "$date": "..." } or { $date: "..." }
  let dateValue = date;
  if (typeof date === 'object' && date !== null && !(date instanceof Date)) {
    dateValue = date.$date || date._seconds ? new Date(date._seconds * 1000) : date;
  }

  const now = new Date();
  const then = new Date(dateValue);

  // Check if date is valid
  if (isNaN(then.getTime())) {
    return t('comments.time.just_now', {}, language);
  }

  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 10) {
    return t('comments.time.just_now', {}, language);
  }

  if (seconds < 60) {
    return t('comments.time.seconds_ago', { count: seconds }, language);
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return t('comments.time.minutes_ago', { count: minutes }, language);
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return t('comments.time.hours_ago', { count: hours }, language);
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return t('comments.time.days_ago', { count: days }, language);
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 4) {
    return t('comments.time.weeks_ago', { count: weeks }, language);
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return t('comments.time.months_ago', { count: months }, language);
  }

  const years = Math.floor(days / 365);
  return t('comments.time.years_ago', { count: years }, language);
}

/**
 * React hook for using translations in components
 */
export function useTranslation() {
  const language = detectLanguage();

  return {
    t: (key, replacements) => t(key, replacements, language),
    language,
    setLanguage,
    formatRelativeTime: (date) => formatRelativeTime(date, language),
  };
}

export default {
  t,
  getSection,
  detectLanguage,
  setLanguage,
  formatRelativeTime,
  useTranslation,
  supportedLanguages,
};
