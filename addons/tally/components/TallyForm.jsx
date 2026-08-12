'use client';

import React, { useEffect, useRef } from 'react';

const TALLY_SCRIPT_SRC = 'https://tally.so/widgets/embed.js';

/**
 * Loads Tally's embed.js once and returns a promise that resolves when ready.
 */
function loadTallyScript() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.Tally) return Promise.resolve();
  if (window.__tallyScriptPromise) return window.__tallyScriptPromise;

  window.__tallyScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${TALLY_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = TALLY_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.body.appendChild(script);
  });

  return window.__tallyScriptPromise;
}

const TallyForm = ({
  formId,
  title = 'Form',
  height = '100vh',
  dynamicHeight = true,
  customHeight,
}) => {
  const iframeRef = useRef(null);

  // Bare embed URL — only `dynamicHeight=1` is passed so Tally's embed.js
  // sends postMessage resize events to grow the iframe to fit the form content.
  // All visual design (theme, background, title, layout) is controlled in the
  // Tally dashboard and inherited as-is — no other query params are added.
  const src = `https://tally.so/embed/${formId}?dynamicHeight=1`;

  useEffect(() => {
    let cancelled = false;

    loadTallyScript()
      .then(() => {
        if (cancelled) return;
        // Tally.loadEmbeds() scans the DOM for iframes with data-tally-src
        // and initializes them (transparent bg, dynamic height, etc).
        if (window.Tally && typeof window.Tally.loadEmbeds === 'function') {
          window.Tally.loadEmbeds();
        } else if (iframeRef.current) {
          // Fallback: set src manually so the form at least loads
          iframeRef.current.src = iframeRef.current.dataset.tallySrc;
        }
      })
      .catch((err) => {
        console.error('[TallyForm] Failed to load Tally embed script:', err);
        if (iframeRef.current) {
          iframeRef.current.src = iframeRef.current.dataset.tallySrc;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  // For dynamic height, start with a pixel value — Tally's embed.js rewrites
  // the iframe's `height` attribute via postMessage as the form content loads,
  // and it needs a concrete starting value (not `100%`) to resize from.
  const frameHeight = customHeight || (dynamicHeight ? '284' : height);

  return (
    <div className="w-full" style={{ minHeight: dynamicHeight ? undefined : height }}>
      <iframe
        ref={iframeRef}
        data-tally-src={src}
        width="100%"
        height={frameHeight}
        frameBorder="0"
        marginHeight="0"
        marginWidth="0"
        title={title}
        style={{ border: 'none', display: 'block' }}
        allow="camera;microphone;geolocation"
      />
    </div>
  );
};

export default TallyForm;
