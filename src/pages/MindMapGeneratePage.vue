<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MindMapRenderer from '../components/MindMapRenderer.vue';
import {
  createCourse,
  generateCourseMindMap,
  getCourse as fetchCourseDetail,
  updateCourse as persistCourse
} from '../data/courseApiClient';
import { listKnowledgeMaterials } from '../data/knowledgeApiClient';
import { getCourse as getMockCourse, notify } from '../data/mockStore';

const route = useRoute();
const router = useRouter();
const courseId = computed(() => String(route.params.courseId || 'math-quadratic'));
const courseDetail = ref(null);
const course = computed(() => courseDetail.value || getMockCourse(courseId.value));
const courseDisplayTitle = computed(() => course.value?.title || course.value?.shortTitle || '当前课程');

const generating = ref(false);
const generated = ref(false);
const currentStep = ref(-1);
const mindMap = ref(null);
const activeNodeId = ref('root');
const revealedNodeCount = ref(0);
const editingMindMap = ref(false);
const editableMarkdown = ref('');
const selectedBranchLabel = ref('');
const newBranchTitle = ref('');
const renameBranchTitle = ref('');
const agentDraft = ref('');
const agentSending = ref(false);
const agentError = ref('');
const availableMaterials = ref([]);
const selectedMaterialIds = ref([]);
const materialSelectorOpen = ref(false);
const materialLoading = ref(false);
const materialError = ref('');
const agentMessages = ref([
  {
    role: 'assistant',
    content: '可以告诉我你希望怎样调整这张思维导图，我会结合当前会话回复；需要更新导图时会同步到画布。'
  }
]);
let stepTimer = 0;
let revealTimer = 0;
let agentTypingTimer = 0;

const fallbackSources = [
  { id: 'src-1', title: '示例教材资料', type: '教材资料', status: '已引用', evidence: 42 }
];

const generationSteps = [
  '读取知识库引用资料',
  '抽取知识点与关系',
  '识别知识点层级',
  '合并学生薄弱点',
  '生成可编辑思维导图'
];
const referencedMaterials = computed(() => {
  const refs = courseDetail.value?.referencedMaterials || course.value?.referencedMaterials || [];
  return Array.isArray(refs) ? refs : [];
});
const sources = computed(() => referencedMaterials.value);
const nodes = computed(() => mindMap.value?.nodes || []);
const nodeLayout = {
  root: { order: 0 },
  definition: { order: 1 },
  intersection: { order: 2 },
  graph: { order: 3 },
  axis: { order: 4 },
  'mistake-axis': { order: 5 },
  square: { order: 6 },
  teaching: { order: 7 },
  monotonic: { order: 8 },
  opening: { order: 9 },
  vertex: { order: 10 },
  'mistake-square': { order: 11 }
};
const orderedNodes = computed(() => (
  nodes.value
    .filter((node) => nodeLayout[node.id])
    .map((node) => ({ ...node, ...nodeLayout[node.id] }))
    .sort((a, b) => a.order - b.order)
));
const visibleNodes = computed(() => (
  generated.value || generating.value
    ? orderedNodes.value.slice(0, revealedNodeCount.value)
    : []
));
const renderedMarkdown = computed(() => {
  const markdown = mindMap.value?.markdown || '';
  if (!markdown) return '';
  if (generated.value) return markdown;
  const lines = markdown.split('\n');
  const ratio = orderedNodes.value.length
    ? revealedNodeCount.value / orderedNodes.value.length
    : 0;
  const count = Math.max(1, Math.ceil(lines.length * ratio));
  return lines.slice(0, count).join('\n');
});
const displayMarkdown = computed(() => (
  editingMindMap.value ? editableMarkdown.value : renderedMarkdown.value
));
const currentMarkdown = computed(() => mindMap.value?.markdown || '');
const markdownBranches = computed(() => parseMarkdownBranches(mindMap.value?.markdown || ''));
const selectedBranch = computed(() => {
  const selected = normalizeBranchLabel(selectedBranchLabel.value);
  if (!selected) return null;
  return markdownBranches.value.find((branch) => normalizeBranchLabel(branch.title) === selected) || null;
});
const activeNode = computed(() => visibleNodes.value.find((node) => node.id === activeNodeId.value) || visibleNodes.value[0] || null);
const loadingMessage = computed(() => generationSteps[Math.max(0, currentStep.value)] || generationSteps[0]);


function normalizeMaterialReference(material) {
  return {
    id: material.id,
    title: material.title,
    type: material.type || '资料',
    status: material.parseStatus || material.status || '已引用',
    evidence: Number(material.evidenceCount ?? material.evidence ?? material.chunks ?? 0)
  };
}

function syncReferencedMaterialSelection(detail = courseDetail.value) {
  const refs = Array.isArray(detail?.referencedMaterials) ? detail.referencedMaterials : [];
  selectedMaterialIds.value = refs.map((item) => item.id);
}

async function loadKnowledgeMaterialOptions() {
  materialLoading.value = true;
  materialError.value = '';
  try {
    const result = await listKnowledgeMaterials({ pageSize: 100, status: 'active' });
    availableMaterials.value = result.data || [];
  } catch (error) {
    materialError.value = error instanceof Error ? error.message : '资料列表加载失败';
  } finally {
    materialLoading.value = false;
  }
}

function toggleMaterialSelection(materialId) {
  const nextIds = new Set(selectedMaterialIds.value);
  if (nextIds.has(materialId)) {
    nextIds.delete(materialId);
  } else {
    nextIds.add(materialId);
  }
  selectedMaterialIds.value = Array.from(nextIds);
}

