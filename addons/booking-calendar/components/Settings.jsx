'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import ConnectionsList from './ConnectionsList.jsx';
import AvailabilityEditor from './AvailabilityEditor.jsx';

/**
 * Host-only settings shell. Gated on session; optional allow-list.
 *
 * Tabs:
 *   - Connections — connect/disconnect Google accounts
 *   - Availability — weekly hours + buffers
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
    { id: 'availability', label: 'Availability' },
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
      {tab === 'availability' && <AvailabilityEditor />}
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

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (bookings.length === 0) return <p className="text-sm text-muted-foreground">No upcoming bookings.</p>;

  return (
    <div className="space-y-2">
      {bookings.map(b => (
        <div key={b.id} className="border rounded p-3 text-sm">
          <div className="font-medium">{b.guestName}</div>
          <div className="text-muted-foreground">{b.guestEmail}</div>
          <div className="mt-1">
            {new Date(b.startUtc).toLocaleString()}
          </div>
          {b.meetLink && (
            <a href={b.meetLink} target="_blank" rel="noopener noreferrer" className="text-xs underline">
              Meet link
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
