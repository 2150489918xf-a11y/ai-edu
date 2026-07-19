export const PATH_RELATION_TYPES = new Set(['prerequisite', 'derivation', 'application']);
const PATH_RELATION_PRIORITY = { application: 1, derivation: 2, prerequisite: 3 };

function normalizeNodes(nodes) {
  return nodes
    .filter((node) => node?.id)
    .map((node) => ({
      ...node,
      label: node.label || node.name || node.id,
      category: node.category || '未分类',
      questionCount: Number(node.questionCount || 0)
    }));
}

function normalizePathEdges(edges, nodeIds) {
  const seen = new Set();
  return edges
    .filter((edge) => edge?.id)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))
    .filter((edge) => (
      nodeIds.has(edge.source) &&
      nodeIds.has(edge.target) &&
      edge.source !== edge.target &&
      PATH_RELATION_TYPES.has(edge.type)
    ))
    .filter((edge) => {
      const key = `${edge.source}|${edge.target}|${edge.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((edge) => ({ ...edge }));
}

function compareCycleEdges(left, right) {
  const priorityDelta = (PATH_RELATION_PRIORITY[left.type] || 0) - (PATH_RELATION_PRIORITY[right.type] || 0);
  if (priorityDelta) return priorityDelta;
  const supportDelta = Number(left.supportCount || 0) - Number(right.supportCount || 0);
  if (supportDelta) return supportDelta;
  return String(left.id).localeCompare(String(right.id));
}

function findCycle(edges) {
  const outgoing = new Map();
  for (const edge of edges) {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    outgoing.get(edge.source).push(edge);
  }

  const visiting = new Set();
  const visited = new Set();
  const pathNodes = [];
  const pathEdges = [];

  function visit(nodeId) {
    if (visiting.has(nodeId)) return null;
    if (visited.has(nodeId)) return null;
    visiting.add(nodeId);
    pathNodes.push(nodeId);

    for (const edge of outgoing.get(nodeId) || []) {
      const cycleStart = pathNodes.indexOf(edge.target);
      if (cycleStart >= 0) return [...pathEdges.slice(cycleStart), edge];
      pathEdges.push(edge);
      const cycle = visit(edge.target);
      if (cycle) return cycle;
      pathEdges.pop();
    }

    pathNodes.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
    return null;
  }

  for (const edge of edges) {
    const cycle = visit(edge.source);
    if (cycle) return cycle;
  }
  return null;
}

function removeCycleEdges(edges) {
  const result = [...edges];
  while (true) {
    const cycle = findCycle(result);
    if (!cycle) return result;
    const remove = [...cycle].sort(compareCycleEdges)[0];
    const index = result.findIndex((edge) => edge.id === remove.id);
    if (index < 0) return result;
    result.splice(index, 1);
  }
}

function computeLayers(nodes, edges) {
  const activeIds = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  const indegree = new Map([...activeIds].map((id) => [id, 0]));
  const outgoing = new Map([...activeIds].map((id) => [id, []]));

  for (const edge of edges) {
    indegree.set(edge.target, indegree.get(edge.target) + 1);
    outgoing.get(edge.source).push(edge.target);
  }

  const layers = new Map();
  const queue = [...activeIds].filter((id) => indegree.get(id) === 0);
  for (const id of queue) layers.set(id, 0);

  for (let index = 0; index < queue.length; index += 1) {
    const source = queue[index];
    for (const target of outgoing.get(source)) {
      layers.set(target, Math.max(layers.get(target) ?? 0, layers.get(source) + 1));
      indegree.set(target, indegree.get(target) - 1);
      if (indegree.get(target) === 0) queue.push(target);
    }
  }

  return layers;
}

export function projectKnowledgePathGraph(source = {}) {
  const nodes = normalizeNodes(source.nodes || []);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = removeCycleEdges(normalizePathEdges(source.edges || [], nodeIds));
  const layers = computeLayers(nodes, edges);
  const projectedNodes = nodes.map((node) => ({
    ...node,
    layer: layers.get(node.id) ?? null,
    orphan: !layers.has(node.id)
  }));

  projectedNodes.sort((left, right) => {
    const leftLayer = left.layer === null ? Number.MAX_SAFE_INTEGER : left.layer;
    const rightLayer = right.layer === null ? Number.MAX_SAFE_INTEGER : right.layer;
    return leftLayer - rightLayer ||
      String(left.category).localeCompare(String(right.category)) ||
      String(left.label).localeCompare(String(right.label)) ||
      String(left.id).localeCompare(String(right.id));
  });

  edges.sort((left, right) => (
    String(left.source).localeCompare(String(right.source)) ||
    String(left.target).localeCompare(String(right.target)) ||
    String(left.type).localeCompare(String(right.type)) ||
    String(left.id).localeCompare(String(right.id))
  ));

  return {
    nodes: projectedNodes,
    edges,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      orphanCount: nodes.filter((node) => !layers.has(node.id)).length,
      layerCount: layers.size ? Math.max(...layers.values()) + 1 : 0
    }
  };
}
