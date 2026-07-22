import { createHash } from 'node:crypto';

function httpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

const asArray = (value) => Array.isArray(value) ? value : [];
const round = (value) => Math.round(Number(value || 0));
const answerValue = (answer) => String(answer && typeof answer === 'object' && 'value' in answer ? answer.value ?? '' : answer ?? '').trim();

function scopeMeta(filters = {}, session = null) {
  if (filters.sessionId) return { type: 'session', key: `session:${filters.sessionId}`, classId: session?.classId || filters.classId || null, sessionId: filters.sessionId };
  if (filters.classId) return { type: 'class', key: `class:${filters.classId}`, classId: filters.classId, sessionId: null };
  return { type: 'course', key: 'course', classId: null, sessionId: null };
}

function publicReport(report, fingerprint) {
  if (!report) return null;
  return {
    id: report.id,
    scopeType: report.scopeType,
    classId: report.classId,
    sessionId: report.sessionId,
    summary: report.summary || {},
    weakPoints: asArray(report.weakPoints),
    teachingSuggestions: asArray(report.teachingSuggestions),
    practiceSuggestions: report.practiceSuggestions || {},
    rawText: report.rawText || '',
    provider: report.provider,
    model: report.model,
    generatedAt: report.generatedAt?.toISOString?.() || report.generatedAt,
    isStale: Boolean(fingerprint && report.sourceFingerprint !== fingerprint)
  };
}

function questionKnowledge(question) {
  return asArray(question.knowledge).map(String).filter(Boolean);
}

function buildQuestionStats(questions, answers) {
  return questions.map((question) => {
    const rows = answers.filter((item) => item.questionId === question.id);
    const correctCount = rows.filter((item) => item.isCorrect).length;
    const durations = rows.map((item) => item.durationSeconds).filter((value) => Number.isFinite(Number(value)));
    return {
      id: question.id,
      title: question.title,
      type: question.type,
      stage: question.stage || '',
      difficulty: question.difficulty || '',
      knowledge: questionKnowledge(question),
      weakPoint: question.weakPoint || '',
      analysis: question.analysis || '',
      participantCount: new Set(rows.map((item) => item.studentId)).size,
      answerCount: rows.length,
      correctCount,
      wrongCount: rows.length - correctCount,
      accuracy: rows.length ? round(correctCount / rows.length * 100) : 0,
      averageTimeSeconds: durations.length ? round(durations.reduce((sum, value) => sum + Number(value), 0) / durations.length) : 0
    };
  }).sort((a, b) => {
    if (!a.answerCount && b.answerCount) return 1;
    if (a.answerCount && !b.answerCount) return -1;
    return a.accuracy - b.accuracy || b.answerCount - a.answerCount;
  });
}

function fingerprintFor(questionStats, answers) {
  const latestAnswer = answers.reduce((latest, item) => Math.max(latest, new Date(item.submittedAt || 0).getTime()), 0);
  const latestQuestion = questionStats.reduce((latest, item) => Math.max(latest, new Date(item.updatedAt || 0).getTime()), 0);
  return createHash('sha256').update(JSON.stringify({ answerCount: answers.length, latestAnswer, questionCount: questionStats.length, latestQuestion })).digest('hex');
}

