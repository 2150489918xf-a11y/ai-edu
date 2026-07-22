import { createServer } from 'node:http';

import { createLearningApiApp } from './app.js';
import { loadEnvFile } from './env.js';
import { createLearningService } from './learningService.js';
import { createClassService } from './services/classService.js';
import { createCourseService } from './services/courseService.js';
import { createKnowledgeService } from './services/knowledgeService.js';
import { createAiMindMapService } from './services/aiMindMapService.js';
import { createAiOutlineService } from './services/aiOutlineService.js';
import { createAiQuestionService } from './services/aiQuestionService.js';
import { createAiLessonPlanService } from './services/aiLessonPlanService.js';
import { createAiQuestionKnowledgeService } from './services/aiQuestionKnowledgeService.js';
import { createQuestionKnowledgeGraphService } from './services/questionKnowledgeGraphService.js';
import { createQuestionKnowledgeWorker } from './services/questionKnowledgeWorker.js';
import { createAiStudentPracticeService } from './services/aiStudentPracticeService.js';
import { createQuestionBankService } from './services/questionBankService.js';
import { createStudentService } from './services/studentService.js';
import { createStudentLearningService } from './services/studentLearningService.js';
import { createStudentAnalysisService } from './services/studentAnalysisService.js';
import { createAiStudentTutorService } from './services/aiStudentTutorService.js';
import { createAuthService } from './services/authService.js';
import { createAdminService } from './services/adminService.js';
import { createCourseAnalysisService } from './services/courseAnalysisService.js';
import { createAiCourseAnalysisService } from './services/aiCourseAnalysisService.js';

loadEnvFile();

const { PrismaClient } = await import('@prisma/client');
const port = Number(process.env.SERVER_PORT || 3001);
const host = process.env.SERVER_HOST || '0.0.0.0';
const prisma = new PrismaClient();
const learningService = createLearningService(prisma);
const courseService = createCourseService(prisma);
const classService = createClassService(prisma);
const studentService = createStudentService(prisma);
const knowledgeService = createKnowledgeService(prisma);
const studentLearningService = createStudentLearningService(prisma);
const studentAnalysisService = createStudentAnalysisService(prisma);
const authService = createAuthService(prisma);
const adminService = createAdminService(prisma);
const courseAnalysisService = createCourseAnalysisService(prisma);
const aiMindMapService = createAiMindMapService();
const aiOutlineService = createAiOutlineService();
const aiQuestionService = createAiQuestionService();
const aiLessonPlanService = createAiLessonPlanService();
const aiQuestionKnowledgeService = createAiQuestionKnowledgeService();
const questionKnowledgeGraphService = createQuestionKnowledgeGraphService(prisma, { aiQuestionKnowledgeService });
const questionBankService = createQuestionBankService(prisma, { questionKnowledgeGraphService });
const questionKnowledgeWorker = createQuestionKnowledgeWorker({ graphService: questionKnowledgeGraphService });
const aiStudentTutorService = createAiStudentTutorService();
const aiStudentPracticeService = createAiStudentPracticeService(prisma, { studentAnalysisService });
const aiCourseAnalysisService = createAiCourseAnalysisService({ courseAnalysisService });
const app = createLearningApiApp({
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
  questionKnowledgeGraphService,
  aiMindMapService,
  aiOutlineService,
  aiQuestionService,
  aiStudentTutorService,
  aiStudentPracticeService,
  aiLessonPlanService,
  courseAnalysisService,
  aiCourseAnalysisService
});
const server = createServer(app);

server.listen(port, host, () => {
  console.log(`EduAI API server listening on http://${host}:${port}`);
  questionKnowledgeWorker.start();
});

async function shutdown() {
  await questionKnowledgeWorker.stop();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
