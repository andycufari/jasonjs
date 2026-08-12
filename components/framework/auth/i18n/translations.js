// Auth i18n translations
// Default language: English (en)
// Supported languages: English (en), Spanish Argentina (es-AR), Portuguese Brazil (pt-BR)

export const translations = {
  en: {
    // Main auth flow
    auth: {
      enterEmail: 'Enter your email to continue',
      sendCode: 'Send login code',
      sending: 'Sending...',
      continue: 'Continue',
      checkingAccount: 'Checking account...',
      welcomeBack: 'Welcome back!',
      welcome: 'Welcome!',
      letsSetup: "Let's set up your account",
      createAccount: 'Create account',
      creatingAccount: 'Creating account...',
      continueWith: 'Or continue with',
      fullName: 'Full name',
      email: 'Email address',
      changeEmail: 'Change email',
      password: 'Password',
      forgotPassword: 'Forgot password?',
      rememberMe: 'Remember me',
      signIn: 'Sign in',
      signingIn: 'Signing in...',
      signOut: 'Sign out',
      signUp: 'Sign up',
      noAccount: "Don't have an account?",
      haveAccount: 'Already have an account?',
      orContinueWith: 'or continue with',
      cancel: 'Cancel'
    },

    // Code verification
    verification: {
      title: 'Verify your email',
      codeSentTo: 'We sent a 6-digit code to',
      enterCode: 'Enter the code below to verify your account',
      verify: 'Verify code',
      verifying: 'Verifying...',
      resendCode: "Didn't receive the code?",
      resend: 'Resend',
      resending: 'Resending...',
      codeSent: 'Code sent!',
      codeExpired: 'Code expired. Please request a new one.',
      invalidCode: 'Invalid code. Please try again.',
      codeRequired: 'Please enter the 6-digit code',
      codeMustBe6: 'Code must be 6 digits'
    },

    // Terms and privacy
    legal: {
      agreeToTerms: 'I agree to the',
      termsOfService: 'Terms of Service',
      and: 'and',
      privacyPolicy: 'Privacy Policy',
      mustAgree: 'You must agree to the terms to continue'
    },

    // Providers
    providers: {
      google: 'Continue with Google',
      github: 'Continue with GitHub',
      web3: 'Continue with Wallet',
      email: 'Continue with Email'
    },

    // Errors
    errors: {
      invalidEmail: 'Please enter a valid email address',
      emailRequired: 'Email is required',
      nameRequired: 'Name is required',
      passwordRequired: 'Password is required',
      passwordTooShort: 'Password must be at least {{min}} characters',
      userNotFound: 'No account found with this email',
      userExists: 'An account already exists with this email',
      invalidCredentials: 'Invalid email or password',
      tooManyAttempts: 'Too many attempts. Please try again later.',
      networkError: 'Network error. Please check your connection.',
      genericError: 'Something went wrong. Please try again.',
      sessionExpired: 'Your session has expired. Please sign in again.',
      registrationClosed: 'Registration is currently closed',
      registrationClosedDesc: 'New registrations are currently not accepted.'
    },

    // Success messages
    success: {
      codeSent: 'Verification code sent to your email',
      accountCreated: 'Account created successfully!',
      accountCreatedDesc: 'Your account has been created successfully.',
      signedIn: 'Welcome back!',
      signedOut: 'You have been signed out',
      passwordReset: 'Password reset email sent',
      signingIn: 'Signing you in...',
      returnToSignIn: 'Return to Sign In'
    }
  },

  'es-AR': {
    // Main auth flow
    auth: {
      enterEmail: 'Ingresa tu email para continuar',
      sendCode: 'Enviar codigo',
      sending: 'Enviando...',
      continue: 'Continuar',
      checkingAccount: 'Verificando cuenta...',
      welcomeBack: 'Hola de nuevo!',
      welcome: 'Bienvenido!',
      letsSetup: 'Vamos a configurar tu cuenta',
      createAccount: 'Crear cuenta',
      creatingAccount: 'Creando cuenta...',
      continueWith: 'O continuar con',
      fullName: 'Nombre completo',
      email: 'Correo electronico',
      changeEmail: 'Cambiar email',
      password: 'Contrasena',
      forgotPassword: 'Olvidaste tu contrasena?',
      rememberMe: 'Recordarme',
      signIn: 'Iniciar sesion',
      signingIn: 'Iniciando sesion...',
      signOut: 'Cerrar sesion',
      signUp: 'Registrarse',
      noAccount: 'No tienes cuenta?',
      haveAccount: 'Ya tienes cuenta?',
      orContinueWith: 'o continuar con',
      cancel: 'Cancelar'
    },

    // Code verification
    verification: {
      title: 'Verifica tu email',
      codeSentTo: 'Enviamos un codigo de 6 digitos a',
      enterCode: 'Ingresa el codigo para verificar tu cuenta',
      verify: 'Verificar codigo',
      verifying: 'Verificando...',
      resendCode: 'No recibiste el codigo?',
      resend: 'Reenviar',
      resending: 'Reenviando...',
      codeSent: 'Codigo enviado!',
      codeExpired: 'Codigo expirado. Solicita uno nuevo.',
      invalidCode: 'Codigo invalido. Intenta de nuevo.',
      codeRequired: 'Ingresa el codigo de 6 digitos',
      codeMustBe6: 'El codigo debe tener 6 digitos'
    },

    // Terms and privacy
    legal: {
      agreeToTerms: 'Acepto los',
      termsOfService: 'Terminos de Servicio',
      and: 'y',
      privacyPolicy: 'Politica de Privacidad',
      mustAgree: 'Debes aceptar los terminos para continuar'
    },

    // Providers
    providers: {
      google: 'Continuar con Google',
      github: 'Continuar con GitHub',
      web3: 'Continuar con Wallet',
      email: 'Continuar con Email'
    },

    // Errors
    errors: {
      invalidEmail: 'Ingresa un email valido',
      emailRequired: 'El email es requerido',
      nameRequired: 'El nombre es requerido',
      passwordRequired: 'La contrasena es requerida',
      passwordTooShort: 'La contrasena debe tener al menos {{min}} caracteres',
      userNotFound: 'No hay cuenta con este email',
      userExists: 'Ya existe una cuenta con este email',
      invalidCredentials: 'Email o contrasena invalidos',
      tooManyAttempts: 'Demasiados intentos. Intenta mas tarde.',
      networkError: 'Error de red. Verifica tu conexion.',
      genericError: 'Algo salio mal. Intenta de nuevo.',
      sessionExpired: 'Tu sesion expiro. Inicia sesion de nuevo.',
      registrationClosed: 'Registro cerrado',
      registrationClosedDesc: 'Los nuevos registros no estan disponibles.'
    },

    // Success messages
    success: {
      codeSent: 'Codigo de verificacion enviado a tu email',
      accountCreated: 'Cuenta creada exitosamente!',
      accountCreatedDesc: 'Tu cuenta ha sido creada exitosamente.',
      signedIn: 'Bienvenido!',
      signedOut: 'Has cerrado sesion',
      passwordReset: 'Email de recuperacion enviado',
      signingIn: 'Iniciando sesion...',
      returnToSignIn: 'Volver a iniciar sesion'
    }
  },

  'pt-BR': {
    // Main auth flow
    auth: {
      enterEmail: 'Digite seu email para continuar',
      sendCode: 'Enviar codigo',
      sending: 'Enviando...',
      continue: 'Continuar',
      checkingAccount: 'Verificando conta...',
      welcomeBack: 'Bem-vindo de volta!',
      welcome: 'Bem-vindo!',
      letsSetup: 'Vamos configurar sua conta',
      createAccount: 'Criar conta',
      creatingAccount: 'Criando conta...',
      continueWith: 'Ou continuar com',
      fullName: 'Nome completo',
      email: 'Email',
      changeEmail: 'Alterar email',
      password: 'Senha',
      forgotPassword: 'Esqueceu a senha?',
      rememberMe: 'Lembrar-me',
      signIn: 'Entrar',
      signingIn: 'Entrando...',
      signOut: 'Sair',
      signUp: 'Cadastrar',
      noAccount: 'Nao tem conta?',
      haveAccount: 'Ja tem conta?',
      orContinueWith: 'ou continuar com',
      cancel: 'Cancelar'
    },

    // Code verification
    verification: {
      title: 'Verifique seu email',
      codeSentTo: 'Enviamos um codigo de 6 digitos para',
      enterCode: 'Digite o codigo para verificar sua conta',
      verify: 'Verificar codigo',
      verifying: 'Verificando...',
      resendCode: 'Nao recebeu o codigo?',
      resend: 'Reenviar',
      resending: 'Reenviando...',
      codeSent: 'Codigo enviado!',
      codeExpired: 'Codigo expirado. Solicite um novo.',
      invalidCode: 'Codigo invalido. Tente novamente.',
      codeRequired: 'Digite o codigo de 6 digitos',
      codeMustBe6: 'O codigo deve ter 6 digitos'
    },

    // Terms and privacy
    legal: {
      agreeToTerms: 'Concordo com os',
      termsOfService: 'Termos de Servico',
      and: 'e',
      privacyPolicy: 'Politica de Privacidade',
      mustAgree: 'Voce deve aceitar os termos para continuar'
    },

    // Providers
    providers: {
      google: 'Continuar com Google',
      github: 'Continuar com GitHub',
      web3: 'Continuar com Carteira',
      email: 'Continuar com Email'
    },

    // Errors
    errors: {
      invalidEmail: 'Digite um email valido',
      emailRequired: 'Email e obrigatorio',
      nameRequired: 'Nome e obrigatorio',
      passwordRequired: 'Senha e obrigatoria',
      passwordTooShort: 'A senha deve ter pelo menos {{min}} caracteres',
      userNotFound: 'Nenhuma conta encontrada com este email',
      userExists: 'Ja existe uma conta com este email',
      invalidCredentials: 'Email ou senha invalidos',
      tooManyAttempts: 'Muitas tentativas. Tente novamente mais tarde.',
      networkError: 'Erro de rede. Verifique sua conexao.',
      genericError: 'Algo deu errado. Tente novamente.',
      sessionExpired: 'Sua sessao expirou. Entre novamente.',
      registrationClosed: 'Cadastro fechado',
      registrationClosedDesc: 'Novos cadastros nao estao disponiveis.'
    },

    // Success messages
    success: {
      codeSent: 'Codigo de verificacao enviado para seu email',
      accountCreated: 'Conta criada com sucesso!',
      accountCreatedDesc: 'Sua conta foi criada com sucesso.',
      signedIn: 'Bem-vindo!',
      signedOut: 'Voce saiu',
      passwordReset: 'Email de recuperacao enviado',
      signingIn: 'Entrando...',
      returnToSignIn: 'Voltar para entrar'
    }
  }
};

