# Lightbox Request Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent stale full-resolution image requests from reopening or replacing the lightbox after the user closes it or selects another cat.

**Architecture:** Keep thumbnail fetching and lightbox fetching as separate request lifecycles. Track the active lightbox request with an `AbortController` plus a numeric request id, and only apply a full-resolution response when it still belongs to the visible active lightbox.

**Tech Stack:** Vanilla JavaScript, DOM APIs, Fetch API, AbortController, static HTML/CSS.

---

### Task 1: Add Lightbox Fetch Ownership

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Add state for lightbox requests**

In `app.js`, add these variables next to the existing fetch controller state:

```js
let lightboxElement;
let currentFetchController = null;
let currentLightboxController = null;
let activeLightboxRequestId = 0;
```

- [ ] **Step 2: Make full-size fetch cancellable**

Replace `fetchFullCatImage` with this version:

```js
/**
 * Fetch a full-resolution cat image by id.
 * @param {string} id - Cat image id.
 * @param {AbortSignal} signal - Optional abort signal to cancel the request.
 * @returns {Promise<string>} URL of the high-res cat image.
 */
async function fetchFullCatImage(id, signal) {
  const endpoint = `https://api.thecatapi.com/v1/images/${id}`;
  const response = await fetch(endpoint, { signal });

  if (!response.ok) {
    throw new Error(`Cat API returned ${response.status} for full image`);
  }

  const data = await response.json();
  if (!data.url) {
    throw new Error('Unexpected API response for full image');
  }

  return data.url;
}
```

- [ ] **Step 3: Cancel pending lightbox work when closing**

Update `closeLightbox` so closing invalidates any pending full-size response:

```js
function closeLightbox() {
  if (currentLightboxController) {
    currentLightboxController.abort();
    currentLightboxController = null;
  }

  activeLightboxRequestId += 1;

  if (!lightboxElement) return;
  lightboxElement.classList.remove('is-visible');
  document.body.style.overflow = '';
}
```

- [ ] **Step 4: Cancel pending lightbox work when clearing**

In `handleClearClick`, after the thumbnail fetch abort block and before `closeLightbox()`, no additional code is needed once Step 3 is complete. Confirm the function still calls:

```js
closeLightbox();
```

- [ ] **Step 5: Gate the gallery lightbox click handler**

Replace the non-cached branch inside the `galleryElement.addEventListener('click', async (event) => { ... })` handler with this logic:

```js
const catId = trigger.dataset.catId;
const thumb = trigger.dataset.thumbImage;
const requestId = activeLightboxRequestId + 1;
activeLightboxRequestId = requestId;

if (currentLightboxController) {
  currentLightboxController.abort();
}

currentLightboxController = new AbortController();

try {
  trigger.disabled = true;
  if (thumb) openLightbox(thumb);

  const fullUrl = await fetchFullCatImage(catId, currentLightboxController.signal);
  const isCurrentRequest = activeLightboxRequestId === requestId;
  const isLightboxOpen = lightboxElement?.classList.contains('is-visible');

  if (isCurrentRequest && isLightboxOpen) {
    trigger.dataset.fullImage = fullUrl;
    openLightbox(fullUrl);
  }
} catch (error) {
  if (error.name !== 'AbortError') {
    console.error('Failed to load full-size cat image', error);
    showStatus('Could not load the full-size cat right now.', true);
  }
} finally {
  trigger.disabled = false;
  if (activeLightboxRequestId === requestId) {
    currentLightboxController = null;
  }
}
```

- [ ] **Step 6: Verify syntax**

Run:

```bash
node --check app.js
```

Expected: command exits with status `0` and prints no output.

- [ ] **Step 7: Manually verify browser behavior**

Open `index.html` in a browser and verify:

```text
1. Click "Get a new cat".
2. Click the cat image.
3. Close the lightbox immediately.
4. Wait 3 seconds.
5. Confirm the lightbox does not reopen.
6. Fetch two or more cats.
7. Click one cat, then quickly click another.
8. Confirm the final full-size image belongs to the most recently clicked cat.
9. Click "Clear gallery" while a full-size image is loading.
10. Confirm the gallery clears and the lightbox stays closed.
```

- [ ] **Step 8: Commit**

Run:

```bash
git add app.js
git commit -m "fix: guard stale lightbox image requests"
```

