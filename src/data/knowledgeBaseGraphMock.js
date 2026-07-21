export const knowledgeBaseGraphSummary = {
  title: '高中物理知识体系',
  description: '基于教材、课标与教学资料整理的静态知识路径示例。',
  materialCount: 12,
  sourceLabels: ['高中物理必修一', '课程标准', '力学专题讲义', '实验教学资料']
};

const nodes = [
  {
    id: 'force-concept',
    label: '力的基本概念',
    category: '力学基础',
    questionCount: 8,
    source: 'explicit',
    description: '理解力的作用效果、三要素、矢量性以及常见表示方式。',
    aliases: ['力的三要素', '力的表示'],
    materialRefs: ['高中物理必修一', '力学基础讲义']
  },
  {
    id: 'mass-inertia',
    label: '质量与惯性',
    category: '力学基础',
    questionCount: 6,
    source: 'explicit',
    description: '区分质量、重力和惯性，理解质量是惯性大小的量度。',
    aliases: ['惯性', '惯性质量'],
    materialRefs: ['高中物理必修一', '课程标准']
  },
  {
    id: 'reference-frame',
    label: '参考系',
    category: '运动学基础',
    questionCount: 4,
    source: 'explicit',
    description: '根据运动描述选择参考系，判断物体运动状态的相对性。',
    aliases: ['参照物', '运动的相对性'],
    materialRefs: ['高中物理必修一', '运动学专题讲义']
  },
  {
    id: 'velocity',
    label: '速度',
    category: '运动学基础',
    questionCount: 7,
    source: 'explicit',
    description: '掌握平均速度、瞬时速度和速度方向的物理意义。',
    aliases: ['瞬时速度', '平均速度'],
    materialRefs: ['高中物理必修一', '运动学专题讲义']
  },
  {
    id: 'acceleration',
    label: '加速度',
    category: '运动学基础',
    questionCount: 9,
    source: 'explicit',
    description: '理解速度变化率、加速度方向以及加速和减速的判断方法。',
    aliases: ['速度变化率', '加速度方向'],
    materialRefs: ['高中物理必修一', '实验教学资料']
  },
  {
    id: 'newton-first-law',
    label: '牛顿第一定律',
    category: '核心规律',
    questionCount: 7,
    source: 'explicit',
    description: '理解惯性定律及力不是维持物体运动状态的原因。',
    aliases: ['惯性定律', '牛顿第一运动定律'],
    materialRefs: ['高中物理必修一', '课程标准']
  },
  {
    id: 'newton-second-law',
    label: '牛顿第二定律',
    category: '核心规律',
    questionCount: 12,
    source: 'explicit',
    description: '建立合外力、质量和加速度之间的定量关系。',
    aliases: ['F=ma', '加速度定律'],
    materialRefs: ['高中物理必修一', '力学专题讲义', '实验教学资料']
  },
  {
    id: 'newton-third-law',
    label: '牛顿第三定律',
    category: '核心规律',
    questionCount: 6,
    source: 'explicit',
    description: '辨析作用力与反作用力的对象、性质和同时性。',
    aliases: ['作用与反作用', '牛顿第三运动定律'],
    materialRefs: ['高中物理必修一', '力学基础讲义']
  },
  {
    id: 'momentum-theorem',
    label: '动量定理',
    category: '核心规律',
    questionCount: 8,
    source: 'explicit',
    description: '利用冲量等于动量变化处理变力和短时作用过程。',
    aliases: ['冲量定理', '动量变化'],
    materialRefs: ['选择性必修一', '动量专题讲义']
  },
  {
    id: 'energy-conservation',
    label: '机械能守恒',
    category: '核心规律',
    questionCount: 9,
    source: 'explicit',
    description: '判断机械能守恒条件并建立动能与势能的转化关系。',
    aliases: ['机械能守恒定律', '动能势能转化'],
    materialRefs: ['高中物理必修二', '能量专题讲义']
  },
  {
    id: 'force-analysis',
    label: '受力分析',
    category: '解题方法',
    questionCount: 11,
    source: 'explicit',
    description: '确定研究对象，按场力和接触力顺序完整画出受力图。',
    aliases: ['受力图', '研究对象法'],
    materialRefs: ['力学专题讲义', '典型例题集']
  },
  {
    id: 'orthogonal-decomposition',
    label: '正交分解',
    category: '解题方法',
    questionCount: 8,
    source: 'explicit',
    description: '建立合适坐标系，将矢量分解到相互垂直的方向列式。',
    aliases: ['力的分解', '坐标分解法'],
    materialRefs: ['力学专题讲义', '数学工具补充资料']
  },
  {
    id: 'whole-isolation',
    label: '整体与隔离法',
    category: '解题方法',
    questionCount: 9,
    source: 'explicit',
    description: '根据求解目标选择整体或单个物体，减少未知内力。',
    aliases: ['整体法', '隔离法'],
    materialRefs: ['连接体专题讲义', '典型例题集']
  },
  {
    id: 'critical-condition',
    label: '临界条件分析',
    category: '解题方法',
    questionCount: 7,
    source: 'explicit',
    description: '识别恰好接触、恰好滑动和速度相等等临界状态。',
    aliases: ['临界状态', '极值条件'],
    materialRefs: ['力学专题讲义', '竞赛拓展资料']
  },
  {
    id: 'inclined-plane',
    label: '斜面动力学',
    category: '综合应用',
    questionCount: 10,
    source: 'explicit',
    description: '综合摩擦力、支持力和正交分解解决斜面运动问题。',
    aliases: ['斜面问题', '斜面受力'],
    materialRefs: ['斜面模型专题', '典型例题集']
  },
  {
    id: 'connected-system',
    label: '连接体问题',
    category: '综合应用',
    questionCount: 9,
    source: 'explicit',
    description: '分析多个物体共同运动时的加速度、张力和相互作用力。',
    aliases: ['连接体', '绳杆模型'],
    materialRefs: ['连接体专题讲义', '典型例题集']
  },
  {
    id: 'conveyor-belt',
    label: '传送带问题',
    category: '综合应用',
    questionCount: 8,
    source: 'explicit',
    description: '结合相对运动、摩擦方向和临界速度分析多阶段过程。',
    aliases: ['传送带模型', '相对滑动'],
    materialRefs: ['传送带专题讲义', '实验教学资料']
  },
  {
    id: 'collision-dynamics',
    label: '碰撞与综合动力学',
    category: '综合应用',
    questionCount: 7,
    source: 'explicit',
    description: '综合动量、能量和牛顿定律处理碰撞前后的系统运动。',
    aliases: ['碰撞模型', '动量能量综合'],
    materialRefs: ['动量专题讲义', '综合训练卷']
  }
];

