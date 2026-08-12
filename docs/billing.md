# Billing & Payments

Add subscriptions and payments in one line.

## Quick Start

**Add a subscribe button:**

```jsx
'use client';
import { useApp } from '@jasonjs';

function PricingCard() {
  const app = useApp();

  return (
    <button onClick={() => app.billing.subscribe('pro')}>
      Subscribe to Pro - $29/mo
    </button>
  );
}
```

**That's it.** User clicks, gets redirected to Stripe/MercadoPago checkout, and comes back subscribed.

---

## Setup (One-Time)

### 1. Add Stripe/MercadoPago Keys

Create `settings/.env`:

```json
{
  "STRIPE_SECRET_KEY": "sk_live_...",
  "STRIPE_PUBLISHABLE_KEY": "pk_live_...",
  "STRIPE_WEBHOOK_SECRET": "whsec_..."
}
```

Or MercadoPago:

```json
{
  "MERCADOPAGO_ACCESS_TOKEN": "APP-...",
  "MERCADOPAGO_PUBLIC_KEY": "APP-..."
}
```

### 2. Define Plans

Create `settings/billing.json`:

```json
{
  "provider": "stripe",
  "plans": [
    {
      "id": "basic",
      "name": "Basic",
      "priceId": "price_1ABC...",
      "price": 9.99,
      "currency": "usd",
      "interval": "month"
    },
    {
      "id": "pro",
      "name": "Pro",
      "priceId": "price_1XYZ...",
      "price": 29.99,
      "currency": "usd",
      "interval": "month"
    }
  ]
}
```

> 💡 **Tip:** Get `priceId` from your Stripe/MercadoPago dashboard.

### 3. Set Up Webhook

**Stripe:**
- URL: `https://yoursite.com/api/billing/webhook/stripe`
- Events: `customer.subscription.*`, `invoice.*`, `checkout.session.completed`

**MercadoPago:**
- URL: `https://yoursite.com/api/billing/webhook/mercadopago`
- Events: Payment, Subscription

