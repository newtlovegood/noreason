// ============================================
// Wishes — Fetch, post, render
// ============================================

const grid = document.getElementById('wishes-grid');
const emptyState = document.getElementById('wishes-empty');

function renderWishCard(wish, isNew = false) {
  const card = document.createElement('div');
  card.className = `wish-card${isNew ? ' wish-card--new' : ''}`;
  card.style.animationDelay = isNew ? '0s' : `${Math.random() * 0.3}s`;

  const msg = document.createElement('p');
  msg.className = 'wish-card__message';
  msg.textContent = wish.message;

  const meta = document.createElement('p');
  meta.className = 'wish-card__meta';
  meta.innerHTML = `<span class="wish-card__amount">$${wish.amount}</span> for nothing`;

  card.appendChild(msg);
  card.appendChild(meta);

  return card;
}

export async function fetchWishes() {
  try {
    const res = await fetch('/api/wishes');
    const wishes = await res.json();

    if (wishes.length === 0) {
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;
    grid.innerHTML = '';

    wishes.forEach((wish) => {
      grid.appendChild(renderWishCard(wish));
    });
  } catch (err) {
    console.error('Failed to fetch wishes:', err);
  }
}

export async function postWish(message, amount) {
  const res = await fetch('/api/wishes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, amount }),
  });

  if (!res.ok) throw new Error('Failed to post wish');

  const wish = await res.json();

  // Prepend new card
  emptyState.hidden = true;
  const card = renderWishCard(wish, true);
  grid.prepend(card);

  return wish;
}
