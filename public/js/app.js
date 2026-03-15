// ============================================
// App — Multiplier buttons, live counter, receipt
// ============================================

import { initPayment, processPayment } from './payment.js';

// --- Multiplier buttons ---

const multiplierBtns = document.querySelectorAll('.multiplier-btn');
const heroAmount = document.getElementById('hero-amount');
const donateBtn = document.getElementById('donate-btn');

let currentAmount = 5;

multiplierBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const multiplier = Number(btn.dataset.multiplier);
    currentAmount = multiplier;

    // Update active state
    multiplierBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    // Update hero dollar display
    heroAmount.textContent = multiplier;

    // Update bottom CTA text
    donateBtn.textContent = `DONATE $${multiplier} \u2192 RECEIVE NOTHING`;
  });
});

// --- Donate button ---

async function handleDonate() {
  donateBtn.classList.add('btn--loading');
  donateBtn.disabled = true;

  try {
    const success = await processPayment(currentAmount);
    if (success) {
      showReceipt(currentAmount);
    }
  } catch (err) {
    console.error('Payment failed:', err);
  } finally {
    donateBtn.classList.remove('btn--loading');
    donateBtn.disabled = false;
  }
}

donateBtn.addEventListener('click', handleDonate);

// --- Fake Live Counter ---
// Deterministic counter that grows ~500/day based on a fixed epoch.
// Uses a seeded approach so all visitors see the same number at the same time.

const counterEl = document.getElementById('live-counter');

// Fixed start: 259 people on March 10, 2026
const COUNTER_EPOCH = new Date('2026-03-10T00:00:00Z').getTime();
const COUNTER_BASE = 259;
const PEOPLE_PER_DAY = 500;

function getBaseCount() {
  const now = Date.now();
  const elapsed = Math.max(0, now - COUNTER_EPOCH);
  const days = elapsed / (1000 * 60 * 60 * 24);
  // Add slight sinusoidal variation so it doesn't feel perfectly linear
  const variation = Math.sin(days * 2.3) * 12 + Math.cos(days * 5.7) * 7;
  return Math.floor(COUNTER_BASE + days * PEOPLE_PER_DAY + variation);
}

let displayedCount = getBaseCount();
counterEl.textContent = displayedCount.toLocaleString();

// Periodically increment to simulate real-time activity
function scheduleNextIncrement() {
  // Random interval between 8-45 seconds (roughly 500/day = 1 every ~173s,
  // but we increment small amounts to feel active)
  const delay = (8 + Math.random() * 37) * 1000;

  setTimeout(() => {
    displayedCount++;
    counterEl.textContent = displayedCount.toLocaleString();

    // Small visual bump
    counterEl.classList.add('bump');
    setTimeout(() => counterEl.classList.remove('bump'), 150);

    scheduleNextIncrement();
  }, delay);
}

scheduleNextIncrement();

// --- Receipt Modal ---

const receiptModal = document.getElementById('receipt-modal');
const closeReceiptBtn = document.getElementById('close-receipt');

function showReceipt(amount) {
  // Fill in receipt details
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ' ' + now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  document.getElementById('receipt-date').textContent = dateStr;
  document.getElementById('receipt-order').textContent = `ORDER #${100 + Math.floor(Math.random() * 900)}`;

  const price = `$${amount}.00`;
  document.getElementById('receipt-item-price').textContent = price;
  document.getElementById('receipt-subtotal').textContent = price;
  document.getElementById('receipt-total').textContent = price;

  // Customer number based on counter
  const customerNum = displayedCount;
  document.getElementById('receipt-customer-number').textContent = customerNum;

  // Generate barcode
  generateBarcode();

  // Generate barcode number
  const barcodeNum = String(customerNum).padStart(8, '0');
  document.getElementById('receipt-barcode-number').textContent =
    `${barcodeNum.slice(0, 4)} ${barcodeNum.slice(4, 8)} 0001 0000`;

  // Show modal
  receiptModal.classList.add('active');
  receiptModal.setAttribute('aria-hidden', 'false');
}

function generateBarcode() {
  const container = document.getElementById('receipt-barcode');
  // Find or use the barcode-lines div
  const linesContainer = document.getElementById('receipt-barcode');
  const barcodeLines = linesContainer.querySelector('.receipt__barcode-lines') ||
    document.getElementById('receipt-barcode').firstElementChild;

  // Clear existing
  const target = document.querySelector('.receipt__barcode-lines');
  target.innerHTML = '';

  // Generate random-width bars
  for (let i = 0; i < 40; i++) {
    const bar = document.createElement('span');
    const width = Math.random() > 0.6 ? 3 : Math.random() > 0.3 ? 2 : 1;
    bar.style.width = width + 'px';
    bar.style.height = (28 + Math.random() * 12) + 'px';
    target.appendChild(bar);
  }
}

function closeReceipt() {
  receiptModal.classList.remove('active');
  receiptModal.setAttribute('aria-hidden', 'true');
}

closeReceiptBtn.addEventListener('click', closeReceipt);
receiptModal.querySelector('.modal__backdrop').addEventListener('click', closeReceipt);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && receiptModal.classList.contains('active')) {
    closeReceipt();
  }
});

// --- Check for Checkout redirect success ---

const params = new URLSearchParams(window.location.search);
if (params.get('success') === 'true') {
  const amount = Number(params.get('amount')) || 1;
  window.history.replaceState({}, '', '/');
  setTimeout(() => showReceipt(amount), 500);
}

// --- Init ---

initPayment();
