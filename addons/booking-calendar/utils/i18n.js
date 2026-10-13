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
    paymentSoon: 'El pago online todavía no está habilitado para esta reunión.',
    slotTaken: 'Ese horario se acaba de ocupar. Elegí otro.',
    genericError: 'Algo falló. Probá de nuevo.',
    booking: (day, time, tz) => `${day} a las ${time} (${tz})`,
    yourName: 'Tu nombre',
    yourEmail: 'tu@email.com',
    notes: '¿Algo que quieras contarme antes? (opcional)',
    confirm: 'Confirmar reserva',
    confirming: 'Reservando…',
    nameEmailRequired: 'Nombre y email son obligatorios.',
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
    paymentSoon: "Online payment isn't enabled for this meeting yet.",
    slotTaken: 'That time was just taken. Please pick another.',
    genericError: 'Something went wrong. Please try again.',
    booking: (day, time, tz) => `${day} at ${time} (${tz})`,
    yourName: 'Your name',
    yourEmail: 'your@email.com',
    notes: 'Anything you want me to know beforehand? (optional)',
    confirm: 'Confirm booking',
    confirming: 'Booking…',
    nameEmailRequired: 'Name and email are required.',
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