/**
 * Get translation for a key path
 * @param {string} keyPath - Dot notation path (e.g., 'auth.sendCode')
 * @param {string} lang - Language code
 * @param {Object} replacements - Key-value pairs for interpolation
 * @returns {string} Translated string
 */
export function getTranslation(keyPath, lang = 'en', replacements = {}) {
  // Normalize language code
  const normalizedLang = normalizeLanguage(lang);

  // Get translation object for language
  const langTranslations = translations[normalizedLang] || translations.en;

  // Navigate through the key path
  const keys = keyPath.split('.');
  let value = langTranslations;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      // Fallback to English if key not found
      value = translations.en;
      for (const fallbackKey of keys) {
        if (value && typeof value === 'object' && fallbackKey in value) {
          value = value[fallbackKey];
        } else {
          return keyPath; // Return key path if not found in any language
        }
      }
      break;
    }
  }

  // If value is not a string, return the key path
  if (typeof value !== 'string') {
    return keyPath;
  }

  // Replace placeholders (e.g., {{field}}, {{min}})
  let result = value;
  for (const [key, replacement] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), replacement);
  }

  return result;
}

/**
 * Normalize language code to supported language
 * @param {string} lang - Language code
 * @returns {string} Normalized language code
 */
export function normalizeLanguage(lang) {
  if (!lang) return 'en';

  const lowered = lang.toLowerCase();

  // Spanish variants → es-AR
  if (lowered.startsWith('es')) {
    return 'es-AR';
  }

  // Portuguese variants → pt-BR
  if (lowered.startsWith('pt')) {
    return 'pt-BR';
  }

  return 'en';
}

/**
 * Get all translations for a section
 * @param {string} section - Section name (e.g., 'auth')
 * @param {string} lang - Language code
 * @returns {Object} Section translations
 */
export function getSection(section, lang = 'en') {
  const normalizedLang = normalizeLanguage(lang);
  const langTranslations = translations[normalizedLang] || translations.en;
  return langTranslations[section] || translations.en[section] || {};
}

export default translations;
