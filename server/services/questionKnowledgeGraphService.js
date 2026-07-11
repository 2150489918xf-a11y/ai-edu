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
    const keys = [point.canonicalKey, point.name, ...normalizeArray(point.aliases)]
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
          point = await client.knowledgePoint.update({
            where: { id: point.id },
            data: {
              name: extracted.name || point.name,
              canonicalKey: key,
              aliases: uniqueText([...normalizeArray(point.aliases), ...normalizeArray(extracted.aliases)]),
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
      for (const aliasKey of [point.canonicalKey, point.name, ...normalizeArray(point.aliases)]) {
        const normalizedKey = canonicalKnowledgeKey(aliasKey);
        if (normalizedKey) index.set(normalizedKey, point);
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
    reconcileBank
  };
}
