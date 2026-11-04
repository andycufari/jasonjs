// Standalone (node tests/unit/cloudfront-signed-url.test.mjs) — no jest needed.
// app.storage.signedUrl through CloudFront: canned-policy signed URL, the signature
// verifies with the public key, the path is encoded per segment, and without the
// env vars it still signs with S3.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
// s3.js reads its config at import time: set dummies first (the presigner signs locally, no network)
process.env.S3_PRIVATE_BUCKET_NAME ||= 'test-private';
process.env.AWS_ACCESS_KEY_ID ||= 'AKIATEST';
process.env.AWS_SECRET_ACCESS_KEY ||= 'secret';
const { signCloudFrontUrl, getPrivateDownloadUrl } = await import('../../core/services/storage/s3.js');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs1', format: 'pem' });
const cf = { domain: 'dtest.cloudfront.net', keyPairId: 'KTEST', privateKey: pem };

// 1. Format, and the signature verifies with the public key
const exp = 2000000000;
const url = signCloudFrontUrl(cf, 'site1/maki/a b+ñ.tar', exp);
const u = new URL(url);
assert.equal(u.origin + u.pathname, 'https://dtest.cloudfront.net/site1/maki/a%20b%2B%C3%B1.tar');
assert.equal(u.searchParams.get('Expires'), String(exp));
assert.equal(u.searchParams.get('Key-Pair-Id'), 'KTEST');
const sig = Buffer.from(u.searchParams.get('Signature').replace(/-/g, '+').replace(/_/g, '=').replace(/~/g, '/'), 'base64');
const policy = JSON.stringify({ Statement: [{ Resource: u.origin + u.pathname, Condition: { DateLessThan: { 'AWS:EpochTime': exp } } }] });
assert.ok(crypto.verify('RSA-SHA1', Buffer.from(policy), publicKey, sig), 'valid signature');
assert.doesNotMatch(u.searchParams.get('Signature'), /[+=/]/, 'CloudFront-flavored base64');

// 2. getPrivateDownloadUrl uses CloudFront when the 3 vars are set (PEM as base64)
process.env.CLOUDFRONT_PRIVATE_DOMAIN = 'https://dtest.cloudfront.net/';
process.env.CLOUDFRONT_KEY_PAIR_ID = 'KTEST';
process.env.CLOUDFRONT_PRIVATE_KEY = Buffer.from(pem).toString('base64');
const r = await getPrivateDownloadUrl('site1', 'maki/x.tar', { expiresIn: 600 });
assert.match(r.url, /^https:\/\/dtest\.cloudfront\.net\/site1\/maki\/x\.tar\?Expires=\d+&Signature=[^&]+&Key-Pair-Id=KTEST$/);
assert.equal(r.key, 'site1/maki/x.tar');
const left = new Date(r.expiresAt).getTime() - Date.now();
assert.ok(left > 590000 && left <= 600000, 'expires in ~10 min');

// 3. A PEM with literal \n (one line in .env) works too
process.env.CLOUDFRONT_PRIVATE_KEY = pem.replace(/\n/g, '\\n');
assert.match((await getPrivateDownloadUrl('site1', 'x.tar')).url, /^https:\/\/dtest\.cloudfront\.net\//);

// 4. The site prefix is still enforced
await assert.rejects(getPrivateDownloadUrl('site1', '../site2/x.tar'), /Invalid file path/);

// 5. A forced filename stays on S3 (CloudFront does not forward response-content-disposition)
const f = await getPrivateDownloadUrl('site1', 'x.dmg', { filename: 'App.dmg' });
assert.match(f.url, /amazonaws\.com\/.*response-content-disposition=/);

// 6. Without the vars → S3, as before
delete process.env.CLOUDFRONT_PRIVATE_DOMAIN;
const s3 = await getPrivateDownloadUrl('site1', 'x.tar');
assert.match(s3.url, /amazonaws\.com\/.*X-Amz-Signature=/);

console.log('cloudfront-signed-url: ok');
