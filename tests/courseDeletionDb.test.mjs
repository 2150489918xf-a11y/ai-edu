import assert from 'node:assert/strict';

import { PrismaClient } from '@prisma/client';

import { loadEnvFile } from '../server/env.js';
import { createCourseService } from '../server/services/courseService.js';

loadEnvFile();

const prisma = new PrismaClient();
const service = createCourseService(prisma);
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const ids = {
  class: `delete-class-${suffix}`,
  student: `delete-student-${suffix}`,
  emptyGroup: `delete-empty-group-${suffix}`,
  group: `delete-group-${suffix}`,
  course: `delete-course-${suffix}`,
  question: `delete-question-${suffix}`,
  knowledgePoint: `delete-kp-${suffix}`,
  session: `delete-session-${suffix}`,
  enrollment: `delete-enrollment-${suffix}`,
  groupEnrollment: `delete-group-enrollment-${suffix}`,
  answer: `delete-answer-${suffix}`,
  profile: `delete-profile-${suffix}`,
  summary: `delete-summary-${suffix}`
};

async function cleanup() {
  await prisma.studentAnswer.deleteMany({ where: { id: ids.answer } });
  await prisma.classroomSessionQuestion.deleteMany({ where: { sessionId: ids.session } });
  await prisma.studentCourseEnrollment.deleteMany({ where: { id: ids.enrollment } });
  await prisma.studentCourseGroupEnrollment.deleteMany({ where: { id: ids.groupEnrollment } });
  await prisma.learningProfile.deleteMany({ where: { id: ids.profile } });
  await prisma.parentSummary.deleteMany({ where: { id: ids.summary } });
  await prisma.classroomSession.deleteMany({ where: { id: ids.session } });
  await prisma.questionKnowledgePoint.deleteMany({ where: { questionId: ids.question } });
  await prisma.question.deleteMany({ where: { id: ids.question } });
  await prisma.knowledgePoint.deleteMany({ where: { id: ids.knowledgePoint } });
  await prisma.course.deleteMany({ where: { id: ids.course } });
  await prisma.courseGroup.deleteMany({ where: { id: { in: [ids.emptyGroup, ids.group] } } });
  await prisma.student.deleteMany({ where: { id: ids.student } });
  await prisma.class.deleteMany({ where: { id: ids.class } });
}

try {
  await prisma.class.create({
    data: { id: ids.class, name: 'Deletion Test Class', grade: 'Grade 10', subject: 'Physics' }
  });
  await prisma.student.create({
    data: { id: ids.student, classId: ids.class, name: 'Deletion Test Student' }
  });
  await prisma.courseGroup.create({
    data: { id: ids.emptyGroup, title: 'Empty Deletion Group', grade: 'Grade 10', subject: 'Physics' }
  });
  await prisma.courseGroup.create({
    data: { id: ids.group, title: 'Deletion Group', grade: 'Grade 10', subject: 'Physics' }
  });
  await prisma.course.create({
    data: {
      id: ids.course,
      groupId: ids.group,
      title: 'Deletion Unit',
      grade: 'Grade 10',
      subject: 'Physics',
      outline: { title: 'Generated outline' },
      mindmap: { markdown: '# Generated mind map' },
      ppt: { slides: [{ title: 'Generated PPT cover' }] },
      lessonPlan: { title: 'Generated lesson plan' }
    }
  });
  await prisma.knowledgePoint.create({
    data: { id: ids.knowledgePoint, courseId: ids.course, name: 'Deletion Knowledge Point' }
  });
  await prisma.question.create({
    data: {
      id: ids.question,
      courseId: ids.course,
      type: 'single_choice',
      difficulty: 'medium',
      title: 'Deletion question?',
      options: ['A', 'B'],
      answer: 'A',
      analysis: 'Generated analysis'
    }
  });
  await prisma.questionKnowledgePoint.create({
    data: { questionId: ids.question, knowledgePointId: ids.knowledgePoint }
  });
  await prisma.classroomSession.create({
    data: {
      id: ids.session,
      classId: ids.class,
      courseId: ids.course,
      title: 'Deletion Session',
      status: 'completed'
    }
  });
  await prisma.classroomSessionQuestion.create({
    data: { sessionId: ids.session, questionId: ids.question }
  });
  await prisma.studentCourseEnrollment.create({
    data: { id: ids.enrollment, studentId: ids.student, courseId: ids.course }
  });
  await prisma.studentCourseGroupEnrollment.create({
    data: { id: ids.groupEnrollment, studentId: ids.student, groupId: ids.group }
  });
  await prisma.studentAnswer.create({
    data: {
      id: ids.answer,
      sessionId: ids.session,
      studentId: ids.student,
      questionId: ids.question,
      answer: 'B',
      isCorrect: false,
      score: 0,
      durationSeconds: 20
    }
  });
  await prisma.learningProfile.create({
    data: {
      id: ids.profile,
      studentId: ids.student,
      courseId: ids.course,
      mastery: { force: 60 },
      weakPoints: ['force'],
      mistakeReasons: ['concept'],
      recommendedPractice: ['review']
    }
  });
  await prisma.parentSummary.create({
    data: {
      id: ids.summary,
      studentId: ids.student,
      courseId: ids.course,
      weeklyStatus: 'needs_review',
      mastered: [],
      needsAttention: ['force'],
      suggestion: 'Review the unit'
    }
  });

  await assert.rejects(
    () => service.deleteCourseGroup(ids.group),
    (error) => error?.statusCode === 409 && error?.code === 'COURSE_GROUP_NOT_EMPTY' && error?.details?.unitCount === 1
  );

  const emptyGroupResult = await service.deleteCourseGroup(ids.emptyGroup);
  assert.equal(emptyGroupResult.deleted, true);
  assert.equal(await prisma.courseGroup.count({ where: { id: ids.emptyGroup } }), 0);

  const result = await service.deleteCoursePermanently(ids.course);
  assert.equal(result.deleted, true);
  assert.equal(result.deletedQuestions, 1);
  assert.equal(await prisma.course.count({ where: { id: ids.course } }), 0);
  assert.equal(await prisma.question.count({ where: { id: ids.question } }), 0);
  assert.equal(await prisma.knowledgePoint.count({ where: { id: ids.knowledgePoint } }), 0);
  assert.equal(await prisma.classroomSession.count({ where: { id: ids.session } }), 0);
  assert.equal(await prisma.studentAnswer.count({ where: { id: ids.answer } }), 0);
  assert.equal(await prisma.studentCourseEnrollment.count({ where: { id: ids.enrollment } }), 0);
  assert.equal(await prisma.learningProfile.count({ where: { id: ids.profile } }), 0);
  assert.equal(await prisma.parentSummary.count({ where: { id: ids.summary } }), 0);

  const groupResult = await service.deleteCourseGroup(ids.group);
  assert.equal(groupResult.deleted, true);
  assert.equal(await prisma.courseGroup.count({ where: { id: ids.group } }), 0);
  assert.equal(await prisma.studentCourseGroupEnrollment.count({ where: { id: ids.groupEnrollment } }), 0);

  console.log('course deletion database contracts passed');
} finally {
  await cleanup();
  await prisma.$disconnect();
}
