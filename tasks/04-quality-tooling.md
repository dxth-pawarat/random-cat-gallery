# Quality Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lightweight local and CI quality checks without introducing package dependencies.

**Architecture:** Add a minimal `package.json` with check scripts, add a Node-based static asset sanity checker, and update the GitHub Pages workflow to use the shared check command.

**Tech Stack:** Node.js 20, npm scripts, GitHub Actions, static HTML/CSS/JS.

---

### Task 1: Add Shared Check Scripts

**Files:**
- Create: `package.json`
- Create: `scripts/check-static-assets.js`
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create `package.json`**

Create `package.json` at the repo root:

```json
{
  "name": "random-cat-gallery",
  "version": "1.0.0",
  "private": true,
  "description": "A tiny static page that fetches and shows random cats.",
  "scripts": {
    "check": "npm run check:js && npm run check:static",
    "check:js": "node --check app.js",
    "check:static": "node scripts/check-static-assets.js"
  },
  "license": "UNLICENSED"
}
```

- [ ] **Step 2: Create the static asset checker**

Create `scripts/check-static-assets.js`:

```js
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const requiredFiles = ['index.html', 'styles.css', 'app.js'];

function readFile(fileName) {
  return fs.readFileSync(path.join(root, fileName), 'utf8');
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

for (const fileName of requiredFiles) {
  if (!fs.existsSync(path.join(root, fileName))) {
    fail(`Missing required file: ${fileName}`);
  }
}

const html = readFile('index.html');
const app = readFile('app.js');

const requiredMarkup = [
  'id="gallery"',
  'id="statusMessage"',
  'id="fetchButton"',
  'id="themeToggle"',
  'id="clearButton"',
  'href="styles.css"',
  'src="app.js"'
];

for (const snippet of requiredMarkup) {
  if (!html.includes(snippet)) {
    fail(`index.html is missing expected markup: ${snippet}`);
  }
}

const duplicateIds = html
  .match(/\bid="([^"]+)"/g)
  ?.map((match) => match.slice(4, -1))
  .filter((id, index, ids) => ids.indexOf(id) !== index);

if (duplicateIds?.length) {
  fail(`index.html contains duplicate ids: ${[...new Set(duplicateIds)].join(', ')}`);
}

const requiredAppHooks = [
  "document.getElementById('gallery')",
  "document.getElementById('statusMessage')",
  "document.getElementById('fetchButton')",
  "document.getElementById('themeToggle')",
  "document.getElementById('clearButton')"
];

for (const snippet of requiredAppHooks) {
  if (!app.includes(snippet)) {
    fail(`app.js is missing expected DOM hook: ${snippet}`);
  }
}

if (process.exitCode) {
  process.exit();
}

console.log('Static asset checks passed.');
```

- [ ] **Step 3: Run the new checks locally**

Run:

```bash
npm run check
```

Expected output includes:

```text
Static asset checks passed.
```

Expected: command exits with status `0`.

- [ ] **Step 4: Update GitHub Actions to use the shared check**

In `.github/workflows/deploy.yml`, replace:

```yaml
      - name: Check JavaScript syntax
        run: node --check app.js
```

with:

```yaml
      - name: Run checks
        run: npm run check
```

- [ ] **Step 5: Verify the workflow still prepares the same artifact**

Confirm `.github/workflows/deploy.yml` still contains:

```yaml
      - name: Prepare site
        run: |
          mkdir -p public
          cp index.html styles.css app.js public/
```

- [ ] **Step 6: Run the final check**

Run:

```bash
npm run check
```

Expected output includes:

```text
Static asset checks passed.
```

Expected: command exits with status `0`.

- [ ] **Step 7: Commit**

Run:

```bash
git add package.json scripts/check-static-assets.js .github/workflows/deploy.yml
git commit -m "ci: add shared static site checks"
```

