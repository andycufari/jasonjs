/**
 * Billing i18n Translations
 *
 * Supports: en, es-AR, pt-BR
 * Pattern follows auth system translations
 */

export const billingTranslations = {
  en: {
    billing: {
      // Buttons
      subscribe: 'Subscribe',
      subscribeTo: 'Subscribe to {plan}',
      upgrade: 'Upgrade',
      downgrade: 'Downgrade',
      currentPlan: 'Current Plan',
      managePlan: 'Manage Plan',
      cancelSubscription: 'Cancel Subscription',
      keepSubscription: 'Keep Subscription',
      continueToPay: 'Continue to Payment',
      getStarted: 'Get Started',
      free: 'Free',

      // Plan Selection Modal
      selectPlan: 'Select a Plan',
      choosePlan: 'Choose the plan that works for you',
      popular: 'Popular',
      recommended: 'Recommended',
      perMonth: '/month',
      perYear: '/year',
      startingAt: 'Starting at',
      billedMonthly: 'Billed monthly',
      billedYearly: 'Billed yearly',

      // Subscription Status
      activeSubscription: 'Active Subscription',
      noActiveSubscription: 'No active subscription',
      renewsOn: 'Renews on {date}',
      endsOn: 'Ends on {date}',
      cancelingOn: 'Canceling on {date}',
      active: 'Active',
      canceled: 'Canceled',
      pastDue: 'Past Due',
      trialing: 'Trial',

      // Payment
      payNow: 'Pay Now',
      processing: 'Processing...',
      paymentSuccessful: 'Payment successful!',
      paymentCanceled: 'Payment was canceled',
      redirecting: 'Redirecting...',
      redirectingIn: 'Redirecting in {seconds}s...',
      clickHereIfNotRedirected: 'Click here if not redirected',

      // Credits
      buyCredits: 'Buy Credits',
      addCredits: 'Add {amount} Credits',
      credits: 'Credits',

      // History
      paymentHistory: 'Payment History',
      date: 'Date',
      description: 'Description',
      amount: 'Amount',
      status: 'Status',
      succeeded: 'Succeeded',
      pending: 'Pending',
      failed: 'Failed',
      refunded: 'Refunded',
      showingPayments: 'Showing {count} most recent payments',
      noPayments: 'No payments yet',
      loadMore: 'Load More',

      // Features
      includedFeatures: 'Included Features',
      feature: 'Feature',

      // Actions
      viewPlans: 'View Plans',
      manageInStripe: 'Manage Billing',
      viewInvoices: 'View Invoices',
      updatePaymentMethod: 'Update Payment Method',

      // Tabs
      plan: 'Plan',
      history: 'History',
      settings: 'Settings',

      // Confirmation
      confirmCancel: 'Cancel Subscription?',
      confirmCancelMessage: 'Are you sure you want to cancel your subscription?',
      cancelNote: 'You will retain access until the end of your billing period.',
      cancel: 'Cancel',
      confirm: 'Confirm',

      // Errors
      loginRequired: 'Please sign in to continue',
      planNotFound: 'Plan not found',
      paymentFailed: 'Payment failed. Please try again.',
      somethingWentWrong: 'Something went wrong. Please try again.',
      noBillingConfig: 'Billing is not configured for this site',
      billingNotConfigured: 'Billing Not Configured',
      noPlansAvailable: 'No plans available',

      // Success
      subscriptionCanceled: 'Your subscription has been canceled',
      subscriptionUpdated: 'Your subscription has been updated',

      // Loading
      loading: 'Loading...',
      loadingPlans: 'Loading plans...',
      loadingSubscription: 'Loading subscription...',
    }
  },
  'es-AR': {
    billing: {
      // Buttons
      subscribe: 'Suscribirse',
      subscribeTo: 'Suscribirse a {plan}',
      upgrade: 'Mejorar plan',
      downgrade: 'Bajar plan',
      currentPlan: 'Plan Actual',
      managePlan: 'Gestionar Plan',
      cancelSubscription: 'Cancelar Suscripción',
      keepSubscription: 'Mantener Suscripción',
      continueToPay: 'Continuar al Pago',
      getStarted: 'Comenzar',
      free: 'Gratis',

      // Plan Selection Modal
      selectPlan: 'Seleccionar Plan',
      choosePlan: 'Elige el plan que mejor se adapte a ti',
      popular: 'Popular',
      recommended: 'Recomendado',
      perMonth: '/mes',
      perYear: '/año',
      startingAt: 'Desde',
      billedMonthly: 'Facturado mensualmente',
      billedYearly: 'Facturado anualmente',

      // Subscription Status
      activeSubscription: 'Suscripción Activa',
      noActiveSubscription: 'Sin suscripción activa',
      renewsOn: 'Se renueva el {date}',
      endsOn: 'Finaliza el {date}',
      cancelingOn: 'Se cancela el {date}',
      active: 'Activa',
      canceled: 'Cancelada',
      pastDue: 'Vencida',
      trialing: 'Prueba',

      // Payment
      payNow: 'Pagar Ahora',
      processing: 'Procesando...',
      paymentSuccessful: '¡Pago exitoso!',
      paymentCanceled: 'El pago fue cancelado',
      redirecting: 'Redirigiendo...',
      redirectingIn: 'Redirigiendo en {seconds}s...',
      clickHereIfNotRedirected: 'Haz clic aquí si no eres redirigido',

      // Credits
      buyCredits: 'Comprar Créditos',
      addCredits: 'Agregar {amount} Créditos',
      credits: 'Créditos',

      // History
      paymentHistory: 'Historial de Pagos',
      date: 'Fecha',
      description: 'Descripción',
      amount: 'Monto',
      status: 'Estado',
      succeeded: 'Exitoso',
      pending: 'Pendiente',
      failed: 'Fallido',
      refunded: 'Reembolsado',
      showingPayments: 'Mostrando los {count} pagos más recientes',
      noPayments: 'Sin pagos todavía',
      loadMore: 'Cargar Más',

      // Features
      includedFeatures: 'Características Incluidas',
      feature: 'Característica',

      // Actions
      viewPlans: 'Ver Planes',
      manageInStripe: 'Gestionar Facturación',
      viewInvoices: 'Ver Facturas',
      updatePaymentMethod: 'Actualizar Método de Pago',

      // Tabs
      plan: 'Plan',
      history: 'Historial',
      settings: 'Configuración',

      // Confirmation
      confirmCancel: '¿Cancelar Suscripción?',
      confirmCancelMessage: '¿Estás seguro de que deseas cancelar tu suscripción?',
      cancelNote: 'Mantendrás el acceso hasta el final de tu período de facturación.',
      cancel: 'Cancelar',
      confirm: 'Confirmar',

      // Errors
      loginRequired: 'Inicia sesión para continuar',
      planNotFound: 'Plan no encontrado',
      paymentFailed: 'El pago falló. Intenta nuevamente.',
      somethingWentWrong: 'Algo salió mal. Intenta nuevamente.',
      noBillingConfig: 'La facturación no está configurada para este sitio',
      billingNotConfigured: 'Facturación No Configurada',
      noPlansAvailable: 'No hay planes disponibles',

      // Success
      subscriptionCanceled: 'Tu suscripción ha sido cancelada',
      subscriptionUpdated: 'Tu suscripción ha sido actualizada',

      // Loading
      loading: 'Cargando...',
      loadingPlans: 'Cargando planes...',
      loadingSubscription: 'Cargando suscripción...',
    }
  },
  'pt-BR': {
    billing: {
      // Buttons
      subscribe: 'Assinar',
      subscribeTo: 'Assinar {plan}',
      upgrade: 'Fazer upgrade',
      downgrade: 'Fazer downgrade',
      currentPlan: 'Plano Atual',
      managePlan: 'Gerenciar Plano',
      cancelSubscription: 'Cancelar Assinatura',
      keepSubscription: 'Manter Assinatura',
      continueToPay: 'Continuar para Pagamento',
      getStarted: 'Começar',
      free: 'Grátis',

      // Plan Selection Modal
      selectPlan: 'Selecionar Plano',
      choosePlan: 'Escolha o plano ideal para você',
      popular: 'Popular',
      recommended: 'Recomendado',
      perMonth: '/mês',
      perYear: '/ano',
      startingAt: 'A partir de',
      billedMonthly: 'Cobrado mensalmente',
      billedYearly: 'Cobrado anualmente',

      // Subscription Status
      activeSubscription: 'Assinatura Ativa',
      noActiveSubscription: 'Sem assinatura ativa',
      renewsOn: 'Renova em {date}',
      endsOn: 'Termina em {date}',
      cancelingOn: 'Cancela em {date}',
      active: 'Ativa',
      canceled: 'Cancelada',
      pastDue: 'Vencida',
      trialing: 'Teste',

      // Payment
      payNow: 'Pagar Agora',
      processing: 'Processando...',
      paymentSuccessful: 'Pagamento realizado!',
      paymentCanceled: 'Pagamento cancelado',
      redirecting: 'Redirecionando...',
      redirectingIn: 'Redirecionando em {seconds}s...',
      clickHereIfNotRedirected: 'Clique aqui se não for redirecionado',

      // Credits
      buyCredits: 'Comprar Créditos',
      addCredits: 'Adicionar {amount} Créditos',
      credits: 'Créditos',

      // History
      paymentHistory: 'Histórico de Pagamentos',
      date: 'Data',
      description: 'Descrição',
      amount: 'Valor',
      status: 'Status',
      succeeded: 'Sucesso',
      pending: 'Pendente',
      failed: 'Falhou',
      refunded: 'Reembolsado',
      showingPayments: 'Mostrando os {count} pagamentos mais recentes',
      noPayments: 'Nenhum pagamento ainda',
      loadMore: 'Carregar Mais',

      // Features
      includedFeatures: 'Recursos Incluídos',
      feature: 'Recurso',

      // Actions
      viewPlans: 'Ver Planos',
      manageInStripe: 'Gerenciar Cobrança',
      viewInvoices: 'Ver Faturas',
      updatePaymentMethod: 'Atualizar Método de Pagamento',

      // Tabs
      plan: 'Plano',
      history: 'Histórico',
      settings: 'Configurações',

      // Confirmation
      confirmCancel: 'Cancelar Assinatura?',
      confirmCancelMessage: 'Tem certeza que deseja cancelar sua assinatura?',
      cancelNote: 'Você manterá o acesso até o final do período de cobrança.',
      cancel: 'Cancelar',
      confirm: 'Confirmar',

      // Errors
      loginRequired: 'Faça login para continuar',
      planNotFound: 'Plano não encontrado',
      paymentFailed: 'Pagamento falhou. Tente novamente.',
      somethingWentWrong: 'Algo deu errado. Tente novamente.',
      noBillingConfig: 'Cobrança não está configurada para este site',
      billingNotConfigured: 'Cobrança Não Configurada',
      noPlansAvailable: 'Nenhum plano disponível',

      // Success
      subscriptionCanceled: 'Sua assinatura foi cancelada',
      subscriptionUpdated: 'Sua assinatura foi atualizada',

      // Loading
      loading: 'Carregando...',
      loadingPlans: 'Carregando planos...',
      loadingSubscription: 'Carregando assinatura...',
    }
  }
};

