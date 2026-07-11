import { loadEnvFile } from '../server/env.js';
import { hashPassword } from '../server/services/authService.js';
import { backfillQuestionBankKnowledgeGraph } from './backfillQuestionBankKnowledgeGraph.js';

loadEnvFile();

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

const teachers = [
  { id: 'teacher-wang', userId: 'user-teacher-wang', username: 'teacher-wang', password: 'teacher123', name: '王老师', phone: '13800000000', email: 'wang@example.com' },
  { id: 'dev-teacher-li', userId: 'dev-user-teacher-li', username: 'teacher-li', password: 'teacher123', name: '李老师', phone: '13800000001', email: 'li@example.com' },
  { id: 'dev-teacher-zhang', userId: 'dev-user-teacher-zhang', username: 'teacher-zhang', password: 'teacher123', name: '张老师', phone: '13800000002', email: 'zhang@example.com' },
  { id: 'dev-teacher-zhao', userId: 'dev-user-teacher-zhao', username: 'teacher-zhao', password: 'teacher123', name: '赵老师', phone: '13800000003', email: 'zhao@example.com' },
  { id: 'dev-teacher-zhou', userId: 'dev-user-teacher-zhou', username: 'teacher-zhou', password: 'teacher123', name: '周老师', phone: '13800000004', email: 'zhou@example.com' }
];

const classes = [
  { id: 'dev-class-grade1-1', name: '高一 1 班', grade: '高一', subject: '综合', teacherId: 'teacher-wang' },
  { id: 'dev-class-grade1-2', name: '高一 2 班', grade: '高一', subject: '综合', teacherId: 'dev-teacher-li' },
  { id: 'class-2026-physics-1', name: '高一 3 班', grade: '高一', subject: '物理', teacherId: 'teacher-wang' },
  { id: 'class-2026-physics-2', name: '高一 4 班', grade: '高一', subject: '物理', teacherId: 'dev-teacher-zhang' }
];

const students = [
  ['dev-stu-luoyang', 'user-dev-stu-luoyang', 'stu-luoyang', '罗阳', 'dev-class-grade1-1'],
  ['dev-stu-sunqi', 'user-dev-stu-sunqi', 'stu-sunqi', '孙琪', 'dev-class-grade1-1'],
  ['dev-stu-heyu', 'user-dev-stu-heyu', 'stu-heyu', '何宇', 'dev-class-grade1-1'],
  ['dev-stu-wumeng', 'user-dev-stu-wumeng', 'stu-wumeng', '吴萌', 'dev-class-grade1-1'],
  ['dev-stu-hanxiao', 'user-dev-stu-hanxiao', 'stu-hanxiao', '韩笑', 'dev-class-grade1-2'],
  ['dev-stu-liuxin', 'user-dev-stu-liuxin', 'stu-liuxin', '刘欣', 'dev-class-grade1-2'],
  ['dev-stu-guoyi', 'user-dev-stu-guoyi', 'stu-guoyi', '郭一', 'dev-class-grade1-2'],
  ['dev-stu-fangyuan', 'user-dev-stu-fangyuan', 'stu-fangyuan', '方圆', 'dev-class-grade1-2'],
  ['stu-chenyu', 'user-stu-chenyu', 'stu-chenyu', '陈雨', 'class-2026-physics-1'],
  ['stu-liming', 'user-stu-liming', 'stu-liming', '李明', 'class-2026-physics-1'],
  ['dev-stu-zhouxuan', 'user-dev-stu-zhouxuan', 'stu-zhouxuan', '周璇', 'class-2026-physics-1'],
  ['dev-stu-xiechen', 'user-dev-stu-xiechen', 'stu-xiechen', '谢晨', 'class-2026-physics-1'],
  ['dev-stu-yangfan', 'user-dev-stu-yangfan', 'stu-yangfan', '杨帆', 'class-2026-physics-2'],
  ['dev-stu-tangyi', 'user-dev-stu-tangyi', 'stu-tangyi', '唐一', 'class-2026-physics-2'],
  ['dev-stu-cailei', 'user-dev-stu-cailei', 'stu-cailei', '蔡蕾', 'class-2026-physics-2'],
  ['dev-stu-malin', 'user-dev-stu-malin', 'stu-malin', '马琳', 'class-2026-physics-2']
];

