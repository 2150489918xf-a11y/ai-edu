<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  addKnowledgeCategory,
  addKnowledgeMaterial,
  bindMaterialsToCourse,
  buildEvidencePack,
  editKnowledgeCategory,
  editKnowledgeMaterial,
  getKnowledgeBaseMaterials,
  parseKnowledgeMaterial,
  removeKnowledgeCategory,
  removeKnowledgeMaterial,
  uploadKnowledgeMaterial
} from '../data/mockApi';
import { knowledgeEvidenceLabels } from '../data/teachingMockData';
import { notify } from '../data/mockStore';

const router = useRouter();
const loading = ref(false);
const uploading = ref(false);
const activeCategory = ref('all');
const activeType = ref('all');
const keyword = ref('');
const categories = ref([]);
const allMaterials = ref([]);
const materials = ref([]);
const selectedMaterialId = ref('');
const categoryDialogOpen = ref(false);
const materialDialogOpen = ref(false);
const editingCategory = ref(null);
const editingMaterial = ref(null);
const categoryForm = ref({ name: '', icon: 'folder_open' });
const materialForm = ref({
  categoryId: '',
  title: '',
  type: 'PDF',
  subject: '数学',
  grade: '高一',
  size: '',
  pages: 0,
  parseStatus: 'parsed',
  source: '手动添加',
  tagsText: '',
  knowledgeText: '',
  evidenceCount: 0,
  chunks: 0
});

const typeTabs = [
  { id: 'all', label: '全部' },
  { id: 'PDF', label: 'PDF' },
  { id: 'PPT', label: 'PPT' },
  { id: 'DOC', label: '文档' }
];

const selectedMaterial = computed(() => (
  materials.value.find((item) => item.id === selectedMaterialId.value) || materials.value[0] || null
));

const indexedMaterials = computed(() => {
  if (activeCategory.value === 'all') {
    return allMaterials.value;
  }
  return allMaterials.value.filter((item) => item.categoryId === activeCategory.value);
});
const indexedCount = computed(() => (
  indexedMaterials.value.filter((item) => item.vectorIndexed && item.bm25Indexed).length
));
const indexedTotal = computed(() => indexedMaterials.value.length || 1);
const indexedRatio = computed(() => Math.round((indexedCount.value / indexedTotal.value) * 100));

async function refreshMaterials() {
  loading.value = true;
  const [allResult, result] = await Promise.all([
    getKnowledgeBaseMaterials({ fast: true }),
    getKnowledgeBaseMaterials({
      categoryId: activeCategory.value,
      type: activeType.value,
      keyword: keyword.value
    })
  ]);
  categories.value = result.categories;
  allMaterials.value = allResult.materials;
  materials.value = result.materials;
  if (!materials.value.some((item) => item.id === selectedMaterialId.value)) {
    selectedMaterialId.value = materials.value[0]?.id || '';
  }
  loading.value = false;
}

function selectCategory(categoryId) {
  activeCategory.value = categoryId;
  refreshMaterials();
}

function selectType(typeId) {
  activeType.value = typeId;
  refreshMaterials();
}

function openCreateCategory() {
  editingCategory.value = null;
  categoryForm.value = { name: '', icon: 'folder_open' };
  categoryDialogOpen.value = true;
}

function openEditCategory(category) {
  editingCategory.value = category;
  categoryForm.value = {
    name: category.name,
    icon: category.icon || 'folder_open'
  };
  categoryDialogOpen.value = true;
}

async function submitCategory() {
  try {
    if (editingCategory.value) {
      await editKnowledgeCategory(editingCategory.value.id, categoryForm.value);
      notify('分类已更新');
    } else {
      const category = await addKnowledgeCategory(categoryForm.value);
      activeCategory.value = category.id;
      notify('分类已添加');
    }
    categoryDialogOpen.value = false;
    await refreshMaterials();
  } catch (error) {
    notify(error.message || '分类保存失败');
  }
}

