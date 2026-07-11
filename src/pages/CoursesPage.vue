<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { notify, store } from '../data/mockStore';
import {
  archiveCourse,
  createCourse,
  createCourseGroup,
  deleteCourseGroup,
  deleteCoursePermanently,
  listCourseGroups,
  listCourses,
  restoreCourse
} from '../data/courseApiClient';
import { mapApiCoursesToUiCourses } from '../data/courseUiAdapter';

const router = useRouter();
const activeTab = ref('进行中');
const keyword = ref('');
const loading = ref(false);
const courses = ref([]);
const groupOptions = ref([]);
const selectedGroupId = ref('all');
const selectedCourseId = ref('');
const showCreateDialog = ref(false);
const showCreateGroupDialog = ref(false);
const groupDeleteMode = ref(false);
const createForm = ref({
  groupId: '',
  title: '',
  subject: '物理',
  grade: '高一',
  duration: '45 分钟',
  goal: '',
  knowledgeText: '',
  description: ''
});
const groupForm = ref({
  title: '',
  subject: '物理',
  grade: '高一',
  description: ''
});

const tabs = ['进行中', '已归档', '全部'];

const apiStatus = computed(() => {
  if (activeTab.value === '已归档') return 'archived';
  if (activeTab.value === '全部') return 'all';
  return 'active';
});

function getCourseGroupId(course) {
  return course.groupId || `${course.groupGrade}-${course.groupSubject}`;
}

const courseGroups = computed(() => {
  const groupMap = new Map();
  for (const group of groupOptions.value) {
    groupMap.set(group.id, {
      id: group.id,
      title: group.title,
      subject: group.subject,
      grade: group.grade,
      unitCount: group.unitCount,
      count: Number(group.unitCount || 0),
      hasServerCount: true
    });
  }
  for (const course of courses.value) {
    const id = getCourseGroupId(course);
    if (!groupMap.has(id)) {
      groupMap.set(id, {
        id,
        title: course.groupTitle,
        subject: course.groupSubject,
        grade: course.groupGrade,
        count: 0,
        hasServerCount: false
      });
    }
    const group = groupMap.get(id);
    if (!group.hasServerCount) group.count += 1;
  }
  return [...groupMap.values()].sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'));
});

const visibleCourses = computed(() => {
  if (selectedGroupId.value === 'all') return courses.value;
  return courses.value.filter((course) => getCourseGroupId(course) === selectedGroupId.value);
});

const groupedCourses = computed(() => {
  const groupMap = new Map();
  for (const course of visibleCourses.value) {
    const id = getCourseGroupId(course);
    if (!groupMap.has(id)) {
      groupMap.set(id, {
        id,
        title: course.groupTitle,
        meta: `${course.groupGrade} · ${course.groupSubject}`,
        courses: []
      });
    }
    groupMap.get(id).courses.push(course);
  }
  return [...groupMap.values()].sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'));
});

const selectedCourse = computed(() => visibleCourses.value.find((course) => course.id === selectedCourseId.value) || visibleCourses.value[0] || null);
const hasSelectedCourseInVisibleList = computed(() => visibleCourses.value.some((course) => course.id === selectedCourseId.value));

const selectedCreateGroup = computed(() => courseGroups.value.find((group) => group.id === createForm.value.groupId) || null);

function selectCourse(courseId) {
  selectedCourseId.value = courseId;
  store.selectedCourseId = courseId;
}

function selectGroup(groupId) {
  selectedGroupId.value = groupId;
  const firstCourse = visibleCourses.value[0];
  selectCourse(firstCourse?.id || '');
}

function syncCreateGroupFields() {
  if (!selectedCreateGroup.value) return;
  createForm.value.grade = selectedCreateGroup.value.grade;
  createForm.value.subject = selectedCreateGroup.value.subject;
}

function continueDesign() {
  if (!selectedCourse.value) return;
  router.push(`/preclass/courses/${selectedCourse.value.id}/workspace`);
}