const courses = [
  { id: 'course-newton-2', teacherId: 'teacher-wang', title: '牛顿第二定律', subject: '物理', grade: '高一', description: '理解 F=ma、合外力与加速度方向。' },
  { id: 'dev-course-motion', teacherId: 'teacher-wang', title: '匀变速直线运动', subject: '物理', grade: '高一', description: '位移、速度、加速度公式综合应用。' },
  { id: 'dev-course-force-composition', teacherId: 'teacher-wang', title: '力的合成', subject: '物理', grade: '高一', description: '平行四边形定则与共点力平衡。' },
  { id: 'dev-course-function-basic', teacherId: 'dev-teacher-li', title: '函数基础', subject: '数学', grade: '高一', description: '函数概念、定义域和值域。' },
  { id: 'dev-course-quadratic', teacherId: 'dev-teacher-li', title: '二次函数', subject: '数学', grade: '高一', description: '图像、顶点、单调性与最值。' },
  { id: 'dev-course-triangle', teacherId: 'dev-teacher-li', title: '三角函数入门', subject: '数学', grade: '高一', description: '角度制、弧度制与基础公式。' },
  { id: 'dev-course-amount', teacherId: 'dev-teacher-zhang', title: '物质的量', subject: '化学', grade: '高一', description: '摩尔、阿伏伽德罗常数与浓度计算。' },
  { id: 'dev-course-redox', teacherId: 'dev-teacher-zhang', title: '氧化还原反应', subject: '化学', grade: '高一', description: '化合价变化、氧化剂与还原剂判断。' },
  { id: 'dev-course-relative-clause', teacherId: 'dev-teacher-zhao', title: '定语从句', subject: '英语', grade: '高一', description: '关系代词、关系副词与句子分析。' },
  { id: 'dev-course-reading', teacherId: 'dev-teacher-zhao', title: '阅读理解训练', subject: '英语', grade: '高一', description: '主旨题、细节题与推断题训练。' },
  { id: 'dev-course-modern-prose', teacherId: 'dev-teacher-zhou', title: '现代文阅读', subject: '语文', grade: '高一', description: '信息筛选、结构分析与表达效果。' },
  { id: 'dev-course-classical', teacherId: 'dev-teacher-zhou', title: '文言文基础', subject: '语文', grade: '高一', description: '常见实词、虚词与翻译方法。' }
];

const courseGroups = [
  { id: 'group-physics-grade1', teacherId: 'teacher-wang', title: '高一物理', subject: '物理', grade: '高一', description: '高一物理基础课程' },
  { id: 'group-math-grade1', teacherId: 'dev-teacher-li', title: '高一数学', subject: '数学', grade: '高一', description: '高一数学基础课程' },
  { id: 'group-chemistry-grade1', teacherId: 'dev-teacher-zhang', title: '高一化学', subject: '化学', grade: '高一', description: '高一化学基础课程' },
  { id: 'group-english-grade1', teacherId: 'dev-teacher-zhao', title: '高一英语', subject: '英语', grade: '高一', description: '高一英语基础课程' },
  { id: 'group-chinese-grade1', teacherId: 'dev-teacher-zhou', title: '高一语文', subject: '语文', grade: '高一', description: '高一语文基础课程' }
];

const courseGroupByCourseId = {
  'course-newton-2': 'group-physics-grade1',
  'dev-course-motion': 'group-physics-grade1',
  'dev-course-force-composition': 'group-physics-grade1',
  'dev-course-function-basic': 'group-math-grade1',
  'dev-course-quadratic': 'group-math-grade1',
  'dev-course-triangle': 'group-math-grade1',
  'dev-course-amount': 'group-chemistry-grade1',
  'dev-course-redox': 'group-chemistry-grade1',
  'dev-course-relative-clause': 'group-english-grade1',
  'dev-course-reading': 'group-english-grade1',
  'dev-course-modern-prose': 'group-chinese-grade1',
  'dev-course-classical': 'group-chinese-grade1'
};

const classCourseMap = [
  ['dev-class-grade1-1', ['dev-course-motion', 'dev-course-function-basic', 'dev-course-reading']],
  ['dev-class-grade1-2', ['dev-course-quadratic', 'dev-course-amount', 'dev-course-modern-prose']],
  ['class-2026-physics-1', ['course-newton-2', 'dev-course-force-composition', 'dev-course-relative-clause']],
  ['class-2026-physics-2', ['dev-course-motion', 'dev-course-redox', 'dev-course-classical']]
];

