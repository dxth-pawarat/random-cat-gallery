const MAX_CATS = 9;
const galleryElement = document.getElementById('gallery');
const statusMessage = document.getElementById('statusMessage');
const fetchButton = document.getElementById('fetchButton');
const themeToggle = document.getElementById('themeToggle');
const clearButton = document.getElementById('clearButton');
let lightboxElement;
let currentFetchController = null;
let currentLightboxController = null;
let activeLightboxRequestId = 0;
let lastFocusedElement = null;

function createLightbox() {
  const lightbox = document.createElement('div');
  lightbox.className = 'lightbox';

  const backdrop = document.createElement('div');
  backdrop.className = 'lightbox__backdrop';
  lightbox.appendChild(backdrop);

  const content = document.createElement('div');
  content.className = 'lightbox__content';
  content.setAttribute('role', 'dialog');
  content.setAttribute('aria-modal', 'true');
  content.setAttribute('aria-label', 'Full-size cat photo');

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'lightbox__close';
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.innerHTML = '&times;';

  const image = document.createElement('img');
  image.className = 'lightbox__image';
  image.alt = 'Full-size cat';

  content.appendChild(closeButton);
  content.appendChild(image);
  lightbox.appendChild(content);

  document.body.appendChild(lightbox);
  return lightbox;
}

function getLightbox() {
  if (!lightboxElement) {
    lightboxElement = createLightbox();
  }
  return lightboxElement;
}

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

function closeLightbox() {
  if (currentLightboxController) {
    currentLightboxController.abort();
    currentLightboxController = null;
  }

  activeLightboxRequestId += 1;

  if (lightboxElement) {
    lightboxElement.classList.remove('is-visible');
  }

  document.body.style.overflow = '';

  if (lastFocusedElement?.isConnected) {
    lastFocusedElement.focus({ preventScroll: true });
  }

  lastFocusedElement = null;
}

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

/**
 * Fetch a random cat image (thumbnail) from The Cat API (no key required for this demo).
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<{ id: string, thumbUrl: string }>} id and thumbnail URL.
 */
async function fetchCatImage(signal) {
  const endpoint = 'https://api.thecatapi.com/v1/images/search?size=small&limit=1';
  const response = await fetch(endpoint, { signal });

  if (!response.ok) {
    throw new Error(`Cat API returned ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0 || !data[0].url || !data[0].id) {
    throw new Error('Unexpected API response');
  }

  return { id: data[0].id, thumbUrl: data[0].url };
}

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

/**
 * Add a new image card to the gallery and trim to the latest MAX_CATS.
 * @param {{ id: string, thumbUrl: string }} cat - Cat data with id and thumbnail URL.
 */
function addCatToGallery(cat) {
  const card = document.createElement('article');
  card.className = 'card';

  const button = document.createElement('button');
  button.className = 'card__trigger';
  button.type = 'button';
  button.dataset.catId = cat.id;
  button.dataset.thumbImage = cat.thumbUrl;

  const image = document.createElement('img');
  image.src = cat.thumbUrl;
  image.srcset = `${cat.thumbUrl} 1x, ${cat.thumbUrl} 2x`;
  image.sizes = '(max-width: 600px) 100vw, 50vw';
  image.alt = 'A randomly fetched cat';
  image.loading = 'lazy';
  button.appendChild(image);

  card.appendChild(button);

  galleryElement.prepend(card);

  // Trim gallery to the most recent items.
  while (galleryElement.children.length > MAX_CATS) {
    galleryElement.removeChild(galleryElement.lastElementChild);
  }
}

function showStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.style.color = isError ? '#d1434b' : '';
}

async function handleFetchClick() {
  // Cancel any ongoing fetch operation
  if (currentFetchController) {
    currentFetchController.abort();
  }
  
  // Create new AbortController for this fetch
  currentFetchController = new AbortController();
  
  showStatus('Loading a new cat…');
  fetchButton.disabled = true;

  try {
    const cat = await fetchCatImage(currentFetchController.signal);
    // Only add to gallery if this request wasn't cancelled
    if (!currentFetchController.signal.aborted) {
      addCatToGallery(cat);
      showStatus('Here is your cat! Want another?');
    }
  } catch (error) {
    // Don't show error if request was just cancelled
    if (error.name !== 'AbortError') {
      console.error('Failed to fetch cat', error);
      showStatus('Oops, something went wrong. Please try again.', true);
    }
  } finally {
    fetchButton.disabled = false;
    // Clear the controller if this was the current one
    if (currentFetchController && !currentFetchController.signal.aborted) {
      currentFetchController = null;
    }
  }
}

function handleClearClick() {
  // Abort any ongoing thumbnail fetch
  try {
    if (currentFetchController) {
      currentFetchController.abort();
      currentFetchController = null;
    }
  } catch (e) {
    // no-op: abort may throw in some environments
  }

  // Close any open lightbox
  closeLightbox();

  // Clear all items from the gallery
  while (galleryElement.firstChild) {
    galleryElement.removeChild(galleryElement.firstChild);
  }

  // Update status message
  showStatus('Gallery cleared. Ready for more cats.');
}

function toggleTheme() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('cat-theme', isDark ? 'dark' : 'light');
  themeToggle.querySelector('.theme-toggle__icon').textContent = isDark ? '🌙' : '🌞';
}

function restoreThemePreference() {
  const stored = localStorage.getItem('cat-theme');
  if (stored === 'dark') {
    document.body.classList.add('dark');
    themeToggle.querySelector('.theme-toggle__icon').textContent = '🌙';
  }
}

function init() {
  restoreThemePreference();
  fetchButton.addEventListener('click', handleFetchClick);
  themeToggle.addEventListener('click', toggleTheme);
  clearButton.addEventListener('click', handleClearClick);
  galleryElement.addEventListener('click', async (event) => {
    const trigger = event.target.closest('.card__trigger');
    if (!trigger) return;
    const cachedFull = trigger.dataset.fullImage;
    if (cachedFull) {
      openLightbox(cachedFull, trigger);
      return;
    }

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
      // Show placeholder immediately while the high-res fetch happens.
      if (thumb) openLightbox(thumb, trigger);
      const fullUrl = await fetchFullCatImage(catId, currentLightboxController.signal);
      const isCurrentRequest = activeLightboxRequestId === requestId;
      const isLightboxOpen = lightboxElement?.classList.contains('is-visible');

      if (isCurrentRequest && isLightboxOpen) {
        trigger.dataset.fullImage = fullUrl;
        openLightbox(fullUrl, trigger);
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
  });
  document.addEventListener('click', (event) => {
    if (!lightboxElement || !lightboxElement.classList.contains('is-visible')) return;
    const isBackdrop = event.target.classList.contains('lightbox__backdrop');
    const isCloseButton = event.target.classList.contains('lightbox__close');
    if (isBackdrop || isCloseButton) {
      closeLightbox();
    }
  });
  document.addEventListener('keydown', (event) => {
    trapLightboxFocus(event);

    if (event.key === 'Escape' && lightboxElement?.classList.contains('is-visible')) {
      closeLightbox();
    }
  });
}

init();
