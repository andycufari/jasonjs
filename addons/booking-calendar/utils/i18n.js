// Strings for the public widgets (Book, MeetingTypes). Spanish is the default.
//
// The page passes `lang`. To follow the visitor's language, pass it as
// { "en": "en", "es": "es" }: the framework's i18n resolves that object server-side
// (accept-language / ?lang=) and the component receives the plain string.

const STRINGS = {
  es: {
    free: 'Gratis',
    minutes: (n) => `${n} min`,
    loading: 'Cargando…',
    prevMonth: 'Mes anterior',
    nextMonth: 'Mes siguiente',
    pickDay: 'Elegí un día para ver los horarios.',
    noSlotsMonth: 'No quedan horarios libres este mes.',
    noSlotsAhead: 'No hay horarios libres por ahora.',
    timesIn: 'Horarios en',
    notFound: 'Este tipo de reunión no existe o no está disponible.',
    calendarUnavailable: 'No pudimos consultar la agenda en este momento. Probá de nuevo en un rato.',
    paymentUnavailable: 'El pago online no está disponible en este momento. Probá de nuevo en un rato.',
    payAndBook: (price) => `Pagar ${price} y reservar`,
    payWithCard: (price) => `Pagar con tarjeta · ${price}`,
    payWithMp: (price) => `Pagar con Mercado Pago · ${price}`,
    redirecting: 'Te llevamos al pago…',
    checkingPayment: 'Confirmando tu pago…',
    paymentPending: 'Recibimos tu pago. En unos minutos te llega la invitación por mail.',
    paymentRefunded: 'Ese horario se ocupó mientras pagabas. Te devolvimos el pago completo — elegí otro.',
    paymentFailed: 'El pago no se acreditó. El horario quedó libre.',
    paymentAbandoned: 'No se completó el pago, así que el horario quedó libre.',
    slotTaken: 'Ese horario se acaba de ocupar. Elegí otro.',
    genericError: 'Algo falló. Probá de nuevo.',
    change: 'Cambiar',
    name: 'Nombre',
    email: 'Email',
    subject: 'Asunto',
    subjectPlaceholder: '¿De qué querés hablar?',
    whatsapp: 'WhatsApp',
    optional: 'opcional',
    choose: 'Elegí una opción',
    required: (label) => `Falta completar: ${label}`,
    invalidUrl: (label) => `${label}: tiene que ser un link (https://…)`,
    whatsappInvalid: 'Revisá el número de WhatsApp.',
    nameEmailRequired: 'Nombre, email y asunto son obligatorios.',
    confirm: 'Confirmar reserva',
    confirming: 'Reservando…',
    freeFine: 'Te llega la invitación de Google Calendar con el link de Meet.',
    paidFine: 'Pagás con tarjeta en Stripe. El horario queda reservado mientras pagás.',
    paidFineMp: 'Pagás en Mercado Pago. El horario queda reservado mientras pagás.',
    paidFineBoth: 'Tarjeta en dólares (Stripe) o pesos con Mercado Pago. El horario queda reservado mientras pagás.',
    doneTitle: (name) => name ? `¡Listo, ${name}!` : '¡Listo!',
    doneSub: 'Quedó reservado. Nos vemos.',
    inviteIn: (email) => email ? `La invitación de Google Calendar está en ${email}.` : 'La invitación de Google Calendar está en tu mail.',
    joinMeet: 'Entrar a Google Meet',
    cantMakeIt: '¿Al final no podés?',
    cancelMeeting: 'Cancelar la reunión',
    cancelInInvite: 'Si al final no podés, el link para cancelar está en la invitación.',
    cancelTitle: '¿Cancelamos la reunión?',
    cancelConfirm: 'Sí, cancelar',
    cancelReason: 'Motivo',
    cancelReasonPlaceholder: '¿Por qué no podés? Llega junto con el aviso.',
    reasonRequired: 'Contanos el motivo para cancelar.',
    cancelling: 'Cancelando…',
    keep: 'No, la mantengo',
    cancelPaid: (price) => `Pagaste ${price}. La devolución no es automática: te escribimos para resolverla.`,
    cancelledTitle: 'Reunión cancelada',
    cancelledSub: 'Ya le avisamos. Google Calendar te manda la cancelación.',
    rebook: 'Elegir otro horario',
    keptTitle: 'Perfecto, la reunión sigue en pie.',
    cancelMissing: 'Este link de cancelación no es válido.',
    cancelAlready: 'Esta reunión ya estaba cancelada.',
    cancelPast: 'Esta reunión ya empezó o ya pasó, así que no se puede cancelar.',
    empty: 'Todavía no hay reuniones disponibles.',
  },
  en: {
    free: 'Free',
    minutes: (n) => `${n} min`,
    loading: 'Loading…',
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    pickDay: 'Pick a day to see the times.',
    noSlotsMonth: 'No free times left this month.',
    noSlotsAhead: 'No free times right now.',
    timesIn: 'Times in',
    notFound: "This meeting type doesn't exist or isn't available.",
    calendarUnavailable: "We couldn't check the calendar right now. Please try again in a bit.",
    paymentUnavailable: "Online payment isn't available right now. Please try again in a bit.",
    payAndBook: (price) => `Pay ${price} and book`,
    payWithCard: (price) => `Pay by card · ${price}`,
    payWithMp: (price) => `Pay with Mercado Pago · ${price}`,
    redirecting: 'Taking you to payment…',
    checkingPayment: 'Confirming your payment…',
    paymentPending: "We got your payment. The calendar invite will reach your inbox in a few minutes.",
    paymentRefunded: 'That time was taken while you were paying. We refunded you in full — please pick another.',
    paymentFailed: "The payment didn't go through. The time is free again.",
    paymentAbandoned: "The payment wasn't completed, so the time is free again.",
    slotTaken: 'That time was just taken. Please pick another.',
    genericError: 'Something went wrong. Please try again.',
    change: 'Change',
    name: 'Name',
    email: 'Email',
    subject: 'Subject',
    subjectPlaceholder: 'What do you want to talk about?',
    whatsapp: 'WhatsApp',
    optional: 'optional',
    choose: 'Choose an option',
    required: (label) => `Please fill in: ${label}`,
    invalidUrl: (label) => `${label}: must be a link (https://…)`,
    whatsappInvalid: 'Please check the WhatsApp number.',
    nameEmailRequired: 'Name, email and subject are required.',
    confirm: 'Confirm booking',
    confirming: 'Booking…',
    freeFine: "You'll get a Google Calendar invite with the Meet link.",
    paidFine: 'You pay by card on Stripe. The time is held for you while you pay.',
    paidFineMp: 'You pay on Mercado Pago. The time is held for you while you pay.',
    paidFineBoth: 'Card in US dollars (Stripe) or Argentine pesos with Mercado Pago. The time is held for you while you pay.',
    doneTitle: (name) => name ? `You're booked, ${name}!` : "You're booked!",
    doneSub: 'All set. See you then.',
    inviteIn: (email) => email ? `The Google Calendar invite is in ${email}.` : 'The Google Calendar invite is in your inbox.',
    joinMeet: 'Join Google Meet',
    cantMakeIt: "Can't make it after all?",
    cancelMeeting: 'Cancel the meeting',
    cancelInInvite: "If you can't make it, the cancel link is in the invite.",
    cancelTitle: 'Cancel this meeting?',
    cancelConfirm: 'Yes, cancel it',
    cancelReason: 'Reason',
    cancelReasonPlaceholder: "Why can't you make it? It's sent along with the notice.",
    reasonRequired: 'Please tell us why you are cancelling.',
    cancelling: 'Cancelling…',
    keep: 'No, keep it',
    cancelPaid: (price) => `You paid ${price}. Refunds aren't automatic: we'll write to you to sort it out.`,
    cancelledTitle: 'Meeting cancelled',
    cancelledSub: "We've let them know. Google Calendar will send you the cancellation.",
    rebook: 'Pick another time',
    keptTitle: 'Great — the meeting is still on.',
    cancelMissing: "This cancellation link isn't valid.",
    cancelAlready: 'This meeting was already cancelled.',
    cancelPast: 'This meeting has already started or passed, so it can no longer be cancelled.',
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
  const shown = (priceCents / 100).toLocaleString(lang === 'en' ? 'en-US' : 'es-AR', { maximumFractionDigits: 2 });
  return `${currency || 'USD'} ${shown}`;
}

/** Every price a type is sold at: "USD 79 · ARS 79.000", or "Gratis". */
export function typePriceLabel(type, lang) {
  const parts = [
    type?.priceCents ? priceLabel(type.priceCents, type.currency, lang) : null,
    type?.priceArsCents ? priceLabel(type.priceArsCents, 'ARS', lang) : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : getStrings(lang).free;
}
