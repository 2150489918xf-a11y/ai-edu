import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function stripMarkdownFences(value) {
  return String(value || '')
    .replace(/^```(?:markdown|md)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

function createMindMapAgentPlugin(env) {
  const apiKey = env.DEEPSEEK_API_KEY;
  const model = env.DEEPSEEK_MODEL || 'deepseek-v4-pro';

  return {
    name: 'local-mindmap-agent',
    configureServer(server) {
      server.middlewares.use('/api/mindmap-agent', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }

        if (!apiKey) {
          sendJson(res, 500, { error: 'Missing DEEPSEEK_API_KEY in local environment' });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const currentMarkdown = String(body.currentMarkdown || '');
          const courseTitle = body.course?.shortTitle || body.course?.title || '当前课程';
          const history = Array.isArray(body.messages) ? body.messages : [];

          const systemPrompt = [
            '你是教学思维导图生成智能体。',
            '你可以像老师备课助手一样正常对话，回答问题、解释调整思路或追问缺失信息。',
            '只有当用户明确要求生成、重写、补充或更新思维导图时，才在普通回复后追加一个 :::mindmap 特征块。',
            ':::mindmap 块内部必须是 Markmap 可渲染的完整 Markdown，必须以一级标题 # 开头，层级使用 #、##、###、####。',
            ':::mindmap 块格式必须严格如下：',
            ':::mindmap',
            '# 主题',
            '## 一级分支',
            '### 二级分支',
            ':::',
            '不要把 :::mindmap 块放进代码块，不要输出 JSON。',
            '如果只是普通问答，不要输出 :::mindmap 块。'
          ].join('\n');

          const messages = [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                `课程：${courseTitle}`,
                '当前思维导图 Markdown：',
                currentMarkdown || '# 待生成思维导图',
                '请根据后续完整会话历史生成更新后的完整 Markdown。'
              ].join('\n')
            },
            ...history
              .filter((item) => ['user', 'assistant'].includes(item.role) && item.content)
              .map((item) => ({ role: item.role, content: String(item.content) }))
          ];

          const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model,
              messages,
              temperature: 0.2
            })
          });

          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            sendJson(res, response.status, {
              error: data.error?.message || 'DeepSeek request failed'
            });
            return;
          }

          const content = stripMarkdownFences(data.choices?.[0]?.message?.content || '');

          sendJson(res, 200, {
            content,
            model
          });
        } catch (error) {
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : 'Mind map agent failed'
          });
        }
      });
    }
  };
}

function createOutlineAgentPlugin(env) {
  const apiKey = env.DEEPSEEK_API_KEY;
  const model = env.DEEPSEEK_MODEL || 'deepseek-v4-pro';

  return {
    name: 'local-outline-agent',
    configureServer(server) {
      server.middlewares.use('/api/outline-agent', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }

        if (!apiKey) {
          sendJson(res, 500, { error: 'Missing DEEPSEEK_API_KEY in local environment' });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const course = body.course || {};
          const currentOutline = body.currentOutline || null;
          const history = Array.isArray(body.messages) ? body.messages : [];

          const systemPrompt = [
            '你是课程大纲生成与修改智能体，服务于老师课前备课。',
            '你可以正常对话、解释修改理由、追问缺失信息。',
            '只有当用户明确要求生成、重写、补充或修改课程大纲时，才在自然语言回复后追加一个 :::outline-json 特征块。',
            ':::outline-json 块内部必须是完整 JSON，不要输出局部 patch，不要放进 Markdown 代码块。',
            'JSON 顶层必须包含 version、tags、sections。',
            'tags 可以是字符串，也可以是对象；对象格式为 { "text": "力与加速度", "tone": "success" }。',
            'sections 每项必须包含 id、phase、time、title、status、active、cards。',
            '不要强制四段式。请根据课程内容、课时时长和教师要求生成 3-6 个教学环节；如果教师明确要求更多或更少环节，可以按教师要求调整。',
            'cards 每项必须包含 { "label": "教师动作", "content": "具体内容", "tone": "default" }。',
            '"tone" 只能使用 "default"、"focus"、"warning"、"success"、"muted"，用于前端映射颜色；不要输出具体色值。',
            'status 可使用 "optimized" 表示 AI 已优化，其它情况可为空字符串。',
            'active 用于标记当前重点环节，每次最多一个 section 为 true。',
            '必须保持课程学段、学科、总时长和教学目标一致。',
            ':::outline-json 块格式示例：',
            ':::outline-json',
            '{',
            '  "version": "v4",',
            '  "tags": [{ "text": "力与加速度", "tone": "success" }],',
            '  "sections": [',
            '    {',
            '      "id": "experiment",',
            '      "phase": "实验探究",',
            '      "time": "8-25 分钟",',
            '      "title": "力、质量与加速度关系",',
            '      "status": "optimized",',
            '      "active": true,',
            '      "cards": [',
            '        { "label": "关键内容", "content": "控制变量，对比小车在不同拉力和质量下的加速度。", "tone": "focus" },',
            '        { "label": "风险知识点", "content": "把单个力误当合力，忽略加速度方向。", "tone": "warning" }',
            '      ]',
            '    }',
            '  ]',
            '}',
            ':::',
            '如果只是普通问答，不要输出 :::outline-json 块。'
          ].join('\n');

          const messages = [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                `课程标题：${course.title || course.shortTitle || '当前课程'}`,
                `学段：${course.grade || '未提供'}`,
                `学科：${course.subject || '未提供'}`,
                `课时时长：${course.duration || '未提供'}`,
                `教学目标：${course.goal || '未提供'}`,
                '当前结构化大纲 JSON：',
                JSON.stringify(currentOutline || {}, null, 2),
                '请结合后续完整会话处理老师请求。'
              ].join('\n')
            },
            ...history
              .filter((item) => ['user', 'assistant'].includes(item.role) && (item.content || item.text))
              .map((item) => ({ role: item.role, content: String(item.content || item.text) }))
          ];

          const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model,
              messages,
              temperature: 0.2
            })
          });

          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            sendJson(res, response.status, {
              error: data.error?.message || 'DeepSeek request failed'
            });
            return;
          }

          const content = stripMarkdownFences(data.choices?.[0]?.message?.content || '');

          sendJson(res, 200, {
            content,
            model
          });
        } catch (error) {
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : 'Outline agent failed'
          });
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [vue(), createMindMapAgentPlugin(env), createOutlineAgentPlugin(env)],
    server: {
      host: '0.0.0.0',
      port: 8091,
      strictPort: true
    }
  };
});