const extraEnrollments = [
  ['stu-chenyu', 'dev-course-quadratic'],
  ['stu-chenyu', 'dev-course-reading'],
  ['stu-liming', 'dev-course-amount'],
  ['dev-stu-zhouxuan', 'dev-course-triangle'],
  ['dev-stu-xiechen', 'dev-course-modern-prose'],
  ['dev-stu-luoyang', 'dev-course-force-composition'],
  ['dev-stu-sunqi', 'dev-course-redox'],
  ['dev-stu-hanxiao', 'dev-course-relative-clause'],
  ['dev-stu-yangfan', 'dev-course-function-basic'],
  ['dev-stu-tangyi', 'course-newton-2']
];

function questionId(courseId, index) {
  return `${courseId}-q${index}`;
}

function sessionId(classId, courseId) {
  return `session-${classId}-${courseId}`;
}

function enrollmentId(studentId, courseId) {
  return `enroll-${studentId}-${courseId}`;
}

function groupEnrollmentId(studentId, groupId) {
  return `group-enroll-${studentId}-${groupId}`;
}

function answerId(studentId, sessionIdValue, questionIdValue) {
  return `answer-${studentId}-${sessionIdValue}-${questionIdValue}`;
}

function getCourseGroupId(courseOrCourseId) {
  const courseId = typeof courseOrCourseId === 'string' ? courseOrCourseId : courseOrCourseId?.id;
  return courseGroupByCourseId[courseId] || null;
}

function getCourseKnowledgeTags(course, index) {
  const presets = {
    'dev-course-reading': ['主旨判断', '细节定位', '推断理解', '错因复盘'],
    'dev-course-quadratic': ['图像性质', '定义域值域', '单调性', '最值分析'],
    'course-newton-2': ['受力分析', '条件提取', '公式迁移', '错因复盘']
  };
  const tags = presets[course.id] || [`${course.title}概念`, `${course.title}条件`, `${course.title}迁移`, `${course.title}复盘`];
  return [tags[index] || course.title];
}

function buildQuestions(course) {
  return [
    {
      id: questionId(course.id, 1),
      type: '选择题',
      difficulty: '基础',
      title: `${course.title}中最核心的概念是下列哪一项？`,
      options: ['A. 只记忆结论', `B. 理解${course.title}的适用条件`, 'C. 忽略题干信息', 'D. 只看答案'],
      answer: { value: `B. 理解${course.title}的适用条件` },
      analysis: '先判断概念和适用条件，再进入计算或文本分析。',
      knowledge: getCourseKnowledgeTags(course, 0)
    },
    {
      id: questionId(course.id, 2),
      type: '填空题',
      difficulty: '基础',
      title: `${course.title}学习时，需要先明确题目给出的____。`,
      options: [],
      answer: { value: '条件' },
      analysis: '先提取条件，再选择公式或分析路径。',
      knowledge: getCourseKnowledgeTags(course, 1)
    },
    {
      id: questionId(course.id, 3),
      type: '选择题',
      difficulty: '提高',
      title: `关于${course.title}的学习策略，哪一项更合理？`,
      options: ['A. 跳过过程', 'B. 只背题型', 'C. 建立知识点之间的联系', 'D. 不复盘错题'],
      answer: { value: 'C. 建立知识点之间的联系' },
      analysis: '跨题型迁移依赖知识结构，而不是单题记忆。',
      knowledge: getCourseKnowledgeTags(course, 2)
    },
    {
      id: questionId(course.id, 4),
      type: '填空题',
      difficulty: '提高',
      title: `完成${course.title}练习后，应该整理自己的____。`,
      options: [],
      answer: { value: '错因' },
      analysis: '错因复盘可以帮助定位概念、审题或计算问题。',
      knowledge: getCourseKnowledgeTags(course, 3)
    }
  ];
}

async function upsertUsersAndTeachers() {
  await prisma.user.upsert({
    where: { id: 'user-admin-office' },
    update: {
      username: 'admin-office',
      passwordHash: hashPassword('admin123', 'dev-admin-office'),
      role: 'admin',
      status: 'active'
    },
    create: {
      id: 'user-admin-office',
      username: 'admin-office',
      passwordHash: hashPassword('admin123', 'dev-admin-office'),
      role: 'admin'
    }
  });

  for (const teacher of teachers) {
    await prisma.user.upsert({
      where: { id: teacher.userId },
      update: {
        username: teacher.username,
        passwordHash: hashPassword(teacher.password, `dev-${teacher.id}`),
        role: 'teacher',
        status: 'active'
      },
      create: {
        id: teacher.userId,
        username: teacher.username,
        passwordHash: hashPassword(teacher.password, `dev-${teacher.id}`),
        role: 'teacher'
      }
    });
    await prisma.teacher.upsert({
      where: { id: teacher.id },
      update: {
        userId: teacher.userId,
        name: teacher.name,
        phone: teacher.phone,
        email: teacher.email,
        status: 'active',
        deletedAt: null
      },
      create: {
        id: teacher.id,
        userId: teacher.userId,
        name: teacher.name,
        phone: teacher.phone,
        email: teacher.email
      }
    });
  }
}

