<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { createOutlineDraftCourse, getCourse, notify, store } from '../data/mockStore';

const router = useRouter();
const activeTab = ref('全部');
const keyword = ref('');

const tabs = ['全部', '进行中', '已完成', '未开始'];

const filteredCourses = computed(() => {
  const word = keyword.value.trim();
  return store.courses.filter((course) => {
    const tabMatched = activeTab.value === '全部' || course.status === activeTab.value;
    const wordMatched = !word || `${course.title}${course.grade}${course.subject}`.includes(word);
    return tabMatched && wordMatched;
  });
});

const selectedCourse = computed(() => getCourse(store.selectedCourseId));

function selectCourse(courseId) {
  store.selectedCourseId = courseId;
}

function continueDesign() {
  router.push(`/preclass/courses/${selectedCourse.value.id}/workspace`);
}

function startNewCourse() {
  const course = createOutlineDraftCourse();
  notify('已创建课程草稿，进入 AI 大纲生成');
  router.push(`/preclass/courses/${course.id}/workspace`);
}
</script>

<template>
  <main class="course-page">
    <section class="course-head">
      <h1>我的课程</h1>
      <button class="new-course-btn" type="button" @click="startNewCourse">
        <span class="material-symbols-outlined">add</span>
        新建课程
      </button>
    </section>

    <section class="course-tools" aria-label="课程筛选">
      <div class="course-tabs">
        <button
          v-for="tab in tabs"
          :key="tab"
          :class="{ active: activeTab === tab }"
          type="button"
          @click="activeTab = tab"
        >
          {{ tab }}
        </button>
      </div>
      <label class="course-search">
        <span class="material-symbols-outlined">search</span>
        <input v-model="keyword" type="search" placeholder="搜索课程、年级、学科..." />
      </label>
      <button class="course-filter" type="button" @click="notify('已按最近备课排序')">
        最近备课
        <span class="material-symbols-outlined">expand_more</span>
      </button>
    </section>

    <section class="course-layout">
      <section class="course-list-card">
        <header class="course-list-head">
          <span>课程列表</span>
          <span class="course-count">{{ filteredCourses.length }} 门</span>
        </header>
        <div class="course-items">
          <button
            v-for="course in filteredCourses"
            :key="course.id"
            class="course-row"
            :class="{ selected: course.id === selectedCourse.id }"
            type="button"
            @click="selectCourse(course.id)"
          >
            <span class="course-icon"><span class="material-symbols-outlined">{{ course.icon }}</span></span>
            <span class="course-main">
              <strong>{{ course.shortTitle }}</strong>
              <p>{{ course.summary }}</p>
              <span class="course-tags">
                <span v-for="tag in course.tags" :key="tag">{{ tag }}</span>
              </span>
            </span>
            <span class="course-status" :class="{ warn: course.statusTone === 'warn' }">{{ course.status }}</span>
          </button>
        </div>
      </section>

      <aside class="course-side">
        <div class="course-stats">
          <div class="course-stat"><strong>{{ selectedCourse.duration.replace(' 分钟', '') }}</strong><span>min</span><span>课时时长</span></div>
          <div class="course-stat green"><strong>{{ selectedCourse.knowledge.length }}</strong><span>项</span><span>核心知识点</span></div>
          <div class="course-stat orange"><strong>{{ selectedCourse.hasOutline ? 0 : 3 }}</strong><span>项</span><span>待补充材料</span></div>
        </div>

        <section class="course-detail-card">
          <div class="detail-top">
            <span class="course-status" :class="{ warn: selectedCourse.statusTone === 'warn' }">{{ selectedCourse.status }}</span>
            <h2>{{ selectedCourse.shortTitle }}</h2>
            <div class="detail-meta">{{ selectedCourse.grade }} ・ {{ selectedCourse.subject }} ・ {{ selectedCourse.duration }} ・ 上次编辑 {{ selectedCourse.updatedAt }}</div>
          </div>
          <div class="detail-row"><span>年级</span><strong>{{ selectedCourse.grade }}</strong></div>
          <div class="detail-row"><span>学科</span><strong>{{ selectedCourse.subject }} ・ {{ selectedCourse.title.replace(/^.*《|》$/g, '') }}</strong></div>
          <div class="detail-row"><span>课时时长</span><strong>{{ selectedCourse.duration }}</strong></div>
          <div class="detail-row"><span>备课时间</span><strong>{{ selectedCourse.updatedAt }}</strong></div>
          <div class="detail-row"><span>教学目标</span><strong>{{ selectedCourse.goal }}</strong></div>
          <div class="detail-row"><span>核心知识点</span><strong>{{ selectedCourse.todos }}</strong></div>
          <div class="detail-actions">
            <button class="soft-btn" type="button" @click="notify('已复制课程到草稿区')">复制课程</button>
            <button class="soft-btn" type="button" @click="notify('课程已归档到演示列表')">归档</button>
            <button class="primary-btn" type="button" @click="continueDesign">
              继续设计
              <span class="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        </section>
      </aside>
    </section>
  </main>
</template>
