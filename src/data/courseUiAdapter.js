const subjectIcons = {
  物理: 'science',
  数学: 'functions',
  化学: 'biotech',
  语文: 'menu_book',
  英语: 'translate',
  历史: 'history_edu'
};

function formatUpdatedAt(value) {
  if (!value) return '刚刚';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '刚刚';
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function inferKnowledge(course) {
  const text = `${course.title || ''} ${course.description || ''}`;
  if (text.includes('牛顿') || text.includes('F=ma')) return ['F=ma', '合外力计算', '加速度方向'];
  if (text.includes('函数')) return ['图像观察', '定义辨析', '基础应用'];
  if (text.includes('动量')) return ['动量', '冲量', '守恒条件'];
  return ['课程目标', '核心概念', '课堂检测'];
}

export function mapApiCourseToUiCourse(course) {
  const archived = course.status === 'archived';
  const topic = course.title?.replace(/^.*《|》$/g, '') || '未命名课程';
  const duration = course.duration || '45 分钟';
  const knowledge = Array.isArray(course.knowledge) && course.knowledge.length
    ? course.knowledge
    : inferKnowledge(course);
  const goal = course.goal || course.description || '等待补充教学目标。';

  return {
    id: course.id,
    groupId: course.groupId || course.group?.id || '',
    groupTitle: course.group?.title || `${course.grade || '未分级'}${course.subject || '未设置'}`,
    groupSubject: course.group?.subject || course.subject || '未设置',
    groupGrade: course.group?.grade || course.grade || '未分级',
    title: course.title || topic,
    shortTitle: `${course.grade || '未分级'} · ${topic}`,
    grade: course.grade || '未分级',
    subject: course.subject || '未设置',
    duration,
    status: archived ? '已归档' : '进行中',
    statusTone: archived ? 'warn' : 'normal',
    icon: subjectIcons[course.subject] || 'article',
    updatedAt: formatUpdatedAt(course.updatedAt),
    progress: archived ? 100 : Number(course.progress ?? 18),
    hasOutline: Boolean(course.hasOutline),
    materialUploaded: Boolean(course.materialUploaded),
    materialName: course.materialName || '',
    outline: course.outline || null,
    ppt: course.ppt || null,
    goal,
    summary: course.description || '课程已创建，可继续完善大纲、课件和题目。',
    tags: [course.grade || '未分级', course.subject || '未设置', duration.replace(' 分钟', ' min')],
    todos: archived ? '已归档，可恢复后继续编辑' : '待生成课程大纲',
    knowledge,
    apiStatus: course.status,
    deletedAt: course.deletedAt || null
  };
}

export function mapApiCoursesToUiCourses(courses = []) {
  return courses.map(mapApiCourseToUiCourse);
}
