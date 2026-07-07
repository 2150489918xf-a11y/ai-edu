# 学生端 AI 讲题页面开发文档

## 页面定位

在学生端加入 AI 讲题能力。学生可以围绕当前题目提问，AI 用公式、步骤和错因解释回答。该页面用于演示学生端智能交互和数字教师效果。

## 推荐入口

增强现有页面：

- 修改：`src/pages/StudentClassroomPage.vue`

建议在题目弹窗或右侧面板增加：

```text
AI 讲题
```

如果需要更强展示效果，可在右侧面板上方加入“数字教师”区域：

```text
数字教师头像 / 讲解状态 / 字幕
```

## 用户流程

```text
学生答错题
-> 点击“问 AI”
-> 输入“为什么对称轴是 x=2？”
-> AI 显示思考中
-> AI 分步骤讲解
-> 公式高亮
-> 学生点击“出一道类似题”
```

## 页面结构

建议右侧面板：

```text
顶部：数字教师讲解状态
中部：AI 对话记录
下部：快捷问题按钮 + 输入框
底部：再讲一遍 / 出类似题 / 加入错题本
```

## 讲题内容示例

题目：

```text
已知二次函数 y = x² - 4x + 3，求它的对称轴和顶点坐标。
```

AI 讲解：

```text
第一步，识别一般式 y = ax² + bx + c。
这里 a = 1，b = -4，c = 3。

第二步，使用对称轴公式：
x = -b / 2a

第三步，代入 b = -4，a = 1：
x = -(-4) / (2 × 1) = 2

所以对称轴是 x = 2。
再把 x = 2 代回原式，可以得到 y = -1，
因此顶点坐标是 (2, -1)。
```

## Mock 数据

新增到 `src/data/teachingMockData.js`：

```js
export const studentAiTutorScripts = {
  questionId: 'q-axis-001',
  defaultMessages: [
    {
      role: 'ai',
      text: '这道题考查二次函数的对称轴。你可以问我公式来源、配方法步骤，或者让我再出一道类似题。'
    }
  ],
  replies: {
    '为什么对称轴是 x=2？': {
      text: '因为一般式 y = ax² + bx + c 的对称轴公式是 x = -b / 2a。本题 a = 1，b = -4，所以 x = -(-4)/(2×1) = 2。',
      steps: [
        '识别 a = 1，b = -4',
        '写出公式 x = -b / 2a',
        '代入得到 x = 2'
      ],
      formula: 'x = -b / 2a'
    },
    '再讲一遍': {
      text: '可以把它理解成抛物线左右对称的中线。配方后 y = (x - 2)² - 1，所以图像关于 x = 2 对称。',
      steps: ['配方 y = (x - 2)² - 1', '顶点横坐标是 2', '对称轴是 x = 2'],
      formula: 'y = (x - 2)^2 - 1'
    }
  }
};
```

## 伪接口

新增到 `src/data/mockApi.js`：

```js
import { studentAiTutorScripts, studentPracticeState } from './teachingMockData';

function delay(ms = 900) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function askStudentAi(payload) {
  await delay(900);
  const fallback = {
    text: '这道题可以先从公式入手。一般式 y = ax² + bx + c 的对称轴是 x = -b / 2a。',
    steps: ['识别 a 和 b', '代入公式', '检查符号'],
    formula: 'x = -b / 2a'
  };
  return studentAiTutorScripts.replies[payload.message] || fallback;
}

export async function addSimilarQuestion(questionId) {
  await delay(700);
  return studentPracticeState.recommendedPractice[0];
}
```

## 数字教师效果

本阶段只做前端写死演示，推荐两种实现方式：

1. CSS 动效头像：
   - 头像轻微浮动。
   - 讲解中显示声波动画。
   - 字幕同步显示当前 AI 回复。

2. 本地 GIF 或短视频：
   - 放在 `public/assets/`。
   - 点击讲解时播放。
   - 视频下方显示字幕。

优先使用 CSS 动效头像，避免素材依赖。

## 组件拆分

建议新增：

- `src/components/student/StudentAiTutorPanel.vue`
- `src/components/student/DigitalTeacherAvatar.vue`
- `src/components/student/AiTutorMessage.vue`
- `src/components/student/FormulaBlock.vue`

## 交互状态

需要支持：

- AI 默认欢迎语。
- 快捷问题。
- 输入自定义问题。
- AI 思考中。
- 分步骤讲解。
- 展示公式。
- “再讲一遍”。
- “出一道类似题”。

## 验收标准

- 学生端能打开 AI 讲题面板。
- 输入“为什么对称轴是 x=2？”后，AI 返回固定讲解。
- AI 回复中展示公式 `x = -b / 2a`。
- 点击“再讲一遍”能返回另一段解释。
- 点击“出一道类似题”能显示一条推荐题。

