import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { createLearningApiApp } from '../server/app.js';

function createMockLearningService() {
  return {
    async getClasses() {
      return [
        {
          id: 'class-newton-001',
          name: '高一 3 班',
          grade: '高一',
          subject: '物理',
          studentCount: 2
        }
      ];
    },
    async getStudents(filters = {}) {
      assert.equal(filters.className, '高一 3 班');
      return {
        classes: ['全部班级', '高一 3 班'],
        students: [
          {
            id: 'stu-liming',
            name: '李明',
            className: '高一 3 班',
            attendance: '已完成',
            practiceCount: 12,
            avgMastery: 72,
            lowestMastery: {
              knowledgeId: 'kp-resultant-force',
              name: '合外力计算',
              value: 48
            },
            weakPoints: ['合外力计算'],
            aiConversationSummary: '多次追问合外力与加速度方向。'
          }
        ],
        total: 1
      };
    },
    async getClassLearningSummary(classId) {
      assert.equal(classId, 'class-newton-001');
      return {
        classId,
        className: '高一 3 班',
        lessonName: '牛顿第二定律',
        totalStudents: 2,
        submitted: 2,
        avgAccuracy: 68,
        questionStats: [],
        weakPoints: [],
        aiAdvice: '复盘受力分析。'
      };
    },
    async getStudentProfile(studentId) {
      assert.equal(studentId, 'stu-liming');
      return {
        id: 'stu-liming',
        name: '李明',
        className: '高一 3 班',
        mastery: [{ knowledgeId: 'kp-newton-2', name: '牛顿第二定律', value: 86 }],
        weakPoints: ['合外力计算'],
        mistakeReasons: ['未先画受力图'],
        recommendedPractice: [],
        aiConversationSummary: '理解公式，受力分析需加强。'
      };
    },
    async getParentSummary(studentId) {
      assert.equal(studentId, 'stu-liming');
      return {
        studentId,
        studentName: '李明',
        weeklyStatus: '本周完成牛顿第二定律检测。',
        mastered: ['F=ma 基础代入'],
        needsAttention: ['受力分析完整性'],
        suggestion: '订正时先画受力图。'
      };
    }
  };
}

function listen(app) {
  return new Promise((resolve) => {
    const server = createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`
      });
    });
  });
}

async function getJson(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`);
  const payload = await response.json();
  assert.equal(response.status, 200, `${path} should return 200`);
  return payload;
}

const app = createLearningApiApp({ learningService: createMockLearningService() });
const { server, baseUrl } = await listen(app);

try {
  const classes = await getJson(baseUrl, '/api/v1/classes');
  assert.equal(classes.data[0].name, '高一 3 班');

  const students = await getJson(baseUrl, '/api/v1/students?className=%E9%AB%98%E4%B8%80%203%20%E7%8F%AD');
  assert.equal(students.data[0].id, 'stu-liming');
  assert.equal(students.pagination.total, 1);

  const classSummary = await getJson(baseUrl, '/api/v1/learning/classes/class-newton-001/summary');
  assert.equal(classSummary.data.lessonName, '牛顿第二定律');

  const profile = await getJson(baseUrl, '/api/v1/students/stu-liming/profile');
  assert.equal(profile.data.weakPoints[0], '合外力计算');

  const parentSummary = await getJson(baseUrl, '/api/v1/students/stu-liming/parent-summary');
  assert.equal(parentSummary.data.rank, undefined);
  assert.equal(parentSummary.data.classmates, undefined);

  console.log('backend learning API route contracts passed');
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
