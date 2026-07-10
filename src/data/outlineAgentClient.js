function getContentText(value) {
  if (Array.isArray(value)) return value.join('\n');
  return String(value || '');
}

function normalizeTone(value, fallback = 'default') {
  const tone = String(value || '').trim();
  return ['default', 'focus', 'warning', 'success', 'muted'].includes(tone) ? tone : fallback;
}

export function extractOutlineJsonBlock(content) {
  const match = getContentText(content).match(/:::outline-json\s*([\s\S]*?):::/i);
  return match ? match[1].trim() : '';
}

export function stripOutlineJsonBlock(content) {
  return getContentText(content).replace(/:::outline-json\s*[\s\S]*?:::/i, '').trim();
}

export function normalizeOutlinePayload(payload = {}) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('outline payload must be an object');
  }
  if (!Array.isArray(payload.sections) || payload.sections.length === 0) {
    throw new Error('outline payload sections must contain at least one section');
  }

  const tags = Array.isArray(payload.tags)
    ? payload.tags.map((tag) => (
      typeof tag === 'string'
        ? { text: tag, tone: 'default' }
        : { text: String(tag.text || tag.label || '').trim(), tone: normalizeTone(tag.tone) }
    )).filter((tag) => tag.text)
    : [];

  const sections = payload.sections.map((section, sectionIndex) => {
    for (const key of ['phase', 'time', 'title']) {
      if (!String(section?.[key] || '').trim()) {
        throw new Error(`outline section ${sectionIndex + 1} missing ${key}`);
      }
    }

    const cards = Array.isArray(section.cards) ? section.cards : [];
    if (cards.length === 0) {
      throw new Error(`outline section ${sectionIndex + 1} cards must contain at least one card`);
    }

    return {
      id: String(section.id || `section-${sectionIndex + 1}`),
      phase: String(section.phase).trim(),
      time: String(section.time).trim(),
      title: String(section.title).trim(),
      status: String(section.status || '').trim(),
      active: Boolean(section.active),
      cards: cards.map((card, cardIndex) => {
        const label = Array.isArray(card) ? card[0] : card?.label;
        const content = Array.isArray(card) ? card[1] : card?.content;
        if (!String(label || '').trim() || !String(content || '').trim()) {
          throw new Error(`outline section ${sectionIndex + 1} card ${cardIndex + 1} missing label or content`);
        }
        return {
          label: String(label).trim(),
          content: String(content).trim(),
          tone: normalizeTone(Array.isArray(card) ? undefined : card.tone)
        };
      })
    };
  });

  return {
    version: String(payload.version || 'v1'),
    tags,
    sections
  };
}

export async function requestOutlineAgent(payload = {}) {
  const response = await fetch('/api/outline-agent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || 'AI outline agent request failed');
  }
  return result;
}
