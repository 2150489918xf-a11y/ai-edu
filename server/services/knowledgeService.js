function createHttpError(statusCode, code, message, details = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function getParseLabel(parseStatus) {
  if (parseStatus === 'parsed') return '已解析';
  if (parseStatus === 'parsing') return '解析中';
  if (parseStatus === 'failed') return '解析失败';
  return '未解析';
}

function validateRequired(payload = {}, fields, message) {
  const missing = fields.filter((key) => {
    if (key === 'pages' || key === 'chunks' || key === 'evidenceCount') return payload[key] == null;
    return !normalizeText(payload[key]);
  });
  if (missing.length) {
    throw createHttpError(400, 'BAD_REQUEST', message, { missing });
  }
}

function normalizeCategory(category) {
  return {
    id: category.id,
    name: category.name,
    icon: category.icon,
    sortOrder: category.sortOrder,
    count: category._count?.materials ?? category.count ?? 0,
    status: category.status,
    deletedAt: category.deletedAt ? category.deletedAt.toISOString() : null,
    createdAt: category.createdAt?.toISOString?.() || category.createdAt,
    updatedAt: category.updatedAt?.toISOString?.() || category.updatedAt
  };
}

function normalizeMaterial(material) {
  return {
    id: material.id,
    categoryId: material.categoryId,
    categoryName: material.category?.name,
    title: material.title,
    type: material.type,
    subject: material.subject,
    grade: material.grade,
    size: material.size || '',
    pages: material.pages,
    uploadedAt: material.createdAt ? formatUploadedAt(material.createdAt) : '刚刚',
    status: material.lifecycleStatus === 'archived' ? 'archived' : material.parseStatus,
    lifecycleStatus: material.lifecycleStatus,
    parseStatus: material.parseStatus,
    parseLabel: material.lifecycleStatus === 'archived' ? '已删除' : getParseLabel(material.parseStatus),
    source: material.source,
    chunks: material.chunks,
    evidenceCount: material.evidenceCount,
    vectorIndexed: material.vectorIndexed,
    bm25Indexed: material.bm25Indexed,
    teacherPinned: material.teacherPinned,
    tags: toArray(material.tags),
    knowledgePoints: toArray(material.knowledgePoints),
    retrievalSummary: material.retrievalSummary || null,
    evidenceTypes: toArray(material.evidenceTypes),
    availableActions: toArray(material.availableActions),
    usedByCourses: toArray(material.usedByCourses),
    deletedAt: material.deletedAt ? material.deletedAt.toISOString() : null,
    createdAt: material.createdAt?.toISOString?.() || material.createdAt,
    updatedAt: material.updatedAt?.toISOString?.() || material.updatedAt
  };
}

function formatUploadedAt(date) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '刚刚';
  const now = Date.now();
  if (now - value.getTime() < 24 * 60 * 60 * 1000) return '今天';
  return `${String(value.getMonth() + 1).padStart(2, '0')}/${String(value.getDate()).padStart(2, '0')}`;
}

function buildCategoryWhere(filters = {}) {
  const where = {};
  const status = filters.status || 'active';
  if (status !== 'all') where.status = status;
  if (filters.keyword) {
    where.name = { contains: filters.keyword, mode: 'insensitive' };
  }
  return where;
}

function buildMaterialWhere(filters = {}) {
  const where = {};
  const status = filters.status || 'active';
  if (status !== 'all') where.lifecycleStatus = status;
  if (filters.categoryId && filters.categoryId !== 'all') where.categoryId = filters.categoryId;
  if (filters.type && filters.type !== 'all') where.type = filters.type;
  if (filters.parseStatus && filters.parseStatus !== 'all') where.parseStatus = filters.parseStatus;
  if (filters.keyword) {
    where.OR = [
      { title: { contains: filters.keyword, mode: 'insensitive' } },
      { subject: { contains: filters.keyword, mode: 'insensitive' } },
      { grade: { contains: filters.keyword, mode: 'insensitive' } },
      { source: { contains: filters.keyword, mode: 'insensitive' } }
    ];
  }
  return where;
}

function buildMaterialData(payload = {}, { partial = false } = {}) {
  if (!partial) {
    validateRequired(payload, ['categoryId', 'title', 'type', 'subject', 'grade'], '缺少资料必要字段');
  }

  const data = {};
  if ('categoryId' in payload) data.categoryId = normalizeText(payload.categoryId);
  if ('title' in payload) data.title = normalizeText(payload.title);
  if ('type' in payload) data.type = normalizeText(payload.type);
  if ('subject' in payload) data.subject = normalizeText(payload.subject);
  if ('grade' in payload) data.grade = normalizeText(payload.grade);
  if ('size' in payload) data.size = normalizeText(payload.size) || null;
  if ('pages' in payload) data.pages = Math.max(Number(payload.pages || 0), 0);
  if ('parseStatus' in payload) data.parseStatus = normalizeText(payload.parseStatus) || 'parsed';
  if ('source' in payload) data.source = normalizeText(payload.source) || '手动添加';
  if ('chunks' in payload) data.chunks = Math.max(Number(payload.chunks || 0), 0);
  if ('evidenceCount' in payload) data.evidenceCount = Math.max(Number(payload.evidenceCount || 0), 0);
  if ('vectorIndexed' in payload) data.vectorIndexed = Boolean(payload.vectorIndexed);
  if ('bm25Indexed' in payload) data.bm25Indexed = Boolean(payload.bm25Indexed);
  if ('teacherPinned' in payload) data.teacherPinned = Boolean(payload.teacherPinned);
  if ('tags' in payload) data.tags = toArray(payload.tags);
  if ('knowledgePoints' in payload) data.knowledgePoints = toArray(payload.knowledgePoints);
  if ('retrievalSummary' in payload) data.retrievalSummary = payload.retrievalSummary || null;
  if ('evidenceTypes' in payload) data.evidenceTypes = toArray(payload.evidenceTypes);
  if ('availableActions' in payload) data.availableActions = toArray(payload.availableActions);
  if ('usedByCourses' in payload) data.usedByCourses = toArray(payload.usedByCourses);

  for (const key of ['categoryId', 'title', 'type', 'subject', 'grade']) {
    if (key in data && !data[key]) {
      throw createHttpError(400, 'BAD_REQUEST', `${key} 不能为空`);
    }
  }

  return data;
}

