// app/api/billing/test-checkout/route.js
// Checkout page for app.billing.checkout({ provider: 'test' }) — see core/services/billing/testCheckout.js.
//   GET  ?t=<token>        the page: item, total, "Pay (simulated)" / "Decline"
//   POST t, action         runs the site's onPaid handler like a webhook would, then goes to returnUrl
// Admin session required on both, on top of the signed token: the token alone never marks anything paid.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSettings } from '@/core/sites/files';
import { createAuthOptions } from '@/core/auth/options';
import { resolveSite } from '@/core/sites/resolve';
import { verifyTestCheckout, simulatedPayment, testCheckoutPage } from '@/core/services/billing/testCheckout';
import { runFunctionBillingHook } from '@/core/services/billing/functionHook';

function html(body, status = 200) {
  return new NextResponse(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function check(request, token) {
  const { host: domain } = await resolveSite(request);
  const data = verifyTestCheckout(token);
  if (!data || data.domain !== domain) return { error: html('<p>This test checkout is invalid or expired.</p>', 404) };

  const authSettings = await getSettings(domain, 'auth');
  const session = await getServerSession(await createAuthOptions({ settings: { auth: authSettings } }));
  const roles = session?.user?.roles || [session?.user?.role].filter(Boolean);
  if (!roles.includes('admin')) return { error: html('<p>Test checkouts are for admins. Log in as an admin of this site.</p>', 403) };
  return { data };
}

export async function GET(request) {
  const token = new URL(request.url).searchParams.get('t');
  const { data, error } = await check(request, token);
  if (error) return error;
  return html(testCheckoutPage(data, token));
}

export async function POST(request) {
  const form = await request.formData();
  const token = String(form.get('t') || '');
  const { data, error } = await check(request, token);
  if (error) return error;

  const paid = form.get('action') === 'pay';
  try {
    await runFunctionBillingHook({
      functionName: data.functionName,
      hook: paid ? 'onPaymentSucceeded' : 'onPaymentFailed',
      siteId: data.siteId,
      domain: data.domain,
      payload: { payment: simulatedPayment(data, paid ? 'succeeded' : 'failed'), provider: 'test' },
    });
  } catch (err) {
    // A real provider would retry; here the developer sees why the handler failed.
    return html(testCheckoutPage(data, token, { error: `The handler failed: ${err.message}` }), 500);
  }
  return NextResponse.redirect(data.returnUrl, 303);
}
