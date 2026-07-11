import { createHash } from 'node:crypto';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function clampConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(Math.max(number, 0), 1);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  }
  return value ?? null;
}

function uniqueText(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = normalizeText(value);
    const key = canonicalKnowledgeKey(text);
    if (!text || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function characterBigrams(value) {
  const text = canonicalKnowledgeKey(value);
  if (!text) return new Set();
  if (text.length === 1) return new Set([text]);
  return new Set(Array.from({ length: text.length - 1 }, (_, index) => text.slice(index, index + 2)));
}

function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const item of left) {
    if (right.has(item)) intersection += 1;
  }
  return intersection / (left.size + right.size - intersection);
}

export function canonicalKnowledgeKey(value) {
  return normalizeText(value)
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/[\p{P}\p{S}\s]+/gu, '');
}

export function buildQuestionContentHash(question = {}) {
  const semanticContent = {
    title: normalizeText(question.title),
    options: normalizeArray(question.options),
    answer: question.answer ?? '',
    analysis: normalizeText(question.analysis),
    knowledge: normalizeArray(question.knowledge)
  };
  return createHash('sha256').update(JSON.stringify(stableValue(semanticContent))).digest('hex');
}

export function normalizeExtractionPayload(payload = {}) {
  const points = new Map();

  for (const raw of normalizeArray(payload.knowledgePoints || payload.knowledge)) {
    const source = typeof raw === 'string' ? { name: raw } : raw || {};
    const rawName = normalizeText(source.name || source.label || source.canonicalName);
    const canonicalName = normalizeText(source.canonicalName || source.canonical || rawName);
    const canonicalKey = canonicalKnowledgeKey(canonicalName);
    if (!canonicalKey) continue;

    const aliases = uniqueText([
      ...normalizeArray(source.aliases),
      ...(rawName && canonicalKnowledgeKey(rawName) !== canonicalKey ? [rawName] : [])
    ]).filter((alias) => canonicalKnowledgeKey(alias) !== canonicalKey);
    const existing = points.get(canonicalKey);
    const confidence = clampConfidence(source.confidence);

    if (existing) {
      existing.aliases = uniqueText([...existing.aliases, ...aliases]);
      if (confidence !== null) existing.confidence = Math.max(existing.confidence ?? 0, confidence);
      if (!existing.category && normalizeText(source.category)) existing.category = normalizeText(source.category);
      if (!existing.description && normalizeText(source.description)) existing.description = normalizeText(source.description);
      continue;
    }

    points.set(canonicalKey, {
      name: canonicalName || rawName,
      canonicalName: canonicalName || rawName,
      canonicalKey,
      aliases,
      category: normalizeText(source.category),
      description: normalizeText(source.description),
      confidence
    });
  }

  const relations = normalizeArray(payload.relations)
    .map((raw) => {
      const source = normalizeText(raw?.source || raw?.from);
      const target = normalizeText(raw?.target || raw?.to);
      const sourceKey = canonicalKnowledgeKey(source);
      const targetKey = canonicalKnowledgeKey(target);
      if (!sourceKey || !targetKey || sourceKey === targetKey) return null;
      return {
        source,
        target,
        sourceKey,
        targetKey,
        type: normalizeText(raw.type || raw.relation) || 'related',
        label: normalizeText(raw.label) || '相关',
        confidence: clampConfidence(raw.confidence)
      };
    })
    .filter(Boolean);

  return { knowledgePoints: [...points.values()], relations };
}

export function buildCoOccurrencePairs(pointIds = []) {
  const ids = [...new Set(normalizeArray(pointIds).map((item) => normalizeText(item)).filter(Boolean))].sort();
  const pairs = [];
  for (let left = 0; left < ids.length; left += 1) {
    for (let right = left + 1; right < ids.length; right += 1) {
      pairs.push([ids[left], ids[right]]);
    }
  }
  return pairs;
}

export function normalizeUndirectedPair(sourceId, targetId) {
  return [normalizeText(sourceId), normalizeText(targetId)].sort();
}

export function scoreKnowledgeCandidate(source = {}, candidate = {}) {
  const sourceCanonical = canonicalKnowledgeKey(source.canonicalKey || source.name);
  const candidateCanonical = canonicalKnowledgeKey(candidate.canonicalKey || candidate.name);
  if (!sourceCanonical || !candidateCanonical) return 0;
  if (sourceCanonical === candidateCanonical) return 1;

  const sourceAliases = new Set(normalizeArray(source.aliases).map(canonicalKnowledgeKey).filter(Boolean));
  const candidateAliases = new Set(normalizeArray(candidate.aliases).map(canonicalKnowledgeKey).filter(Boolean));
  if (sourceAliases.has(candidateCanonical) || candidateAliases.has(sourceCanonical)) return 0.98;
  for (const alias of sourceAliases) {
    if (candidateAliases.has(alias)) return 0.96;
  }

  const shorter = Math.min(sourceCanonical.length, candidateCanonical.length);
  const longer = Math.max(sourceCanonical.length, candidateCanonical.length);
  if (sourceCanonical.includes(candidateCanonical) || candidateCanonical.includes(sourceCanonical)) {
    return 0.7 + (shorter / longer) * 0.2;
  }
  return jaccard(characterBigrams(sourceCanonical), characterBigrams(candidateCanonical)) * 0.7;
}

export function selectRelationCandidates(source, candidates = [], limit = 20) {
  return normalizeArray(candidates)
    .filter((candidate) => candidate?.id && candidate.id !== source?.id)
    .map((candidate) => ({ ...candidate, candidateScore: scoreKnowledgeCandidate(source, candidate) }))
    .sort((left, right) => (
      right.candidateScore - left.candidateScore ||
      normalizeText(left.name).localeCompare(normalizeText(right.name), 'zh-CN')
    ))
    .slice(0, Math.max(0, Number(limit) || 0));
}
