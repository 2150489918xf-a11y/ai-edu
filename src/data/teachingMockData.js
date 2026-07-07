export const knowledgeBaseCategories = [
  { id: 'all', name: '全部资料', count: 24, icon: 'folder_open' },
  { id: 'math-g10', name: '高一数学', count: 9, icon: 'functions' },
  { id: 'physics-g10', name: '高一物理', count: 6, icon: 'science' },
  { id: 'teaching-reference', name: '教学参考', count: 5, icon: 'menu_book' },
  { id: 'learning-report', name: '学情报告', count: 4, icon: 'analytics' }
];

export const knowledgeMaterials = [
  {
    id: 'mat-quadratic-textbook',
    title: '二次函数图像与性质教材节选',
    type: 'PDF',
    subject: '数学',
    grade: '高一',
    categoryId: 'math-g10',
    size: '2.8 MB',
    pages: 18,
    uploadedAt: '今天 09:24',
    status: 'parsed',
    parseLabel: '已解析',
    source: '教材资料',
    chunks: 36,
    evidenceCount: 42,
    vectorIndexed: true,
    bm25Indexed: true,
    teacherPinned: true,
    usedByCourses: ['二次函数图像与性质'],
    tags: ['二次函数', '图像性质', '对称轴', '顶点坐标'],
    knowledgePoints: [
      { id: 'kp-quadratic-basic', name: '二次函数一般式' },
      { id: 'kp-axis', name: '对称轴' },
      { id: 'kp-vertex', name: '顶点坐标' },
      { id: 'kp-graph', name: '图像性质' },
      { id: 'kp-square', name: '配方法' }
    ],
    retrievalSummary: {
      bm25: 0.84,
      vector: 0.91,
      knowledgeMatch: 0.96,
      teachingWeight: 0.88
    },
    evidenceTypes: ['material_chunk', 'teacher_note'],
    availableActions: ['生成思维导图', '生成课程大纲', '生成 PPT', '生成题目']
  },
  {
    id: 'mat-quadratic-mistakes',
    title: '高一二次函数错题样本与错因分析',
    type: 'DOC',
    subject: '数学',
    grade: '高一',
    categoryId: 'learning-report',
    size: '860 KB',
    pages: 7,
    uploadedAt: '昨天 16:10',
    status: 'parsed',
    parseLabel: '已解析',
    source: '学情报告',
    chunks: 18,
    evidenceCount: 25,
    vectorIndexed: true,
    bm25Indexed: true,
    teacherPinned: false,
    usedByCourses: ['二次函数图像与性质'],
    tags: ['错因分析', '对称轴', '配方法'],
    knowledgePoints: [
      { id: 'kp-axis', name: '对称轴' },
      { id: 'kp-square', name: '配方法' }
    ],
    retrievalSummary: {
      bm25: 0.72,
      vector: 0.86,
      knowledgeMatch: 0.91,
      teachingWeight: 0.94
    },
    evidenceTypes: ['learning_report', 'wrong_reason', 'weak_point'],
    availableActions: ['生成补救题', '生成学情复盘', '生成讲解页']
  },
  {
    id: 'mat-quadratic-courseware',
    title: '二次函数单元教学设计初稿',
    type: 'PPT',
    subject: '数学',
    grade: '高一',
    categoryId: 'teaching-reference',
    size: '6.4 MB',
    pages: 24,
    uploadedAt: '刚刚',
    status: 'parsing',
    parseLabel: '解析中',
    source: '老师上传',
    chunks: 0,
    evidenceCount: 0,
    vectorIndexed: false,
    bm25Indexed: false,
    teacherPinned: false,
    usedByCourses: [],
    tags: ['待解析'],
    knowledgePoints: [],
    retrievalSummary: null,
    evidenceTypes: [],
    availableActions: []
  },
  {
    id: 'mat-newton-reference',
    title: '牛顿第二定律实验探究参考资料',
    type: 'PDF',
    subject: '物理',
    grade: '高一',
    categoryId: 'physics-g10',
    size: '3.1 MB',
    pages: 22,
    uploadedAt: '06/30 13:40',
    status: 'parsed',
    parseLabel: '已解析',
    source: '教学参考',
    chunks: 31,
    evidenceCount: 37,
    vectorIndexed: true,
    bm25Indexed: true,
    teacherPinned: false,
    usedByCourses: ['牛顿第二定律'],
    tags: ['F=ma', '受力分析', '实验探究'],
    knowledgePoints: [
      { id: 'kp-force', name: '合外力' },
      { id: 'kp-acceleration', name: '加速度' },
      { id: 'kp-newton-2', name: '牛顿第二定律' }
    ],
    retrievalSummary: {
      bm25: 0.79,
      vector: 0.87,
      knowledgeMatch: 0.89,
      teachingWeight: 0.78
    },
    evidenceTypes: ['material_chunk', 'ppt_slide'],
    availableActions: ['生成课程大纲', '生成 PPT', '生成题目']
  },
  {
    id: 'stu-chenyu',
    name: '陈雨',
    className: '高一 3 班',
    attendance: '5/5',
    practiceCount: 19,
    mastery: [
      { knowledgeId: 'kp-newton-2', name: '牛顿第二定律', value: 88 },
      { knowledgeId: 'kp-resultant-force', name: '合外力计算', value: 74 },
      { knowledgeId: 'kp-acceleration-direction', name: '加速度方向', value: 69 }
    ],
    weakPoints: ['多力场景方向表述', '实验图像解释'],
    mistakeReasons: ['能算出数值，但解释变量关系时语言不够完整'],
    recommendedPractice: [
      { id: 'rec-newton-4', title: '根据 a-F 图像说明质量不变时加速度与合外力的关系', difficulty: '中等', target: '实验图像解释' },
      { id: 'rec-newton-5', title: '分析斜面上物体的受力，并判断加速度方向', difficulty: '提升', target: '多力场景受力表达' },
      { id: 'rec-newton-6', title: '比较不同质量小车在相同拉力下的运动变化', difficulty: '提升', target: '质量与加速度关系' }
    ],
    aiConversationSummary: '学生计算较稳，但在解释实验图像斜率含义时需要补充物理语言训练。',
    parentSummary: {
      weeklyStatus: '本周基础计算和课堂参与较好，建议继续练习用完整语言解释实验结论。',
      mastered: ['F=ma 基础计算', '合外力初步判断'],
      needsAttention: ['实验图像解释', '多力场景方向描述'],
      suggestion: '建议做题后补写一句物理解释，例如“合外力越大，加速度越大”。'
    }
  },
  {
    id: 'stu-wanghao',
    name: '王浩',
    className: '高一 3 班',
    attendance: '4/5',
    practiceCount: 13,
    mastery: [
      { knowledgeId: 'kp-newton-2', name: '牛顿第二定律', value: 76 },
      { knowledgeId: 'kp-resultant-force', name: '合外力计算', value: 49 },
      { knowledgeId: 'kp-acceleration-direction', name: '加速度方向', value: 52 }
    ],
    weakPoints: ['受力图遗漏', '合外力符号', '单位换算'],
    mistakeReasons: ['漏画支持力或摩擦力', '没有先规定正方向', '把 cm/s² 当成 m/s² 直接代入'],
    recommendedPractice: [
      { id: 'rec-newton-7', title: '根据受力图列出合外力表达式', difficulty: '基础', target: '补齐受力图' },
      { id: 'rec-newton-8', title: '规定正方向后计算加速度', difficulty: '中等', target: '合外力符号' },
      { id: 'rec-newton-9', title: '含单位换算的 F=ma 计算', difficulty: '基础', target: '单位统一' }
    ],
    aiConversationSummary: '学生在 AI 追问下能修正计算，但需要先画图、再列式的固定步骤。',
    parentSummary: {
      weeklyStatus: '本周课堂参与正常，含摩擦力和单位换算题仍需要巩固。',
      mastered: ['F=ma 基础含义', '简单代入计算'],
      needsAttention: ['受力图完整性', '合外力符号', '单位换算'],
      suggestion: '建议订正时用三步法：画图、求合力、代入公式。'
    }
  },
  {
    id: 'stu-zhaonan',
    name: '赵楠',
    className: '高一 4 班',
    attendance: '5/5',
    practiceCount: 17,
    mastery: [
      { knowledgeId: 'kp-newton-2', name: '牛顿第二定律', value: 83 },
      { knowledgeId: 'kp-resultant-force', name: '合外力计算', value: 71 },
      { knowledgeId: 'kp-acceleration-direction', name: '加速度方向', value: 62 }
    ],
    weakPoints: ['加速度方向表达', '实验图像斜率'],
    mistakeReasons: ['能判断方向但解释不完整', '没有把图像斜率和质量联系起来'],
    recommendedPractice: [
      { id: 'rec-newton-10', title: '速度方向和加速度方向辨析', difficulty: '中等', target: '方向表达' },
      { id: 'rec-newton-11', title: 'a-F 图像斜率含义分析', difficulty: '提升', target: '实验图像解释' },
      { id: 'rec-newton-12', title: '同一物体不同合力下的加速度比较', difficulty: '基础', target: '比例关系' }
    ],
    aiConversationSummary: '学生能完成多数计算，后续应强化用物理语言解释图像和方向。',
    parentSummary: {
      weeklyStatus: '本周基础计算较稳定，需要继续提升方向表达和实验图像理解。',
      mastered: ['基础计算', '合外力初步判断'],
      needsAttention: ['加速度方向表达', '实验图像斜率'],
      suggestion: '建议每道图像题后写一句“斜率代表什么”。'
    }
  },
  {
    id: 'stu-chenyu',
    name: '陈雨',
    className: '高一 3 班',
    attendance: '5/5',
    practiceCount: 19,
    mastery: [
      { knowledgeId: 'kp-newton-2', name: '牛顿第二定律', value: 82 },
      { knowledgeId: 'kp-resultant-force', name: '合外力计算', value: 74 },
      { knowledgeId: 'kp-acceleration-direction', name: '加速度方向', value: 69 }
    ],
    weakPoints: ['多力场景方向表述', '实验图像解释'],
    mistakeReasons: ['能算出数值，但解释变量关系时语言不够完整'],
    recommendedPractice: [
      { id: 'rec-newton-4', title: '根据 a-F 图像说明加速度与合外力关系', difficulty: '理解', target: '实验图像解释' },
      { id: 'rec-newton-5', title: '斜面上物体受力与加速度方向判断', difficulty: '提升', target: '多力场景受力表达' },
      { id: 'rec-newton-6', title: '不同质量小车在相同拉力下的加速度比较', difficulty: '提升', target: '质量与加速度关系' }
    ],
    aiConversationSummary: '陈雨计算较稳，但解释实验图像斜率含义时需要补充物理语言训练。',
    parentSummary: {
      weeklyStatus: '本周基础计算和课堂参与较好，建议继续练习用完整语言解释实验结论。',
      mastered: ['F=ma 基础计算', '合外力初步判断'],
      needsAttention: ['实验图像解释', '多力场景方向描述'],
      suggestion: '建议做题后补写一句物理解释，例如“合外力越大，加速度越大”。'
    }
  }
];

