'use client';

import { useState, useEffect } from 'react';
import AvailabilityEditor from './AvailabilityEditor.jsx';

const ADDON = '/api/addons/booking-calendar';

/** Settings pane: the host's meeting types, and the editor for the selected one. */
export default function MeetingTypesEditor() {
  const [types, setTypes] = useState(null);
  const [selected, setSelected] = useState(null); // rules object being edited
  const [error, setError] = useState(null);

  useEffect(() => { refresh(); }, []);

  async function refresh(selectId) {
    try {
      const res = await fetch(`${ADDON}/types/list`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      const list = data.types || [];
      setTypes(list);
      const keep = selectId && list.find(x => x.id === selectId);
      setSelected(keep || list[0] || null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function startNew() {
    try {
      // Empty code → blank defaults (hours, timezone, buffers) to fill in.
      const res = await fetch(`${ADDON}/availability/get?meetingType=`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      const { _id, id, ...defaults } = data.rules;
      setSelected({ ...defaults, order: (types?.length || 0) * 10 });
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!types) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {types.map(type => {
          const isSelected = selected?.id === type.id;
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => setSelected(type)}
              className={`px-3 py-1.5 rounded border text-sm ${isSelected ? 'border-foreground' : 'hover:bg-accent'} ${type.active === false ? 'opacity-50' : ''}`}
            >
              {type.name?.es || type.name?.en || type.meetingType}
              <span className="ml-2 text-xs text-muted-foreground">
                /{type.meetingType} · {type.priceCents ? `${type.currency} ${type.priceCents / 100}` : 'free'}
              </span>
            </button>
          );
        })}
        <button type="button" onClick={startNew}
          className="px-3 py-1.5 rounded border border-dashed text-sm hover:bg-accent">
          + New meeting type
        </button>
      </div>

      {types.length === 0 && !selected && (
        <p className="text-sm text-muted-foreground">
          No meeting types yet. Each one gets its own page at /meet/code.
        </p>
      )}

      {selected && (
        <AvailabilityEditor
          key={selected.id || 'new'}
          initialRules={selected}
          onSaved={(rules) => refresh(rules.id)}
          onDeleted={() => refresh()}
        />
      )}
    </div>
  );
}
