# 题库智能组卷页面开发文档

## 页面定位

在题库中增加“智能组卷”功能。老师可基于知识点、难度比例、题量生成一份写死试卷预览，用于演示题库从单题管理升级到教学测评组织能力。

## 推荐入口

增强现有页面：

- 修改：`src/pages/QuestionBankDetailPage.vue`

建议在题库详情页顶部按钮区增加：

```text
智能组卷
```

点击后可以：

- 打开右侧抽屉。
- 或进入新路由页面。

推荐新增页面：

- 新增：`src/pages/PaperGeneratePage.vue`
- 修改：`src/router.js`

路由建议：

```text
/question-banks/:bankId/paper
```

## 用户流程

```text
老师进入题库详情
-> 点击“智能组卷”
-> 选择试卷类型、题量、难度比例、知识点
-> 点击“生成试卷”
-> 页面模拟 AI 组卷中
-> 展示试卷预览、知识点覆盖率、难度分布
-> 点击“保存试卷”
```

## 页面结构

```text
左侧：组卷配置
中间：试卷题目预览
右侧：覆盖率与质量检查
```

配置项：

- 试卷类型：随堂测 / 单元测 / 课后练习。
- 题量：10 题。
- 难度比例：基础 40%、中等 40%、提升 20%。
- 知识点：二次函数图像、对称轴、顶点坐标、配方法。
- 优先策略：优先覆盖班级薄弱点。

## Mock 数据

新增到 `src/data/teachingMockData.js`：

```js
export const generatedPaper = {
  id: 'paper-quadratic-001',
  title: '二次函数图像与性质随堂测',
  type: '随堂测',
  totalQuestions: 10,
  estimatedMinutes: 20,
  difficultyDistribution: [
    { label: '基础', value: 4 },
    { label: '中等', value: 4 },
    { label: '提升', value: 2 }
  ],
  knowledgeCoverage: [
    { id: 'kp-basic', name: '二次函数概念', coverage: 100 },
    { id: 'kp-axis', name: '对称轴', coverage: 90 },
    { id: 'kp-vertex', name: '顶点坐标', coverage: 80 },
    { id: 'kp-graph', name: '图像性质', coverage: 70 }
  ],
  qualityChecks: [
    { label: '知识点覆盖完整', passed: true },
    { label: '难度比例符合设置', passed: true },
    { label: '题型分布合理', passed: true },
    { label: '包含薄弱点强化题', passed: true },
    { label: '无重复题目', passed: true }
  ],
  questions: [
    {
      id: 'paper-q1',
      type: '单选题',
      difficulty: '基础',
      knowledgePoint: '对称轴',
      title: '已知 y = x² - 4x + 3，函数图像的对称轴是？',
      answer: 'x = 2'
    }
  ]
};
```

## 伪接口

新增到 `src/data/mockApi.js`：

```js
import { generatedPaper } from './teachingMockData';

function delay(ms = 900) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function generateExamPaper(bankId, config) {
  await delay(1300);
  return {
    bankId,
    config,
    paper: generatedPaper
  };
}

export async function saveExamPaper(paperId) {
  await delay(600);
  return {
    paperId,
    status: 'saved',
    message: '试卷已保存到当前题库'
  };
}
```

## 组件拆分

建议新增：

- `src/components/paper/PaperConfigPanel.vue`
- `src/components/paper/PaperPreview.vue`
- `src/components/paper/PaperQualityReport.vue`

## 交互状态

需要支持：

- 未生成：展示配置表单和空预览。
- 生成中：展示“正在匹配知识点、平衡难度、检查重复题”。
- 已生成：展示完整试卷。
- 保存：展示 toast。

## 验收标准

- 题库详情页有“智能组卷”入口。
- 点击生成后有加载状态。
- 生成后能看到至少 10 题的试卷结构，数据可先只完整写 3 题，其余可用简短题干。
- 能看到知识点覆盖率和质量检查。
- 保存按钮有成功反馈。

