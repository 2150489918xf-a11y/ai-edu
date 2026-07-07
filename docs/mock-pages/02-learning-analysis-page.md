# 学情分析页面开发文档

## 页面定位

在教师端展示两种学情分析：

1. 全班级题目学情分析。
2. 学生画像学情分析，并生成家长可见摘要。

该页面用于承接学生端答题、AI 问答、个性化练习后的结果，形成“教师看班级、学生和家长看个人”的闭环。

## 推荐入口

增强现有页面：

- 修改：`src/pages/AfterClassPage.vue`

建议增加顶部 Tab：

```text
班级学情 | 学生画像 | 家长摘要
```

## 用户流程

```text
教师进入学情分析
-> 默认看到班级题目统计
-> 切换到学生画像
-> 选择学生“李明”
-> 查看薄弱知识点、错因、推荐练习
-> 切换到家长摘要
-> 查看可同步给家长的低敏学习报告
```

## 页面结构

### 班级学情 Tab

展示：

- 班级平均正确率。
- 完成人数。
- 题目正确率排行。
- 错误选项分布。
- 班级薄弱知识点排行。
- AI 教学建议。

### 学生画像 Tab

展示：

- 学生基础信息。
- 知识点掌握雷达或进度条。
- 薄弱点列表。
- 错因诊断。
- 推荐练习。
- 最近 AI 问答摘要。

### 家长摘要 Tab

展示：

- 本周学习概况。
- 已掌握内容。
- 需要关注内容。
- 建议练习。
- 不展示班级排名、不展示其他学生信息。

## Mock 数据

新增到 `src/data/teachingMockData.js`：

```js
export const classLearningAnalysis = {
  classId: 'class-2026-math-1',
  className: '高一 3 班',
  lessonName: '二次函数图像与性质',
  totalStudents: 43,
  submitted: 41,
  avgAccuracy: 68,
  questionStats: [
    {
      id: 'q-axis-001',
      title: '求 y = x² - 4x + 3 的对称轴',
      accuracy: 56,
      weakPoint: '对称轴公式',
      optionDistribution: [
        { label: 'A', value: 8, note: '符号错误' },
        { label: 'B', value: 23, note: '正确' },
        { label: 'C', value: 7, note: '把 b 当成 4' },
        { label: 'D', value: 3, note: '计算错误' }
      ]
    }
  ],
  weakPoints: [
    { id: 'kp-axis', name: '对称轴公式', score: 82, accuracy: 56 },
    { id: 'kp-vertex', name: '顶点坐标', score: 74, accuracy: 61 },
    { id: 'kp-completing-square', name: '配方法', score: 69, accuracy: 64 }
  ],
  aiAdvice: '建议下节课先复盘对称轴公式中的负号，再用配方法解释顶点式来源。'
};

export const studentProfiles = [
  {
    id: 'stu-liming',
    name: '李明',
    className: '高一 3 班',
    mastery: [
      { knowledgeId: 'kp-basic', name: '二次函数概念', value: 86 },
      { knowledgeId: 'kp-axis', name: '对称轴公式', value: 48 },
      { knowledgeId: 'kp-vertex', name: '顶点坐标', value: 52 },
      { knowledgeId: 'kp-graph', name: '图像性质', value: 71 }
    ],
    weakPoints: ['对称轴公式符号', '顶点坐标计算', '配方法步骤'],
    mistakeReasons: ['忽略 -b 中的负号', '配方时常数项处理错误'],
    recommendedQuestions: ['q-axis-002', 'q-vertex-001', 'q-square-001'],
    aiConversationSummary: '学生多次追问为什么对称轴是 x=2，说明公式来源理解不牢。',
    parentSummary: {
      weeklyStatus: '本周能识别二次函数基本形式，但对对称轴和顶点坐标仍需练习。',
      mastered: ['二次函数一般式', '开口方向判断'],
      needsAttention: ['对称轴公式', '配方法'],
      suggestion: '建议每天完成 3 道对称轴与顶点坐标题，先看步骤再独立完成。'
    }
  }
];
```

## 伪接口

新增到 `src/data/mockApi.js`：

```js
import { classLearningAnalysis, studentProfiles } from './teachingMockData';

function delay(ms = 900) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function getClassLearningAnalysis(classId) {
  await delay(700);
  return { ...classLearningAnalysis, classId };
}

export async function getStudentProfile(studentId) {
  await delay(700);
  return studentProfiles.find((item) => item.id === studentId) || studentProfiles[0];
}

export async function getParentLearningSummary(studentId) {
  await delay(600);
  const profile = studentProfiles.find((item) => item.id === studentId) || studentProfiles[0];
  return profile.parentSummary;
}
```

## 组件拆分

建议新增：

- `src/components/analysis/ClassLearningDashboard.vue`
- `src/components/analysis/StudentProfileDashboard.vue`
- `src/components/analysis/ParentSummaryCard.vue`
- `src/components/analysis/WeakPointList.vue`

## 交互状态

需要支持：

- Tab 切换。
- 学生选择。
- 刷新分析。
- 加载状态。
- 点击薄弱知识点后展示支撑题目。
- 点击“生成推荐练习”后进入学生端或题库页。

## 验收标准

- 页面出现 `班级学情`、`学生画像`、`家长摘要` 三个 Tab。
- 班级学情能看到正确率、提交人数、薄弱点。
- 学生画像能看到“李明”的掌握度和错因。
- 家长摘要不展示班级排名和其他学生数据。
- 点击刷新时有加载状态。

