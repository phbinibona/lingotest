/* LingoTotal collection upgrade
   Add before </body> on pages that already use lingototal_saved_sentences_v2:
   <script src="collection-upgrade.js"></script>
*/

(function () {

  const KEY = 'lingototal_saved_sentences_v2';

  function get() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
      return [];
    }
  }

  function set(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
  }

  function normalise(item) {

    // Allows old collections containing only plain text sentences
    if (typeof item === 'string') {
      return {
        sentence: item
      };
    }

    return {
      sentence: String(
        item.sentence ||
        item.text ||
        ''
      ).trim(),

      targetLanguage:
        item.targetLanguage ||
        item.language ||
        '',

      targetName:
        item.targetName ||
        item.targetLanguage ||
        item.language ||
        '',

      theme:
        item.theme ||
        item.category ||
        '',

      source:
        item.source ||
        'LingoTotal',

      savedDate:
        item.savedDate ||
        new Date().toISOString().slice(0, 10),

      review:
        item.review || {
          times: 0,
          correct: 0,
          wrong: 0,
          lastPractised: null
        }
    };
  }


  function unique(items) {

    const seen = new Set();

    return items
      .map(normalise)
      .filter(item => item.sentence)
      .filter(item => {

        const key = (
          item.targetLanguage +
          '|' +
          item.sentence
        ).toLowerCase();

        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });
  }


  function downloadFile(filename, type, data) {

    const blob = new Blob(
      [data],
      { type: type }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');

    link.href = url;
    link.download = filename;

    link.click();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 500);
  }


  window.LingoTotalCollection = {

    /*
      Get the learner's current collection
    */
    get: function () {
      return unique(get());
    },


    /*
      Download a complete structured backup.

      This JSON file can later be uploaded back
      into LingoTotal.
    */
    backup: function () {

      const collection = unique(get());

      const date =
        new Date()
          .toISOString()
          .slice(0, 10);

      const backup = {
        lingototalCollection: true,
        version: 2,
        exported: new Date().toISOString(),
        phrases: collection
      };

      downloadFile(
        'LingoTotal-My-Language-' +
        date +
        '.json',

        'application/json;charset=utf-8',

        JSON.stringify(
          backup,
          null,
          2
        )
      );
    },


    /*
      Download a simple readable TXT version.

      This is useful if the learner simply
      wants to read or print the collection.
    */
    readable: function () {

      const collection = unique(get());

      const date =
        new Date()
          .toISOString()
          .slice(0, 10);

      const text = collection
        .map((item, index) => {

          let line =
            (index + 1) +
            '. ';

          if (item.targetLanguage) {
            line +=
              '[' +
              item.targetLanguage +
              '] ';
          }

          if (item.theme) {
            line +=
              '[' +
              item.theme +
              '] ';
          }

          line += item.sentence;

          return line;

        })
        .join('\n');


      downloadFile(
        'LingoTotal-My-Language-' +
        date +
        '.txt',

        'text/plain;charset=utf-8',

        '\uFEFF' + text
      );
    },


    /*
      Read an uploaded collection.

      Accepts:
      - LingoTotal JSON backups
      - older JSON collections
      - simple TXT lists
    */
    readFile: async function (file) {

      const text =
        await file.text();

      let phrases;


      if (
        file.name
          .toLowerCase()
          .endsWith('.json')
      ) {

        const data =
          JSON.parse(text);

        if (Array.isArray(data)) {

          phrases = data;

        } else {

          phrases =
            data.phrases ||
            data.sentences ||
            [];

        }

      } else {

        /*
          Plain text collection.

          Removes numbering such as:

          1. sentence
          2. sentence
        */

        phrases = text
          .split(/\r?\n/)
          .map(line =>

            line
              .replace(
                /^\s*\d+[.)]\s*/,
                ''
              )
              .trim()

          )
          .filter(Boolean);
      }


      return unique(phrases);
    },


    /*
      Add uploaded phrases to the collection.

      Existing phrases are retained.

      Duplicate sentences are removed.
    */
    merge: function (items) {

      const current =
        get();

      const merged =
        unique([
          ...items,
          ...current
        ]);

      set(merged);

      return merged;
    }

  };

})();