<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { createQuestionBank, listQuestionBanks } from '../data/questionBankApiClient';
import { getCourseQuestions, notify, store } from '../data/mockStore';

const router = useRouter();
const activeTab = ref('全部');
const keyword = ref('');
const loading = ref(false);
const bankSaving = ref(false);
const bankDialogOpen = ref(false);
const banks = ref([]);
const bankForm = ref({
  title: '',
  subject: '物理',
  grade: '高一',
  usage: '课中练习',
  description: '',
  tagsText: ''
});
const tabs = ['全部', '物理', '数学', '已归档'];

const filteredBanks = computed(() => {
  if (activeTab.value === '全部') return banks.value;
  if (activeTab.value === '已归档') return banks.value.filter((bank) => bank.status === 'archived');
  return banks.value.filter((bank) => bank.subject === activeTab.value);
});

const newtonCount = computed(() => banks.value
  .filter((bank) => `${bank.title} ${bank.description} ${bank.tags?.join(' ')}`.includes('牛顿') || `${bank.title}`.toLowerCase().includes('newton'))
  .reduce((sum, bank) => sum + Number(bank.count || 0), 0));

async function loadBanks(options = {}) {
  loading.value = true;
  try {
    const result = await listQuestionBanks({
      keyword: keyword.value.trim(),
      status: activeTab.value === '已归档' ? 'archived' : 'active',
      pageSize: 100
    }, options);
    banks.value = result.data;
  } catch (error) {
    notify(error.message || '题库加载失败');
  } finally {
    loading.value = false;
  }
}

function resetBankForm() {
  bankForm.value = {
    title: '',
    subject: '物理',
    grade: '高一',
    usage: '课中练习',
    description: '',
    tagsText: ''
  };
}

function openCreateBank() {
  resetBankForm();
  bankDialogOpen.value = true;
}

function closeCreateBank() {
  if (bankSaving.value) return;
  bankDialogOpen.value = false;
}

