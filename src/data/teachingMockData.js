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
  }
];

export const quadraticMindMap = {
  id: 'mindmap-quadratic',
  title: '二次函数图像与性质',
  courseId: 'math-quadratic',
  generatedAt: '刚刚',
  summary: '围绕二次函数的一般式、图像性质、顶点与对称轴、配方法和易错点生成的备课思维导图。',
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