async function loadCourses(options = {}) {
  loading.value = true;
  try {
    const [groups, result] = await Promise.all([
      listCourseGroups({ status: 'active' }, options),
      listCourses({
      keyword: keyword.value.trim(),
      status: apiStatus.value,
      page: 1,
      pageSize: 50
      }, options)
    ]);
    groupOptions.value = groups;
    courses.value = mapApiCoursesToUiCourses(result.data);
    if (selectedGroupId.value !== 'all' && !courseGroups.value.some((group) => group.id === selectedGroupId.value)) {
      selectedGroupId.value = 'all';
    }
    if (!selectedCourseId.value && visibleCourses.value.length) {
      selectCourse(visibleCourses.value[0].id);
    }
    if (selectedCourseId.value && !hasSelectedCourseInVisibleList.value) {
      selectCourse(visibleCourses.value[0]?.id || '');
    }
  } catch (error) {
    notify(error.message || '课程列表加载失败');
  } finally {
    loading.value = false;
  }
}

function openCreateGroupDialog() {
  groupForm.value = {
    title: '',
    subject: '物理',
    grade: '高一',
    description: ''
  };
  showCreateGroupDialog.value = true;
}

function openCreateDialog() {
  const group = selectedGroupId.value === 'all' ? courseGroups.value[0] : courseGroups.value.find((item) => item.id === selectedGroupId.value);
  createForm.value = {
    groupId: group?.id || '',
    title: '',
    subject: group?.subject || '物理',
    grade: group?.grade || '高一',
    duration: '45 分钟',
    goal: '',
    knowledgeText: '',
    description: ''
  };
  showCreateDialog.value = true;
}

async function submitNewGroup() {
  const title = groupForm.value.title.trim();
  if (!title) {
    notify('请先填写课程分组名称');
    return;
  }
  try {
    const created = await createCourseGroup({
      title,
      subject: groupForm.value.subject.trim(),
      grade: groupForm.value.grade.trim(),
      description: groupForm.value.description.trim()
    });
    showCreateGroupDialog.value = false;
    await loadCourses({ force: true });
    selectGroup(created.id);
    notify('课程分组已创建，可以继续新建备课单元');
  } catch (error) {
    notify(error.message || '课程分组创建失败');
  }
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
    notify('请先填写备课单元名称');
    return;
  }

  try {
    const created = await createCourse({
      title,
      groupId: createForm.value.groupId,
      subject: createForm.value.subject.trim(),
      grade: createForm.value.grade.trim(),
      duration: createForm.value.duration.trim(),
      goal: createForm.value.goal.trim(),
      knowledge: parseKnowledge(createForm.value.knowledgeText),
      description: createForm.value.description.trim() || createForm.value.goal.trim()
    });
    showCreateDialog.value = false;
    activeTab.value = '进行中';
    await loadCourses({ force: true });
    selectCourse(created.id);
    notify('备课单元已保存，进入课件生成详情');
    router.push(`/preclass/courses/${created.id}/workspace`);
  } catch (error) {
    notify(error.message || '备课单元创建失败');
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
    await loadCourses({ force: true });
  } catch (error) {
    notify(error.message || '课程状态更新失败');
  }
}

async function confirmDeleteGroup(group) {
  if (group.count > 0) {
    notify('该课程分组下还有备课单元，请先删除分组内的全部备课单元');
    return;
  }
  if (!window.confirm(`确定永久删除空课程分组“${group.title}”吗？`)) return;

  loading.value = true;
  try {
    await deleteCourseGroup(group.id);
    if (selectedGroupId.value === group.id) selectedGroupId.value = 'all';
    await loadCourses({ force: true });
    notify('空课程分组已删除');
  } catch (error) {
    notify(error.message || '课程分组删除失败');
  } finally {
    loading.value = false;
  }
}

async function confirmDeleteCourse() {
  if (!selectedCourse.value) return;
  const course = selectedCourse.value;
  const confirmed = window.confirm(
    `确定永久删除备课单元“${course.title}”吗？\n\n对应的 PPT、思维导图、教案、题目、学生作答与学情分析都会一起删除，且无法恢复。`
  );
  if (!confirmed) return;

  loading.value = true;
  try {
    await deleteCoursePermanently(course.id);
    selectedCourseId.value = '';
    await loadCourses({ force: true });
    notify('备课单元及关联数据已永久删除');
  } catch (error) {
    notify(error.message || '备课单元删除失败');
  } finally {
    loading.value = false;
  }
}

onMounted(() => loadCourses({ force: true }));
</script>

