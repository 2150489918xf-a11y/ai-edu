import { readJsonBody, sendError, sendJson, sendSse, startSse } from './http.js';

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

function getBearerToken(req) {
  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

export function createLearningApiApp({
  adminService,
  authService,
  learningService,
  courseService,
  classService,
  studentService,
  studentLearningService,
  studentAnalysisService,
  knowledgeService,
  questionBankService,
  aiMindMapService,
  aiQuestionService,
  aiStudentTutorService,
  aiLessonPlanService
}) {
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

      if (authService && req.method === 'POST' && path === '/api/v1/auth/login') {
        const body = await readJsonBody(req);
        const data = await authService.login(body);
        sendJson(res, 200, { data });
        return;
      }

      if (authService && req.method === 'GET' && path === '/api/v1/auth/me') {
        const data = await authService.getCurrentUser(getBearerToken(req));
        sendJson(res, 200, { data });
        return;
      }

      if (adminService && req.method === 'GET' && path === '/api/v1/admin/summary') {
        const data = await adminService.getSummary();
        sendJson(res, 200, { data });
        return;
      }

      if (adminService && req.method === 'GET' && path === '/api/v1/admin/teachers') {
        const { page, pageSize } = getPageParams(url.searchParams);
        const result = await adminService.listTeachers({
          keyword: url.searchParams.get('keyword') || undefined,
          status: url.searchParams.get('status') || undefined,
          page,
          pageSize
        });
        sendJson(res, 200, {
          data: result.teachers,
          pagination: { page, pageSize, total: result.total }
        });
        return;
      }

      if (adminService && req.method === 'POST' && path === '/api/v1/admin/teachers') {
        const body = await readJsonBody(req);
        const data = await adminService.createTeacher(body);
        sendJson(res, 201, { data });
        return;
      }

      const adminTeacherRestoreMatch = path.match(/^\/api\/v1\/admin\/teachers\/([^/]+)\/restore$/);
      if (adminService && req.method === 'POST' && adminTeacherRestoreMatch) {
        const data = await adminService.restoreTeacher(decodeURIComponent(adminTeacherRestoreMatch[1]));
        sendJson(res, 200, { data });
        return;
      }

      const adminTeacherMatch = path.match(/^\/api\/v1\/admin\/teachers\/([^/]+)$/);
      if (adminService && adminTeacherMatch) {
        const teacherId = decodeURIComponent(adminTeacherMatch[1]);
        if (req.method === 'PATCH') {
          const body = await readJsonBody(req);
          const data = await adminService.updateTeacher(teacherId, body);
          sendJson(res, 200, { data });
          return;
        }
        if (req.method === 'DELETE') {
          const data = await adminService.archiveTeacher(teacherId);
          sendJson(res, 200, { data });
          return;
        }
      }

      const adminStudentEnrollmentMatch = path.match(/^\/api\/v1\/admin\/students\/([^/]+)\/enrollments$/);
      if (adminService && adminStudentEnrollmentMatch) {
        const studentId = decodeURIComponent(adminStudentEnrollmentMatch[1]);
        if (req.method === 'GET') {
          const data = await adminService.listStudentEnrollments(studentId);
          sendJson(res, 200, { data });
          return;
        }
        if (req.method === 'POST') {
          const body = await readJsonBody(req);
          const data = await adminService.assignStudentCourse(studentId, body);
          sendJson(res, 201, { data });
          return;
        }
      }

      const adminStudentEnrollmentCourseMatch = path.match(/^\/api\/v1\/admin\/students\/([^/]+)\/enrollments\/([^/]+)$/);
      if (adminService && req.method === 'DELETE' && adminStudentEnrollmentCourseMatch) {
        const data = await adminService.removeStudentCourse(
          decodeURIComponent(adminStudentEnrollmentCourseMatch[1]),
          decodeURIComponent(adminStudentEnrollmentCourseMatch[2])
        );
        sendJson(res, 200, { data });
        return;
      }

      if (studentLearningService && req.method === 'GET' && path === '/api/v1/student/courses') {
        const data = await studentLearningService.listCourses(url.searchParams.get('studentId') || undefined);
        sendJson(res, 200, { data });
        return;
      }

      if (studentLearningService && req.method === 'GET' && path === '/api/v1/student/dashboard') {
        const data = await studentLearningService.getDashboard(url.searchParams.get('studentId') || undefined);
        sendJson(res, 200, { data });
        return;
      }

      if (studentAnalysisService && req.method === 'GET' && path === '/api/v1/student/analysis') {
        const data = await studentAnalysisService.getOverview(url.searchParams.get('studentId') || undefined);
        sendJson(res, 200, { data });
        return;
      }

      const studentAnalysisGenerateMatch = path.match(/^\/api\/v1\/student\/analysis\/courses\/([^/]+)\/generate$/);
      if (studentAnalysisService && req.method === 'POST' && studentAnalysisGenerateMatch) {
        const body = await readJsonBody(req);
        const data = await studentAnalysisService.generateCourseProfile(
          body.studentId || url.searchParams.get('studentId') || undefined,
          decodeURIComponent(studentAnalysisGenerateMatch[1])
        );
        sendJson(res, 200, { data });
        return;
      }

      const studentAnalysisCourseMatch = path.match(/^\/api\/v1\/student\/analysis\/courses\/([^/]+)$/);
      if (studentAnalysisService && req.method === 'GET' && studentAnalysisCourseMatch) {
        const data = await studentAnalysisService.getCourseAnalysis(
          url.searchParams.get('studentId') || undefined,
          decodeURIComponent(studentAnalysisCourseMatch[1])
        );
        sendJson(res, 200, { data });
        return;
      }

      if (studentLearningService && req.method === 'GET' && path === '/api/v1/student/course-catalog') {
        const data = await studentLearningService.listCourseCatalog(url.searchParams.get('studentId') || undefined);
        sendJson(res, 200, { data });
        return;
      }

      if (studentLearningService && req.method === 'POST' && path === '/api/v1/student/courses/join') {
        const body = await readJsonBody(req);
        const data = await studentLearningService.joinCourse(body.studentId, body);
        sendJson(res, 200, { data });
        return;
      }

      const studentCourseMatch = path.match(/^\/api\/v1\/student\/courses\/([^/]+)$/);
      if (studentLearningService && req.method === 'GET' && studentCourseMatch) {
        const data = await studentLearningService.getCourse(
          url.searchParams.get('studentId') || undefined,
          decodeURIComponent(studentCourseMatch[1])
        );
        sendJson(res, 200, { data });
        return;
      }

      const studentTaskMatch = path.match(/^\/api\/v1\/student\/tasks\/([^/]+)$/);
      if (studentLearningService && req.method === 'GET' && studentTaskMatch) {
        const data = await studentLearningService.getTask(
          url.searchParams.get('studentId') || undefined,
          decodeURIComponent(studentTaskMatch[1])
        );
        sendJson(res, 200, { data });
        return;
      }

      const studentTaskAnswerMatch = path.match(/^\/api\/v1\/student\/tasks\/([^/]+)\/answers$/);
      if (studentLearningService && req.method === 'POST' && studentTaskAnswerMatch) {
        const body = await readJsonBody(req);
        const data = await studentLearningService.saveAnswer(
          body.studentId,
          decodeURIComponent(studentTaskAnswerMatch[1]),
          body
        );
        sendJson(res, 200, { data });
        return;
      }

      const studentTaskSubmitMatch = path.match(/^\/api\/v1\/student\/tasks\/([^/]+)\/submit$/);
      if (studentLearningService && req.method === 'POST' && studentTaskSubmitMatch) {
        const body = await readJsonBody(req);
        const data = await studentLearningService.submitTask(
          body.studentId,
          decodeURIComponent(studentTaskSubmitMatch[1])
        );
        sendJson(res, 200, { data });
        return;
      }

      if (studentLearningService && aiStudentTutorService && req.method === 'POST' && path === '/api/v1/student/ai/chat-stream') {
        const body = await readJsonBody(req);
        let taskContext = null;
        if (body.studentId && body.taskId) {
          taskContext = await studentLearningService.getTask(body.studentId, body.taskId);
        }
        const questionId = body.questionId || body.question?.id;
        const question = questionId && taskContext
          ? taskContext.questions.find((item) => item.id === questionId) || body.question
          : body.question;
        startSse(res);
        try {
          await aiStudentTutorService.streamChat({
            ...body,
            course: body.course || taskContext?.course || null,
            question
          }, {
            onDelta: (text) => sendSse(res, 'delta', { text }),
            onDone: (meta) => sendSse(res, 'done', meta)
          });
        } catch (error) {
          sendSse(res, 'error', {
            code: error.code || 'AI_STREAM_ERROR',
            message: error.message || 'AI student chat stream failed'
          });
        } finally {
          res.end();
        }
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

      if (knowledgeService && req.method === 'GET' && path === '/api/v1/knowledge-categories') {
        const { page, pageSize } = getPageParams(url.searchParams);
        const result = await knowledgeService.listCategories({
          keyword: url.searchParams.get('keyword') || undefined,
          status: url.searchParams.get('status') || undefined,
          page,
          pageSize
        });
        sendJson(res, 200, {
          data: result.categories,
          pagination: { page, pageSize, total: result.total }
        });
        return;
      }

      if (knowledgeService && req.method === 'POST' && path === '/api/v1/knowledge-categories') {
        const body = await readJsonBody(req);
        const data = await knowledgeService.createCategory(body);
        sendJson(res, 201, { data });
        return;
      }

      const knowledgeCategoryMatch = path.match(/^\/api\/v1\/knowledge-categories\/([^/]+)$/);
      if (knowledgeService && knowledgeCategoryMatch) {
        const categoryId = decodeURIComponent(knowledgeCategoryMatch[1]);
        if (req.method === 'PATCH') {
          const body = await readJsonBody(req);
          const data = await knowledgeService.updateCategory(categoryId, body);
          sendJson(res, 200, { data });
          return;
        }
        if (req.method === 'DELETE') {
          const data = await knowledgeService.archiveCategory(categoryId);
          sendJson(res, 200, { data });
          return;
        }
      }

      if (knowledgeService && req.method === 'GET' && path === '/api/v1/knowledge-materials') {
        const { page, pageSize } = getPageParams(url.searchParams);
        const result = await knowledgeService.listMaterials({
          categoryId: url.searchParams.get('categoryId') || undefined,
          type: url.searchParams.get('type') || undefined,
          parseStatus: url.searchParams.get('parseStatus') || undefined,
          keyword: url.searchParams.get('keyword') || undefined,
          status: url.searchParams.get('status') || undefined,
          page,
          pageSize
        });
        sendJson(res, 200, {
          data: result.materials,
          pagination: { page, pageSize, total: result.total }
        });
        return;
      }

      if (knowledgeService && req.method === 'POST' && path === '/api/v1/knowledge-materials') {
        const body = await readJsonBody(req);
        const data = await knowledgeService.createMaterial(body);
        sendJson(res, 201, { data });
        return;
      }

      const knowledgeMaterialMatch = path.match(/^\/api\/v1\/knowledge-materials\/([^/]+)$/);
      if (knowledgeService && knowledgeMaterialMatch) {
        const materialId = decodeURIComponent(knowledgeMaterialMatch[1]);
        if (req.method === 'GET') {
          const data = await knowledgeService.getMaterial(materialId);
          sendJson(res, 200, { data });
          return;
        }
        if (req.method === 'PATCH') {
          const body = await readJsonBody(req);
          const data = await knowledgeService.updateMaterial(materialId, body);
          sendJson(res, 200, { data });
          return;
        }
        if (req.method === 'DELETE') {
          const data = await knowledgeService.archiveMaterial(materialId);
          sendJson(res, 200, { data });
          return;
        }
      }

      if (courseService && req.method === 'POST' && path === '/api/v1/courses') {
        const body = await readJsonBody(req);
        const data = await courseService.createCourse(body);
        sendJson(res, 201, { data });
        return;
      }

      if (questionBankService && req.method === 'GET' && path === '/api/v1/question-banks') {
        const { page, pageSize } = getPageParams(url.searchParams);
        const result = await questionBankService.listBanks({
          keyword: url.searchParams.get('keyword') || undefined,
          status: url.searchParams.get('status') || undefined,
          subject: url.searchParams.get('subject') || undefined,
          grade: url.searchParams.get('grade') || undefined,
          page,
          pageSize
        });
        sendJson(res, 200, {
          data: result.banks,
          pagination: { page, pageSize, total: result.total }
        });
        return;
      }

      if (questionBankService && req.method === 'POST' && path === '/api/v1/question-banks') {
        const body = await readJsonBody(req);
        const data = await questionBankService.createBank(body);
        sendJson(res, 201, { data });
        return;
      }

      const questionBankQuestionMatch = path.match(/^\/api\/v1\/question-banks\/([^/]+)\/questions$/);
      if (questionBankService && req.method === 'POST' && questionBankQuestionMatch) {
        const body = await readJsonBody(req);
        const data = await questionBankService.createQuestion(decodeURIComponent(questionBankQuestionMatch[1]), body);
        sendJson(res, 201, { data });
        return;
      }

      const aiQuestionGenerateMatch = path.match(/^\/api\/v1\/question-banks\/([^/]+)\/ai-generate$/);
      if (questionBankService && aiQuestionService && req.method === 'POST' && aiQuestionGenerateMatch) {
        const bank = await questionBankService.getBank(decodeURIComponent(aiQuestionGenerateMatch[1]));
        const body = await readJsonBody(req);
        const data = await aiQuestionService.generateQuestions({
          bank,
          prompt: body.prompt || '',
          analysis: body.analysis || {},
          messages: body.messages || []
        });
        sendJson(res, 200, { data });
        return;
      }

      const aiQuestionStreamMatch = path.match(/^\/api\/v1\/question-banks\/([^/]+)\/ai-generate-stream$/);
      if (questionBankService && aiQuestionService && req.method === 'POST' && aiQuestionStreamMatch) {
        const bank = await questionBankService.getBank(decodeURIComponent(aiQuestionStreamMatch[1]));
        const body = await readJsonBody(req);
        startSse(res);
        try {
          await aiQuestionService.streamQuestions({
            bank,
            prompt: body.prompt || '',
            mode: body.mode || 'generate',
            analysis: body.analysis || {},
            candidateQuestions: body.candidateQuestions || [],
            editingQuestion: body.editingQuestion || null,
            messages: body.messages || []
          }, {
            onDelta: (text) => sendSse(res, 'delta', { text }),
            onQuestion: (question) => sendSse(res, 'question', { question }),
            onDone: (meta) => sendSse(res, 'done', meta)
          });
        } catch (error) {
          sendSse(res, 'error', {
            code: error.code || 'AI_STREAM_ERROR',
            message: error.message || 'AI stream failed'
          });
        } finally {
          res.end();
        }
        return;
      }

      const questionBankMatch = path.match(/^\/api\/v1\/question-banks\/([^/]+)$/);
      if (questionBankService && questionBankMatch) {
        const bankId = decodeURIComponent(questionBankMatch[1]);
        if (req.method === 'GET') {
          const data = await questionBankService.getBank(bankId);
          sendJson(res, 200, { data });
          return;
        }
        if (req.method === 'PATCH') {
          const body = await readJsonBody(req);
          const data = await questionBankService.updateBank(bankId, body);
          sendJson(res, 200, { data });
          return;
        }
        if (req.method === 'DELETE') {
          const data = await questionBankService.archiveBank(bankId);
          sendJson(res, 200, { data });
          return;
        }
      }

      const questionMatch = path.match(/^\/api\/v1\/questions\/([^/]+)$/);
      if (questionBankService && questionMatch) {
        const questionId = decodeURIComponent(questionMatch[1]);
        if (req.method === 'PATCH') {
          const body = await readJsonBody(req);
          const data = await questionBankService.updateQuestion(questionId, body);
          sendJson(res, 200, { data });
          return;
        }
        if (req.method === 'DELETE') {
          const data = await questionBankService.archiveQuestion(questionId);
          sendJson(res, 200, { data });
          return;
        }
      }

      const courseRestoreMatch = path.match(/^\/api\/v1\/courses\/([^/]+)\/restore$/);
      if (courseService && req.method === 'POST' && courseRestoreMatch) {
        const data = await courseService.restoreCourse(decodeURIComponent(courseRestoreMatch[1]));
        sendJson(res, 200, { data });
        return;
      }

      const courseMindMapGenerateMatch = path.match(/^\/api\/v1\/courses\/([^/]+)\/mindmap\/generate$/);
      if (courseService && aiMindMapService && req.method === 'POST' && courseMindMapGenerateMatch) {
        const courseId = decodeURIComponent(courseMindMapGenerateMatch[1]);
        const course = await courseService.getCourse(courseId);
        const body = await readJsonBody(req);
        const generated = await aiMindMapService.generateMindMap({
          course,
          prompt: body.prompt || '',
          currentMarkdown: body.currentMarkdown || course.mindmap?.markdown || '',
          messages: body.messages || []
        });
        const mindmap = {
          id: course.mindmap?.id || `mindmap-${course.id}`,
          title: course.shortTitle || course.title || 'AI 思维导图',
          markdown: generated.markdown,
          provider: generated.provider,
          model: generated.model,
          generatedAt: new Date().toISOString()
        };
        const savedCourse = await courseService.updateCourse(courseId, {
          mindmap,
          progress: Math.max(Number(course.progress || 0), 68)
        });
        sendJson(res, 200, {
          data: {
            courseId,
            provider: generated.provider,
            model: generated.model,
            content: generated.content,
            mindmap,
            course: savedCourse
          }
        });
        return;
      }

      const courseLessonPlanStreamMatch = path.match(/^\/api\/v1\/courses\/([^/]+)\/lesson-plan\/generate-stream$/);
      if (courseService && aiLessonPlanService && req.method === 'POST' && courseLessonPlanStreamMatch) {
        const courseId = decodeURIComponent(courseLessonPlanStreamMatch[1]);
        const course = await courseService.getCourse(courseId);
        const body = await readJsonBody(req);
        let generatedLessonPlan = null;
        let doneMeta = {};
        startSse(res);
        try {
          await aiLessonPlanService.streamLessonPlan({
            course,
            prompt: body.prompt || '',
            currentLessonPlan: body.currentLessonPlan || course.lessonPlan || null,
            messages: body.messages || []
          }, {
            onDelta: (text) => sendSse(res, 'delta', { text }),
            onMeta: (meta) => sendSse(res, 'meta', { meta }),
            onObjectives: (objectives) => sendSse(res, 'objectives', { objectives }),
            onMaterials: (materials) => sendSse(res, 'materials', { materials }),
            onFocus: (payload) => sendSse(res, 'focus', payload),
            onSection: (section) => sendSse(res, 'section', { section }),
            onClosing: (closing) => sendSse(res, 'closing', { closing }),
            onLessonPlan: (lessonPlan) => {
              generatedLessonPlan = lessonPlan;
              sendSse(res, 'lessonPlan', { lessonPlan });
            },
            onDone: (meta) => {
              doneMeta = meta || {};
            }
          });
          let savedCourse = null;
          if (generatedLessonPlan) {
            savedCourse = await courseService.updateCourse(courseId, {
              lessonPlan: generatedLessonPlan,
              progress: Math.max(Number(course.progress || 0), 78)
            });
          }
          sendSse(res, 'done', { ...doneMeta, course: savedCourse });
        } catch (error) {
          sendSse(res, 'error', {
            code: error.code || 'AI_STREAM_ERROR',
            message: error.message || 'AI lesson plan stream failed'
          });
        } finally {
          res.end();
        }
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
