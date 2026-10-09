// Grove panel: catalog of modules as narrative cards in fixed groups.
// Browser-only; all data text goes into the DOM via textContent.

import { hana } from './sdk.js';
import { installThemeShell } from './shell.js';
import { resolveLocale, createTranslator } from '../../core/i18n.js';
import { groupViews } from './view-model.js';

const API = {
  state: 'state',
  enable: (id) => `modules/${encodeURIComponent(id)}/enable`,
  disable: (id) => `modules/${encodeURIComponent(id)}/disable`,
  locale: 'locale',
};

// Theme shell is an enhancement: a dead host (browser preview, routes down)
// must not block the panel from rendering its own error text.
installThemeShell({ hana }).catch(() => {});

let translator = createTranslator(resolveLocale({
  override: null,
  candidates: typeof navigator !== 'undefined' ? navigator.languages : [],
}));

let currentLocaleOverride = null;
let modules = [];
let loadFailed = false;
let currentViewName = 'catalog';
let currentDetailId = null;

const elements = {
  brandName: document.getElementById('brand-name'),
  brandPublisher: document.getElementById('brand-publisher'),
  menuButton: document.getElementById('menu-button'),
  menuList: document.getElementById('menu-list'),
  views: {
    catalog: document.getElementById('view-catalog'),
    detail: document.getElementById('view-detail'),
    about: document.getElementById('view-about'),
  },
};

function apiFetch(path, init) {
  return hana.api.fetch(path, init);
}

async function fetchState() {
  try {
    const response = await apiFetch(API.state);
    if (!response.ok) {
      throw new Error(`state failed with ${response.status}`);
    }
    const state = await response.json();
    const list = Array.isArray(state?.modules) ? state.modules : [];
    modules = list.map((view) => ({
      id: String(view.id),
      status: view.status,
      ...(view.error ? { error: view.error } : {}),
    }));
    if (state && 'locale' in state) {
      currentLocaleOverride = typeof state.locale === 'string' ? state.locale : null;
    }
    loadFailed = false;
  } catch {
    loadFailed = true;
  }
}

async function fetchToggle(id, action) {
  try {
    const response = await apiFetch(API[action](id), { method: 'POST' });
    if (!response.ok) {
      throw new Error(`${action} failed with ${response.status}`);
    }
  } catch {
    // The next reload shows the authoritative state; nothing to render here.
  }
  await fetchState();
}

async function fetchLocaleOverride(locale) {
  try {
    await apiFetch(API.locale, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale }),
    });
  } catch {
    // Optimistic UI; the next reload re-syncs from the stored value.
  }
  currentLocaleOverride = locale;
}

function applyLanguage() {
  translator = createTranslator(resolveLocale({
    override: currentLocaleOverride,
    candidates: typeof navigator !== 'undefined' ? navigator.languages : [],
  }));
  document.documentElement.lang = resolvedTagFor(currentLocaleOverride);
  elements.brandName.textContent = t('app.name');
  elements.brandPublisher.textContent = t('app.publisher');
  elements.menuList.setAttribute('aria-label', t('app.name'));
  elements.menuButton.setAttribute('aria-label', `${t('menu.about')} · ${t('menu.language')}`);
  renderCurrentView();
}

function resolvedTagFor(override) {
  const resolved = resolveLocale({
    override,
    candidates: typeof navigator !== 'undefined' ? navigator.languages : [],
  });
  const tags = { zh: 'zh-CN', 'zh-TW': 'zh-TW', en: 'en', ja: 'ja', ko: 'ko' };
  return tags[resolved] ?? 'zh-CN';
}

function t(key) {
  return translator(key);
}

