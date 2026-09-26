document.addEventListener('DOMContentLoaded', function () {
  var contentField = document.getElementById('contentMarkdown');
  if (contentField && window.SimpleMDE) {
    // eslint-disable-next-line no-unused-vars
    var easyMDE = new SimpleMDE({
      element: contentField,
      spellChecker: false,
      status: ['lines', 'words'],
      placeholder: 'Write your article in Markdown…'
    });
  }

  var statusSelect = document.getElementById('status');
  var scheduledField = document.getElementById('scheduled-field');
  if (statusSelect && scheduledField) {
    statusSelect.addEventListener('change', function () {
      scheduledField.style.display = this.value === 'scheduled' ? '' : 'none';
    });
  }

  var fileInput = document.getElementById('featuredImageFile');
  var form = document.getElementById('article-form');
  if (fileInput && form) {
    fileInput.addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;

      var statusEl = document.getElementById('upload-status');
      statusEl.textContent = 'Uploading…';

      var csrfToken = form.querySelector('input[name="_csrf"]').value;
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
            statusEl.textContent = 'Error: ' + data.error;
            return;
          }
          document.getElementById('featuredImageFileId').value = data.fileId;
          document.getElementById('featuredImageUrl').value = '';
          statusEl.textContent = 'Uploaded.';
          document.getElementById('upload-preview').innerHTML =
            '<img src="' + data.url + '" alt="" style="max-width:220px; border-radius:6px; border:1px solid var(--a-line);">';
        })
        .catch(function () {
          statusEl.textContent = 'Upload failed. Please try again.';
        });
    });
  }
});
