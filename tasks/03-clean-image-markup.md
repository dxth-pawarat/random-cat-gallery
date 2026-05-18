# Clean Image Markup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove misleading responsive image attributes and make image layout more predictable.

**Architecture:** Keep the gallery cards simple. Remove the duplicated `srcset`/`sizes` values that currently point to the same thumbnail URL, add native image decoding hints, and use CSS aspect ratio for stable card sizing.

**Tech Stack:** Vanilla JavaScript, static CSS, browser-native image loading.

---

### Task 1: Simplify Gallery Image Markup

**Files:**
- Modify: `app.js`
- Modify: `styles.css`

- [ ] **Step 1: Replace generated image attributes**

In `addCatToGallery`, replace the image setup block with:

```js
const image = document.createElement('img');
image.src = cat.thumbUrl;
image.alt = 'A randomly fetched cat';
image.loading = 'lazy';
image.decoding = 'async';
image.width = 320;
image.height = 200;
button.appendChild(image);
```

- [ ] **Step 2: Make card image sizing stable in CSS**

Replace the existing `.card img` rule with:

```css
.card img {
  width: 100%;
  aspect-ratio: 1 / 1;
  height: auto;
  object-fit: cover;
  display: block;
}
```

- [ ] **Step 3: Remove the mobile image-height override**

Inside the `@media (max-width: 600px)` block, remove this rule:

```css
.card img {
  height: 160px;
}
```

Keep the mobile grid rules unchanged.

- [ ] **Step 4: Verify syntax**

Run:

```bash
node --check app.js
```

Expected: command exits with status `0` and prints no output.

- [ ] **Step 5: Manually verify layout**

Open `index.html` in a browser and verify:

```text
1. Fetch 9 cats.
2. Confirm gallery cards stay square and aligned at desktop width.
3. Resize the viewport below 600px.
4. Confirm the gallery uses two columns and cards remain square.
5. Resize the viewport below 400px.
6. Confirm the gallery uses one column and cards remain square.
7. Open a cat and confirm the lightbox image still uses object-fit: contain.
```

- [ ] **Step 6: Commit**

Run:

```bash
git add app.js styles.css
git commit -m "chore: simplify gallery image markup"
```