export const quadraticMindMap = {
  id: 'mindmap-quadratic',
  title: '二次函数图像与性质',
  courseId: 'math-quadratic',
  generatedAt: '刚刚',
  summary: '围绕二次函数的一般式、图像性质、顶点与对称轴、配方法和易错点生成的备课思维导图。',
  markdown: `# 二次函数图像与性质

## 一般式 y=ax²+bx+c
### 与坐标轴交点
### 系数 a、b、c 的影响

## 抛物线图像
### 开口方向
### 对称轴 x=-b/2a

## 顶点坐标
### 顶点式与最值
### 配方法

## 增减性与最值
### 结合对称轴分区间讨论
### 判断最大值或最小值

## 易错点
### 对称轴符号错误
### 配方漏常数

## 教学活动设计
### 动态图像观察参数变化
### 课后生成针对性练习`,
  stats: [
    { label: '核心节点', value: '12' },
    { label: '引用资料', value: '3' },
    { label: '薄弱点', value: '2' }
  ],
  sources: [
    { id: 'src-1', title: '二次函数图像与性质教材节选', type: '教材资料', status: '已引用', evidence: 42 },
    { id: 'src-2', title: '高一二次函数错题样本与错因分析', type: '学情报告', status: '已引用', evidence: 25 },
    { id: 'src-3', title: '二次函数单元教学设计初稿', type: '教师资料', status: '待解析', evidence: 0 }
  ],
  nodes: [
    {
      id: 'root',
      label: '二次函数图像与性质',
      type: 'root',
      x: 50,
      y: 48,
      detail: '本节课围绕二次函数的表达式、图像、顶点、对称轴和性质展开，形成后续 PPT、题目和讲解脚本的共同结构。',
      evidence: ['教材节选', '课程大纲']
    },
    {
      id: 'definition',
      label: '一般式 y=ax²+bx+c',
      type: 'concept',
      x: 22,
      y: 22,
      detail: '识别二次项系数 a、一次项系数 b 和常数项 c，强调 a 不等于 0。',
      evidence: ['教材节选']
    },
    {
      id: 'graph',
      label: '抛物线图像',
      type: 'concept',
      x: 18,
      y: 52,
      detail: '通过开口方向、顶点位置和与坐标轴交点理解二次函数图像。',
      evidence: ['教材图示', '历史课件']
    },
    {
      id: 'axis',
      label: '对称轴 x=-b/2a',
      type: 'formula',
      x: 31,
      y: 75,
      detail: '对称轴是图像性质和最值问题的关键线索。',
      evidence: ['教材节选', '错题样本']
    },
    {
      id: 'vertex',
      label: '顶点坐标',
      type: 'formula',
      x: 50,
      y: 78,
      detail: '顶点可由公式或配方法得到，是判断最值和图像平移的核心。',
      evidence: ['教材节选']
    },
    {
      id: 'opening',
      label: '开口方向',
      type: 'property',
      x: 72,
      y: 72,
      detail: 'a>0 开口向上，a<0 开口向下，a 的绝对值影响开口大小。',
      evidence: ['教材图示']
    },
    {
      id: 'monotonic',
      label: '增减性与最值',
      type: 'property',
      x: 82,
      y: 45,
      detail: '结合对称轴分左右区间讨论单调性，并判断最大值或最小值。',
      evidence: ['教材节选', '课堂题']
    },
    {
      id: 'square',
      label: '配方法',
      type: 'method',
      x: 69,
      y: 20,
      detail: '把一般式转化为顶点式，帮助学生理解顶点与图像平移。',
      evidence: ['教师备注', '错题样本']
    },
    {
      id: 'intersection',
      label: '与坐标轴交点',
      type: 'property',
      x: 43,
      y: 16,
      detail: '与 x 轴交点对应方程根，与 y 轴交点对应 c。',
      evidence: ['教材节选']
    },
    {
      id: 'mistake-axis',
      label: '易错：对称轴符号',
      type: 'weak-point',
      x: 17,
      y: 83,
      detail: '学生常把 -b/2a 写成 b/2a，需要通过代入系数和图像位置校验。',
      evidence: ['高一错题样本']
    },
    {
      id: 'mistake-square',
      label: '易错：配方漏常数',
      type: 'weak-point',
      x: 86,
      y: 82,
      detail: '配方法中加减同一个数时常遗漏括号外常数变化。',
      evidence: ['错因分析']
    },
    {
      id: 'teaching',
      label: '教学活动设计',
      type: 'activity',
      x: 50,
      y: 34,
      detail: '建议先用动态图像观察 a、b、c 改变，再回到公式推导。',
      evidence: ['教学设计初稿']
    }
  ],
  links: [
    ['root', 'definition'],
    ['root', 'graph'],
    ['root', 'axis'],
    ['root', 'vertex'],
    ['root', 'opening'],
    ['root', 'monotonic'],
    ['root', 'square'],
    ['root', 'intersection'],
    ['axis', 'mistake-axis'],
    ['square', 'mistake-square'],
    ['graph', 'teaching'],
    ['definition', 'intersection'],
    ['vertex', 'monotonic'],
    ['opening', 'monotonic']
  ]
};

