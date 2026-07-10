import assert from 'node:assert/strict';

import { PrismaClient } from '@prisma/client';

import { loadEnvFile } from '../server/env.js';
import { createKnowledgeService } from '../server/services/knowledgeService.js';

loadEnvFile();

const prisma = new PrismaClient();
const service = createKnowledgeService(prisma);
const suffix = Date.now();
let category;
let material;

try {
  category = await service.createCategory({
    name: `知识库分类 ${suffix}`,
    icon: 'folder_open',
    sortOrder: 12
  });
  assert.equal(category.name, `知识库分类 ${suffix}`);
  assert.equal(category.count, 0);
  assert.equal(category.status, 'active');

  const categoryList = await service.listCategories({ keyword: String(suffix), status: 'active' });
  assert.equal(categoryList.total, 1);
  assert.equal(categoryList.categories[0].id, category.id);

  const updatedCategory = await service.updateCategory(category.id, {
    name: `知识库分类 ${suffix} 更新`,
    icon: 'functions'
  });
  assert.equal(updatedCategory.name, `知识库分类 ${suffix} 更新`);
  assert.equal(updatedCategory.icon, 'functions');

  material = await service.createMaterial({
    categoryId: category.id,
    title: `二次函数资料 ${suffix}`,
    type: 'PDF',
    subject: '数学',
    grade: '高一',
    size: '2.1 MB',
    pages: 18,
    source: '手动添加',
    parseStatus: 'parsed',
    tags: ['二次函数', '对称轴'],
    knowledgePoints: [
      { id: 'kp-axis', name: '对称轴' }
    ],
    evidenceTypes: ['material_chunk'],
    usedByCourses: ['二次函数图像与性质']
  });
  assert.equal(material.categoryId, category.id);
  assert.equal(material.status, 'parsed');
  assert.equal(material.parseLabel, '已解析');
  assert.equal(material.tags.length, 2);

  const materialList = await service.listMaterials({
    categoryId: category.id,
    keyword: String(suffix),
    type: 'PDF',
    status: 'active',
    page: 1,
    pageSize: 20
  });
  assert.equal(materialList.total, 1);
  assert.equal(materialList.materials[0].id, material.id);

  const categoryWithCount = await service.listCategories({ keyword: String(suffix), status: 'active' });
  assert.equal(categoryWithCount.categories[0].count, 1);

  const detail = await service.getMaterial(material.id);
  assert.equal(detail.title, `二次函数资料 ${suffix}`);
  assert.equal(detail.knowledgePoints[0].name, '对称轴');

  const updatedMaterial = await service.updateMaterial(material.id, {
    title: `二次函数资料 ${suffix} 更新`,
    evidenceCount: 9,
    tags: ['二次函数', '顶点坐标']
  });
  assert.equal(updatedMaterial.title, `二次函数资料 ${suffix} 更新`);
  assert.equal(updatedMaterial.evidenceCount, 9);
  assert.deepEqual(updatedMaterial.tags, ['二次函数', '顶点坐标']);

  const archivedMaterial = await service.archiveMaterial(material.id);
  assert.equal(archivedMaterial.lifecycleStatus, 'archived');

  const hiddenMaterials = await service.listMaterials({ categoryId: category.id, status: 'active' });
  assert.equal(hiddenMaterials.total, 0);

  const archivedCategory = await service.archiveCategory(category.id);
  assert.equal(archivedCategory.status, 'archived');

  await prisma.knowledgeMaterial.delete({ where: { id: material.id } });
  await prisma.knowledgeCategory.delete({ where: { id: category.id } });

  console.log('knowledge base CRUD database contracts passed');
} finally {
  await prisma.$disconnect();
}
