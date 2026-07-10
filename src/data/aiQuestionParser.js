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
    knowledge: normalizeList(raw.knowledge || raw.knowledgePoints),
    targetReason: String(raw.targetReason || raw.reason || '').trim(),
    remediationTip: String(raw.remediationTip || raw.tip || '').trim()
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

function extractSingleQuestionBlocks(text) {
  const blocks = [];
  const pattern = /:::question-start\s*([\s\S]*?)\s*:::question-end/g;
  let match = pattern.exec(text);
  while (match) {
    blocks.push(match[1].trim());
    match = pattern.exec(text);
  }
  return blocks;
}

export function getQuestionStreamInstructions() {
  return [
    '流式输出时，每道题必须独立包裹在 :::question-start 和 :::question-end 之间。',
    '每个 :::question-start 到 :::question-end 中间只能放一题的完整 JSON 对象。',
    '不要把多题数组放进单题块。每完成一道题就立即输出该题块。',
    '单题块格式：',
    ':::question-start',
    '{',
    '  "type": "单选题",',
    '  "stage": "课中",',
    '  "difficulty": "基础",',
    '  "title": "题干",',
    '  "options": ["A", "B", "C", "D"],',
    '  "answer": "正确答案",',
    '  "analysis": "解析",',
    '  "knowledge": ["知识点"]',
    '}',
    ':::question-end'
  ].join('\n');
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

function parseSingleQuestionBlock(block) {
  try {
    return normalizeQuestion(JSON.parse(block));
  } catch {
    return null;
  }
}

export function parseQuestionsFromAiText(text = '') {
  const content = String(text);
  return [
    ...extractQuestionBlocks(content).flatMap(parseBlock),
    ...extractSingleQuestionBlocks(content).map(parseSingleQuestionBlock).filter(Boolean)
  ];
}

export function createStreamingQuestionParser(initialBuffer = '') {
  let buffer = String(initialBuffer || '');

  return {
    push(chunk = '') {
      buffer += String(chunk || '');
      const questions = [];
      const pattern = /:::question-start\s*([\s\S]*?)\s*:::question-end|:::questions\s*([\s\S]*?)\s*:::/g;
      let lastEnd = 0;
      let match = pattern.exec(buffer);

      while (match) {
        if (match[1]) {
          const question = parseSingleQuestionBlock(match[1].trim());
          if (question) questions.push(question);
        }
        if (match[2]) {
          questions.push(...parseBlock(match[2].trim()));
        }
        lastEnd = pattern.lastIndex;
        match = pattern.exec(buffer);
      }

      if (lastEnd > 0) {
        buffer = buffer.slice(lastEnd);
      }
      return questions;
    },
    getBuffer() {
      return buffer;
    },
    reset(nextBuffer = '') {
      buffer = String(nextBuffer || '');
    }
  };
}
