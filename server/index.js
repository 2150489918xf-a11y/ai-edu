import { createServer } from 'node:http';

import { createLearningApiApp } from './app.js';
import { loadEnvFile } from './env.js';
import { createLearningService } from './learningService.js';
import { createClassService } from './services/classService.js';
import { createCourseService } from './services/courseService.js';
import { createKnowledgeService } from './services/knowledgeService.js';
import { createAiMindMapService } from './services/aiMindMapService.js';
import { createAiQuestionService } from './services/aiQuestionService.js';
import { createAiLessonPlanService } from './services/aiLessonPlanService.js';
import { createQuestionBankService } from './services/questionBankService.js';
import { createStudentService } from './services/studentService.js';

loadEnvFile();

const { PrismaClient } = await import('@prisma/client');
const port = Number(process.env.SERVER_PORT || 3001);
const prisma = new PrismaClient();
const learningService = createLearningService(prisma);
const courseService = createCourseService(prisma);
const classService = createClassService(prisma);
const studentService = createStudentService(prisma);
const knowledgeService = createKnowledgeService(prisma);
const questionBankService = createQuestionBankService(prisma);
const aiMindMapService = createAiMindMapService();
const aiQuestionService = createAiQuestionService();
const aiLessonPlanService = createAiLessonPlanService();
const app = createLearningApiApp({
  learningService,
  courseService,
  classService,
  studentService,
  knowledgeService,
  questionBankService,
  aiMindMapService,
  aiQuestionService,
  aiLessonPlanService
});
const server = createServer(app);

server.listen(port, '0.0.0.0', () => {
  console.log(`EduAI API server listening on http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
