function createHttpError(statusCode, code, message, details = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeQuestion(question) {
  return {
    id: question.id,
    bankId: question.bankId,
    courseId: question.courseId || null,
    type: question.type,
    stage: question.stage || '',
    difficulty: question.difficulty,
    title: question.title,
    options: normalizeArray(question.options),
    answer: question.answer?.value ?? question.answer,
    analysis: question.analysis || '',
    knowledge: normalizeArray(question.knowledge),
    accuracy: question.accuracy ?? null,
    avgTimeSeconds: question.avgTimeSeconds ?? null,
    weakPoint: question.weakPoint || null,
    optionDistribution: question.optionDistribution || null,
    status: question.status,
    deletedAt: question.deletedAt ? question.deletedAt.toISOString() : null,
    createdAt: question.createdAt?.toISOString?.() || question.createdAt,
    updatedAt: question.updatedAt?.toISOString?.() || question.updatedAt
  };
}

function normalizeBank(bank) {
  const questions = Array.isArray(bank.questions) ? bank.questions.map(normalizeQuestion) : undefined;
  const count = typeof bank._count?.questions === 'number'
    ? bank._count.questions
    : Array.isArray(questions)
      ? questions.filter((question) => question.status === 'active').length
      : Number(bank.count || 0);

  return {
    id: bank.id,
    title: bank.title,
    subject: bank.subject,
    grade: bank.grade || '',
    usage: bank.usage || '',
    description: bank.description || '',
    tags: normalizeArray(bank.tags),
    count,
    status: bank.status,
    deletedAt: bank.deletedAt ? bank.deletedAt.toISOString() : null,
    createdAt: bank.createdAt?.toISOString?.() || bank.createdAt,
    updatedAt: bank.updatedAt?.toISOString?.() || bank.updatedAt,
    ...(questions ? { questions } : {})
  };
}

function validateBankPayload(payload = {}) {
  const missing = ['title', 'subject'].filter((key) => !normalizeText(payload[key]));
  if (missing.length) {
    throw createHttpError(400, 'BAD_REQUEST', '题库缺少必要字段', { missing });
  }
}

function validateQuestionPayload(payload = {}) {
  const missing = ['title', 'type'].filter((key) => !normalizeText(payload[key]));
  if (missing.length) {
    throw createHttpError(400, 'BAD_REQUEST', '题目缺少必要字段', { missing });
  }
}

function buildBankWhere(filters = {}) {
  const where = {};
  const status = filters.status || 'active';
  if (status !== 'all') where.status = status;
  if (filters.keyword) {
    where.OR = [
      { title: { contains: filters.keyword, mode: 'insensitive' } },
      { subject: { contains: filters.keyword, mode: 'insensitive' } },
      { description: { contains: filters.keyword, mode: 'insensitive' } }
    ];
  }
  if (filters.subject) where.subject = filters.subject;
  if (filters.grade) where.grade = filters.grade;
  return where;
}

export function createQuestionBankService(prisma) {
  return {
    async listBanks(filters = {}) {
      const page = Math.max(Number(filters.page || 1), 1);
      const pageSize = Math.min(Math.max(Number(filters.pageSize || 20), 1), 100);
      const where = buildBankWhere(filters);

      const [banks, total] = await Promise.all([
        prisma.questionBank.findMany({
          where,
          orderBy: [{ updatedAt: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: { _count: { select: { questions: { where: { status: 'active' } } } } }
        }),
        prisma.questionBank.count({ where })
      ]);

      return { banks: banks.map(normalizeBank), total };
    },

    async createBank(payload = {}) {
      validateBankPayload(payload);
      const bank = await prisma.questionBank.create({
        data: {
          title: normalizeText(payload.title),
          subject: normalizeText(payload.subject),
          grade: normalizeText(payload.grade) || null,
          usage: normalizeText(payload.usage) || null,
          description: normalizeText(payload.description) || null,
          tags: normalizeArray(payload.tags)
        },
        include: { _count: { select: { questions: { where: { status: 'active' } } } } }
      });
      return normalizeBank(bank);
    },

    async getBank(bankId) {
      const bank = await prisma.questionBank.findUnique({
        where: { id: bankId },
        include: {
          questions: {
            where: { status: 'active' },
            orderBy: [{ updatedAt: 'desc' }]
          }
        }
      });
      if (!bank) throw createHttpError(404, 'NOT_FOUND', '题库不存在');
      return normalizeBank(bank);
    },

    async updateBank(bankId, payload = {}) {
      await this.getBank(bankId);
      const data = {};
      if ('title' in payload) data.title = normalizeText(payload.title);
      if ('subject' in payload) data.subject = normalizeText(payload.subject);
      if ('grade' in payload) data.grade = normalizeText(payload.grade) || null;
      if ('usage' in payload) data.usage = normalizeText(payload.usage) || null;
      if ('description' in payload) data.description = normalizeText(payload.description) || null;
      if ('tags' in payload) data.tags = normalizeArray(payload.tags);
      if ('title' in data && !data.title) throw createHttpError(400, 'BAD_REQUEST', '题库名称不能为空');
      if ('subject' in data && !data.subject) throw createHttpError(400, 'BAD_REQUEST', '学科不能为空');

      const bank = await prisma.questionBank.update({
        where: { id: bankId },
        data,
        include: { _count: { select: { questions: { where: { status: 'active' } } } } }
      });
      return normalizeBank(bank);
    },

    async archiveBank(bankId) {
      await this.getBank(bankId);
      const bank = await prisma.questionBank.update({
        where: { id: bankId },
        data: { status: 'archived', deletedAt: new Date() },
        include: { _count: { select: { questions: { where: { status: 'active' } } } } }
      });
      return normalizeBank(bank);
    },

    async createQuestion(bankId, payload = {}) {
      await this.getBank(bankId);
      validateQuestionPayload(payload);
      const question = await prisma.question.create({
        data: {
          bankId,
          courseId: normalizeText(payload.courseId) || null,
          type: normalizeText(payload.type),
          stage: normalizeText(payload.stage) || null,
          difficulty: normalizeText(payload.difficulty) || 'basic',
          title: normalizeText(payload.title),
          options: normalizeArray(payload.options),
          answer: payload.answer ?? '',
          analysis: normalizeText(payload.analysis) || null,
          knowledge: normalizeArray(payload.knowledge),
          accuracy: Number.isFinite(Number(payload.accuracy)) ? Number(payload.accuracy) : null
        }
      });
      return normalizeQuestion(question);
    },

    async updateQuestion(questionId, payload = {}) {
      const existing = await prisma.question.findUnique({ where: { id: questionId } });
      if (!existing) throw createHttpError(404, 'NOT_FOUND', '题目不存在');

      const data = {};
      if ('bankId' in payload) data.bankId = normalizeText(payload.bankId);
      if ('courseId' in payload) data.courseId = normalizeText(payload.courseId) || null;
      if ('type' in payload) data.type = normalizeText(payload.type);
      if ('stage' in payload) data.stage = normalizeText(payload.stage) || null;
      if ('difficulty' in payload) data.difficulty = normalizeText(payload.difficulty) || 'basic';
      if ('title' in payload) data.title = normalizeText(payload.title);
      if ('options' in payload) data.options = normalizeArray(payload.options);
      if ('answer' in payload) data.answer = payload.answer ?? '';
      if ('analysis' in payload) data.analysis = normalizeText(payload.analysis) || null;
      if ('knowledge' in payload) data.knowledge = normalizeArray(payload.knowledge);
      if ('accuracy' in payload) data.accuracy = Number.isFinite(Number(payload.accuracy)) ? Number(payload.accuracy) : null;
      if ('title' in data && !data.title) throw createHttpError(400, 'BAD_REQUEST', '题干不能为空');
      if ('type' in data && !data.type) throw createHttpError(400, 'BAD_REQUEST', '题型不能为空');

      const question = await prisma.question.update({ where: { id: questionId }, data });
      return normalizeQuestion(question);
    },

    async archiveQuestion(questionId) {
      const existing = await prisma.question.findUnique({ where: { id: questionId } });
      if (!existing) throw createHttpError(404, 'NOT_FOUND', '题目不存在');
      const question = await prisma.question.update({
        where: { id: questionId },
        data: { status: 'archived', deletedAt: new Date() }
      });
      return normalizeQuestion(question);
    }
  };
}