async function upsertClassesAndStudents() {
  for (const item of classes) {
    await prisma.class.upsert({
      where: { id: item.id },
      update: { ...item, status: 'active', deletedAt: null },
      create: item
    });
  }

  for (const [id, userId, username, name, classId] of students) {
    await prisma.user.upsert({
      where: { id: userId },
      update: {
        username,
        passwordHash: hashPassword('student123', `dev-${id}`),
        role: 'student',
        status: 'active'
      },
      create: {
        id: userId,
        username,
        passwordHash: hashPassword('student123', `dev-${id}`),
        role: 'student'
      }
    });
    await prisma.student.upsert({
      where: { id },
      update: {
        userId,
        name,
        classId,
        studentNo: id.startsWith('stu-') ? id.replace('stu-', '2026-') : id.replace('dev-stu-', '2026-'),
        attendance: '98%',
        practiceCount: 18,
        status: 'active',
        deletedAt: null
      },
      create: {
        id,
        userId,
        name,
        classId,
        studentNo: id.startsWith('stu-') ? id.replace('stu-', '2026-') : id.replace('dev-stu-', '2026-'),
        attendance: '98%',
        practiceCount: 18
      }
    });
  }
}

async function upsertCourseGroups() {
  for (const group of courseGroups) {
    await prisma.courseGroup.upsert({
      where: { id: group.id },
      update: {
        ...group,
        status: 'active',
        deletedAt: null
      },
      create: group
    });
  }
}

async function upsertCoursesAndQuestions() {
  for (const [index, course] of courses.entries()) {
    const courseUnitData = {
      ...course,
      groupId: getCourseGroupId(course),
      unitType: 'lesson',
      sortOrder: index + 1
    };
    await prisma.course.upsert({
      where: { id: course.id },
      update: {
        ...courseUnitData,
        duration: '45 分钟',
        goal: `完成${course.title}核心知识点练习`,
        status: 'active',
        deletedAt: null
      },
      create: {
        ...courseUnitData,
        duration: '45 分钟',
        goal: `完成${course.title}核心知识点练习`
      }
    });

    for (const question of buildQuestions(course)) {
      await prisma.question.upsert({
        where: { id: question.id },
        update: {
          courseId: course.id,
          type: question.type,
          stage: '课后练习',
          difficulty: question.difficulty,
          title: question.title,
          options: question.options,
          answer: question.answer,
          analysis: question.analysis,
          knowledge: question.knowledge,
          status: 'active',
          deletedAt: null
        },
        create: {
          id: question.id,
          courseId: course.id,
          type: question.type,
          stage: '课后练习',
          difficulty: question.difficulty,
          title: question.title,
          options: question.options,
          answer: question.answer,
          analysis: question.analysis,
          knowledge: question.knowledge
        }
      });
    }
  }
}

async function upsertClassSessions() {
  for (const [classId, courseIds] of classCourseMap) {
    for (const [index, courseId] of courseIds.entries()) {
      const course = courses.find((item) => item.id === courseId);
      const id = sessionId(classId, courseId);
      await prisma.classroomSession.upsert({
        where: { id },
        update: {
          classId,
          courseId,
          title: `${course.title} 课堂练习`,
          status: 'published',
          startedAt: new Date(Date.UTC(2026, 5, 20 + index, 1, 0, 0))
        },
        create: {
          id,
          classId,
          courseId,
          title: `${course.title} 课堂练习`,
          status: 'published',
          startedAt: new Date(Date.UTC(2026, 5, 20 + index, 1, 0, 0))
        }
      });
    }
  }
}

async function upsertEnrollments() {
  for (const [studentId, courseId] of extraEnrollments) {
    const student = students.find((item) => item[0] === studentId);
    const course = courses.find((item) => item.id === courseId);
    const personalSessionId = `session-personal-${studentId}-${courseId}`;
    await prisma.classroomSession.upsert({
      where: { id: personalSessionId },
      update: {
        classId: student[4],
        courseId,
        title: `${course.title} 自主练习`,
        status: 'student_enrollment',
        startedAt: new Date(Date.UTC(2026, 5, 24, 1, 0, 0))
      },
      create: {
        id: personalSessionId,
        classId: student[4],
        courseId,
        title: `${course.title} 自主练习`,
        status: 'student_enrollment',
        startedAt: new Date(Date.UTC(2026, 5, 24, 1, 0, 0))
      }
    });
    await prisma.studentCourseEnrollment.upsert({
      where: {
        studentId_courseId: {
          studentId,
          courseId
        }
      },
      update: {
        sessionId: personalSessionId,
        status: 'active'
      },
      create: {
        id: enrollmentId(studentId, courseId),
        studentId,
        courseId,
        sessionId: personalSessionId
      }
    });
  }
}

