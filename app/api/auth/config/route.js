// app/api/auth/config/route.js
import { NextResponse } from 'next/server';
import { getAllSettings } from '@/core/sites/files';
import { resolveSite } from '@/core/sites/resolve';
import { getSiteInfo } from '@/core/utils/getSiteInfo';
import { getTheme } from '@/core/render/getTheme';

export async function GET(request) {
  try {
    const { host } = await resolveSite();

    // Load all settings safely
    let settings = {};
    try {
      settings = await getAllSettings(host);
    } catch (error) {
      settings = {};
    }

    // Get site information for branding
    let siteInfo;
    try {
      siteInfo = await getSiteInfo(host);
    } catch (error) {
      // Use domain as fallback name, or 'JasonJS' if no domain
      siteInfo = {
        name: host && host !== 'localhost' ? host : 'JasonJS',
        logo: null,
        branding: {}
      };
    }

    // Use auth UI defaultName if available
    if (settings.auth?.ui?.defaultName) {
      siteInfo.name = settings.auth.ui.defaultName;
    }

    // Process theme
    const { mergedTheme, themeStyles } = getTheme(settings.theme || {});

    // Detect language from query parameter or Accept-Language header
    const { searchParams } = new URL(request.url);
    const langParam = searchParams.get('lang');
    const acceptLanguage = request.headers.get('accept-language');

    // Determine language (priority: query param > accept-language > default)
    let detectedLanguage = 'en';
    if (langParam) {
      detectedLanguage = langParam.toLowerCase().split('-')[0];
    } else if (acceptLanguage) {
      // Parse Accept-Language header (e.g., "es-ES,es;q=0.9,en;q=0.8")
      const languages = acceptLanguage.split(',').map(lang => lang.split(';')[0].trim().toLowerCase().split('-')[0]);
      if (languages.includes('es')) {
        detectedLanguage = 'es';
      }
    }

    // Simple i18n texts with auth config override
    const authLabels = settings.auth?.ui?.labels || {};

    // Helper function: returns empty string if explicitly set to empty, otherwise returns default
    const getLabel = (configValue, defaultValue) => {
      return configValue !== undefined ? configValue : defaultValue;
    };

    const texts = {
      en: {
        welcomeBack: getLabel(authLabels.signIn, 'Welcome back'),
        signInToContinue: getLabel(authLabels.signInToContinue, 'Enter your credentials to access your account'),
        dontHaveAccount: getLabel(authLabels.dontHaveAccount, "Don't have an account?"),
        signUp: getLabel(authLabels.register, 'Sign up'),
        alreadyHaveAccount: getLabel(authLabels.alreadyHaveAccount, 'Already have an account?'),
        signIn: getLabel(authLabels.continue, 'Sign in'),
        protectedBy: getLabel(authLabels.protectedBy, 'Secure authentication'),
        forgotPassword: getLabel(authLabels.forgotPassword, 'Forgot password?'),
        orContinueWith: getLabel(authLabels.orContinueWith, 'Or continue with'),
        username: getLabel(authLabels.username, 'Email'),
        password: getLabel(authLabels.password, 'Password'),
        rememberMe: getLabel(authLabels.rememberMe, 'Remember me'),
        email: getLabel(authLabels.email, 'Email address'),
        name: getLabel(authLabels.name, 'Full name'),
        createAccount: getLabel(authLabels.createAccount, 'Create Account'),
        signingIn: getLabel(authLabels.signingIn, 'Signing in...'),
        creatingAccount: getLabel(authLabels.creatingAccount, 'Creating account...'),
        continueWithGoogle: getLabel(authLabels.continueWithGoogle, 'Continue with Google'),
        continueWithGithub: getLabel(authLabels.continueWithGithub, 'Continue with GitHub'),
        // UserWidget labels
        profileSettings: getLabel(authLabels.profileSettings, 'Profile Settings'),
        adminDashboard: getLabel(authLabels.adminDashboard, 'Admin Dashboard'),
        signOut: getLabel(authLabels.signOut, 'Sign Out'),
        // UserProfile labels
        accountSettings: getLabel(authLabels.accountSettings, 'Account Settings'),
        manageAccountSettings: getLabel(authLabels.manageAccountSettings, 'Manage your account settings and preferences'),
        account: getLabel(authLabels.account, 'Account'),
        security: getLabel(authLabels.security, 'Security'),
        authenticationRequired: getLabel(authLabels.authenticationRequired, 'Authentication Required'),
        pleaseSignIn: getLabel(authLabels.pleaseSignIn, 'Please sign in to view your profile.'),
        profileInformation: getLabel(authLabels.profileInformation, 'Profile Information'),
        editProfile: getLabel(authLabels.editProfile, 'Edit Profile'),
        fullName: getLabel(authLabels.fullName, 'Full Name'),
        username: getLabel(authLabels.username, 'Username'),
        emailAddress: getLabel(authLabels.emailAddress, 'Email Address'),
        role: getLabel(authLabels.role, 'Role'),
        notProvided: getLabel(authLabels.notProvided, 'Not provided'),
        cancel: getLabel(authLabels.cancel, 'Cancel'),
        saving: getLabel(authLabels.saving, 'Saving...'),
        saveChanges: getLabel(authLabels.saveChanges, 'Save Changes'),
        profileUpdated: getLabel(authLabels.profileUpdated, 'Profile updated successfully!'),
        profileUpdateFailed: getLabel(authLabels.profileUpdateFailed, 'Failed to update profile'),
        profileUpdateError: getLabel(authLabels.profileUpdateError, 'An error occurred while updating your profile'),
        signOutDevice: getLabel(authLabels.signOutDevice, 'Sign out of your account on this device'),
        password: getLabel(authLabels.password, 'Password'),
        changePassword: getLabel(authLabels.changePassword, 'Change your password to keep your account secure'),
        changePasswordBtn: getLabel(authLabels.changePasswordBtn, 'Change Password (Coming Soon)'),
        twoFactorAuth: getLabel(authLabels.twoFactorAuth, 'Two-Factor Authentication'),
        twoFactorAuthDesc: getLabel(authLabels.twoFactorAuthDesc, 'Add an extra layer of security to your account'),
        enable2FA: getLabel(authLabels.enable2FA, 'Enable 2FA (Coming Soon)')
      },
      es: {
        welcomeBack: getLabel(authLabels.signIn, 'Bienvenido de nuevo'),
        signInToContinue: getLabel(authLabels.signInToContinue, 'Ingresa tus credenciales para acceder a tu cuenta'),
        dontHaveAccount: getLabel(authLabels.dontHaveAccount, '¿No tienes una cuenta?'),
        signUp: getLabel(authLabels.register, 'Registrarse'),
        alreadyHaveAccount: getLabel(authLabels.alreadyHaveAccount, '¿Ya tienes una cuenta?'),
        signIn: getLabel(authLabels.continue, 'Iniciar sesión'),
        protectedBy: getLabel(authLabels.protectedBy, 'Autenticación segura'),
        forgotPassword: getLabel(authLabels.forgotPassword, '¿Olvidaste tu contraseña?'),
        orContinueWith: getLabel(authLabels.orContinueWith, 'O continuar con'),
        username: getLabel(authLabels.username, 'Correo electrónico'),
        password: getLabel(authLabels.password, 'Contraseña'),
        rememberMe: getLabel(authLabels.rememberMe, 'Recordarme'),
        email: getLabel(authLabels.email, 'Correo electrónico'),
        name: getLabel(authLabels.name, 'Nombre completo'),
        createAccount: getLabel(authLabels.createAccount, 'Crear cuenta'),
        signingIn: getLabel(authLabels.signingIn, 'Iniciando sesión...'),
        creatingAccount: getLabel(authLabels.creatingAccount, 'Creando cuenta...'),
        continueWithGoogle: getLabel(authLabels.continueWithGoogle, 'Continuar con Google'),
        continueWithGithub: getLabel(authLabels.continueWithGithub, 'Continuar con GitHub'),
        // UserWidget labels
        profileSettings: getLabel(authLabels.profileSettings, 'Configuración del perfil'),
        adminDashboard: getLabel(authLabels.adminDashboard, 'Panel de administración'),
        signOut: getLabel(authLabels.signOut, 'Cerrar sesión'),
        // UserProfile labels
        accountSettings: getLabel(authLabels.accountSettings, 'Configuración de la cuenta'),
        manageAccountSettings: getLabel(authLabels.manageAccountSettings, 'Administra la configuración y preferencias de tu cuenta'),
        account: getLabel(authLabels.account, 'Cuenta'),
        security: getLabel(authLabels.security, 'Seguridad'),
        authenticationRequired: getLabel(authLabels.authenticationRequired, 'Autenticación requerida'),
        pleaseSignIn: getLabel(authLabels.pleaseSignIn, 'Por favor inicia sesión para ver tu perfil.'),
        profileInformation: getLabel(authLabels.profileInformation, 'Información del perfil'),
        editProfile: getLabel(authLabels.editProfile, 'Editar perfil'),
        fullName: getLabel(authLabels.fullName, 'Nombre completo'),
        username: getLabel(authLabels.username, 'Nombre de usuario'),
        emailAddress: getLabel(authLabels.emailAddress, 'Correo electrónico'),
        role: getLabel(authLabels.role, 'Rol'),
        notProvided: getLabel(authLabels.notProvided, 'No proporcionado'),
        cancel: getLabel(authLabels.cancel, 'Cancelar'),
        saving: getLabel(authLabels.saving, 'Guardando...'),
        saveChanges: getLabel(authLabels.saveChanges, 'Guardar cambios'),
        profileUpdated: getLabel(authLabels.profileUpdated, '¡Perfil actualizado exitosamente!'),
        profileUpdateFailed: getLabel(authLabels.profileUpdateFailed, 'Error al actualizar el perfil'),
        profileUpdateError: getLabel(authLabels.profileUpdateError, 'Ocurrió un error al actualizar tu perfil'),
        signOutDevice: getLabel(authLabels.signOutDevice, 'Cerrar sesión en este dispositivo'),
        password: getLabel(authLabels.password, 'Contraseña'),
        changePassword: getLabel(authLabels.changePassword, 'Cambia tu contraseña para mantener tu cuenta segura'),
        changePasswordBtn: getLabel(authLabels.changePasswordBtn, 'Cambiar contraseña (Próximamente)'),
        twoFactorAuth: getLabel(authLabels.twoFactorAuth, 'Autenticación de dos factores'),
        twoFactorAuthDesc: getLabel(authLabels.twoFactorAuthDesc, 'Añade una capa extra de seguridad a tu cuenta'),
        enable2FA: getLabel(authLabels.enable2FA, 'Activar 2FA (Próximamente)')
      }
    };

    // Build safe auth configuration (NO API KEYS!)
    const safeAuthConfig = {
      // Site branding
      site: {
        name: siteInfo.name,
        logo: siteInfo.logo || settings.auth?.ui?.logo
      },

      // Theme configuration
      theme: {
        defaultColorScheme: mergedTheme.defaultColorScheme || 'light',
        colors: mergedTheme.colors || {
          primary: '#6366f1',
          secondary: '#8b5cf6',
          background: '#f8fafc',
          'bg-dark': '#0f172a',
          text: '#1f2937',
          textSecondary: '#6b7280',
          surface: '#ffffff'
        },
        typography: mergedTheme.typography || {
          fontFamily: "'Inter', system-ui, sans-serif",
          headings: {
            fontFamily: "'Inter', system-ui, sans-serif",
            fontWeight: '600'
          }
        },
        buttons: mergedTheme.buttons || {},
        cardStyle: mergedTheme.cardStyle || '',
        containerStyle: mergedTheme.containerStyle || ''
      },

      // Modal background configuration
      modalBackground: {
        transparent: settings.auth?.modal?.transparent === true,
        color: settings.auth?.modal?.backgroundColor || null,
        blur: settings.auth?.modal?.blur !== false, // Default to true
        showGradient: settings.auth?.modal?.showGradient !== false // Default to true
      },

      // Auth UI configuration (safe)
      auth: {
        providers: {
          credentials: {
            enabled: settings.auth?.providers?.credentials?.enabled !== false
          },
          google: {
            enabled: settings.auth?.providers?.google?.enabled === true
          },
          github: {
            enabled: settings.auth?.providers?.github?.enabled === true
          },
          email: {
            enabled: settings.auth?.providers?.email?.enabled === true
          }
        },
        registration: {
          enabled: settings.auth?.registration?.enabled !== false,
          requireEmailVerification: settings.auth?.registration?.requireEmailVerification === true,
          emailVerificationMethod: settings.auth?.registration?.emailVerificationMethod || 'link',
          customFields: settings.auth?.registration?.customFields || []
        },
        signup: {
          enabled: settings.auth?.signup?.enabled !== false,
          fields: settings.auth?.signup?.fields || {},
          terms: settings.auth?.signup?.terms,
          privacy: settings.auth?.signup?.privacy
        },
        ui: {
          showProtectedBy: settings.auth?.ui?.showProtectedBy !== false,
          showSocialProviders: settings.auth?.ui?.showSocialProviders !== false,
          showForgotPassword: settings.auth?.ui?.showForgotPassword !== false,
          labels: authLabels,
          logo: settings.auth?.ui?.logo,
          terms: settings.auth?.ui?.terms
        },
        redirects: {
          afterSignIn: settings.auth?.redirects?.afterSignIn || '/',
          afterSignUp: settings.auth?.redirects?.afterSignUp || '/'
        },
        urls: {
          signIn: settings.auth?.urls?.signIn || '/auth/login',
          signUp: settings.auth?.urls?.signUp || '/auth/signup',
          forgotPassword: settings.auth?.urls?.forgotPassword || '/auth/forgot-password'
        }
      },

      // Text labels (use detected language with fallback to English)
      texts: texts[detectedLanguage] || texts.en,
      language: detectedLanguage
    };

    return NextResponse.json({
      success: true,
      config: safeAuthConfig
    }, {
      headers: {
        // Shorter cache for development, varies by language
        // public = can be cached by browsers and CDNs
        // s-maxage = CDN/shared cache time
        // stale-while-revalidate = serve stale content while fetching fresh
        // Vary by Accept-Language to cache different languages separately
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
        'Vary': 'Accept-Language',
      }
    });

  } catch (error) {
    console.error('Error fetching auth config:', error);

    // Return minimal fallback configuration
    return NextResponse.json({
      success: true,
      config: {
        site: {
          name: 'JasonJS',
          logo: null
        },
        theme: {
          defaultColorScheme: 'light',
          colors: {
            primary: '#6366f1',
            secondary: '#8b5cf6',
            background: '#f8fafc',
            'bg-dark': '#0f172a',
            text: '#1f2937',
            textSecondary: '#6b7280',
            surface: '#ffffff'
          },
          typography: {
            fontFamily: "'Inter', system-ui, sans-serif",
            headings: {
              fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: '600'
            }
          },
          buttons: {},
          cardStyle: ''
        },
        modalBackground: {
          transparent: false, // Default to solid background
          color: null,
          blur: true,
          showGradient: true
        },
        auth: {
          providers: {
            credentials: { enabled: true },
            google: { enabled: false },
            github: { enabled: false },
            email: { enabled: false }
          },
          registration: {
            enabled: true,
            customFields: []
          },
          ui: {
            showProtectedBy: false,
            showSocialProviders: false,
            labels: {}
          },
          redirects: {
            afterSignIn: '/',
            afterSignUp: '/'
          }
        },
        texts: {
          welcomeBack: 'Welcome back',
          signInToContinue: 'Enter your credentials to access your account',
          signIn: 'Sign in',
          signUp: 'Sign up',
          username: 'Email',
          password: 'Password',
          createAccount: 'Create Account',
          profileSettings: 'Profile Settings',
          adminDashboard: 'Admin Dashboard',
          signOut: 'Sign Out'
        }
      }
    }, {
      headers: {
        // Cache fallback config for 1 minute (shorter since it's an error state)
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      }
    });
  }
}