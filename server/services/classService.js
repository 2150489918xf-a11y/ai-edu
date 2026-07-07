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

function validateRequiredClassFields(payload = {}) {
  const missing = ['name', 'grade', 'subject'].filter((key) => !normalizeText(payload[key]));
  if (missing.length) {
    throw createHttpError(400, 'BAD_REQUEST', '缺少班级必要字段', { missing });
  }
}

function normalizeClass(item) {
  return {
    id: item.id,
    name: item.name,
    grade: item.grade,
    subject: item.subject,
    teacherId: item.teacherId,
    status: item.status,
    deletedAt: item.deletedAt ? item.deletedAt.toISOString() : null,
    studentCount: item._count?.students ?? item.studentCount ?? 0,
    createdAt: item.createdAt?.toISOString?.() || item.createdAt,
    updatedAt: item.updatedAt?.toISOString?.() || item.updatedAt
  };
}

function buildClassWhere(filters = {}) {
  const where = {};
  const status = filters.status || 'active';

  if (status !== 'all') where.status = status;
  if (filters.subject) where.subject = filters.subject;
  if (filters.grade) where.grade = filters.grade;
  if (filters.keyword) {
    where.OR = [
      { name: { contains: filters.keyword, mode: 'insensitive' } },
      { grade: { contains: filters.keyword, mode: 'insensitive' } },
      { subject: { contains: filters.keyword, mode: 'insensitive' } }
    ];
  }

  return where;
}

export function createClassService(prisma) {
  return {
    async listClasses(filters = {}) {
      const page = Math.max(Number(filters.page || 1), 1);
      const pageSize = Math.min(Math.max(Number(filters.pageSize || 20), 1), 100);
      const where = buildClassWhere(filters);

      const [classes, total] = await Promise.all([
        prisma.class.findMany({
          where,
          include: { _count: { select: { students: true } } },
          orderBy: [{ updatedAt: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        prisma.class.count({ where })
      ]);

      return {
        classes: classes.map(normalizeClass),
        total
      };
    },

    async createClass(payload = {}) {
      validateRequiredClassFields(payload);

      const item = await prisma.class.create({
        data: {
          name: normalizeText(payload.name),
          grade: normalizeText(payload.grade),
          subject: normalizeText(payload.subject),
          teacherId: normalizeText(payload.teacherId) || null
        },
        include: { _count: { select: { students: true } } }
      });

      return normalizeClass(item);
    },

    async getClass(classId) {
      const item = await prisma.class.findUnique({
        where: { id: classId },
        include: { _count: { select: { students: true } } }
      });
      if (!item) throw createHttpError(404, 'NOT_FOUND', '班级不存在');
      return normalizeClass(item);
    },

    async updateClass(classId, payload = {}) {
      await this.getClass(classId);

      const data = {};
      if ('name' in payload) data.name = normalizeText(payload.name);
      if ('grade' in payload) data.grade = normalizeText(payload.grade);
      if ('subject' in payload) data.subject = normalizeText(payload.subject);
      if ('teacherId' in payload) data.teacherId = normalizeText(payload.teacherId) || null;

      for (const key of ['name', 'grade', 'subject']) {
        if (key in data && !data[key]) {
          throw createHttpError(400, 'BAD_REQUEST', `${key} 不能为空`);
        }
      }

      const item = await prisma.class.update({
        where: { id: classId },
        data,
        include: { _count: { select: { students: true } } }
      });

      return normalizeClass(item);
    },

    async archiveClass(classId) {
      await this.getClass(classId);
      const item = await prisma.class.update({
        where: { id: classId },
        data: { status: 'archived', deletedAt: new Date() },
        include: { _count: { select: { students: true } } }
      });
      return normalizeClass(item);
    },

    async restoreClass(classId) {
      await this.getClass(classId);
      const item = await prisma.class.update({
        where: { id: classId },
        data: { status: 'active', deletedAt: null },
        include: { _count: { select: { students: true } } }
      });
      return normalizeClass(item);
    }
  };
}
