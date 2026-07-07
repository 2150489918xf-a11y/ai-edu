export const slides = [
  {
    id: 1,
    label: '封面',
    kind: 'cover',
    title: '牛顿第一定律',
    subtitle: '从生活观察走向理想化推理',
    footer: '八年级 ・ 物理 ・ 王老师',
    marker: '01'
  },
  {
    id: 2,
    label: '目标',
    title: '学习目标',
    subtitle: '理解惯性，能解释生活中的运动现象',
    bullets: ['说出牛顿第一定律的核心表述', '用实例解释惯性现象', '完成课堂出口检测']
  },
  {
    id: 3,
    label: '导入',
    title: '运动为什么会改变',
    subtitle: '从急刹车、桌布抽离和滑板车案例进入课堂',
    bullets: ['观察现象', '提出猜想', '记录影响因素']
  },
  {
    id: 4,
    label: '实验',
    title: '阻力越小会发生什么',
    subtitle: '用三种表面比较小车运动距离',
    bullets: ['毛巾表面', '棉布表面', '木板表面']
  },
  {
    id: 5,
    label: '概念',
    title: '牛顿第一定律',
    subtitle: '不受力时保持静止或匀速直线运动状态',
    bullets: ['理想实验推理', '运动状态保持', '力不是维持运动的原因']
  },
  {
    id: 6,
    label: '辨析',
    title: '惯性与速度无关',
    subtitle: '惯性大小只与质量有关',
    bullets: ['错误说法辨析', '生活情境解释', '口头追问']
  },
  {
    id: 7,
    label: '例题',
    title: '例题讲解',
    subtitle: '用惯性解释公交车启动和刹车现象',
    bullets: ['确定研究对象', '判断原运动状态', '说明保持状态的趋势']
  },
  {
    id: 8,
    label: '检测',
    title: '课堂检测',
    subtitle: '迁移应用与出口题',
    bullets: ['选择题 2 题', '情境解释 1 题', '同伴互评']
  },
  {
    id: 9,
    label: '出口',
    title: '出口题',
    subtitle: '一句话解释为什么安全带能保护乘客',
    bullets: ['独立作答', '随机展示', '教师点评']
  },
  {
    id: 10,
    label: '小结',
    title: '本课小结',
    subtitle: '从现象、实验、定律到解释',
    bullets: ['核心概念', '易错提醒', '课后练习']
  },
  {
    id: 11,
    label: '作业',
    title: '课后作业',
    subtitle: '完成分层练习并上传错因说明',
    bullets: ['基础题 6 道', '提升题 2 道', '错因一句话']
  },
  {
    id: 12,
    label: '结束',
    title: '谢谢',
    subtitle: '下节课继续学习力与运动',
    bullets: ['复习惯性', '预习受力分析']
  }
];

export const chatMessages = [
  {
    id: 1,
    role: 'ai',
    time: '04:21',
    title: '封面页建议',
    text: '封面页用于点题，建议突出三件事：课题名、学段学科、教师信息。我已按牛顿第二定律大纲填好。'
  },
  {
    id: 2,
    role: 'teacher',
    text: '把副标题改成更贴近学生生活经验的说法'
  },
  {
    id: 3,
    role: 'ai',
    time: '04:23',
    title: '可采纳改动',
    text: '我把副标题调整成更口语化的表达：',
    proposal: {
      before: '力、质量与加速度的定量关系',
      after: '同样推一下，为什么有的物体更难加速？'
    },
    actions: ['采纳改动', '对比原稿', '再换一版']
  }
];

export const slideTools = ['版式', '列表', '撤销', '图片'];

export const voiceInputMock = {
  delay: 1300,
  transcript: '帮我优化这个元素的课堂表达。'
};
