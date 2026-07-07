function notFound(message) {
  const error = new Error(message);
  error.statusCode = 404;
  error.code = 'NOT_FOUND';
  return error;
}

function toPlainScore(value) {
  if (value && typeof value.toNumber === 'function') return value.toNumber();
  return Number(value || 0);
}

function average(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function calculateLowestMastery(mastery = []) {
  return [...mastery].sort((a, b) => a.value - b.value)[0] || null;
}

export function createLearningService(prisma) {
  return {
    async getClasses(filters = {}) {
      const classes = await prisma.class.findMany({
        where: {
          subject: filters.subject || undefined,
          grade: filters.grade || undefined
        },
        include: {
          _count: {
            select: { students: true }
          }
        },
        orderBy: [{ grade: 'asc' }, { name: 'asc' }]
      });

      return classes.map((item) => ({
        id: item.id,
        name: item.name,
        grade: item.grade,
        subject: item.subject,
        studentCount: item._count.students
      }));
    },

    async getStudents(filters = {}) {
      const allClasses = await prisma.class.findMany({ orderBy: { name: 'asc' } });
      const targetClass = filters.className && filters.className !== '全部班级'
        ? allClasses.find((item) => item.name === filters.className)
        : null;

      const where = {
        classId: filters.classId || targetClass?.id || undefined,
        OR: filters.keyword
          ? [
              { name: { contains: filters.keyword, mode: 'insensitive' } },
              { studentNo: { contains: filters.keyword, mode: 'insensitive' } }
            ]
          : undefined
      };

      const page = filters.page || 1;
      const pageSize = filters.pageSize || 20;
      const [students, total] = await Promise.all([
        prisma.student.findMany({
          where,
          include: {
            class: true,
            learningProfiles: {
              include: { course: true },
              orderBy: { updatedAt: 'desc' },
              take: 1
            }
          },
          orderBy: { name: 'asc' },
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        prisma.student.count({ where })
      ]);

      return {
        classes: ['全部班级', ...allClasses.map((item) => item.name)],
        students: students.map((student) => {
          const profile = student.learningProfiles[0];
          const mastery = Array.isArray(profile?.mastery) ? profile.mastery : [];
          const weakPoints = Array.isArray(profile?.weakPoints) ? profile.weakPoints : [];
          return {
            id: student.id,
            name: student.name,
            classId: student.classId,
            className: student.class.name,
            studentNo: student.studentNo,
            attendance: student.attendance,
            practiceCount: student.practiceCount,
            avgMastery: average(mastery.map((item) => Number(item.value || 0))),
            lowestMastery: calculateLowestMastery(mastery),
            weakPoints,
            aiConversationSummary: profile?.aiConversationSummary || ''
          };
        }),
        total
      };
    },

    async getClassLearningSummary(classId, filters = {}) {
      const session = await prisma.classroomSession.findFirst({
        where: {
          classId,
          courseId: filters.courseId || undefined,
          id: filters.sessionId || undefined
        },
        include: {
          class: {
            include: { _count: { select: { students: true } } }
          },
          course: true,
          answers: {
            include: {
              question: true,
              student: true
            }
          }
        },
        orderBy: { startedAt: 'desc' }
      });

      if (!session) throw notFound('班级学情不存在');

      const submitted = new Set(session.answers.map((item) => item.studentId)).size;
      const avgAccuracy = average(session.answers.map((item) => (item.isCorrect ? 100 : 0)));
      const questionMap = new Map();

      for (const answer of session.answers) {
        const current = questionMap.get(answer.questionId) || {
          question: answer.question,
          answers: []
        };
        current.answers.push(answer);
        questionMap.set(answer.questionId, current);
      }

      const questionStats = [...questionMap.values()].map(({ question, answers }) => {
        const correctCount = answers.filter((item) => item.isCorrect).length;
        return {
          id: question.id,
          title: question.title,
          accuracy: answers.length ? Math.round((correctCount / answers.length) * 100) : question.accuracy || 0,
          avgTimeSeconds: average(answers.map((item) => Number(item.durationSeconds || 0))),
          avgTime: `${average(answers.map((item) => Number(item.durationSeconds || 0)))} 秒`,
          weakPoint: question.weakPoint,
          optionDistribution: question.optionDistribution || []
        };
      });

      const weakPointStats = new Map();
      for (const answer of session.answers) {
        if (answer.isCorrect || !answer.question.weakPoint) continue;
        const key = answer.question.weakPoint;
        weakPointStats.set(key, (weakPointStats.get(key) || 0) + 1);
      }

      const weakPoints = [...weakPointStats.entries()].map(([name, wrongCount], index) => ({
        id: `weak-${index + 1}`,
        name,
        score: Math.max(100 - wrongCount * 12, 40),
        accuracy: Math.max(100 - wrongCount * 18, 20),
        impact: `${wrongCount} 次错误集中在${name}。`
      }));

      return {
        classId: session.classId,
        className: session.class.name,
        courseId: session.courseId,
        lessonName: session.course.title,
        totalStudents: session.class._count.students,
        submitted,
        avgAccuracy,
        updatedAt: new Date().toISOString(),
        questionStats,
        weakPoints,
        aiAdvice: weakPoints.length
          ? `建议优先复盘${weakPoints[0].name}，再安排递进练习。`
          : '本次检测整体稳定，可进入下一阶段训练。'
      };
    },

    async getStudentProfile(studentId, filters = {}) {
      const profile = await prisma.learningProfile.findFirst({
        where: {
          studentId,
          courseId: filters.courseId || undefined
        },
        include: {
          student: { include: { class: true } },
          course: true
        },
        orderBy: { updatedAt: 'desc' }
      });

      if (!profile) throw notFound('学生画像不存在');

      return {
        id: profile.student.id,
        name: profile.student.name,
        classId: profile.student.classId,
        className: profile.student.class.name,
        mastery: profile.mastery,
        weakPoints: profile.weakPoints,
        mistakeReasons: profile.mistakeReasons,
        recommendedPractice: profile.recommendedPractice,
        aiConversationSummary: profile.aiConversationSummary
      };
    },

    async getParentSummary(studentId, filters = {}) {
      const summary = await prisma.parentSummary.findFirst({
        where: {
          studentId,
          courseId: filters.courseId || undefined
        },
        include: { student: true },
        orderBy: { generatedAt: 'desc' }
      });

      if (!summary) throw notFound('家长摘要不存在');

      return {
        studentId: summary.studentId,
        studentName: summary.student.name,
        weeklyStatus: summary.weeklyStatus,
        mastered: summary.mastered,
        needsAttention: summary.needsAttention,
        suggestion: summary.suggestion
      };
    },

    async submitStudentAnswer(payload = {}) {
      if (!payload.sessionId || !payload.studentId || !payload.questionId) {
        const error = new Error('缺少必要答题参数');
        error.statusCode = 400;
        error.code = 'BAD_REQUEST';
        throw error;
      }

      const question = await prisma.question.findUnique({ where: { id: payload.questionId } });
      if (!question) throw notFound('题目不存在');

      const expected = JSON.stringify(question.answer);
      const actual = JSON.stringify(payload.answer);
      const isCorrect = expected === actual || question.answer?.value === payload.answer?.value;

      const answer = await prisma.studentAnswer.create({
        data: {
          sessionId: payload.sessionId,
          studentId: payload.studentId,
          questionId: payload.questionId,
          answer: payload.answer || {},
          isCorrect,
          score: isCorrect ? 1 : 0,
          durationSeconds: payload.durationSeconds || null
        }
      });

      return {
        id: answer.id,
        isCorrect: answer.isCorrect,
        score: toPlainScore(answer.score),
        analysis: question.analysis,
        submittedAt: answer.submittedAt.toISOString()
      };
    },

    async getQuestionAnswerRecords(filters = {}) {
      const page = filters.page || 1;
      const pageSize = filters.pageSize || 20;
      const where = {
        studentId: filters.studentId || undefined,
        sessionId: filters.sessionId || undefined,
        question: {
          courseId: filters.courseId || undefined
        },
        student: {
          classId: filters.classId || undefined
        }
      };

      const [answers, total] = await Promise.all([
        prisma.studentAnswer.findMany({
          where,
          include: {
            student: true,
            question: true
          },
          orderBy: { submittedAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        prisma.studentAnswer.count({ where })
      ]);

      return {
        records: answers.map((answer) => ({
          id: answer.id,
          studentId: answer.studentId,
          studentName: answer.student.name,
          questionId: answer.questionId,
          questionTitle: answer.question.title,
          answer: answer.answer,
          isCorrect: answer.isCorrect,
          score: toPlainScore(answer.score),
          durationSeconds: answer.durationSeconds,
          submittedAt: answer.submittedAt.toISOString()
        })),
        total
      };
    }
  };
}
