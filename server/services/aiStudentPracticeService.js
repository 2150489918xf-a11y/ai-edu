import {
  createStreamingQuestionParser,
  parseQuestionsFromAiText
} from '../../src/data/aiQuestionParser.js';

const PERSONAL_PRACTICE_STATUS = 'ai_personal_practice';

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

function normalizeOptions(value) {
  return normalizeArray(value)
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function normalizeAnswer(value) {
  if (value && typeof value === 'object' && 'value' in value) {
    return { value: String(value.value ?? '').trim() };
  }
  return { value: String(value ?? '').trim() };
}

function normalizeQuestionForSave(question = {}) {
  const options = normalizeOptions(question.options);
  return {
    id: String(question.id || '').trim(),
    type: String(question.type || (options.length ? 'choice' : 'blank')).trim(),
    stage: 'personalized-practice',
    difficulty: String(question.difficulty || 'auto').trim(),
    title: String(question.title || '').trim(),
    options,
    answer: normalizeAnswer(question.answer),
    analysis: String(question.analysis || '').trim(),
    knowledge: normalizeArray(question.knowledge).map((item) => String(item).trim()).filter(Boolean),
    targetReason: String(question.targetReason || '').trim(),
    remediationTip: String(question.remediationTip || '').trim()
  };
}

function publicQuestion(question = {}) {
  const normalized = normalizeQuestionForSave(question);
  return {
    id: normalized.id || undefined,
    type: normalized.type,
    stage: normalized.stage,
    difficulty: normalized.difficulty,
    title: normalized.title,
    options: normalized.options,
    knowledge: normalized.knowledge,
    targetReason: normalized.targetReason,
    remediationTip: normalized.remediationTip
  };
}

function normalizeOperation(raw = {}) {
  const action = String(raw.action || raw.type || 'append').trim().toLowerCase();
  const normalizedAction = ['append', 'replace', 'update', 'delete'].includes(action) ? action : 'append';
  const targetIndexes = normalizeArray(raw.targetIndexes || raw.indexes || raw.targets)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
  const questions = normalizeArray(raw.questions || raw.question)
    .map(normalizeQuestionForSave)
    .filter((question) => question.title || question.id);
  return {
    action: normalizedAction,
    targetIndexes,
    questions
  };
}

function publicOperation(operation = {}) {
  return {
    action: operation.action,
    targetIndexes: operation.targetIndexes || [],
    questions: normalizeArray(operation.questions).map(publicQuestion)
  };
}

function parsePracticeOperationsFromAiText(text = '') {
  const content = String(text || '');
  const operations = [];
  const pattern = /:::practice-op-start\s*([\s\S]*?)\s*:::practice-op-end/g;
  let match = pattern.exec(content);
  while (match) {
    try {
      operations.push(normalizeOperation(JSON.parse(match[1].trim())));
    } catch {
      // Ignore malformed operation blocks.
    }
    match = pattern.exec(content);
  }
  return operations;
}

function createStreamingOperationParser(initialBuffer = '') {
  let buffer = String(initialBuffer || '');
  return {
    push(chunk = '') {
      buffer += String(chunk || '');
      const operations = [];
      const pattern = /:::practice-op-start\s*([\s\S]*?)\s*:::practice-op-end/g;
      let lastEnd = 0;
      let match = pattern.exec(buffer);
      while (match) {
        try {
          operations.push(normalizeOperation(JSON.parse(match[1].trim())));
        } catch {
          // Ignore malformed operation blocks.
        }
        lastEnd = pattern.lastIndex;
        match = pattern.exec(buffer);
      }
      if (lastEnd > 0) buffer = buffer.slice(lastEnd);
      return operations;
    }
  };
}

function applyOperation(questions = [], operation = {}) {
  const current = normalizeArray(questions);
  const op = normalizeOperation(operation);
  if (op.action === 'delete') {
    const targets = new Set(op.targetIndexes);
    return current.filter((_, index) => !targets.has(index + 1));
  }
  if (op.action === 'replace' && !op.targetIndexes.length) {
    return op.questions;
  }
  if (op.action === 'append') {
    return [...current, ...op.questions];
  }
  if (op.action === 'replace') {
    const next = [...current];
    const targets = op.targetIndexes.length ? op.targetIndexes : current.map((_, index) => index + 1);
    targets.forEach((target, index) => {
      const replacement = op.questions[index];
      if (!replacement) return;
      next[target - 1] = replacement;
    });
    return next.filter(Boolean);
  }
  if (op.action === 'update') {
    const next = [...current];
    op.targetIndexes.forEach((target, index) => {
      const patch = op.questions[index] || op.questions[0];
      if (!patch || !next[target - 1]) return;
      next[target - 1] = {
        ...next[target - 1],
        ...patch,
        id: patch.id || ''
      };
    });
    return next.filter(Boolean);
  }
  return current;
}

function questionKey(question = {}) {
  return [
    String(question.title || '').trim(),
    normalizeOptions(question.options).join('|')
  ].join('::');
}

async function readProviderStream(response, onPayload) {
  if (!response.body?.getReader) {
    throw createHttpError(502, 'AI_STREAM_UNAVAILABLE', 'AI provider did not return a readable stream');
  }
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split(/\n\n/);
    buffer = frames.pop() || '';
    for (const frame of frames) {
      const lines = frame.split(/\r?\n/).filter((line) => line.startsWith('data:'));
      for (const line of lines) {
        const data = line.slice(5).trim();
        if (!data) continue;
        if (data === '[DONE]') return;
        try {
          onPayload(JSON.parse(data));
        } catch {
          // Ignore malformed provider frames and continue streaming.
        }
      }
    }
  }
}