async function saveReferencedMaterials() {
  const selectedSet = new Set(selectedMaterialIds.value);
  const referenced = availableMaterials.value
    .filter((material) => selectedSet.has(material.id))
    .map(normalizeMaterialReference);
  await ensureCoursePersisted();
  const savedCourse = await persistCourse(courseId.value, { referencedMaterials: referenced });
  courseDetail.value = savedCourse;
  if (mindMap.value) {
    mindMap.value = { ...mindMap.value, sources: referenced };
  }
  materialSelectorOpen.value = false;
  notify('引用资料已更新');
}

function normalizeStoredMindMap(storedMindMap) {
  if (!storedMindMap?.markdown) return null;
  return {
    id: storedMindMap.id || `mindmap-${courseId.value}`,
    title: storedMindMap.title || course.value.shortTitle || course.value.title || 'AI MindMap',
    courseId: courseId.value,
    markdown: String(storedMindMap.markdown || '').trim(),
    sources: referencedMaterials.value,
    nodes: Array.isArray(storedMindMap.nodes) ? storedMindMap.nodes : [],
    generatedAt: storedMindMap.generatedAt || null,
    provider: storedMindMap.provider || null,
    model: storedMindMap.model || null
  };
}

function applyMindMapState(nextMindMap, message = '') {
  const normalized = normalizeStoredMindMap(nextMindMap);
  if (!normalized) return;
  mindMap.value = normalized;
  editableMarkdown.value = normalized.markdown;
  revealedNodeCount.value = Math.max(orderedNodes.value.length, normalized.markdown.split('\n').length);
  generated.value = true;
  generating.value = false;
  editingMindMap.value = false;
  if (message) notify(message);
}

async function loadPersistedCourseMindMap() {
  try {
    const detail = await fetchCourseDetail(courseId.value);
    courseDetail.value = detail;
    syncReferencedMaterialSelection(detail);
    if (courseDetail.value?.mindmap) {
      applyMindMapState(courseDetail.value.mindmap);
    } else {
      mindMap.value = null;
      editableMarkdown.value = '';
      generated.value = false;
      revealedNodeCount.value = 0;
    }
  } catch {
    courseDetail.value = null;
  }
}

async function ensureCoursePersisted() {
  try {
    const detail = await fetchCourseDetail(courseId.value);
    courseDetail.value = detail;
    syncReferencedMaterialSelection(detail);
    return detail;
  } catch (error) {
    const currentCourse = course.value || {};
    const created = await createCourse({
      id: courseId.value,
      title: currentCourse.title || currentCourse.shortTitle || courseId.value,
      subject: currentCourse.subject || '未提供',
      grade: currentCourse.grade || '未提供',
      description: currentCourse.summary || currentCourse.description || null,
      duration: currentCourse.duration || null,
      goal: currentCourse.goal || null,
      knowledge: Array.isArray(currentCourse.knowledge) ? currentCourse.knowledge : [],
      hasOutline: Boolean(currentCourse.hasOutline),
      progress: Number.isFinite(Number(currentCourse.progress)) ? Number(currentCourse.progress) : 18,
      materialUploaded: Boolean(currentCourse.materialUploaded),
      materialName: currentCourse.materialName || null,
      referencedMaterials: Array.isArray(currentCourse.referencedMaterials) ? currentCourse.referencedMaterials : [],
      outline: currentCourse.outline || null,
      mindmap: currentCourse.mindmap || null
    });
    courseDetail.value = created;
    syncReferencedMaterialSelection(created);
    return created;
  }
}

function buildCourseMindMapPrompt() {
  const currentCourse = course.value || {};
  const materialSummary = referencedMaterials.value.map((item) => item.title).join('、') || '未选择';
  return [
    '请根据当前课程基础信息生成思维导图。',
    `课程标题：${currentCourse.title || currentCourse.shortTitle || '未命名课程'}`,
    `年级：${currentCourse.grade || '未提供'}`,
    `学科：${currentCourse.subject || '未提供'}`,
    `课时：${currentCourse.duration || '未提供'}`,
    `教学目标：${currentCourse.goal || '未提供'}`,
    `知识点：${Array.isArray(currentCourse.knowledge) ? currentCourse.knowledge.join('、') : '未提供'}`,
    `引用资料：${materialSummary}`
  ].join('\n');
}

async function persistCurrentMindMap(nextMindMap) {
  if (!nextMindMap?.markdown) return;
  try {
    const savedCourse = await persistCourse(courseId.value, {
      mindmap: {
        ...nextMindMap,
        markdown: String(nextMindMap.markdown || '').trim(),
        updatedAt: new Date().toISOString()
      }
    });
    courseDetail.value = savedCourse;
  } catch (error) {
    agentError.value = error instanceof Error ? error.message : '思维导图保存失败';
  }
}

function normalizeBranchLabel(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^#+\s*/, '')
    .trim();
}

function parseMarkdownBranches(markdown) {
  return String(markdown || '')
    .split('\n')
    .map((line, index) => {
      const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
      if (!match) return null;
      return {
        index,
        level: match[1].length,
        title: match[2].trim()
      };
    })
    .filter(Boolean);
}

function findSubtreeEnd(lines, branch) {
  let end = lines.length;
  for (let index = branch.index + 1; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+/.exec(lines[index]);
    if (match && match[1].length <= branch.level) {
      end = index;
      break;
    }
  }
  return end;
}

function updateMindMapMarkdown(nextMarkdown, message) {
  if (!mindMap.value) return;
  const normalized = nextMarkdown.trim();
  mindMap.value = {
    ...mindMap.value,
    markdown: normalized
  };
  editableMarkdown.value = normalized;
  generated.value = true;
  editingMindMap.value = false;
  persistCurrentMindMap(mindMap.value);
  notify(message);
}

