<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { archiveQuestion, createQuestion, getQuestionBank } from '../data/questionBankApiClient';
import { notify } from '../data/mockStore';

const route = useRoute();
const router = useRouter();
const activeStage = ref('全部');
const keyword = ref('');
const loading = ref(false);
const deletingId = ref('');
const showCreateDialog = ref(false);
const bank = ref(null);
const createForm = ref({
  title: '',
  type: '单选题',
  stage: '课中',
  difficulty: '基础',
  optionsText: '',
  answer: '',
  analysis: '',
  knowledgeText: ''
});
const stages = ['全部', '课前', '课中', '课后'];

const questions = computed(() => {
  const list = bank.value?.questions || [];
  return list.filter((question) => {
    const stageMatched = activeStage.value === '全部' || question.stage === activeStage.value;
    const search = keyword.value.trim().toLowerCase();
    const keywordMatched = !search || `${question.title} ${question.analysis} ${question.knowledge?.join(' ')}`.toLowerCase().includes(search);
    return stageMatched && keywordMatched;
  });
});

const bankTags = computed(() => bank.value?.tags?.length ? bank.value.tags : ['未设置标签']);

function resetCreateForm() {
  createForm.value = {
    title: '',
    type: '单选题',
    stage: '课中',
    difficulty: '基础',
    optionsText: '',
    answer: '',
    analysis: '',
    knowledgeText: ''
  };
}

