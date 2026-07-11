import {
  buildCoOccurrencePairs,
  buildQuestionContentHash,
  canonicalKnowledgeKey,
  normalizeExtractionPayload,
  normalizeUndirectedPair,
  selectRelationCandidates
} from './questionKnowledgeGraphDomain.js';

function createHttpError(statusCode, code, message, details = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueText(values) {
  const seen = new Set();
  const result = [];
  for (const value of normalizeArray(values)) {
    const text = normalizeText(value);
    const key = canonicalKnowledgeKey(text);
    if (!text || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function relationLabel(type) {
  const labels = {
    co_occurrence: '共同考查',
    prerequisite: '前置知识',
    derivation: '推导关系',
    application: '应用于',
    confusable: '易混淆',
    related: '相关'
  };
  return labels[type] || '相关';
}

function semanticQuestionChanged(before = {}, after = {}) {
  return buildQuestionContentHash(before) !== buildQuestionContentHash(after);
}

function pointIndex(points) {
  const index = new Map();

  for (const point of points) {
    const key = canonicalKnowledgeKey(point.canonicalKey);
    if (key) index.set(key, point);
  }

  for (const point of points) {
    const keys = [point.name, ...normalizeArray(point.aliases)]
      .map(canonicalKnowledgeKey)
      .filter(Boolean);
    for (const key of keys) {
      if (!index.has(key)) index.set(key, point);
    }
  }
  return index;
}

export function createQuestionKnowledgeGraphService(prisma, { aiQuestionKnowledgeService = null } = {}) {
  async function requireBank(client, bankId) {
    const bank = await client.questionBank.findUnique({ where: { id: bankId } });
    if (!bank || bank.status !== 'active') {
      throw createHttpError(404, 'QUESTION_BANK_NOT_FOUND', '题库不存在');
    }
    return bank;
  }

  async function requireActiveQuestion(client, questionId) {
    const question = await client.question.findUnique({
      where: { id: questionId },
      include: { bank: true, knowledgeExtraction: true }
    });
    if (!question || !question.bankId || question.status !== 'active' || question.bank?.status !== 'active') {
      throw createHttpError(404, 'QUESTION_NOT_FOUND', '题目不存在或不属于有效题库');
    }
    return question;
  }

  async function incrementRevision(client, bankId) {
    return client.questionBank.update({
      where: { id: bankId },
      data: { graphRevision: { increment: 1 } },
      select: { graphRevision: true }
    });
  }

  async function removeQuestionContributions(client, questionId, bankId) {
    const evidence = await client.knowledgeRelationEvidence.findMany({
      where: { questionId, relation: { bankId } },
      select: { relationId: true }
    });
    const relationIds = [...new Set(evidence.map((item) => item.relationId))];
    if (relationIds.length) {
      await client.knowledgeRelationEvidence.deleteMany({
        where: { questionId, relationId: { in: relationIds } }
      });
      for (const relationId of relationIds) {
        const [relation, supportCount] = await Promise.all([
          client.knowledgeRelation.findUnique({ where: { id: relationId } }),
          client.knowledgeRelationEvidence.count({ where: { relationId } })
        ]);
        if (!relation) continue;
        await client.knowledgeRelation.update({
          where: { id: relationId },
          data: {
            supportCount,
            status: supportCount === 0 && relation.source === 'question' && !relation.manualLocked
              ? 'archived'
              : relation.status
          }
        });
      }
    }

    const automaticLinks = await client.questionKnowledgePoint.findMany({
      where: {
        questionId,
        manualLocked: false,
        knowledgePoint: { bankId }
      },
      select: { knowledgePointId: true }
    });
    const pointIds = automaticLinks.map((item) => item.knowledgePointId);
    if (pointIds.length) {
      await client.questionKnowledgePoint.deleteMany({
        where: { questionId, knowledgePointId: { in: pointIds }, manualLocked: false }
      });
    }
    return pointIds;
  }

  async function archiveOrphanedAutomaticPoints(client, bankId, candidateIds = null) {
    const points = await client.knowledgePoint.findMany({
      where: {
        bankId,
        ...(candidateIds?.length ? { id: { in: candidateIds } } : {}),
        manualLocked: false,
        source: { not: 'manual' },
        questions: { none: {} }
      },
      select: { id: true }
    });
    if (!points.length) return;
    await client.knowledgePoint.updateMany({
      where: { id: { in: points.map((point) => point.id) } },
      data: { status: 'archived' }
    });
  }

  async function upsertBankPoints(client, bankId, extractedPoints, source) {
    const existingPoints = await client.knowledgePoint.findMany({ where: { bankId } });
    const index = pointIndex(existingPoints);
    const selected = [];

    for (const extracted of extractedPoints) {
      const key = extracted.canonicalKey || canonicalKnowledgeKey(extracted.canonicalName || extracted.name);
      if (!key) continue;
      let point = index.get(key);

      if (point) {
        if (!point.manualLocked) {
          const matchedCanonicalKey = canonicalKnowledgeKey(point.canonicalKey || point.name);
          const matchedByAlias = Boolean(matchedCanonicalKey && matchedCanonicalKey !== key);
          point = await client.knowledgePoint.update({
            where: { id: point.id },
            data: {
              name: matchedByAlias ? point.name : extracted.name || point.name,
              canonicalKey: point.canonicalKey || key,
              aliases: uniqueText([
                ...normalizeArray(point.aliases),
                ...normalizeArray(extracted.aliases),
                ...(matchedByAlias && extracted.name ? [extracted.name] : [])
              ]),
              category: normalizeText(extracted.category) || point.category,
              description: normalizeText(extracted.description) || point.description,
              source: point.source === 'manual' ? point.source : source,
              status: 'active'
            }
          });
        } else if (point.status !== 'active') {
          point = await client.knowledgePoint.update({ where: { id: point.id }, data: { status: 'active' } });
        }
      } else {
        point = await client.knowledgePoint.create({
          data: {
            bankId,
            name: extracted.name,
            canonicalKey: key,
            aliases: uniqueText(extracted.aliases),
            category: normalizeText(extracted.category) || null,
            description: normalizeText(extracted.description) || null,
            source,
            status: 'active'
          }
        });
      }

      selected.push({ point, extracted });
      const pointCanonicalKey = canonicalKnowledgeKey(point.canonicalKey || point.name);
      if (pointCanonicalKey) index.set(pointCanonicalKey, point);
      for (const aliasKey of [point.name, ...normalizeArray(point.aliases)]) {
        const normalizedKey = canonicalKnowledgeKey(aliasKey);
        if (normalizedKey && !index.has(normalizedKey)) index.set(normalizedKey, point);
      }
    }

    return { selected, allPoints: [...new Map([...existingPoints, ...selected.map((item) => item.point)].map((point) => [point.id, point])).values()] };
  }

  async function upsertRelationEvidence(client, {
    bankId,
    questionId,
    sourcePointId,
    targetPointId,
    type,
    label,
    source,
    confidence,
    evidenceType
  }) {
    let normalizedSource = sourcePointId;
    let normalizedTarget = targetPointId;
    if (type === 'co_occurrence' || type === 'related' || type === 'confusable') {
      [normalizedSource, normalizedTarget] = normalizeUndirectedPair(sourcePointId, targetPointId);
    }
    if (!normalizedSource || !normalizedTarget || normalizedSource === normalizedTarget) return null;

    const key = {
      bankId,
      sourcePointId: normalizedSource,
      targetPointId: normalizedTarget,
      type
    };
    let relation = await client.knowledgeRelation.findUnique({
      where: { bankId_sourcePointId_targetPointId_type: key }
    });
    if (!relation) {
      relation = await client.knowledgeRelation.create({
        data: {
          ...key,
          label: label || relationLabel(type),
          source,
          confidence,
          status: 'active'
        }
      });
    } else if (!relation.manualLocked) {
      relation = await client.knowledgeRelation.update({
        where: { id: relation.id },
        data: {
          label: label || relation.label,
          confidence: confidence ?? relation.confidence,
          status: 'active'
        }
      });
    }

    await client.knowledgeRelationEvidence.upsert({
      where: { relationId_questionId: { relationId: relation.id, questionId } },
      create: { relationId: relation.id, questionId, evidenceType },
      update: { evidenceType }
    });
    const supportCount = await client.knowledgeRelationEvidence.count({ where: { relationId: relation.id } });
    return client.knowledgeRelation.update({
      where: { id: relation.id },
      data: { supportCount, status: 'active' }
    });
  }

  async function applyQuestionKnowledge(questionId, extraction, source) {
    return prisma.$transaction(async (client) => {
      const question = await requireActiveQuestion(client, questionId);
      const currentHash = buildQuestionContentHash(question);
      if (extraction.contentHash && extraction.contentHash !== currentHash) {
        throw createHttpError(409, 'KNOWLEDGE_EXTRACTION_STALE', '题目内容已变化，旧解析结果已丢弃');
      }

      const oldPointIds = await removeQuestionContributions(client, question.id, question.bankId);
      const normalized = normalizeExtractionPayload(extraction);
      const { selected, allPoints } = await upsertBankPoints(
        client,
        question.bankId,
        normalized.knowledgePoints,
        source
      );

      for (const { point, extracted } of selected) {
        const existingLink = await client.questionKnowledgePoint.findUnique({
          where: {
            questionId_knowledgePointId: {
              questionId: question.id,
              knowledgePointId: point.id
            }
          }
        });
        if (existingLink?.manualLocked) continue;
        await client.questionKnowledgePoint.upsert({
          where: {
            questionId_knowledgePointId: {
              questionId: question.id,
              knowledgePointId: point.id
            }
          },
          create: {
            questionId: question.id,
            knowledgePointId: point.id,
            source,
            confidence: extracted.confidence
          },
          update: { source, confidence: extracted.confidence }
        });
      }

      const currentLinks = await client.questionKnowledgePoint.findMany({
        where: { questionId: question.id, knowledgePoint: { bankId: question.bankId, status: 'active' } },
        include: { knowledgePoint: true }
      });
      for (const [sourcePointId, targetPointId] of buildCoOccurrencePairs(currentLinks.map((link) => link.knowledgePointId))) {
        await upsertRelationEvidence(client, {
          bankId: question.bankId,
          questionId: question.id,
          sourcePointId,
          targetPointId,
          type: 'co_occurrence',
          label: relationLabel('co_occurrence'),
          source: 'question',
          confidence: 1,
          evidenceType: 'co_occurrence'
        });
      }

      const byKey = pointIndex(allPoints);
      for (const relation of normalized.relations) {
        const sourcePoint = byKey.get(relation.sourceKey);
        const targetPoint = byKey.get(relation.targetKey);
        if (!sourcePoint || !targetPoint) continue;
        await upsertRelationEvidence(client, {
          bankId: question.bankId,
          questionId: question.id,
          sourcePointId: sourcePoint.id,
          targetPointId: targetPoint.id,
          type: relation.type,
          label: relation.label,
          source: 'ai',
          confidence: relation.confidence,
          evidenceType: 'semantic_context'
        });
      }

      await client.question.update({
        where: { id: question.id },
        data: { knowledge: currentLinks.map((link) => link.knowledgePoint.name) }
      });
      await client.questionKnowledgeExtraction.upsert({
        where: { questionId: question.id },
        create: {
          questionId: question.id,
          contentHash: currentHash,
          status: 'ready',
          provider: extraction.provider || source,
          model: extraction.model || null,
          analyzedAt: new Date()
        },
        update: {
          contentHash: currentHash,
          status: 'ready',
          provider: extraction.provider || source,
          model: extraction.model || null,
          errorMessage: null,
          analyzedAt: new Date()
        }
      });
      await archiveOrphanedAutomaticPoints(client, question.bankId, oldPointIds);
      return incrementRevision(client, question.bankId);
    });
  }

  async function queueQuestionExtraction(questionOrId, { clearExisting = false } = {}) {
    const question = typeof questionOrId === 'string'
      ? await requireActiveQuestion(prisma, questionOrId)
      : questionOrId;
    if (!question?.id || !question.bankId || question.status !== 'active') return null;
    const contentHash = buildQuestionContentHash(question);
    return prisma.$transaction(async (client) => {
      let oldPointIds = [];
      if (clearExisting) {
        oldPointIds = await removeQuestionContributions(client, question.id, question.bankId);
      }
      await client.questionKnowledgeExtraction.upsert({
        where: { questionId: question.id },
        create: { questionId: question.id, contentHash, status: 'pending' },
        update: {
          contentHash,
          status: 'pending',
          attempts: 0,
          errorMessage: null,
          provider: null,
          model: null,
          analyzedAt: null
        }
      });
      await archiveOrphanedAutomaticPoints(client, question.bankId, oldPointIds);
      return incrementRevision(client, question.bankId);
    });
  }

  async function synchronizeExplicitKnowledge(questionOrId) {
    const question = typeof questionOrId === 'string'
      ? await requireActiveQuestion(prisma, questionOrId)
      : questionOrId;
    const normalized = normalizeExtractionPayload({
      knowledgePoints: normalizeArray(question.knowledge),
      relations: []
    });
    return applyQuestionKnowledge(question.id, {
      ...normalized,
      provider: 'explicit',
      model: '',
      contentHash: buildQuestionContentHash(question)
    }, 'explicit');
  }

  async function handleQuestionCreated(question) {
    if (!question?.bankId || question.status !== 'active') return null;
    if (normalizeArray(question.knowledge).length) return synchronizeExplicitKnowledge(question);
    return queueQuestionExtraction(question);
  }

  async function handleQuestionUpdated(before, after) {
    if (!after?.bankId || after.status !== 'active' || !semanticQuestionChanged(before, after)) return null;
    if (normalizeArray(after.knowledge).length) return synchronizeExplicitKnowledge(after);
    return queueQuestionExtraction(after, { clearExisting: true });
  }

  async function handleQuestionArchived(question) {
    if (!question?.bankId) return null;
    return prisma.$transaction(async (client) => {
      const oldPointIds = await removeQuestionContributions(client, question.id, question.bankId);
      await client.questionKnowledgeExtraction.deleteMany({ where: { questionId: question.id } });
      await archiveOrphanedAutomaticPoints(client, question.bankId, oldPointIds);
      return incrementRevision(client, question.bankId);
    });
  }

  async function processQuestionExtraction(questionId) {
    const question = await requireActiveQuestion(prisma, questionId);
    const expectedHash = question.knowledgeExtraction?.contentHash || buildQuestionContentHash(question);
    const extracted = aiQuestionKnowledgeService
      ? await aiQuestionKnowledgeService.extractQuestionKnowledge({ bank: question.bank, question })
      : { provider: 'local', model: '', knowledgePoints: [], relations: [] };

    let relations = normalizeArray(extracted.relations);
    if (aiQuestionKnowledgeService && normalizeArray(extracted.knowledgePoints).length) {
      const candidates = await prisma.knowledgePoint.findMany({
        where: { bankId: question.bankId, status: 'active' }
      });
      for (const point of extracted.knowledgePoints) {
        const selectedCandidates = selectRelationCandidates(point, candidates, 20);
        if (!selectedCandidates.length) continue;
        const classified = await aiQuestionKnowledgeService.classifyKnowledgeRelations({
          bank: question.bank,
          point,
          candidates: selectedCandidates
        });
        relations = [...relations, ...normalizeArray(classified.relations)];
      }
    }

    const fresh = await requireActiveQuestion(prisma, questionId);
    if (buildQuestionContentHash(fresh) !== expectedHash) {
      throw createHttpError(409, 'KNOWLEDGE_EXTRACTION_STALE', '题目内容已变化，旧解析结果已丢弃');
    }
    return applyQuestionKnowledge(questionId, {
      ...extracted,
      relations,
      contentHash: expectedHash
    }, extracted.provider === 'explicit' ? 'explicit' : 'ai');
  }

  async function getGraph(bankId) {
    const bank = await requireBank(prisma, bankId);
    const [questionCount, points, relations, layouts, extractionRows] = await Promise.all([
      prisma.question.count({ where: { bankId, status: 'active' } }),
      prisma.knowledgePoint.findMany({
        where: { bankId, status: 'active' },
        include: {
          questions: {
            where: { question: { bankId, status: 'active' } },
            select: { questionId: true }
          }
        },
        orderBy: [{ name: 'asc' }]
      }),
      prisma.knowledgeRelation.findMany({
        where: { bankId, status: 'active' },
        include: {
          evidence: {
            where: { question: { bankId, status: 'active' } },
            select: { questionId: true }
          }
        }
      }),
      prisma.knowledgeGraphNodeLayout.findMany({ where: { bankId } }),
      prisma.questionKnowledgeExtraction.findMany({
        where: { question: { bankId, status: 'active' } },
        select: { status: true }
      })
    ]);

    const layoutByPoint = new Map(layouts.map((layout) => [layout.knowledgePointId, layout]));
    const visiblePoints = points.filter((point) => (
      point.questions.length > 0 || point.source === 'manual' || point.manualLocked
    ));
    const nodeIds = new Set(visiblePoints.map((point) => point.id));
    const nodes = visiblePoints.map((point) => {
      const layout = layoutByPoint.get(point.id);
      return {
        id: point.id,
        label: point.name,
        name: point.name,
        canonicalKey: point.canonicalKey,
        aliases: normalizeArray(point.aliases),
        category: point.category || '未分类',
        description: point.description || '',
        source: point.source,
        locked: point.manualLocked,
        questionCount: point.questions.length,
        orphan: point.questions.length === 0,
        position: layout ? { x: layout.x, y: layout.y, pinned: layout.pinned } : null
      };
    });
    const edges = relations
      .filter((relation) => nodeIds.has(relation.sourcePointId) && nodeIds.has(relation.targetPointId))
      .map((relation) => ({
        id: relation.id,
        source: relation.sourcePointId,
        target: relation.targetPointId,
        type: relation.type,
        label: relation.label,
        sourceKind: relation.source,
        confidence: relation.confidence,
        supportCount: relation.evidence.length || relation.supportCount,
        locked: relation.manualLocked
      }))
      .filter((relation) => relation.type !== 'co_occurrence' || relation.supportCount > 0);

    const statusCount = (status) => extractionRows.filter((row) => row.status === status).length;
    return {
      bank: { id: bank.id, title: bank.title, subject: bank.subject, grade: bank.grade || '' },
      revision: bank.graphRevision,
      stats: {
        questionCount,
        analyzedCount: statusCount('ready'),
        pendingCount: statusCount('pending'),
        processingCount: statusCount('processing'),
        failedCount: statusCount('failed'),
        nodeCount: nodes.length,
        edgeCount: edges.length
      },
      nodes,
      edges
    };
  }

  async function getKnowledgePointDetail(bankId, pointId) {
    await requireBank(prisma, bankId);
    const point = await prisma.knowledgePoint.findFirst({
      where: { id: pointId, bankId },
      include: {
        questions: {
          where: { question: { bankId, status: 'active' } },
          include: {
            question: {
              select: { id: true, title: true, type: true, stage: true, difficulty: true }
            }
          }
        },
        outgoingRelations: { where: { bankId, status: 'active' } },
        incomingRelations: { where: { bankId, status: 'active' } }
      }
    });
    if (!point) throw createHttpError(404, 'KNOWLEDGE_POINT_NOT_FOUND', '知识点不存在');
    return {
      id: point.id,
      bankId,
      name: point.name,
      description: point.description || '',
      category: point.category || '未分类',
      aliases: normalizeArray(point.aliases),
      source: point.source,
      status: point.status,
      manualLocked: point.manualLocked,
      questions: point.questions.map((link) => link.question),
      relations: [...point.outgoingRelations, ...point.incomingRelations]
    };
  }

  async function analyzePending(bankId) {
    await requireBank(prisma, bankId);
    const questions = await prisma.question.findMany({
      where: {
        bankId,
        status: 'active',
        OR: [
          { knowledgeExtraction: null },
          { knowledgeExtraction: { status: 'failed' } }
        ]
      }
    });
    for (const question of questions) {
      if (normalizeArray(question.knowledge).length) await synchronizeExplicitKnowledge(question);
      else await queueQuestionExtraction(question);
    }
    return { bankId, queued: questions.length };
  }

  async function reconcileBank(bankId) {
    await requireBank(prisma, bankId);
    const questions = await prisma.question.findMany({ where: { bankId, status: 'active' } });
    for (const question of questions) {
      if (normalizeArray(question.knowledge).length) await synchronizeExplicitKnowledge(question);
      else await queueQuestionExtraction(question, { clearExisting: true });
    }
    return { bankId, queued: questions.length };
  }

  async function retryQuestionExtraction(questionId) {
    return queueQuestionExtraction(questionId, { clearExisting: false });
  }

  async function processNextPendingExtraction() {
    const job = await prisma.questionKnowledgeExtraction.findFirst({
      where: { status: 'pending', attempts: { lt: 3 } },
      orderBy: { updatedAt: 'asc' }
    });
    if (!job) return null;
    const claimed = await prisma.questionKnowledgeExtraction.updateMany({
      where: { questionId: job.questionId, status: 'pending' },
      data: { status: 'processing', attempts: { increment: 1 }, errorMessage: null }
    });
    if (!claimed.count) return null;
    try {
      await processQuestionExtraction(job.questionId);
      return { questionId: job.questionId, status: 'ready' };
    } catch (error) {
      const current = await prisma.questionKnowledgeExtraction.findUnique({ where: { questionId: job.questionId } });
      await prisma.questionKnowledgeExtraction.update({
        where: { questionId: job.questionId },
        data: {
          status: (current?.attempts || 0) >= 3 ? 'failed' : 'pending',
          errorMessage: error.message || '知识点解析失败'
        }
      });
      return { questionId: job.questionId, status: 'failed', error: error.message };
    }
  }

  async function assertGraphRevision(client, bankId, expectedRevision) {
    const bank = await requireBank(client, bankId);
    const expected = Number(expectedRevision);
    if (!Number.isInteger(expected) || expected !== bank.graphRevision) {
      throw createHttpError(409, 'GRAPH_REVISION_CONFLICT', '图谱已更新，请刷新后重新提交', {
        expected: Number.isInteger(expected) ? expected : null,
        actual: bank.graphRevision
      });
    }
    return bank;
  }

  function serializeManualPoint(point, graphRevision) {
    return {
      id: point.id,
      bankId: point.bankId,
      name: point.name,
      aliases: normalizeArray(point.aliases),
      category: point.category || '',
      description: point.description || '',
      source: point.source,
      status: point.status,
      manualLocked: point.manualLocked,
      mergedIntoId: point.mergedIntoId || null,
      graphRevision
    };
  }

  async function syncQuestionKnowledgeMirrors(client, bankId, questionIds) {
    for (const questionId of [...new Set(normalizeArray(questionIds).filter(Boolean))]) {
      const question = await client.question.findFirst({ where: { id: questionId, bankId } });
      if (!question) continue;
      const links = await client.questionKnowledgePoint.findMany({
        where: {
          questionId,
          knowledgePoint: { bankId, status: 'active' }
        },
        include: { knowledgePoint: true },
        orderBy: { createdAt: 'asc' }
      });
      await client.question.update({
        where: { id: questionId },
        data: { knowledge: uniqueText(links.map((link) => link.knowledgePoint.name)) }
      });
    }
  }

  async function createKnowledgePoint(bankId, payload = {}) {
    const name = normalizeText(payload.name);
    const canonicalKey = canonicalKnowledgeKey(payload.canonicalName || name);
    if (!name || !canonicalKey) {
      throw createHttpError(400, 'INVALID_KNOWLEDGE_GRAPH_PAYLOAD', '知识点名称不能为空');
    }
    return prisma.$transaction(async (client) => {
      await assertGraphRevision(client, bankId, payload.graphRevision);
      const duplicate = await client.knowledgePoint.findUnique({
        where: { bankId_canonicalKey: { bankId, canonicalKey } }
      });
      if (duplicate && duplicate.status !== 'archived') {
        throw createHttpError(409, 'KNOWLEDGE_POINT_MERGE_CONFLICT', '题库中已存在同名知识点', {
          duplicateId: duplicate.id
        });
      }
      const point = duplicate
        ? await client.knowledgePoint.update({
          where: { id: duplicate.id },
          data: {
            name,
            aliases: uniqueText(payload.aliases),
            category: normalizeText(payload.category) || null,
            description: normalizeText(payload.description) || null,
            source: 'manual',
            status: 'active',
            manualLocked: true,
            mergedIntoId: null
          }
        })
        : await client.knowledgePoint.create({
          data: {
            bankId,
            name,
            canonicalKey,
            aliases: uniqueText(payload.aliases),
            category: normalizeText(payload.category) || null,
            description: normalizeText(payload.description) || null,
            source: 'manual',
            status: 'active',
            manualLocked: true
          }
        });

      const requestedQuestionIds = [...new Set(normalizeArray(payload.questionIds).filter(Boolean))];
      const questions = requestedQuestionIds.length
        ? await client.question.findMany({
          where: { id: { in: requestedQuestionIds }, bankId, status: 'active' },
          select: { id: true }
        })
        : [];
      for (const question of questions) {
        await client.questionKnowledgePoint.upsert({
          where: {
            questionId_knowledgePointId: {
              questionId: question.id,
              knowledgePointId: point.id
            }
          },
          create: {
            questionId: question.id,
            knowledgePointId: point.id,
            source: 'manual',
            confidence: 1,
            manualLocked: true
          },
          update: { source: 'manual', confidence: 1, manualLocked: true }
        });
      }
      await syncQuestionKnowledgeMirrors(client, bankId, questions.map((question) => question.id));
      const revision = await incrementRevision(client, bankId);
      return serializeManualPoint(point, revision.graphRevision);
    });
  }

  async function updateKnowledgePoint(bankId, pointId, payload = {}) {
    return prisma.$transaction(async (client) => {
      await assertGraphRevision(client, bankId, payload.graphRevision);
      const point = await client.knowledgePoint.findFirst({ where: { id: pointId, bankId } });
      if (!point) throw createHttpError(404, 'KNOWLEDGE_POINT_NOT_FOUND', '知识点不存在');
      const name = 'name' in payload ? normalizeText(payload.name) : point.name;
      const canonicalKey = canonicalKnowledgeKey(payload.canonicalName || name);
      if (!name || !canonicalKey) {
        throw createHttpError(400, 'INVALID_KNOWLEDGE_GRAPH_PAYLOAD', '知识点名称不能为空');
      }
      const duplicate = await client.knowledgePoint.findFirst({
        where: { bankId, canonicalKey, id: { not: point.id }, status: { not: 'archived' } },
        select: { id: true }
      });
      if (duplicate) {
        throw createHttpError(409, 'KNOWLEDGE_POINT_MERGE_CONFLICT', '题库中已存在同名知识点', {
          duplicateId: duplicate.id
        });
      }
      const updated = await client.knowledgePoint.update({
        where: { id: point.id },
        data: {
          name,
          canonicalKey,
          ...('aliases' in payload ? { aliases: uniqueText(payload.aliases) } : {}),
          ...('category' in payload ? { category: normalizeText(payload.category) || null } : {}),
          ...('description' in payload ? { description: normalizeText(payload.description) || null } : {}),
          ...('status' in payload ? { status: normalizeText(payload.status) || point.status } : {}),
          source: 'manual',
          manualLocked: payload.manualLocked === false ? false : true
        }
      });
      const links = await client.questionKnowledgePoint.findMany({
        where: { knowledgePointId: point.id },
        select: { questionId: true }
      });
      await syncQuestionKnowledgeMirrors(client, bankId, links.map((link) => link.questionId));
      const revision = await incrementRevision(client, bankId);
      return serializeManualPoint(updated, revision.graphRevision);
    });
  }

  async function createRelation(bankId, payload = {}) {
    return prisma.$transaction(async (client) => {
      await assertGraphRevision(client, bankId, payload.graphRevision);
      const type = normalizeText(payload.type) || 'related';
      let sourcePointId = normalizeText(payload.sourcePointId);
      let targetPointId = normalizeText(payload.targetPointId);
      const points = await client.knowledgePoint.findMany({
        where: { id: { in: [sourcePointId, targetPointId] }, bankId, status: 'active' },
        select: { id: true }
      });
      if (points.length !== 2 || sourcePointId === targetPointId) {
        throw createHttpError(400, 'INVALID_KNOWLEDGE_GRAPH_PAYLOAD', '关系两端必须是当前题库中的不同知识点');
      }
      if (type === 'related' || type === 'confusable' || type === 'co_occurrence') {
        [sourcePointId, targetPointId] = normalizeUndirectedPair(sourcePointId, targetPointId);
      }
      const key = { bankId, sourcePointId, targetPointId, type };
      const existing = await client.knowledgeRelation.findUnique({
        where: { bankId_sourcePointId_targetPointId_type: key }
      });
      const relation = existing
        ? await client.knowledgeRelation.update({
          where: { id: existing.id },
          data: {
            label: normalizeText(payload.label) || relationLabel(type),
            source: 'manual',
            confidence: 1,
            manualLocked: true,
            status: 'active'
          }
        })
        : await client.knowledgeRelation.create({
          data: {
            ...key,
            label: normalizeText(payload.label) || relationLabel(type),
            source: 'manual',
            confidence: 1,
            manualLocked: true,
            status: 'active'
          }
        });
      const revision = await incrementRevision(client, bankId);
      return { ...relation, graphRevision: revision.graphRevision };
    });
  }

  async function updateRelation(bankId, relationId, payload = {}) {
    return prisma.$transaction(async (client) => {
      await assertGraphRevision(client, bankId, payload.graphRevision);
      const relation = await client.knowledgeRelation.findFirst({ where: { id: relationId, bankId } });
      if (!relation) throw createHttpError(404, 'KNOWLEDGE_RELATION_NOT_FOUND', '知识关系不存在');
      const editsSemantics = 'label' in payload || 'type' in payload;
      if (editsSemantics && relation.source !== 'manual' && !relation.manualLocked) {
        throw createHttpError(400, 'AUTOMATIC_RELATION_READ_ONLY', '自动关系只能隐藏，不能修改语义');
      }
      const updated = await client.knowledgeRelation.update({
        where: { id: relation.id },
        data: {
          ...('label' in payload ? { label: normalizeText(payload.label) || relation.label } : {}),
          ...('type' in payload ? { type: normalizeText(payload.type) || relation.type } : {}),
          ...('status' in payload ? { status: normalizeText(payload.status) || relation.status } : {}),
          ...(editsSemantics ? { source: 'manual', manualLocked: true } : {})
        }
      });
      const revision = await incrementRevision(client, bankId);
      return { ...updated, graphRevision: revision.graphRevision };
    });
  }

  async function deleteRelation(bankId, relationId, payload = {}) {
    return prisma.$transaction(async (client) => {
      await assertGraphRevision(client, bankId, payload.graphRevision);
      const relation = await client.knowledgeRelation.findFirst({ where: { id: relationId, bankId } });
      if (!relation) throw createHttpError(404, 'KNOWLEDGE_RELATION_NOT_FOUND', '知识关系不存在');
      if (relation.source === 'manual' || relation.manualLocked) {
        await client.knowledgeRelation.delete({ where: { id: relation.id } });
      } else {
        await client.knowledgeRelation.update({ where: { id: relation.id }, data: { status: 'hidden' } });
      }
      const revision = await incrementRevision(client, bankId);
      return { id: relation.id, deleted: relation.source === 'manual' || relation.manualLocked, graphRevision: revision.graphRevision };
    });
  }

  async function mergeKnowledgePoint(bankId, sourcePointId, payload = {}) {
    return prisma.$transaction(async (client) => {
      await assertGraphRevision(client, bankId, payload.graphRevision);
      const targetPointId = normalizeText(payload.targetPointId);
      if (!targetPointId || targetPointId === sourcePointId) {
        throw createHttpError(409, 'KNOWLEDGE_POINT_MERGE_CONFLICT', '合并目标无效');
      }
      const [sourcePoint, targetPoint] = await Promise.all([
        client.knowledgePoint.findFirst({ where: { id: sourcePointId, bankId, status: { not: 'archived' } } }),
        client.knowledgePoint.findFirst({ where: { id: targetPointId, bankId, status: 'active' } })
      ]);
      if (!sourcePoint || !targetPoint) {
        throw createHttpError(404, 'KNOWLEDGE_POINT_NOT_FOUND', '源节点或目标节点不存在');
      }

      const sourceLinks = await client.questionKnowledgePoint.findMany({
        where: { knowledgePointId: sourcePoint.id }
      });
      for (const link of sourceLinks) {
        const targetLink = await client.questionKnowledgePoint.findUnique({
          where: {
            questionId_knowledgePointId: {
              questionId: link.questionId,
              knowledgePointId: targetPoint.id
            }
          }
        });
        if (targetLink) {
          await client.questionKnowledgePoint.update({
            where: {
              questionId_knowledgePointId: {
                questionId: targetLink.questionId,
                knowledgePointId: targetLink.knowledgePointId
              }
            },
            data: {
              source: targetLink.manualLocked || link.manualLocked ? 'manual' : targetLink.source,
              confidence: Math.max(targetLink.confidence ?? 0, link.confidence ?? 0),
              manualLocked: targetLink.manualLocked || link.manualLocked
            }
          });
        } else {
          await client.questionKnowledgePoint.create({
            data: {
              questionId: link.questionId,
              knowledgePointId: targetPoint.id,
              source: link.source,
              confidence: link.confidence,
              manualLocked: link.manualLocked
            }
          });
        }
        await client.questionKnowledgePoint.delete({
          where: {
            questionId_knowledgePointId: {
              questionId: link.questionId,
              knowledgePointId: sourcePoint.id
            }
          }
        });
      }

      const relations = await client.knowledgeRelation.findMany({
        where: {
          bankId,
          OR: [{ sourcePointId: sourcePoint.id }, { targetPointId: sourcePoint.id }]
        },
        include: { evidence: true }
      });
      for (const relation of relations) {
        let newSource = relation.sourcePointId === sourcePoint.id ? targetPoint.id : relation.sourcePointId;
        let newTarget = relation.targetPointId === sourcePoint.id ? targetPoint.id : relation.targetPointId;
        if (newSource === newTarget) {
          await client.knowledgeRelation.delete({ where: { id: relation.id } });
          continue;
        }
        if (relation.type === 'related' || relation.type === 'confusable' || relation.type === 'co_occurrence') {
          [newSource, newTarget] = normalizeUndirectedPair(newSource, newTarget);
        }
        const key = { bankId, sourcePointId: newSource, targetPointId: newTarget, type: relation.type };
        const duplicate = await client.knowledgeRelation.findUnique({
          where: { bankId_sourcePointId_targetPointId_type: key }
        });
        if (duplicate && duplicate.id !== relation.id) {
          for (const evidence of relation.evidence) {
            await client.knowledgeRelationEvidence.upsert({
              where: {
                relationId_questionId: {
                  relationId: duplicate.id,
                  questionId: evidence.questionId
                }
              },
              create: {
                relationId: duplicate.id,
                questionId: evidence.questionId,
                evidenceType: evidence.evidenceType
              },
              update: { evidenceType: evidence.evidenceType }
            });
          }
          await client.knowledgeRelation.update({
            where: { id: duplicate.id },
            data: {
              source: duplicate.manualLocked || relation.manualLocked ? 'manual' : duplicate.source,
              manualLocked: duplicate.manualLocked || relation.manualLocked,
              status: 'active'
            }
          });
          await client.knowledgeRelation.delete({ where: { id: relation.id } });
          const supportCount = await client.knowledgeRelationEvidence.count({ where: { relationId: duplicate.id } });
          await client.knowledgeRelation.update({ where: { id: duplicate.id }, data: { supportCount } });
        } else {
          const supportCount = relation.evidence.length;
          await client.knowledgeRelation.update({
            where: { id: relation.id },
            data: { sourcePointId: newSource, targetPointId: newTarget, supportCount }
          });
        }
      }

      await client.knowledgeGraphNodeLayout.deleteMany({
        where: { bankId, knowledgePointId: sourcePoint.id }
      });
      const archived = await client.knowledgePoint.update({
        where: { id: sourcePoint.id },
        data: { status: 'archived', mergedIntoId: targetPoint.id }
      });
      await syncQuestionKnowledgeMirrors(client, bankId, sourceLinks.map((link) => link.questionId));
      const revision = await incrementRevision(client, bankId);
      return serializeManualPoint(archived, revision.graphRevision);
    });
  }

  async function hideOrUnlinkKnowledgePoint(bankId, pointId, payload = {}) {
    const mode = normalizeText(payload.mode) || 'hide';
    return prisma.$transaction(async (client) => {
      await assertGraphRevision(client, bankId, payload.graphRevision);
      const point = await client.knowledgePoint.findFirst({ where: { id: pointId, bankId } });
      if (!point) throw createHttpError(404, 'KNOWLEDGE_POINT_NOT_FOUND', '知识点不存在');
      if (mode === 'hide') {
        await client.knowledgePoint.update({ where: { id: point.id }, data: { status: 'hidden' } });
      } else if (mode === 'unlink') {
        const requestedIds = [...new Set(normalizeArray(payload.questionIds).filter(Boolean))];
        const links = await client.questionKnowledgePoint.findMany({
          where: {
            knowledgePointId: point.id,
            ...(requestedIds.length ? { questionId: { in: requestedIds } } : {}),
            ...(payload.includeManual ? {} : { manualLocked: false })
          },
          select: { questionId: true, knowledgePointId: true }
        });
        const questionIds = links.map((link) => link.questionId);
        if (links.length) {
          await client.questionKnowledgePoint.deleteMany({
            where: {
              knowledgePointId: point.id,
              questionId: { in: questionIds },
              ...(payload.includeManual ? {} : { manualLocked: false })
            }
          });
          const relations = await client.knowledgeRelation.findMany({
            where: {
              bankId,
              OR: [{ sourcePointId: point.id }, { targetPointId: point.id }]
            },
            select: { id: true, source: true, manualLocked: true }
          });
          for (const relation of relations) {
            await client.knowledgeRelationEvidence.deleteMany({
              where: { relationId: relation.id, questionId: { in: questionIds } }
            });
            const supportCount = await client.knowledgeRelationEvidence.count({ where: { relationId: relation.id } });
            await client.knowledgeRelation.update({
              where: { id: relation.id },
              data: {
                supportCount,
                status: supportCount === 0 && relation.source === 'question' && !relation.manualLocked
                  ? 'archived'
                  : undefined
              }
            });
          }
          await syncQuestionKnowledgeMirrors(client, bankId, questionIds);
        }
        const remainingLinks = await client.questionKnowledgePoint.count({
          where: { knowledgePointId: point.id }
        });
        if (!remainingLinks && point.source !== 'manual' && !point.manualLocked) {
          await client.knowledgePoint.update({ where: { id: point.id }, data: { status: 'archived' } });
        }
      } else {
        throw createHttpError(400, 'INVALID_KNOWLEDGE_GRAPH_PAYLOAD', '节点删除模式只能是 hide 或 unlink');
      }
      const revision = await incrementRevision(client, bankId);
      return { id: point.id, mode, graphRevision: revision.graphRevision };
    });
  }

  async function saveLayout(bankId, payload = {}) {
    return prisma.$transaction(async (client) => {
      await assertGraphRevision(client, bankId, payload.graphRevision);
      const nodes = normalizeArray(payload.nodes);
      const validPoints = await client.knowledgePoint.findMany({
        where: { bankId, id: { in: nodes.map((node) => node.knowledgePointId).filter(Boolean) } },
        select: { id: true }
      });
      const validIds = new Set(validPoints.map((point) => point.id));
      for (const node of nodes) {
        if (!validIds.has(node.knowledgePointId)) continue;
        if (node.pinned === false) {
          await client.knowledgeGraphNodeLayout.deleteMany({
            where: { bankId, knowledgePointId: node.knowledgePointId }
          });
          continue;
        }
        const x = Number(node.x);
        const y = Number(node.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        await client.knowledgeGraphNodeLayout.upsert({
          where: {
            bankId_knowledgePointId: {
              bankId,
              knowledgePointId: node.knowledgePointId
            }
          },
          create: { bankId, knowledgePointId: node.knowledgePointId, x, y, pinned: true },
          update: { x, y, pinned: true }
        });
      }
      const revision = await incrementRevision(client, bankId);
      return { bankId, graphRevision: revision.graphRevision };
    });
  }

  return {
    getGraph,
    getKnowledgePointDetail,
    queueQuestionExtraction,
    synchronizeExplicitKnowledge,
    processQuestionExtraction,
    processNextPendingExtraction,
    retryQuestionExtraction,
    handleQuestionCreated,
    handleQuestionUpdated,
    handleQuestionArchived,
    analyzePending,
    reconcileBank,
    createKnowledgePoint,
    updateKnowledgePoint,
    mergeKnowledgePoint,
    hideOrUnlinkKnowledgePoint,
    createRelation,
    updateRelation,
    deleteRelation,
    saveLayout
  };
}
