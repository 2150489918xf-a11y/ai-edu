export const PATH_RELATION_TYPES = new Set(['prerequisite', 'derivation', 'application']);

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
    .filter((edge) => (
      edge?.id &&
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
  const edges = normalizePathEdges(source.edges || [], nodeIds);
  const layers = computeLayers(nodes, edges);

  return {
    nodes: nodes.map((node) => ({
      ...node,
      layer: layers.get(node.id) ?? null,
      orphan: !layers.has(node.id)
    })),
    edges,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      orphanCount: nodes.filter((node) => !layers.has(node.id)).length,
      layerCount: layers.size ? Math.max(...layers.values()) + 1 : 0
    }
  };
}
