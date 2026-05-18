# Favorite Cats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users save favorite cats in local storage and visually mark favorited cards.

**Architecture:** Store favorite cats as a small array in `localStorage`, keyed by cat id. Render a favorite toggle button on each card, keep the current gallery DOM structure, and rehydrate saved favorites into the gallery on page load.

**Tech Stack:** Vanilla JavaScript, DOM APIs, localStorage, static CSS.

---

### Task 1: Add Favorite State And Card Controls

**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Modify: `README.md`

- [ ] **Step 1: Add favorite storage state**

Add this state near the top of `app.js`:

```js
const FAVORITES_STORAGE_KEY = 'cat-gallery-favorites-v1';
let favoriteCats = [];
```

- [ ] **Step 2: Add favorite storage helpers**

Add these helpers after `restoreThemePreference`:

```js
function loadFavoriteCats() {
  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((cat) => cat?.id && cat?.thumbUrl);
  } catch (error) {
    console.error('Failed to load favorite cats', error);
    return [];
  }
}

function saveFavoriteCats() {
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteCats));
}

function isFavoriteCat(id) {
  return favoriteCats.some((cat) => cat.id === id);
}

function setFavoriteButtonState(button, isFavorite) {
  button.classList.toggle('is-favorite', isFavorite);
  button.setAttribute('aria-pressed', String(isFavorite));
  button.setAttribute('aria-label', isFavorite ? 'Remove cat from favorites' : 'Save cat to favorites');
  button.textContent = isFavorite ? '\u2665' : '\u2661';
}

function toggleFavorite(cat, button) {
  const existingIndex = favoriteCats.findIndex((favorite) => favorite.id === cat.id);

  if (existingIndex >= 0) {
    favoriteCats.splice(existingIndex, 1);
    setFavoriteButtonState(button, false);
    showStatus('Removed cat from favorites.');
  } else {
    favoriteCats.unshift(cat);
    setFavoriteButtonState(button, true);
    showStatus('Saved cat to favorites.');
  }

  saveFavoriteCats();
}
```

- [ ] **Step 3: Update `addCatToGallery` to render the favorite button**

Inside `addCatToGallery`, after `button.appendChild(image);` and before `card.appendChild(button);`, add:

```js
const favoriteButton = document.createElement('button');
favoriteButton.className = 'card__favorite';
favoriteButton.type = 'button';
favoriteButton.dataset.catId = cat.id;
favoriteButton.dataset.thumbImage = cat.thumbUrl;
setFavoriteButtonState(favoriteButton, isFavoriteCat(cat.id));

card.appendChild(favoriteButton);
```

Then keep:

```js
card.appendChild(button);
```

- [ ] **Step 4: Update card CSS for the overlay button**

Add these rules to `styles.css` near the card styles:

```css
.card {
  position: relative;
}

.card__favorite {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.72);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 22px;
  line-height: 1;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.22);
}

.card__favorite:hover,
.card__favorite:focus-visible {
  background: rgba(17, 24, 39, 0.9);
}

.card__favorite.is-favorite {
  background: #d1434b;
}
```

If `.card` already exists in the file, add only `position: relative;` to the existing `.card` rule instead of creating a duplicate `.card` block.

- [ ] **Step 5: Handle favorite button clicks before image clicks**

At the top of the `galleryElement.addEventListener('click', async (event) => { ... })` handler, add this before the `.card__trigger` lookup:

```js
const favoriteButton = event.target.closest('.card__favorite');
if (favoriteButton) {
  const cat = {
    id: favoriteButton.dataset.catId,
    thumbUrl: favoriteButton.dataset.thumbImage
  };

  toggleFavorite(cat, favoriteButton);
  return;
}
```

- [ ] **Step 6: Rehydrate favorites on startup**

In `init`, after `restoreThemePreference();` and before event listeners are registered, add:

```js
favoriteCats = loadFavoriteCats();
favoriteCats.slice().reverse().forEach(addCatToGallery);

if (favoriteCats.length > 0) {
  showStatus(`Loaded ${favoriteCats.length} favorite cat${favoriteCats.length === 1 ? '' : 's'}.`);
}
```

- [ ] **Step 7: Keep clear gallery from deleting favorites**

Update the final status in `handleClearClick` to:

```js
showStatus('Gallery cleared. Favorites remain saved.');
```

- [ ] **Step 8: Update README feature list**

In `README.md`, add this bullet under `### Performance Features`:

```markdown
- **Favorites**: Save favorite cats locally and reload them on the next visit
```

- [ ] **Step 9: Verify syntax**

Run:

```bash
node --check app.js
```

Expected: command exits with status `0` and prints no output.

- [ ] **Step 10: Manually verify favorites**

Open `index.html` in a browser and verify:

```text
1. Fetch a cat.
2. Click the heart button on the card.
3. Confirm the button changes from an empty heart to a filled heart.
4. Refresh the page.
5. Confirm the favorite cat appears again.
6. Click the heart button again.
7. Refresh the page.
8. Confirm the removed favorite cat does not appear.
9. Click "Clear gallery".
10. Refresh the page.
11. Confirm favorites that were not removed still appear.
```

- [ ] **Step 11: Commit**

Run:

```bash
git add app.js styles.css README.md
git commit -m "feat: save favorite cats locally"
```
