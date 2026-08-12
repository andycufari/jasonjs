//app/(site)/layout.js
import React from 'react';
import AuthSystemProvider from '@/components/system/auth/AuthSystemProvider';
import BillingSystemProvider from '@/components/system/billing/BillingSystemProvider';
import SessionProvider from '@/components/system/SessionProvider';
import { AuthStateProvider } from '@/components/framework/auth/AuthStateProvider';
import LoadingProgressProvider from '@/components/system/LoadingProgressProvider';
import { getAllSettings } from '@/core/sites/files';
import { resolveSite } from '@/core/sites/resolve';

import './globals.css';

export const metadata = {
  title: 'JasonJS Framework',
  description: 'A powerful JSON-driven web framework',
};

export default async function RootLayout({ children }) {
  // Detect language and color scheme from site settings
  let language = 'en'; // Default to English
  let colorScheme = 'light'; // Default to light mode

  try {
    const { host } = await resolveSite();
    const settings = await getAllSettings(host);

    // Try to get language from multiple sources:
    // 1. Top-level site settings (settings.lang)
    // 2. Meta settings (settings.meta.lang)
    // 3. Layout configurations (settings.layout.*.lang)
    // 4. Default to 'en'

    language = settings.lang || settings.language;

    // Check meta.lang
    if (!language && settings.meta?.lang) {
      language = settings.meta.lang;
    }

    // If not found in settings, check all layout configurations
    if (!language && settings.layout) {
      // Check each layout for a lang property
      for (const layoutKey in settings.layout) {
        const layout = settings.layout[layoutKey];
        if (layout && layout.lang) {
          language = layout.lang;
          break;
        }
      }
    }

    // Final fallback
    if (!language) {
      language = 'en';
    }

    // Get color scheme from theme settings (only apply if explicitly set)
    if (settings.theme?.defaultColorScheme) {
      colorScheme = settings.theme.defaultColorScheme;
    }
  } catch (error) {
    // Use default language and light mode if settings can't be loaded
    language = 'en';
    colorScheme = 'light';
  }

  // Only add 'dark' class if site explicitly wants dark mode
  // This ensures .dark CSS rules only apply when intended
  const htmlClassName = colorScheme === 'dark' ? 'dark' : '';

  return (
    <html lang={language} className={htmlClassName || undefined}>
      <body>
        <SessionProvider>
          <AuthStateProvider>
            <AuthSystemProvider>
              <BillingSystemProvider>
                <LoadingProgressProvider>
                  {children}
                </LoadingProgressProvider>
              </BillingSystemProvider>
            </AuthSystemProvider>
          </AuthStateProvider>
        </SessionProvider>
      </body>
    </html>
  );
}