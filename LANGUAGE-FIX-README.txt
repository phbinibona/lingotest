LINGOTOTAL LANGUAGE FIX — 25 AUGUST 2026

Upload these files to the repository root, replacing the existing files with the same names.

Core repair:
- index.html now restores ui and target from URL parameters first, then localStorage.
- every activity preserves ui + target when returning to index.
- every activity synchronises the canonical localStorage keys.
- LingoPractice no longer forces Italian, Portuguese, Basque, Japanese or Arabic to English.
- LingoQuiz now persists inherited language choices and uses English as the neutral fallback target.
- Learn from Me now persists inherited choices and uses English as its neutral fallback.
- lingomatching.html is supplied under the exact filename expected by the index.

Canonical keys:
lingototal_ui_language
lingototal_target_language

Canonical URL:
?page.html?ui=<interface-code>&target=<English-language-name>