async function upsertCourseGroupEnrollments() {
  const derivedEnrollments = new Map();

  for (const [classId, courseIds] of classCourseMap) {
    const classStudents = students.filter((student) => student[4] === classId);
    for (const courseId of courseIds) {
      const groupId = getCourseGroupId(courseId);
      if (!groupId) continue;
      for (const [studentId] of classStudents) {
        derivedEnrollments.set(`${studentId}:${groupId}`, { studentId, groupId });
      }
    }
  }

  for (const [studentId, courseId] of extraEnrollments) {
    const groupId = getCourseGroupId(courseId);
    if (!groupId) continue;
    derivedEnrollments.set(`${studentId}:${groupId}`, { studentId, groupId });
  }

  for (const { studentId, groupId } of derivedEnrollments.values()) {
    await prisma.studentCourseGroupEnrollment.upsert({
      where: {
        studentId_groupId: {
          studentId,
          groupId
        }
      },
      update: {
        status: 'active'
      },
      create: {
        id: groupEnrollmentId(studentId, groupId),
        studentId,
        groupId
      }
    });
  }
}

async function upsertAnswers() {
  const answerSeeds = [
    ['stu-chenyu', sessionId('class-2026-physics-1', 'course-newton-2'), 'course-newton-2', [true, true, false]],
    ['stu-chenyu', 'session-personal-stu-chenyu-dev-course-reading', 'dev-course-reading', [true, false, true, true]],
    ['stu-chenyu', 'session-personal-stu-chenyu-dev-course-quadratic', 'dev-course-quadratic', [true, false, true]],
    ['stu-liming', sessionId('class-2026-physics-1', 'course-newton-2'), 'course-newton-2', [true, false]],
    ['dev-stu-zhouxuan', sessionId('class-2026-physics-1', 'dev-course-force-composition'), 'dev-course-force-composition', [true, true]],
    ['dev-stu-luoyang', sessionId('dev-class-grade1-1', 'dev-course-motion'), 'dev-course-motion', [true, false, true]],
    ['dev-stu-hanxiao', sessionId('dev-class-grade1-2', 'dev-course-quadratic'), 'dev-course-quadratic', [false, true]],
    ['dev-stu-yangfan', sessionId('class-2026-physics-2', 'dev-course-redox'), 'dev-course-redox', [true, true, true]]
  ];

  for (const [studentId, sessionIdValue, courseId, correctnessList] of answerSeeds) {
    for (const [index, isCorrect] of correctnessList.entries()) {
      const qid = questionId(courseId, index + 1);
      const question = buildQuestions(courses.find((course) => course.id === courseId))[index];
      await prisma.studentAnswer.upsert({
        where: { id: answerId(studentId, sessionIdValue, qid) },
        update: {
          answer: isCorrect ? question.answer : { value: '待复盘答案' },
          isCorrect,
          score: isCorrect ? 1 : 0,
          durationSeconds: 45 + index * 12
        },
        create: {
          id: answerId(studentId, sessionIdValue, qid),
          sessionId: sessionIdValue,
          studentId,
          questionId: qid,
          answer: isCorrect ? question.answer : { value: '待复盘答案' },
          isCorrect,
          score: isCorrect ? 1 : 0,
          durationSeconds: 45 + index * 12
        }
      });
    }
  }
}

async function main() {
  await upsertUsersAndTeachers();
  await upsertClassesAndStudents();
  await upsertCourseGroups();
  await upsertCoursesAndQuestions();
  await backfillQuestionBankKnowledgeGraph(prisma);
  await upsertClassSessions();
  await upsertEnrollments();
  await upsertCourseGroupEnrollments();
  await upsertAnswers();

  console.log(JSON.stringify({
    teachers: teachers.length,
    classes: classes.length,
    students: students.length,
    courseGroups: courseGroups.length,
    courses: courses.length,
    questions: courses.length * 4,
    extraEnrollments: extraEnrollments.length
  }, null, 2));
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