const edges = [
  { id: 'e-reference-newton-one', source: 'reference-frame', target: 'newton-first-law', type: 'prerequisite', label: '建立惯性系', supportCount: 2 },
  { id: 'e-mass-newton-one', source: 'mass-inertia', target: 'newton-first-law', type: 'derivation', label: '理解惯性', supportCount: 3 },
  { id: 'e-force-newton-two', source: 'force-concept', target: 'newton-second-law', type: 'prerequisite', label: '建立合力概念', supportCount: 4 },
  { id: 'e-mass-newton-two', source: 'mass-inertia', target: 'newton-second-law', type: 'prerequisite', label: '确定质量', supportCount: 3 },
  { id: 'e-acceleration-newton-two', source: 'acceleration', target: 'newton-second-law', type: 'derivation', label: '联系运动变化', supportCount: 5 },
  { id: 'e-force-newton-three', source: 'force-concept', target: 'newton-third-law', type: 'prerequisite', label: '辨析力的对象', supportCount: 3 },
  { id: 'e-velocity-momentum', source: 'velocity', target: 'momentum-theorem', type: 'prerequisite', label: '建立动量变化', supportCount: 3 },
  { id: 'e-mass-momentum', source: 'mass-inertia', target: 'momentum-theorem', type: 'prerequisite', label: '确定系统动量', supportCount: 2 },
  { id: 'e-velocity-energy', source: 'velocity', target: 'energy-conservation', type: 'prerequisite', label: '计算动能', supportCount: 3 },
  { id: 'e-mass-energy', source: 'mass-inertia', target: 'energy-conservation', type: 'prerequisite', label: '联系动能势能', supportCount: 2 },
  { id: 'e-newton-two-force-analysis', source: 'newton-second-law', target: 'force-analysis', type: 'application', label: '组织动力学方程', supportCount: 5 },
  { id: 'e-newton-two-orthogonal', source: 'newton-second-law', target: 'orthogonal-decomposition', type: 'application', label: '分方向列式', supportCount: 4 },
  { id: 'e-newton-two-whole', source: 'newton-second-law', target: 'whole-isolation', type: 'application', label: '选择研究对象', supportCount: 4 },
  { id: 'e-newton-three-whole', source: 'newton-third-law', target: 'whole-isolation', type: 'application', label: '分析相互作用', supportCount: 3 },
  { id: 'e-newton-two-critical', source: 'newton-second-law', target: 'critical-condition', type: 'application', label: '建立临界方程', supportCount: 3 },
  { id: 'e-momentum-critical', source: 'momentum-theorem', target: 'critical-condition', type: 'application', label: '判断瞬时条件', supportCount: 2 },
  { id: 'e-energy-critical', source: 'energy-conservation', target: 'critical-condition', type: 'application', label: '判断能量边界', supportCount: 2 },
  { id: 'e-force-analysis-inclined', source: 'force-analysis', target: 'inclined-plane', type: 'application', label: '应用于斜面', supportCount: 5 },
  { id: 'e-orthogonal-inclined', source: 'orthogonal-decomposition', target: 'inclined-plane', type: 'application', label: '沿斜面分解', supportCount: 4 },
  { id: 'e-force-analysis-connected', source: 'force-analysis', target: 'connected-system', type: 'application', label: '分析各物体受力', supportCount: 4 },
  { id: 'e-whole-connected', source: 'whole-isolation', target: 'connected-system', type: 'application', label: '整体隔离切换', supportCount: 5 },
  { id: 'e-force-analysis-conveyor', source: 'force-analysis', target: 'conveyor-belt', type: 'application', label: '判断摩擦方向', supportCount: 4 },
  { id: 'e-critical-conveyor', source: 'critical-condition', target: 'conveyor-belt', type: 'application', label: '识别共速时刻', supportCount: 4 },
  { id: 'e-whole-collision', source: 'whole-isolation', target: 'collision-dynamics', type: 'application', label: '选择碰撞系统', supportCount: 3 },
  { id: 'e-critical-collision', source: 'critical-condition', target: 'collision-dynamics', type: 'application', label: '判断碰撞边界', supportCount: 3 },
  { id: 'e-force-inclined-direct', source: 'force-concept', target: 'inclined-plane', type: 'application', label: '跨阶段综合', supportCount: 1 },
  { id: 'e-acceleration-conveyor-direct', source: 'acceleration', target: 'conveyor-belt', type: 'application', label: '跨阶段综合', supportCount: 1 },
  { id: 'e-newton-two-connected-direct', source: 'newton-second-law', target: 'connected-system', type: 'application', label: '综合应用', supportCount: 2 }
];

export const knowledgeBaseGraphData = { nodes, edges };