async function deleteCategory(category) {
  if (!category || category.id === 'all') return;
  try {
    await removeKnowledgeCategory(category.id);
    if (activeCategory.value === category.id) {
      activeCategory.value = 'all';
    }
    notify('分类已删除');
    await refreshMaterials();
  } catch (error) {
    notify(error.message || '分类删除失败');
  }
}

function parseListText(value) {
  return String(value || '')
    .split(/[，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseKnowledgeText(value) {
  return parseListText(value).map((name, index) => ({
    id: `kp-manual-${index + 1}-${name.replace(/\s+/g, '-')}`,
    name
  }));
}

function openCreateMaterial() {
  editingMaterial.value = null;
  materialForm.value = {
    categoryId: activeCategory.value === 'all' ? categories.value.find((item) => item.id !== 'all')?.id || '' : activeCategory.value,
    title: '',
    type: 'PDF',
    subject: '数学',
    grade: '高一',
    size: '',
    pages: 0,
    parseStatus: 'parsed',
    source: '手动添加',
    tagsText: '',
    knowledgeText: '',
    evidenceCount: 0,
    chunks: 0
  };
  materialDialogOpen.value = true;
}

function openEditMaterial(material) {
  editingMaterial.value = material;
  materialForm.value = {
    categoryId: material.categoryId,
    title: material.title,
    type: material.type,
    subject: material.subject,
    grade: material.grade,
    size: material.size,
    pages: material.pages,
    parseStatus: material.parseStatus || material.status || 'parsed',
    source: material.source,
    tagsText: (material.tags || []).join('，'),
    knowledgeText: (material.knowledgePoints || []).map((item) => item.name || item).join('，'),
    evidenceCount: material.evidenceCount,
    chunks: material.chunks
  };
  materialDialogOpen.value = true;
}

function buildMaterialPayload() {
  return {
    categoryId: materialForm.value.categoryId,
    title: materialForm.value.title,
    type: materialForm.value.type,
    subject: materialForm.value.subject,
    grade: materialForm.value.grade,
    size: materialForm.value.size,
    pages: Number(materialForm.value.pages || 0),
    parseStatus: materialForm.value.parseStatus,
    source: materialForm.value.source,
    tags: parseListText(materialForm.value.tagsText),
    knowledgePoints: parseKnowledgeText(materialForm.value.knowledgeText),
    evidenceCount: Number(materialForm.value.evidenceCount || 0),
    chunks: Number(materialForm.value.chunks || 0),
    vectorIndexed: materialForm.value.parseStatus === 'parsed',
    bm25Indexed: materialForm.value.parseStatus === 'parsed',
    evidenceTypes: ['material_chunk'],
    availableActions: ['引用到课程', '生成思维导图', '用于 AI 生成课件']
  };
}

async function submitMaterial() {
  try {
    let material;
    if (editingMaterial.value) {
      material = await editKnowledgeMaterial(editingMaterial.value.id, buildMaterialPayload());
      notify('资料已更新');
    } else {
      material = await addKnowledgeMaterial(buildMaterialPayload());
      notify('资料已添加');
    }
    materialDialogOpen.value = false;
    await refreshMaterials();
    selectedMaterialId.value = material?.id || selectedMaterialId.value;
  } catch (error) {
    notify(error.message || '资料保存失败');
  }
}

async function deleteMaterial(material) {
  if (!material) return;
  try {
    await removeKnowledgeMaterial(material.id);
    notify('资料已删除');
    await refreshMaterials();
  } catch (error) {
    notify(error.message || '资料删除失败');
  }
}

async function simulateUpload() {
  if (uploading.value) return;
  uploading.value = true;
  const material = await uploadKnowledgeMaterial({
    name: '二次函数单元教学补充资料.pdf',
    type: 'PDF',
    size: '1.9 MB',
    categoryId: activeCategory.value === 'all' ? 'math-g10' : activeCategory.value
  });
  notify('资料上传成功，开始解析');
  await refreshMaterials();
  selectedMaterialId.value = material.id;
  const parsed = await parseKnowledgeMaterial(material.id);
  await refreshMaterials();
  selectedMaterialId.value = parsed?.id || material.id;
  uploading.value = false;
  notify('资料解析完成，已生成 Evidence');
}

async function bindSelectedToCourse() {
  if (!selectedMaterial.value) return;
  await bindMaterialsToCourse({
    courseId: 'math-quadratic',
    courseName: '二次函数图像与性质',
    materialIds: [selectedMaterial.value.id]
  });
  await refreshMaterials();
  selectedMaterialId.value = selectedMaterial.value.id;
  notify('已引用到课程，可用于生成思维导图');
}

async function prepareEvidencePack(taskType) {
  if (!selectedMaterial.value) return;
  const result = await buildEvidencePack({
    taskType,
    materialIds: [selectedMaterial.value.id]
  });
  notify(`Evidence Pack 已准备，覆盖率 ${result.coverage}%`);
  if (taskType === 'mindmap') {
    router.push('/preclass/courses/math-quadratic/mindmap');
  }
}

onMounted(refreshMaterials);
</script>

<template>
  <main class="module-page kb-page">
    <section class="module-head">
      <div>
        <h1>知识库管理</h1>
        <p>管理教材、课标、PPT、学情报告和老师备注，形成可被备课、思维导图、课件和题目生成引用的教学 evidence。</p>
      </div>
      <div class="hero-actions">
        <button class="soft-btn" type="button" @click="notify('批量导入任务已创建')">
          <span class="material-symbols-outlined">drive_folder_upload</span>
          批量导入
        </button>
        <button class="primary-btn" type="button" :disabled="uploading" @click="simulateUpload">
          <span class="material-symbols-outlined">{{ uploading ? 'progress_activity' : 'upload_file' }}</span>
          {{ uploading ? '上传解析中' : '上传资料' }}
        </button>
      </div>
    </section>

    <section class="kb-layout">
      <aside class="surface-card kb-category-panel">
        <header class="kb-panel-head">
          <div>
            <span class="small-chip">资料分类</span>
            <h2>分类目录</h2>
          </div>
          <button class="circle-action" type="button" @click="openCreateCategory">
            <span class="material-symbols-outlined">add</span>
          </button>
        </header>

        <nav class="kb-category-list" aria-label="知识库资料分类">
          <article
            v-for="category in categories"
            :key="category.id"
            class="kb-category"
            :class="{ active: activeCategory === category.id }"
          >
            <button class="kb-category-main" type="button" @click="selectCategory(category.id)">
              <span class="material-symbols-outlined">{{ category.icon }}</span>
              <strong>{{ category.name }}</strong>
              <em>{{ category.count }}</em>
            </button>
            <div v-if="category.id !== 'all'" class="kb-inline-actions">
              <button type="button" aria-label="编辑分类" @click="openEditCategory(category)">
                <span class="material-symbols-outlined">edit</span>
              </button>
              <button type="button" aria-label="删除分类" @click="deleteCategory(category)">
                <span class="material-symbols-outlined">delete</span>
              </button>
            </div>
          </article>
        </nav>

        <section class="kb-capacity">
          <div>
            <span>已索引资料</span>
            <strong>{{ indexedCount }} / {{ indexedTotal }}</strong>
          </div>
          <i><b :style="{ width: `${indexedRatio}%` }"></b></i>
        </section>
      </aside>

      <section class="surface-card kb-main-panel">
        <header class="kb-toolbar">
          <label class="module-search">
            <span class="material-symbols-outlined">search</span>
            <input
              v-model="keyword"
              type="search"
              placeholder="搜索文件名、知识点、标签..."
              @keyup.enter="refreshMaterials"
            />
          </label>
          <div class="segmented">
            <button
              v-for="tab in typeTabs"
              :key="tab.id"
              :class="{ active: activeType === tab.id }"
              type="button"
              @click="selectType(tab.id)"
            >
              {{ tab.label }}
            </button>
          </div>
        </header>

        <div class="kb-status-row">
          <span class="small-chip">
            <span class="material-symbols-outlined">hub</span>
            Agentic RAG Evidence
          </span>
          <p>模拟 BM25 + 向量召回 + 知识点匹配 + 教学任务权重排序。</p>
          <button class="soft-btn" type="button" :disabled="loading" @click="refreshMaterials">
            <span class="material-symbols-outlined">refresh</span>
            刷新
          </button>
          <button class="primary-btn" type="button" @click="openCreateMaterial">
            <span class="material-symbols-outlined">add</span>
            手动添加
          </button>
        </div>

        <section class="kb-table" :class="{ loading }">
          <header class="kb-table-head">
            <span>资料名称</span>
            <span>大小</span>
            <span>状态</span>
            <span>Evidence</span>
          </header>

          <article
            v-for="material in materials"
            :key="material.id"
            class="kb-row"
            :class="{ active: selectedMaterial?.id === material.id }"
          >
            <button class="kb-row-main" type="button" @click="selectedMaterialId = material.id">
              <span class="kb-file-icon">{{ material.type }}</span>
              <div>
                <strong>{{ material.title }}</strong>
                <p>{{ material.grade }} · {{ material.subject }} · {{ material.uploadedAt }}</p>
                <div class="card-meta">
                  <span v-for="tag in material.tags" :key="tag">{{ tag }}</span>
                </div>
              </div>
            </button>
            <span>{{ material.size }}</span>
            <span class="kb-parse-chip" :class="material.status">{{ material.parseLabel }}</span>
            <strong>{{ material.evidenceCount }}</strong>
            <div class="kb-row-actions">
              <button type="button" aria-label="编辑资料" @click="openEditMaterial(material)">
                <span class="material-symbols-outlined">edit</span>
              </button>
              <button type="button" aria-label="删除资料" @click="deleteMaterial(material)">
                <span class="material-symbols-outlined">delete</span>
              </button>
            </div>
          </article>

          <div v-if="!materials.length" class="kb-empty">
            <span class="material-symbols-outlined">folder_off</span>
            <strong>没有匹配资料</strong>
            <p>调整分类、类型或关键词后重新搜索。</p>
          </div>
        </section>
      </section>

      <aside class="surface-card kb-detail-panel">
        <template v-if="selectedMaterial">
          <header class="kb-detail-head">
            <span class="kb-file-preview">{{ selectedMaterial.type }}</span>
            <div>
              <span class="small-chip">{{ selectedMaterial.source }}</span>
              <h2>{{ selectedMaterial.title }}</h2>
              <p>{{ selectedMaterial.uploadedAt }} 更新</p>
            </div>
          </header>

          <section class="kb-detail-section">
            <h3>基本信息</h3>
            <div class="info-row"><span>文件大小</span><strong>{{ selectedMaterial.size }}</strong></div>
            <div class="info-row"><span>页数</span><strong>{{ selectedMaterial.pages }} 页</strong></div>
            <div class="info-row"><span>切片数量</span><strong>{{ selectedMaterial.chunks }}</strong></div>
            <div class="info-row"><span>Evidence</span><strong>{{ selectedMaterial.evidenceCount }}</strong></div>
          </section>

          <section class="kb-detail-section">
            <h3>提取知识点</h3>
            <div class="knowledge-tags">
              <span v-for="point in selectedMaterial.knowledgePoints" :key="point.id">{{ point.name }}</span>
              <em v-if="!selectedMaterial.knowledgePoints.length">解析完成后自动展示</em>
            </div>
          </section>

          <section class="kb-detail-section">
            <h3>Evidence 类型</h3>
            <div class="knowledge-tags">
              <span v-for="type in selectedMaterial.evidenceTypes" :key="type">{{ knowledgeEvidenceLabels[type] || type }}</span>
              <em v-if="!selectedMaterial.evidenceTypes.length">暂无 evidence</em>
            </div>
          </section>

          <section class="kb-detail-section">
            <h3>引用课程</h3>
            <p class="kb-muted">{{ selectedMaterial.usedByCourses.length ? selectedMaterial.usedByCourses.join('、') : '尚未引用到课程' }}</p>
          </section>

          <div class="kb-detail-actions">
            <button class="soft-btn" type="button" @click="openEditMaterial(selectedMaterial)">
              编辑资料
            </button>
            <button class="soft-btn danger-inline" type="button" @click="deleteMaterial(selectedMaterial)">
              删除资料
            </button>
            <button class="primary-btn" type="button" :disabled="selectedMaterial.status !== 'parsed'" @click="bindSelectedToCourse">
              引用到课程
            </button>
            <button class="soft-btn" type="button" :disabled="selectedMaterial.status !== 'parsed'" @click="prepareEvidencePack('mindmap')">
              生成思维导图依据
            </button>
            <button class="soft-btn" type="button" :disabled="selectedMaterial.status !== 'parsed'" @click="prepareEvidencePack('ppt')">
              用于 AI 生成课件
            </button>
          </div>
        </template>
      </aside>
    </section>

    <Teleport to="body">
      <div v-if="categoryDialogOpen" class="kb-dialog-backdrop" @click.self="categoryDialogOpen = false">
        <section class="kb-dialog" role="dialog" aria-modal="true" aria-label="分类目录表单">
          <header>
            <h2>{{ editingCategory ? '编辑分类目录' : '新增分类目录' }}</h2>
            <button type="button" aria-label="关闭" @click="categoryDialogOpen = false">
              <span class="material-symbols-outlined">close</span>
            </button>
          </header>
          <label>
            <span>分类名称</span>
            <input v-model="categoryForm.name" class="text-input" type="text" placeholder="例如：高一数学" />
          </label>
          <label>
            <span>图标</span>
            <input v-model="categoryForm.icon" class="text-input" type="text" placeholder="例如：functions" />
          </label>
          <footer>
            <button class="soft-btn" type="button" @click="categoryDialogOpen = false">取消</button>
            <button class="primary-btn" type="button" @click="submitCategory">保存分类</button>
          </footer>
        </section>
      </div>

      <div v-if="materialDialogOpen" class="kb-dialog-backdrop" @click.self="materialDialogOpen = false">
        <section class="kb-dialog kb-material-dialog" role="dialog" aria-modal="true" aria-label="资料信息表单">
          <header>
            <h2>{{ editingMaterial ? '编辑资料信息' : '手动添加资料' }}</h2>
            <button type="button" aria-label="关闭" @click="materialDialogOpen = false">
              <span class="material-symbols-outlined">close</span>
            </button>
          </header>

          <div class="kb-form-grid">
            <label>
              <span>所属分类</span>
              <select v-model="materialForm.categoryId" class="text-input">
                <option v-for="category in categories.filter((item) => item.id !== 'all')" :key="category.id" :value="category.id">
                  {{ category.name }}
                </option>
              </select>
            </label>
            <label>
              <span>资料类型</span>
              <select v-model="materialForm.type" class="text-input">
                <option value="PDF">PDF</option>
                <option value="PPT">PPT</option>
                <option value="DOC">DOC</option>
                <option value="报告">报告</option>
              </select>
            </label>
            <label class="wide">
              <span>资料名称</span>
              <input v-model="materialForm.title" class="text-input" type="text" placeholder="例如：二次函数图像与性质教材节选" />
            </label>
            <label>
              <span>学科</span>
              <input v-model="materialForm.subject" class="text-input" type="text" />
            </label>
            <label>
              <span>年级</span>
              <input v-model="materialForm.grade" class="text-input" type="text" />
            </label>
            <label>
              <span>大小</span>
              <input v-model="materialForm.size" class="text-input" type="text" placeholder="2.8 MB" />
            </label>
            <label>
              <span>页数</span>
              <input v-model.number="materialForm.pages" class="text-input" type="number" min="0" />
            </label>
            <label>
              <span>解析状态</span>
              <select v-model="materialForm.parseStatus" class="text-input">
                <option value="parsed">已解析</option>
                <option value="parsing">解析中</option>
                <option value="unparsed">未解析</option>
                <option value="failed">解析失败</option>
              </select>
            </label>
            <label>
              <span>来源</span>
              <input v-model="materialForm.source" class="text-input" type="text" />
            </label>
            <label>
              <span>切片数量</span>
              <input v-model.number="materialForm.chunks" class="text-input" type="number" min="0" />
            </label>
            <label>
              <span>Evidence</span>
              <input v-model.number="materialForm.evidenceCount" class="text-input" type="number" min="0" />
            </label>
            <label class="wide">
              <span>标签</span>
              <input v-model="materialForm.tagsText" class="text-input" type="text" placeholder="用逗号分隔，例如：二次函数，对称轴" />
            </label>
            <label class="wide">
              <span>提取知识点</span>
              <input v-model="materialForm.knowledgeText" class="text-input" type="text" placeholder="用逗号分隔，例如：二次函数一般式，对称轴" />
            </label>
          </div>

          <footer>
            <button class="soft-btn" type="button" @click="materialDialogOpen = false">取消</button>
            <button class="primary-btn" type="button" @click="submitMaterial">保存资料</button>
          </footer>
        </section>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.kb-page {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
}

.kb-layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) 340px;
  gap: 18px;
  min-height: 0;
  overflow: hidden;
  margin-top: 18px;
}

.kb-category-panel,
.kb-main-panel,
.kb-detail-panel {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-radius: var(--edu-radius-lg);
  padding: 18px;
}

.kb-panel-head,
.kb-toolbar,
.kb-status-row,
.kb-detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.kb-panel-head h2,
.kb-detail-head h2 {
  margin-top: 10px;
  font-family: var(--font-serif);
  font-size: 22px;
  line-height: 1.2;
}

.circle-action {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: rgba(255, 255, 255, .74);
  color: var(--green);
}

.kb-category-list {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}

.kb-category {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, .62);
  padding: 0 12px;
}