> 📖 Full setup guide: [Setup](#full-setup-guide) below

---

## One-Line Payments

### Subscribe to Plan

```jsx
// Redirect to checkout
await app.billing.subscribe('pro');
```

Opens Stripe/MercadoPago checkout, redirects user, and they're subscribed when they return.

### Check Subscription

```jsx
const subscription = await app.billing.getSubscriptionStatus();

if (subscription?.planId === 'pro') {
  // User has pro plan
}
```

### Require Plan (Feature Gate)

```jsx
async function exportData() {
  // Require pro plan before allowing export
  await app.billing.requirePlan('pro', {
    message: 'Upgrade to Pro to export your data'
  });

  // User has pro plan or just subscribed
  downloadExport();
}
```

**Opens upgrade modal if user doesn't have the plan. Returns immediately if they do.**

### One-Time Payment

```jsx
// Checkout with custom items
await app.billing.checkout([
  { name: "T-Shirt", amount: 2999, quantity: 2 },
  { name: "Hat", amount: 1500, quantity: 1 }
]);
```

Perfect for e-commerce, donations, or any one-time payment.

### Guest Checkout (one-time payment, NO login)

For carts and one-off purchases where the buyer is **not logged in** (e.g. a public
store or rental app). The buyer's email identifies the payer; an `orderId` links the
payment back to your own order so the webhook can mark it paid.

```jsx
// 1) Create your order first (status pending), then start the payment:
const { url } = await app.billing.guestCheckout(
  [{ name: 'Order #PI-123', amount: 1500000, quantity: 1 }], // amount in CENTS (1500000 = $15.000,00)
  {
    email: form.email,       // REQUIRED — buyer email
    orderId: 'PI-123',       // REQUIRED — your order id (used to mark it paid)
    currency: 'ARS',         // optional (MercadoPago defaults to ARS)
    returnUrl: '/confirmation',
    cancelUrl: '/checkout',
  }
);
window.location.href = url;  // redirect the buyer to MercadoPago / Stripe
```

**How the order gets marked paid** — the billing webhook emits a worker event when the
payment resolves. Register a handler in your site's `settings/workers.json`:

```json
{
  "events": {
    "billing:guest_payment_succeeded": "markOrderPaid",
    "billing:guest_payment_failed": "markOrderPaid"
  }
}
```

Your `function/markOrderPaid.js` receives the payment in `app.params`:

```javascript
async function markOrderPaid(app) {
  const { orderId, status, paymentId } = app.params; // status: 'succeeded' | 'failed'
  const orders = app.db.use('orders', true);
  const order = await orders.findOne({ order_number: orderId });
  if (!order) return app.response({ ok: false, reason: 'order not found' });

  await orders.update(order._id, {
    payment_status: status === 'succeeded' ? 'approved' : 'rejected',
    mp_payment_id: paymentId,
  });
  return app.response({ ok: true });
}
```

> **Why this design:** anonymous buyers have no user account, so the payment can't be
> tied to a `userId`. Instead it's tied to your `orderId` via metadata, and the webhook
> notifies your app through the worker-event system. The order is created **before**
> payment, so a failed/abandoned payment still leaves an order your team can follow up on.

> ⚠️ **Amounts are in cents.** `amount: 1500000` means $15.000,00 ARS. The provider divides by 100.

---

## App Methods

### app.billing.subscribe(planId)

Subscribe to a plan. Redirects to checkout.

```jsx
await app.billing.subscribe('pro');
```

**Shortcut for:**
```jsx
const { url } = await app.billing.createCheckoutSession('pro');
window.location.href = url;
```

### app.billing.createCheckoutSession(planId, options)

Create a Stripe Checkout Session directly.

```jsx
const { url } = await app.billing.createCheckoutSession('pro', {
  successUrl: '/billing/success',       // Override default return URL
  cancelUrl: '/pricing',                // Override default cancel URL
  metadata: {                           // Custom data forwarded to Stripe
    device_key: 'abc123',
    referralCode: 'FRIEND10'
  }
});
window.location.href = url;
```

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `successUrl` | `billing.json returnUrl` | Where to redirect after successful payment |
| `cancelUrl` | `billing.json cancelUrl` | Where to redirect if user cancels |
| `metadata` | `{}` | Custom key-value pairs forwarded to Stripe |

**Metadata forwarding:** Your `metadata` is set on both the Stripe Checkout Session and the resulting Subscription object. This means it's available in:
- Webhook events (`checkout.session.completed`, `customer.subscription.created`)
- Worker event handlers (`billing:subscription_created`, `billing:payment_succeeded`) via `params.metadata`

This is useful for linking payments to non-user entities like device keys, external IDs, or referral codes.

### app.billing.requirePlan(planId, options)

Require user to have a plan. Shows upgrade modal if they don't.

```jsx
try {
  await app.billing.requirePlan('pro');
  // User has pro plan, continue
} catch (e) {
  // User cancelled upgrade
}
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `message` | string | Custom upgrade message |
| `allowCancel` | boolean | Allow user to cancel (default: true) |

**Multiple plans (OR logic):**

```jsx
// User needs pro OR enterprise
await app.billing.requirePlan(['pro', 'enterprise']);
```

### app.billing.getSubscriptionStatus()

Get current subscription.

```jsx
const subscription = await app.billing.getSubscriptionStatus();

if (subscription) {
  console.log(subscription.planId);      // 'pro'
  console.log(subscription.status);       // 'active'
  console.log(subscription.features);     // ['feature1', 'feature2']
  console.log(subscription.currentPeriodEnd); // Date
}
```

**Returns `null` if no subscription.**

### app.billing.hasPlan(planId, subscription)

Check if user has a specific plan (client-side helper).

```jsx
const subscription = await app.billing.getSubscriptionStatus();

if (app.billing.hasPlan('pro', subscription)) {
  // User has pro plan
}
```

### app.billing.checkout(items, options)

Create custom checkout with line items.

```jsx
await app.billing.checkout([
  { name: "Product A", amount: 2999, quantity: 2 },
  { name: "Product B", amount: 1500, quantity: 1 }
], {
  currency: 'USD',
  metadata: { orderId: '12345' }
});
```

**Item format:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Item name |
| `amount` | number | Yes | Price in cents (2999 = $29.99) |
| `quantity` | number | No | Quantity (default: 1) |
| `description` | string | No | Item description |

### app.billing.cancelSubscription(options)

Cancel current subscription.

```jsx
// Cancel at period end (keeps access until then)
await app.billing.cancelSubscription({ immediately: false });

// Cancel immediately (loses access now)
await app.billing.cancelSubscription({ immediately: true });
```

### app.billing.getPayments(limit)

Get payment history.

```jsx
const payments = await app.billing.getPayments(10);

payments.forEach(payment => {
  console.log(payment.amount, payment.status, payment.created_at);
});
```

### app.billing.showPlans()

Show pricing modal programmatically.

```jsx
const planId = await app.billing.showPlans();

if (planId) {
  console.log('User selected:', planId);
}
```

**With options:**

```jsx
await app.billing.showPlans({
  highlightPlan: 'pro',
  onSelect: (planId) => console.log('Selected:', planId)
});
```

### app.billing.showBillingModal(options)

Show full billing management modal.

```jsx
// Show plan tab
await app.billing.showBillingModal();

// Show payment history
await app.billing.showBillingModal({ tab: 'history' });
```

**Tabs:** `'plan'`, `'history'`, `'settings'`

### app.billing.formatCurrency(amount, currency)

Format currency for display.

```jsx
app.billing.formatCurrency(2999, 'USD');  // "$29.99"
app.billing.formatCurrency(5000, 'EUR');  // "€50.00"
app.billing.formatCurrency(100, 'ARS');   // "$1,00"
```

---

## Components

**Use `@billing/*` components in JSON pages.**

### @billing/PricingTable

Pricing table with all plans.

```json
{
  "component": "@billing/PricingTable",
  "attributes": {
    "highlightPlan": "pro"
  }
}
```

### @billing/SubscribeButton

Subscribe button for a specific plan.

```json
{
  "component": "@billing/SubscribeButton",
  "attributes": {
    "planId": "pro",
    "buttonText": "Subscribe to Pro"
  }
}
```

### @billing/CustomCheckoutButton

Checkout button with custom items.

```json
{
  "component": "@billing/CustomCheckoutButton",
  "attributes": {
    "items": [
      { "name": "Product", "amount": 2999, "quantity": 1 }
    ],
    "buttonText": "Buy Now"
  }
}
```

### @billing/SubscriptionStatus

Current subscription display.

```json
{
  "component": "@billing/SubscriptionStatus",
  "attributes": {
    "showFeatures": true,
    "showCancelButton": true
  }
}
```

### @billing/PaymentHistory

Payment history table.

```json
{
  "component": "@billing/PaymentHistory",
  "attributes": {
    "limit": 10
  }
}
```

---

## Common Patterns

### Feature Gate

```jsx
function ExportButton() {
  const app = useApp();

  const handleExport = async () => {
    try {
      // Require pro plan
      await app.billing.requirePlan('pro', {
        message: 'Upgrade to Pro to export data'
      });

      // User has pro or just subscribed
      const data = await app.db.use('data').fetch();
      downloadCSV(data);

    } catch (e) {
      // User cancelled
      app.ui.toast('Export requires Pro plan', { type: 'info' });
    }
  };

  return <button onClick={handleExport}>Export Data</button>;
}
```

### Show Plan Status

```jsx
function AccountPage() {
  const app = useApp();
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    app.billing.getSubscriptionStatus().then(setSubscription);
  }, []);

  if (!subscription) {
    return (
      <div>
        <p>No active subscription</p>
        <button onClick={() => app.billing.showPlans()}>
          View Plans
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2>Current Plan: {subscription.planName}</h2>
      <p>Status: {subscription.status}</p>
      <p>Renews: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</p>

      <button onClick={() => app.billing.showBillingModal({ tab: 'history' })}>
        View Payment History
      </button>

      <button onClick={() => app.billing.cancelSubscription()}>
        Cancel Subscription
      </button>
    </div>
  );
}
```

### Shopping Cart

```jsx
function Cart({ items }) {
  const app = useApp();

  const handleCheckout = async () => {
    const checkoutItems = items.map(item => ({
      name: item.name,
      amount: Math.round(item.price * 100), // Convert to cents
      quantity: item.quantity,
      description: item.description
    }));

    await app.billing.checkout(checkoutItems, {
      currency: 'USD',
      metadata: {
        cartId: generateCartId(),
        timestamp: new Date().toISOString()
      }
    });
  };

  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div>
      {items.map(item => (
        <div key={item.id}>
          {item.name} x{item.quantity} - ${item.price}
        </div>
      ))}

      <div>Total: ${total.toFixed(2)}</div>

      <button onClick={handleCheckout}>
        Checkout
      </button>
    </div>
  );
}
```

### Conditional UI

```jsx
function Dashboard() {
  const app = useApp();
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    app.billing.getSubscriptionStatus().then(setSubscription);
  }, []);

  const isPro = app.billing.hasPlan('pro', subscription);
  const isEnterprise = app.billing.hasPlan('enterprise', subscription);

  return (
    <div>
      <h1>Dashboard</h1>

      {/* Basic features - everyone */}
      <BasicStats />

      {/* Pro features */}
      {isPro && <AdvancedAnalytics />}

      {/* Enterprise features */}
      {isEnterprise && <CustomReports />}

      {/* Upgrade prompt */}
      {!isPro && (
        <div className="upgrade-banner">
          <p>Unlock advanced analytics with Pro</p>
          <button onClick={() => app.billing.showPlans({ highlightPlan: 'pro' })}>
            Upgrade to Pro
          </button>
        </div>
      )}
    </div>
  );
}
```

### Donation Button

```jsx
function DonationButton({ amount }) {
  const app = useApp();

  const handleDonate = async () => {
    await app.billing.checkout([
      {
        name: "Donation",
        amount: amount * 100, // Convert to cents
        quantity: 1,
        description: `Thank you for your support!`
      }
    ], {
      currency: 'USD',
      metadata: { type: 'donation' }
    });
  };

  return (
    <button onClick={handleDonate}>
      Donate ${amount}
    </button>
  );
}
```

---

## Billing Events

**Listen to billing events for custom logic:**

```jsx
useEffect(() => {
  // User subscribed
  app.events.on('billing:subscribed', ({ planId, subscription }) => {
    console.log('User subscribed to:', planId);
    app.ui.toast('Welcome to ' + planId + '!', { type: 'success' });
  });

  // User cancelled
  app.events.on('billing:canceled', ({ subscription }) => {
    console.log('Subscription cancelled');
  });

  // Payment succeeded
  app.events.on('billing:paymentSucceeded', ({ payment }) => {
    console.log('Payment received:', payment.amount);
  });

  // Payment failed
  app.events.on('billing:paymentFailed', ({ payment }) => {
    app.ui.toast('Payment failed', { type: 'error' });
  });
}, []);
```

**Available events:**

| Event | Data | Description |
|-------|------|-------------|
| `billing:subscribed` | `{ planId, subscription }` | User subscribed |
| `billing:canceled` | `{ subscription }` | Subscription cancelled |
| `billing:upgraded` | `{ oldPlan, newPlan }` | User upgraded |
| `billing:downgraded` | `{ oldPlan, newPlan }` | User downgraded |
| `billing:paymentSucceeded` | `{ payment }` | Payment completed |
| `billing:paymentFailed` | `{ payment }` | Payment failed |
| `billing:checkoutStarted` | `{ planId, url }` | User redirected to checkout |

---

## Server-Side (Functions)

**Check subscription in functions:**

```javascript
async function protectedEndpoint(app) {
  const { auth, response } = app;

  if (!auth.isAuthenticated) {
    return response({ error: 'Login required' }, 'AUTH');
  }

  // Check if user has pro plan
  const subscriptions = app.db.use('billing_subscriptions', true);
  const subscription = await subscriptions.findOne({
    userId: auth.user.id,
    status: 'active'
  });

  if (!subscription || subscription.planId !== 'pro') {
    return response({ error: 'Pro plan required' }, 'FORBIDDEN');
  }

  // Pro feature logic
  return response({ data: getProData() });
}
```

---

## Full Setup Guide

### Stripe Setup

1. **Create products in Stripe:**
   - Go to Stripe Dashboard → Products
   - Create product (e.g., "Pro Plan")
   - Add pricing ($29/month)
   - Copy the **Price ID** (starts with `price_`)

2. **Get API keys:**
   - Go to Developers → API keys
   - Copy **Publishable key** (starts with `pk_`)
   - Copy **Secret key** (starts with `sk_`)

3. **Set up webhook:**
   - Go to Developers → Webhooks
   - Add endpoint: `https://yoursite.com/api/billing/webhook/stripe`
   - Select events:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
     - `checkout.session.completed`
   - Copy **Signing secret** (starts with `whsec_`)