export const knowledgeEvidenceLabels = {
  material_chunk: '资料片段',
  ppt_slide: '历史课件页',
  question_item: '题库题目',
  student_response: '学生作答',
  question_stat: '题目统计',
  weak_point: '薄弱知识点',
  wrong_reason: '错因聚类',
  learning_report: '学情报告',
  teacher_note: '老师备注'
};

export const newtonClassLearningAnalysis = {
  classId: 'class-2026-physics-1',
  className: '高一 3 班',
  lessonName: '牛顿第二定律',
  totalStudents: 43,
  submitted: 40,
  avgAccuracy: 68,
  updatedAt: '刚刚',
  questionStats: [
    {
      questionId: 'newton-q1',
      title: 'F=ma 基础计算',
      accuracy: 76,
      avgTime: '42 秒',
      optionDistribution: [
        { label: 'A', value: 5, percent: 12, note: '把质量误作分母两次' },
        { label: 'B', value: 4, percent: 9, note: '计算粗心' },
        { label: 'C', value: 30, percent: 76, note: '正确' },
        { label: 'D', value: 1, percent: 3, note: '误用 F×m' }
      ]
    },
    {
      questionId: 'newton-q3',
      title: '含摩擦力的合力计算',
      accuracy: 54,
      avgTime: '96 秒',
      optionDistribution: [
        { label: '写出受力分析', value: 32, percent: 79, note: '已掌握' },
        { label: '求合力', value: 22, percent: 54, note: '薄弱步骤' },
        { label: '代入公式', value: 27, percent: 67, note: '基本掌握' },
        { label: '说明方向', value: 16, percent: 41, note: '表达不完整' }
      ]
    }
  ],
  weakPoints: [
    { id: 'kp-resultant-force', name: '合外力计算', mastery: 54, accuracy: 54, impact: '18 人在含摩擦力情境中漏减反向力', advice: '强化摩擦力、拉力方向和合力符号。' },
    { id: 'kp-acceleration-direction', name: '加速度方向', mastery: 58, accuracy: 58, impact: '15 人把速度方向当作加速度方向', advice: '用运动方向与受力方向不同的情境辨析。' },
    { id: 'kp-newton-2', name: '牛顿第二定律应用', mastery: 66, accuracy: 66, impact: '基础代入较稳，情境建模仍需训练', advice: '增加从情境抽象到 F=ma 的步骤训练。' }
  ],
  aiAdvice: '建议下一次随堂测优先覆盖合外力计算和加速度方向，保持基础计算题占比，加入 2 道提升题检验受力分析迁移。'
};

