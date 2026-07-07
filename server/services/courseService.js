function createHttpError(statusCode, code, message, details = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

function normalizeCourse(course) {
  return {
    id: course.id,
    title: course.title,
    subject: course.subject,
    grade: course.grade,
    description: course.description,
    duration: course.duration,
    goal: course.goal,
    knowledge: Array.isArray(course.knowledge) ? course.knowledge : [],
    hasOutline: Boolean(course.hasOutline),
    progress: course.progress ?? 18,
    materialUploaded: Boolean(course.materialUploaded),
    materialName: course.materialName || null,
    outline: course.outline || null,
    status: course.status,
    deletedAt: course.deletedAt ? course.deletedAt.toISOString() : null,
    createdAt: course.createdAt?.toISOString?.() || course.createdAt,
    updatedAt: course.updatedAt?.toISOString?.() || course.updatedAt
  };
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function validateRequiredCourseFields(payload = {}) {
  const missing = ['title', 'subject', 'grade'].filter((key) => !normalizeText(payload[key]));
  if (missing.length) {
    throw createHttpError(400, 'BAD_REQUEST', '缺少课程必要字段', { missing });
  }
}

function buildCourseWhere(filters = {}) {
  const where = {};
  const status = filters.status || 'active';

  if (status !== 'all') {
    where.status = status;
  }

  if (filters.keyword) {
    where.OR = [
      { title: { contains: filters.keyword, mode: 'insensitive' } },
      { subject: { contains: filters.keyword, mode: 'insensitive' } },
      { grade: { contains: filters.keyword, mode: 'insensitive' } }
    ];
  }

  if (filters.subject) where.subject = filters.subject;
  if (filters.grade) where.grade = filters.grade;

  return where;
}

export function createCourseService(prisma) {
  return {
    async listCourses(filters = {}) {
      const page = Math.max(Number(filters.page || 1), 1);
      const pageSize = Math.min(Math.max(Number(filters.pageSize || 20), 1), 100);
      const where = buildCourseWhere(filters);

      const [courses, total] = await Promise.all([
        prisma.course.findMany({
          where,
          orderBy: [{ updatedAt: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        prisma.course.count({ where })
      ]);

      return {
        courses: courses.map(normalizeCourse),
        total
      };
    },

    async createCourse(payload = {}) {
      validateRequiredCourseFields(payload);

      const course = await prisma.course.create({
        data: {
          title: normalizeText(payload.title),
          subject: normalizeText(payload.subject),
          grade: normalizeText(payload.grade),
          description: normalizeText(payload.description) || null,
          duration: normalizeText(payload.duration) || '45 分钟',
          goal: normalizeText(payload.goal) || null,
          knowledge: Array.isArray(payload.knowledge) ? payload.knowledge : [],
          hasOutline: Boolean(payload.hasOutline),
          progress: Number.isFinite(Number(payload.progress)) ? Number(payload.progress) : 18,
          materialUploaded: Boolean(payload.materialUploaded),
          materialName: normalizeText(payload.materialName) || null,
          outline: payload.outline || null
        }
      });

      return normalizeCourse(course);
    },

    async getCourse(courseId) {
      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course) {
        throw createHttpError(404, 'NOT_FOUND', '课程不存在');
      }
      return normalizeCourse(course);
    },

    async updateCourse(courseId, payload = {}) {
      await this.getCourse(courseId);

      const data = {};
      if ('title' in payload) data.title = normalizeText(payload.title);
      if ('subject' in payload) data.subject = normalizeText(payload.subject);
      if ('grade' in payload) data.grade = normalizeText(payload.grade);
      if ('description' in payload) data.description = normalizeText(payload.description) || null;
      if ('duration' in payload) data.duration = normalizeText(payload.duration) || null;
      if ('goal' in payload) data.goal = normalizeText(payload.goal) || null;
      if ('knowledge' in payload) data.knowledge = Array.isArray(payload.knowledge) ? payload.knowledge : [];
      if ('hasOutline' in payload) data.hasOutline = Boolean(payload.hasOutline);
      if ('progress' in payload) data.progress = Math.min(Math.max(Number(payload.progress) || 0, 0), 100);
      if ('materialUploaded' in payload) data.materialUploaded = Boolean(payload.materialUploaded);
      if ('materialName' in payload) data.materialName = normalizeText(payload.materialName) || null;
      if ('outline' in payload) data.outline = payload.outline || null;

      if ('title' in data && !data.title) {
        throw createHttpError(400, 'BAD_REQUEST', '课程名称不能为空');
      }
      if ('subject' in data && !data.subject) {
        throw createHttpError(400, 'BAD_REQUEST', '学科不能为空');
      }
      if ('grade' in data && !data.grade) {
        throw createHttpError(400, 'BAD_REQUEST', '年级不能为空');
      }

      const course = await prisma.course.update({
        where: { id: courseId },
        data
      });

      return normalizeCourse(course);
    },

    async archiveCourse(courseId) {
      await this.getCourse(courseId);

      const course = await prisma.course.update({
        where: { id: courseId },
        data: {
          status: 'archived',
          deletedAt: new Date()
        }
      });

      return normalizeCourse(course);
    },

    async restoreCourse(courseId) {
      await this.getCourse(courseId);

      const course = await prisma.course.update({
        where: { id: courseId },
        data: {
          status: 'active',
          deletedAt: null
        }
      });

      return normalizeCourse(course);
    }
  };
}
