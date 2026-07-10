import { hashPassword } from './authService.js';

const STUDENT_ENROLLMENT_SESSION_STATUS = 'student_enrollment';

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

function toIso(value) {
  return value?.toISOString?.() || value || null;
}

function normalizeTeacher(teacher) {
  return {
    id: teacher.id,
    userId: teacher.userId,
    username: teacher.user?.username || '',
    name: teacher.name,
    phone: teacher.phone || '',
    email: teacher.email || '',
    status: teacher.status,
    classCount: teacher._count?.classes ?? 0,
    courseCount: teacher._count?.courses ?? 0,
    deletedAt: toIso(teacher.deletedAt),
    createdAt: toIso(teacher.createdAt),
    updatedAt: toIso(teacher.updatedAt)
  };
}

function normalizeEnrollment(enrollment) {
  return {
    id: enrollment.id,
    studentId: enrollment.studentId,
    courseId: enrollment.courseId,
    sessionId: enrollment.sessionId,
    status: enrollment.status,
    source: 'manual',
    course: enrollment.course ? {
      id: enrollment.course.id,
      title: enrollment.course.title,
      subject: enrollment.course.subject,
      grade: enrollment.course.grade,
      teacher: enrollment.course.teacher?.name || '任课老师',
      questionCount: enrollment.course._count?.questions ?? 0
    } : null,
    createdAt: toIso(enrollment.createdAt),
    updatedAt: toIso(enrollment.updatedAt)
  };
}

function normalizeClassCourse(session) {
  return {
    id: session.id,
    courseId: session.courseId,
    source: 'class',
    title: session.title,
    status: session.status,
    course: session.course ? {
      id: session.course.id,
      title: session.course.title,
      subject: session.course.subject,
      grade: session.course.grade,
      teacher: session.course.teacher?.name || '任课老师',
      questionCount: session.course._count?.questions ?? 0
    } : null,
    startedAt: toIso(session.startedAt)
  };
}

function buildTeacherWhere(filters = {}) {
  const where = {};
  const status = filters.status || 'active';
  if (status !== 'all') where.status = status;
  if (filters.keyword) {
    where.OR = [
      { name: { contains: filters.keyword, mode: 'insensitive' } },
      { phone: { contains: filters.keyword, mode: 'insensitive' } },
      { email: { contains: filters.keyword, mode: 'insensitive' } },
      { user: { username: { contains: filters.keyword, mode: 'insensitive' } } }
    ];
  }
  return where;
}

async function requireStudent(prisma, studentId) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { class: true }
  });
  if (!student || student.status === 'archived') {
    throw createHttpError(404, 'NOT_FOUND', '学生不存在');
  }
  return student;
}

async function requireCourse(prisma, courseId) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, status: 'active', deletedAt: null },
    include: { teacher: true }
  });
  if (!course) throw createHttpError(404, 'NOT_FOUND', '课程不存在或未启用');
  return course;
}