export function createKnowledgeService(prisma) {
  return {
    async listCategories(filters = {}) {
      const page = Math.max(Number(filters.page || 1), 1);
      const pageSize = Math.min(Math.max(Number(filters.pageSize || 100), 1), 100);
      const where = buildCategoryWhere(filters);

      const [categories, total] = await Promise.all([
        prisma.knowledgeCategory.findMany({
          where,
          include: {
            _count: {
              select: {
                materials: { where: { lifecycleStatus: 'active' } }
              }
            }
          },
          orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        prisma.knowledgeCategory.count({ where })
      ]);

      return {
        categories: categories.map(normalizeCategory),
        total
      };
    },

    async createCategory(payload = {}) {
      validateRequired(payload, ['name'], '缺少分类必要字段');
      const category = await prisma.knowledgeCategory.create({
        data: {
          name: normalizeText(payload.name),
          icon: normalizeText(payload.icon) || 'folder_open',
          sortOrder: Number(payload.sortOrder || 0)
        },
        include: { _count: { select: { materials: true } } }
      });
      return normalizeCategory(category);
    },

    async getCategory(categoryId) {
      const category = await prisma.knowledgeCategory.findUnique({
        where: { id: categoryId },
        include: {
          _count: {
            select: {
              materials: { where: { lifecycleStatus: 'active' } }
            }
          }
        }
      });
      if (!category) throw createHttpError(404, 'NOT_FOUND', '分类不存在');
      return normalizeCategory(category);
    },

    async updateCategory(categoryId, payload = {}) {
      await this.getCategory(categoryId);
      const data = {};
      if ('name' in payload) data.name = normalizeText(payload.name);
      if ('icon' in payload) data.icon = normalizeText(payload.icon) || 'folder_open';
      if ('sortOrder' in payload) data.sortOrder = Number(payload.sortOrder || 0);
      if ('name' in data && !data.name) throw createHttpError(400, 'BAD_REQUEST', '分类名称不能为空');

      const category = await prisma.knowledgeCategory.update({
        where: { id: categoryId },
        data,
        include: {
          _count: {
            select: {
              materials: { where: { lifecycleStatus: 'active' } }
            }
          }
        }
      });
      return normalizeCategory(category);
    },

    async archiveCategory(categoryId) {
      await this.getCategory(categoryId);
      const activeMaterialCount = await prisma.knowledgeMaterial.count({
        where: { categoryId, lifecycleStatus: 'active' }
      });
      if (activeMaterialCount > 0) {
        throw createHttpError(409, 'CATEGORY_NOT_EMPTY', '分类下还有资料，不能删除', { activeMaterialCount });
      }

      const category = await prisma.knowledgeCategory.update({
        where: { id: categoryId },
        data: { status: 'archived', deletedAt: new Date() },
        include: { _count: { select: { materials: true } } }
      });
      return normalizeCategory(category);
    },

    async listMaterials(filters = {}) {
      const page = Math.max(Number(filters.page || 1), 1);
      const pageSize = Math.min(Math.max(Number(filters.pageSize || 20), 1), 100);
      const where = buildMaterialWhere(filters);

      const [materials, total] = await Promise.all([
        prisma.knowledgeMaterial.findMany({
          where,
          include: { category: true },
          orderBy: [{ updatedAt: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        prisma.knowledgeMaterial.count({ where })
      ]);

      return {
        materials: materials.map(normalizeMaterial),
        total
      };
    },

    async createMaterial(payload = {}) {
      const data = buildMaterialData(payload);
      await this.getCategory(data.categoryId);

      const material = await prisma.knowledgeMaterial.create({
        data,
        include: { category: true }
      });
      return normalizeMaterial(material);
    },

    async getMaterial(materialId) {
      const material = await prisma.knowledgeMaterial.findUnique({
        where: { id: materialId },
        include: { category: true }
      });
      if (!material) throw createHttpError(404, 'NOT_FOUND', '资料不存在');
      return normalizeMaterial(material);
    },

    async updateMaterial(materialId, payload = {}) {
      await this.getMaterial(materialId);
      const data = buildMaterialData(payload, { partial: true });
      if (data.categoryId) await this.getCategory(data.categoryId);

      const material = await prisma.knowledgeMaterial.update({
        where: { id: materialId },
        data,
        include: { category: true }
      });
      return normalizeMaterial(material);
    },

    async archiveMaterial(materialId) {
      await this.getMaterial(materialId);
      const material = await prisma.knowledgeMaterial.update({
        where: { id: materialId },
        data: { lifecycleStatus: 'archived', deletedAt: new Date() },
        include: { category: true }
      });
      return normalizeMaterial(material);
    }
  };
}
