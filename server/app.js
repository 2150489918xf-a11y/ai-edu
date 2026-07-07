import { readJsonBody, sendError, sendJson } from './http.js';

function withCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function getPageParams(searchParams) {
  const page = Math.max(Number(searchParams.get('page') || 1), 1);
  const pageSize = Math.min(Math.max(Number(searchParams.get('pageSize') || 20), 1), 100);
  return { page, pageSize };
}

export function createLearningApiApp({ learningService, courseService, classService, studentService }) {
  if (!learningService) {
    throw new Error('learningService is required');
  }

  return async function learningApiApp(req, res) {
    withCors(res);

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;

    try {
      if (req.method === 'GET' && path === '/api/v1/health') {
        sendJson(res, 200, { data: { ok: true } });
        return;
      }

      if (courseService && req.method === 'GET' && path === '/api/v1/courses') {
        const { page, pageSize } = getPageParams(url.searchParams);
        const result = await courseService.listCourses({
          keyword: url.searchParams.get('keyword') || undefined,
          status: url.searchParams.get('status') || undefined,
          subject: url.searchParams.get('subject') || undefined,
          grade: url.searchParams.get('grade') || undefined,
          page,
          pageSize
        });
        sendJson(res, 200, {
          data: result.courses,
          pagination: {
            page,
            pageSize,
            total: result.total
          }
        });
        return;
      }

      if (courseService && req.method === 'POST' && path === '/api/v1/courses') {
        const body = await readJsonBody(req);
        const data = await courseService.createCourse(body);
        sendJson(res, 201, { data });
        return;
      }

      const courseRestoreMatch = path.match(/^\/api\/v1\/courses\/([^/]+)\/restore$/);
      if (courseService && req.method === 'POST' && courseRestoreMatch) {
        const data = await courseService.restoreCourse(decodeURIComponent(courseRestoreMatch[1]));
        sendJson(res, 200, { data });
        return;
      }

      const courseMatch = path.match(/^\/api\/v1\/courses\/([^/]+)$/);
      if (courseService && courseMatch) {
        const courseId = decodeURIComponent(courseMatch[1]);
        if (req.method === 'GET') {
          const data = await courseService.getCourse(courseId);
          sendJson(res, 200, { data });
          return;
        }
        if (req.method === 'PATCH') {
          const body = await readJsonBody(req);
          const data = await courseService.updateCourse(courseId, body);
          sendJson(res, 200, { data });
          return;
        }
        if (req.method === 'DELETE') {
          const data = await courseService.archiveCourse(courseId);
          sendJson(res, 200, { data });
          return;
        }
      }

      if (classService && req.method === 'GET' && path === '/api/v1/classes') {
        const { page, pageSize } = getPageParams(url.searchParams);
        const result = await classService.listClasses({
          keyword: url.searchParams.get('keyword') || undefined,
          status: url.searchParams.get('status') || undefined,
          subject: url.searchParams.get('subject') || undefined,
          grade: url.searchParams.get('grade') || undefined,
          page,
          pageSize
        });
        sendJson(res, 200, {
          data: result.classes,
          pagination: {
            page,
            pageSize,
            total: result.total
          }
        });
        return;
      }

      if (classService && req.method === 'POST' && path === '/api/v1/classes') {
        const body = await readJsonBody(req);
        const data = await classService.createClass(body);
        sendJson(res, 201, { data });
        return;
      }

      const classRestoreMatch = path.match(/^\/api\/v1\/classes\/([^/]+)\/restore$/);
      if (classService && req.method === 'POST' && classRestoreMatch) {
        const data = await classService.restoreClass(decodeURIComponent(classRestoreMatch[1]));
        sendJson(res, 200, { data });
        return;
      }

      const classCrudMatch = path.match(/^\/api\/v1\/classes\/([^/]+)$/);
      if (classService && classCrudMatch) {
        const classId = decodeURIComponent(classCrudMatch[1]);
        if (req.method === 'GET') {
          const data = await classService.getClass(classId);
          sendJson(res, 200, { data });
          return;
        }
        if (req.method === 'PATCH') {
          const body = await readJsonBody(req);
          const data = await classService.updateClass(classId, body);
          sendJson(res, 200, { data });
          return;
        }
        if (req.method === 'DELETE') {
          const data = await classService.archiveClass(classId);
          sendJson(res, 200, { data });
          return;
        }
      }

      if (!classService && req.method === 'GET' && path === '/api/v1/classes') {
        const data = await learningService.getClasses({
          subject: url.searchParams.get('subject') || undefined,
          grade: url.searchParams.get('grade') || undefined
        });
        sendJson(res, 200, { data });
        return;
      }

      if (studentService && req.method === 'GET' && path === '/api/v1/students') {
        const { page, pageSize } = getPageParams(url.searchParams);
        const result = await studentService.listStudents({
          classId: url.searchParams.get('classId') || undefined,
          className: url.searchParams.get('className') || undefined,
          keyword: url.searchParams.get('keyword') || undefined,
          status: url.searchParams.get('status') || undefined,
          page,
          pageSize
        });
        sendJson(res, 200, {
          data: result.students,
          meta: { classes: result.classes },
          pagination: {
            page,
            pageSize,
            total: result.total
          }
        });
        return;
      }

      if (studentService && req.method === 'POST' && path === '/api/v1/students') {
        const body = await readJsonBody(req);
        const data = await studentService.createStudent(body);
        sendJson(res, 201, { data });
        return;
      }

      const studentRestoreMatch = path.match(/^\/api\/v1\/students\/([^/]+)\/restore$/);
      if (studentService && req.method === 'POST' && studentRestoreMatch) {
        const data = await studentService.restoreStudent(decodeURIComponent(studentRestoreMatch[1]));
        sendJson(res, 200, { data });
        return;
      }

      const studentTransferMatch = path.match(/^\/api\/v1\/students\/([^/]+)\/transfer$/);
      if (studentService && req.method === 'POST' && studentTransferMatch) {
        const body = await readJsonBody(req);
        const data = await studentService.transferStudent(decodeURIComponent(studentTransferMatch[1]), body);
        sendJson(res, 200, { data });
        return;
      }

      const studentCrudMatch = path.match(/^\/api\/v1\/students\/([^/]+)$/);
      if (studentService && studentCrudMatch) {
        const studentId = decodeURIComponent(studentCrudMatch[1]);
        if (req.method === 'GET') {
          const data = await studentService.getStudent(studentId);
          sendJson(res, 200, { data });
          return;
        }
        if (req.method === 'PATCH') {
          const body = await readJsonBody(req);
          const data = await studentService.updateStudent(studentId, body);
          sendJson(res, 200, { data });
          return;
        }
        if (req.method === 'DELETE') {
          const data = await studentService.archiveStudent(studentId);
          sendJson(res, 200, { data });
          return;
        }
      }

      if (!studentService && req.method === 'GET' && path === '/api/v1/students') {
        const { page, pageSize } = getPageParams(url.searchParams);
        const result = await learningService.getStudents({
          classId: url.searchParams.get('classId') || undefined,
          className: url.searchParams.get('className') || undefined,
          keyword: url.searchParams.get('keyword') || undefined,
          page,
          pageSize
        });
        sendJson(res, 200, {
          data: result.students,
          meta: { classes: result.classes },
          pagination: {
            page,
            pageSize,
            total: result.total
          }
        });
        return;
      }

      const classSummaryMatch = path.match(/^\/api\/v1\/learning\/classes\/([^/]+)\/summary$/);
      if (req.method === 'GET' && classSummaryMatch) {
        const data = await learningService.getClassLearningSummary(decodeURIComponent(classSummaryMatch[1]), {
          courseId: url.searchParams.get('courseId') || undefined,
          sessionId: url.searchParams.get('sessionId') || undefined
        });
        sendJson(res, 200, { data });
        return;
      }

      const profileMatch = path.match(/^\/api\/v1\/students\/([^/]+)\/profile$/);
      if (req.method === 'GET' && profileMatch) {
        const data = await learningService.getStudentProfile(decodeURIComponent(profileMatch[1]), {
          courseId: url.searchParams.get('courseId') || undefined
        });
        sendJson(res, 200, { data });
        return;
      }

      const parentMatch = path.match(/^\/api\/v1\/students\/([^/]+)\/parent-summary$/);
      if (req.method === 'GET' && parentMatch) {
        const data = await learningService.getParentSummary(decodeURIComponent(parentMatch[1]), {
          courseId: url.searchParams.get('courseId') || undefined
        });
        sendJson(res, 200, { data });
        return;
      }

      if (req.method === 'POST' && path === '/api/v1/student-answers') {
        const body = await readJsonBody(req);
        const data = await learningService.submitStudentAnswer(body);
        sendJson(res, 201, { data });
        return;
      }

      if (req.method === 'GET' && path === '/api/v1/question-answer-records') {
        const { page, pageSize } = getPageParams(url.searchParams);
        const result = await learningService.getQuestionAnswerRecords({
          studentId: url.searchParams.get('studentId') || undefined,
          classId: url.searchParams.get('classId') || undefined,
          courseId: url.searchParams.get('courseId') || undefined,
          sessionId: url.searchParams.get('sessionId') || undefined,
          page,
          pageSize
        });
        sendJson(res, 200, {
          data: result.records,
          pagination: {
            page,
            pageSize,
            total: result.total
          }
        });
        return;
      }

      sendError(res, 404, 'NOT_FOUND', '接口不存在');
    } catch (error) {
      const statusCode = error.statusCode || 500;
      sendError(
        res,
        statusCode,
        error.code || 'INTERNAL_ERROR',
        error.message || '服务端异常',
        error.details || {}
      );
    }
  };
}