<template>
  <main class="course-page">
    <section class="course-head">
      <h1>我的备课</h1>
      <div class="course-head-actions">
        <button class="new-group-btn" type="button" :disabled="loading" @click="openCreateGroupDialog">
          <span class="material-symbols-outlined">create_new_folder</span>
          新建课程分组
        </button>
        <button
          class="delete-group-mode-btn"
          :class="{ active: groupDeleteMode }"
          type="button"
          :disabled="loading"
          :aria-pressed="groupDeleteMode"
          @click="groupDeleteMode = !groupDeleteMode"
        >
          <span class="material-symbols-outlined">{{ groupDeleteMode ? 'done' : 'folder_delete' }}</span>
          {{ groupDeleteMode ? '完成删除' : '删除分组' }}
        </button>
        <button class="new-course-btn" type="button" :disabled="loading" @click="openCreateDialog">
          <span class="material-symbols-outlined">add</span>
          新建备课单元
        </button>
      </div>
    </section>

    <section class="course-tools" aria-label="课程筛选">
      <div class="course-tabs">
        <button
          v-for="tab in tabs"
          :key="tab"
          :class="{ active: activeTab === tab }"
          type="button"
          @click="activeTab = tab; loadCourses({ force: true })"
        >
          {{ tab }}
        </button>
      </div>
      <label class="course-search">
        <span class="material-symbols-outlined">search</span>
        <input v-model="keyword" type="search" placeholder="搜索单元、年级、学科..." @keyup.enter="loadCourses({ force: true })" />
      </label>
      <button class="course-filter" type="button" :disabled="loading" @click="loadCourses({ force: true })">
        {{ loading ? '加载中' : '刷新' }}
        <span class="material-symbols-outlined">refresh</span>
      </button>
    </section>

    <section v-if="courseGroups.length" class="course-group-filter" aria-label="课程分组">
      <button
        type="button"
        :class="{ active: selectedGroupId === 'all' }"
        @click="selectGroup('all')"
      >
        全部课程
        <span>{{ courses.length }}</span>
      </button>
      <div
        v-for="group in courseGroups"
        :key="group.id"
        class="course-group-chip"
        :class="{ active: selectedGroupId === group.id, deleting: groupDeleteMode }"
      >
        <button
          class="course-group-select"
          type="button"
          @click="selectGroup(group.id)"
        >
          {{ group.title }}
          <span>{{ group.count }}</span>
        </button>
        <button
          v-if="groupDeleteMode"
          class="course-group-delete"
          type="button"
          :disabled="loading || group.count > 0"
          :title="group.count > 0 ? '请先删除分组下的备课单元' : `删除空分组 ${group.title}`"
          :aria-label="`删除课程分组 ${group.title}`"
          @click.stop="confirmDeleteGroup(group)"
        >
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>
    </section>

    <section class="course-layout">
      <section class="course-list-card">
        <header class="course-list-head">
          <span>备课单元</span>
          <span class="course-count">{{ visibleCourses.length }} 个</span>
        </header>
        <div v-if="visibleCourses.length" class="course-items">
          <section v-for="group in groupedCourses" :key="group.id" class="course-unit-group">
            <header>
              <strong>{{ group.title }}</strong>
              <span>{{ group.meta }} · {{ group.courses.length }} 个单元</span>
            </header>
            <button
              v-for="course in group.courses"
              :key="course.id"
              class="course-row"
              :class="{ selected: selectedCourse && course.id === selectedCourse.id }"
              type="button"
              @click="selectCourse(course.id)"
            >
              <span class="course-icon"><span class="material-symbols-outlined">{{ course.icon }}</span></span>
              <span class="course-main">
                <strong>{{ course.title }}</strong>
                <p>{{ course.summary }}</p>
                <span class="course-tags">
                  <span v-for="tag in course.tags" :key="tag">{{ tag }}</span>
                </span>
              </span>
              <span class="course-status" :class="{ warn: course.statusTone === 'warn' }">{{ course.status }}</span>
            </button>
          </section>
        </div>
        <div v-else class="course-empty">
          <span class="material-symbols-outlined">school</span>
          <strong>{{ loading ? '正在加载备课单元' : '暂无备课单元' }}</strong>
          <p>{{ loading ? '请稍候' : '可以新建备课单元，或切换筛选条件查看归档内容。' }}</p>
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
            <h2>{{ selectedCourse.title }}</h2>
            <div class="detail-meta">{{ selectedCourse.groupTitle }} ・ {{ selectedCourse.duration }} ・ 上次编辑 {{ selectedCourse.updatedAt }}</div>
          </div>
          <div class="detail-row"><span>所属课程</span><strong>{{ selectedCourse.groupTitle }}</strong></div>
          <div class="detail-row"><span>单元学科</span><strong>{{ selectedCourse.grade }} ・ {{ selectedCourse.subject }}</strong></div>
          <div class="detail-row"><span>课时时长</span><strong>{{ selectedCourse.duration }}</strong></div>
          <div class="detail-row"><span>备课时间</span><strong>{{ selectedCourse.updatedAt }}</strong></div>
          <div class="detail-row"><span>教学目标</span><strong>{{ selectedCourse.goal }}</strong></div>
          <div class="detail-row"><span>核心知识点</span><strong>{{ selectedCourse.todos }}</strong></div>
          <div class="detail-actions">
            <button class="soft-btn" type="button" @click="notify('复制备课单元将在题库 CRUD 后接入')">复制单元</button>
            <button class="soft-btn" type="button" :disabled="loading" @click="toggleArchive">{{ selectedCourse.apiStatus === 'archived' ? '恢复' : '归档' }}</button>
            <button class="danger-btn" type="button" :disabled="loading" @click="confirmDeleteCourse">永久删除</button>
            <button class="primary-btn" type="button" @click="continueDesign">
              继续设计
              <span class="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        </section>
      </aside>
    </section>

    <section v-if="showCreateGroupDialog" class="course-dialog-backdrop" role="presentation" @click.self="showCreateGroupDialog = false">
      <form class="course-dialog group-dialog" @submit.prevent="submitNewGroup">
        <header>
          <div>
            <h2>新建课程分组</h2>
            <p>课程分组是学生端看到的真实课程，例如“高一物理”“高一英语”。创建后可以在其下继续添加备课单元。</p>
          </div>
          <button class="dialog-icon-btn" type="button" aria-label="关闭" @click="showCreateGroupDialog = false">
            <span class="material-symbols-outlined">close</span>
          </button>
        </header>

        <div class="course-form-grid">
          <label class="course-field wide">
            <span>课程分组名称</span>
            <input v-model="groupForm.title" type="text" placeholder="例如：高一物理" />
          </label>
          <label class="course-field">
            <span>年级</span>
            <input v-model="groupForm.grade" type="text" placeholder="高一" />
          </label>
          <label class="course-field">
            <span>学科</span>
            <input v-model="groupForm.subject" type="text" placeholder="物理" />
          </label>
          <label class="course-field wide">
            <span>课程说明</span>
            <textarea v-model="groupForm.description" rows="3" placeholder="可选，用于说明这门真实课程的范围"></textarea>
          </label>
        </div>

        <footer>
          <button class="soft-btn" type="button" @click="showCreateGroupDialog = false">取消</button>
          <button class="primary-btn" type="submit" :disabled="loading">
            创建分组
            <span class="material-symbols-outlined">arrow_forward</span>
          </button>
        </footer>
      </form>
    </section>

    <section v-if="showCreateDialog" class="course-dialog-backdrop" role="presentation" @click.self="showCreateDialog = false">
      <form class="course-dialog" @submit.prevent="submitNewCourse">
        <header>
          <div>
            <h2>新建备课单元</h2>
            <p>备课单元会挂到真实课程下，保存后进入原有课件、导图和教案生成工作台。</p>
          </div>
          <button class="dialog-icon-btn" type="button" aria-label="关闭" @click="showCreateDialog = false">
            <span class="material-symbols-outlined">close</span>
          </button>
        </header>

        <div class="course-form-grid">
          <label class="course-field wide">
            <span>所属课程</span>
            <select v-model="createForm.groupId" @change="syncCreateGroupFields">
              <option value="">按年级和学科自动匹配</option>
              <option v-for="group in courseGroups" :key="group.id" :value="group.id">
                {{ group.title }}
              </option>
            </select>
          </label>
          <label class="course-field wide">
            <span>备课单元名称</span>
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
            <span>单元说明</span>
            <textarea v-model="createForm.description" rows="2" placeholder="可选，用于备课单元列表摘要"></textarea>
          </label>
        </div>

        <footer>
          <button class="soft-btn" type="button" @click="showCreateDialog = false">取消</button>
          <button class="primary-btn" type="submit" :disabled="loading">
            保存并进入备课
            <span class="material-symbols-outlined">arrow_forward</span>
          </button>
        </footer>
      </form>
    </section>
  </main>
</template>
