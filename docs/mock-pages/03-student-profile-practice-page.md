# 学生画像与个性化出题页面开发文档

## 页面定位

在学生端根据学生答题结果和 AI 问答记录更新用户画像，并基于薄弱点生成个性化练习题。该页面是“因材施教”的核心演示点。

## 推荐入口

增强现有页面：

- 修改：`src/pages/StudentClassroomPage.vue`

建议在学生端右侧或底部增加：

```text
我的画像 | 推荐练习
```

也可以在学生提交答案后自动弹出“画像更新”卡片。

## 用户流程

```text
学生进入课堂
-> 完成二次函数题目
-> 答错对称轴
-> 页面显示 AI 错因分析
-> 学生画像更新
-> 系统推荐 3 道对称轴专项题
-> 学生点击“开始专项练习”
```

## 页面结构

建议学生端分为三块：

```text
左侧：题目与公式
中间：作答区域与反馈
右侧：AI 讲题 / 学生画像 / 推荐练习
```

如果当前学生端空间有限，可以用右侧抽屉：

```text
AI 讲题
我的画像
推荐练习
```

## Mock 数据

新增到 `src/data/teachingMockData.js`：

```js
export const studentPracticeState = {
  studentId: 'stu-liming',
  currentQuestion: {
    id: 'q-axis-001',
    title: '已知二次函数 y = x² - 4x + 3，求它的对称轴。',
    formula: 'y = x^2 - 4x + 3',
    options: [
      { key: 'A', text: 'x = -2' },
      { key: 'B', text: 'x = 2' },
      { key: 'C', text: 'x = 4' },
      { key: 'D', text: 'x = -4' }
    ],
    answer: 'B',
    knowledgePointId: 'kp-axis'
  },
  profileUpdateAfterWrongAnswer: {
    knowledgePointId: 'kp-axis',
    knowledgePointName: '二次函数对称轴',
    before: 62,
    after: 48,
    reason: '学生选择 x = -2，疑似忽略公式 x = -b / 2a 中的负号。'
  },
  recommendedPractice: [
    {
      id: 'q-axis-002',
      title: '求 y = x² + 6x + 5 的对称轴。',
      difficulty: '基础',
      target: '巩固 -b / 2a'
    },
    {
      id: 'q-axis-003',
      title: '求 y = 2x² - 8x + 1 的对称轴。',
      difficulty: '中等',
      target: '处理 a 不等于 1'
    },
    {
      id: 'q-vertex-001',
      title: '将 y = x² - 4x + 3 化为顶点式。',
      difficulty: '提升',
      target: '连接对称轴与顶点'
    }
  ]
};
```

## 伪接口

新增到 `src/data/mockApi.js`：

```js
import { studentPracticeState } from './teachingMockData';

function delay(ms = 900) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function submitStudentAnswer(payload) {
  await delay(800);
  const isCorrect = payload.selectedOption === studentPracticeState.currentQuestion.answer;
  return {
    isCorrect,
    correctAnswer: studentPracticeState.currentQuestion.answer,
    explanation: isCorrect
      ? '回答正确。你已经掌握了对称轴公式。'
      : '你选择了错误选项，可能忽略了 x = -b / 2a 中的负号。',
    profileUpdate: isCorrect ? null : studentPracticeState.profileUpdateAfterWrongAnswer,
    recommendedPractice: isCorrect ? [] : studentPracticeState.recommendedPractice
  };
}

export async function generatePersonalQuestions(studentId, knowledgePointId) {
  await delay(1000);
  return {
    studentId,
    knowledgePointId,
    questions: studentPracticeState.recommendedPractice
  };
}
```

## 组件拆分

建议新增：

- `src/components/student/StudentProfileCard.vue`
- `src/components/student/ProfileUpdateToast.vue`
- `src/components/student/RecommendedPracticeList.vue`
- `src/components/student/MathQuestionCard.vue`

## 交互状态

需要支持：

- 选择答案。
- 提交答案。
- 显示判题结果。
- 答错后显示画像更新动画。
- 展示推荐练习。
- 点击推荐题切换当前题目。

## 验收标准

- 学生答错后出现“二次函数对称轴”薄弱点更新。
- 推荐练习至少展示 3 道题。
- 学生画像中对应知识点掌握度从 62 降到 48。
- 页面无需真实后端即可完成整条流程。