function buildBranchLine(level, title) {
  return `${'#'.repeat(Math.min(Math.max(level, 1), 6))} ${title.trim()}`;
}

function extractMindMapBlock(content) {
  const match = String(content || '').match(/:::mindmap\s*([\s\S]*?):::/i);
  return match ? match[1].trim() : '';
}

function stripMindMapBlock(content) {
  return String(content || '').replace(/:::mindmap\s*[\s\S]*?:::/i, '').trim();
}

function streamAgentReply(messageIndex, content) {
  window.clearInterval(agentTypingTimer);
  const fullContent = String(content || '');
  return new Promise((resolve) => {
    if (!fullContent) {
      agentMessages.value = agentMessages.value.map((message, index) => (
        index === messageIndex
          ? { ...message, content: '', isStreaming: false }
          : message
      ));
      resolve();
      return;
    }

    let cursor = 0;
    agentMessages.value = agentMessages.value.map((message, index) => (
      index === messageIndex
        ? { ...message, content: '', isStreaming: true }
        : message
    ));
    agentTypingTimer = window.setInterval(() => {
      cursor = Math.min(fullContent.length, cursor + 2);
      agentMessages.value = agentMessages.value.map((message, index) => (
        index === messageIndex
          ? { ...message, content: fullContent.slice(0, cursor), isStreaming: cursor < fullContent.length }
          : message
      ));
      if (cursor >= fullContent.length) {
        window.clearInterval(agentTypingTimer);
        agentTypingTimer = 0;
        resolve();
      }
    }, 24);
  });
}

async function sendMindMapAgentMessage() {
  const content = agentDraft.value.trim();
  if (!content || agentSending.value) return;

  const nextMessages = [
    ...agentMessages.value,
    { role: 'user', content }
  ];
  const assistantMessageIndex = nextMessages.length;

  window.clearInterval(agentTypingTimer);
  agentMessages.value = [
    ...nextMessages,
    { role: 'assistant', content: 'Thinking...', isStreaming: true }
  ];
  agentDraft.value = '';
  agentError.value = '';
  agentSending.value = true;

  try {
    await ensureCoursePersisted();
    const result = await generateCourseMindMap(courseId.value, {
      prompt: content,
      currentMarkdown: currentMarkdown.value,
      messages: nextMessages
    });
    if (result.course) {
      courseDetail.value = result.course;
    }

    const replyContent = String(result.content || result.markdown || '').trim();
    const mindMapMarkdown = result.mindmap?.markdown || extractMindMapBlock(replyContent) || (
      String(result.markdown || '').trim().startsWith('#') ? String(result.markdown || '').trim() : ''
    );
    const visibleReply = stripMindMapBlock(replyContent) || (
      mindMapMarkdown ? '已生成新的思维导图，并同步到画布。' : replyContent
    ) || '我已经收到，会继续结合当前会话处理。';

    await streamAgentReply(assistantMessageIndex, visibleReply);

    if (!mindMapMarkdown) {
      return;
    }

    if (!mindMapMarkdown.startsWith('#')) {
      throw new Error('AI 返回的导图块不是可渲染的 Markdown 导图');
    }

    applyMindMapState(result.mindmap || {
      id: mindMap.value?.id || `mindmap-agent-${Date.now()}`,
      title: course.value.shortTitle || course.value.title || 'AI MindMap',
      courseId: courseId.value,
      markdown: mindMapMarkdown,
      sources: fallbackSources,
      nodes: []
    }, mindMap.value ? 'AI 导图已更新' : 'AI 导图已生成');
  } catch (error) {
    agentError.value = error instanceof Error ? error.message : 'AI 导图智能体请求失败';
    window.clearInterval(agentTypingTimer);
    agentTypingTimer = 0;
    agentMessages.value = [
      ...nextMessages,
      {
        role: 'assistant',
        content: '本次请求失败，请检查后端 AI 配置后重试。'
      }
    ];
  } finally {
    agentSending.value = false;
  }
}

async function startGeneration() {
  if (generating.value) return;
  const prompt = buildCourseMindMapPrompt();
  const previousMarkdown = currentMarkdown.value;
  const nextMessages = [
    ...agentMessages.value,
    { role: 'user', content: prompt }
  ];
  const assistantMessageIndex = nextMessages.length;

  generated.value = false;
  generating.value = true;
  editingMindMap.value = false;
  editableMarkdown.value = '';
  selectedBranchLabel.value = '';
  newBranchTitle.value = '';
  renameBranchTitle.value = '';
  currentStep.value = 0;
  activeNodeId.value = 'root';
  mindMap.value = null;
  revealedNodeCount.value = 0;
  agentMessages.value = [
    ...nextMessages,
    { role: 'assistant', content: 'Thinking...', isStreaming: true }
  ];
  agentError.value = '';
  agentSending.value = true;
  window.clearInterval(stepTimer);
  window.clearInterval(revealTimer);
  stepTimer = window.setInterval(() => {
    currentStep.value = Math.min(generationSteps.length - 1, currentStep.value + 1);
  }, 720);

  try {
    await ensureCoursePersisted();
    const result = await generateCourseMindMap(courseId.value, {
      prompt,
      currentMarkdown: previousMarkdown,
      messages: nextMessages
    });
    if (result.course) {
      courseDetail.value = result.course;
    }
    const replyContent = String(result.content || result.markdown || '').trim();
    const visibleReply = stripMindMapBlock(replyContent) || '已根据课程基础信息生成新的思维导图，并保存到课程中。';
    await streamAgentReply(assistantMessageIndex, visibleReply);
    applyMindMapState(result.mindmap, '');
    revealedNodeCount.value = 1;
    activeNodeId.value = 'root';
    revealTimer = window.setInterval(() => {
      const maxCount = Math.max(orderedNodes.value.length, (mindMap.value?.markdown || '').split('\n').length);
      revealedNodeCount.value = Math.min(maxCount, revealedNodeCount.value + 1);
      if (revealedNodeCount.value >= maxCount) {
        window.clearInterval(revealTimer);
      }
    }, 260);
    window.setTimeout(() => {
      window.clearInterval(stepTimer);
      window.clearInterval(revealTimer);
      revealedNodeCount.value = Math.max(orderedNodes.value.length, (mindMap.value?.markdown || '').split('\n').length);
      currentStep.value = generationSteps.length - 1;
      generated.value = true;
      generating.value = false;
      agentSending.value = false;
      editableMarkdown.value = mindMap.value?.markdown || '';
      notify('思维导图已生成');
    }, 900);
  } catch (error) {
    window.clearInterval(stepTimer);
    window.clearInterval(revealTimer);
    generating.value = false;
    agentSending.value = false;
    agentError.value = error instanceof Error ? error.message : 'AI 思维导图生成失败';
    agentMessages.value = [
      ...nextMessages,
      {
        role: 'assistant',
        content: '本次生成失败，请检查后端 AI 配置后重试。'
      }
    ];
  }
}

