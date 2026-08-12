'use client';

import { useState, useEffect } from 'react';

const ADDON = '/api/addons/booking-calendar';

export default function ConnectionsList() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [label, setLabel] = useState('Google account');

  useEffect(() => { refresh(); }, []);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${ADDON}/connections/list`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setConnections(data.connections || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function startConnect() {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch(`${ADDON}/google/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim() || 'Google account' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start OAuth');
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setConnecting(false);
    }
  }

  async function disconnect(id) {
    if (!window.confirm('Disconnect this Google account?')) return;
    try {
      const res = await fetch(`${ADDON}/connections/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-end gap-2 mb-4">
        <div className="flex-1">
          <label className="block text-xs text-muted-foreground mb-1">Label for new connection</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g., Andy personal"
            className="w-full p-2 rounded border"
            maxLength={64}
          />
        </div>
        <button
          type="button"
          onClick={startConnect}
          disabled={connecting}
          className="px-4 py-2 rounded bg-foreground text-background font-medium disabled:opacity-50"
        >
          {connecting ? 'Redirecting…' : '+ Connect Google account'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!loading && connections.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No accounts connected yet. Connect at least one Google account to start booking.
        </p>
      )}

      <div className="space-y-2">
        {connections.map(c => (
          <div key={c.id} className="border rounded p-3 flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">{c.label}</div>
              <div className="text-xs text-muted-foreground">
                {c.googleAccountEmail}
                {c.isPrimary && <span className="ml-2 px-1.5 py-0.5 rounded bg-foreground/10">primary</span>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => disconnect(c.id)}
              className="text-xs text-red-600 hover:underline"
            >
              Disconnect
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