.kb-category-main {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
  border: 0;
  background: transparent;
  padding: 0;
  color: inherit;
  text-align: left;
}

.kb-category-main strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.kb-category-main em {
  color: var(--muted);
  font-style: normal;
  font-size: 12px;
  font-weight: 800;
}

.kb-category.active {
  border-color: rgba(10, 53, 34, .18);
  background: var(--deep);
  color: #fff;
}

.kb-category.active em {
  color: rgba(255, 255, 255, .72);
}

.kb-inline-actions,
.kb-row-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.kb-inline-actions button,
.kb-row-actions button {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: rgba(255, 255, 255, .68);
  color: var(--muted);
}

.kb-inline-actions .material-symbols-outlined,
.kb-row-actions .material-symbols-outlined {
  font-size: 18px;
}

.kb-capacity {
  display: grid;
  gap: 10px;
  margin-top: 26px;
  border-top: 1px solid var(--line);
  padding-top: 18px;
}

.kb-capacity div,
.info-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.kb-capacity span,
.info-row span,
.kb-muted {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}

.kb-capacity i {
  display: block;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(47, 172, 102, .12);
}

.kb-capacity b {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--green);
}

.kb-main-panel {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 14px;
}

.kb-toolbar {
  align-items: stretch;
}

.kb-toolbar .module-search {
  min-width: 0;
  flex: 1;
}

