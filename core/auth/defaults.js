// core/auth/defaults.js
export const DEFAULT_AUTH_CONFIG = {
    providers: {
      credentials: {
        enabled: true
      },
      email: {
        enabled: false,
        template: {
          signIn: {
            subject: "Sign in to your account",
            text: "Click this link to sign in to your account:\n{{{url}}}",
            html: `
              <div style="padding: 24px; font-family: system-ui, -apple-system, sans-serif;">
                <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600;">Welcome back!</h1>
                <p style="margin: 0 0 24px;">Click the button below to sign in to your account:</p>
                <a href="{{{url}}}" 
                   style="display: inline-block; padding: 12px 24px; 
                          background: #4F46E5; color: white; 
                          text-decoration: none; border-radius: 6px;">
                  Sign in
                </a>
              </div>
            `
          }
        }
      },
      google: {
        enabled: false,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET
      },
      github: {
        enabled: false,
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET
      }
    },
    registration: {
      enabled: true,
      requireEmailVerification: false,
      codeExpiryMinutes: 10, // Verification code validity period (always 6-digit code)
      // Custom fields users can add (name, company, etc.)
      // Framework handles username, email, password automatically
      customFields: [],
      passwordPolicy: {
        minLength: 8,
        requireNumbers: false,
        requireSymbols: false,
        requireUppercase: false,
        requireLowercase: false
      }
    },
    security: {
      sessionMaxAge: 2592000, // 30 days
      requireEmailVerification: false,
      maxLoginAttempts: 5,
      lockoutDuration: 900000, // 15 minutes
      rateLimit: {
        enabled: true,
        maxAttempts: 5,
        windowMs: 900000 // 15 minutes
      }
    },
    ui: {
      labels: {
        // Page headings
        signIn: "Welcome back",
        signUp: "Create your account",
        signInToContinue: "Enter your credentials to access your account",

        // Form fields
        username: "Username",
        password: "Password",
        name: "Your name",
        email: "Email address",
        newPassword: "New password",
        confirmPassword: "Confirm password",

        // Buttons
        continue: "Sign in",
        register: "Sign up",
        sendResetLink: "Send reset link",
        resetPassword: "Reset password",
        resendVerification: "Resend verification email",

        // Links
        forgotPassword: "Forgot password?",
        dontHaveAccount: "Don't have an account?",
        alreadyHaveAccount: "Already have an account?",
        backToLogin: "Back to login",

        // Social providers
        orContinueWith: "Or continue with",
        continueWithGoogle: "Continue with Google",
        continueWithGithub: "Continue with GitHub",
        continueWithEmail: "Continue with Email",

        // Status messages
        checkYourEmail: "Check your email",
        verifyEmail: "Verify your email",

        // Loading states
        signingIn: "Signing in...",
        creatingAccount: "Creating account...",
        sendingResetLink: "Sending reset link...",
        resettingPassword: "Resetting password...",
        sendingCode: "Sending code...",
        sendCode: "Send code",

        // Placeholders
        emailPlaceholder: "name@example.com",
        passwordPlaceholder: "Enter your password",
        newPasswordPlaceholder: "Enter new password",
        confirmPasswordPlaceholder: "Confirm new password",
        namePlaceholder: "John Doe",

        // Footer
        protectedBy: "Secure authentication"
      },
      // Success/error messages
      messages: {
        loginSuccess: "Welcome back!",
        signupSuccess: "Account created successfully!",
        resetLinkSent: "Check your email for reset instructions",
        passwordReset: "Password updated successfully",
        emailVerified: "Email verified! You can now sign in",
        // Error messages
        invalidCredentials: "Invalid email or password",
        accountLocked: "Account locked due to too many failed attempts",
        emailTaken: "Email already registered",
        weakPassword: "Password doesn't meet requirements"
      },
      brandColor: "#4F46E5",
      terms: {
        text: "By continuing, you agree to our Terms of Service and Privacy Policy",
        links: {
          terms: "/terms",
          privacy: "/privacy"
        }
      },
      showSocialProviders: true,
      showForgotPassword: true,
      protectedByText: "Protected by", // Set to null to hide, or customize the text
      showProtectedBy: true
    },
    urls: {
      signIn: '/auth/login',
      signUp: '/auth/signup',
      signOut: '/auth/logout',
      error: '/auth/error',
      verifyRequest: '/auth/verify-request',
      forgotPassword: '/auth/forgot-password',
      resetPassword: '/auth/reset-password',
      profile: '/auth/profile'
    },
    redirects: {
      afterSignIn: '/',
      afterSignUp: '/',
      afterSignOut: '/',
      afterError: '/auth/login'
    }
  };
// Freeze the shared defaults, deeply. Every request reads this singleton;
// per-site config must be layered on via the pure deepMerge, never written
// here. ESM runs in strict mode, so an accidental mutation throws instead of
// silently bleeding one site's config into every other site in the process.
function deepFreeze(obj) {
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}
deepFreeze(DEFAULT_AUTH_CONFIG);
