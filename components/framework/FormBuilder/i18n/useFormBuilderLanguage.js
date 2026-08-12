// useFormBuilderLanguage.js - Hook for FormBuilder internationalization
'use client';

import { useMemo } from 'react';
import { getTranslation, getSection } from './translations';

/**
 * Detect browser language
 * @returns {string} Language code (en, es-AR, etc.)
 */
function detectBrowserLanguage() {
  if (typeof window === 'undefined') {
    return 'en'; // Default to English on server
  }

  // Get browser language
  const browserLang = navigator.language || navigator.userLanguage || 'en';

  // Normalize: if it's Spanish (any variant), return 'es-AR'
  if (browserLang.toLowerCase().startsWith('es')) {
    return 'es-AR';
  }

  return 'en';
}

/**
 * Hook for FormBuilder internationalization
 * @param {string} overrideLang - Optional language override
 * @returns {Object} Translation utilities
 */
export function useFormBuilderLanguage(overrideLang = null) {
  // Detect language once
  const language = useMemo(() => {
    return overrideLang || detectBrowserLanguage();
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
    t, // Translation function: t('formBuilder.update')
    section, // Section getter: section('formBuilder')
    isSpanish: language.startsWith('es'),
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
  const language = lang || detectBrowserLanguage();
  return getTranslation(keyPath, language, replacements);
}

export default useFormBuilderLanguage;