export function createCourseAnalysisService(prisma) {
  if (!prisma) throw new Error('prisma is required');

  async function loadScope(courseId, filters = {}) {
    const course = await prisma.course.findFirst({
      where: { id: courseId, status: 'active', deletedAt: null },
      include: {
        questions: { where: { status: 'active', deletedAt: null }, orderBy: { createdAt: 'asc' } },
        sessions: {
          where: { status: { not: 'ai_personal_practice' } },
          include: {
            class: true,
            sessionQuestions: { include: { question: true }, orderBy: { sortOrder: 'asc' } },
            answers: { include: { student: true, question: true }, orderBy: { submittedAt: 'desc' } }
          },
          orderBy: { startedAt: 'desc' }
        }
      }
    });
    if (!course) throw httpError(404, 'NOT_FOUND', '课程不存在');

    const allSessions = asArray(course.sessions).filter((item) => item.status !== 'ai_personal_practice');
    const selectedSession = filters.sessionId ? allSessions.find((item) => item.id === filters.sessionId) : null;
    if (filters.sessionId && !selectedSession) throw httpError(404, 'NOT_FOUND', '课堂场次不存在或不属于当前课程');
    if (filters.classId && selectedSession && selectedSession.classId !== filters.classId) throw httpError(400, 'INVALID_SCOPE', '课堂场次与班级不匹配');

    const sessions = allSessions.filter((item) => (!filters.classId || item.classId === filters.classId) && (!filters.sessionId || item.id === filters.sessionId));
    if (filters.classId && !allSessions.some((item) => item.classId === filters.classId)) throw httpError(404, 'NOT_FOUND', '班级没有当前课程的课堂数据');

    const questionMap = new Map(filters.sessionId ? [] : asArray(course.questions).map((item) => [item.id, item]));
    for (const session of sessions) {
      for (const link of asArray(session.sessionQuestions)) {
        if (link.question?.status !== 'active' || link.question?.deletedAt) continue;
        questionMap.set(link.question.id, link.question);
      }
    }
    const questions = [...questionMap.values()].filter((item) => item.status === 'active' && !item.deletedAt);
    const validQuestionIds = new Set(questions.map((item) => item.id));
    const answers = sessions.flatMap((session) => asArray(session.answers).map((item) => ({ ...item, sessionTitle: session.title, classId: session.classId, className: session.class?.name || '' }))).filter((item) => validQuestionIds.has(item.questionId));
    return { course, allSessions, sessions, questions, answers, scope: scopeMeta(filters, selectedSession) };
  }

  async function currentSnapshot(courseId, filters = {}) {
    const loaded = await loadScope(courseId, filters);
    const questionStats = buildQuestionStats(loaded.questions, loaded.answers).map((item) => ({ ...item, updatedAt: loaded.questions.find((question) => question.id === item.id)?.updatedAt }));
    const fingerprint = fingerprintFor(questionStats, loaded.answers);
    return { ...loaded, questionStats, fingerprint };
  }

  return {
    async getCourseAnalysis(courseId, filters = {}) {
      const data = await currentSnapshot(courseId, filters);
      const durations = data.answers.map((item) => item.durationSeconds).filter((value) => Number.isFinite(Number(value)));
      const correctCount = data.answers.filter((item) => item.isCorrect).length;
      const report = prisma.courseAnalysisReport ? await prisma.courseAnalysisReport.findUnique({ where: { courseId_scopeKey: { courseId, scopeKey: data.scope.key } } }) : null;
      const classes = [...new Map(data.allSessions.map((item) => [item.classId, { id: item.classId, name: item.class?.name || item.classId }])).values()];
      const filterSessions = data.allSessions.filter((item) => !filters.classId || item.classId === filters.classId).map((item) => ({ id: item.id, classId: item.classId, title: item.title, startedAt: item.startedAt }));
      return {
        course: { id: data.course.id, title: data.course.title, subject: data.course.subject, grade: data.course.grade, description: data.course.description || '' },
        filters: { selectedClassId: filters.classId || '', selectedSessionId: filters.sessionId || '', classes, sessions: filterSessions },
        scope: data.scope,
        summary: {
          participantCount: new Set(data.answers.map((item) => item.studentId)).size,
          answerCount: data.answers.length,
          accuracy: data.answers.length ? round(correctCount / data.answers.length * 100) : 0,
          averageTimeSeconds: durations.length ? round(durations.reduce((sum, value) => sum + Number(value), 0) / durations.length) : 0,
          weakQuestionCount: data.questionStats.filter((item) => item.answerCount && item.accuracy < 60).length
        },
        questionStats: data.questionStats.map(({ updatedAt, ...item }) => item),
        answerRecords: data.answers.slice().sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)).slice(0, 100).map((item) => ({
          id: item.id, studentId: item.studentId, studentName: item.student?.name || '', questionId: item.questionId,
          questionTitle: item.question?.title || '', answer: item.answer, isCorrect: item.isCorrect,
          durationSeconds: item.durationSeconds || 0, sessionId: item.sessionId, sessionTitle: item.sessionTitle,
          className: item.className, submittedAt: item.submittedAt?.toISOString?.() || item.submittedAt
        })),
        latestReport: publicReport(report, data.fingerprint),
        source: { fingerprint: data.fingerprint, answerCount: data.answers.length, questionCount: data.questions.length, updatedAt: new Date().toISOString() }
      };
    },

    async getQuestionDetail(courseId, questionId, filters = {}) {
      const data = await currentSnapshot(courseId, filters);
      const question = data.questions.find((item) => item.id === questionId);
      if (!question) throw httpError(404, 'NOT_FOUND', '题目不存在或不属于当前课程');
      const rows = data.answers.filter((item) => item.questionId === questionId).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
      const distribution = new Map();
      for (const row of rows) {
        const value = answerValue(row.answer) || '未作答';
        distribution.set(value, (distribution.get(value) || 0) + 1);
      }
      const latest = new Map();
      for (const row of rows) {
        const key = `${row.sessionId}:${row.studentId}`;
        if (!latest.has(key)) latest.set(key, row);
      }
      const submissions = [...latest.values()].map((row) => ({ id: row.id, studentId: row.studentId, studentName: row.student?.name || '', answer: row.answer, isCorrect: row.isCorrect, durationSeconds: row.durationSeconds || 0, sessionId: row.sessionId, sessionTitle: row.sessionTitle, submittedAt: row.submittedAt?.toISOString?.() || row.submittedAt }));
      const stat = data.questionStats.find((item) => item.id === questionId);
      return {
        question: { id: question.id, title: question.title, type: question.type, difficulty: question.difficulty, options: asArray(question.options), answer: question.answer, analysis: question.analysis || '', knowledge: questionKnowledge(question), weakPoint: question.weakPoint || '' },
        metrics: { participantCount: stat.participantCount, answerCount: stat.answerCount, correctCount: stat.correctCount, wrongCount: stat.wrongCount, accuracy: stat.accuracy, averageTimeSeconds: stat.averageTimeSeconds },
        answerDistribution: [...distribution.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([value, count]) => ({ value, count, percent: rows.length ? round(count / rows.length * 100) : 0 })),
        wrongStudents: submissions.filter((item) => !item.isCorrect),
        submissions
      };
    },

    async saveReport(courseId, filters = {}, payload = {}) {
      const data = await currentSnapshot(courseId, filters);
      const source = payload.source?.fingerprint === data.fingerprint ? payload.source : { fingerprint: data.fingerprint, answerCount: data.answers.length, questionCount: data.questions.length };
      const values = {
        scopeType: data.scope.type, scopeKey: data.scope.key, classId: data.scope.classId, sessionId: data.scope.sessionId,
        sourceFingerprint: source.fingerprint, sourceAnswerCount: source.answerCount ?? data.answers.length, sourceQuestionCount: source.questionCount ?? data.questions.length,
        summary: payload.summary || {}, weakPoints: asArray(payload.weakPoints), teachingSuggestions: asArray(payload.teachingSuggestions), practiceSuggestions: payload.practiceSuggestions || {},
        rawText: payload.rawText || '', provider: payload.provider || 'deepseek', model: payload.model || 'deepseek-chat', generatedAt: new Date()
      };
      const saved = await prisma.courseAnalysisReport.upsert({ where: { courseId_scopeKey: { courseId, scopeKey: data.scope.key } }, create: { courseId, ...values }, update: values });
      return publicReport(saved, data.fingerprint);
    },

    async getReportContext(reportId) {
      const report = await prisma.courseAnalysisReport.findFirst({ where: { id: reportId }, include: { course: true } });
      if (!report) throw httpError(404, 'NOT_FOUND', '学情分析报告不存在');
      return { id: report.id, course: { id: report.course.id, title: report.course.title, subject: report.course.subject, grade: report.course.grade }, scope: { type: report.scopeType, classId: report.classId, sessionId: report.sessionId }, summary: report.summary || {}, weakPoints: asArray(report.weakPoints), teachingSuggestions: asArray(report.teachingSuggestions), practiceSuggestions: report.practiceSuggestions || {}, generatedAt: report.generatedAt?.toISOString?.() || report.generatedAt };
    }
  };
}