export const newtonStudentProfiles = [
  {
    id: 'stu-liming',
    name: '李明',
    className: '高一 3 班',
    attendance: '5/5',
    practiceCount: 16,
    mastery: [
      { knowledgeId: 'kp-newton-2', name: '牛顿第二定律', value: 68 },
      { knowledgeId: 'kp-resultant-force', name: '合外力计算', value: 54 },
      { knowledgeId: 'kp-acceleration-direction', name: '加速度方向', value: 57 }
    ],
    weakPoints: ['漏减摩擦力', '加速度方向表达不完整', '单位换算不稳定'],
    mistakeReasons: ['受力图没有标出反向摩擦力', '把速度方向当作加速度方向', '代入公式前没有统一单位'],
    recommendedPractice: [
      { id: 'rec-newton-1', title: '水平面拉力与摩擦力合力计算', difficulty: '基础', target: '区分拉力与合外力' },
      { id: 'rec-newton-2', title: '速度向右但合力向左的运动判断', difficulty: '理解', target: '辨析速度方向和加速度方向' },
      { id: 'rec-newton-3', title: '斜面情境下的 F=ma 建模', difficulty: '提升', target: '迁移受力分析步骤' }
    ],
    aiConversationSummary: 'AI 讲题后，李明能说出 F=ma 的代入步骤，但仍需要在画受力图时主动检查摩擦力方向。',
    parentSummary: {
      weeklyStatus: '本周已完成牛顿第二定律课堂检测和订正，基础公式掌握稳定，含摩擦力的合力计算仍需巩固。',
      mastered: ['F=ma 基础代入', '合力与加速度成正比', '基础单位换算'],
      needsAttention: ['受力分析完整性', '摩擦力方向判断', '加速度方向表达'],
      suggestion: '建议每天完成 2 道合力计算题，订正时先画受力图，再用一句话说明加速度方向。'
    }
  },
  {
    id: 'stu-chenyu',
    name: '陈雨',
    className: '高一 3 班',
    attendance: '5/5',
    practiceCount: 19,
    mastery: [
      { knowledgeId: 'kp-newton-2', name: '牛顿第二定律', value: 88 },
      { knowledgeId: 'kp-resultant-force', name: '合外力计算', value: 74 },
      { knowledgeId: 'kp-acceleration-direction', name: '加速度方向', value: 69 }
    ],
    weakPoints: ['多力场景方向表述', '实验图像解释'],
    mistakeReasons: ['能算出数值，但解释变量关系时语言不够完整'],
    recommendedPractice: [
      { id: 'rec-newton-4', title: '根据 a-F 图像说明质量不变时加速度与合外力的关系', difficulty: '中等', target: '实验图像解释' },
      { id: 'rec-newton-5', title: '分析斜面上物体的受力，并判断加速度方向', difficulty: '提升', target: '多力场景受力表达' },
      { id: 'rec-newton-6', title: '比较不同质量小车在相同拉力下的运动变化', difficulty: '提升', target: '质量与加速度关系' }
    ],
    aiConversationSummary: '学生计算较稳，但在解释实验图像斜率含义时需要补充物理语言训练。',
    parentSummary: {
      weeklyStatus: '本周基础计算和课堂参与较好，建议继续练习用完整语言解释实验结论。',
      mastered: ['F=ma 基础计算', '合外力初步判断'],
      needsAttention: ['实验图像解释', '多力场景方向描述'],
      suggestion: '建议做题后补写一句物理解释，例如“合外力越大，加速度越大”。'
    }
  },
  {
    id: 'stu-wanghao',
    name: '王浩',
    className: '高一 3 班',
    attendance: '4/5',
    practiceCount: 13,
    mastery: [
      { knowledgeId: 'kp-newton-2', name: '牛顿第二定律', value: 76 },
      { knowledgeId: 'kp-resultant-force', name: '合外力计算', value: 49 },
      { knowledgeId: 'kp-acceleration-direction', name: '加速度方向', value: 52 }
    ],
    weakPoints: ['受力图遗漏', '合外力符号', '单位换算'],
    mistakeReasons: ['漏画支持力或摩擦力', '没有先规定正方向', '把 cm/s² 当成 m/s² 直接代入'],
    recommendedPractice: [
      { id: 'rec-newton-7', title: '根据受力图列出合外力表达式', difficulty: '基础', target: '补齐受力图' },
      { id: 'rec-newton-8', title: '规定正方向后计算加速度', difficulty: '中等', target: '合外力符号' },
      { id: 'rec-newton-9', title: '含单位换算的 F=ma 计算', difficulty: '基础', target: '单位统一' }
    ],
    aiConversationSummary: '学生在 AI 追问下能修正计算，但需要先画图、再列式的固定步骤。',
    parentSummary: {
      weeklyStatus: '本周课堂参与正常，含摩擦力和单位换算题仍需要巩固。',
      mastered: ['F=ma 基础含义', '简单代入计算'],
      needsAttention: ['受力图完整性', '合外力符号', '单位换算'],
      suggestion: '建议订正时用三步法：画图、求合力、代入公式。'
    }
  },
  {
    id: 'stu-zhaonan',
    name: '赵楠',
    className: '高一 4 班',
    attendance: '5/5',
    practiceCount: 17,
    mastery: [
      { knowledgeId: 'kp-newton-2', name: '牛顿第二定律', value: 83 },
      { knowledgeId: 'kp-resultant-force', name: '合外力计算', value: 71 },
      { knowledgeId: 'kp-acceleration-direction', name: '加速度方向', value: 62 }
    ],
    weakPoints: ['加速度方向表达', '实验图像斜率'],
    mistakeReasons: ['能判断方向但解释不完整', '没有把图像斜率和质量联系起来'],
    recommendedPractice: [
      { id: 'rec-newton-10', title: '速度方向和加速度方向辨析', difficulty: '中等', target: '方向表达' },
      { id: 'rec-newton-11', title: 'a-F 图像斜率含义分析', difficulty: '提升', target: '实验图像解释' },
      { id: 'rec-newton-12', title: '同一物体不同合力下的加速度比较', difficulty: '基础', target: '比例关系' }
    ],
    aiConversationSummary: '学生能完成多数计算，后续应强化用物理语言解释图像和方向。',
    parentSummary: {
      weeklyStatus: '本周基础计算较稳定，需要继续提升方向表达和实验图像理解。',
      mastered: ['基础计算', '合外力初步判断'],
      needsAttention: ['加速度方向表达', '实验图像斜率'],
      suggestion: '建议每道图像题后写一句“斜率代表什么”。'
    }
  }
];

