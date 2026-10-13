// Look of the public widgets (Book, MeetingTypes).
//
// Plain CSS, scoped under .bc, because Tailwind doesn't scan addons/ — a class that no
// other file uses is never generated. Colors come from the site theme's variables
// (--foreground, --card, --border…, with light fallbacks) plus the brand color the page
// passes, so the widget follows whatever theme the site has.

export function brandVars(primary) {
  return { '--bc-primary': primary, '--bc-on-primary': onColor(primary) };
}

/** Black or white, whichever reads better on `hex` (WCAG contrast). */
export function onColor(hex) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || '');
  if (!m) return '#fff';
  const [r, g, b] = m.slice(1).map(h => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? '#000' : '#fff';
}

export const CSS = `
.bc{--bc-fg:hsl(var(--foreground,222 47% 11%));--bc-muted:hsl(var(--muted-foreground,215 16% 47%));
--bc-card:hsl(var(--card,0 0% 100%));--bc-bg:hsl(var(--background,0 0% 100%));--bc-border:hsl(var(--border,214 32% 91%));
--bc-danger:hsl(var(--destructive,0 84% 60%));
--bc-tint:color-mix(in srgb,var(--bc-primary) 14%,transparent);--bc-tint-strong:color-mix(in srgb,var(--bc-primary) 28%,transparent);
color:var(--bc-fg)}
.bc *{box-sizing:border-box}
/* :where() keeps this reset at zero specificity, so .bc-btn & co. can set their color. */
:where(.bc) :where(button,input,select,textarea){font:inherit;color:inherit}
.bc-panel{border:1px solid var(--bc-border);border-radius:16px;background:var(--bc-card);padding:20px}
.bc-muted{color:var(--bc-muted)}
.bc-badge{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;padding:3px 10px;border-radius:999px;background:var(--bc-tint);color:var(--bc-primary);white-space:nowrap}

/* MeetingTypes */
.bc-types{display:grid;gap:12px}
.bc-type{display:block;position:relative;border:1px solid var(--bc-border);border-radius:16px;background:var(--bc-card);padding:20px 52px 20px 20px;text-decoration:none;color:inherit;transition:border-color .15s,background-color .15s,transform .15s}
.bc-type:hover,.bc-type:focus-visible{border-color:var(--bc-primary);background:color-mix(in srgb,var(--bc-primary) 6%,var(--bc-card));transform:translateY(-1px);outline:none}
.bc-type-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px}
.bc-type-name{font-size:20px;font-weight:700;margin:0}
.bc-type-desc{margin:8px 0 0;color:var(--bc-muted);font-size:15px;line-height:1.55}
.bc-type-arrow{position:absolute;right:20px;top:50%;font-size:20px;color:var(--bc-primary);opacity:0;transform:translate(-6px,-50%);transition:opacity .15s,transform .15s}
.bc-type:hover .bc-type-arrow,.bc-type:focus-visible .bc-type-arrow{opacity:1;transform:translate(0,-50%)}

/* Book: header */
.bc-head{margin-bottom:24px}
.bc-title{font-size:28px;font-weight:700;margin:0 0 10px;line-height:1.2}
.bc-badges{display:flex;flex-wrap:wrap;gap:8px}
.bc-desc{margin:12px 0 0;color:var(--bc-muted);line-height:1.6}

/* Book: month + times */
.bc-picker{display:grid;gap:16px}
@media (min-width:720px){.bc-picker{grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)}}
.bc-month-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.bc-month-title{font-weight:700;font-size:17px}
.bc-nav{display:flex;gap:6px}
.bc-icon-btn{width:36px;height:36px;border-radius:10px;border:1px solid var(--bc-border);background:transparent;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:border-color .15s,color .15s}
.bc-icon-btn:hover:not(:disabled){border-color:var(--bc-primary);color:var(--bc-primary)}
.bc-icon-btn:disabled{opacity:.3;cursor:default}
.bc-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
.bc-wd{text-align:center;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--bc-muted);padding-bottom:4px}
.bc-day{position:relative;aspect-ratio:1;border:0;border-radius:10px;background:transparent;font-size:15px;color:var(--bc-muted);opacity:.4;display:flex;align-items:center;justify-content:center}
.bc-day.is-open{opacity:1;background:var(--bc-tint);color:var(--bc-fg);font-weight:700;cursor:pointer;transition:background-color .12s,transform .12s}
.bc-day.is-open:hover{background:var(--bc-tint-strong);transform:scale(1.04)}
.bc-day.is-selected{background:var(--bc-primary);color:var(--bc-on-primary)}
.bc-day.is-selected:hover{background:var(--bc-primary)}
.bc-day.is-today::after{content:'';position:absolute;bottom:6px;left:50%;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:currentColor}
.bc-grid.is-loading .bc-day{animation:bc-pulse 1.1s ease-in-out infinite}
.bc-times-title{font-weight:700;margin:2px 0 14px}
.bc-times{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px}
@media (min-width:720px){.bc-times{grid-template-columns:1fr;max-height:360px;overflow-y:auto;padding-right:4px}}
.bc-time{padding:12px;border-radius:10px;border:1px solid var(--bc-border);background:transparent;font-weight:700;cursor:pointer;transition:border-color .12s,color .12s,background-color .12s}
.bc-time:hover{border-color:var(--bc-primary);color:var(--bc-primary);background:var(--bc-tint)}
.bc-empty{color:var(--bc-muted);font-size:14px;line-height:1.6}
.bc-tz{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:16px;font-size:13px;color:var(--bc-muted)}
.bc-tz select{background:transparent;border:1px solid var(--bc-border);border-radius:8px;padding:4px 6px;max-width:100%}

/* Book: form */
.bc-summary{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:20px}
.bc-summary-when{font-weight:700;font-size:17px}
.bc-form{display:grid;gap:14px}
.bc-row2{display:grid;gap:14px}
@media (min-width:560px){.bc-row2{grid-template-columns:1fr 1fr}}
.bc-field{display:block}
.bc-label{display:block;font-size:13px;color:var(--bc-muted);margin-bottom:6px}
.bc-input{width:100%;padding:12px 14px;border-radius:10px;border:1px solid var(--bc-border);background:var(--bc-bg);transition:border-color .12s,box-shadow .12s}
.bc-input:focus{outline:none;border-color:var(--bc-primary);box-shadow:0 0 0 3px var(--bc-tint)}
textarea.bc-input{resize:vertical;min-height:84px}
.bc-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px 18px;border:0;border-radius:12px;background:var(--bc-primary);color:var(--bc-on-primary);font-weight:700;cursor:pointer;text-decoration:none;transition:filter .12s,transform .12s}
.bc-btn:hover:not(:disabled){filter:brightness(1.08);transform:translateY(-1px)}
.bc-btn:disabled{opacity:.6;cursor:default}
.bc-btn-danger{background:transparent;color:var(--bc-danger);border:1px solid var(--bc-danger)}
.bc-btn-danger:hover:not(:disabled){background:color-mix(in srgb,var(--bc-danger) 12%,transparent);filter:none}
.bc-link{background:none;border:0;padding:0;color:var(--bc-primary);cursor:pointer;text-decoration:underline;text-underline-offset:3px;font-size:14px;white-space:nowrap}
.bc-fine{font-size:13px;color:var(--bc-muted);line-height:1.5;margin:0}
.bc-error{border:1px solid color-mix(in srgb,var(--bc-danger) 50%,transparent);background:color-mix(in srgb,var(--bc-danger) 10%,transparent);color:var(--bc-danger);border-radius:10px;padding:10px 14px;font-size:14px;margin:0 0 14px}
.bc-notice{border:1px solid var(--bc-border);border-radius:12px;padding:12px 16px;margin-bottom:16px;font-size:14px}

/* Book: done */
.bc-panel.bc-done{text-align:center;padding:32px 24px 24px}
.bc-check{width:76px;height:76px;margin:0 auto 18px;border-radius:50%;background:var(--bc-primary);color:var(--bc-on-primary);display:flex;align-items:center;justify-content:center;animation:bc-pop .5s cubic-bezier(.2,1.6,.4,1) both}
.bc-check path{stroke-dasharray:30;stroke-dashoffset:30;animation:bc-draw .4s .3s ease-out forwards}
.bc-done-title{font-size:28px;font-weight:700;margin:0 0 6px;animation:bc-rise .5s .15s both}
.bc-done-sub{color:var(--bc-muted);margin:0 0 22px;animation:bc-rise .5s .25s both}
.bc-details{text-align:left;display:grid;gap:12px;animation:bc-rise .5s .35s both}
.bc-detail{display:flex;gap:12px;align-items:flex-start;line-height:1.5}
.bc-detail-icon{width:22px;flex:none;text-align:center}
.bc-detail strong{display:block}
@keyframes bc-pop{0%{transform:scale(0)}100%{transform:scale(1)}}
@keyframes bc-draw{to{stroke-dashoffset:0}}
@keyframes bc-rise{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:none}}
@keyframes bc-pulse{50%{opacity:.15}}
@media (prefers-reduced-motion:reduce){.bc *{animation:none!important;transition:none!important}.bc-check path{stroke-dashoffset:0}}
`;
