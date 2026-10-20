/**
 * Utility to strip Markdown formatting, HTML tags, and noisy punctuation
 * so that Text-To-Speech (Gemini TTS or Browser SpeechSynthesis) reads
 * smooth, natural, and clean spoken English without reading out '#', '|', etc.
 */
export function cleanMarkdownForSpeech(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';

  let text = rawText;

  // 1. Normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Remove HTML comments and raw HTML tags
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  text = text.replace(/<[^>]+>/g, ' ');

  // 3. Remove fenced code blocks (```...```) but keep inner text as readable content
  text = text.replace(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g, (_match, code) => {
    return `\n${code}\n`;
  });

  // 4. Remove inline code backticks `code`
  text = text.replace(/`([^`]+)`/g, '$1');

  // 5. Remove image tags: ![alt text](url) -> keep alt text if present
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');

  // 6. Convert markdown links: [anchor text](url) -> anchor text only (prevents reading URLs out loud)
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 7. Remove reference-style links [text][id] and definition blocks
  text = text.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');
  text = text.replace(/^\[[^\]]+\]:\s*.*$/gm, '');

  // 8. Remove markdown horizontal rules (---, ***, ___ on own line)
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');

  // 9. Remove markdown table header separator lines (| --- | :---: | ---: |)
  text = text.replace(/^\|?[\s-:]+(\|[\s-:]+)+\|?$/gm, '');

  // 10. Clean markdown table rows: replace pipes with commas for natural speech pause
  text = text.replace(/^\|(.*)\|$/gm, (_match, rowContent) => {
    return rowContent
      .split('|')
      .map((cell: string) => cell.trim())
      .filter((cell: string) => cell.length > 0)
      .join(', ');
  });

  // Remove any leftover stray pipe characters |
  text = text.replace(/\|/g, ', ');

  // 11. Strip heading hashtags (# Heading, ## Subheading, etc.)
  text = text.replace(/^#{1,6}\s+/gm, '');

  // 12. Strip blockquote symbols (> quote, >> quote)
  text = text.replace(/^>+\s*/gm, '');

  // 13. Strip unordered list bullets (- item, * item, + item)
  text = text.replace(/^[-*+]\s+/gm, '');

  // 14. Strip task list checkboxes (- [ ] task, - [x] task)
  text = text.replace(/^\[[ xX]\]\s*/gm, '');

  // 15. Strip bold / italic / strikethrough markers (**bold**, *italic*, __bold__, _italic_, ~~strike~~)
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');
  text = text.replace(/~~(.*?)~~/g, '$1');

  // 16. Remove backslash escapes (\# -> #, \* -> *)
  text = text.replace(/\\([#*_`~[\]()<>+-.!|])/g, '$1');

  // 17. Clean up repetitive symbols that TTS pronounces awkwardly
  text = text.replace(/[=]{2,}/g, ' ');
  text = text.replace(/[-]{2,}/g, ' ');
  text = text.replace(/[*]{2,}/g, ' ');
  text = text.replace(/[_]{2,}/g, ' ');
  text = text.replace(/[~]{2,}/g, ' ');

  // 18. Clean up extra whitespace and empty lines
  text = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n\n');

  return text.trim();
}
