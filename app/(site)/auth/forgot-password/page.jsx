import { redirect } from 'next/navigation';
import { loadPageDefinition } from '@/core/render/loadPage';
import { getAllSettings } from '@/core/sites/files';
import { getServerSession } from 'next-auth';
import { createAuthOptions } from '@/core/auth/options';
import { resolveSite } from '@/core/sites/resolve';
import { getSiteInfo } from '@/core/utils/getSiteInfo';
import { getTheme } from '@/core/render/getTheme';
import ForgotPasswordForm from '@/components/framework/auth/ForgotPasswordForm';

function getFontCss(fonts = {}) {
  const fontImports = Object.values(fonts)
    .filter(font => font.src && font.src.includes('googleapis'))
    .map(font => `@import url('${font.src}');`)
    .join('\n');

  return fontImports;
}

export default async function ForgotPasswordPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const { host } = await resolveSite();

  let pageData;
  try {
    pageData = await loadPageDefinition({
      params: { slug: ['auth', 'forgot-password'] },
      searchParams: resolvedSearchParams
    });
  } catch (error) {
    pageData = null;
  }

  let settings = {};
  try {
    settings = await getAllSettings(host);
  } catch (error) {
    console.log('Error loading settings:', error);
    settings = {};
  }

  if (!pageData) {
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

  let siteInfo;
  try {
    siteInfo = await getSiteInfo(pageData.domain);
  } catch (error) {
    siteInfo = {
      name: null,
      logo: null,
      branding: {}
    };
  }

  if (pageData.auth?.ui?.defaultName) {
    siteInfo.name = pageData.auth.ui.defaultName;
  }

  const authOptions = await createAuthOptions(pageData);
  const session = await getServerSession(authOptions);

  if (session) {
    redirect(pageData.auth?.redirects?.afterSignIn || '/');
  }

  const userLang = resolvedSearchParams.lang || 'en';
  const authLabels = pageData.auth?.ui?.labels || {};

  const getLabel = (configValue, defaultValue) => {
    return configValue !== undefined ? configValue : defaultValue;
  };

  const texts = {
    en: {
      title: getLabel(authLabels.forgotPassword, 'Forgot password?'),
      subtitle: "No worries, we'll send you reset instructions",
      backToLogin: getLabel(authLabels.backToLogin, 'Back to login')
    },
    es: {
      title: authLabels.forgotPassword || '¿Olvidaste tu contraseña?',
      subtitle: 'No te preocupes, te enviaremos instrucciones para restablecerla',
      backToLogin: authLabels.backToLogin || 'Volver al inicio de sesión'
    },
    fr: {
      title: authLabels.forgotPassword || 'Mot de passe oublié ?',
      subtitle: "Pas de soucis, nous vous enverrons des instructions de réinitialisation",
      backToLogin: authLabels.backToLogin || 'Retour à la connexion'
    }
  };

  const t = texts[userLang] || texts.en;

  const fontCss = getFontCss(settings.fonts || {});
  const { mergedTheme, themeStyles } = getTheme(pageData.theme || settings.theme || {});

  const combinedStyles = `
    ${fontCss}
    ${themeStyles}
  `;

  const clientData = {
    startup_id: pageData.startup_id,
    theme: mergedTheme,
    texts: t,
    auth: {
      providers: pageData.auth?.providers || { credentials: { enabled: true } },
      ui: pageData.auth?.ui || {},
      urls: pageData.auth?.urls || {},
      redirects: pageData.auth?.redirects || {}
    }
  };

  const primaryColor = mergedTheme.colors?.primary || '#6366f1';
  const secondaryColor = mergedTheme.colors?.secondary || '#8b5cf6';
  const backgroundColor = mergedTheme.colors?.background || '#0f172a';

  const gradientStyle = {
    background: mergedTheme.colors?.background
      ? mergedTheme.colors.background
      : `linear-gradient(135deg, ${backgroundColor} 0%, ${primaryColor}15 25%, ${secondaryColor}15 75%, ${backgroundColor} 100%)`,
    minHeight: '100vh',
    fontFamily: mergedTheme.typography?.fontFamily || "'Inter', system-ui, sans-serif"
  };

  const cardStyle = mergedTheme.cardStyle || 'bg-slate-800/80 backdrop-blur-md border border-slate-700 shadow-2xl';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: combinedStyles }} />

      <div
        className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
        style={{
          ...gradientStyle,
          color: mergedTheme.colors?.text || '#f8fafc'
        }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute -top-40 -right-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"
            style={{ backgroundColor: primaryColor }}
          ></div>
          <div
            className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"
            style={{ backgroundColor: secondaryColor }}
          ></div>
        </div>

        <div className="w-full max-w-md relative z-10">
          <div className={`rounded-2xl p-8 space-y-6 ${cardStyle}`}>
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
                      className="font-bold text-xl"
                      style={{ color: mergedTheme.colors?.surface || '#ffffff' }}
                    >
                      {siteInfo.name[0]}
                    </span>
                  </div>
                  <span
                    className="text-2xl"
                    style={{
                      color: mergedTheme.colors?.text || '#ffffff',
                      fontWeight: '600'
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
                    style={{ color: mergedTheme.colors?.surface || '#ffffff' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              )}
            </div>

            <div className="text-center">
              <h1
                className="text-3xl font-bold mb-2"
                style={{
                  color: mergedTheme.colors?.text || '#ffffff',
                  fontWeight: '700'
                }}
              >
                {t.title}
              </h1>
              <p
                style={{
                  color: mergedTheme.colors?.textSecondary || '#cbd5e1'
                }}
              >
                {t.subtitle}
              </p>
            </div>

            <ForgotPasswordForm jcontext={clientData} />
          </div>
        </div>
      </div>
    </>
  );
}