function openMindMapEditor() {
  if (!mindMap.value?.markdown || generating.value) return;
  editableMarkdown.value = mindMap.value.markdown;
  editingMindMap.value = true;
}

function cancelMindMapEdit() {
  editableMarkdown.value = mindMap.value?.markdown || '';
  editingMindMap.value = false;
}

function applyMindMapEdit() {
  if (!mindMap.value) return;
  mindMap.value = {
    ...mindMap.value,
    markdown: editableMarkdown.value
  };
  generated.value = true;
  editingMindMap.value = false;
  persistCurrentMindMap(mindMap.value);
  notify('思维导图已更新');
}

function selectRenderedBranch(payload) {
  const label = normalizeBranchLabel(payload?.label);
  if (!label) return;
  selectedBranchLabel.value = label;
  renameBranchTitle.value = label;
  newBranchTitle.value = '';
  const matchedNode = visibleNodes.value.find((node) => normalizeBranchLabel(node.label) === label);
  if (matchedNode) {
    activeNodeId.value = matchedNode.id;
  }
}

function addChildBranch() {
  const branch = selectedBranch.value;
  const title = newBranchTitle.value.trim();
  if (!branch || !title || !mindMap.value?.markdown) return;
  const childLevel = branch.level + 1;
  if (childLevel > 6) {
    notify('当前节点层级已达到上限');
    return;
  }
  const lines = mindMap.value.markdown.split('\n');
  const insertIndex = findSubtreeEnd(lines, branch);
  lines.splice(insertIndex, 0, buildBranchLine(childLevel, title));
  selectedBranchLabel.value = title;
  renameBranchTitle.value = title;
  newBranchTitle.value = '';
  updateMindMapMarkdown(lines.join('\n'), '已添加子分支');
}

function addSiblingBranch() {
  const branch = selectedBranch.value;
  const title = newBranchTitle.value.trim();
  if (!branch || !title || !mindMap.value?.markdown) return;
  if (branch.level === 1) {
    notify('根节点下请使用添加子分支');
    return;
  }
  const lines = mindMap.value.markdown.split('\n');
  const insertIndex = findSubtreeEnd(lines, branch);
  lines.splice(insertIndex, 0, buildBranchLine(branch.level, title));
  selectedBranchLabel.value = title;
  renameBranchTitle.value = title;
  newBranchTitle.value = '';
  updateMindMapMarkdown(lines.join('\n'), '已添加同级分支');
}

function renameSelectedBranch() {
  const branch = selectedBranch.value;
  const title = renameBranchTitle.value.trim();
  if (!branch || !title || !mindMap.value?.markdown) return;
  const lines = mindMap.value.markdown.split('\n');
  lines[branch.index] = buildBranchLine(branch.level, title);
  selectedBranchLabel.value = title;
  renameBranchTitle.value = title;
  updateMindMapMarkdown(lines.join('\n'), '节点名称已更新');
}

function deleteSelectedBranch() {
  const branch = selectedBranch.value;
  if (!branch || !mindMap.value?.markdown) return;
  if (branch.level === 1) {
    notify('根节点不能删除');
    return;
  }
  const lines = mindMap.value.markdown.split('\n');
  const endIndex = findSubtreeEnd(lines, branch);
  lines.splice(branch.index, endIndex - branch.index);
  selectedBranchLabel.value = '';
  renameBranchTitle.value = '';
  newBranchTitle.value = '';
  updateMindMapMarkdown(lines.join('\n'), '已删除该分支');
}

function selectNode(nodeId) {
  activeNodeId.value = nodeId;
}
function goBack() {
  router.push(`/preclass/courses/${course.value.id}/workspace`);
}

onMounted(() => {
  loadPersistedCourseMindMap();
  loadKnowledgeMaterialOptions();
});

watch(courseId, () => {
  window.clearInterval(stepTimer);
  window.clearInterval(revealTimer);
  window.clearInterval(agentTypingTimer);
  loadPersistedCourseMindMap();
});

onUnmounted(() => {
  window.clearInterval(stepTimer);
  window.clearInterval(revealTimer);
  window.clearInterval(agentTypingTimer);
});
</script>