export const newtonParentLearningSummary = {
  weeklyStatus: '本周已完成牛顿第二定律课堂检测和订正，基础公式掌握稳定，含摩擦力的合力计算仍需巩固。',
  mastered: ['F=ma 基础代入', '合力与加速度成正比', '基础单位换算'],
  needsAttention: ['受力分析完整性', '摩擦力方向判断', '加速度方向表达'],
  nextActions: ['每天完成 2 道合力计算题', '订正时先画受力图', '用一句话说明加速度方向'],
  suggestion: '建议每天完成 2 道合力计算题，订正时先画受力图，再用一句话说明加速度方向。'
};

export const generatedPaper = {
  id: 'paper-newton-001',
  title: '牛顿第二定律随堂测',
  type: '随堂测',
  totalQuestions: 10,
  estimatedMinutes: 20,
  difficultyDistribution: [
    { label: '基础', value: 4 },
    { label: '理解', value: 4 },
    { label: '提升', value: 2 }
  ],
  knowledgeCoverage: [
    { id: 'kp-newton-2', name: '牛顿第二定律', coverage: 96 },
    { id: 'kp-resultant-force', name: '合外力', coverage: 92 },
    { id: 'kp-acceleration-direction', name: '加速度方向', coverage: 88 },
    { id: 'kp-force-analysis', name: '受力分析', coverage: 84 }
  ],
  qualityChecks: [
    { label: '知识点覆盖完整', passed: true },
    { label: '难度比例符合设置', passed: true },
    { label: '题型分布合理', passed: true },
    { label: '包含班级薄弱点强化题', passed: true },
    { label: '无重复题目', passed: true }
  ],
  questions: [
    {
      id: 'paper-newton-q1',
      type: '单选题',
      difficulty: '基础',
      knowledgePoint: '牛顿第二定律',
      title: '质量为 2 kg 的小车受到 6 N 水平合外力，小车的加速度大小是多少？',
      options: ['A. 3 m/s²', 'B. 4 m/s²', 'C. 6 m/s²', 'D. 12 m/s²'],
      answer: '3 m/s²',
      analysis: '由 F=ma 得 a=F/m=6/2=3 m/s²。'
    },
    {
      id: 'paper-newton-q2',
      type: '单选题',
      difficulty: '基础',
      knowledgePoint: '加速度方向',
      title: '物体所受合外力向左，则物体加速度方向一定是？',
      options: ['A. 向左', 'B. 向右', 'C. 与速度方向相同', 'D. 无法判断'],
      answer: '向左',
      analysis: '加速度方向始终与合外力方向相同。'
    },
    {
      id: 'paper-newton-q3',
      type: '计算题',
      difficulty: '理解',
      knowledgePoint: '合外力',
      title: '质量 1 kg 的木块受到 5 N 向右拉力和 1 N 向左摩擦力，求加速度。',
      answer: '4 m/s²，方向向右',
      analysis: '合外力为 5N-1N=4N，a=4/1=4 m/s²。'
    },
    {
      id: 'paper-newton-q4',
      type: '判断题',
      difficulty: '理解',
      knowledgePoint: '加速度方向',
      title: '物体速度向右时，如果合外力向左，加速度也向左。',
      answer: '正确'
    },
    {
      id: 'paper-newton-q5',
      type: '单选题',
      difficulty: '基础',
      knowledgePoint: '牛顿第二定律',
      title: '同一物体受到的合外力增大到原来的 2 倍，加速度如何变化？',
      options: ['A. 增大到原来的 2 倍', 'B. 减小到原来的一半', 'C. 保持不变', 'D. 增大到原来的 4 倍'],
      answer: '增大到原来的 2 倍'
    },
    {
      id: 'paper-newton-q6',
      type: '多选题',
      difficulty: '理解',
      knowledgePoint: '受力分析',
      title: '分析水平面上被拉动的木块时，通常需要考虑哪些力？',
      answer: '重力、支持力、拉力、摩擦力'
    },
    {
      id: 'paper-newton-q7',
      type: '填空题',
      difficulty: '基础',
      knowledgePoint: '牛顿第二定律',
      title: '牛顿第二定律的表达式是 ______。',
      answer: 'F=ma'
    },
    {
      id: 'paper-newton-q8',
      type: '单选题',
      difficulty: '理解',
      knowledgePoint: '合外力',
      title: '当物体受到多个力时，决定加速度的是哪一个量？',
      options: ['A. 最大的一个力', 'B. 合外力', 'C. 速度大小', 'D. 位移大小'],
      answer: '合外力'
    },
    {
      id: 'paper-newton-q9',
      type: '计算题',
      difficulty: '提升',
      knowledgePoint: '受力分析',
      title: '质量 0.5 kg 的小车合外力为 1.5 N，求加速度并说明方向。',
      answer: '3 m/s²，方向与合外力方向一致'
    },
    {
      id: 'paper-newton-q10',
      type: '情境题',
      difficulty: '提升',
      knowledgePoint: '加速度方向',
      title: '电梯启动上升瞬间，学生感觉“变重”，请从合外力和加速度角度解释。',
      answer: '启动上升时加速度向上，支持力大于重力，合外力向上。'
    }
  ]
};