function buildSystemPrompt() {
  return [
    'You are an adaptive practice generator for high-school students.',
    'Use Simplified Chinese for natural-language text.',
    'Generate questions according to the student learning profile and selected course.',
    'The student request has the highest priority. If it says one question, generate exactly one question.',
    'Do not reveal answers or analysis in natural-language explanation before structured blocks.',
    'Operation protocol:',
    'Output practice operations wrapped exactly between :::practice-op-start and :::practice-op-end.',
    'Inside each block, output one valid JSON object only.',
    'Required operation fields: action, targetIndexes, questions.',
    'action must be append, replace, update, or delete.',
    'Use append when the student asks for more questions; replace when asking to regenerate all; update when modifying specific questions; delete when removing questions.',
    'Question fields: type, difficulty, title, options, answer, analysis, knowledge, targetReason, remediationTip.',
    'type should be choice when options are present, otherwise blank.',
    'answer should be the exact student-answer value used for automatic grading.'
  ].join('\n');
}

function buildUserPrompt({ student, course, profile, analysis, count, difficulty, questionTypes, prompt, messages, operation, existingQuestions }) {
  const recentMessages = normalizeArray(messages)
    .slice(-8)
    .map((message) => `${message.role || 'user'}: ${message.text || message.content || ''}`)
    .join('\n');
  return [
    `student: ${student.name || student.id}`,
    `course: ${course.title || course.id}`,
    `subject: ${course.subject || ''}`,
    `grade: ${course.grade || ''}`,
    `requested count: ${count || 5}`,
    `requested operation: ${operation || 'append'}`,
    `difficulty: ${difficulty || profile?.recommendedPractice?.difficulty || 'auto'}`,
    `question types: ${normalizeArray(questionTypes).join(', ') || normalizeArray(profile?.recommendedPractice?.questionTypes).join(', ') || 'choice, blank'}`,
    '',
    'student request:',
    String(prompt || '请根据我的学情生成一组针对练习题。').trim(),
    '',
    'recent dialogue:',
    recentMessages || 'none',
    '',
    'existing questions on page:',
    JSON.stringify(normalizeArray(existingQuestions).map((question, index) => ({
      index: index + 1,
      id: question.id || '',
      type: question.type || '',
      difficulty: question.difficulty || '',
      title: question.title || '',
      options: normalizeOptions(question.options),
      knowledge: normalizeArray(question.knowledge)
    })), null, 2),
    '',
    'student learning profile:',
    JSON.stringify(profile || {}, null, 2),
    '',
    'course learning analysis:',
    JSON.stringify({
      summary: analysis?.summary || {},
      knowledgeStats: analysis?.knowledgeStats || [],
      wrongQuestions: analysis?.wrongQuestions || []
    }, null, 2),
    '',
    'Return only brief progress text plus structured practice operation blocks. Avoid duplicate questions.'
  ].join('\n');
}

