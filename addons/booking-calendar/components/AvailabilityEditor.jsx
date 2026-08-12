'use client';

import { useState, useEffect } from 'react';

const ADDON = '/api/addons/booking-calendar';
const DAYS = [
  { key: 'mon', label: 'Mon' }, { key: 'tue', label: 'Tue' }, { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' }, { key: 'fri', label: 'Fri' }, { key: 'sat', label: 'Sat' }, { key: 'sun', label: 'Sun' },
];

export default function AvailabilityEditor() {
  const [rules, setRules] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetch(`${ADDON}/availability/get?meetingType=default`)
      .then(r => r.json().then(data => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || 'Failed to load');
        setRules(data.rules);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function updateField(field, value) {
    setRules(r => ({ ...r, [field]: value }));
    setMessage(null);
  }

  function updateDayRange(day, idx, field, value) {
    setRules(r => {
      const ranges = [...(r.weeklyHours[day] || [])];
      ranges[idx] = { ...ranges[idx], [field]: value };
      return { ...r, weeklyHours: { ...r.weeklyHours, [day]: ranges } };
    });
  }

  function addRange(day) {
    setRules(r => {
      const ranges = [...(r.weeklyHours[day] || []), { start: '09:00', end: '17:00' }];
      return { ...r, weeklyHours: { ...r.weeklyHours, [day]: ranges } };
    });
  }

  function removeRange(day, idx) {
    setRules(r => {
      const ranges = (r.weeklyHours[day] || []).filter((_, i) => i !== idx);
      return { ...r, weeklyHours: { ...r.weeklyHours, [day]: ranges } };
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${ADDON}/availability/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rules),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setRules(data.rules);
      setMessage('Saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!rules) return <p className="text-sm text-red-600">{error || 'Unable to load'}</p>;

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Duration (min)">
          <input type="number" min={5} max={480} value={rules.durationMinutes}
            onChange={(e) => updateField('durationMinutes', parseInt(e.target.value, 10) || 30)}
            className="w-full p-2 rounded border" />
        </Field>
        <Field label="Buffer after (min)">
          <input type="number" min={0} max={240} value={rules.bufferAfterMin}
            onChange={(e) => updateField('bufferAfterMin', parseInt(e.target.value, 10) || 0)}
            className="w-full p-2 rounded border" />
        </Field>
        <Field label="Min notice (hours)">
          <input type="number" min={0} max={8760} value={rules.minNoticeHours}
            onChange={(e) => updateField('minNoticeHours', parseInt(e.target.value, 10) || 0)}
            className="w-full p-2 rounded border" />
        </Field>
        <Field label="Timezone (IANA)">
          <input type="text" value={rules.timezone}
            onChange={(e) => updateField('timezone', e.target.value)}
            placeholder="America/Argentina/Buenos_Aires"
            className="w-full p-2 rounded border" />
        </Field>
      </div>

      <div>
        <h3 className="font-medium mb-2">Weekly hours</h3>
        <div className="space-y-2">
          {DAYS.map(({ key, label }) => (
            <div key={key} className="flex items-start gap-2">
              <div className="w-12 pt-2 text-sm font-medium">{label}</div>
              <div className="flex-1 space-y-1">
                {(rules.weeklyHours[key] || []).length === 0 && (
                  <span className="text-xs text-muted-foreground pt-2 inline-block">Unavailable</span>
                )}
                {(rules.weeklyHours[key] || []).map((r, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input type="time" value={r.start}
                      onChange={(e) => updateDayRange(key, idx, 'start', e.target.value)}
                      className="p-1 rounded border" />
                    <span>→</span>
                    <input type="time" value={r.end}
                      onChange={(e) => updateDayRange(key, idx, 'end', e.target.value)}
                      className="p-1 rounded border" />
                    <button type="button" onClick={() => removeRange(key, idx)}
                      className="text-xs text-red-600 hover:underline">remove</button>
                  </div>
                ))}
                <button type="button" onClick={() => addRange(key)}
                  className="text-xs text-muted-foreground hover:text-foreground">+ add range</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button type="button" onClick={save} disabled={saving}
        className="px-4 py-2 rounded bg-foreground text-background font-medium disabled:opacity-50">
        {saving ? 'Saving…' : 'Save availability'}
      </button>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}
