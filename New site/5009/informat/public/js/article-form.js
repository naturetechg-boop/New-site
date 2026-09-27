document.addEventListener('DOMContentLoaded', function () {
  // ---------- TEMPORARY DIAGNOSTIC - safe to remove once editor issue is solved ----------
  (function () {
    function exists(id) { return !!document.getElementById(id); }
    var checks = {
      'content-editor (the writing box)': exists('content-editor'),
      'contentMarkdown (hidden save field)': exists('contentMarkdown'),
      'article-form (the whole form)': exists('article-form'),
      'insert-image-btn (Image button)': exists('insert-image-btn'),
      'editor-image-file (hidden file picker)': exists('editor-image-file'),
      'editor-toolbar (button container)': exists('editor-toolbar')
    };
    var allGood = Object.keys(checks).every(function (k) { return checks[k]; });
    var lines = Object.keys(checks).map(function (k) {
      return (checks[k] ? '\u2705 ' : '\u274c ') + k;
    });
    var banner = document.createElement('div');
    banner.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:999999;padding:12px;' +
      'font-family:monospace;font-size:12px;line-height:1.6;color:#fff;' +
      'background:' + (allGood ? '#2f6b4f' : '#a3372c') + ';white-space:pre-wrap;';
    banner.textContent = 'DIAGNOSTIC (this script IS running):\n' + lines.join('\n');
    document.body.insertBefore(banner, document.body.firstChild);
  })();
  // ---------- End diagnostic - normal code continues below ----------

  // ---------- Scheduled-date field toggle ----------
  var statusSelect = document.getElementById('status');
  var scheduledField = document.getElementById('scheduled-field');
  if (statusSelect && scheduledField) {
    statusSelect.addEventListener('change', function () {
      scheduledField.style.display = this.value === 'scheduled' ? '' : 'none';
    });
  }

  // ---------- Featured image: local preview only (no network call needed) ----------
  var featuredFileInput = document.getElementById('featuredImageFile');
  var featuredPreviewBox = document.getElementById('upload-preview');
  if (featuredFileInput && featuredPreviewBox && window.FileReader) {
    featuredFileInput.addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (event) {
        featuredPreviewBox.innerHTML =
          '<img src="' + event.target.result + '" alt="" style="max-width:220px; border-radius:6px; border:1px solid var(--a-line);">';
      };
      reader.readAsDataURL(file);
    });
  }

  // ---------- Article content: WordPress-style rich text editor ----------
  var editor = document.getElementById('content-editor');
  var hiddenContentField = document.getElementById('contentMarkdown');
  var form = document.getElementById('article-form');

  if (editor && hiddenContentField && form) {
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch (e) {
      // Non-fatal if a browser doesn't support this - content still saves fine either way.
    }

    form.addEventListener('submit', function () {
      hiddenContentField.value = editor.innerHTML;
    });

    var toolbarButtons = document.querySelectorAll('#editor-toolbar button[data-cmd]');
    toolbarButtons.forEach(function (btn) {
      btn.addEventListener('mousedown', function (e) {
        e.preventDefault();
      });
      btn.addEventListener('click', function () {
        var cmd = btn.getAttribute('data-cmd');
        var value = btn.getAttribute('data-value') || null;
        editor.focus();
        if (cmd === 'createLink') {
          var url = window.prompt('Enter the link URL:', 'https://');
          if (!url) return;
          document.execCommand('createLink', false, url);
          return;
        }
        document.execCommand(cmd, false, value);
      });
    });

    var insertImageBtn = document.getElementById('insert-image-btn');
    var editorImageFile = document.getElementById('editor-image-file');
    var editorImageStatus = document.getElementById('editor-image-status');
    var savedRange = null;

    function saveCurrentSelection() {
      var sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
        savedRange = sel.getRangeAt(0).cloneRange();
      } else {
        savedRange = null;
      }
    }

    function restoreSelectionOrPlaceAtEnd() {
      var sel = window.getSelection();
      sel.removeAllRanges();
      if (savedRange) {
        sel.addRange(savedRange);
        return;
      }
      editor.focus();
      var range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.addRange(range);
    }

    if (insertImageBtn && editorImageFile) {
      insertImageBtn.addEventListener('mousedown', function (e) {
        e.preventDefault();
      });
      insertImageBtn.addEventListener('click', function () {
        saveCurrentSelection();
        editorImageFile.click();
      });

      editorImageFile.addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (!file) return;

        editorImageStatus.textContent = 'Uploading image…';

        var csrfInput = form.querySelector('input[name="_csrf"]');
        var csrfToken = csrfInput ? csrfInput.value : '';
        var formData = new FormData();
        formData.append('file', file);

        fetch('/admin/articles/upload-image', {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrfToken },
          body: formData
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data.error) {
              editorImageStatus.textContent = 'Error: ' + data.error;
              return;
            }

            restoreSelectionOrPlaceAtEnd();

            var caption = window.prompt('Add a caption for this image (leave blank for none):', '') || '';
            var escapedCaption = caption
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;');

            var figureHtml =
              '<figure><img src="' + data.url + '" alt="' + escapedCaption + '">' +
              (caption ? '<figcaption>' + escapedCaption + '</figcaption>' : '') +
              '</figure><p><br></p>';

            document.execCommand('insertHTML', false, figureHtml);

            editorImageStatus.textContent = 'Image inserted.';
            editorImageFile.value = '';
          })
          .catch(function () {
            editorImageStatus.textContent = 'Upload failed. Please try again.';
          });
      });
    }
  }
});