function parseList(text) {
  return String(text || '')
    .split(/[\n,，、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function loadBank() {
  loading.value = true;
  try {
    bank.value = await getQuestionBank(route.params.bankId);
  } catch (error) {
    notify(error.message || '题库加载失败');
    bank.value = null;
  } finally {
    loading.value = false;
  }
}

function openCreateDialog() {
  resetCreateForm();
  showCreateDialog.value = true;
}

async function submitQuestion() {
  const title = createForm.value.title.trim();
  if (!title) {
    notify('请先填写题干');
    return;
  }
  try {
    await createQuestion(bank.value.id, {
      title,
      type: createForm.value.type.trim(),
      stage: createForm.value.stage.trim(),
      difficulty: createForm.value.difficulty.trim(),
      options: parseList(createForm.value.optionsText),
      answer: createForm.value.answer.trim(),
      analysis: createForm.value.analysis.trim(),
      knowledge: parseList(createForm.value.knowledgeText)
    });
    showCreateDialog.value = false;
    notify('题目已保存到数据库');
    await loadBank();
  } catch (error) {
    notify(error.message || '题目保存失败');
  }
}

async function removeQuestion(question) {
  if (deletingId.value) return;
  const confirmed = window.confirm(`确定删除这道题吗？\n${question.title}`);
  if (!confirmed) return;
  deletingId.value = question.id;
  try {
    await archiveQuestion(question.id);
    notify('题目已删除');
    await loadBank();
  } catch (error) {
    notify(error.message || '题目删除失败');
  } finally {
    deletingId.value = '';
  }
}

onMounted(loadBank);
watch(() => route.params.bankId, loadBank);
</script>

<template>
  <main class="module-page question-page bank-detail-page">
    <section class="module-head">
      <div>
        <h1>题库</h1>
        <p>{{ bank?.description || '题目已存入数据库，可手动新增和删除。' }}</p>
      </div>
      <div class="hero-actions">
        <button class="soft-btn back-btn" type="button" @click="router.push('/question-banks')">
          <span class="material-symbols-outlined">chevron_left</span>
          返回题库
        </button>
        <button class="primary-btn" type="button" :disabled="!bank" @click="openCreateDialog">
          <span class="material-symbols-outlined">add</span>
          手动新增题目
        </button>
        <button class="soft-btn" type="button" :disabled="!bank" @click="router.push(`/question-banks/${bank.id}/generate`)">
          <span class="material-symbols-outlined">auto_awesome</span>
          AI 生成题目
        </button>
        <button class="soft-btn" type="button" :disabled="!bank" @click="router.push(`/question-banks/${bank.id}/knowledge-graph`)">
          <span class="material-symbols-outlined">hub</span>
          知识图谱
        </button>
        <button class="soft-btn" type="button" :disabled="!bank" @click="router.push(`/question-banks/${bank.id}/paper`)">
          <span class="material-symbols-outlined">assignment</span>
          智能组卷
        </button>
      </div>
    </section>

    <section class="module-tools">
      <div class="segmented">
        <button
          v-for="stage in stages"
          :key="stage"
          :class="{ active: activeStage === stage }"
          type="button"
          @click="activeStage = stage"
        >
          {{ stage }}
        </button>
      </div>
      <label class="module-search">
        <span class="material-symbols-outlined">search</span>
        <input v-model="keyword" type="search" placeholder="搜索题干、答案、知识点..." />
      </label>
      <button class="course-filter" type="button" :disabled="loading" @click="loadBank">
        {{ loading ? '加载中' : '刷新' }}
        <span class="material-symbols-outlined">sync</span>
      </button>
    </section>

    <section v-if="!bank && !loading" class="course-empty">
      <span class="material-symbols-outlined">quiz</span>
      <strong>题库不存在</strong>
      <p>请返回题库列表选择数据库里的题库。</p>
    </section>

    <section v-else class="two-col">
      <div class="list-panel">
        <article v-if="!loading && !questions.length" class="course-empty">
          <span class="material-symbols-outlined">edit_note</span>
          <strong>暂无题目</strong>
          <p>点击“手动新增题目”，题目会保存到当前题库的数据库记录里。</p>
        </article>
        <article
          v-for="question in questions"
          :key="question.id"
          class="question-row"
        >
          <div>
            <div class="card-meta" style="margin-top:0">
              <span>{{ question.stage || '未设置阶段' }}</span>
              <span>{{ question.type }}</span>
              <span>{{ question.difficulty }}</span>
              <span v-if="question.accuracy !== null">正确率 {{ question.accuracy }}%</span>
            </div>
            <h3>{{ question.title }}</h3>
            <p>{{ question.options?.length ? question.options.join('　') : '无选项题，查看答案解析。' }}</p>
            <p v-if="question.answer" class="question-answer">答案：{{ question.answer }}</p>
          </div>
          <div class="row-actions">
            <button class="soft-btn" type="button" @click="notify(question.analysis || '暂无解析')">查看解析</button>
            <button class="soft-btn danger" type="button" :disabled="deletingId === question.id" @click="removeQuestion(question)">
              {{ deletingId === question.id ? '删除中' : '删除题目' }}
            </button>
          </div>
        </article>
      </div>

      <aside class="surface-card side-panel">
        <span class="small-chip">题库概览</span>
        <h2>{{ bank?.count || 0 }} 道题</h2>
        <p>{{ bank ? `${bank.subject} · ${bank.usage || '未设置用途'} · ${bank.grade || '未分级'}` : '加载中' }}</p>
        <div class="tag-cloud">
          <span v-for="tag in bankTags" :key="tag">{{ tag }}</span>
        </div>
        <div class="side-stat">
          <strong>{{ questions.length }}</strong><span>当前筛选结果</span>
        </div>
        <div class="side-stat">
          <strong>{{ bank?.status === 'active' ? '启用' : '归档' }}</strong><span>数据库状态</span>
        </div>
        <div class="side-actions">
          <button class="outline-generate-btn" type="button" :disabled="!bank" @click="openCreateDialog">
            <span class="material-symbols-outlined">add_circle</span>
            新增题目
          </button>
          <button class="outline-generate-btn" type="button" :disabled="!bank" @click="router.push(`/question-banks/${bank.id}/paper`)">
            <span class="material-symbols-outlined">assignment</span>
            智能组卷
          </button>
        </div>
      </aside>
    </section>

    <section v-if="showCreateDialog" class="course-dialog-backdrop" role="presentation" @click.self="showCreateDialog = false">
      <form class="course-dialog" @submit.prevent="submitQuestion">
        <header>
          <div>
            <h2>新增题目</h2>
            <p>题目会保存到当前题库：{{ bank?.title }}</p>
          </div>
          <button class="dialog-icon-btn" type="button" aria-label="关闭" @click="showCreateDialog = false">
            <span class="material-symbols-outlined">close</span>
          </button>
        </header>

        <div class="course-form-grid">
          <label class="course-field wide">
            <span>题干</span>
            <textarea v-model="createForm.title" rows="3" placeholder="请输入题干"></textarea>
          </label>
          <label class="course-field">
            <span>题型</span>
            <input v-model="createForm.type" type="text" placeholder="单选题" />
          </label>
          <label class="course-field">
            <span>阶段</span>
            <input v-model="createForm.stage" type="text" placeholder="课中" />
          </label>
          <label class="course-field">
            <span>难度</span>
            <input v-model="createForm.difficulty" type="text" placeholder="基础" />
          </label>
          <label class="course-field wide">
            <span>选项</span>
            <textarea v-model="createForm.optionsText" rows="3" placeholder="每行一个选项，或用逗号分隔"></textarea>
          </label>
          <label class="course-field">
            <span>答案</span>
            <input v-model="createForm.answer" type="text" placeholder="C / 3 m/s² / 正确" />
          </label>
          <label class="course-field wide">
            <span>解析</span>
            <textarea v-model="createForm.analysis" rows="3" placeholder="请输入答案解析"></textarea>
          </label>
          <label class="course-field wide">
            <span>知识点</span>
            <input v-model="createForm.knowledgeText" type="text" placeholder="用逗号分隔，例如：F=ma，合外力计算" />
          </label>
        </div>

        <footer>
          <button class="soft-btn" type="button" @click="showCreateDialog = false">取消</button>
          <button class="primary-btn" type="submit">
            保存题目
            <span class="material-symbols-outlined">save</span>
          </button>
        </footer>
      </form>
    </section>
  </main>
</template>

<style scoped>
.question-page :deep(.module-head h1) {
  font-family: var(--font-serif);
  font-weight: 800;
}

.bank-detail-page {
  --bank-detail-workspace-height: calc(100vh - 242px);
}

.bank-detail-page :deep(.module-tools) {
  margin-top: 18px;
}

.bank-detail-page .two-col {
  height: var(--bank-detail-workspace-height);
  min-height: 0;
  align-items: stretch;
}

.bank-detail-page .list-panel {
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.bank-detail-page :deep(.question-row) {
  background: rgba(255, 255, 255, .72);
}

.bank-detail-page .side-panel {
  min-height: 0;
  overflow-y: auto;
}

.question-answer {
  margin-top: 8px;
  color: var(--green);
  font-weight: 700;
}

.row-actions {
  display: grid;
  gap: 10px;
  min-width: 116px;
}

.soft-btn.danger {
  color: #a54839;
}

.side-actions {
  display: grid;
  gap: 10px;
}

.side-panel h2 {
  margin-top: 18px;
  font-family: var(--font-mono);
  font-size: 28px;
}

.side-panel p {
  margin-top: 8px;
  color: var(--muted);
  font-size: 13px;
}

.tag-cloud {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 18px 0;
}

.tag-cloud span {
  display: inline-flex;
  height: 28px;
  align-items: center;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--mint);
  color: #1f8847;
  font-size: 12px;
  font-weight: 700;
}

.side-stat {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 52px;
  border-top: 1px solid var(--line);
}

.side-stat strong {
  font-family: var(--font-mono);
  font-size: 26px;
}

.side-stat span {
  color: var(--muted);
  font-size: 13px;
}
</style>
