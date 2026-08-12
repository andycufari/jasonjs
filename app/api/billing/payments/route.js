// app/api/billing/payments/route.js
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSettings, getSite } from '@/core/sites/files';
import { createAuthOptions } from '@/core/auth/options';
import { getPayments } from '@/core/services/billing/payment';
import { resolveSite } from '@/core/sites/resolve';

/**
 * Get payment history for current user
 * GET /api/billing/payments?limit=10
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const { host: domain } = await resolveSite(request);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);

    // Get auth settings and create auth options
    const authSettings = await getSettings(domain, 'auth');
    const authOptions = await createAuthOptions({ settings: { auth: authSettings } });
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get site configuration to extract siteId
    const site = await getSite(domain);
    const siteId = site?._id?.toString() || site?.siteId || domain;

    // Get payment history from shared billing collection
    const payments = await getPayments(siteId, session.user.id, limit);

    console.log(`[Payments API] siteId=${siteId}, userId=${session.user.id}, found ${payments?.length || 0} payments`);

    // Format payments for client
    const formattedPayments = payments.map(payment => ({
      id: payment.paymentId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      description: payment.description,
      provider: payment.provider,
      createdAt: payment.createdAt || payment.recordedAt,
    }));

    return NextResponse.json({
      payments: formattedPayments,
      total: formattedPayments.length,
    });

  } catch (error) {
    console.error('Get payments error:', error);
    return NextResponse.json({ error: error.message || 'Failed to get payment history' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}
