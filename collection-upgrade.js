/* ============================================================
   LingoTotal Collection Upgrade
   collection-upgrade.js

   Central helper for the learner's saved language collection.

   Main storage key:
   lingototal_saved_sentences_v2

   Include before </body>:

   <script src="collection-upgrade.js"></script>
   ============================================================ */

(function () {
  'use strict';

  const KEY = 'lingototal_saved_sentences_v2';

  /*
    Older keys that may have been used by previous
    versions of LingoTotal.
  */
  const OLD_KEYS = [
    'lingototal_saved_sentences',
    'lingototal_saved_phrases',
    'lingototal_collection',
    'saved_sentences',
    'saved_phrases'
  ];


  /* ============================================================
     SAFE JSON
     ============================================================ */

  function safeParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }


  /* ============================================================
     NORMALISE LANGUAGE CODES
     ============================================================ */

  function normaliseLanguage(language) {
    if (!language) return '';

    const value = String(language).trim();

    const aliases = {
      english: 'en',
      en: 'en',

      català: 'ca',
      catalan: 'ca',
      ca: 'ca',

      español: 'es',
      spanish: 'es',
      castellano: 'es',
      es: 'es',

      français: 'fr',
      french: 'fr',
      fr: 'fr',

      deutsch: 'de',
      german: 'de',
      de: 'de',

      euskara: 'eu',
      basque: 'eu',
      eu: 'eu',

      cymraeg: 'cy',
      welsh: 'cy',
      cy: 'cy',

      gaelic: 'gd',
      'scottish gaelic': 'gd',
      gàidhlig: 'gd',
      gd: 'gd',

      svenska: 'sv',
      swedish: 'sv',
      sv: 'sv',

      japanese: 'ja',
      日本語: 'ja',
      ja: 'ja',

      arabic: 'ar',
      العربية: 'ar',
      ar: 'ar'
    };

    const lower = value.toLowerCase();

    return aliases[lower] || value;
  }


  /* ============================================================
     LANGUAGE DISPLAY NAME
     ============================================================ */

  function languageName(code) {
    const names = {
      en: 'English',
      ca: 'Català',
      es: 'Español',
      fr: 'Français',
      de: 'Deutsch',
      eu: 'Euskara',
      cy: 'Cymraeg',
      gd: 'Gàidhlig',
      sv: 'Svenska',
      ja: '日本語',
      ar: 'العربية'
    };

    return names[code] || code || '';
  }


  /* ============================================================
     NORMALISE ONE SAVED ITEM
     ============================================================ */

  function normalise(item) {

    /*
      Very old collections may contain only strings.
    */
    if (typeof item === 'string') {
      const sentence = item.trim();

      return {
        sentence: sentence,
        text: sentence,
        targetLanguage: '',
        language: '',
        targetName: '',
        theme: '',
        source: 'LingoTotal',
        savedDate: new Date().toISOString().slice(0, 10),
        review: {
          times: 0,
          correct: 0,
          wrong: 0,
          lastPractised: null
        }
      };
    }


    if (!item || typeof item !== 'object') {
      return null;
    }


    const sentence = String(
      item.sentence ||
      item.text ||
      item.phrase ||
      item.content ||
      item.answer ||
      ''
    ).trim();


    if (!sentence) {
      return null;
    }


    const rawLanguage =
      item.targetLanguage ||
      item.targetLang ||
      item.language ||
      item.lang ||
      item.languageCode ||
      '';


    const targetLanguage =
      normaliseLanguage(rawLanguage);


    const targetName =
      item.targetName ||
      item.languageName ||
      languageName(targetLanguage);


    return {
      /*
        We deliberately keep BOTH sentence and text.

        Some older LingoTotal pages look for:
          item.sentence

        while some newer pages look for:
          item.text

        Keeping both makes the collection compatible
        with all pages.
      */
      sentence: sentence,
      text: sentence,

      targetLanguage: targetLanguage,
      language: targetLanguage,

      targetName: targetName,

      theme:
        item.theme ||
        item.topic ||
        item.category ||
        '',

      source:
        item.source ||
        item.activity ||
        'LingoTotal',

      savedDate:
        item.savedDate ||
        item.date ||
        new Date().toISOString().slice(0, 10),

      review: {
        times:
          Number(
            item.review &&
            item.review.times
          ) || 0,

        correct:
          Number(
            item.review &&
            item.review.correct
          ) || 0,

        wrong:
          Number(
            item.review &&
            item.review.wrong
          ) || 0,

        lastPractised:
          item.review &&
          item.review.lastPractised
            ? item.review.lastPractised
            : null
      }
    };
  }


  /* ============================================================
     REMOVE DUPLICATES
     ============================================================ */

  function unique(items) {

    if (!Array.isArray(items)) {
      return [];
    }

    const seen = new Set();

    return items
      .map(normalise)