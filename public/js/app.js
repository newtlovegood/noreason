// ============================================
// App — Scroll reveals, slider, post-payment
// ============================================

import { initPayment, processPayment } from './payment.js';
import { fetchWishes, postWish } from './wishes.js';

// --- Scroll reveal ---

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

// --- Slider ---

const slider = document.getElementById('amount-slider');
const sliderValue = document.getElementById('slider-value');
const sliderMessage = document.getElementById('slider-message');
const donateBtnSlider = document.getElementById('donate-btn-slider');

const messages = [
  [1, 1, 'The perfect amount. Truly.'],
  [2, 5, 'Oh, a big spender. We see you.'],
  [6, 10, 'This is getting philanthropic.'],
  [11, 20, "You could buy a sandwich. But you chose nothing. Respect."],
  [21, 35, "At this point you're basically a venture capitalist."],
  [36, 50, "We're legally required to ask: are you okay?"],
  [51, 75, 'This is more than some people pay for streaming. For nothing.'],
  [76, 90, 'You are a danger to yourself and your bank account.'],
  [91, 98, 'Please. We beg you. Buy literally anything else.'],
  [99, 99, 'MAXIMUM NOTHING ACHIEVED. You absolute legend.'],
];

function getSliderMessage(val) {
  for (const [min, max, msg] of messages) {
    if (val >= min && val <= max) return msg;
  }
  return messages[0][2];
}

let currentAmount = 1;

function updateSlider() {
  const val = Number(slider.value);
  currentAmount = val;
  sliderValue.textContent = val;
  sliderMessage.textContent = getSliderMessage(val);
  donateBtnSlider.textContent = `Donate $${val}`;

  // Update the track fill
  const pct = ((val - 1) / 98) * 100;
  slider.style.background = `linear-gradient(to right, var(--color-accent) ${pct}%, rgba(255,255,255,0.1) ${pct}%)`;
}

slider.addEventListener('input', updateSlider);
updateSlider();

// --- Donate buttons ---

const donateBtn = document.getElementById('donate-btn');

async function handleDonate(amount) {
  const btn = event?.target || donateBtn;
  btn.classList.add('btn--loading');
  btn.disabled = true;

  try {
    const success = await processPayment(amount);
    if (success) {
      showThankYou(amount);
    }
  } catch (err) {
    console.error('Payment failed:', err);
  } finally {
    btn.classList.remove('btn--loading');
    btn.disabled = false;
  }
}

donateBtn.addEventListener('click', () => handleDonate(1));
donateBtnSlider.addEventListener('click', (e) => handleDonate(currentAmount));

// --- Thank You Modal ---

const modal = document.getElementById('thank-you-modal');
const wishInput = document.getElementById('wish-input');
const submitWishBtn = document.getElementById('submit-wish');
const skipWishBtn = document.getElementById('skip-wish');

let lastDonatedAmount = 1;

function showThankYou(amount) {
  lastDonatedAmount = amount;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  wishInput.focus();
}

function closeModal() {
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  wishInput.value = '';
}

submitWishBtn.addEventListener('click', async () => {
  const message = wishInput.value.trim();
  if (!message) return;

  submitWishBtn.classList.add('btn--loading');
  submitWishBtn.disabled = true;

  try {
    await postWish(message, lastDonatedAmount);
    closeModal();
    // Scroll to wishes section
    document.getElementById('wishes').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    console.error('Failed to post wish:', err);
  } finally {
    submitWishBtn.classList.remove('btn--loading');
    submitWishBtn.disabled = false;
  }
});

skipWishBtn.addEventListener('click', closeModal);

// Close modal on backdrop click
modal.querySelector('.modal__backdrop').addEventListener('click', closeModal);

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.classList.contains('active')) {
    closeModal();
  }
});

// --- Check for Checkout redirect success ---

const params = new URLSearchParams(window.location.search);
if (params.get('success') === 'true') {
  const amount = Number(params.get('amount')) || 1;
  // Clean URL
  window.history.replaceState({}, '', '/');
  // Show modal after a brief delay for page to render
  setTimeout(() => showThankYou(amount), 500);
}

// --- Init ---

initPayment();
fetchWishes();