function parseTags(text) {
  return String(text || '')
    .split(/[\n,，、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function submitBank() {
  const title = bankForm.value.title.trim();
  const subject = bankForm.value.subject.trim();
  if (!title) {
    notify('请先填写题库名称');
    return;
  }
  if (!subject) {
    notify('请先填写学科');
    return;
  }

  bankSaving.value = true;
  try {
    const created = await createQuestionBank({
      title,
      subject,
      grade: bankForm.value.grade.trim(),
      usage: bankForm.value.usage.trim(),
      description: bankForm.value.description.trim(),
      tags: parseTags(bankForm.value.tagsText)
    });
    bankDialogOpen.value = false;
    notify('题库已保存到数据库');
    await loadBanks({ force: true });
    if (created?.id) {
      router.push(`/question-banks/${created.id}`);
    }
  } catch (error) {
    notify(error.message || '题库保存失败');
  } finally {
    bankSaving.value = false;
  }
}

onMounted(loadBanks);
</script>

<template>
  <main class="module-page question-page">
    <section class="module-head">
      <div>
        <h1>题库</h1>
        <p>题库和题目已接入数据库，可进入题库后手动增加或删除题目。</p>
      </div>
      <div class="hero-actions">
        <button class="soft-btn" type="button" :disabled="loading" @click="loadBanks">
          <span class="material-symbols-outlined">sync</span>
          刷新
        </button>
        <button class="primary-btn" type="button" @click="openCreateBank">
          <span class="material-symbols-outlined">add</span>
          新增题库
        </button>
        <button class="primary-btn" type="button" @click="router.push('/question-banks/newton-laws-bank/generate')">
          <span class="material-symbols-outlined">auto_awesome</span>
          AI 生成题目
        </button>
      </div>
    </section>

    <section class="question-overview">
      <article>
        <strong>{{ banks.length }}</strong>
        <span>题库</span>
      </article>
      <article>
        <strong>{{ newtonCount }}</strong>
        <span>牛顿相关题</span>
      </article>
      <article>
        <strong>{{ getCourseQuestions(store.selectedCourseId).length }}</strong>
        <span>课程引用</span>
      </article>
    </section>

    <section class="module-tools">
      <div class="segmented">
        <button
          v-for="tab in tabs"
          :key="tab"
          :class="{ active: activeTab === tab }"
          type="button"
          @click="activeTab = tab; loadBanks({ force: true })"
        >
          {{ tab }}
        </button>
      </div>
      <label class="module-search">
        <span class="material-symbols-outlined">search</span>
        <input v-model="keyword" type="search" placeholder="搜索题库、知识点..." @keydown.enter="loadBanks({ force: true })" />
      </label>
      <button class="course-filter" type="button" :disabled="loading" @click="loadBanks({ force: true })">
        {{ loading ? '加载中' : '数据库' }}
        <span class="material-symbols-outlined">database</span>
      </button>
    </section>

    <section v-if="!loading && !filteredBanks.length" class="course-empty">
      <span class="material-symbols-outlined">quiz</span>
      <strong>暂无题库</strong>
      <p>点击“新增题库”手动创建题库，进入题库后再维护题目。</p>
    </section>

    <section v-else class="module-grid">
      <article
        v-for="bank in filteredBanks"
        :key="bank.id"
        class="module-card lift-card bank-card"
      >
        <div class="folder-preview">
          <span class="material-symbols-outlined">folder_open</span>
          <strong>{{ bank.count || 0 }}</strong>
          <small>道题</small>
        </div>
        <h2>{{ bank.title }}</h2>
        <p>{{ bank.description || '暂无说明' }}</p>
        <div class="card-meta">
          <span>{{ bank.subject }}</span>
          <span>{{ bank.usage || '未设置用途' }}</span>
          <span>{{ bank.grade || '未分级' }}</span>
        </div>
        <div class="card-actions">
          <button class="primary-btn" type="button" @click="router.push(`/question-banks/${bank.id}`)">进入题库</button>
          <button class="soft-btn" type="button" @click="router.push(`/question-banks/${bank.id}/generate`)">AI 生成</button>
        </div>
      </article>
    </section>

    <section v-if="bankDialogOpen" class="course-dialog-backdrop" role="presentation" @click.self="closeCreateBank">
      <form class="course-dialog question-bank-dialog" role="dialog" aria-modal="true" aria-label="新增题库" @submit.prevent="submitBank">
        <header>
          <div>
            <h2>新增题库</h2>
            <p>手动创建分类题库，保存后可继续添加题目。</p>
          </div>
          <button class="dialog-icon-btn" type="button" aria-label="关闭" :disabled="bankSaving" @click="closeCreateBank">
            <span class="material-symbols-outlined">close</span>
          </button>
        </header>

        <div class="course-form-grid">
          <label class="course-field wide">
            <span>题库名称</span>
            <input v-model="bankForm.title" type="text" placeholder="例如：牛顿第二定律基础题" />
          </label>
          <label class="course-field">
            <span>学科</span>
            <input v-model="bankForm.subject" type="text" placeholder="物理" />
          </label>
          <label class="course-field">
            <span>年级</span>
            <input v-model="bankForm.grade" type="text" placeholder="高一" />
          </label>
          <label class="course-field wide">
            <span>使用场景</span>
            <input v-model="bankForm.usage" type="text" placeholder="课前诊断 / 课中练习 / 课后巩固" />
          </label>
          <label class="course-field wide">
            <span>题库说明</span>
            <textarea v-model="bankForm.description" rows="3" placeholder="可选，用于说明这套题的使用目标和范围"></textarea>
          </label>
          <label class="course-field wide">
            <span>标签</span>
            <input v-model="bankForm.tagsText" type="text" placeholder="用逗号分隔，例如：F=ma，合外力，基础题" />
          </label>
        </div>

        <footer>
          <button class="soft-btn" type="button" :disabled="bankSaving" @click="closeCreateBank">取消</button>
          <button class="primary-btn" type="submit" :disabled="bankSaving">
            {{ bankSaving ? '保存中' : '保存题库' }}
            <span class="material-symbols-outlined">save</span>
          </button>
        </footer>
      </form>
    </section>

    <section class="question-lab">
      <article>
        <span>课堂题使用流</span>
        <div>
          <strong>课前诊断</strong>
          <i></i>
          <strong>课中下发</strong>
          <i></i>
          <strong>课后讲评</strong>
        </div>
      </article>
      <article>
        <span>数据来源</span>
        <p>题库列表与题目数量来自 PostgreSQL，新增和删除会即时写回数据库。</p>
      </article>
    </section>
  </main>
</template>

<style scoped>
.bank-card {
  display: grid;
  grid-template-rows: 96px auto auto auto 1fr;
  position: relative;
  overflow: hidden;
}

.question-page :deep(.module-head h1) {
  font-family: var(--font-serif);
  font-weight: 800;
}

.question-overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 20px 0 16px;
}

.question-overview article {
  display: flex;
  min-height: 70px;
  align-items: end;
  justify-content: space-between;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(255, 255, 255, .64);
  padding: 14px 16px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .72);
}

.question-overview strong {
  font-family: var(--font-mono);
  font-size: 34px;
  line-height: .9;
}

.question-overview span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.folder-preview {
  display: grid;
  grid-template-columns: 44px auto 1fr;
  align-items: center;
  gap: 10px;
  height: 82px;
  margin-bottom: 16px;
  padding: 0 16px;
  border-radius: 12px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, .56), transparent 56%),
    rgba(220, 246, 232, .78);
  color: var(--teal);
}

.folder-preview .material-symbols-outlined {
  font-size: 42px;
}

.folder-preview strong {
  font-family: var(--font-mono);
  font-size: 32px;
  line-height: 1;
}

.folder-preview small {
  align-self: end;
  padding-bottom: 25px;
  color: var(--muted);
  font-size: 12px;
}

.question-lab {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
  gap: 16px;
  margin-top: 18px;
}

.question-lab article {
  min-height: 108px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: rgba(255, 255, 255, .58);
  padding: 18px;
}

.question-lab span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.question-lab div {
  display: grid;
  grid-template-columns: auto 1fr auto 1fr auto;
  gap: 12px;
  align-items: center;
  margin-top: 20px;
}

.question-lab strong {
  font-family: var(--font-serif);
  font-size: 18px;
}

.question-lab i {
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--green), transparent);
}

.question-lab p {
  margin-top: 18px;
  max-width: 440px;
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 18px;
  line-height: 1.55;
}

.question-bank-dialog {
  width: min(560px, calc(100vw - 32px));
}

.question-bank-dialog :deep(.primary-btn:disabled),
.question-bank-dialog :deep(.soft-btn:disabled),
.question-bank-dialog :deep(.dialog-icon-btn:disabled) {
  cursor: not-allowed;
  opacity: .58;
}

@media (max-width: 720px) {
  .question-overview,
  .question-lab {
    grid-template-columns: 1fr;
  }

  .question-lab div {
    grid-template-columns: 1fr;
  }

  .question-lab i {
    display: none;
  }
}
</style>
