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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [vue(), createMindMapAgentPlugin(env)],
    server: {
      host: '0.0.0.0',
      port: 8091,
      strictPort: true
    }
  };
});
