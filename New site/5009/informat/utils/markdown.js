
const { marked } = require('marked');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

marked.setOptions({
  gfm: true,
  breaks: false,
  headerIds: true,
  mangle: false
});

/**
 * Converts trusted-author Markdown into sanitized HTML safe to render to visitors.
 * Sanitization is still applied even though only admins can write articles,
 * as defense in depth against stored XSS.
 */
function renderMarkdownToSafeHtml(markdown) {
  const rawHtml = marked.parse(markdown || '');
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'strong', 'em', 'ul', 'ol', 'li',
      'blockquote', 'code', 'pre', 'img', 'figure', 'figcaption', 'table', 'thead',
      'tbody', 'tr', 'th', 'td', 'hr', 'br', 'del', 'span'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel']
  });
}

/** Strips HTML/Markdown down to plain text, useful for excerpts/meta descriptions. */
function toPlainText(markdown, maxLength = 160) {
  const text = String(markdown || '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[#*_`>~-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
}

// ---------------------------------------------------------------------------
// The functions below support the WYSIWYG (WordPress-style) article editor,
// which submits already-formed HTML rather than Markdown source. They reuse
// the same DOMPurify instance and allow-list above rather than duplicating
// the JSDOM setup, and are used by the admin article save logic and by the
// public article page as its meta-description fallback.
// ---------------------------------------------------------------------------

/**
 * Sanitizes HTML that already exists as HTML (from the rich-text editor),
 * as opposed to renderMarkdownToSafeHtml above which first parses Markdown
 * source. No Markdown parsing is applied - this only strips anything unsafe.
 */
function sanitizeRichTextHtml(html) {
  return DOMPurify.sanitize(html || '', {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li',
      'blockquote', 'code', 'pre', 'img', 'figure', 'figcaption', 'table', 'thead',
      'tbody', 'tr', 'th', 'td', 'hr', 'br', 'del', 'span', 'div'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel']
  });
}

/** Strips HTML tags down to plain text, for excerpts/meta descriptions when
 * the source content is HTML (from the rich-text editor) rather than Markdown.
 * Pass maxLength as 0 to get the full text back with no truncation. */
function toPlainTextFromHtml(html, maxLength = 160) {
  const text = String(html || '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (!maxLength) return text;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
}

module.exports = { renderMarkdownToSafeHtml, toPlainText, sanitizeRichTextHtml, toPlainTextFromHtml };