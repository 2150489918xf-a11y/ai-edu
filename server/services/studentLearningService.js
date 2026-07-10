function createHttpError(statusCode, code, message, details = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

const STUDENT_ENROLLMENT_SESSION_STATUS = 'student_enrollment';

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeOptions(value) {
  return normalizeArray(value)
    .map((option) => {
      if (typeof option === 'string') return option;
      if (!option || typeof option !== 'object') return '';
      const text = option.text || option.content || option.title || option.option;
      if (!text) return '';
      return option.label ? `${option.label}. ${text}` : String(text);
    })
    .filter(Boolean);
}

function toIso(value) {
  return value?.toISOString?.() || value || null;
}

function normalizeQuestionType(question) {
  const type = String(question.type || '').toLowerCase();
  const options = normalizeOptions(question.options);
  if (options.length || type.includes('choice') || question.type === '单选题' || question.type === '选择题') return options.length ? 'choice' : 'blank';
  return 'blank';
}

function normalizeQuestion(question, answer = null) {
  return {
    id: question.id,
    courseId: question.courseId,
    type: normalizeQuestionType(question),
    title: question.title,
    options: normalizeOptions(question.options),
    difficulty: question.difficulty || '',
    stage: question.stage || '',
    knowledge: normalizeArray(question.knowledge),
    studentAnswer: answer?.answer || null,
    answeredAt: toIso(answer?.submittedAt)
  };
}

function isSupportedQuestion(question) {
  return ['choice', 'blank'].includes(normalizeQuestionType(question));
}

function normalizeAnswer(value) {
  if (value && typeof value === 'object' && 'value' in value) return value;
  return { value: value ?? '' };
}

function isAnswerCorrect(question, answer) {
  const expected = normalizeAnswer(question.answer);
  const actual = normalizeAnswer(answer);
  return String(expected.value ?? '').trim() === String(actual.value ?? '').trim();
}

function buildTaskStatus(answeredCount, totalCount) {
  if (!answeredCount) return 'not_started';
  if (answeredCount < totalCount) return 'in_progress';
  return 'completed';
}

function getSessionQuestions(session) {
  const linkedQuestions = normalizeArray(session.sessionQuestions)
    .map((item) => item.question)
    .filter(Boolean);
  const source = linkedQuestions.length ? linkedQuestions : normalizeArray(session.course?.questions);
  return source.filter(isSupportedQuestion);
}

function buildTask(session, studentId) {
  const questions = getSessionQuestions(session);
  const answerQuestionIds = new Set(normalizeArray(session.answers).filter((answer) => answer.studentId === studentId).map((answer) => answer.questionId));
  const answeredCount = questions.filter((question) => answerQuestionIds.has(question.id)).length;
  return {
    id: session.id,
    courseId: session.courseId,
    title: session.title,
    type: 'practice',
    status: buildTaskStatus(answeredCount, questions.length),
    questionCount: questions.length,
    answeredCount,
    startedAt: toIso(session.startedAt),
    endedAt: toIso(session.endedAt)
  };
}

function normalizeTeacher(student, course) {
  return course?.teacher?.name || student.class?.teacher?.name || '任课老师';
}

function normalizeStudentProfile(student) {
  return {
    id: student.id,
    name: student.name,
    studentNo: student.studentNo || '',
    classId: student.classId,
    className: student.class?.name || '',
    grade: student.class?.grade || '',
    subject: student.class?.subject || ''
  };
}

function createCourseSummary(session, student, source) {
  const task = buildTask(session, student.id);
  return {
    id: session.course.id,
    title: session.course.title,
    subject: session.course.subject,
    grade: session.course.grade,
    teacher: normalizeTeacher(student, session.course),
    description: session.course.description || '',
    nextLessonAt: toIso(session.startedAt),
    source,
    taskCount: 1,
    pendingTaskCount: task.status === 'completed' ? 0 : 1,
    answeredQuestionCount: task.answeredCount,
    questionCount: task.questionCount,
    progress: task.questionCount ? Math.round((task.answeredCount / task.questionCount) * 100) : 0
  };
}

function mergeCourseSummary(existing, session, student, source) {
  const next = createCourseSummary(session, student, source);
  if (!existing) return next;
  const answeredQuestionCount = existing.answeredQuestionCount + next.answeredQuestionCount;
  const questionCount = existing.questionCount + next.questionCount;
  return {
    ...existing,
    nextLessonAt: existing.nextLessonAt || next.nextLessonAt,
    taskCount: existing.taskCount + next.taskCount,
    pendingTaskCount: existing.pendingTaskCount + next.pendingTaskCount,
    answeredQuestionCount,
    questionCount,
    progress: questionCount ? Math.round((answeredQuestionCount / questionCount) * 100) : 0,
    source: existing.source === 'joined' || next.source === 'joined' ? 'joined' : existing.source
  };
}

function normalizeCatalogCourse(course, source) {
  return {
    id: course.id,
    title: course.title,
    subject: course.subject,
    grade: course.grade,
    teacher: course.teacher?.name || '任课老师',
    description: course.description || '',
    questionCount: normalizeArray(course.questions).filter((question) => question.status === 'active').length,
    source,
    joined: source !== 'available'
  };
}

async function requireStudent(prisma, studentId) {
  if (!studentId) throw createHttpError(400, 'BAD_REQUEST', '缺少学生 ID');
  const student = await prisma.student.findFirst({
    where: { id: studentId, status: 'active' },
    include: {
      class: {
        include: { teacher: true }
      }
    }
  });
  if (!student) throw createHttpError(404, 'NOT_FOUND', '学生不存在');
  return student;
}

export function createStudentLearningService(prisma) {
  return {
    async getDashboard(studentId) {
      const student = await requireStudent(prisma, studentId);
      const courses = await this.listCourses(studentId);
      return {
        student: normalizeStudentProfile(student),
        courses
      };
    },

    async listCourses(studentId) {
      const student = await requireStudent(prisma, studentId);
      const sessions = await prisma.classroomSession.findMany({
        where: {
          classId: student.classId,
          status: { not: STUDENT_ENROLLMENT_SESSION_STATUS },
          OR: [
            { targetStudentId: null },
            { targetStudentId: student.id }
          ]
        },
        include: {
          course: {
            include: {
              teacher: true,
              questions: {
                where: { status: 'active' },
                orderBy: { createdAt: 'asc' }
              }
            }
          },
          answers: {
            where: { studentId },
            orderBy: { submittedAt: 'desc' }
          },
          sessionQuestions: {
            include: { question: true },
            orderBy: { sortOrder: 'asc' }
          }
        },
        orderBy: [{ startedAt: 'desc' }, { id: 'asc' }]
      });
      const enrollments = await prisma.studentCourseEnrollment.findMany({
        where: { studentId, status: 'active' },
        include: {
          session: {
            include: {
              course: {
                include: {
                  teacher: true,
                  questions: {
                    where: { status: 'active' },
                    orderBy: { createdAt: 'asc' }
                  }
                }
              },
              answers: {
                where: { studentId },
                orderBy: { submittedAt: 'desc' }
              },
              sessionQuestions: {
                include: { question: true },
                orderBy: { sortOrder: 'asc' }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const courses = new Map();
      for (const session of sessions) {
        const existing = courses.get(session.courseId);
        courses.set(session.courseId, mergeCourseSummary(existing, session, student, 'class'));
      }
      for (const enrollment of enrollments) {
        if (!enrollment.session?.course || enrollment.session.course.status !== 'active') continue;
        const existing = courses.get(enrollment.courseId);
        courses.set(enrollment.courseId, mergeCourseSummary(existing, enrollment.session, student, 'joined'));
      }

      return [...courses.values()];
    },

    async listCourseCatalog(studentId) {
      const student = await requireStudent(prisma, studentId);
      const [classSessions, enrollments, courses] = await Promise.all([
        prisma.classroomSession.findMany({
          where: {
            classId: student.classId,
            status: { not: STUDENT_ENROLLMENT_SESSION_STATUS },
            OR: [
              { targetStudentId: null },
              { targetStudentId: student.id }
            ],
            course: { status: 'active', deletedAt: null }
          },
          select: { courseId: true }
        }),
        prisma.studentCourseEnrollment.findMany({
          where: { studentId, status: 'active' },
          select: { courseId: true }
        }),
        prisma.course.findMany({
          where: { status: 'active', deletedAt: null },
          include: {
            teacher: true,
            questions: {
              where: { status: 'active' },
              select: { id: true, status: true }
            }
          },
          orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }]
        })
      ]);

      const classCourseIds = new Set(classSessions.map((session) => session.courseId));
      const joinedCourseIds = new Set(enrollments.map((enrollment) => enrollment.courseId));

      return courses.map((course) => {
        const source = classCourseIds.has(course.id)
          ? 'class'
          : joinedCourseIds.has(course.id)
            ? 'joined'
            : 'available';
        return normalizeCatalogCourse(course, source);
      });
    },

    async joinCourse(studentId, payload = {}) {
      const student = await requireStudent(prisma, studentId);
      const courseQuery = String(payload.courseId || payload.courseCode || payload.keyword || '').trim();
      if (!courseQuery) throw createHttpError(400, 'BAD_REQUEST', '缺少课程 ID 或课程名称');

      const course = await prisma.course.findFirst({
        where: {
          status: 'active',
          deletedAt: null,
          OR: [
            { id: courseQuery },
            { title: courseQuery }
          ]
        },
        include: {
          teacher: true,
          questions: {
            where: { status: 'active' },
            orderBy: { createdAt: 'asc' }
          }
        }
      });
      if (!course) throw createHttpError(404, 'NOT_FOUND', '课程不存在或未发布');

      const existing = await prisma.studentCourseEnrollment.findUnique({
        where: {
          studentId_courseId: {
            studentId,
            courseId: course.id
          }
        },
        include: {
          session: {
            include: {
              course: {
                include: {
                  teacher: true,
                  questions: {
                    where: { status: 'active' },
                    orderBy: { createdAt: 'asc' }
                  }
                }
              },
              answers: {
                where: { studentId },
                orderBy: { submittedAt: 'desc' }
              },
              sessionQuestions: {
                include: { question: true },
                orderBy: { sortOrder: 'asc' }
              }
            }
          }
        }
      });

      if (existing?.status === 'active' && existing.session) {
        return {
          enrollment: {
            id: existing.id,
            studentId,
            courseId: course.id,
            sessionId: existing.sessionId,
            status: existing.status
          },
          course: createCourseSummary(existing.session, student, 'joined')
        };
      }

      const session = await prisma.classroomSession.create({
        data: {
          classId: student.classId,
          courseId: course.id,
          title: `${course.title} 自主练习`,
          status: STUDENT_ENROLLMENT_SESSION_STATUS,
          startedAt: new Date()
        },
        include: {
          course: {
            include: {
              teacher: true,
              questions: {
                where: { status: 'active' },
                orderBy: { createdAt: 'asc' }
              }
            }
          },
          answers: {
            where: { studentId },
            orderBy: { submittedAt: 'desc' }
          },
          sessionQuestions: {
            include: { question: true },
            orderBy: { sortOrder: 'asc' }
          }
        }
      });
      const enrollment = existing
        ? await prisma.studentCourseEnrollment.update({
            where: { id: existing.id },
            data: { status: 'active', sessionId: session.id }
          })
        : await prisma.studentCourseEnrollment.create({
            data: {
              studentId,
              courseId: course.id,
              sessionId: session.id
            }
          });

      return {
        enrollment: {
          id: enrollment.id,
          studentId,
          courseId: course.id,
          sessionId: session.id,
          status: enrollment.status
        },
        course: createCourseSummary(session, student, 'joined')
      };
    },

    async getCourse(studentId, courseId) {
      const student = await requireStudent(prisma, studentId);
      const sessions = await prisma.classroomSession.findMany({
        where: {
          classId: student.classId,
          courseId,
          status: { not: STUDENT_ENROLLMENT_SESSION_STATUS },
          OR: [
            { targetStudentId: null },
            { targetStudentId: student.id }
          ]
        },
        include: {
          course: {
            include: {
              questions: {
                where: { status: 'active' },
                orderBy: { createdAt: 'asc' }
              }
            }
          },
          answers: {
            where: { studentId },
            orderBy: { submittedAt: 'desc' }
          },
          sessionQuestions: {
            include: { question: true },
            orderBy: { sortOrder: 'asc' }
          }
        },
        orderBy: [{ startedAt: 'desc' }, { id: 'asc' }]
      });
      const enrollments = await prisma.studentCourseEnrollment.findMany({
        where: { studentId, courseId, status: 'active' },
        include: {
          session: {
            include: {
              course: {
                include: {
                  teacher: true,
                  questions: {
                    where: { status: 'active' },
                    orderBy: { createdAt: 'asc' }
                  }
                }
              },
              answers: {
                where: { studentId },
                orderBy: { submittedAt: 'desc' }
              },
              sessionQuestions: {
                include: { question: true },
                orderBy: { sortOrder: 'asc' }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      const allSessions = [
        ...sessions,
        ...enrollments.map((enrollment) => enrollment.session).filter(Boolean)
      ];
      if (!allSessions.length) throw createHttpError(404, 'NOT_FOUND', '学生课程不存在');

      const course = allSessions[0].course;
      return {
        id: course.id,
        title: course.title,
        subject: course.subject,
        grade: course.grade,
        teacher: normalizeTeacher(student, course),
        description: course.description || '',
        goal: course.goal || '',
        tasks: allSessions.map((session) => buildTask(session, studentId))
      };
    },

    async getTask(studentId, taskId) {
      const student = await requireStudent(prisma, studentId);
      const session = await prisma.classroomSession.findFirst({
        where: {
          id: taskId,
          OR: [
            {
              classId: student.classId,
              status: { not: STUDENT_ENROLLMENT_SESSION_STATUS },
              targetStudentId: null
            },
            {
              studentEnrollments: {
                some: { studentId, status: 'active' }
              }
            },
            { targetStudentId: studentId }
          ]
        },
        include: {
          course: {
            include: {
              teacher: true,
              questions: {
                where: { status: 'active' },
                orderBy: { createdAt: 'asc' }
              }
            }
          },
          answers: {
            where: { studentId },
            orderBy: { submittedAt: 'desc' }
          },
          sessionQuestions: {
            include: { question: true },
            orderBy: { sortOrder: 'asc' }
          }
        }
      });
      if (!session) throw createHttpError(404, 'NOT_FOUND', '学生任务不存在');

      const answersByQuestion = new Map(session.answers.map((answer) => [answer.questionId, answer]));
      const questions = getSessionQuestions(session)
        .filter(isSupportedQuestion)
        .map((question) => normalizeQuestion(question, answersByQuestion.get(question.id)));

      return {
        ...buildTask(session, studentId),
        course: {
          id: session.course.id,
          title: session.course.title,
          subject: session.course.subject,
          grade: session.course.grade,
          description: session.course.description || ''
        },
        questions
      };
    },

    async saveAnswer(studentId, taskId, payload = {}) {
      const student = await requireStudent(prisma, studentId);
      if (!payload.questionId) throw createHttpError(400, 'BAD_REQUEST', '缺少题目 ID');

      const session = await prisma.classroomSession.findFirst({
        where: {
          id: taskId,
          OR: [
            {
              classId: student.classId,
              status: { not: STUDENT_ENROLLMENT_SESSION_STATUS },
              targetStudentId: null
            },
            {
              studentEnrollments: {
                some: { studentId, status: 'active' }
              }
            },
            { targetStudentId: studentId }
          ]
        },
        include: {
          course: {
            include: {
              teacher: true,
              questions: {
                where: { status: 'active' },
                orderBy: { createdAt: 'asc' }
              }
            }
          },
          answers: {
            where: { studentId },
            orderBy: { submittedAt: 'desc' }
          },
          sessionQuestions: {
            include: { question: true },
            orderBy: { sortOrder: 'asc' }
          }
        }
      });
      if (!session) throw createHttpError(404, 'NOT_FOUND', '学生任务不存在');

      const question = getSessionQuestions(session).find((item) => item.id === payload.questionId);
      if (!question || !isSupportedQuestion(question)) throw createHttpError(404, 'NOT_FOUND', 'question does not belong to this task');

      const answerPayload = normalizeAnswer(payload.answer);
      const existing = await prisma.studentAnswer.findFirst({
        where: { sessionId: taskId, studentId, questionId: question.id }
      });
      const data = {
        sessionId: taskId,
        studentId,
        questionId: question.id,
        answer: answerPayload,
        isCorrect: isAnswerCorrect(question, answerPayload),
        score: isAnswerCorrect(question, answerPayload) ? 1 : 0,
        durationSeconds: Number.isFinite(Number(payload.durationSeconds)) ? Number(payload.durationSeconds) : null
      };
      const saved = existing
        ? await prisma.studentAnswer.update({ where: { id: existing.id }, data })
        : await prisma.studentAnswer.create({ data });

      const latestTask = await this.getTask(studentId, taskId);
      return {
        questionId: question.id,
        answer: saved.answer,
        answeredCount: latestTask.answeredCount,
        totalCount: latestTask.questionCount
      };
    },

    async submitTask(studentId, taskId) {
      const task = await this.getTask(studentId, taskId);
      const answers = await prisma.studentAnswer.findMany({
        where: { sessionId: taskId, studentId }
      });
      const correctCount = answers.filter((answer) => answer.isCorrect).length;
      return {
        id: task.id,
        status: task.answeredCount >= task.questionCount ? 'completed' : 'in_progress',
        score: correctCount,
        totalScore: task.questionCount,
        accuracy: task.questionCount ? Math.round((correctCount / task.questionCount) * 100) : 0,
        answeredCount: task.answeredCount,
        questionCount: task.questionCount
      };
    }
  };
}
