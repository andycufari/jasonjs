// studio/core/render/getScripts.js
import React from 'react';
import Script from 'next/script';
import GAPageviews from '../../components/system/GAPageviews.jsx';

/**
 * Convert external URL to proxied URL to bypass CSP restrictions
 * @param {string} url - External URL
 * @returns {string} Proxied URL
 */
function proxyUrl(url) {
  // Only proxy external https URLs
  if (url && url.startsWith('https://')) {
    return `/api/proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export function getScripts(scriptsConfig) {
  const scripts = [];

  // Collect exposed scripts for app.scripts bridge
  const exposedScripts = [];

  // Pre-scan custom scripts to collect exposed names
  // expose can be a string "Dos" or array ["Dos", "emulators"]
  if (scriptsConfig.custom) {
    scriptsConfig.custom.forEach((script) => {
      if (script.src && script.expose) {
        if (Array.isArray(script.expose)) {
          exposedScripts.push(...script.expose);
        } else {
          exposedScripts.push(script.expose);
        }
      }
    });
  }

  // Inject the exposed scripts list FIRST so app.scripts.waitFor knows what to expect
  if (exposedScripts.length > 0) {
    scripts.push(
      <script
        key="app-scripts-bridge-config"
        dangerouslySetInnerHTML={{
          __html: `window.__JASONJS_EXPOSED_SCRIPTS__ = ${JSON.stringify(exposedScripts)};`
        }}
      />
    );
  }

  if (scriptsConfig.gtag) {
    // send_page_view is disabled here; GAPageviews fires page_view on every
    // route change (including the initial mount), which is required for
    // Next.js App Router SPA navigation to be tracked correctly.
    scripts.push(
      <script
        key="gtag-script"
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${scriptsConfig.gtag}`}
      />,
      <script
        key="gtag-config"
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${scriptsConfig.gtag}', { send_page_view: false });`
        }}
      />,
      <GAPageviews key="gtag-pageviews" measurementId={scriptsConfig.gtag} />
    );
  }

  if (scriptsConfig.meta_pixels) {
    const pixels = Array.isArray(scriptsConfig.meta_pixels)
      ? scriptsConfig.meta_pixels
      : [scriptsConfig.meta_pixels];

    if (pixels.length > 0) {
      const initCalls = pixels.map((id) => `fbq('init', '${id}');`).join('\n');
      scripts.push(
        <script
          key="meta-pixel-base"
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
${initCalls}
fbq('track', 'PageView');`
          }}
        />
      );

      pixels.forEach((id, index) => {
        scripts.push(
          <noscript
            key={`meta-pixel-noscript-${index}`}
            dangerouslySetInnerHTML={{
              __html: `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1" />`
            }}
          />
        );
      });
    }
  }

  // Add Google Ads conversion events if configured
  if (scriptsConfig.gtagEvent) {
    const events = Array.isArray(scriptsConfig.gtagEvent)
      ? scriptsConfig.gtagEvent
      : [scriptsConfig.gtagEvent];

    events.forEach((event, index) => {
      const { type = 'conversion', ...eventParams } = event;
      scripts.push(
        <script
          key={`gtag-event-${index}`}
          dangerouslySetInnerHTML={{
            __html: `gtag('event', '${type}', ${JSON.stringify(eventParams)});`
          }}
        />
      );
    });
  }

  if (scriptsConfig.mixpanel) {
    scripts.push(
      <script
        key="mixpanel"
        dangerouslySetInnerHTML={{
          __html: `(function(c,a){if(!a.__SV){var b=window;try{var d,m,j,k=b.location,f=k.hash;d=function(a,b){return(m=a.match(RegExp(b+"=([^&]*)")))?m[1]:null};f&&d(f,"state")&&(j=JSON.parse(decodeURIComponent(d(f,"state"))),"mpeditor"===j.action&&(b.sessionStorage.setItem("_mpcehash",f),history.replaceState(j.desiredHash||"",c.title,k.pathname+k.search)))}catch(n){}var l,h;window.mixpanel=a;a._i=[];a.init=function(b,d,g){function c(b,i){var a=i.split(".");2==a.length&&(b=b[a[0]],i=a[1]);b[i]=function(){b.push([i].concat(Array.prototype.slice.call(arguments,0)))}}var e=a;"undefined"!==typeof g?e=a[g]=[]:g="mixpanel";e.people=e.people||[];e.toString=function(b){var a="mixpanel";"mixpanel"!==g&&(a+="."+g);b||(a+=" (stub)");return a};e.people.toString=function(){return e.toString(1)+".people (stub)"};l="disable time_event track track_pageview track_links track_forms track_with_groups add_group set_group remove_group register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_out_tracking start_batch_senders people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove".split(" ");
for(h=0;h<l.length;h++)c(e,l[h]);var f="set set_once union unset remove delete".split(" ");e.get_group=function(){function a(c){b[c]=function(){call2_args=arguments;call2=[c].concat(Array.prototype.slice.call(call2_args,0));e.push([d,call2])}}for(var b={},d=["get_group"].concat(Array.prototype.slice.call(arguments,0)),c=0;c<f.length;c++)a(f[c]);return b};a._i.push([b,d,g])};a.__SV=1.2;b=c.createElement("script");b.type="text/javascript";b.async=!0;b.src="undefined"!==typeof MIXPANEL_CUSTOM_LIB_URL?MIXPANEL_CUSTOM_LIB_URL:"file:"===c.location.protocol&&"//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js".match(/^\\/\\//)?"https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js":"//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";d=c.getElementsByTagName("script")[0];d.parentNode.insertBefore(b,d)}})(document,window.mixpanel||[]);
mixpanel.init('${scriptsConfig.mixpanel}');`
        }}
      />
    );
  }

  // Add more script types here as needed
  if(scriptsConfig.src) {
    scripts.push(
      <Script
        key="custom-script"
        strategy="afterInteractive"
        src={scriptsConfig.src}
      />
    );
  }

  if (scriptsConfig.custom) {
    scriptsConfig.custom.forEach((script, index) => {
      if (script.src) {
        // External script - proxy through our API to bypass CSP unless proxy: false
        // Use proxy: false when the domain is whitelisted in next.config.js CSP
        const scriptSrc = script.proxy === false ? script.src : proxyUrl(script.src);
        scripts.push(
          <script
            key={`custom-script-${index}`}
            async
            src={scriptSrc}
          />
        );
      } else if (script.content) {
        // Inline script
        scripts.push(
          <script
            key={`custom-script-${index}`}
            dangerouslySetInnerHTML={{
              __html: script.content
            }}
          />
        );
      }
    });
  }

  return scripts;
}