---
skill: billing
when: "Adding payments, subscriptions, feature gating"
requires: []
---

# Billing

> Stripe/MercadoPago integration, subscriptions, feature gating, payment modals.

## Quick Start

```jsx
// Feature gating (like app.auth.requireLogin)
const handleExport = async () => {
  try {
    await app.billing.requirePlan('pro');
    // User has pro - continue
    doExport();
  } catch (e) {
    // User cancelled upgrade
  }
};

// Quick access check
if (await app.billing.canAccess('pro')) {
  showProFeature();
} else {
  showUpgradeButton();
}

// One-liner subscribe (handles auth + checkout)
await app.billing.subscribe('pro');
```

## Configuration

`settings/billing.json`:

```json
{
  "provider": "stripe",
  "stripe": {
    "secretKey": "[[env.STRIPE_SECRET_KEY]]",
    "publishableKey": "[[env.STRIPE_PUBLISHABLE_KEY]]",
    "webhookSecret": "[[env.STRIPE_WEBHOOK_SECRET]]",
    "plans": [
      {
        "id": "basic",
        "name": "Basic",
        "priceId": "price_xxx",
        "price": 9.99,
        "currency": "usd",
        "interval": "month",
        "features": ["5 Projects", "Basic Support"]
      },
      {
        "id": "pro",
        "name": "Pro",
        "priceId": "price_yyy",
        "price": 29.99,
        "currency": "usd",
        "interval": "month",
        "popular": true,
        "features": ["Unlimited Projects", "Priority Support", "API Access"]
      }
    ],
    "returnUrl": "/billing/success",
    "cancelUrl": "/billing/canceled"
  }
}
```

Environment variables in `settings/.env.json`:

```json
{
  "STRIPE_SECRET_KEY": "sk_live_...",
  "STRIPE_PUBLISHABLE_KEY": "pk_live_...",
  "STRIPE_WEBHOOK_SECRET": "whsec_..."
}
```

## Programmatic API

### Show Plan Selection

```jsx
// Returns selected planId or null
const planId = await app.billing.showPlans();

// With options
await app.billing.showPlans({
  highlightPlan: 'pro',
  onSelect: (planId) => console.log('Selected:', planId)
});
```

### Show Billing Modal

```jsx
// Full billing management
await app.billing.showBillingModal();

// Open specific tab
await app.billing.showBillingModal({ tab: 'history' });
await app.billing.showBillingModal({ tab: 'settings' });
```

### Feature Gating

```jsx
// Like app.auth.requireLogin() but for plans
async function exportData() {
  try {
    await app.billing.requirePlan('pro');
    performExport();
  } catch (e) {
    // User cancelled
  }
}

// Multiple plans (any of these)
await app.billing.requirePlan(['pro', 'enterprise']);

// Custom message
await app.billing.requirePlan('pro', {
  message: 'Upgrade to Pro to export data'
});
```

### Quick Access Check

```jsx
// Non-blocking check
if (await app.billing.canAccess('pro')) {
  showProFeature();
} else {
  showUpgradeButton();
}
```

### Direct Subscription

```jsx
// Handles: auth check → checkout → redirect
await app.billing.subscribe('pro');
```

### Low-Level API

```jsx
// Create checkout session
const { url } = await app.billing.createCheckoutSession('pro', {
  successUrl: '/billing/success',
  cancelUrl: '/pricing',
  metadata: { device_key: 'abc123', campaign: 'summer' }
});
window.location.href = url;

// Get subscription status
const subscription = await app.billing.getSubscriptionStatus();

// Cancel subscription
await app.billing.cancelSubscription({ immediately: false });

// Get payment history
const payments = await app.billing.getPayments(20);

// Format currency
app.billing.formatCurrency(2999, 'USD'); // "$29.99"
```

### createCheckoutSession Options

| Option | Default | Description |
|--------|---------|-------------|
| `successUrl` | `billing.json returnUrl` | Redirect path after successful payment |
| `cancelUrl` | `billing.json cancelUrl` | Redirect path if user cancels |
| `metadata` | `{}` | Custom key-value pairs forwarded to Stripe session + subscription. Available in `billing:*` worker event payloads via `params.metadata` |

