import assert from 'node:assert/strict';

import { PrismaClient } from '@prisma/client';

import { loadEnvFile } from '../server/env.js';
import { createStudentLearningService } from '../server/services/studentLearningService.js';

loadEnvFile();

const prisma = new PrismaClient();
const studentLearningService = createStudentLearningService(prisma);

const studentId = 'stu-chenyu';
const courseId = 'course-personal-practice-test';
const classSessionId = 'session-personal-practice-class';
const personalSessionId = 'session-personal-practice-ai';
const classQuestionId = 'q-personal-practice-class';
const personalQuestionId = 'q-personal-practice-ai';

async function cleanup() {
  await prisma.studentAnswer.deleteMany({
    where: { questionId: { in: [classQuestionId, personalQuestionId] } }
  });
  if (prisma.classroomSessionQuestion) {
    await prisma.classroomSessionQuestion.deleteMany({
      where: { sessionId: { in: [classSessionId, personalSessionId] } }
    });
  }
  await prisma.studentCourseEnrollment.deleteMany({ where: { courseId } });
  await prisma.classroomSession.deleteMany({ where: { courseId } });
  await prisma.question.deleteMany({
    where: { id: { in: [classQuestionId, personalQuestionId] } }
  });
  await prisma.course.deleteMany({ where: { id: courseId } });
}

try {
  await cleanup();
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  assert.ok(student?.classId, 'test student should exist with classId');

  await prisma.course.create({
    data: {
      id: courseId,
      title: 'Personal practice isolation',
      subject: 'Physics',
      grade: 'Grade 10',
      questions: {
        create: [
          {
            id: classQuestionId,
            type: 'choice',
            stage: 'class-practice',
            difficulty: 'basic',
            title: 'Class question should stay out of personal task',
            options: ['A', 'B'],
            answer: { value: 'A' },
            analysis: 'class analysis',
            knowledge: ['class knowledge']
          },
          {
            id: personalQuestionId,
            type: 'choice',
            stage: 'personalized-practice',
            difficulty: 'basic',
            title: 'Personal AI question',
            options: ['A', 'B'],
            answer: { value: 'B' },
            analysis: 'personal analysis',
            knowledge: ['personal knowledge']
          }
        ]
      },
      sessions: {
        create: [
          {
            id: classSessionId,
            classId: student.classId,
            title: 'Class practice',
            status: 'active',
            startedAt: new Date()
          },
          {
            id: personalSessionId,
            classId: student.classId,
            title: 'AI personal practice',
            status: 'ai_personal_practice',
            targetStudentId: studentId,
            startedAt: new Date()
          }
        ]
      }
    }
  });
  await prisma.classroomSessionQuestion.createMany({
    data: [
      { sessionId: classSessionId, questionId: classQuestionId, sortOrder: 0 },
      { sessionId: personalSessionId, questionId: personalQuestionId, sortOrder: 0 }
    ]
  });
  await prisma.studentCourseEnrollment.create({
    data: {
      studentId,
      courseId,
      sessionId: personalSessionId
    }
  });

  const task = await studentLearningService.getTask(studentId, personalSessionId);
  assert.equal(task.questions.length, 1);
  assert.equal(task.questions[0].id, personalQuestionId);

  const saved = await studentLearningService.saveAnswer(studentId, personalSessionId, {
    questionId: personalQuestionId,
    answer: { value: 'B' }
  });
  assert.equal(saved.answeredCount, 1);
  assert.equal(saved.totalCount, 1);

  await assert.rejects(
    () => studentLearningService.saveAnswer(studentId, personalSessionId, {
      questionId: classQuestionId,
      answer: { value: 'A' }
    }),
    /does not belong to this task|not found|不存在/
  );

  console.log('student personal practice database contracts passed');
} finally {
  await cleanup().catch(() => {});
  await prisma.$disconnect();
}
