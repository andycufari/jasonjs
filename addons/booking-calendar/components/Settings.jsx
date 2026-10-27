'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import ConnectionsList from './ConnectionsList.jsx';
import MeetingTypesEditor from './MeetingTypesEditor.jsx';

/**
 * Host-only settings shell. Gated on session; optional allow-list.
 *
 * Tabs:
 *   - Connections — connect/disconnect Google accounts
 *   - Meeting types — each with its page, price, duration and weekly hours
 *   - Bookings — upcoming bookings list
 */
export default function Settings({ allowedEmails = null }) {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState('connections');
  const [flashMsg, setFlashMsg] = useState(null);

  // Surface OAuth callback outcomes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1') {
      setFlashMsg({ type: 'ok', text: 'Google account connected.' });
    } else if (params.get('error')) {
      setFlashMsg({ type: 'err', text: `Connection failed: ${params.get('error')}` });
    }
    if (params.get('connected') || params.get('error')) {
      const clean = new URL(window.location.href);
      clean.searchParams.delete('connected');
      clean.searchParams.delete('error');
      window.history.replaceState({}, '', clean.toString());
    }
  }, []);

  if (status === 'loading') {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!session?.user) {
    return <p className="text-sm text-muted-foreground">Please sign in to configure the booking calendar.</p>;
  }
  if (Array.isArray(allowedEmails) && allowedEmails.length > 0) {
    if (!allowedEmails.includes(session.user.email)) {
      return <p className="text-sm text-red-600">You don&apos;t have access to this settings page.</p>;
    }
  }

  const tabs = [
    { id: 'connections', label: 'Connections' },
    { id: 'availability', label: 'Meeting types' },
    { id: 'bookings', label: 'Bookings' },
  ];

  return (
    <div>
      {flashMsg && (
        <div className={`mb-4 p-3 rounded text-sm ${flashMsg.type === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {flashMsg.text}
        </div>
      )}

      <div className="flex border-b mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.id
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'connections' && <ConnectionsList />}
      {tab === 'availability' && <MeetingTypesEditor />}
      {tab === 'bookings' && <BookingsPane />}
    </div>
  );
}

function BookingsPane() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/addons/booking-calendar/bookings/list?status=confirmed')
      .then(r => r.json().then(data => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) { setError(data.error || 'Failed to load'); return; }
        setBookings(data.bookings || []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Host cancel: the cancel endpoint deletes the Google event (Google emails the guest) and
  // marks the row cancelled. The reason is stored, not sent — write to the guest yourself.
  const [cancelling, setCancelling] = useState(null); // booking id with the form open
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const cancelBooking = async (id) => {
    setBusy(true);
    try {
      const r = await fetch('/api/addons/booking-calendar/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, reason }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.error === 'already_started' ? 'That booking already started.' : (data.error || 'Cancel failed'));
        return;
      }
      setBookings(list => list.filter(b => b.id !== id));
      setCancelling(null);
      setReason('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (bookings.length === 0) return <p className="text-sm text-muted-foreground">No upcoming bookings.</p>;

  return (
    <div className="space-y-2">
      {bookings.map(b => (
        <div key={b.id} className="border rounded p-3 text-sm space-y-1">
          <div className="flex items-baseline justify-between gap-4">
            <div className="font-medium">{b.subject || b.guestName}</div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              /{b.meetingType}{b.amountCents ? ` · ${b.currency} ${b.amountCents / 100}` : ''}
            </div>
          </div>
          <div className="text-muted-foreground">
            {b.guestName} · {b.guestEmail}{b.whatsapp ? ` · WhatsApp ${b.whatsapp}` : ''}
          </div>
          <div>{new Date(b.startUtc).toLocaleString()}</div>
          {(b.answers || []).map(a => (
            <div key={a.key} className="text-xs">
              <span className="text-muted-foreground">{a.label}:</span> {a.value}
            </div>
          ))}
          <div className="flex gap-4 text-xs">
            {b.meetLink && (
              <a href={b.meetLink} target="_blank" rel="noopener noreferrer" className="underline">
                Meet link
              </a>
            )}
            {cancelling !== b.id && (
              <button type="button" className="underline text-red-600" onClick={() => { setCancelling(b.id); setReason(''); }}>
                Cancel booking
              </button>
            )}
          </div>
          {cancelling === b.id && (
            <div className="space-y-2 pt-2">
              <textarea
                className="w-full border rounded p-2 text-sm bg-transparent"
                rows={2}
                placeholder="Reason (optional, saved with the booking — not sent to the guest)"
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The Google event is deleted and Google emails {b.guestEmail} a cancellation.
              </p>
              <div className="flex gap-2">
                <button type="button" disabled={busy} className="border rounded px-3 py-1 text-xs text-red-600 disabled:opacity-50" onClick={() => cancelBooking(b.id)}>
                  {busy ? 'Cancelling…' : 'Confirm cancel'}
                </button>
                <button type="button" disabled={busy} className="border rounded px-3 py-1 text-xs" onClick={() => setCancelling(null)}>
                  Keep it
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
