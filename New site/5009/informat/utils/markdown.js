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

module.exports = { renderMarkdownToSafeHtml, toPlainText };
