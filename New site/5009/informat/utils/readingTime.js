const WORDS_PER_MINUTE = 220;

function estimateReadingTime(htmlOrMarkdownOrText) {
  if (!htmlOrMarkdownOrText) return 1;
  const words = String(htmlOrMarkdownOrText)
    .replace(/<[^>]+>/g, ' ') // strip HTML tags (rich-text editor content)
    .replace(/[#*_`>[\]()!-]/g, ' ') // strip leftover Markdown-style symbols, if any
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

module.exports = estimateReadingTime;