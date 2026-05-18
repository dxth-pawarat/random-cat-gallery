import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

class FakeClassList {
  constructor(element) {
    this.element = element;
    this.classes = new Set();
  }

  add(...classNames) {
    for (const className of classNames) this.classes.add(className);
    this.sync();
  }

  remove(...classNames) {
    for (const className of classNames) this.classes.delete(className);
    this.sync();
  }

  contains(className) {
    return this.classes.has(className);
  }

  toggle(className) {
    if (this.classes.has(className)) {
      this.classes.delete(className);
      this.sync();
      return false;
    }

    this.classes.add(className);
    this.sync();
    return true;
  }

  setFromString(value) {
    this.classes = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  sync() {
    this.element.className = [...this.classes].join(' ');
  }
}

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  async dispatchEvent(event) {
    event.currentTarget = this;
    event.preventDefault ??= () => {};
    event.stopPropagation ??= () => {};

    const listeners = this.listeners.get(event.type) ?? [];
    await Promise.all(listeners.map((listener) => listener.call(this, event)));
    return true;
  }
}

class FakeElement extends FakeEventTarget {
  constructor(tagName) {
    super();
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.disabled = false;
    this.textContent = '';
    this.innerHTML = '';
    this._className = '';
    this.classList = new FakeClassList(this);
  }

  get className() {
    return this._className;
  }

  set className(value) {
    this._className = String(value);
    this.classList?.setFromString(value);
  }

  get firstChild() {
    return this.children[0] ?? null;
  }

  get lastElementChild() {
    return this.children[this.children.length - 1] ?? null;
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  prepend(child) {
    child.parentElement = this;
    this.children.unshift(child);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parentElement = null;
    }
    return child;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  querySelector(selector) {
    const matcher = createMatcher(selector);
    const stack = [...this.children];

    while (stack.length > 0) {
      const element = stack.shift();
      if (matcher(element)) return element;
      stack.unshift(...element.children);
    }

    return null;
  }

  closest(selector) {
    const matcher = createMatcher(selector);
    let current = this;

    while (current) {
      if (matcher(current)) return current;
      current = current.parentElement;
    }

    return null;
  }
}

class FakeDocument extends FakeEventTarget {
  constructor() {
    super();
    this.body = new FakeElement('body');
    this.elementsById = new Map();
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  getElementById(id) {
    return this.elementsById.get(id) ?? null;
  }

  registerElement(id, element = new FakeElement('div')) {
    element.id = id;
    this.elementsById.set(id, element);
    return element;
  }
}

function createMatcher(selector) {
  if (!selector.startsWith('.')) {
    throw new Error(`Unsupported selector: ${selector}`);
  }

  const className = selector.slice(1);
  return (element) => element.classList.contains(className);
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function createAbortError() {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

function createFetchHarness() {
  const requests = new Map();

  function fetch(endpoint, options = {}) {
    const id = endpoint.split('/').pop();
    const request = createDeferred();
    request.signal = options.signal;
    requests.set(id, request);

    if (options.signal) {
      if (options.signal.aborted) {
        request.reject(createAbortError());
      } else {
        options.signal.addEventListener('abort', () => request.reject(createAbortError()), { once: true });
      }
    }

    return request.promise;
  }

  return { fetch, requests };
}

async function createAppHarness(fetchImpl) {
  const document = new FakeDocument();
  const gallery = document.registerElement('gallery', new FakeElement('section'));
  const statusMessage = document.registerElement('statusMessage', new FakeElement('p'));
  const fetchButton = document.registerElement('fetchButton', new FakeElement('button'));
  const themeToggle = document.registerElement('themeToggle', new FakeElement('button'));
  const clearButton = document.registerElement('clearButton', new FakeElement('button'));
  const themeIcon = new FakeElement('span');
  themeIcon.className = 'theme-toggle__icon';
  themeToggle.appendChild(themeIcon);

  const context = {
    AbortController,
    console: { error() {} },
    document,
    fetch: fetchImpl,
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
    },
  };

  vm.createContext(context);
  const source = await readFile(new URL('./app.js', import.meta.url), 'utf8');
  vm.runInContext(source, context);

  return {
    clearButton,
    document,
    gallery,
    getLightbox() {
      return document.body.querySelector('.lightbox');
    },
    statusMessage,
    fetchButton,
  };
}

function addGalleryTrigger(gallery, id, thumbImage) {
  const trigger = new FakeElement('button');
  trigger.className = 'card__trigger';
  trigger.dataset.catId = id;
  trigger.dataset.thumbImage = thumbImage;
  gallery.appendChild(trigger);
  return trigger;
}

function fullImageResponse(url) {
  return {
    ok: true,
    async json() {
      return { url };
    },
  };
}

test('closed lightbox ignores a later full-size response', async () => {
  const { fetch, requests } = createFetchHarness();
  const { document, gallery, getLightbox } = await createAppHarness(fetch);
  const trigger = addGalleryTrigger(gallery, 'cat-one', 'thumb-one.jpg');

  const click = gallery.dispatchEvent({ type: 'click', target: trigger });
  const lightbox = getLightbox();
  assert.equal(lightbox.classList.contains('is-visible'), true);

  await document.dispatchEvent({
    type: 'click',
    target: lightbox.querySelector('.lightbox__backdrop'),
  });

  requests.get('cat-one').resolve(fullImageResponse('full-one.jpg'));
  await click;

  assert.equal(lightbox.classList.contains('is-visible'), false);
  assert.notEqual(lightbox.querySelector('.lightbox__image').src, 'full-one.jpg');
});

test('latest lightbox request owns the full-size image', async () => {
  const { fetch, requests } = createFetchHarness();
  const { gallery, getLightbox } = await createAppHarness(fetch);
  const firstTrigger = addGalleryTrigger(gallery, 'cat-one', 'thumb-one.jpg');
  const secondTrigger = addGalleryTrigger(gallery, 'cat-two', 'thumb-two.jpg');

  const firstClick = gallery.dispatchEvent({ type: 'click', target: firstTrigger });
  const secondClick = gallery.dispatchEvent({ type: 'click', target: secondTrigger });

  requests.get('cat-two').resolve(fullImageResponse('full-two.jpg'));
  await secondClick;

  const lightboxImage = getLightbox().querySelector('.lightbox__image');
  assert.equal(lightboxImage.src, 'full-two.jpg');

  requests.get('cat-one').resolve(fullImageResponse('full-one.jpg'));
  await firstClick;

  assert.equal(lightboxImage.src, 'full-two.jpg');
});

test('clearing the gallery keeps stale full-size responses closed', async () => {
  const { fetch, requests } = createFetchHarness();
  const { clearButton, gallery, getLightbox } = await createAppHarness(fetch);
  const trigger = addGalleryTrigger(gallery, 'cat-one', 'thumb-one.jpg');

  const click = gallery.dispatchEvent({ type: 'click', target: trigger });
  const lightbox = getLightbox();
  assert.equal(lightbox.classList.contains('is-visible'), true);

  await clearButton.dispatchEvent({ type: 'click', target: clearButton });
  requests.get('cat-one').resolve(fullImageResponse('full-one.jpg'));
  await click;

  assert.equal(gallery.children.length, 0);
  assert.equal(lightbox.classList.contains('is-visible'), false);
});