export const classLearningAnalysis = {
  classId: 'class-2026-math-1',
  className: '高一 3 班',
  lessonName: '二次函数图像与性质',
  totalStudents: 43,
  submitted: 41,
  avgAccuracy: 68,
  updatedAt: '刚刚',
  questionStats: [
    {
      id: 'q-axis-001',
      title: '求 y = x² - 4x + 3 的对称轴',
      accuracy: 56,
      avgTime: '68 秒',
      weakPoint: '对称轴公式',
      optionDistribution: [
        { label: 'A', value: 8, percent: 20, note: '符号错误' },
        { label: 'B', value: 23, percent: 56, note: '正确' },
        { label: 'C', value: 7, percent: 17, note: '把 b 当成 4' },
        { label: 'D', value: 3, percent: 7, note: '计算错误' }
      ]
    },
    {
      id: 'q-vertex-001',
      title: '将 y = x² - 4x + 3 化为顶点式',
      accuracy: 61,
      avgTime: '92 秒',
      weakPoint: '顶点坐标',
      optionDistribution: [
        { label: '配方正确', value: 25, percent: 61, note: '正确' },
        { label: '漏常数项', value: 9, percent: 22, note: '配方后未补回常数' },
        { label: '顶点符号错', value: 5, percent: 12, note: '把 (2,-1) 写成 (-2,-1)' },
        { label: '未完成', value: 2, percent: 5, note: '步骤中断' }
      ]
    },
    {
      id: 'q-square-001',
      title: '用配方法说明二次函数最值',
      accuracy: 64,
      avgTime: '108 秒',
      weakPoint: '配方法',
      optionDistribution: [
        { label: '完整说明', value: 26, percent: 64, note: '正确' },
        { label: '只写公式', value: 7, percent: 17, note: '缺少图像解释' },
        { label: '最值方向错', value: 5, percent: 12, note: '混淆开口方向' },
        { label: '空白', value: 3, percent: 7, note: '不会配方' }
      ]
    }
  ],
  weakPoints: [
    { id: 'kp-axis', name: '对称轴公式', score: 82, accuracy: 56, impact: '18 人需要复盘 -b/2a 的负号来源' },
    { id: 'kp-vertex', name: '顶点坐标', score: 74, accuracy: 61, impact: '顶点横坐标符号错误集中出现' },
    { id: 'kp-completing-square', name: '配方法', score: 69, accuracy: 64, impact: '常数项补偿步骤不稳定' }
  ],
  aiAdvice: '建议下节课先复盘对称轴公式中的负号，再用配方法解释顶点式来源；随后安排 3 道对称轴到顶点坐标的递进练习。'
};

