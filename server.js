import express from 'express';
import Stripe from 'stripe';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import crypto from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const WISHES_FILE = join(DATA_DIR, 'wishes.json');

// --- Config ---
const PORT = process.env.PORT || 3000;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY;

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// --- Wishes storage ---
let wishes = [];

async function loadWishes() {
  try {
    if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
    if (existsSync(WISHES_FILE)) {
      const raw = await readFile(WISHES_FILE, 'utf-8');
      wishes = JSON.parse(raw);
    }
  } catch {
    wishes = [];
  }
}

async function flushWishes() {
  try {
    await writeFile(WISHES_FILE, JSON.stringify(wishes, null, 2));
  } catch (err) {
    console.error('Failed to persist wishes:', err.message);
  }
}

await loadWishes();

// --- Express ---
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Expose publishable key to frontend
app.get('/api/config', (_req, res) => {
  res.json({ publishableKey: STRIPE_PUBLISHABLE_KEY || null });
});

// Derive base URL from request
function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

// Create PaymentIntent
app.post('/api/create-payment-intent', async (req, res) => {
  console.log('[stripe] POST /api/create-payment-intent', req.body);
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });

  const amount = Math.round(Number(req.body.amount));
  if (!amount || amount < 1 || amount > 99) {
    console.log('[stripe] Invalid amount:', req.body.amount);
    return res.status(400).json({ error: 'Amount must be between 1 and 99' });
  }

  try {
    const intent = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      description: `$${amount} for absolutely nothing`,
    });
    console.log('[stripe] PaymentIntent created:', intent.id, `$${amount}`);
    res.json({ clientSecret: intent.client_secret });
  } catch (err) {
    console.error('[stripe] PaymentIntent error:', err.message);
    res.status(500).json({ error: 'Payment failed to initialize' });
  }
});

// Create Checkout Session
app.post('/api/create-checkout-session', async (req, res) => {
  console.log('[stripe] POST /api/create-checkout-session', req.body);
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });

  const amount = Math.round(Number(req.body.amount));
  if (!amount || amount < 1 || amount > 99) {
    console.log('[stripe] Invalid amount:', req.body.amount);
    return res.status(400).json({ error: 'Amount must be between 1 and 99' });
  }

  const baseUrl = getBaseUrl(req);
  console.log('[stripe] Base URL:', baseUrl);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: amount * 100,
          product_data: {
            name: 'Absolutely Nothing',
            description: `$${amount} of premium-grade nothingness`,
          },
        },
        quantity: 1,
      }],
      success_url: `${baseUrl}/?success=true&amount=${amount}`,
      cancel_url: `${baseUrl}/?canceled=true`,
    });
    console.log('[stripe] Checkout session created:', session.id, '→', session.url);
    res.json({ url: session.url });
  } catch (err) {
    console.error('[stripe] Checkout error:', err.message);
    res.status(500).json({ error: 'Checkout failed to initialize' });
  }
});

// Get wishes
app.get('/api/wishes', (_req, res) => {
  res.json(wishes.slice(0, 50));
});

// Post a wish
app.post('/api/wishes', (req, res) => {
  const message = String(req.body.message || '').trim().slice(0, 140);
  const amount = Math.round(Number(req.body.amount)) || 1;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Strip any HTML
  const clean = message.replace(/<[^>]*>/g, '');

  const wish = {
    id: crypto.randomUUID(),
    message: clean,
    amount,
    createdAt: new Date().toISOString(),
  };

  wishes.unshift(wish);
  if (wishes.length > 200) wishes.length = 200;
  flushWishes(); // fire-and-forget

  res.status(201).json(wish);
});

app.listen(PORT, () => {
  console.log(`\n  💸 I Need A Dollar is running at http://localhost:${PORT}\n`);
  if (!stripe) console.log('  ⚠️  Stripe not configured — add keys to .env\n');
});
