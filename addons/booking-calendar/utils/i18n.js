// Strings for the public widgets (Book, MeetingTypes). Spanish is the default.
//
// The page passes `lang`. To follow the visitor's language, pass it as
// { "en": "en", "es": "es" }: the framework's i18n resolves that object server-side
// (accept-language / ?lang=) and the component receives the plain string.

const STRINGS = {
  es: {
    free: 'Gratis',
    minutes: (n) => `${n} min`,
    book: 'Reservar',
    loading: 'Cargando horarios…',
    noSlots: 'No hay horarios libres en estos días.',
    slots: (n) => `${n} ${n === 1 ? 'horario' : 'horarios'}`,
    notFound: 'Este tipo de reunión no existe o no está disponible.',
    calendarUnavailable: 'No pudimos consultar la agenda en este momento. Probá de nuevo en un rato.',
    paymentUnavailable: 'El pago online no está disponible en este momento. Probá de nuevo en un rato.',
    payAndBook: (price) => `Pagar ${price} y reservar`,
    redirecting: 'Te llevamos al pago…',
    checkingPayment: 'Confirmando tu pago…',
    paymentPending: 'Recibimos tu pago. En unos minutos te llega la invitación por mail.',
    paymentRefunded: 'Ese horario se ocupó mientras pagabas. Te devolvimos el pago completo — elegí otro.',
    paymentFailed: 'El pago no se acreditó. El horario quedó libre.',
    paymentAbandoned: 'No se completó el pago, así que el horario quedó libre.',
    slotTaken: 'Ese horario se acaba de ocupar. Elegí otro.',
    genericError: 'Algo falló. Probá de nuevo.',
    booking: (day, time, tz) => `${day} a las ${time} (${tz})`,
    yourName: 'Tu nombre',
    yourEmail: 'tu@email.com',
    subject: 'Asunto — ¿de qué querés hablar?',
    whatsapp: 'WhatsApp (opcional)',
    optional: 'opcional',
    choose: 'Elegí una opción',
    required: (label) => `Falta completar: ${label}`,
    invalidUrl: (label) => `${label}: tiene que ser un link (https://…)`,
    whatsappInvalid: 'Revisá el número de WhatsApp.',
    confirm: 'Confirmar reserva',
    confirming: 'Reservando…',
    nameEmailRequired: 'Nombre, email y asunto son obligatorios.',
    booked: 'Listo, quedó reservado ✓',
    inviteSent: (email) => `Te mandamos la invitación a ${email}.`,
    meetLink: 'Link de Google Meet:',
    needCancel: '¿Necesitás cancelar?',
    useLink: 'Usá este link',
    empty: 'Todavía no hay reuniones disponibles.',
  },
  en: {
    free: 'Free',
    minutes: (n) => `${n} min`,
    book: 'Book',
    loading: 'Loading availability…',
    noSlots: 'No free times on these days.',
    slots: (n) => `${n} ${n === 1 ? 'slot' : 'slots'}`,
    notFound: "This meeting type doesn't exist or isn't available.",
    calendarUnavailable: "We couldn't check the calendar right now. Please try again in a bit.",
    paymentUnavailable: "Online payment isn't available right now. Please try again in a bit.",
    payAndBook: (price) => `Pay ${price} and book`,
    redirecting: 'Taking you to payment…',
    checkingPayment: 'Confirming your payment…',
    paymentPending: "We got your payment. The calendar invite will reach your inbox in a few minutes.",
    paymentRefunded: 'That time was taken while you were paying. We refunded you in full — please pick another.',
    paymentFailed: "The payment didn't go through. The time is free again.",
    paymentAbandoned: "The payment wasn't completed, so the time is free again.",
    slotTaken: 'That time was just taken. Please pick another.',
    genericError: 'Something went wrong. Please try again.',
    booking: (day, time, tz) => `${day} at ${time} (${tz})`,
    yourName: 'Your name',
    yourEmail: 'your@email.com',
    subject: 'Subject — what do you want to talk about?',
    whatsapp: 'WhatsApp (optional)',
    optional: 'optional',
    choose: 'Choose an option',
    required: (label) => `Please fill in: ${label}`,
    invalidUrl: (label) => `${label}: must be a link (https://…)`,
    whatsappInvalid: 'Please check the WhatsApp number.',
    confirm: 'Confirm booking',
    confirming: 'Booking…',
    nameEmailRequired: 'Name, email and subject are required.',
    booked: "You're booked ✓",
    inviteSent: (email) => `A calendar invite has been sent to ${email}.`,
    meetLink: 'Google Meet link:',
    needCancel: 'Need to cancel?',
    useLink: 'Use this link',
    empty: 'No meetings available yet.',
  },
};

export function getStrings(lang) {
  return STRINGS[lang] || STRINGS.es;
}

export function localeFor(lang) {
  return lang === 'en' ? 'en-US' : 'es-AR';
}

/** Pick the visitor's language from a { es, en } field, falling back to whatever exists. */
export function pickLang(value, lang) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[lang] || value.es || value.en || '';
}

export function priceLabel(priceCents, currency, lang) {
  if (!priceCents) return getStrings(lang).free;
  const amount = priceCents / 100;
  const shown = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${currency || 'USD'} ${shown}`;
}