> Metadata is copied to both the Stripe checkout session and the subscription object. Use it to link payments to non-user entities (device keys, referral codes, external IDs).

## Components

### PricingTable

```jsx
<PricingTable />

<PricingTable
  highlightPlan="pro"
  showInterval={true}
  onSubscribe={(planId) => console.log(planId)}
/>
```

JSON Page:
```json
{
  "component": "@framework/billing/PricingTable",
  "attributes": { "highlightPlan": "pro" }
}
```

### SubscriptionStatus

```jsx
<SubscriptionStatus
  showFeatures={true}
  showCancelButton={true}
  showUpgradeButton={true}
/>
```

### PaymentHistory

```jsx
<PaymentHistory limit={20} />
```

### SubscribeButton

```jsx
// Direct subscribe to plan
<SubscribeButton planId="pro" />

// Opens plan selection modal
<SubscribeButton buttonText="Upgrade" />
```

### BillingReturn

For success/cancel pages:

```json
{
  "component": "@framework/billing/BillingReturn",
  "attributes": {
    "type": "success",
    "redirectUrl": "/dashboard"
  }
}
```

## Billing Events

```jsx
// Track conversions
app.events.on('billing:subscribed', ({ planId, subscription }) => {
  analytics.track('purchase', { plan: planId });
});

app.events.on('billing:canceled', ({ subscription }) => {
  showFeedbackSurvey();
});

app.events.on('billing:paymentSucceeded', ({ amount }) => {
  console.log('Payment received');
});
```

| Event | Data |
|-------|------|
| `billing:subscribed` | `{ planId, subscription }` |
| `billing:canceled` | `{ subscription }` |
| `billing:upgraded` | `{ fromPlan, toPlan }` |
| `billing:downgraded` | `{ fromPlan, toPlan }` |
| `billing:paymentSucceeded` | `{ amount, currency }` |
| `billing:paymentFailed` | `{ error }` |
| `billing:checkoutStarted` | `{ planId, url }` |

## Feature Gate Component

```jsx
const ProFeature = ({ children }) => {
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    app.billing.canAccess('pro').then(setHasAccess);
  }, []);

  if (!hasAccess) {
    return (
      <div className="relative">
        <div className="opacity-50 pointer-events-none">{children}</div>
        <button
          onClick={() => app.billing.requirePlan('pro')}
          className="absolute inset-0 flex items-center justify-center"
        >
          Upgrade to Pro
        </button>
      </div>
    );
  }

  return children;
};
```

## Webhooks

Configure webhooks in Stripe dashboard:

**URL:** `https://yourdomain.com/api/billing/webhook/stripe`

**Events to enable:**
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `checkout.session.completed`

## API Reference

| Method | Description |
|--------|-------------|
| `app.billing.showPlans(opts)` | Show plan selection modal |
| `app.billing.showBillingModal(opts)` | Show full billing modal |
| `app.billing.requirePlan(planIds, opts)` | Require plan (blocks if missing) |
| `app.billing.canAccess(planIds)` | Check if user has plan |
| `app.billing.subscribe(planId, opts)` | Full subscribe flow |
| `app.billing.createCheckoutSession(planId, opts)` | Create Stripe checkout |
| `app.billing.getSubscriptionStatus()` | Get current subscription |
| `app.billing.cancelSubscription(opts)` | Cancel subscription |
| `app.billing.getPayments(limit)` | Get payment history |
| `app.billing.formatCurrency(amt, currency)` | Format price |

## Gotchas

| ❌ Don't | ✅ Do |
|----------|-------|
| Put secrets in billing.json | Use `[[env.VAR]]` references |
| Skip webhook setup | Webhooks sync subscription status |
| Expose priceId in components | Framework handles this |
| Check subscription client-side only | Verify server-side for security |
| Forget auth before checkout | Use `app.billing.subscribe()` (handles auth) |

## Related

- `skill:auth` - Combine auth + billing
- `skill:component` - Billing in components
