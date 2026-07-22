import { pathToFileURL } from 'node:url';
import { loadEnvFile } from '../server/env.js';
import { demoQuestionBankCatalog } from './demoQuestionBankCatalog.js';

function bankKey(bankId) {
  return bankId.slice('demo-bank-'.length);
}

function pointId(bankId, pointKey) {
  return `demo-kp-${bankKey(bankId)}-${pointKey}`;
}

function relationId(bankId, index) {
  return `demo-rel-${bankKey(bankId)}-${index + 1}`;
}

function questionStatistics(index) {
  return {
    accuracy: 64 + ((index * 7) % 31),
    avgTimeSeconds: 42 + index * 6
  };
}

export async function seedDemoQuestionBanks(prisma, catalog = demoQuestionBankCatalog) {
  const requestedCourseIds = [...new Set(catalog.map((bank) => bank.courseId).filter(Boolean))];
  const requestedSubjects = [...new Set(catalog.map((bank) => bank.subject).filter(Boolean))];
  const courses = await prisma.course.findMany({
    where: {
      status: 'active',
      deletedAt: null,
      OR: [
        { id: { in: requestedCourseIds } },
        { subject: { in: requestedSubjects } }
      ]
    },
    select: { id: true, subject: true },
    orderBy: { createdAt: 'asc' }
  });
  const availableCourseIds = new Set(courses.map((course) => course.id));
  const fallbackCourseBySubject = new Map();
  for (const course of courses) {
    if (course.subject && !fallbackCourseBySubject.has(course.subject)) {
      fallbackCourseBySubject.set(course.subject, course.id);
    }
  }
  const linkedCourseIds = new Set();
  const summary = {
    banks: 0,
    questions: 0,
    knowledgePoints: 0,
    questionKnowledgeLinks: 0,
    relations: 0,
    linkedCourses: 0
  };

  for (const bank of catalog) {
    await prisma.$transaction(async (tx) => {
      const linkedCourseId = availableCourseIds.has(bank.courseId)
        ? bank.courseId
        : fallbackCourseBySubject.get(bank.subject) || null;
      if (linkedCourseId) linkedCourseIds.add(linkedCourseId);
      const bankData = {
        title: bank.title,
        subject: bank.subject,
        grade: bank.grade,
        usage: bank.usage,
        description: bank.description,
        tags: bank.tags,
        graphRevision: 1,
        status: 'active',
        deletedAt: null
      };
      await tx.questionBank.upsert({
        where: { id: bank.id },
        update: bankData,
        create: { id: bank.id, ...bankData }
      });
      summary.banks += 1;

      const pointNames = new Map();
      for (const point of bank.knowledgePoints) {
        const id = pointId(bank.id, point.key);
        pointNames.set(point.key, { id, name: point.name });
        const pointData = {
          bankId: bank.id,
          courseId: linkedCourseId,
          name: point.name,
          canonicalKey: point.key,
          aliases: [],
          category: point.category,
          description: point.summary,
          source: 'seed',
          status: 'active',
          manualLocked: true,
          parentId: null,
          mergedIntoId: null
        };
        await tx.knowledgePoint.upsert({
          where: { id },
          update: pointData,
          create: { id, ...pointData }
        });
        summary.knowledgePoints += 1;
      }

      for (const [index, question] of bank.questions.entries()) {
        const statistics = questionStatistics(index);
        const knowledgeNames = question.knowledgeKeys.map((key) => pointNames.get(key).name);
        const questionData = {
          bankId: bank.id,
          courseId: linkedCourseId,
          type: question.type,
          stage: question.stage,
          difficulty: question.difficulty,
          title: question.title,
          options: question.options,
          answer: question.answer,
          analysis: question.analysis,
          knowledge: knowledgeNames,
          status: 'active',
          deletedAt: null,
          accuracy: statistics.accuracy,
          avgTimeSeconds: statistics.avgTimeSeconds,
          weakPoint: knowledgeNames.at(-1),
          optionDistribution: null
        };
        await tx.question.upsert({
          where: { id: question.id },
          update: questionData,
          create: { id: question.id, ...questionData }
        });
        summary.questions += 1;

        for (const key of question.knowledgeKeys) {
          const knowledgePointId = pointNames.get(key).id;
          await tx.questionKnowledgePoint.upsert({
            where: {
              questionId_knowledgePointId: {
                questionId: question.id,
                knowledgePointId
              }
            },
            update: {
              source: 'seed',
              confidence: 1,
              manualLocked: true
            },
            create: {
              questionId: question.id,
              knowledgePointId,
              source: 'seed',
              confidence: 1,
              manualLocked: true
            }
          });
          summary.questionKnowledgeLinks += 1;
        }
      }

      for (const [index, relation] of bank.relations.entries()) {
        const id = relationId(bank.id, index);
        const relationData = {
          bankId: bank.id,
          sourcePointId: pointNames.get(relation.source).id,
          targetPointId: pointNames.get(relation.target).id,
          type: relation.type,
          label: relation.label,
          source: 'seed',
          confidence: 1,
          supportCount: 1,
          manualLocked: true,
          status: 'active'
        };
        await tx.knowledgeRelation.upsert({
          where: { id },
          update: relationData,
          create: { id, ...relationData }
        });
        summary.relations += 1;
      }
    });
  }

  summary.linkedCourses = linkedCourseIds.size;
  return summary;
}

async function runFromCli() {
  loadEnvFile();
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const summary = await seedDemoQuestionBanks(prisma);
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirectRun) {
  await runFromCli();
}
