import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { createLearningApiApp } from '../server/app.js';

function createMockLearningService() {
  return {
    async getClasses() {
      return [];
    },
    async getStudents() {
      return { classes: [], students: [], total: 0 };
    }
  };
}

function createMockStudentAnalysisService() {
  return {
    async getOverview(studentId) {
      assert.equal(studentId, 'stu-1');
      return {
        student: { id: 'stu-1', name: '陈宇', className: '高一 3 班' },
        summary: {
          courseCount: 1,
          answeredCount: 4,
          correctCount: 2,
          accuracy: 50,
          weakPoints: [{ courseId: 'course-newton-2', courseTitle: '牛顿第二定律', name: '受力分析', accuracy: 33 }]
        },
        courses: [
          {
            course: { id: 'course-newton-2', title: '牛顿第二定律', subject: '物理', grade: '高一' },
            summary: { totalQuestions: 6, answeredCount: 4, correctCount: 2, accuracy: 50 },
            weakPoints: [{ name: '受力分析', accuracy: 33 }],
            profile: null
          }
        ]
      };
    },
    async getCourseAnalysis(studentId, courseId) {
      assert.equal(studentId, 'stu-1');
      assert.equal(courseId, 'course-newton-2');
      return {
        student: { id: 'stu-1', name: '陈宇' },
        course: { id: courseId, title: '牛顿第二定律' },
        summary: { totalQuestions: 6, answeredCount: 4, correctCount: 2, accuracy: 50 },
        knowledgeStats: [{ name: '受力分析', answered: 3, correct: 1, wrong: 2, accuracy: 33 }],
        wrongQuestions: [{ id: 'q1', title: '合力计算', studentAnswer: 'A', correctAnswer: 'C', knowledge: ['受力分析'] }],
        profile: null
      };
    },
    async generateCourseProfile(studentId, courseId) {
      assert.equal(studentId, 'stu-1');
      assert.equal(courseId, 'course-newton-2');
      return {
        student: { id: 'stu-1', name: '陈宇' },
        course: { id: courseId, title: '牛顿第二定律' },
        summary: { totalQuestions: 6, answeredCount: 4, correctCount: 2, accuracy: 50 },
        knowledgeStats: [],
        wrongQuestions: [],
        profile: {
          aiConversationSummary: '受力分析不稳定，需要加强方向判断。',
          weakPoints: [{ knowledge: '受力分析', reason: '错题集中' }],
          recommendedPractice: { difficulty: '基础到中等', questionTypes: ['choice', 'blank'], knowledge: ['受力分析'] }
        }
      };
    }
  };
}

function listen(app) {
  return new Promise((resolve) => {
    const server = createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  return { response, payload: await response.json() };
}

const app = createLearningApiApp({
  learningService: createMockLearningService(),
  studentAnalysisService: createMockStudentAnalysisService()
});
const { server, baseUrl } = await listen(app);

try {
  const overview = await requestJson(baseUrl, '/api/v1/student/analysis?studentId=stu-1');
  assert.equal(overview.response.status, 200);
  assert.equal(overview.payload.data.summary.accuracy, 50);
  assert.equal(overview.payload.data.courses[0].course.title, '牛顿第二定律');

  const detail = await requestJson(baseUrl, '/api/v1/student/analysis/courses/course-newton-2?studentId=stu-1');
  assert.equal(detail.response.status, 200);
  assert.equal(detail.payload.data.knowledgeStats[0].name, '受力分析');

  const generated = await requestJson(baseUrl, '/api/v1/student/analysis/courses/course-newton-2/generate', {
    method: 'POST',
    body: JSON.stringify({ studentId: 'stu-1' })
  });
  assert.equal(generated.response.status, 200);
  assert.equal(generated.payload.data.profile.recommendedPractice.difficulty, '基础到中等');

  console.log('student analysis API contracts passed');
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
