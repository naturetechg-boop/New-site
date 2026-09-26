const WORDS_PER_MINUTE = 220;

function estimateReadingTime(markdownOrText) {
  if (!markdownOrText) return 1;
  const words = String(markdownOrText)
    .replace(/[#*_`>[\]()!-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

module.exports = estimateReadingTime;
