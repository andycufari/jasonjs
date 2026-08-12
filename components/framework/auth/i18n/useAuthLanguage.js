// useAuthLanguage.js - Hook for Auth internationalization
'use client';

import { useMemo } from 'react';
import { getTranslation, getSection, normalizeLanguage } from './translations';

/**
 * Detect browser language
 * @returns {string} Language code (en, es-AR, pt-BR)
 */
function detectBrowserLanguage() {
  if (typeof window === 'undefined') {
    return 'en'; // Default to English on server
  }

  // Check document lang attribute first (set by framework)
  const docLang = document.documentElement.lang;
  if (docLang) {
    return normalizeLanguage(docLang);
  }

  // Fallback to browser language
  const browserLang = navigator.language || navigator.userLanguage || 'en';
  return normalizeLanguage(browserLang);
}

/**
 * Hook for Auth internationalization
 * @param {string} overrideLang - Optional language override (from jcontext.language)
 * @returns {Object} Translation utilities
 */
export function useAuthLanguage(overrideLang = null) {
  // Detect language once
  const language = useMemo(() => {
    return overrideLang ? normalizeLanguage(overrideLang) : detectBrowserLanguage();
  }, [overrideLang]);

  // Create translation function
  const t = useMemo(() => {
    return (keyPath, replacements = {}) => {
      return getTranslation(keyPath, language, replacements);
    };
  }, [language]);

  // Create section getter
  const section = useMemo(() => {
    return (sectionName) => {
      return getSection(sectionName, language);
    };
  }, [language]);

  return {
    language,
    t, // Translation function: t('auth.sendCode')
    section, // Section getter: section('auth')
    isSpanish: language === 'es-AR',
    isPortuguese: language === 'pt-BR',
    isEnglish: language === 'en'
  };
}

/**
 * Get translation without hook (for use outside React components)
 * @param {string} keyPath - Translation key path
 * @param {Object} replacements - Replacement values
 * @param {string} lang - Optional language override
 * @returns {string} Translated string
 */
export function translate(keyPath, replacements = {}, lang = null) {
  const language = lang ? normalizeLanguage(lang) : detectBrowserLanguage();
  return getTranslation(keyPath, language, replacements);
}

export default useAuthLanguage;