4. **Add to `settings/.env`:**

```json
{
  "STRIPE_SECRET_KEY": "sk_live_...",
  "STRIPE_PUBLISHABLE_KEY": "pk_live_...",
  "STRIPE_WEBHOOK_SECRET": "whsec_..."
}
```

5. **Create `settings/billing.json`:**

```json
{
  "provider": "stripe",
  "plans": [
    {
      "id": "pro",
      "name": "Pro Plan",
      "priceId": "price_1ABC123...",
      "price": 29.99,
      "currency": "usd",
      "interval": "month",
      "features": [
        "Advanced analytics",
        "Priority support",
        "Custom exports"
      ]
    }
  ]
}
```

### MercadoPago Setup (Latin America)

1. **Create application:**
   - Go to MercadoPago Developer Dashboard
   - Create application
   - Get **Access Token** and **Public Key**

2. **Set up webhook:**
   - Add notification URL: `https://yoursite.com/api/billing/webhook/mercadopago`
   - Select: Payment, Subscription events

3. **Add to `settings/.env`:**

```json
{
  "MERCADOPAGO_ACCESS_TOKEN": "APP-...",
  "MERCADOPAGO_PUBLIC_KEY": "APP-..."
}
```

4. **Create `settings/billing.json`:**

```json
{
  "provider": "mercadopago",
  "plans": [
    {
      "id": "basico",
      "name": "Plan Básico",
      "reason": "Suscripción Plan Básico",
      "autoRecurring": {
        "frequency": 1,
        "frequencyType": "months",
        "transactionAmount": 999,
        "currencyId": "ARS"
      },
      "features": ["Feature 1", "Feature 2"]
    }
  ]
}
```

