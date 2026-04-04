import { EN_PARSER_LOCALE } from './parser-locale-en.js';
import { RU_PARSER_LOCALE } from './parser-locale-ru.js';
import { ZH_PARSER_LOCALE } from './parser-locale-zh.js';
import { FR_PARSER_LOCALE } from './parser-locale-fr.js';

const LOCALES = {
  'en': EN_PARSER_LOCALE,
  'ru': RU_PARSER_LOCALE,
  'zh': ZH_PARSER_LOCALE,
  'cn': ZH_PARSER_LOCALE,  // module.json uses "cn" as the lang code for Simplified Chinese
  'fr': FR_PARSER_LOCALE,
};

/**
 * Returns the parser locale for the current game language, falling back to EN.
 * The result is cached — call resetParserLocaleCache() if the language changes at runtime.
 * A temporary override (set via withLocale) takes priority over the cache.
 */
let _cached = null;
let _override = null;

export function getParserLocale() {
  if (_override) return _override;
  if (_cached) return _cached;
  const lang = (game?.i18n?.lang ?? 'en').split('-')[0].toLowerCase();
  _cached = LOCALES[lang] ?? LOCALES['en'];
  return _cached;
}

export function getEnParserLocale() {
  return LOCALES['en'];
}

/**
 * Run `fn` with a temporary locale override.  All calls to getParserLocale()
 * inside `fn` will return `locale` instead of the session locale.
 */
export function withLocale(locale, fn) {
  const prev = _override;
  _override = locale;
  try {
    return fn();
  } finally {
    _override = prev;
  }
}

export function resetParserLocaleCache() {
  _cached = null;
}
