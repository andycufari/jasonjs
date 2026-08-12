'use client';

import React, { useEffect, useRef } from 'react';

// Renders a raw HTML page (type: 'html') inside the framework's RootLayout
// without causing hydration errors.
//
// Strategy:
//   1. Strip outer <!doctype>, <html>, <head>, <body> wrappers.
//   2. Server and client render the SAME inert markup via dangerouslySetInnerHTML
//      so hydration matches exactly.
//   3. After mount, re-inject any <script> tags so they actually execute (React
//      does not run scripts set via innerHTML).
//   4. After mount, copy body attributes (e.g. onload, class, style) onto the
//      real <body>, and run the `onload` handler.

function parseHtmlPage(raw) {
  if (!raw || typeof raw !== 'string') {
    return { bodyInner: '', bodyAttrs: {}, headInner: '' };
  }

  // Extract <body ...>...</body>
  const bodyMatch = raw.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);
  let bodyAttrsRaw = '';
  let bodyInner = raw;

  if (bodyMatch) {
    bodyAttrsRaw = bodyMatch[1] || '';
    bodyInner = bodyMatch[2] || '';

    // Any <script> tags that live AFTER </body> (common pattern in the example
    // page) should also run, so append them to the body content.
    const afterBody = raw.slice(bodyMatch.index + bodyMatch[0].length);
    const trailingScripts = afterBody.match(/<script[\s\S]*?<\/script>/gi);
    if (trailingScripts) {
      bodyInner += '\n' + trailingScripts.join('\n');
    }
  } else {
    // No <body> — strip any doctype/html/head wrappers if present.
    bodyInner = raw
      .replace(/<!doctype[^>]*>/i, '')
      .replace(/<\/?html[^>]*>/gi, '')
      .replace(/<head[\s\S]*?<\/head>/i, '');
  }

  // Extract <head> content so we can inject <style>/<link> tags at runtime.
  const headMatch = raw.match(/<head([^>]*)>([\s\S]*?)<\/head>/i);
  const headInner = headMatch ? headMatch[2] : '';

  // Parse body attributes into a plain object.
  const bodyAttrs = {};
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"([^"]*)"|([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*'([^']*)'|([a-zA-Z_:][-a-zA-Z0-9_:.]*)/g;
  let m;
  while ((m = attrRegex.exec(bodyAttrsRaw)) !== null) {
    const name = (m[1] || m[3] || m[5] || '').toLowerCase();
    const value = m[2] ?? m[4] ?? '';
    if (name) bodyAttrs[name] = value;
  }

  return { bodyInner, bodyAttrs, headInner };
}

export default function HtmlPage({ html }) {
  const containerRef = useRef(null);
  const { bodyInner, bodyAttrs, headInner } = parseHtmlPage(html);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Re-execute inline + external scripts (React skips them via innerHTML).
    const scripts = Array.from(container.querySelectorAll('script'));
    scripts.forEach((old) => {
      const fresh = document.createElement('script');
      for (const attr of old.attributes) fresh.setAttribute(attr.name, attr.value);
      fresh.text = old.textContent || '';
      old.parentNode?.replaceChild(fresh, old);
    });

    // 2. Inject <style> / <link rel="stylesheet"> from <head> into document head.
    const injected = [];
    if (headInner) {
      const tmp = document.createElement('div');
      tmp.innerHTML = headInner;
      tmp.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
        const clone = node.cloneNode(true);
        document.head.appendChild(clone);
        injected.push(clone);
      });
    }

    // 3. Apply body attributes to the real <body>, tracking what we added so we
    // can clean up on unmount.
    const body = document.body;
    const applied = [];
    Object.entries(bodyAttrs).forEach(([name, value]) => {
      if (name === 'onload') return; // handled below
      if (!body.hasAttribute(name)) {
        body.setAttribute(name, value);
        applied.push(name);
      }
    });

    // 4. Run onload handler, matching the browser's legacy body.onload semantics.
    if (bodyAttrs.onload) {
      try {
        // eslint-disable-next-line no-new-func
        new Function(bodyAttrs.onload).call(window);
      } catch (err) {
        console.error('[HtmlPage] onload handler failed:', err);
      }
    }

    return () => {
      applied.forEach((name) => body.removeAttribute(name));
      injected.forEach((node) => node.remove());
    };
  }, [bodyInner, headInner]); // bodyAttrs is derived from html; these cover it

  return (
    <div
      ref={containerRef}
      data-jasonjs-html-page=""
      dangerouslySetInnerHTML={{ __html: bodyInner }}
    />
  );
}
