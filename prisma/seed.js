import { loadEnvFile } from '../server/env.js';
import {
  generatedPaper,
  knowledgeBaseCategories,
  knowledgeMaterials,
  newtonClassLearningAnalysis,
  newtonStudentProfiles
} from '../src/data/teachingMockData.js';
import { hashPassword } from '../server/services/authService.js';
import { backfillQuestionBankKnowledgeGraph } from './backfillQuestionBankKnowledgeGraph.js';

loadEnvFile();

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

const classIdByName = {
  '高一 3 班': 'class-2026-physics-1',
  '高一 4 班': 'class-2026-physics-2'
};

const courseId = 'course-newton-2';
const sessionId = 'session-newton-001';

function isKnowledgeMaterialSeed(value) {
  return Boolean(
    value &&
    value.id &&
    value.categoryId &&
    value.title &&
    value.type &&
    value.subject &&
    value.grade
  );
}

function avgTimeToSeconds(value) {
  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

function normalizeWeakPoint(point) {
  return {
    id: point.id,
    name: point.name,
    score: point.score ?? point.mastery ?? point.accuracy ?? 0,
    accuracy: point.accuracy ?? point.mastery ?? 0,
    impact: point.impact,
    advice: point.advice
  };
}

async function seed() {
  await prisma.studentAnswer.deleteMany();
  await prisma.knowledgeMaterial.deleteMany();
  await prisma.knowledgeCategory.deleteMany();
  await prisma.parentSummary.deleteMany();
  await prisma.learningProfile.deleteMany();
  await prisma.questionKnowledgePoint.deleteMany();
  await prisma.question.deleteMany();
  await prisma.questionBank.deleteMany();
  await prisma.knowledgePoint.deleteMany();
  await prisma.studentCourseEnrollment.deleteMany();
  await prisma.classroomSession.deleteMany();
  await prisma.student.deleteMany();
  await prisma.class.deleteMany();
  await prisma.course.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.createMany({
    data: [
      {
        id: 'user-admin-office',
        username: 'admin-office',
        passwordHash: hashPassword('admin123', 'seed-admin-office'),
        role: 'admin'
      },
      {
        id: 'user-teacher-wang',
        username: 'teacher-wang',
        passwordHash: hashPassword('teacher123', 'seed-teacher-wang'),
        role: 'teacher'
      },
      {
        id: 'user-stu-chenyu',
        username: 'stu-chenyu',
        passwordHash: hashPassword('student123', 'seed-stu-chenyu'),
        role: 'student'
      },
      {
        id: 'user-stu-liming',
        username: 'stu-liming',
        passwordHash: hashPassword('student123', 'seed-stu-liming'),
        role: 'student'
      }
    ]
  });

  await prisma.teacher.create({
    data: {
      id: 'teacher-wang',
      userId: 'user-teacher-wang',
      name: '王老师',
      phone: '13800000000',
      email: 'wang@example.com'
    }
  });

  for (const [index, category] of knowledgeBaseCategories.filter((item) => item.id !== 'all').entries()) {
    await prisma.knowledgeCategory.create({
      data: {
        id: category.id,
        name: category.name,
        icon: category.icon || 'folder_open',
        sortOrder: index
      }
    });
  }

  const seedMaterials = knowledgeMaterials.filter(isKnowledgeMaterialSeed);
  const seededCategoryIds = new Set(knowledgeBaseCategories.map((category) => category.id));

  for (const material of seedMaterials.filter((item) => seededCategoryIds.has(item.categoryId))) {
    await prisma.knowledgeMaterial.create({
      data: {
        id: material.id,
        categoryId: material.categoryId,
        title: material.title,
        type: material.type,
        subject: material.subject,
        grade: material.grade,
        size: material.size,
        pages: material.pages || 0,
        parseStatus: material.status || 'parsed',
        source: material.source || '手动添加',
        chunks: material.chunks || 0,
        evidenceCount: material.evidenceCount || 0,
        vectorIndexed: Boolean(material.vectorIndexed),
        bm25Indexed: Boolean(material.bm25Indexed),
        teacherPinned: Boolean(material.teacherPinned),
        tags: material.tags || [],
        knowledgePoints: material.knowledgePoints || [],
        retrievalSummary: material.retrievalSummary || null,
        evidenceTypes: material.evidenceTypes || [],
        availableActions: material.availableActions || [],
        usedByCourses: material.usedByCourses || []
      }
    });
  }

  await prisma.course.create({
    data: {
      id: courseId,
      teacherId: 'teacher-wang',
      title: '牛顿第二定律',
      subject: '物理',
      grade: '高一',
      description: '围绕 F=ma、合外力计算、加速度方向和受力分析的课堂检测。'
    }
  });

  await prisma.class.createMany({
    data: [
      { id: 'class-2026-physics-1', name: '高一 3 班', grade: '高一', subject: '物理', teacherId: 'teacher-wang' },
      { id: 'class-2026-physics-2', name: '高一 4 班', grade: '高一', subject: '物理', teacherId: 'teacher-wang' }
    ]
  });

  const knowledgePoints = [
    { id: 'kp-newton-2', name: '牛顿第二定律', description: '理解 F=ma 的含义和应用。' },
    { id: 'kp-resultant-force', name: '合外力计算', description: '能根据受力情况求合外力。' },
    { id: 'kp-acceleration-direction', name: '加速度方向', description: '理解加速度方向由合外力方向决定。' },
    { id: 'kp-force-analysis', name: '受力分析', description: '能完整画出并解释受力图。' }
  ];

  for (const point of knowledgePoints) {
    await prisma.knowledgePoint.create({
      data: {
        ...point,
        courseId
      }
    });
  }

  await prisma.questionBank.create({
    data: {
      id: 'newton-laws-bank',
      title: '牛顿定律课堂题库',
      subject: '物理',
      grade: '高一',
      usage: '课前 / 课中 / 课后',
      description: '覆盖牛顿第二定律、受力分析、合力与加速度方向、基础计算。',
      tags: ['牛顿第二定律', '受力分析', '课堂检测']
    }
  });

  for (const student of newtonStudentProfiles) {
    const classId = classIdByName[student.className] || 'class-2026-physics-1';
    await prisma.student.create({
      data: {
        id: student.id,
        userId: student.id === 'stu-chenyu' ? 'user-stu-chenyu' : student.id === 'stu-liming' ? 'user-stu-liming' : null,
        name: student.name,
        classId,
        studentNo: student.id.replace('stu-', '2026-'),
        attendance: student.attendance,
        practiceCount: student.practiceCount
      }
    });

    await prisma.learningProfile.create({
      data: {
        studentId: student.id,
        courseId,
        mastery: student.mastery,
        weakPoints: student.weakPoints,
        mistakeReasons: student.mistakeReasons,
        recommendedPractice: student.recommendedPractice,
        aiConversationSummary: student.aiConversationSummary
      }
    });

    await prisma.parentSummary.create({
      data: {
        studentId: student.id,
        courseId,
        weeklyStatus: student.parentSummary.weeklyStatus,
        mastered: student.parentSummary.mastered,
        needsAttention: student.parentSummary.needsAttention,
        suggestion: student.parentSummary.suggestion
      }
    });
  }

  const questions = [
    ...newtonClassLearningAnalysis.questionStats.map((item, index) => ({
      id: item.questionId,
      title: item.title,
      type: index === 0 ? 'single_choice' : 'calculation',
      difficulty: index === 0 ? 'basic' : 'medium',
      options: item.optionDistribution,
      answer: { value: index === 0 ? '3 m/s²' : '4 m/s²，方向向右' },
      analysis: index === 0
        ? '由 F=ma 得 a=F/m=6/2=3 m/s²。'
        : '先求合外力，再代入 F=ma，并说明方向。',
      accuracy: item.accuracy,
      avgTimeSeconds: avgTimeToSeconds(item.avgTime),
      weakPoint: index === 0 ? '牛顿第二定律应用' : '合外力计算',
      optionDistribution: item.optionDistribution,
      knowledgePointIds: index === 0 ? ['kp-newton-2'] : ['kp-resultant-force', 'kp-force-analysis']
    })),
    ...generatedPaper.questions.slice(0, 4).map((item, index) => ({
      id: item.id,
      title: item.title,
      type: item.type || 'single_choice',
      difficulty: item.difficulty || 'basic',
      options: item.options || null,
      answer: { value: item.answer },
      analysis: item.analysis || '',
      accuracy: null,
      avgTimeSeconds: null,
      weakPoint: item.knowledgePoint,
      optionDistribution: null,
      knowledgePointIds: [knowledgePoints[index % knowledgePoints.length].id]
    }))
  ];

  for (const question of questions) {
    await prisma.question.create({
      data: {
        id: question.id,
        bankId: 'newton-laws-bank',
        courseId,
        stage: question.type === 'calculation' ? '课后' : '课中',
        type: question.type,
        difficulty: question.difficulty,
        title: question.title,
        options: question.options,
        answer: question.answer,
        analysis: question.analysis,
        accuracy: question.accuracy,
        avgTimeSeconds: question.avgTimeSeconds,
        weakPoint: question.weakPoint,
        optionDistribution: question.optionDistribution
      }
    });

    for (const knowledgePointId of question.knowledgePointIds) {
      await prisma.questionKnowledgePoint.create({
        data: {
          questionId: question.id,
          knowledgePointId
        }
      });
    }
  }

  await backfillQuestionBankKnowledgeGraph(prisma, { bankId: 'newton-laws-bank' });

  await prisma.classroomSession.create({
    data: {
      id: sessionId,
      classId: 'class-2026-physics-1',
      courseId,
      title: '牛顿第二定律随堂检测',
      status: 'closed',
      startedAt: new Date('2026-07-07T08:00:00.000Z'),
      endedAt: new Date('2026-07-07T08:25:00.000Z')
    }
  });

  const targetStudents = newtonStudentProfiles.filter((student) => student.className === '高一 3 班');
  const answerRows = [];
  for (const [studentIndex, student] of targetStudents.entries()) {
    for (const [questionIndex, question] of questions.slice(0, 4).entries()) {
      const isCorrect = (studentIndex + questionIndex) % 3 !== 1;
      answerRows.push({
        sessionId,
        studentId: student.id,
        questionId: question.id,
        answer: { value: isCorrect ? question.answer.value : '待订正' },
        isCorrect,
        score: isCorrect ? 1 : 0,
        durationSeconds: 40 + studentIndex * 8 + questionIndex * 12,
        submittedAt: new Date(`2026-07-07T08:${10 + studentIndex}:${10 + questionIndex}.000Z`)
      });
    }
  }

  for (const row of answerRows) {
    await prisma.studentAnswer.create({ data: row });
  }

  console.log(`Seeded ${newtonStudentProfiles.length} students, ${questions.length} questions, ${answerRows.length} answers.`);
}

try {
  await seed();
} finally {
  await prisma.$disconnect();
}
