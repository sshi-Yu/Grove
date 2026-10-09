import assert from 'node:assert/strict';
import test from 'node:test';

import { DICTIONARIES, SUPPORTED_LOCALES, createTranslator, resolveLocale } from '../core/i18n.js';

const ALL_KEYS = [
  'app.name',
  'app.chineseName',
  'app.publisher',
  'menu.about',
  'menu.language',
  'menu.languageAuto',
  'about.title',
  'about.body',
  'about.version',
  'about.author',
  'back',
  'details',
  'group.on',
  'group.off',
  'group.attention',
  'group.planned',
  'status.planned',
  'status.off',
  'status.starting',
  'status.on',
  'status.blocked',
  'status.failed',
  'status.stopping',
  'action.enable',
  'action.disable',
  'action.retry',
  'hint.blocked',
  'empty.catalog',
  'error.generic',
  'module.session-stats.name',
  'module.session-stats.desc',
  'module.token-stats.name',
  'module.token-stats.desc',
  'module.task-manager.name',
  'module.task-manager.desc',
];

test('SUPPORTED_LOCALES lists the five supported locales', () => {
  assert.deepEqual(SUPPORTED_LOCALES, ['zh', 'zh-TW', 'en', 'ja', 'ko']);
});

test('resolveLocale handles undefined, empty string, zh-Hant-HK, EN-us, fr', () => {
  assert.equal(resolveLocale({}), 'zh');
  assert.equal(resolveLocale({ candidates: undefined }), 'zh');
  assert.equal(resolveLocale({ override: undefined, candidates: undefined }), 'zh');
  assert.equal(resolveLocale({ candidates: [''] }), 'zh');
  assert.equal(resolveLocale({ candidates: ['zh-Hant-HK'] }), 'zh-TW');
  assert.equal(resolveLocale({ candidates: ['EN-us'] }), 'en');
  assert.equal(resolveLocale({ candidates: ['fr'] }), 'zh');
});

test('resolveLocale maps zh-HK and zh-MO to zh-TW and other zh tags to zh', () => {
  assert.equal(resolveLocale({ candidates: ['zh-HK'] }), 'zh-TW');
  assert.equal(resolveLocale({ candidates: ['zh-MO'] }), 'zh-TW');
  assert.equal(resolveLocale({ candidates: ['zh-Hant'] }), 'zh-TW');
  assert.equal(resolveLocale({ candidates: ['zh-Hant-TW'] }), 'zh-TW');
  assert.equal(resolveLocale({ candidates: ['zh-CN'] }), 'zh');
  assert.equal(resolveLocale({ candidates: ['zh-Hans'] }), 'zh');
  assert.equal(resolveLocale({ candidates: ['zh-SG'] }), 'zh');
  assert.equal(resolveLocale({ candidates: ['zh-tw'] }), 'zh-TW');
});

test('resolveLocale matches candidates in order', () => {
  assert.equal(resolveLocale({ candidates: ['fr', 'ja-JP'] }), 'ja');
  assert.equal(resolveLocale({ candidates: ['fr', 'ko', 'en'] }), 'ko');
  assert.equal(resolveLocale({ candidates: ['zh', 'en'] }), 'zh');
  assert.equal(resolveLocale({ candidates: ['en-US', 'zh-TW'] }), 'en');
  assert.equal(resolveLocale({ candidates: [] }), 'zh');
});

test('resolveLocale override wins when supported and is ignored when not', () => {
  assert.equal(resolveLocale({ override: 'en' }), 'en');
  assert.equal(resolveLocale({ override: 'ja', candidates: ['zh'] }), 'ja');
  assert.equal(resolveLocale({ override: 'fr' }), 'zh');
  assert.equal(resolveLocale({ override: 'fr', candidates: ['ja'] }), 'ja');
  assert.equal(resolveLocale({ override: '' }), 'zh');
  assert.equal(resolveLocale({ override: null }), 'zh');
});

test('resolveLocale ignores non-string entries in candidates', () => {
  assert.equal(resolveLocale({ candidates: [null, undefined, 42, 'en'] }), 'en');
});

test('every supported locale defines every key', () => {
  for (const locale of SUPPORTED_LOCALES) {
    const dictionary = DICTIONARIES[locale];
    for (const key of ALL_KEYS) {
      const value = dictionary[key];
      assert.equal(typeof value, 'string', `${locale} is missing ${key}`);
      assert.ok(value.trim().length > 0, `${locale} has a blank string for ${key}`);
    }
  }
});

test('every dictionary defines exactly the expected keys', () => {
  const expected = [...ALL_KEYS].sort();
  for (const locale of SUPPORTED_LOCALES) {
    assert.deepEqual(Object.keys(DICTIONARIES[locale]).sort(), expected);
  }
});

test('createTranslator falls back to zh then key', () => {
  const t = createTranslator('en');
  assert.equal(t('app.name'), 'Grove');
  assert.equal(t('not.a.key'), 'not.a.key');

  const ja = createTranslator('ja');
  assert.equal(ja('app.chineseName'), '林间');

  const partial = {
    zh: { 'greets.hello': '你好' },
    en: { 'greets.welcome': 'Welcome' },
  };
  const partialT = createTranslator('en', partial);
  assert.equal(partialT('greets.welcome'), 'Welcome');
  assert.equal(partialT('greets.hello'), '你好');
  assert.equal(partialT('greets.nope'), 'greets.nope');
});

test('createTranslator rejects unsupported locales', () => {
  assert.throws(() => createTranslator('fr'), /fr/);
  assert.throws(() => createTranslator(''), /locale/);
  assert.throws(() => createTranslator(42), /locale/);
});
