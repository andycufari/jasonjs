'use client';

import { useState, useEffect } from 'react';
import { getStrings, pickLang, priceLabel } from '../utils/i18n.js';

const ADDON = '/api/addons/booking-calendar';

/**
 * Public list of a host's active meeting types. Each card links to `${basePath}/<code>`,
 * where a page renders <Book meetingType="{{params.slug}}" />.
 *
 *   { "component": "@addons/booking-calendar/MeetingTypes",
 *     "attributes": { "basePath": "/meet", "lang": { "en": "en", "es": "es" } } }
 *
 * userId only when the site has more than one host.
 */
export default function MeetingTypes({
  userId,
  basePath = '/meet',
  lang = 'es',
  brand = {},
  styles = {},
}) {
  const t = getStrings(lang);
  const primary = brand.primaryColor || '#111';
  const [types, setTypes] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // userId is optional: on a single-host site the API resolves the host.
    fetch(`${ADDON}/types/public${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`)
      .then(r => r.json().then(data => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || 'error');
        setTypes(data.types || []);
      })
      .catch(() => setError(t.genericError));
  }, [userId]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!types) return <p className="text-sm text-muted-foreground">…</p>;
  if (types.length === 0) return <p className="text-sm text-muted-foreground">{t.empty}</p>;

  const base = basePath.replace(/\/$/, '');

  return (
    <div className={styles.container || 'space-y-3'}>
      {types.map(type => {
        const meta = [
          priceLabel(type.priceCents, type.currency, lang),
          type.durationMinutes ? t.minutes(type.durationMinutes) : null,
        ].filter(Boolean).join(' · ');
        return (
          <a
            key={type.meetingType}
            href={`${base}/${type.meetingType}`}
            className={styles.card || 'block border rounded-lg p-4 hover:bg-accent transition-colors'}
          >
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-lg font-semibold">{pickLang(type.name, lang)}</h3>
              <span className="text-sm font-medium whitespace-nowrap" style={{ color: primary }}>{meta}</span>
            </div>
            {pickLang(type.description, lang) && (
              <p className="text-sm text-muted-foreground mt-1">{pickLang(type.description, lang)}</p>
            )}
          </a>
        );
      })}
    </div>
  );
}
