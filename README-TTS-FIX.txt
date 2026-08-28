LINGOTOTAL TTS STANDARDISATION — 28 AUGUST 2026

This package standardises audio routing for the current index-linked LingoTotal pages.

RULES
- Interface language controls interface text only.
- Target language controls TTS for current activity content.
- Saved phrases use the targetLanguage stored on that individual phrase.
- Both {language: ...} and {languageCode: ...} are accepted by the Netlify functions.
- Language names, short codes and locale codes are normalised.
- lingototal-audio.js queues long text so complete playback is preserved.

UPLOAD
1. Replace the matching HTML files in the repository root.
2. Put lingototal-audio.js in the repository root beside the HTML pages.
3. Put tts.js and google-tts.js in the Netlify functions folder.
4. Keep GOOGLE_TTS_API_KEY configured in Netlify.
5. Commit/push and redeploy.

TEST
- English interface -> Italian target: Italian voice.
- Spanish interface -> German target: German voice.
- LingoPractice mixed collection: each saved phrase should use its own voice.