<template>
  <main class="mind-page">
    <header class="mind-top">
      <button class="mind-btn back-btn" type="button" @click="goBack">
        <span class="material-symbols-outlined">chevron_left</span>
        返回备课
      </button>
      <div class="mind-title">
        <h1>{{ courseDisplayTitle }} · 思维导图</h1>
        <p>{{ generated ? '已基于知识库资料生成，可继续用于 PPT、题目和讲解脚本。' : '从已引用资料中提取知识点、关系和薄弱点，生成可演示的备课思维导图。' }}</p>
      </div>
      <div class="mind-actions">
        <button class="mind-btn" type="button" :disabled="!generated || generating" @click="startGeneration">
          <span class="material-symbols-outlined">refresh</span>
          重新生成
        </button>
        <button class="mind-primary" type="button" :disabled="!generated" @click="router.push(`/preclass/courses/${course.id}/ppt`)">
          <span class="material-symbols-outlined">desktop_windows</span>
          生成 PPT
        </button>
      </div>
    </header>

    <section class="mind-shell">
      <nav class="mind-rail" aria-label="课程工作台步骤">
        <button class="mind-step" type="button" @click="router.push(`/preclass/courses/${course.id}/workspace`)">
          <span class="material-symbols-outlined">auto_awesome</span>
          生成
        </button>
        <button class="mind-step active" type="button">
          <span class="material-symbols-outlined">account_tree</span>
          导图
        </button>
        <button class="mind-step" type="button" @click="router.push(`/preclass/courses/${course.id}/ppt`)">
          <span class="material-symbols-outlined">desktop_windows</span>
          PPT
        </button>
        <button class="mind-step" type="button" @click="router.push(`/preclass/courses/${course.id}/lesson-plan`)">
          <span class="material-symbols-outlined">article</span>
          教案
        </button>
        <button class="mind-step" type="button" @click="router.push(`/preclass/courses/${course.id}/analysis`)">
          <span class="material-symbols-outlined">analytics</span>
          题析
        </button>
        <div class="mind-ai-mark">AI</div>
      </nav>

      <aside class="mind-sources" :class="{ selecting: materialSelectorOpen }">
        <header>
          <span class="small-chip">知识库来源</span>
          <h2>引用资料</h2>
        </header>
                <button class="mind-btn material-pick-btn" type="button" @click="materialSelectorOpen = !materialSelectorOpen">
          <span class="material-symbols-outlined">library_add_check</span>
          选择资料
        </button>
        <section v-if="materialSelectorOpen" class="material-selector">
          <p v-if="materialLoading" class="material-selector-note">资料加载中...</p>
          <p v-else-if="materialError" class="material-selector-error">{{ materialError }}</p>
          <div v-else class="material-option-list">
            <button
              v-for="material in availableMaterials"
              :key="material.id"
              class="material-option"
              :class="{ selected: selectedMaterialIds.includes(material.id) }"
              type="button"
              @click="toggleMaterialSelection(material.id)"
            >
              <span class="material-symbols-outlined">
                {{ selectedMaterialIds.includes(material.id) ? 'check_box' : 'check_box_outline_blank' }}
              </span>
              <strong>{{ material.title }}</strong>
              <em>{{ selectedMaterialIds.includes(material.id) ? '已引用' : `${material.type} · ${material.parseStatus}` }}</em>
            </button>
          </div>
          <footer>
            <button class="mind-btn" type="button" @click="materialSelectorOpen = false">取消</button>
            <button class="mind-primary" type="button" :disabled="materialLoading" @click="saveReferencedMaterials">保存引用</button>
          </footer>
        </section>
        <div class="mind-source-list">
          <article v-for="source in sources" :key="source.id" class="mind-source">
            <div>
              <strong>{{ source.title }}</strong>
              <span>{{ source.type }} · {{ source.status }}</span>
            </div>
            <em>{{ source.evidence }}</em>
          </article>
          <p v-if="!sources.length" class="mind-source-empty">尚未选择引用资料。</p>
        </div>
        <section class="mind-detail-card node-edit-panel">
          <span class="small-chip">
            <span class="material-symbols-outlined">ads_click</span>
            节点编辑
          </span>
          <template v-if="selectedBranch">
            <h2>{{ selectedBranch.title }}</h2>
            <p>已选中当前导图节点，可以直接添加分支、重命名或删除，并同步到导图 Markdown。</p>
            <label class="node-edit-field">
              <span>新分支名称</span>
              <input v-model="newBranchTitle" type="text" placeholder="例如：参数变化规律" @keyup.enter="addChildBranch" />
            </label>
            <div class="node-edit-actions">
              <button class="mind-primary" type="button" :disabled="!newBranchTitle.trim()" @click="addChildBranch">
                <span class="material-symbols-outlined">account_tree</span>
                添加子分支
              </button>
              <button class="mind-btn" type="button" :disabled="!newBranchTitle.trim() || selectedBranch.level === 1" @click="addSiblingBranch">
                <span class="material-symbols-outlined">add</span>
                添加同级
              </button>
            </div>
            <label class="node-edit-field">
              <span>节点名称</span>
              <input v-model="renameBranchTitle" type="text" @keyup.enter="renameSelectedBranch" />
            </label>
            <div class="node-edit-actions">
              <button class="mind-btn" type="button" :disabled="!renameBranchTitle.trim()" @click="renameSelectedBranch">
                <span class="material-symbols-outlined">drive_file_rename_outline</span>
                重命名
              </button>
              <button class="mind-danger" type="button" :disabled="selectedBranch.level === 1" @click="deleteSelectedBranch">
                <span class="material-symbols-outlined">delete</span>
                删除分支
              </button>
            </div>
          </template>
          <template v-else>
            <h2>{{ generated ? '点击导图节点开始编辑' : '尚未生成' }}</h2>
            <p>{{ generated ? '选择任一节点后，可以在这里添加子分支、添加同级分支、重命名或删除。' : '生成完成后，点击导图上的任一节点即可进行可视化编辑。' }}</p>
          </template>
        </section>
      </aside>

      <section class="mind-canvas-panel">
        <div class="mind-canvas-head">
          <div class="mind-canvas-titleline">
            <span class="small-chip">
              <span class="material-symbols-outlined">hub</span>
              AI MindMap
            </span>
            <h2>{{ mindMap?.title || '等待生成思维导图' }}</h2>
          </div>
          <div class="mind-canvas-tools">
            <button class="mind-btn mind-edit-toggle" type="button" :disabled="!generated || generating" @click="openMindMapEditor">
              <span class="material-symbols-outlined">edit_note</span>
              编辑导图
            </button>
            <button class="mind-generate" type="button" :disabled="generating" @click="startGeneration">
              <span class="material-symbols-outlined" :class="{ spinning: generating }">{{ generating ? 'progress_activity' : 'auto_awesome' }}</span>
              {{ generating ? '正在生成...' : generated ? '重新生成导图' : 'AI 生成思维导图' }}
            </button>
          </div>
        </div>

        <div class="mind-canvas" :class="{ generated, generating, editing: editingMindMap }">
          <template v-if="mindMap && displayMarkdown">
            <MindMapRenderer :markdown="displayMarkdown" @node-select="selectRenderedBranch" />
            <div v-if="generating" class="mind-stream-status">
              <span class="material-symbols-outlined spinning">progress_activity</span>
              <strong>{{ loadingMessage }}</strong>
              <em>{{ visibleNodes.length }} / {{ orderedNodes.length }}</em>
            </div>
            <aside v-if="editingMindMap" class="mind-edit-panel">
              <header>
                <span class="small-chip">
                  <span class="material-symbols-outlined">edit_note</span>
                  手动编辑
                </span>
                <button class="mind-icon-btn" type="button" aria-label="关闭编辑" @click="cancelMindMapEdit">
                  <span class="material-symbols-outlined">close</span>
                </button>
              </header>
              <textarea v-model="editableMarkdown" spellcheck="false" aria-label="思维导图 Markdown 大纲"></textarea>
              <footer>
                <button class="mind-btn" type="button" @click="cancelMindMapEdit">取消</button>
                <button class="mind-primary" type="button" @click="applyMindMapEdit">应用修改</button>
              </footer>
            </aside>
          </template>
          <div v-else class="mind-empty">
            <span class="material-symbols-outlined" :class="{ spinning: generating }">{{ generating ? 'progress_activity' : 'account_tree' }}</span>
            <strong>{{ generating ? 'AI 正在生成导图' : '从课程资料生成第一版思维导图' }}</strong>
            <p>{{ generating ? '系统正在提取知识点、关系和学生薄弱点。' : '点击生成后，将读取引用资料、抽取知识点并生成导图。' }}</p>
          </div>
        </div>
      </section>

      <aside class="mind-side">
        <section class="mind-agent-panel">
          <header>
            <span class="small-chip">
              <span class="material-symbols-outlined">smart_toy</span>
              AI 导图智能体
            </span>
            <em>{{ agentSending ? '生成中' : 'DeepSeek' }}</em>
          </header>
          <div class="mind-agent-feed">
            <article
              v-for="(message, index) in agentMessages"
              :key="`${message.role}-${index}`"
              :class="[message.role, { streaming: message.isStreaming }]"
            >
              <span>{{ message.role === 'user' ? '我' : 'AI' }}</span>
              <p>{{ message.content }}</p>
            </article>
          </div>
          <p v-if="agentError" class="mind-agent-error">{{ agentError }}</p>
          <div class="mind-agent-input">
            <textarea
              v-model="agentDraft"
              :disabled="agentSending"
              placeholder="例如：把易错点和教学建议补充得更清楚"
              @keydown.enter.exact.prevent="sendMindMapAgentMessage"
            ></textarea>
            <button class="mind-primary" type="button" :disabled="!agentDraft.trim() || agentSending" @click="sendMindMapAgentMessage">
              <span class="material-symbols-outlined" :class="{ spinning: agentSending }">{{ agentSending ? 'progress_activity' : 'send' }}</span>
              发送
            </button>
          </div>
        </section>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.mind-page {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(circle at 100% 0%, rgba(162, 226, 190, .56), transparent 28%),
    var(--wash);
  color: var(--ink);
}

