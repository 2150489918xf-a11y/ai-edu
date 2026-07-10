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

function toIso(value) {
  return value?.toISOString?.() || value || null;
}

function normalizeAnswer(value) {
  if (value && typeof value === 'object' && 'value' in value) return String(value.value ?? '');
  return String(value ?? '');
}

function normalizeQuestionType(question) {
  const type = String(question.type || '').toLowerCase();
  const options = normalizeArray(question.options);
  if (options.length || type.includes('choice') || question.type === '单选题' || question.type === '选择题') return 'choice';
  return 'blank';
}

function getQuestionKnowledge(question) {
  const direct = normalizeArray(question.knowledge);
  const linked = normalizeArray(question.knowledgePoints).map((item) => item.knowledgePoint?.name).filter(Boolean);
  const knowledge = [...direct, ...linked].map(String).filter(Boolean);
  return knowledge.length ? [...new Set(knowledge)] : ['未标注知识点'];
}

function getAccuracy(correct, total) {
  return total ? Math.round((correct / total) * 100) : 0;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value || 0)));
}

function buildChartConfig({ summary, knowledgeStats, wrongQuestions }) {
  const answeredKnowledgeCount = knowledgeStats.filter((item) => Number(item.answered || 0) > 0).length;
  const knowledgeCoverage = knowledgeStats.length ? Math.round((answeredKnowledgeCount / knowledgeStats.length) * 100) : 0;
  const avgDuration = Number(summary.avgDurationSeconds || 0);
  const paceScore = avgDuration ? clampPercent(Math.round(100 - Math.max(0, avgDuration - 45) * 0.8)) : 0;
  const correct = Number(summary.correctCount || 0);
  const wrong = Number(summary.wrongCount || 0);
  const unanswered = Math.max(Number(summary.totalQuestions || 0) - Number(summary.answeredCount || 0), 0);

  return {
    abilityRadar: [
      { name: '完成度', value: clampPercent(summary.completionRate) },
      { name: '准确率', value: clampPercent(summary.accuracy) },
      { name: '知识覆盖', value: clampPercent(knowledgeCoverage) },
      { name: '答题节奏', value: paceScore },
      { name: '错题控制', value: clampPercent(summary.answeredCount ? getAccuracy(correct, summary.answeredCount) : 0) },
      { name: '画像完整', value: summary.answeredCount ? 46 : 0 }
    ],
    knowledgeMastery: knowledgeStats
      .slice(0, 8)
      .map((item) => ({
        name: item.name,
        accuracy: clampPercent(item.accuracy),
        correct: Number(item.correct || 0),
        answered: Number(item.answered || 0),
        wrong: Number(item.wrong || 0)
      })),
    answerDistribution: [
      { name: '正确', value: correct },
      { name: '错题', value: wrong },
      { name: '未答', value: unanswered }
    ],
    weakReasons: wrongQuestions.slice(0, 4).map((item) => `${item.knowledge.join('、')}：${item.analysis || '需要复盘解题过程'}`)
  };
}

function normalizeChartConfig(value, fallback) {
  const source = value && typeof value === 'object' ? value : {};
  const fallbackValue = fallback || {};
  const abilityRadar = normalizeArray(source.abilityRadar).map((item) => ({
    name: String(item.name || item.label || '').trim(),
    value: clampPercent(item.value ?? item.score)
  })).filter((item) => item.name);
  const knowledgeMastery = normalizeArray(source.knowledgeMastery).map((item) => ({
    name: String(item.name || item.knowledge || '').trim(),
    accuracy: clampPercent(item.accuracy ?? item.value),
    correct: Number(item.correct || 0),
    answered: Number(item.answered || 0),
    wrong: Number(item.wrong || 0)
  })).filter((item) => item.name);
  const answerDistribution = normalizeArray(source.answerDistribution).map((item) => ({
    name: String(item.name || item.label || '').trim(),
    value: Math.max(0, Number(item.value || 0))
  })).filter((item) => item.name);
  const weakReasons = normalizeArray(source.weakReasons).map((item) => String(item || '').trim()).filter(Boolean);

  return {
    abilityRadar: abilityRadar.length ? abilityRadar.slice(0, 8) : normalizeArray(fallbackValue.abilityRadar),
    knowledgeMastery: knowledgeMastery.length ? knowledgeMastery.slice(0, 8) : normalizeArray(fallbackValue.knowledgeMastery),
    answerDistribution: answerDistribution.length ? answerDistribution.slice(0, 5) : normalizeArray(fallbackValue.answerDistribution),
    weakReasons: weakReasons.length ? weakReasons.slice(0, 6) : normalizeArray(fallbackValue.weakReasons)
  };
}

