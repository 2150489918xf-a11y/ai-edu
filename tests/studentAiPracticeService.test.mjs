import assert from 'node:assert/strict';

import { createAiStudentPracticeService } from '../server/services/aiStudentPracticeService.js';
import { parseQuestionsFromAiText } from '../src/data/aiQuestionParser.js';

function createStreamResponse(chunks) {
  const encoder = new TextEncoder();
  return {
    ok: true,
    status: 200,
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      }
    }),
    async json() {
      return {};
    }
  };
}

function createPrismaStub() {
  const createdQuestions = [];
  const createdLinks = [];
  const session = {
    id: 'session-personal-ai',
    title: 'AI personalized practice',
    status: 'ai_personal_practice'
  };

  return {
    createdQuestions,
    createdLinks,
    student: {
      async findFirst() {
        return {
          id: 'stu-chenyu',
          name: 'Chen Yu',
          classId: 'class-1',
          class: { name: 'Class 1' }
        };
      }
    },
    course: {
      async findFirst() {
        return {
          id: 'course-physics',
          title: 'Newton Second Law',
          subject: 'Physics',
          grade: 'Grade 10',
          description: 'Forces and acceleration',
          teacher: { name: 'Teacher Li' }
        };
      }
    },
    learningProfile: {
      async findUnique() {
        return {
          weakPoints: [{ knowledge: 'F=ma', reason: 'unstable calculation' }],
          recommendedPractice: {
            difficulty: 'basic',
            questionTypes: ['choice'],
            knowledge: ['F=ma']
          },
          aiConversationSummary: 'Needs targeted practice on force and acceleration.'
        };
      }
    },
    question: {
      async create({ data }) {
        const item = { id: `question-${createdQuestions.length + 1}`, ...data };
        createdQuestions.push(item);
        return item;
      }
    },
    classroomSession: {
      async create({ data }) {
        return { ...session, ...data };
      }
    },
    classroomSessionQuestion: {
      async createMany({ data }) {
        createdLinks.push(...data);
        return { count: data.length };
      }
    },
    studentCourseEnrollment: {
      async upsert({ create }) {
        return { id: 'enrollment-ai', ...create };
      }
    },
    $transaction: async (callback) => callback({
      question: {
        create: async ({ data }) => {
          const item = { id: `question-${createdQuestions.length + 1}`, ...data };
          createdQuestions.push(item);
          return item;
        }
      },
      classroomSession: {
        create: async ({ data }) => ({ ...session, ...data })
      },
      classroomSessionQuestion: {
        createMany: async ({ data }) => {
          createdLinks.push(...data);
          return { count: data.length };
        }
      },
      studentCourseEnrollment: {
        upsert: async ({ create }) => ({ id: 'enrollment-ai', ...create })
      }
    })
  };
}

const text = [
  ':::question-start',
  '{',
  '  "type": "choice",',
  '  "difficulty": "basic",',
  '  "title": "If force doubles while mass stays unchanged, what happens to acceleration?",',
  '  "options": ["A. doubles", "B. halves"],',
  '  "answer": "A. doubles",',
  '  "analysis": "According to F=ma, acceleration is proportional to force.",',
  '  "knowledge": ["F=ma"],',
  '  "targetReason": "The student is unstable on force-acceleration relationships.",',
  '  "remediationTip": "Identify net force before substituting into F=ma."',
  '}',
  ':::question-end'
].join('\n');

const parsed = parseQuestionsFromAiText(text);
assert.equal(parsed.length, 1);
assert.equal(parsed[0].targetReason, 'The student is unstable on force-acceleration relationships.');
assert.equal(parsed[0].remediationTip, 'Identify net force before substituting into F=ma.');

let capturedRequest;
const prisma = createPrismaStub();
const service = createAiStudentPracticeService(prisma, {
  env: {
    DEEPSEEK_API_KEY: 'deepseek-key',
    DEEPSEEK_MODEL: 'deepseek-chat',
    DEEPSEEK_BASE_URL: 'https://deepseek.test'
  },
  fetchImpl: async (url, options) => {
    capturedRequest = { url, body: JSON.parse(options.body) };
    return createStreamResponse([
      `data: {"choices":[{"delta":{"content":${JSON.stringify(text.slice(0, 80))}}}]}\n\n`,
      `data: {"choices":[{"delta":{"content":${JSON.stringify(text.slice(80))}}}]}\n\n`,
      'data: [DONE]\n\n'
    ]);
  }
});

const events = [];
await service.streamGeneratePractice({
  studentId: 'stu-chenyu',
  courseId: 'course-physics',
  count: 1
}, {
  onDelta: (delta) => events.push({ type: 'delta', delta }),
  onQuestion: (question) => events.push({ type: 'question', question }),
  onTask: (task) => events.push({ type: 'task', task }),
  onDone: (meta) => events.push({ type: 'done', meta })
});

assert.equal(capturedRequest.url, 'https://deepseek.test/chat/completions');
assert.equal(capturedRequest.body.stream, true);
assert.ok(
  capturedRequest.body.messages.some((message) => message.content.includes('student learning profile')),
  'prompt should include student profile context'
);
assert.equal(events.find((event) => event.type === 'question').question.title, 'If force doubles while mass stays unchanged, what happens to acceleration?');
assert.equal(events.find((event) => event.type === 'task').task.taskId, 'session-personal-ai');
assert.equal(prisma.createdQuestions.length, 1);
assert.equal(prisma.createdQuestions[0].courseId, 'course-physics');
assert.deepEqual(prisma.createdQuestions[0].answer, { value: 'A. doubles' });
assert.deepEqual(prisma.createdQuestions[0].knowledge, ['F=ma']);
assert.equal(prisma.createdQuestions[0].stage, 'personalized-practice');
assert.equal(prisma.createdLinks.length, 1);
assert.equal(prisma.createdLinks[0].sessionId, 'session-personal-ai');
assert.equal(prisma.createdLinks[0].questionId, 'question-1');
assert.equal(events.at(-1).type, 'done');

console.log('student AI practice service contracts passed');
