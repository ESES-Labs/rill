import { config } from '../../core/config';
import type { PublishedSkill } from './skills.store';

/** Browser-friendly page when someone opens an MCP URL (POST-only JSON-RPC). */
export function buildMcpLandingHtml(skill: PublishedSkill): string {
  const mcpUrl = `${config.publicBaseUrl}/api/mcp/${skill.id}`;
  const skillUrl = `${config.publicBaseUrl}/api/skills/${skill.id}/skill.md`;
  const toolName = skill.toolDefs.name;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${toolName} · Rill MCP</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 42rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; color: #111; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    p, li { color: #444; }
    code, pre { background: #f4f4f5; border-radius: 6px; font-size: 0.85rem; }
    code { padding: 0.1rem 0.35rem; }
    pre { padding: 0.75rem 1rem; overflow-x: auto; }
    a { color: #2563eb; }
    .badge { display: inline-block; background: #ecfdf5; color: #047857; font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 999px; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="badge">MCP endpoint · POST JSON-RPC</div>
  <h1>${toolName}</h1>
  <p>${skill.description}</p>
  <p><strong>This URL is not a web page.</strong> Agents connect via MCP (POST). Paste the skill doc into Claude Code / Cursor, or test with curl:</p>
  <pre>curl -X POST ${mcpUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'</pre>
  <p><a href="${skillUrl}">Open SKILL.md</a> — human-readable instructions for any agent.</p>
  <p><a href="${config.publicBaseUrl}/">Rill API docs (Swagger)</a></p>
</body>
</html>`;
}
