// /studio/core/assets/assetUrl.js

const PUBLIC_URL = process.env.PUBLIC_URL;

export function parseAssetUrl(url) {
  return url.replace('SS_PUBLIC_URL', PUBLIC_URL);
}