/**
 * Get translation by key with optional replacements
 * @param {string} key - Dot-separated key path (e.g., 'billing.subscribe')
 * @param {string} language - Language code (en, es-AR, pt-BR)
 * @param {Object} replacements - Key-value pairs for template replacement
 * @returns {string} Translated string
 */
export function getTranslation(key, language = 'en', replacements = {}) {
  // Get language object, fallback to English
  const lang = billingTranslations[language] || billingTranslations.en;

  // Navigate to the key
  const keys = key.split('.');
  let value = lang;

  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) {
      // Fallback to English if key not found in current language
      value = billingTranslations.en;
      for (const fallbackKey of keys) {
        value = value?.[fallbackKey];
        if (value === undefined) break;
      }
      break;
    }
  }

  // If still not found, return the key itself
  if (value === undefined || typeof value !== 'string') {
    return key;
  }

  // Replace template variables {variable}
  if (Object.keys(replacements).length > 0) {
    return value.replace(/\{(\w+)\}/g, (_, key) =>
      replacements[key] !== undefined ? replacements[key] : `{${key}}`
    );
  }

  return value;
}

/**
 * Shorthand for billing translations
 * @param {string} key - Key without 'billing.' prefix
 * @param {string} language - Language code
 * @param {Object} replacements - Template replacements
 * @returns {string} Translated string
 */
export function t(key, language = 'en', replacements = {}) {
  return getTranslation(`billing.${key}`, language, replacements);
}

/**
 * Create a translation function bound to a specific language
 * @param {string} language - Language code
 * @returns {Function} Translation function
 */
export function createTranslator(language = 'en') {
  return (key, replacements = {}) => t(key, language, replacements);
}

export default billingTranslations;