.mind-top {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  height: var(--edu-topbar-h);
  align-items: center;
  gap: 16px;
  padding: 0 20px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, .78);
  backdrop-filter: blur(20px);
}

.mind-title {
  min-width: 0;
}

.mind-title h1 {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-serif);
  font-size: 25px;
  line-height: 1.1;
}

.mind-title p {
  margin-top: 5px;
  overflow: hidden;
  color: var(--muted);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.mind-actions,
.mind-next-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mind-btn,
.mind-primary,
.mind-generate,
.mind-danger {
  display: inline-flex;
  height: 36px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 9px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.mind-btn {
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, .76);
  color: var(--ink);
}

.mind-primary,
.mind-generate {
  border: 0;
  background: var(--deep);
  color: white;
  box-shadow: 0 12px 24px rgba(7, 52, 32, .16);
}

.mind-danger {
  border: 0;
  background: rgba(216, 111, 114, .13);
  color: #b33b42;
}

.mind-btn:disabled,
.mind-primary:disabled,
.mind-generate:disabled,
.mind-danger:disabled {
  opacity: .52;
}

.mind-shell {
  display: grid;
  grid-template-columns: 80px 320px minmax(0, 1fr) 360px;
  height: calc(100vh - var(--edu-topbar-h));
  min-height: 0;
}

.mind-rail {
  display: grid;
  align-content: start;
  gap: 10px;
  padding-top: 18px;
  border-right: 1px solid var(--line);
  background: rgba(255, 255, 255, .36);
}

.mind-step {
  display: grid;
  width: 72px;
  min-height: 60px;
  place-items: center;
  gap: 4px;
  border: 0;
  border-radius: 0 12px 12px 0;
  background: transparent;
  color: var(--soft);
  font-size: 11px;
  font-weight: 700;
}

.mind-step.active {
  background: var(--deep);
  color: white;
  box-shadow: 0 14px 26px rgba(7, 52, 32, .18);
}

.mind-ai-mark {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  margin: 16px auto 0;
  border-radius: 50%;
  background: var(--mint);
  color: var(--green);
  font-family: var(--font-number);
  font-weight: 900;
}

.mind-sources,
.mind-side {
  min-width: 0;
  min-height: 0;
  border-right: 1px solid var(--line);
  padding: 18px;
  background: rgba(255, 255, 255, .54);
}

.mind-sources {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
  padding-bottom: 28px;
  scrollbar-width: none;
}

.mind-sources::-webkit-scrollbar {
  display: none;
}

.mind-sources header h2 {
  margin-top: 10px;
  font-family: var(--font-serif);
  font-size: 22px;
}

.material-pick-btn {
  width: 100%;
  margin-top: 12px;
}

.material-selector {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  flex: 0 0 auto;
  gap: 10px;
  max-height: min(340px, 38vh);
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(255, 255, 255, .72);
  padding: 12px;
}

.material-option-list {
  display: grid;
  min-height: 0;
  gap: 8px;
  overflow-y: auto;
  padding-right: 2px;
}

.material-option {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(247, 252, 249, .78);
  color: var(--ink);
  padding: 10px;
  text-align: left;
}

.material-option.selected {
  border-color: rgba(47, 172, 102, .38);
  background: var(--mint);
}

.material-option .material-symbols-outlined {
  color: var(--green);
  font-size: 20px;
}

.material-option strong,
.material-option em {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.material-option strong {
  white-space: nowrap;
  font-size: 13px;
}

.material-option em {
  grid-column: 2;
  color: var(--muted);
  font-size: 11px;
  font-style: normal;
  font-weight: 800;
  white-space: nowrap;
}

.material-selector footer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.material-selector-note,
.material-selector-error,
.mind-source-empty {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

.material-selector-error {
  color: #b33b42;
}

.mind-source-list {
  display: grid;
  flex: 0 1 250px;
  min-height: 100px;
  max-height: 250px;
  gap: 12px;
  overflow-y: auto;
  padding-right: 2px;
}

.mind-sources.selecting .mind-source-list {
  flex-basis: 190px;
  max-height: 190px;
}

.mind-source {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  min-height: 86px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(255, 255, 255, .62);
  padding: 14px;
}

.mind-source strong {
  display: block;
  font-family: var(--font-serif);
  font-size: 15px;
  line-height: 1.35;
}

.mind-source span {
  display: block;
  margin-top: 8px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.mind-source em {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 12px;
  background: var(--mint);
  color: var(--green);
  font-style: normal;
  font-weight: 900;
}

.mind-canvas-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  padding: 18px;
}

.mind-canvas-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.mind-canvas-titleline {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.mind-canvas-head h2 {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-serif);
  font-size: 25px;
}

.mind-canvas-tools {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
}

.mind-edit-toggle {
  min-width: 104px;
}

.mind-canvas {
  position: relative;
  min-height: 0;
  overflow: hidden;
  border: 1px solid rgba(207, 221, 214, .9);
  border-radius: 18px;
  background:
    linear-gradient(rgba(50, 120, 85, .055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(50, 120, 85, .055) 1px, transparent 1px),
    linear-gradient(180deg, rgba(255, 255, 255, .9), rgba(247, 252, 249, .74));
  background-size: 34px 34px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .86),
    0 18px 46px rgba(20, 70, 45, .07);
}

.mind-canvas.editing :deep(.mm-renderer) {
  right: min(390px, 42%);
}

.mind-edit-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  bottom: 16px;
  z-index: 4;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(360px, calc(100% - 32px));
  overflow: hidden;
  border: 1px solid rgba(47, 172, 102, .22);
  border-radius: 16px;
  background: rgba(255, 255, 255, .92);
  box-shadow: 0 22px 46px rgba(11, 55, 35, .14);
  backdrop-filter: blur(18px);
}

.mind-edit-panel header,
.mind-edit-panel footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px;
}

.mind-edit-panel header {
  border-bottom: 1px solid var(--line);
}

.mind-edit-panel textarea {
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  resize: none;
  border: 0;
  outline: 0;
  background: rgba(247, 252, 249, .82);
  color: var(--ink);
  padding: 14px 16px;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.7;
}

.mind-edit-panel footer {
  border-top: 1px solid var(--line);
}

.mind-icon-btn {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: rgba(255, 255, 255, .7);
  color: var(--muted);
}

.mind-edit-panel footer .mind-primary,
.mind-edit-panel footer .mind-btn {
  height: 34px;
  flex: 1;
}

.mind-stream-status {
  position: absolute;
  left: 50%;
  bottom: 18px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  transform: translateX(-50%);
  border: 1px solid rgba(47, 172, 102, .2);
  border-radius: 999px;
  background: rgba(255, 255, 255, .88);
  color: var(--ink);
  padding: 8px 12px;
  box-shadow: 0 14px 28px rgba(15, 40, 30, .1);
  backdrop-filter: blur(12px);
}

.mind-stream-status .material-symbols-outlined {
  color: var(--green);
  font-size: 20px;
}

.mind-stream-status strong {
  font-size: 12px;
  white-space: nowrap;
}

.mind-stream-status em {
  border-radius: 999px;
  background: var(--mint);
  color: var(--green);
  padding: 3px 8px;
  font-family: var(--font-number);
  font-size: 12px;
  font-style: normal;
  font-weight: 900;
}

.mind-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12px;
  color: var(--muted);
  text-align: center;
}

