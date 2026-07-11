import { PrismaClient } from '@prisma/client';

import { loadEnvFile } from '../server/env.js';
import { normalizeExtractionPayload } from '../server/services/questionKnowledgeGraphDomain.js';
import { createQuestionKnowledgeGraphService } from '../server/services/questionKnowledgeGraphService.js';

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function namesFromQuestion(question) {
  const explicit = normalizeArray(question.knowledge)
    .map((item) => typeof item === 'string' ? item : item?.name || item?.label || '')
    .filter(Boolean);
  if (explicit.length) return explicit;
  return normalizeArray(question.knowledgePoints)
    .map((link) => link.knowledgePoint?.name)
    .filter(Boolean);
}

export async function backfillQuestionBankKnowledgeGraph(prisma, { dryRun = false, bankId = null } = {}) {
  const graphService = createQuestionKnowledgeGraphService(prisma);
  const banks = await prisma.questionBank.findMany({
    where: {
      status: 'active',
      ...(bankId ? { id: bankId } : {})
    },
    include: {
      knowledgePoints: { select: { canonicalKey: true, name: true } },
      questions: {
        where: { status: 'active' },
        orderBy: { createdAt: 'asc' },
        include: {
          knowledgePoints: {
            include: { knowledgePoint: true }
          }
        }
      }
    }
  });

  const result = {
    dryRun,
    banks: banks.length,
    questions: 0,
    createdBankPoints: 0,
    linkedQuestions: 0,
    queuedQuestions: 0
  };

  for (const bank of banks) {
    const knownKeys = new Set(
      bank.knowledgePoints
        .map((point) => point.canonicalKey || point.name)
        .map((name) => normalizeExtractionPayload({ knowledgePoints: [name] }).knowledgePoints[0]?.canonicalKey)
        .filter(Boolean)
    );
    const beforeCount = bank.knowledgePoints.length;

    for (const question of bank.questions) {
      result.questions += 1;
      const names = namesFromQuestion(question);
      const normalized = normalizeExtractionPayload({ knowledgePoints: names });
      if (!normalized.knowledgePoints.length) {
        result.queuedQuestions += 1;
        if (!dryRun) await graphService.queueQuestionExtraction(question);
        continue;
      }

      result.linkedQuestions += 1;
      for (const point of normalized.knowledgePoints) {
        if (!knownKeys.has(point.canonicalKey)) {
          knownKeys.add(point.canonicalKey);
          if (dryRun) result.createdBankPoints += 1;
        }
      }
      if (!dryRun) {
        const updatedQuestion = await prisma.question.update({
          where: { id: question.id },
          data: { knowledge: normalized.knowledgePoints.map((point) => point.name) }
        });
        await graphService.synchronizeExplicitKnowledge(updatedQuestion);
      }
    }

    if (!dryRun) {
      const afterCount = await prisma.knowledgePoint.count({ where: { bankId: bank.id } });
      result.createdBankPoints += Math.max(0, afterCount - beforeCount);
    }
  }

  return result;
}

async function runCli() {
  loadEnvFile();
  const prisma = new PrismaClient();
  const dryRun = process.argv.includes('--dry-run');
  const bankArgument = process.argv.find((argument) => argument.startsWith('--bank='));
  try {
    const result = await backfillQuestionBankKnowledgeGraph(prisma, {
      dryRun,
      bankId: bankArgument ? bankArgument.slice('--bank='.length) : null
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/prisma/backfillQuestionBankKnowledgeGraph.js')) {
  await runCli();
}
