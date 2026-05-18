# Lightbox Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the lightbox usable for keyboard and screen-reader users by managing focus, restoring focus, and trapping tab navigation while the dialog is open.

**Architecture:** Keep the existing generated lightbox markup. Extend `openLightbox` and `closeLightbox` with focus ownership, add a small focus-trap helper, and route `Tab`/`Escape` keys through the same close path.

**Tech Stack:** Vanilla JavaScript, DOM APIs, ARIA dialog attributes, static HTML/CSS.

---

### Task 1: Add Dialog Focus Management

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Add the return-focus state**

Add this variable next to the other top-level state:

```js
let lastFocusedElement = null;
```

- [ ] **Step 2: Update `openLightbox` to focus the close button**

Replace `openLightbox` with:

```js
function openLightbox(url, returnFocusElement = document.activeElement) {
  const lightbox = getLightbox();
  const image = lightbox.querySelector('.lightbox__image');
  const closeButton = lightbox.querySelector('.lightbox__close');

  if (returnFocusElement instanceof HTMLElement) {
    lastFocusedElement = returnFocusElement;
  }

  image.src = url;
  lightbox.classList.add('is-visible');
  document.body.style.overflow = 'hidden';
  closeButton.focus({ preventScroll: true });
}
```

- [ ] **Step 3: Update `closeLightbox` to restore focus**

If the lightbox request lifecycle task has already been implemented, keep its request-canceling lines at the top of the function and add the focus restoration shown here. The final function should include this behavior:

```js
function closeLightbox() {
  if (lightboxElement) {
    lightboxElement.classList.remove('is-visible');
  }

  document.body.style.overflow = '';

  if (lastFocusedElement?.isConnected) {
    lastFocusedElement.focus({ preventScroll: true });
  }

  lastFocusedElement = null;
}
```

- [ ] **Step 4: Add a focus-trap helper**

Add this helper below `closeLightbox`:

```js
function trapLightboxFocus(event) {
  if (!lightboxElement?.classList.contains('is-visible')) return;
  if (event.key !== 'Tab') return;

  const focusableElements = Array.from(
    lightboxElement.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
  ).filter((element) => !element.disabled && element.offsetParent !== null);

  if (focusableElements.length === 0) {
    event.preventDefault();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}
```

- [ ] **Step 5: Pass the clicked card button as the focus return target**

Update cached image opening:

```js
if (cachedFull) {
  openLightbox(cachedFull, trigger);
  return;
}
```

Update thumbnail preview opening:

```js
if (thumb) openLightbox(thumb, trigger);
```

If the lightbox request lifecycle task has already been implemented, update its full-resolution call too:

```js
openLightbox(fullUrl, trigger);
```

- [ ] **Step 6: Route `Tab` through the focus trap**

Update the existing `document.addEventListener('keydown', ...)` handler to include the trap:

```js
document.addEventListener('keydown', (event) => {
  trapLightboxFocus(event);

  if (event.key === 'Escape' && lightboxElement?.classList.contains('is-visible')) {
    closeLightbox();
  }
});
```

- [ ] **Step 7: Verify syntax**

Run:

```bash
node --check app.js
```

Expected: command exits with status `0` and prints no output.

- [ ] **Step 8: Manually verify keyboard behavior**

Open `index.html` in a browser and verify:

```text
1. Press Tab until "Get a new cat" is focused.
2. Press Enter to fetch a cat.
3. Press Tab until the cat image button is focused.
4. Press Enter to open the lightbox.
5. Confirm focus moves to the close button.
6. Press Tab repeatedly and confirm focus stays inside the lightbox.
7. Press Shift+Tab and confirm focus stays inside the lightbox.
8. Press Escape and confirm the lightbox closes.
9. Confirm focus returns to the cat image button that opened the lightbox.
```

- [ ] **Step 9: Commit**

Run:

```bash
git add app.js
git commit -m "fix: improve lightbox keyboard accessibility"
```