export const studentProfiles = [
  {
    id: 'stu-liming',
    name: '李明',
    className: '高一 3 班',
    attendance: '5/5',
    practiceCount: 18,
    mastery: [
      { knowledgeId: 'kp-basic', name: '二次函数概念', value: 86 },
      { knowledgeId: 'kp-axis', name: '对称轴公式', value: 48 },
      { knowledgeId: 'kp-vertex', name: '顶点坐标', value: 52 },
      { knowledgeId: 'kp-graph', name: '图像性质', value: 71 }
    ],
    weakPoints: ['对称轴公式符号', '顶点坐标计算', '配方法步骤'],
    mistakeReasons: ['忽略 -b 中的负号', '配方时常数项处理错误'],
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
    ],
    aiConversationSummary: '学生多次追问为什么对称轴是 x=2，说明公式来源理解不牢。',
    parentSummary: {
      weeklyStatus: '本周能识别二次函数基本形式，但对对称轴和顶点坐标仍需练习。',
      mastered: ['二次函数一般式', '开口方向判断'],
      needsAttention: ['对称轴公式', '配方法'],
      suggestion: '建议每天完成 3 道对称轴与顶点坐标题，先看步骤再独立完成。'
    }
  },
  {
    id: 'stu-chenyu',
    name: '陈雨',
    className: '高一 3 班',
    attendance: '5/5',
    practiceCount: 21,
    mastery: [
      { knowledgeId: 'kp-basic', name: '二次函数概念', value: 91 },
      { knowledgeId: 'kp-axis', name: '对称轴公式', value: 72 },
      { knowledgeId: 'kp-vertex', name: '顶点坐标', value: 76 },
      { knowledgeId: 'kp-graph', name: '图像性质', value: 68 }
    ],
    weakPoints: ['图像增减性描述', '最值语言表达'],
    mistakeReasons: ['能算出结果，但不会结合图像解释原因'],
    recommendedPractice: [
      {
        id: 'q-graph-002',
        title: '根据开口方向和顶点判断函数最小值。',
        difficulty: '中等',
        target: '图像语言表达'
      },
      {
        id: 'q-graph-003',
        title: '判断 y = -x² + 2x + 3 的增减区间。',
        difficulty: '提升',
        target: '结合对称轴讨论单调性'
      },
      {
        id: 'q-square-002',
        title: '用配方法解释函数图像平移。',
        difficulty: '提升',
        target: '公式和图像互证'
      }
    ],
    aiConversationSummary: '学生能完成计算，但追问图像变化较多，需要加强数学语言表达。',
    parentSummary: {
      weeklyStatus: '本周计算基础较稳，建议继续把结果和图像性质联系起来表达。',
      mastered: ['对称轴计算', '顶点坐标基础题'],
      needsAttention: ['图像增减性', '最值表述'],
      suggestion: '建议做题后用一句话说明图像依据，例如“因为开口向上，所以顶点处取最小值”。'
    }
  }
];