export function createAdminService(prisma) {
  return {
    async getSummary() {
      const [teacherCount, classCount, studentCount, courseCount, enrollmentCount] = await Promise.all([
        prisma.teacher.count({ where: { status: 'active' } }),
        prisma.class.count({ where: { status: 'active' } }),
        prisma.student.count({ where: { status: 'active' } }),
        prisma.course.count({ where: { status: 'active' } }),
        prisma.studentCourseEnrollment.count({ where: { status: 'active' } })
      ]);
      return {
        teacherCount,
        classCount,
        studentCount,
        courseCount,
        enrollmentCount
      };
    },

    async listTeachers(filters = {}) {
      const page = Math.max(Number(filters.page || 1), 1);
      const pageSize = Math.min(Math.max(Number(filters.pageSize || 20), 1), 100);
      const where = buildTeacherWhere(filters);
      const [teachers, total] = await Promise.all([
        prisma.teacher.findMany({
          where,
          include: {
            user: true,
            _count: { select: { classes: true, courses: true } }
          },
          orderBy: [{ updatedAt: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        prisma.teacher.count({ where })
      ]);
      return { teachers: teachers.map(normalizeTeacher), total };
    },

    async createTeacher(payload = {}) {
      const name = normalizeText(payload.name);
      const username = normalizeText(payload.username);
      const password = String(payload.password || 'teacher123');
      if (!name || !username) {
        throw createHttpError(400, 'BAD_REQUEST', '缺少教师姓名或账号');
      }

      const user = await prisma.user.create({
        data: {
          username,
          passwordHash: hashPassword(password),
          role: 'teacher'
        }
      });
      const teacher = await prisma.teacher.create({
        data: {
          userId: user.id,
          name,
          phone: normalizeText(payload.phone) || null,
          email: normalizeText(payload.email) || null
        },
        include: {
          user: true,
          _count: { select: { classes: true, courses: true } }
        }
      });
      return normalizeTeacher(teacher);
    },

    async updateTeacher(teacherId, payload = {}) {
      const existing = await prisma.teacher.findUnique({ where: { id: teacherId }, include: { user: true } });
      if (!existing) throw createHttpError(404, 'NOT_FOUND', '教师不存在');

      const data = {};
      if ('name' in payload) data.name = normalizeText(payload.name);
      if ('phone' in payload) data.phone = normalizeText(payload.phone) || null;
      if ('email' in payload) data.email = normalizeText(payload.email) || null;
      if ('name' in data && !data.name) throw createHttpError(400, 'BAD_REQUEST', '教师姓名不能为空');

      const teacher = await prisma.teacher.update({
        where: { id: teacherId },
        data,
        include: {
          user: true,
          _count: { select: { classes: true, courses: true } }
        }
      });
      return normalizeTeacher(teacher);
    },

    async archiveTeacher(teacherId) {
      const existing = await prisma.teacher.findUnique({ where: { id: teacherId } });
      if (!existing) throw createHttpError(404, 'NOT_FOUND', '教师不存在');
      const teacher = await prisma.teacher.update({
        where: { id: teacherId },
        data: { status: 'archived', deletedAt: new Date() },
        include: {
          user: true,
          _count: { select: { classes: true, courses: true } }
        }
      });
      if (teacher.userId) {
        await prisma.user.update({ where: { id: teacher.userId }, data: { status: 'archived' } });
      }
      return normalizeTeacher(teacher);
    },

    async restoreTeacher(teacherId) {
      const existing = await prisma.teacher.findUnique({ where: { id: teacherId } });
      if (!existing) throw createHttpError(404, 'NOT_FOUND', '教师不存在');
      const teacher = await prisma.teacher.update({
        where: { id: teacherId },
        data: { status: 'active', deletedAt: null },
        include: {
          user: true,
          _count: { select: { classes: true, courses: true } }
        }
      });
      if (teacher.userId) {
        await prisma.user.update({ where: { id: teacher.userId }, data: { status: 'active' } });
      }
      return normalizeTeacher(teacher);
    },

    async listStudentEnrollments(studentId) {
      const student = await requireStudent(prisma, studentId);
      const [classCourses, enrollments] = await Promise.all([
        prisma.classroomSession.findMany({
          where: {
            classId: student.classId,
            status: { not: STUDENT_ENROLLMENT_SESSION_STATUS },
            course: { status: 'active', deletedAt: null }
          },
          include: {
            course: {
              include: {
                teacher: true,
                _count: { select: { questions: true } }
              }
            }
          },
          orderBy: [{ startedAt: 'desc' }, { id: 'asc' }]
        }),
        prisma.studentCourseEnrollment.findMany({
          where: { studentId, status: 'active' },
          include: {
            course: {
              include: {
                teacher: true,
                _count: { select: { questions: true } }
              }
            }
          },
          orderBy: [{ createdAt: 'desc' }]
        })
      ]);

      return {
        student: {
          id: student.id,
          name: student.name,
          studentNo: student.studentNo || '',
          classId: student.classId,
          className: student.class?.name || ''
        },
        classCourses: classCourses.map(normalizeClassCourse),
        enrollments: enrollments.map(normalizeEnrollment)
      };
    },

    async assignStudentCourse(studentId, payload = {}) {
      const student = await requireStudent(prisma, studentId);
      const courseId = normalizeText(payload.courseId);
      if (!courseId) throw createHttpError(400, 'BAD_REQUEST', '缺少课程 ID');
      const course = await requireCourse(prisma, courseId);

      const existing = await prisma.studentCourseEnrollment.findUnique({
        where: { studentId_courseId: { studentId, courseId } },
        include: {
          course: {
            include: {
              teacher: true,
              _count: { select: { questions: true } }
            }
          }
        }
      });
      if (existing?.status === 'active') return normalizeEnrollment(existing);

      const session = await prisma.classroomSession.create({
        data: {
          classId: student.classId,
          courseId,
          title: `${course.title} 教务分配`,
          status: STUDENT_ENROLLMENT_SESSION_STATUS,
          startedAt: new Date()
        }
      });
      const enrollment = existing
        ? await prisma.studentCourseEnrollment.update({
            where: { id: existing.id },
            data: { status: 'active', sessionId: session.id },
            include: {
              course: {
                include: {
                  teacher: true,
                  _count: { select: { questions: true } }
                }
              }
            }
          })
        : await prisma.studentCourseEnrollment.create({
            data: { studentId, courseId, sessionId: session.id },
            include: {
              course: {
                include: {
                  teacher: true,
                  _count: { select: { questions: true } }
                }
              }
            }
          });
      return normalizeEnrollment(enrollment);
    },

    async removeStudentCourse(studentId, courseId) {
      await requireStudent(prisma, studentId);
      const enrollment = await prisma.studentCourseEnrollment.findUnique({
        where: { studentId_courseId: { studentId, courseId } }
      });
      if (!enrollment) throw createHttpError(404, 'NOT_FOUND', '学生未分配该课程');

      const updated = await prisma.studentCourseEnrollment.update({
        where: { id: enrollment.id },
        data: { status: 'archived' },
        include: {
          course: {
            include: {
              teacher: true,
              _count: { select: { questions: true } }
            }
          }
        }
      });
      return normalizeEnrollment(updated);
    }
  };
}
