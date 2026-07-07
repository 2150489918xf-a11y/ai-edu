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

function average(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function calculateLowestMastery(mastery = []) {
  return [...mastery].sort((a, b) => a.value - b.value)[0] || null;
}

function validateRequiredStudentFields(payload = {}) {
  const missing = ['name', 'classId'].filter((key) => !normalizeText(payload[key]));
  if (missing.length) {
    throw createHttpError(400, 'BAD_REQUEST', '缺少学生必要字段', { missing });
  }
}

function normalizeStudent(student) {
  const profile = student.learningProfiles?.[0];
  const mastery = Array.isArray(profile?.mastery) ? profile.mastery : [];
  const weakPoints = Array.isArray(profile?.weakPoints) ? profile.weakPoints : [];

  return {
    id: student.id,
    name: student.name,
    classId: student.classId,
    className: student.class?.name || student.className,
    studentNo: student.studentNo,
    attendance: student.attendance,
    practiceCount: student.practiceCount,
    status: student.status,
    deletedAt: student.deletedAt ? student.deletedAt.toISOString() : null,
    avgMastery: average(mastery.map((item) => Number(item.value || 0))),
    lowestMastery: calculateLowestMastery(mastery),
    weakPoints,
    aiConversationSummary: profile?.aiConversationSummary || '',
    createdAt: student.createdAt?.toISOString?.() || student.createdAt,
    updatedAt: student.updatedAt?.toISOString?.() || student.updatedAt
  };
}

function buildStudentWhere(filters = {}, targetClassId) {
  const where = {
    classId: filters.classId || targetClassId || undefined
  };
  const status = filters.status || 'active';

  if (status !== 'all') where.status = status;
  if (filters.keyword) {
    where.OR = [
      { name: { contains: filters.keyword, mode: 'insensitive' } },
      { studentNo: { contains: filters.keyword, mode: 'insensitive' } }
    ];
  }

  return where;
}

export function createStudentService(prisma) {
  return {
    async listStudents(filters = {}) {
      const allClasses = await prisma.class.findMany({
        where: { status: { not: 'archived' } },
        orderBy: { name: 'asc' }
      });
      const targetClass = filters.className && filters.className !== '全部班级'
        ? allClasses.find((item) => item.name === filters.className)
        : null;
      const page = Math.max(Number(filters.page || 1), 1);
      const pageSize = Math.min(Math.max(Number(filters.pageSize || 20), 1), 100);
      const where = buildStudentWhere(filters, targetClass?.id);

      const [students, total] = await Promise.all([
        prisma.student.findMany({
          where,
          include: {
            class: true,
            learningProfiles: {
              orderBy: { updatedAt: 'desc' },
              take: 1
            }
          },
          orderBy: [{ updatedAt: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        prisma.student.count({ where })
      ]);

      return {
        classes: ['全部班级', ...allClasses.map((item) => item.name)],
        students: students.map(normalizeStudent),
        total
      };
    },

    async createStudent(payload = {}) {
      validateRequiredStudentFields(payload);

      const classItem = await prisma.class.findUnique({ where: { id: payload.classId } });
      if (!classItem) throw createHttpError(404, 'NOT_FOUND', '班级不存在');

      const student = await prisma.student.create({
        data: {
          name: normalizeText(payload.name),
          classId: normalizeText(payload.classId),
          studentNo: normalizeText(payload.studentNo) || null,
          attendance: normalizeText(payload.attendance) || null,
          practiceCount: Number(payload.practiceCount || 0)
        },
        include: {
          class: true,
          learningProfiles: { orderBy: { updatedAt: 'desc' }, take: 1 }
        }
      });

      return normalizeStudent(student);
    },

    async getStudent(studentId) {
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: {
          class: true,
          learningProfiles: { orderBy: { updatedAt: 'desc' }, take: 1 }
        }
      });
      if (!student) throw createHttpError(404, 'NOT_FOUND', '学生不存在');
      return normalizeStudent(student);
    },

    async updateStudent(studentId, payload = {}) {
      await this.getStudent(studentId);

      const data = {};
      if ('name' in payload) data.name = normalizeText(payload.name);
      if ('studentNo' in payload) data.studentNo = normalizeText(payload.studentNo) || null;
      if ('attendance' in payload) data.attendance = normalizeText(payload.attendance) || null;
      if ('practiceCount' in payload) data.practiceCount = Number(payload.practiceCount || 0);

      if ('name' in data && !data.name) {
        throw createHttpError(400, 'BAD_REQUEST', '学生姓名不能为空');
      }

      const student = await prisma.student.update({
        where: { id: studentId },
        data,
        include: {
          class: true,
          learningProfiles: { orderBy: { updatedAt: 'desc' }, take: 1 }
        }
      });

      return normalizeStudent(student);
    },

    async transferStudent(studentId, payload = {}) {
      if (!normalizeText(payload.classId)) {
        throw createHttpError(400, 'BAD_REQUEST', '缺少转入班级');
      }
      await this.getStudent(studentId);
      const classItem = await prisma.class.findUnique({ where: { id: payload.classId } });
      if (!classItem) throw createHttpError(404, 'NOT_FOUND', '转入班级不存在');

      const student = await prisma.student.update({
        where: { id: studentId },
        data: { classId: payload.classId },
        include: {
          class: true,
          learningProfiles: { orderBy: { updatedAt: 'desc' }, take: 1 }
        }
      });

      return normalizeStudent(student);
    },

    async archiveStudent(studentId) {
      await this.getStudent(studentId);
      const student = await prisma.student.update({
        where: { id: studentId },
        data: { status: 'archived', deletedAt: new Date() },
        include: {
          class: true,
          learningProfiles: { orderBy: { updatedAt: 'desc' }, take: 1 }
        }
      });
      return normalizeStudent(student);
    },

    async restoreStudent(studentId) {
      await this.getStudent(studentId);
      const student = await prisma.student.update({
        where: { id: studentId },
        data: { status: 'active', deletedAt: null },
        include: {
          class: true,
          learningProfiles: { orderBy: { updatedAt: 'desc' }, take: 1 }
        }
      });
      return normalizeStudent(student);
    }
  };
}