.kb-status-row {
  justify-content: start;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(244, 250, 246, .76);
  padding: 10px 12px;
}

.kb-status-row p {
  flex: 1;
  color: var(--muted);
  font-size: 12px;
}

.kb-status-row .primary-btn {
  height: 38px;
}

.kb-table {
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 14px;
}

.kb-table.loading {
  opacity: .7;
}

.kb-table-head,
.kb-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 82px 88px 62px 72px;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 0 14px;
}

.kb-table-head {
  min-height: 44px;
  border-bottom: 1px solid var(--line);
  background: rgba(244, 250, 246, .9);
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.kb-row {
  min-height: 88px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, .56);
  color: var(--ink);
}

.kb-row:last-child {
  border-bottom: 0;
}

.kb-row.active {
  background: rgba(235, 249, 240, .86);
  box-shadow: inset 3px 0 0 var(--green);
}

.kb-row-main {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 11px;
  align-items: center;
  min-width: 0;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0;
  text-align: left;
}

.kb-file-icon,
.kb-file-preview {
  display: grid;
  place-items: center;
  border: 1px solid rgba(47, 172, 102, .22);
  border-radius: 12px;
  background: var(--mint);
  color: var(--green);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 900;
}

.kb-file-icon {
  width: 42px;
  height: 42px;
}