function normalizeProfile(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    studentId: profile.studentId,
    courseId: profile.courseId,
    mastery: profile.mastery,
    weakPoints: profile.weakPoints,
    mistakeReasons: profile.mistakeReasons,
    recommendedPractice: profile.recommendedPractice,
    aiConversationSummary: profile.aiConversationSummary || '',
    updatedAt: toIso(profile.updatedAt)
  };
}

function updateKnowledgeStats(stats, question, answer) {
  for (const name of getQuestionKnowledge(question)) {
    const current = stats.get(name) || {
      name,
      total: 0,
      answered: 0,
      correct: 0,
      wrong: 0,
      accuracy: 0
    };
    current.total += 1;
    if (answer) {
      current.answered += 1;
      if (answer.isCorrect) current.correct += 1;
      else current.wrong += 1;
    }
    current.accuracy = getAccuracy(current.correct, current.answered);
    stats.set(name, current);
  }
}

function buildLocalProfile({ course, summary, knowledgeStats, wrongQuestions }) {
  const weakPoints = knowledgeStats
    .filter((item) => item.answered > 0)
    .sort((a, b) => a.accuracy - b.accuracy || b.wrong - a.wrong)
    .slice(0, 5);
  const strongPoints = knowledgeStats
    .filter((item) => item.answered > 0 && item.accuracy >= 80)
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 5);
  const recommendedKnowledge = weakPoints.length
    ? weakPoints.map((item) => item.name)
    : knowledgeStats.slice(0, 3).map((item) => item.name);
  const difficulty = summary.accuracy >= 80 ? '中等到提高' : summary.accuracy >= 55 ? '基础到中等' : '基础巩固';

  return {
    summary: summary.answeredCount
      ? `该学生在《${course.title}》已完成 ${summary.answeredCount} 道题，正确率 ${summary.accuracy}%。建议围绕薄弱知识点继续做针对性练习。`
      : `该学生在《${course.title}》还没有足够答题记录，建议先完成基础练习后再生成画像。`,
    mastery: strongPoints.map((item) => ({
      knowledge: item.name,
      level: 'good',
      accuracy: item.accuracy,
      reason: `相关题目正确率 ${item.accuracy}%`
    })),
    weakPoints: weakPoints.map((item) => ({
      knowledge: item.name,
      level: item.accuracy < 50 ? 'weak' : 'unstable',
      accuracy: item.accuracy,
      reason: `已答 ${item.answered} 题，错 ${item.wrong} 题`
    })),
    mistakeReasons: wrongQuestions.slice(0, 4).map((item) => `${item.knowledge.join('、')}：${item.analysis || '需要复盘解题过程'}`),
    recommendedPractice: {
      difficulty,
      questionTypes: ['choice', 'blank'],
      knowledge: recommendedKnowledge,
      chartConfig: buildChartConfig({ summary, knowledgeStats, wrongQuestions }),
      source: 'local-statistics'
    }
  };
}

function extractJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function buildAiPrompt(payload) {
  return [
    '你是高中学习数据分析助手。请根据学生答题统计生成学生画像。',
    '只返回 JSON，不要返回 Markdown。',
    'JSON 字段必须包含 summary、mastery、weakPoints、mistakeReasons、recommendedPractice。',
    'mastery 和 weakPoints 是数组，每项包含 knowledge、level、reason。',
    'recommendedPractice 包含 difficulty、questionTypes、knowledge。',
    '',
    JSON.stringify(payload, null, 2)
  ].join('\n');
}

function buildAiPromptWithChartConfig(payload) {
  return [
    '你是高中学习数据分析助手。请根据学生答题统计生成学生画像。',
    '只返回 JSON，不要返回 Markdown，不要输出解释文字。',
    'JSON 字段必须包含 summary、mastery、weakPoints、mistakeReasons、recommendedPractice。',
    'mastery 和 weakPoints 是数组，每项包含 knowledge、level、reason，可额外包含 accuracy。',
    'recommendedPractice 必须包含 difficulty、questionTypes、knowledge、chartConfig。',
    'chartConfig 是前端 ECharts 展示参数数据，不是完整 ECharts option。',
    'chartConfig.abilityRadar: 数组，每项 { name, value }，value 为 0-100。',
    'chartConfig.knowledgeMastery: 数组，每项 { name, accuracy, correct, answered, wrong }。',
    'chartConfig.answerDistribution: 数组，每项 { name, value }。',
    'chartConfig.weakReasons: 字符串数组，最多 6 条。',
    '',
    JSON.stringify(payload, null, 2)
  ].join('\n');
}

async function requestDeepSeekAnalysis({ env, fetchImpl, payload }) {
  if (!env.DEEPSEEK_API_KEY) {
    throw createHttpError(500, 'AI_CREDENTIALS_MISSING', 'Missing DEEPSEEK_API_KEY');
  }
  const model = env.DEEPSEEK_MODEL || env.AI_MODEL || 'deepseek-chat';
  const baseUrl = env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: '你是学生画像分析助手，输出必须是可解析 JSON。' },
        { role: 'user', content: buildAiPromptWithChartConfig(payload) }
      ],
      temperature: 0.2
    })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createHttpError(response.status, 'AI_PROVIDER_ERROR', body.error?.message || 'AI provider request failed');
  }
  const content = String(body.choices?.[0]?.message?.content || '');
  const parsed = extractJson(content);
  if (!parsed) throw createHttpError(502, 'AI_PARSE_FAILED', 'AI analysis response is not valid JSON');
  return {
    provider: 'deepseek',
    model,
    profile: parsed
  };
}

