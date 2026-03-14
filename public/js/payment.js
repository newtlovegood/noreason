// ============================================
// Payment — Embedded Stripe Payment Element
// ============================================

let stripe = null;
let stripeReady = false;
let elements = null;
let currentClientSecret = null;
let dismissResolve = null; // resolves the processPayment promise on modal dismiss

const paymentModal = document.getElementById('payment-modal');
const paymentModalTitle = document.getElementById('payment-modal-title');
const payNowBtn = document.getElementById('pay-now-btn');
const cancelPaymentBtn = document.getElementById('cancel-payment');
const paymentMessage = document.getElementById('payment-message');

export async function initPayment() {
  try {
    const res = await fetch('/api/config');
    const { publishableKey } = await res.json();

    if (!publishableKey) {
      console.log('[payment] No Stripe key — demo mode');
      return;
    }

    stripe = Stripe(publishableKey);
    stripeReady = true;
    console.log('[payment] Stripe ready');
  } catch (err) {
    console.error('[payment] Init failed:', err);
  }
}

function showPaymentModal() {
  paymentModal.classList.add('active');
  paymentModal.setAttribute('aria-hidden', 'false');
}

function hidePaymentModal() {
  paymentModal.classList.remove('active');
  paymentModal.setAttribute('aria-hidden', 'true');
  paymentMessage.hidden = true;
  paymentMessage.textContent = '';

  // Resolve pending promise as cancelled
  if (dismissResolve) {
    dismissResolve(false);
    dismissResolve = null;
  }
}

cancelPaymentBtn.addEventListener('click', hidePaymentModal);
paymentModal.querySelector('.modal__backdrop').addEventListener('click', hidePaymentModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && paymentModal.classList.contains('active')) hidePaymentModal();
});

/**
 * Opens the payment modal with an embedded Payment Element.
 * Returns a promise that resolves to true on success, false on cancel/fail.
 */
export function processPayment(amount) {
  // Demo mode
  if (!stripeReady) {
    console.log('[payment] Demo mode — simulating $' + amount);
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), 1500);
    });
  }

  return new Promise(async (resolve) => {
    // Store resolve so dismiss can call it
    dismissResolve = resolve;

    console.log('[payment] Creating PaymentIntent for $' + amount);
    paymentModalTitle.textContent = `$${amount} for nothing`;

    // Reset button state
    payNowBtn.classList.remove('btn--loading');
    payNowBtn.disabled = false;

    try {
      const res = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();

      if (data.error) {
        console.error('[payment] Server error:', data.error);
        resolve(false);
        dismissResolve = null;
        return;
      }

      currentClientSecret = data.clientSecret;
      console.log('[payment] PaymentIntent created');

      elements = stripe.elements({
        clientSecret: currentClientSecret,
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: '#f5f5f7',
            colorBackground: '#1a1a1a',
            colorText: '#f5f5f7',
            colorTextSecondary: '#86868b',
            colorDanger: '#ff453a',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            borderRadius: '12px',
            spacingUnit: '4px',
          },
          rules: {
            '.Input': {
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: 'none',
            },
            '.Input:focus': {
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: 'none',
            },
            '.Tab': {
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: 'none',
            },
            '.Tab--selected': {
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: 'none',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
            },
          },
        },
      });

      const paymentElement = elements.create('payment', {
        layout: 'tabs',
        wallets: { applePay: 'auto', googlePay: 'auto' },
      });

      document.getElementById('payment-element').innerHTML = '';
      paymentElement.mount('#payment-element');

      showPaymentModal();

      // Handle pay button — clone to remove old listeners
      const newBtn = payNowBtn.cloneNode(true);
      payNowBtn.replaceWith(newBtn);
      const btn = document.getElementById('pay-now-btn');

      btn.addEventListener('click', async () => {
        btn.classList.add('btn--loading');
        btn.disabled = true;
        paymentMessage.hidden = true;

        console.log('[payment] Confirming payment...');

        const { error } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/?success=true&amount=${amount}`,
          },
          redirect: 'if_required',
        });

        if (error) {
          console.error('[payment] Error:', error.message);
          paymentMessage.textContent = error.message;
          paymentMessage.hidden = false;
          btn.classList.remove('btn--loading');
          btn.disabled = false;
        } else {
          console.log('[payment] Payment succeeded!');
          dismissResolve = null; // prevent double-resolve
          hidePaymentModal();
          resolve(true);
        }
      });

    } catch (err) {
      console.error('[payment] Error:', err);
      resolve(false);
      dismissResolve = null;
    }
  });
}
