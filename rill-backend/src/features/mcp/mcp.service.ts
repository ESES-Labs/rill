import { skillsStore, PublishedSkill } from './skills.store';
import { skillRunnerService } from './skill-runner.service';
import { canExecuteOnChain } from './sui-signer';

/** JSON-RPC handler for MCP tools/list + tools/call (Claude Code / OpenCode compatible). */
export async function handleMcpJsonRpc(
  skillId: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const skill = skillsStore.get(skillId);
  if (!skill) {
    return { jsonrpc: '2.0', id: body.id, error: { code: -32602, message: 'Skill not found' } };
  }

  const id = body.id ?? null;
  const method = String(body.method ?? '');

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: `rill-${skill.id}`, version: '1.0.0' },
      },
    };
  }

  if (method === 'notifications/initialized') {
    return { jsonrpc: '2.0', id, result: {} };
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: [formatToolListing(skill)],
      },
    };
  }

  if (method === 'tools/call') {
    const params = (body.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
    const args = { ...(params.arguments ?? {}) };
    const shouldExecute = args.execute === true && canExecuteOnChain();
    delete args.execute;

    const result = await skillRunnerService.runFlow(skill.flow, args, {
      execute: shouldExecute,
      forceExecute: shouldExecute,
    });

    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        isError: !result.simulation.ok && !result.executed,
      },
    };
  }

  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
}

function formatToolListing(skill: PublishedSkill) {
  return {
    name: skill.toolDefs.name,
    description: skill.toolDefs.description,
    inputSchema: skill.toolDefs.inputSchema,
  };
}