export function createStudentAnalysisService(prisma, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  async function requireStudent(studentId) {
    if (!studentId) throw createHttpError(400, 'BAD_REQUEST', '缺少学生 ID');
    const student = await prisma.student.findFirst({
      where: { id: studentId, status: 'active' },
      include: { class: true }
    });
    if (!student) throw createHttpError(404, 'NOT_FOUND', '学生不存在');
    return student;
  }

  async function getCourseSessions(student, courseId) {
    const [classSessions, enrollments] = await Promise.all([
      prisma.classroomSession.findMany({
        where: {
          classId: student.classId,
          courseId,
          status: { not: 'student_enrollment' }
        },
        include: {
          course: { include: { teacher: true } },
          answers: {
            where: { studentId: student.id },
            include: {
              question: {
                include: {
                  knowledgePoints: { include: { knowledgePoint: true } }
                }
              }
            },
            orderBy: { submittedAt: 'desc' }
          }
        },
        orderBy: [{ startedAt: 'desc' }, { id: 'asc' }]
      }),
      prisma.studentCourseEnrollment.findMany({
        where: { studentId: student.id, courseId, status: 'active' },
        include: {
          session: {
            include: {
              course: { include: { teacher: true } },
              answers: {
                where: { studentId: student.id },
                include: {
                  question: {
                    include: {
                      knowledgePoints: { include: { knowledgePoint: true } }
                    }
                  }
                },
                orderBy: { submittedAt: 'desc' }
              }
            }
          }
        }
      })
    ]);
    return [
      ...classSessions,
      ...enrollments.map((item) => item.session).filter(Boolean)
    ];
  }

  async function buildCourseAnalysis(studentId, courseId) {
    const student = await requireStudent(studentId);
    const sessions = await getCourseSessions(student, courseId);
    if (!sessions.length) throw createHttpError(404, 'NOT_FOUND', '学生课程不存在');

    const course = sessions[0].course;
    const questions = await prisma.question.findMany({
      where: { courseId, status: 'active' },
      include: {
        knowledgePoints: { include: { knowledgePoint: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
    const answers = sessions.flatMap((session) => session.answers.map((answer) => ({
      ...answer,
      sessionTitle: session.title
    })));
    const latestAnswersByQuestion = new Map();
    for (const answer of answers) {
      const current = latestAnswersByQuestion.get(answer.questionId);
      if (!current || new Date(answer.submittedAt) > new Date(current.submittedAt)) {
        latestAnswersByQuestion.set(answer.questionId, answer);
      }
    }

    const knowledgeStatsMap = new Map();
    const wrongQuestions = [];
    let durationTotal = 0;
    let durationCount = 0;

    for (const question of questions) {
      const answer = latestAnswersByQuestion.get(question.id);
      updateKnowledgeStats(knowledgeStatsMap, question, answer);
      if (answer?.durationSeconds) {
        durationTotal += Number(answer.durationSeconds);
        durationCount += 1;
      }
      if (answer && !answer.isCorrect) {
        wrongQuestions.push({
          id: question.id,
          title: question.title,
          type: normalizeQuestionType(question),
          difficulty: question.difficulty || '',
          knowledge: getQuestionKnowledge(question),
          studentAnswer: normalizeAnswer(answer.answer),
          correctAnswer: normalizeAnswer(question.answer),
          analysis: question.analysis || '',
          submittedAt: toIso(answer.submittedAt)
        });
      }
    }

    const answeredCount = latestAnswersByQuestion.size;
    const correctCount = [...latestAnswersByQuestion.values()].filter((answer) => answer.isCorrect).length;
    const summary = {
      totalQuestions: questions.length,
      answeredCount,
      correctCount,
      wrongCount: Math.max(answeredCount - correctCount, 0),
      accuracy: getAccuracy(correctCount, answeredCount),
      completionRate: getAccuracy(answeredCount, questions.length),
      avgDurationSeconds: durationCount ? Math.round(durationTotal / durationCount) : 0,
      latestAnsweredAt: answers.length
        ? toIso(answers.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0].submittedAt)
        : null
    };
    const knowledgeStats = [...knowledgeStatsMap.values()]
      .map((item) => ({ ...item, accuracy: getAccuracy(item.correct, item.answered) }))
      .sort((a, b) => a.accuracy - b.accuracy || b.wrong - a.wrong);
    const profile = await prisma.learningProfile.findUnique({
      where: { studentId_courseId: { studentId: student.id, courseId } }
    });

    return {
      student: {
        id: student.id,
        name: student.name,
        studentNo: student.studentNo || '',
        className: student.class?.name || ''
      },
      course: {
        id: course.id,
        title: course.title,
        subject: course.subject,
        grade: course.grade,
        teacher: course.teacher?.name || ''
      },
      summary,
      knowledgeStats,
      wrongQuestions,
      profile: normalizeProfile(profile)
    };
  }

  return {
    async getOverview(studentId) {
      const student = await requireStudent(studentId);
      const courses = await prisma.course.findMany({
        where: {
          status: 'active',
          deletedAt: null,
          OR: [
            {
              sessions: {
                some: {
                  classId: student.classId,
                  status: { not: 'student_enrollment' }
                }
              }
            },
            {
              studentEnrollments: {
                some: { studentId: student.id, status: 'active' }
              }
            }
          ]
        },
        include: {
          teacher: true,
          learningProfiles: {
            where: { studentId: student.id }
          }
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }]
      });

      const courseAnalyses = await Promise.all(courses.map((course) => buildCourseAnalysis(student.id, course.id)));
      const answeredCount = courseAnalyses.reduce((sum, item) => sum + item.summary.answeredCount, 0);
      const correctCount = courseAnalyses.reduce((sum, item) => sum + item.summary.correctCount, 0);
      const weakPoints = courseAnalyses
        .flatMap((item) => item.knowledgeStats.filter((stat) => stat.answered > 0).map((stat) => ({
          courseId: item.course.id,
          courseTitle: item.course.title,
          name: stat.name,
          accuracy: stat.accuracy,
          wrong: stat.wrong
        })))
        .sort((a, b) => a.accuracy - b.accuracy || b.wrong - a.wrong)
        .slice(0, 5);

      return {
        student: {
          id: student.id,
          name: student.name,
          studentNo: student.studentNo || '',
          className: student.class?.name || '',
          grade: student.class?.grade || '',
          subject: student.class?.subject || ''
        },
        summary: {
          courseCount: courseAnalyses.length,
          answeredCount,
          correctCount,
          accuracy: getAccuracy(correctCount, answeredCount),
          weakPoints
        },
        courses: courseAnalyses.map((item) => ({
          course: item.course,
          summary: item.summary,
          weakPoints: item.knowledgeStats.filter((stat) => stat.answered > 0).slice(0, 3),
          profile: item.profile
        }))
      };
    },

    async getCourseAnalysis(studentId, courseId) {
      return buildCourseAnalysis(studentId, courseId);
    },

    async generateCourseProfile(studentId, courseId) {
      const analysis = await buildCourseAnalysis(studentId, courseId);
      const localProfile = buildLocalProfile(analysis);
      const localChartConfig = localProfile.recommendedPractice.chartConfig;
      let aiMeta = { provider: 'local', model: 'statistics' };
      let profilePayload = localProfile;

      if (fetchImpl && env.DEEPSEEK_API_KEY) {
        const aiResult = await requestDeepSeekAnalysis({ env, fetchImpl, payload: analysis });
        aiMeta = { provider: aiResult.provider, model: aiResult.model };
        profilePayload = {
          ...localProfile,
          ...aiResult.profile,
          recommendedPractice: {
            ...localProfile.recommendedPractice,
            ...(aiResult.profile.recommendedPractice || {}),
            chartConfig: normalizeChartConfig(aiResult.profile.recommendedPractice?.chartConfig, localChartConfig)
          }
        };
      }

      profilePayload = {
        ...profilePayload,
        recommendedPractice: {
          ...(profilePayload.recommendedPractice || {}),
          chartConfig: normalizeChartConfig(profilePayload.recommendedPractice?.chartConfig, localChartConfig)
        }
      };

      const saved = await prisma.learningProfile.upsert({
        where: { studentId_courseId: { studentId, courseId } },
        create: {
          studentId,
          courseId,
          mastery: profilePayload.mastery || [],
          weakPoints: profilePayload.weakPoints || [],
          mistakeReasons: profilePayload.mistakeReasons || [],
          recommendedPractice: {
            ...(profilePayload.recommendedPractice || {}),
            aiMeta
          },
          aiConversationSummary: profilePayload.summary || ''
        },
        update: {
          mastery: profilePayload.mastery || [],
          weakPoints: profilePayload.weakPoints || [],
          mistakeReasons: profilePayload.mistakeReasons || [],
          recommendedPractice: {
            ...(profilePayload.recommendedPractice || {}),
            aiMeta
          },
          aiConversationSummary: profilePayload.summary || ''
        }
      });

      return {
        ...analysis,
        profile: normalizeProfile(saved)
      };
    }
  };
}