---

## Database Collections

**Billing system automatically manages:**

### billing_customers

```javascript
{
  id: "auto",
  userId: "user_id",
  provider: "stripe",
  customerId: "cus_xxx",
  email: "user@example.com",
  created_at: Date
}
```

### billing_subscriptions

```javascript
{
  id: "auto",
  userId: "user_id",
  provider: "stripe",
  subscriptionId: "sub_xxx",
  planId: "pro",
  status: "active",
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: false,
  created_at: Date
}
```

### billing_payments

```javascript
{
  id: "auto",
  userId: "user_id",
  provider: "stripe",
  paymentId: "pi_xxx",
  amount: 2999,
  currency: "usd",
  status: "succeeded",
  created_at: Date
}
```

---

## Troubleshooting

### "Webhook not receiving events"

1. Check webhook URL is publicly accessible
2. Verify webhook secret in `.env`
3. Check webhook events are selected correctly
4. Test with Stripe CLI: `stripe listen --forward-to localhost:3000/api/billing/webhook/stripe`

### "Plan not found"

1. Verify `priceId` matches Stripe/MercadoPago
2. Check `settings/billing.json` syntax
3. Restart dev server

### "Payment succeeded but subscription not created"

1. Check webhook is receiving `checkout.session.completed` event
2. Verify database connection
3. Check server logs for errors

### "User redirected but checkout doesn't open"

1. Verify API keys are correct
2. Check browser console for errors
3. Ensure `createCheckoutSession` is awaited

---

## Security

**Billing credentials are server-side only:**

- Secret keys never sent to browser
- Webhook signatures verified
- Customer IDs tied to authenticated users
- Metadata validated server-side

**All billing operations require authentication.**

---

## Why This Pattern?

**No callback hell.** Just `app.billing.subscribe('pro')` and you're done.

**Feature gates in one line.** `await app.billing.requirePlan('pro')` handles everything.

**Works everywhere.** Components, functions, JSON pages - same API.

**Provider-agnostic.** Switch between Stripe and MercadoPago without code changes.

> 💡 **Tip:** Use `app.billing.requirePlan()` for feature gates instead of manual subscription checks. It handles upgrade flows automatically.
