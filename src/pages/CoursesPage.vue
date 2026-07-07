<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { notify, store } from '../data/mockStore';
import { archiveCourse, createCourse, listCourses, restoreCourse } from '../data/courseApiClient';
import { mapApiCoursesToUiCourses } from '../data/courseUiAdapter';

const router = useRouter();
const activeTab = ref('进行中');
const keyword = ref('');
const loading = ref(false);
const courses = ref([]);
const selectedCourseId = ref('');

const tabs = ['进行中', '已归档', '全部'];

const apiStatus = computed(() => {
  if (activeTab.value === '已归档') return 'archived';
  if (activeTab.value === '全部') return 'all';
  return 'active';
});

const selectedCourse = computed(() => {
  return courses.value.find((course) => course.id === selectedCourseId.value) || courses.value[0] || null;
});

function selectCourse(courseId) {
  selectedCourseId.value = courseId;
  store.selectedCourseId = courseId;
}

function continueDesign() {
  if (!selectedCourse.value) return;
  router.push(`/preclass/courses/${selectedCourse.value.id}/workspace`);
}

async function loadCourses() {
  loading.value = true;
  try {
    const result = await listCourses({
      keyword: keyword.value.trim(),
      status: apiStatus.value,
      page: 1,
      pageSize: 50
    });
    courses.value = mapApiCoursesToUiCourses(result.data);
    if (!selectedCourse.value && courses.value.length) {
      selectCourse(courses.value[0].id);
    }
    if (selectedCourse.value && !courses.value.some((course) => course.id === selectedCourse.value.id)) {
      selectCourse(courses.value[0]?.id || '');
    }
  } catch (error) {
    notify(error.message || '课程列表加载失败');
  } finally {
    loading.value = false;
  }
}

async function startNewCourse() {
  try {
    const created = await createCourse({
      title: '新建课程',
      subject: '物理',
      grade: '高一',
      description: '新建课程草稿，可继续完善大纲、课件和题目。'
    });
    await loadCourses();
    selectCourse(created.id);
    notify('已创建课程草稿，进入 AI 大纲生成');
    router.push(`/preclass/courses/${created.id}/workspace`);
  } catch (error) {
    notify(error.message || '课程创建失败');
  }
}

async function toggleArchive() {
  if (!selectedCourse.value) return;
  try {
    if (selectedCourse.value.apiStatus === 'archived') {
      await restoreCourse(selectedCourse.value.id);
      notify('课程已恢复');
      activeTab.value = '进行中';
    } else {
      await archiveCourse(selectedCourse.value.id);
      notify('课程已归档');
    }
    await loadCourses();
  } catch (error) {
    notify(error.message || '课程状态更新失败');
  }
}

onMounted(loadCourses);
</script>

<template>
  <main class="course-page">
    <section class="course-head">
      <h1>我的课程</h1>
      <button class="new-course-btn" type="button" :disabled="loading" @click="startNewCourse">
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
        <input v-model="keyword" type="search" placeholder="搜索课程、年级、学科..." @keyup.enter="loadCourses" />
      </label>
      <button class="course-filter" type="button" :disabled="loading" @click="loadCourses">
        {{ loading ? '加载中' : '刷新' }}
        <span class="material-symbols-outlined">refresh</span>
      </button>
    </section>

    <section class="course-layout">
      <section class="course-list-card">
        <header class="course-list-head">
          <span>课程列表</span>
          <span class="course-count">{{ courses.length }} 门</span>
        </header>
        <div v-if="courses.length" class="course-items">
          <button
            v-for="course in courses"
            :key="course.id"
            class="course-row"
            :class="{ selected: selectedCourse && course.id === selectedCourse.id }"
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
        <div v-else class="course-empty">
          <span class="material-symbols-outlined">school</span>
          <strong>{{ loading ? '正在加载课程' : '暂无课程' }}</strong>
          <p>{{ loading ? '请稍候' : '可以新建课程，或切换筛选条件查看归档课程。' }}</p>
        </div>
      </section>

      <aside v-if="selectedCourse" class="course-side">
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
            <button class="soft-btn" type="button" @click="notify('复制课程将在题库 CRUD 后接入')">复制课程</button>
            <button class="soft-btn" type="button" :disabled="loading" @click="toggleArchive">{{ selectedCourse.apiStatus === 'archived' ? '恢复' : '归档' }}</button>
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