.mind-empty .material-symbols-outlined {
  display: grid;
  width: 64px;
  height: 64px;
  place-items: center;
  border-radius: 18px;
  background: var(--mint);
  color: var(--green);
  font-size: 34px;
}

.mind-empty strong {
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 24px;
}

.mind-empty p {
  max-width: 420px;
  font-size: 13px;
  line-height: 1.6;
}

.spinning {
  animation: spin .9s linear infinite;
}

@keyframes spin {
  to {
    rotate: 360deg;
  }
}

.mind-side {
  display: flex;
  flex-direction: column;
  gap: 14px;
  border-right: 0;
  border-left: 1px solid var(--line);
}

.mind-agent-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  flex: 1;
  min-height: 0;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: rgba(255, 255, 255, .62);
  padding: 14px;
}

.mind-agent-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.mind-agent-panel header em {
  color: var(--soft);
  font-size: 11px;
  font-style: normal;
  font-weight: 800;
}

.mind-agent-panel .small-chip .material-symbols-outlined {
  font-size: 18px;
}

.mind-agent-feed {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 0;
  margin-top: 12px;
  overflow: hidden;
}

.mind-agent-feed article {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
}

.mind-agent-feed article span {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 50%;
  background: rgba(234, 239, 236, .9);
  color: var(--muted);
  font-size: 11px;
  font-weight: 900;
}

