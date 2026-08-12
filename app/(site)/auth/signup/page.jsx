// app/(site)/auth/signup/page.jsx
import { redirect } from 'next/navigation';
import { loadPageDefinition } from '@/core/render/loadPage';
import { getAllSettings, getSite } from '@/core/sites/files';
import { getServerSession } from 'next-auth';
import { createAuthOptions } from '@/core/auth/options';
import { resolveSite } from '@/core/sites/resolve';
import { getSiteInfo } from '@/core/utils/getSiteInfo';
import { getTheme } from '@/core/render/getTheme';
import { processFonts } from '@/core/render/metadata';
import UnifiedAuth from '@/components/framework/auth/UnifiedAuth';

// Simple approach: Include Google Fonts directly in CSS to avoid hydration issues
function getFontCss(fonts = {}) {
  const fontImports = Object.values(fonts)
    .filter(font => font.src && font.src.includes('googleapis'))
    .map(font => `@import url('${font.src}');`)
    .join('\n');
  
  return fontImports;
}

export default async function SignupPage({ searchParams }) {
  // Await searchParams as required by Next.js 15
  const resolvedSearchParams = await searchParams;
  const { host } = await resolveSite();
  
  // Load page configuration first
  let pageData;
  try {
    pageData = await loadPageDefinition({ 
      params: { slug: ['auth', 'signup'] }, 
      searchParams: resolvedSearchParams 
    });
  } catch (error) {
    pageData = null;
  }
  
  // Load all settings (including auth) from the proper source (database or files)
  let settings = {};
  try {
    settings = await getAllSettings(host);
  } catch (error) {
    console.log('Error loading settings:', error);
    settings = {};
  }
  
  // If no page configuration exists, create default structure
  if (!pageData) {
    console.log('No auth page configuration found, using defaults with settings');
    pageData = {
      domain: host,
      auth: settings.auth || {
        providers: {
          credentials: { enabled: true }
        },
        ui: {
          showProtectedBy: false
        }
      },
      theme: settings.theme || {
        colors: {
          primary: '#6366f1',
          secondary: '#8b5cf6'
        }
      }
    };
  } else {
    // Merge auth settings from database into page data
    if (settings.auth) {
      pageData.auth = { 
        ...pageData.auth, 
        ...settings.auth 
      };
    }
    if (settings.theme) {
      pageData.theme = { 
        ...pageData.theme, 
        ...settings.theme 
      };
    }
  }
  
  // Get site information for branding with fallback
  let siteInfo;
  try {
    siteInfo = await getSiteInfo(pageData.domain);
  } catch (error) {
    console.log('No site info found, using generic defaults');
    siteInfo = {
      name: null,
      logo: null,
      branding: {}
    };
  }
  
  // Use auth UI defaultName if available, otherwise fallback to site info
  if (pageData.auth?.ui?.defaultName) {
    siteInfo.name = pageData.auth.ui.defaultName;
  }

  const authOptions = await createAuthOptions(pageData);

  // Check existing session
  const session = await getServerSession(authOptions);
  if (session) {
    const redirectUrl = resolvedSearchParams.redirect || pageData.auth?.redirects?.afterSignUp || '/';
    redirect(redirectUrl);
  }

  // Detect user language from browser
  const userLang = resolvedSearchParams.lang || 'en';
  
  // Use auth UI labels with empty string support (empty = hide, undefined = use default)
  const authLabels = pageData.auth?.ui?.labels || {};
  
  // Helper function: returns empty string if explicitly set to empty, otherwise returns default
  const getLabel = (configValue, defaultValue) => {
    return configValue !== undefined ? configValue : defaultValue;
  };
  
  // Simple i18n texts with auth config override
  const texts = {
    en: {
      createAccount: getLabel(authLabels.signUp, 'Create your account'),
      joinUs: 'Get started by creating your account',
      dontHaveAccount: "Don't have an account?",
      signUp: authLabels.register || 'Sign up',
      alreadyHaveAccount: 'Already have an account?',
      signIn: authLabels.signIn || 'Sign in',
      protectedBy: 'Secure authentication'
    },
    es: {
      createAccount: authLabels.signUp || 'Crea tu cuenta',
      joinUs: 'Comienza creando tu cuenta',
      dontHaveAccount: '¿No tienes una cuenta?',
      signUp: authLabels.register || 'Regístrate',
      alreadyHaveAccount: '¿Ya tienes una cuenta?',
      signIn: authLabels.signIn || 'Iniciar sesión',
      protectedBy: 'Autenticación segura'
    },
    fr: {
      createAccount: authLabels.signUp || 'Créez votre compte',
      joinUs: 'Commencez en créant votre compte',
      dontHaveAccount: "Vous n'avez pas de compte ?",
      signUp: authLabels.register || "S'inscrire",
      alreadyHaveAccount: 'Vous avez déjà un compte ?',
      signIn: authLabels.signIn || 'Se connecter',
      protectedBy: 'Authentification sécurisée'
    }
  };
  
  const t = texts[userLang] || texts.en;

  // Process fonts and theme using a simpler approach to avoid hydration issues
  const fontCss = getFontCss(settings.fonts || {});
  const { mergedTheme, themeStyles } = getTheme(pageData.theme || settings.theme || {});
  
  // Combine font and theme styles
  const combinedStyles = `
    ${fontCss}
    ${themeStyles}
  `;
  
  // Only pass necessary theme and auth config to client
  const clientData = {
    startup_id: pageData.startup_id,
    theme: mergedTheme,
    texts: t,
    auth: {
      providers: pageData.auth?.providers || { credentials: { enabled: true } },
      registration: pageData.auth?.registration || {},
      methods: pageData.auth?.methods || [],
      ui: pageData.auth?.ui || {},
      terms: pageData.auth?.terms,
      callbackUrl: resolvedSearchParams.redirect || '/',
      redirects: pageData.auth?.redirects || { afterSignUp: '/' },
      urls: pageData.auth?.urls || {}
    }
  };

  // Detect color scheme from theme
  const isDarkMode = mergedTheme.defaultColorScheme === 'dark';

  // Create dynamic gradient background from theme colors
  const primaryColor = mergedTheme.colors?.primary || '#E8673E';
  const secondaryColor = mergedTheme.colors?.secondary || '#2A2A2A';
  const backgroundColor = isDarkMode
    ? (mergedTheme.colors?.['bg-dark'] || '#1C1C1C')
    : (mergedTheme.colors?.background || '#F5EFE0');

  // Card surface color
  const cardSurface = mergedTheme.colors?.surface || '#FFFFFF';
  const borderColor = mergedTheme.colors?.['border-base'] || mergedTheme.colors?.border || '#E0D5C7';

  // Use theme background if specified, otherwise create subtle gradient
  const gradientStyle = {
    background: backgroundColor,
    minHeight: '100vh',
    fontFamily: mergedTheme.typography?.['font-body'] || mergedTheme.typography?.fontFamily || "'Inter', system-ui, sans-serif"
  };

  // Card styling based on theme
  const cardStyle = mergedTheme.cardStyle || '';
  const containerStyle = mergedTheme.containerStyle || '';

  return (
    <>
      {/* Inject combined font and theme styles */}
      <style dangerouslySetInnerHTML={{ __html: combinedStyles }} />
      
      <div
        className={`min-h-screen flex items-center justify-center p-4 relative overflow-hidden`}
        style={{
          ...gradientStyle,
          color: mergedTheme.colors?.text || '#1A1A1A'
        }}
      >
      {/* Animated background elements - only visible in dark mode or if explicitly styled */}
      {isDarkMode && (
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute -top-40 -right-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"
            style={{ backgroundColor: primaryColor }}
          ></div>
          <div
            className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"
            style={{ backgroundColor: secondaryColor }}
          ></div>
          <div
            className="absolute top-40 left-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-25 animate-blob animation-delay-4000"
            style={{ backgroundColor: primaryColor }}
          ></div>
        </div>
      )}

      <div className="w-full max-w-md relative z-10">
        <div
          className={`rounded-2xl p-8 space-y-6 ${cardStyle} ${containerStyle}`}
          style={{
            backgroundColor: cardSurface,
            borderColor: borderColor,
            borderWidth: '1px',
            borderStyle: 'solid',
            boxShadow: mergedTheme.shadows?.lg || '0 8px 32px rgba(0, 0, 0, 0.16)'
          }}
        >
          {/* Logo or Default Brand */}
          <div className="flex justify-center mb-2">
            {siteInfo.logo ? (
              <img 
                src={siteInfo.logo} 
                alt={siteInfo.name} 
                className="h-12 w-auto"
              />
            ) : clientData.auth.ui?.logo ? (
              <img 
                src={clientData.auth.ui.logo} 
                alt="Logo" 
                className="h-12 w-auto"
              />
            ) : siteInfo.name && siteInfo.name !== 'JasonJS Framework' ? (
              <div className="flex items-center space-x-2">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span
                    className="font-bold text-xl auth-brand"
                    style={{
                      color: '#ffffff',
                      fontFamily: mergedTheme.typography?.['font-display'] || mergedTheme.typography?.headings?.fontFamily || mergedTheme.typography?.fontFamily
                    }}
                  >
                    {siteInfo.name[0]}
                  </span>
                </div>
                <span
                  className="text-2xl auth-brand"
                  style={{
                    color: mergedTheme.colors?.text || '#1A1A1A',
                    fontFamily: mergedTheme.typography?.['font-display'] || mergedTheme.typography?.headings?.fontFamily || mergedTheme.typography?.fontFamily,
                    fontWeight: mergedTheme.typography?.headings?.fontWeight || '600'
                  }}
                >
                  {siteInfo.name}
                </span>
              </div>
            ) : (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: primaryColor }}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  style={{ color: '#ffffff' }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            )}
          </div>
          
          {/* Header */}
          <div className="text-center">
            <h1
              className="text-3xl font-bold mb-2"
              style={{
                color: mergedTheme.colors?.text || '#1A1A1A',
                fontFamily: mergedTheme.typography?.['font-display'] || mergedTheme.typography?.headings?.fontFamily || mergedTheme.typography?.fontFamily,
                fontWeight: mergedTheme.typography?.headings?.fontWeight || '700'
              }}
            >
              {t.createAccount}
            </h1>
            <p
              className="font-sans"
              style={{
                color: mergedTheme.colors?.['text-secondary'] || mergedTheme.colors?.textSecondary || '#666666',
                fontFamily: mergedTheme.typography?.['font-body'] || mergedTheme.typography?.fontFamily
              }}
            >
              {t.joinUs}
            </p>
          </div>

          {/* Signup Form */}
          <UnifiedAuth
            jcontext={clientData}
            initialMode="signup"
            className="space-y-4"
          />
          
          {/* Footer with Sign Up Link */}
          <div className="space-y-4">
            {/* Sign up link - shown by default unless disabled */}
            {pageData.auth?.registration?.enabled !== false && (
              <div className="text-center">
                <p
                  className="font-sans"
                  style={{
                    color: mergedTheme.colors?.text || '#1A1A1A',
                    fontFamily: mergedTheme.typography?.fontFamily
                  }}
                >
                  {t.alreadyHaveAccount}{' '}
                  <a
                    href="/auth/login"
                    className="font-medium transition-colors hover:underline"
                    style={{
                      color: mergedTheme.colors?.primary || primaryColor
                    }}
                  >
                    {t.signIn}
                  </a>
                </p>
              </div>
            )}

            {/* Protected by legend - only show if site has custom branding */}
            {siteInfo.name && siteInfo.name !== 'JasonJS Framework' && pageData.auth?.ui?.showProtectedBy !== false && (
              <div className="text-center text-sm">
                <p
                  className="font-sans"
                  style={{
                    color: mergedTheme.colors?.textSecondary || mergedTheme.colors?.['text-secondary'] || '#94a3b8',
                    fontFamily: mergedTheme.typography?.fontFamily
                  }}
                >
                  {siteInfo.branding?.protectedByText || pageData.auth?.ui?.protectedByText || t.protectedBy}{' '}
                  <span
                    className="font-medium"
                    style={{
                      color: mergedTheme.colors?.text || '#1A1A1A'
                    }}
                  >
                    {siteInfo.name}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </>
  );
}