.kb-row-main strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-serif);
  font-size: 16px;
}

.kb-row-main p,
.kb-detail-head p {
  margin-top: 5px;
  color: var(--soft);
  font-size: 12px;
  font-weight: 700;
}

.kb-parse-chip {
  display: inline-flex;
  width: fit-content;
  min-height: 28px;
  align-items: center;
  border-radius: 999px;
  padding: 0 10px;
  background: rgba(255, 236, 202, .92);
  color: var(--amber);
  font-size: 12px;
  font-weight: 800;
}

.kb-parse-chip.parsed {
  background: var(--mint);
  color: var(--green);
}

.kb-empty {
  display: grid;
  min-height: 260px;
  place-items: center;
  align-content: center;
  gap: 10px;
  color: var(--muted);
}

.kb-detail-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}

.kb-file-preview {
  width: 52px;
  height: 52px;
  flex: 0 0 auto;
}

.kb-detail-head {
  align-items: start;
  justify-content: start;
  border-bottom: 1px solid var(--line);
  padding-bottom: 8px;
}

.kb-detail-section {
  display: grid;
  gap: 6px;
  border-bottom: 1px solid var(--line);
  padding-bottom: 8px;
}

.kb-detail-section h3 {
  font-family: var(--font-serif);
  font-size: 15px;
}

