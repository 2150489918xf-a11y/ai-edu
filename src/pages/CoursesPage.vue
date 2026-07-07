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
const showCreateDialog = ref(false);
const createForm = ref({
  title: '',
  subject: '物理',
  grade: '高一',
  duration: '45 分钟',
  goal: '',
  knowledgeText: '',
  description: ''
});

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

function openCreateDialog() {
  createForm.value = {
    title: '',
    subject: '物理',
    grade: '高一',
    duration: '45 分钟',
    goal: '',
    knowledgeText: '',
    description: ''
  };
  showCreateDialog.value = true;
}

function parseKnowledge(text) {
  return text
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function submitNewCourse() {
  const title = createForm.value.title.trim();
  if (!title) {
    notify('请先填写课程名称');
    return;
  }

  try {
    const created = await createCourse({
      title,
      subject: createForm.value.subject.trim(),
      grade: createForm.value.grade.trim(),
      duration: createForm.value.duration.trim(),
      goal: createForm.value.goal.trim(),
      knowledge: parseKnowledge(createForm.value.knowledgeText),
      description: createForm.value.description.trim() || createForm.value.goal.trim()
    });
    showCreateDialog.value = false;
    activeTab.value = '进行中';
    await loadCourses();
    selectCourse(created.id);
    notify('课程基础信息已保存，进入课件生成详情');
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
      <button class="new-course-btn" type="button" :disabled="loading" @click="openCreateDialog">
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

    <section v-if="showCreateDialog" class="course-dialog-backdrop" role="presentation" @click.self="showCreateDialog = false">
      <form class="course-dialog" @submit.prevent="submitNewCourse">
        <header>
          <div>
            <h2>新建课程</h2>
            <p>填写基础信息后，系统会保存到数据库并进入课件生成详情。</p>
          </div>
          <button class="dialog-icon-btn" type="button" aria-label="关闭" @click="showCreateDialog = false">
            <span class="material-symbols-outlined">close</span>
          </button>
        </header>

        <div class="course-form-grid">
          <label class="course-field wide">
            <span>课程名称</span>
            <input v-model="createForm.title" type="text" placeholder="例如：牛顿第二定律" />
          </label>
          <label class="course-field">
            <span>年级</span>
            <input v-model="createForm.grade" type="text" placeholder="高一" />
          </label>
          <label class="course-field">
            <span>学科</span>
            <input v-model="createForm.subject" type="text" placeholder="物理" />
          </label>
          <label class="course-field">
            <span>课时</span>
            <input v-model="createForm.duration" type="text" placeholder="45 分钟" />
          </label>
          <label class="course-field wide">
            <span>教学目标</span>
            <textarea v-model="createForm.goal" rows="3" placeholder="这节课希望学生掌握什么？"></textarea>
          </label>
          <label class="course-field wide">
            <span>核心知识点</span>
            <input v-model="createForm.knowledgeText" type="text" placeholder="用逗号分隔，例如：F=ma，合外力计算，加速度方向" />
          </label>
          <label class="course-field wide">
            <span>课程说明</span>
            <textarea v-model="createForm.description" rows="2" placeholder="可选，用于课程列表摘要"></textarea>
          </label>
        </div>

        <footer>
          <button class="soft-btn" type="button" @click="showCreateDialog = false">取消</button>
          <button class="primary-btn" type="submit" :disabled="loading">
            保存并进入生成
            <span class="material-symbols-outlined">arrow_forward</span>
          </button>
        </footer>
      </form>
    </section>
  </main>
</template>