function clearChildren(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setView(name) {
  currentViewName = name;
  for (const [key, section] of Object.entries(elements.views)) {
    section.hidden = key !== name;
  }
}

function renderCurrentView() {
  if (currentViewName === 'detail') {
    renderDetail();
  } else if (currentViewName === 'about') {
    renderAbout();
  } else {
    renderCatalog();
  }
}

function openDetail(id) {
  currentDetailId = id;
  setView('detail');
  renderDetail();
}

function renderCatalog() {
  const section = elements.views.catalog;
  clearChildren(section);

  if (loadFailed) {
    section.appendChild(el('p', 'load-error', t('error.generic')));
    return;
  }

  const groups = groupViews(modules);
  if (groups.length === 0) {
    section.appendChild(el('p', 'empty-catalog', t('empty.catalog')));
    return;
  }

  for (const group of groups) {
    section.appendChild(el('h2', 'group-title', t(`group.${group.key}`)));
    const grid = el('ul', 'card-grid');
    for (const view of group.views) {
      grid.appendChild(buildCard(view));
    }
    section.appendChild(grid);
  }
}

function buildCard(view) {
  const item = el('li', 'card-shell');
  const card = el('article', `card card-${view.status}`);
  card.dataset.status = view.status;

  card.appendChild(el('h3', 'card-name', t(`module.${view.id}.name`)));
  card.appendChild(el('p', 'card-desc', t(`module.${view.id}.desc`)));

  const footer = el('div', 'card-footer');
  footer.appendChild(statusPill(view.status));

  if (view.status === 'planned') {
    footer.appendChild(el('span', 'card-entries card-entries-readonly'));
  } else {
    const entries = el('div', 'card-entries');
    const toggle = toggleButton(view);
    entries.appendChild(toggle);
    const more = el('button', 'card-details', t('details'));
    more.type = 'button';
    more.addEventListener('click', () => openDetail(view.id));
    entries.appendChild(more);
    footer.appendChild(entries);
  }

  card.appendChild(footer);

  if (view.status === 'failed' || view.status === 'blocked') {
    card.appendChild(buildErrorNote(view));
  }

  item.appendChild(card);
  return item;
}

function statusPill(status) {
  return el('span', `pill pill-${status}`, t(`status.${status}`));
}

function toggleButton(view) {
  const busy = view.status === 'starting' || view.status === 'stopping';
  const button = el('button', `switch switch-${view.status}`, '');
  button.type = 'button';
  button.setAttribute('role', 'switch');
  button.setAttribute('aria-checked', view.status === 'on' ? 'true' : 'false');
  const action = view.status === 'on' || view.status === 'starting'
    ? 'disable'
    : 'enable';
  button.setAttribute('aria-label', t(action === 'enable' ? 'action.enable' : 'action.disable'));
  if (busy) {
    button.disabled = true;
  }
  button.addEventListener('click', () => {
    void fetchToggle(view.id, action).then(renderCurrentView);
  });
  return button;
}

function buildErrorNote(view) {
  const note = el('div', 'card-error');
  note.appendChild(el('p', 'card-error-message', t('error.generic')));
  if (view.status === 'blocked') {
    note.appendChild(el('p', 'card-error-hint', t('hint.blocked')));
  }
  const retry = el('button', 'card-retry', t('action.retry'));
  retry.type = 'button';
  retry.addEventListener('click', () => {
    void fetchToggle(view.id, 'enable').then(renderCurrentView);
  });
  note.appendChild(retry);
  return note;
}

function renderDetail() {
  const section = elements.views.detail;
  clearChildren(section);

  const back = el('button', 'back-button', t('back'));
  back.type = 'button';
  back.addEventListener('click', () => {
    setView('catalog');
    renderCatalog();
  });
  section.appendChild(back);

  const view = modules.find((candidate) => candidate.id === currentDetailId);
  if (!view) {
    section.appendChild(el('p', 'load-error', t('error.generic')));
    return;
  }

  const card = el('article', 'detail-card');
  card.appendChild(el('h2', 'detail-name', t(`module.${view.id}.name`)));
  card.appendChild(el('p', 'detail-desc', t(`module.${view.id}.desc`)));
  card.appendChild(statusPill(view.status));

  if (view.status !== 'planned') {
    const actions = el('div', 'detail-actions');
    actions.appendChild(toggleButton(view));
    section.appendChild(card);
    section.appendChild(actions);
  } else {
    section.appendChild(card);
  }

  if (view.status === 'failed' || view.status === 'blocked') {
    section.appendChild(buildErrorNote(view));
  }
}

function renderAbout() {
  const section = elements.views.about;
  clearChildren(section);

  const back = el('button', 'back-button', t('back'));
  back.type = 'button';
  back.addEventListener('click', () => {
    setView('catalog');
    renderCatalog();
  });
  section.appendChild(back);

  const card = el('article', 'about-card');
  card.appendChild(el('h2', 'about-title', t('about.title')));
  card.appendChild(el('p', 'about-body', t('about.body')));
  const rows = el('dl', 'about-rows');
  rows.appendChild(el('dt', 'about-label', t('about.version')));
  rows.appendChild(el('dd', 'about-value', '0.1.0'));
  rows.appendChild(el('dt', 'about-label', t('about.author')));
  rows.appendChild(el('dd', 'about-value', t('app.publisher')));
  card.appendChild(rows);
  section.appendChild(card);
}

function closeMenu() {
  elements.menuList.hidden = true;
  elements.menuButton.setAttribute('aria-expanded', 'false');
}

function rebuildMenu() {
  const list = elements.menuList;
  clearChildren(list);

  const about = el('button', 'menu-item');
  about.type = 'button';
  about.setAttribute('role', 'menuitem');
  about.textContent = t('menu.about');
  about.addEventListener('click', () => {
    closeMenu();
    setView('about');
    renderAbout();
  });
  list.appendChild(about);

  const language = el('div', 'menu-language');
  language.setAttribute('role', 'group');
  language.setAttribute('aria-label', t('menu.language'));
  const label = el('span', 'menu-language-label', t('menu.language'));
  language.appendChild(label);

  const auto = el('button', 'menu-item');
  auto.type = 'button';
  auto.setAttribute('role', 'menuitemradio');
  auto.setAttribute('aria-checked', currentLocaleOverride === null ? 'true' : 'false');
  auto.textContent = t('menu.languageAuto');
  auto.addEventListener('click', async () => {
    await fetchLocaleOverride(null);
    closeMenu();
    applyLanguage();
  });
  language.appendChild(auto);

  for (const locale of ['zh', 'zh-TW', 'en', 'ja', 'ko']) {
    const option = el('button', 'menu-item');
    option.type = 'button';
    option.setAttribute('role', 'menuitemradio');
    option.setAttribute('aria-checked', currentLocaleOverride === locale ? 'true' : 'false');
    option.textContent = localeDisplayName(locale);
    option.addEventListener('click', async () => {
      await fetchLocaleOverride(locale);
      closeMenu();
      applyLanguage();
    });
    language.appendChild(option);
  }

  list.appendChild(language);
}

function localeDisplayName(locale) {
  const names = {
    'zh': '简体中文',
    'zh-TW': '繁體中文',
    'en': 'English',
    'ja': '日本語',
    'ko': '한국어',
  };
  return names[locale] ?? locale;
}

elements.menuButton.addEventListener('click', () => {
  if (elements.menuList.hidden) {
    rebuildMenu();
    elements.menuList.hidden = false;
    elements.menuButton.setAttribute('aria-expanded', 'true');
  } else {
    closeMenu();
  }
});

document.addEventListener('click', (event) => {
  if (!elements.menuList.hidden && event.target instanceof Node) {
    if (!elements.menuList.contains(event.target) && !elements.menuButton.contains(event.target)) {
      closeMenu();
    }
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !elements.menuList.hidden) {
    closeMenu();
    elements.menuButton.focus();
  }
});

await fetchState();
applyLanguage();