.kb-detail-section:first-of-type {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.kb-detail-section:first-of-type h3 {
  grid-column: 1 / -1;
}

.kb-detail-section:first-of-type .info-row {
  display: grid;
  gap: 2px;
}

.knowledge-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.knowledge-tags span,
.knowledge-tags em {
  display: inline-flex;
  min-height: 26px;
  align-items: center;
  border-radius: 999px;
  padding: 0 10px;
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}

.knowledge-tags span {
  background: var(--mint);
  color: var(--green);
}

.knowledge-tags em {
  border: 1px solid var(--line);
  color: var(--muted);
}

.kb-detail-actions {
  display: grid;
  gap: 6px;
  margin-top: auto;
}

.kb-detail-actions .primary-btn,
.kb-detail-actions .soft-btn {
  width: 100%;
  height: 34px;
}

.danger-inline {
  color: var(--rose);
}

.kb-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 150;
  display: grid;
  place-items: center;
  background: rgba(11, 31, 22, .34);
  backdrop-filter: blur(10px);
}

.kb-dialog {
  display: grid;
  gap: 14px;
  width: min(460px, calc(100vw - 44px));
  max-height: min(860px, calc(100vh - 44px));
  overflow: auto;
  border: 1px solid rgba(255, 255, 255, .72);
  border-radius: 18px;
  background: rgba(255, 255, 255, .94);
  box-shadow: 0 28px 70px rgba(8, 34, 21, .20);
  padding: 20px;
}

.kb-material-dialog {
  width: min(760px, calc(100vw - 44px));
}

.kb-dialog header,
.kb-dialog footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.kb-dialog header h2 {
  font-family: var(--font-serif);
  font-size: 24px;
}

.kb-dialog header button {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: rgba(10, 53, 34, .08);
}

.kb-dialog label {
  display: grid;
  gap: 7px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.kb-dialog .text-input {
  min-height: 40px;
}

.kb-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.kb-form-grid .wide {
  grid-column: 1 / -1;
}

.primary-btn:disabled,
.soft-btn:disabled {
  opacity: .58;
}

@media (max-height: 760px) {
  .kb-layout {
    margin-top: 14px;
  }

  .kb-category-panel,
  .kb-main-panel,
  .kb-detail-panel {
    padding: 14px;
  }

  .kb-row {
    min-height: 82px;
  }
}
</style>