.mind-agent-feed article.assistant span {
  background: var(--deep);
  color: #7df0a0;
}

.mind-agent-feed article.user {
  grid-template-columns: minmax(0, 1fr) 28px;
}

.mind-agent-feed article.user span {
  grid-row: 1;
  grid-column: 2;
  align-self: start;
  background: rgba(234, 239, 236, .9);
  color: var(--muted);
}

.mind-agent-feed article p {
  min-width: 0;
  max-width: 100%;
  overflow: visible;
  border: 1px solid var(--line);
  border-radius: 10px;
  color: var(--muted);
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}

.mind-agent-feed article.assistant p {
  background: rgba(255, 255, 255, .88);
  border-color: rgba(207, 221, 214, .95);
  box-shadow: 0 8px 18px rgba(15, 40, 30, .05);
}

.mind-agent-feed article.user p {
  grid-row: 1;
  grid-column: 1;
  justify-self: end;
  align-self: start;
  background: var(--deep);
  color: white;
  text-align: left;
}

.mind-agent-error {
  margin-top: 8px;
  border-radius: 9px;
  background: rgba(216, 111, 114, .12);
  color: #b33b42;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 800;
}

.mind-agent-input {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: end;
  margin-top: 10px;
}

.mind-agent-input textarea {
  width: 100%;
  height: 58px;
  resize: none;
  border: 1px solid var(--line);
  border-radius: 10px;
  outline: 0;
  background: rgba(247, 252, 249, .88);
  color: var(--ink);
  padding: 10px 11px;
  font-size: 12px;
  line-height: 1.45;
}

.mind-agent-input textarea:focus {
  border-color: rgba(47, 172, 102, .44);
  box-shadow: 0 0 0 3px rgba(47, 172, 102, .1);
}

.mind-agent-input .mind-primary {
  width: 72px;
  height: 58px;
  padding: 0 10px;
}

.mind-detail-card {
  border: 1px solid var(--line);
  border-radius: 16px;
  background: rgba(255, 255, 255, .62);
  padding: 16px;
}

.mind-sources .mind-detail-card {
  flex: 1 1 230px;
  min-height: 230px;
  margin-top: 0;
  overflow-y: auto;
  padding-bottom: 18px;
}

.mind-detail-card h2 {
  margin-top: 12px;
  font-family: var(--font-serif);
  font-size: 22px;
  line-height: 1.25;
}

.mind-detail-card p {
  margin-top: 10px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.65;
}

.mind-evidence {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.mind-evidence span {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  border-radius: 999px;
  background: var(--mint);
  color: var(--green);
  padding: 0 10px;
  font-size: 12px;
  font-weight: 800;
}

.node-edit-panel {
  display: grid;
  align-content: start;
  gap: 12px;
}

.node-edit-panel .small-chip .material-symbols-outlined {
  font-size: 18px;
}

.node-edit-field {
  display: grid;
  gap: 8px;
}

.node-edit-field span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.node-edit-field input {
  width: 100%;
  height: 38px;
  border: 1px solid var(--line);
  border-radius: 10px;
  outline: 0;
  background: rgba(247, 252, 249, .88);
  color: var(--ink);
  padding: 0 12px;
  font-size: 13px;
  font-weight: 700;
}

.node-edit-field input:focus {
  border-color: rgba(47, 172, 102, .44);
  box-shadow: 0 0 0 3px rgba(47, 172, 102, .1);
}

.node-edit-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.node-edit-actions .mind-btn,
.node-edit-actions .mind-primary,
.node-edit-actions .mind-danger {
  width: 100%;
  padding: 0 10px;
}

.mind-next-actions {
  display: grid;
  margin-top: auto;
}

.mind-next-actions .mind-primary,
.mind-next-actions .mind-btn {
  width: 100%;
}

@media (max-height: 760px) {
  .mind-sources,
  .mind-side,
  .mind-canvas-panel {
    padding: 14px;
  }

  .mind-source {
    min-height: 76px;
  }
}
</style>
