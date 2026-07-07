function normalizeList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function normalizeQuestion(raw = {}) {
  const title = String(raw.title || raw.question || '').trim();
  if (!title) return null;

  return {
    type: String(raw.type || 'single-choice').trim(),
    stage: String(raw.stage || 'in-class').trim(),
    difficulty: String(raw.difficulty || 'basic').trim(),
    title,
    options: normalizeList(raw.options),
    answer: String(raw.answer ?? '').trim(),
    analysis: String(raw.analysis || raw.explanation || '').trim(),
    knowledge: normalizeList(raw.knowledge || raw.knowledgePoints)
  };
}

function extractQuestionBlocks(text) {
  const blocks = [];
  const pattern = /:::questions\s*([\s\S]*?)\s*:::/g;
  let match = pattern.exec(text);
  while (match) {
    blocks.push(match[1].trim());
    match = pattern.exec(text);
  }
  return blocks;
}

function parseBlock(block) {
  try {
    const parsed = JSON.parse(block);
    const list = Array.isArray(parsed) ? parsed : parsed.questions;
    if (!Array.isArray(list)) return [];
    return list.map(normalizeQuestion).filter(Boolean);
  } catch {
    return [];
  }
}

export function parseQuestionsFromAiText(text = '') {
  return extractQuestionBlocks(String(text))
    .flatMap(parseBlock);
}
