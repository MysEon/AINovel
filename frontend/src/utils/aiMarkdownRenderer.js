const CODE_FENCE_MARKER = '```';

const shouldStartBlockAfter = (character) => character !== '#' && !/[A-Za-z0-9]/.test(character);

const normalizeLooseMarkdown = (value) => {
  let text = value.replace(/\u00a0/g, ' ');

  if (!text.includes('\n') && text.includes('\\n')) {
    text = text.replace(/\\n/g, '\n');
  }

  text = text.replace(
    /([^\n])([ \t]*)([-*_]{3,})(?=[ \t]*(?:#{1,6}|$|\n))/g,
    (_match, before, _spacing, rule) => `${before}\n\n${rule}`
  );

  text = text.replace(
    /(^|\n)([-*_]{3,})[ \t]*(#{1,6})(?=[ \t]*\S)/g,
    '$1$2\n\n$3'
  );

  text = text.replace(
    /([^\n])([ \t]*)(#{1,6})(?=[ \t]*[^\s#])/g,
    (match, before, _spacing, heading) => (
      shouldStartBlockAfter(before) ? `${before}\n\n${heading}` : match
    )
  );

  text = text.replace(/(^|\n)(#{1,6})(?=\S)/g, '$1$2 ');

  text = text.replace(
    /([^\n])([ \t]*)(\d{1,2}[.)][ \t]+)(?=\S)/g,
    (match, before, _spacing, marker) => (
      shouldStartBlockAfter(before) ? `${before}\n\n${marker}` : match
    )
  );

  text = text.replace(
    /([。！？；：:])([ \t]*)([-*+][ \t]+)(?=\S)/g,
    '$1\n\n$3'
  );

  text = text.replace(
    /([^\n])([ \t]*)(>[ \t]+)(?=\S)/g,
    (match, before, _spacing, marker) => (
      shouldStartBlockAfter(before) ? `${before}\n\n${marker}` : match
    )
  );

  text = text.replace(
    /([。！？；：:])([ \t]*)(\*\*[^*\n]{1,36}[：:]\*\*)/g,
    '$1\n\n$3'
  );

  return text.replace(/\n{3,}/g, '\n\n');
};

const normalizeOutsideCodeFences = (markdown) => {
  let result = '';
  let cursor = 0;
  let isInsideFence = false;

  while (cursor < markdown.length) {
    const fenceIndex = markdown.indexOf(CODE_FENCE_MARKER, cursor);

    if (fenceIndex === -1) {
      const segment = markdown.slice(cursor);
      result += isInsideFence ? segment : normalizeLooseMarkdown(segment);
      break;
    }

    const segment = markdown.slice(cursor, fenceIndex);
    result += isInsideFence ? segment : normalizeLooseMarkdown(segment);
    result += CODE_FENCE_MARKER;
    cursor = fenceIndex + CODE_FENCE_MARKER.length;
    isInsideFence = !isInsideFence;
  }

  return result;
};

const closeOpenCodeFence = (markdown) => {
  const fenceCount = (markdown.match(/```/g) || []).length;
  return fenceCount % 2 === 1 ? `${markdown}\n${CODE_FENCE_MARKER}` : markdown;
};

export const formatAssistantMarkdownForRender = (content) => {
  if (content === null || content === undefined) return '';

  const normalizedLineEndings = String(content).replace(/\r\n?/g, '\n');
  return closeOpenCodeFence(normalizeOutsideCodeFences(normalizedLineEndings)).trim();
};
