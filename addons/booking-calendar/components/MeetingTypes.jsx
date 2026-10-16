'use client';

import { useState, useEffect } from 'react';
import { getStrings, pickLang, typePriceLabel } from '../utils/i18n.js';
import { CSS, brandVars } from '../utils/ui.js';

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

  const base = basePath.replace(/\/$/, '');

  let body;
  if (error) body = <p className="bc-error">{error}</p>;
  else if (!types) body = <p className="bc-empty">{t.loading}</p>;
  else if (types.length === 0) body = <p className="bc-empty">{t.empty}</p>;
  else {
    body = (
      <div className="bc-types">
        {types.map(type => (
          <a key={type.meetingType} href={`${base}/${type.meetingType}`} className="bc-type">
            <div className="bc-type-head">
              <h3 className="bc-type-name">{pickLang(type.name, lang)}</h3>
              <div className="bc-badges">
                <span className="bc-badge">{typePriceLabel(type, lang)}</span>
                {type.durationMinutes ? <span className="bc-badge">⏱ {t.minutes(type.durationMinutes)}</span> : null}
              </div>
            </div>
            {pickLang(type.description, lang) && (
              <p className="bc-type-desc">{pickLang(type.description, lang)}</p>
            )}
            <span className="bc-type-arrow" aria-hidden="true">→</span>
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="bc" style={brandVars(primary)}>
      {/* Raw: React would escape the quotes in the CSS when rendering on the server. */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {body}
    </div>
  );
}