async function requireContext(prisma, { studentId, courseId }) {
  if (!studentId) throw createHttpError(400, 'BAD_REQUEST', 'Missing studentId');
  if (!courseId) throw createHttpError(400, 'BAD_REQUEST', 'Missing courseId');

  const [student, course, profile] = await Promise.all([
    prisma.student.findFirst({
      where: { id: studentId, status: 'active' },
      include: { class: true }
    }),
    prisma.course.findFirst({
      where: { id: courseId, status: 'active', deletedAt: null },
      include: { teacher: true }
    }),
    prisma.learningProfile.findUnique({
      where: { studentId_courseId: { studentId, courseId } }
    }).catch(() => null)
  ]);

  if (!student) throw createHttpError(404, 'NOT_FOUND', 'Student not found');
  if (!course) throw createHttpError(404, 'NOT_FOUND', 'Course not found');
  return { student, course, profile };
}

async function savePracticeTask(prisma, { student, course, questions, taskId = '' }) {
  const normalizedQuestions = normalizeArray(questions)
    .map(normalizeQuestionForSave)
    .filter((question) => question.id || (question.title && question.answer.value));
  if (!normalizedQuestions.length) {
    throw createHttpError(502, 'AI_PARSE_FAILED', 'AI did not return valid practice questions');
  }

  return prisma.$transaction(async (tx) => {
    const linkedQuestions = [];
    for (const question of normalizedQuestions) {
      if (question.id) {
        const existing = await tx.question.findFirst({
          where: { id: question.id, courseId: course.id, status: 'active' }
        });
        if (existing) linkedQuestions.push(existing);
        continue;
      }
      const analysisParts = [question.analysis];
      if (question.targetReason) analysisParts.push(`Target reason: ${question.targetReason}`);
      if (question.remediationTip) analysisParts.push(`Remediation tip: ${question.remediationTip}`);
      const created = await tx.question.create({
        data: {
          courseId: course.id,
          type: question.type,
          stage: question.stage,
          difficulty: question.difficulty,
          title: question.title,
          options: question.options,
          answer: question.answer,
          analysis: analysisParts.filter(Boolean).join('\n'),
          knowledge: question.knowledge
        }
      });
      linkedQuestions.push(created);
    }

    const existingSession = taskId
      ? await tx.classroomSession.findFirst({
          where: { id: taskId, courseId: course.id, targetStudentId: student.id }
        })
      : null;
    const session = existingSession || await tx.classroomSession.create({
        data: {
          classId: student.classId,
          courseId: course.id,
          targetStudentId: student.id,
          title: `${course.title} AI personalized practice`,
          status: PERSONAL_PRACTICE_STATUS,
          startedAt: new Date()
        }
      });

    if (tx.classroomSessionQuestion.deleteMany) {
      await tx.classroomSessionQuestion.deleteMany({
        where: { sessionId: session.id }
      });
    }
    await tx.classroomSessionQuestion.createMany({
      data: linkedQuestions.map((question, index) => ({
        sessionId: session.id,
        questionId: question.id,
        sortOrder: index
      }))
    });

    await tx.studentCourseEnrollment.upsert({
      where: { studentId_courseId: { studentId: student.id, courseId: course.id } },
      create: {
        studentId: student.id,
        courseId: course.id,
        sessionId: session.id,
        status: 'active'
      },
      update: {
        sessionId: session.id,
        status: 'active'
      }
    });

    return {
      taskId: session.id,
      courseId: course.id,
      title: session.title,
      questionCount: linkedQuestions.length,
      questions: linkedQuestions.map(publicQuestion)
    };
  });
}

export function createAiStudentPracticeService(prisma, { env = process.env, fetchImpl = globalThis.fetch, studentAnalysisService = null } = {}) {
  if (!prisma) throw new Error('prisma is required');
  if (!fetchImpl) throw new Error('fetch implementation is required');

  return {
    async streamGeneratePractice(request = {}, handlers = {}) {
      if (!env.DEEPSEEK_API_KEY) {
        throw createHttpError(500, 'AI_CREDENTIALS_MISSING', 'Missing DEEPSEEK_API_KEY');
      }

      const context = await requireContext(prisma, request);
      const analysis = studentAnalysisService
        ? await studentAnalysisService.getCourseAnalysis(request.studentId, request.courseId)
        : {};
      const model = env.DEEPSEEK_MODEL || env.AI_MODEL || 'deepseek-chat';
      const baseUrl = env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
      const parser = createStreamingQuestionParser();
      const operationParser = createStreamingOperationParser();
      const parsedQuestions = [];
      const parsedOperations = [];
      const seen = new Set();
      let finalQuestions = normalizeArray(request.existingQuestions).map(normalizeQuestionForSave);
      let rawReply = '';

      const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          stream: true,
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            {
              role: 'user',
              content: buildUserPrompt({
                ...request,
                student: context.student,
                course: context.course,
                profile: context.profile,
                analysis
              })
            }
          ],
          temperature: 0.25
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw createHttpError(response.status, 'AI_PROVIDER_ERROR', payload.error?.message || 'AI provider request failed');
      }

      await readProviderStream(response, (payload) => {
        const text = payload.choices?.[0]?.delta?.content || '';
        if (!text) return;
        rawReply += text;
        handlers.onDelta?.(text);
        for (const operation of operationParser.push(text)) {
          parsedOperations.push(operation);
          finalQuestions = applyOperation(finalQuestions, operation);
          handlers.onOperation?.(publicOperation(operation));
        }
        for (const question of parser.push(text)) {
          const key = questionKey(question);
          if (seen.has(key)) continue;
          seen.add(key);
          parsedQuestions.push(question);
          const operation = { action: 'append', targetIndexes: [], questions: [question] };
          finalQuestions = applyOperation(finalQuestions, operation);
          handlers.onOperation?.(publicOperation(operation));
          handlers.onQuestion?.(publicQuestion(question));
        }
      });

      if (!parsedOperations.length) {
        for (const operation of parsePracticeOperationsFromAiText(rawReply)) {
          parsedOperations.push(operation);
          finalQuestions = applyOperation(finalQuestions, operation);
          handlers.onOperation?.(publicOperation(operation));
        }
      }

      if (!parsedOperations.length && !parsedQuestions.length) {
        for (const question of parseQuestionsFromAiText(rawReply)) {
          const key = questionKey(question);
          if (seen.has(key)) continue;
          seen.add(key);
          parsedQuestions.push(question);
          const operation = { action: 'append', targetIndexes: [], questions: [question] };
          finalQuestions = applyOperation(finalQuestions, operation);
          handlers.onOperation?.(publicOperation(operation));
          handlers.onQuestion?.(publicQuestion(question));
        }
      }

      const task = await savePracticeTask(prisma, {
        student: context.student,
        course: context.course,
        questions: finalQuestions,
        taskId: request.taskId
      });
      handlers.onTask?.(task);
      handlers.onDone?.({ provider: 'deepseek', model, questionCount: task.questionCount });
      return task;
    }
  };
}
