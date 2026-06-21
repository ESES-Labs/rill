import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { introspectService } from '../../features/introspect/introspect.service';
import { resolverService } from '../../features/introspect/resolver.service';
import { compilerService } from '../../features/compiler/compiler.service';
import { simulatorService } from '../../features/compiler/simulator.service';
import { skillsStore } from '../../features/mcp/skills.store';
import { skillRunnerService } from '../../features/mcp/skill-runner.service';
import { buildToolDefs } from '../../features/mcp/tool-schema';
import { handleMcpJsonRpc } from '../../features/mcp/mcp.service';
import { config } from '../../core/config';
import {
  IntrospectSchema,
  ResolveSchema,
  CompileSchema,
  SimulateSchema,
  PublishSchema,
  ExecuteSchema,
} from '../schemas/api.schema';

export const apiRouter = new Hono();

apiRouter.post('/introspect', zValidator('json', IntrospectSchema), async (c) => {
  const { packageId } = c.req.valid('json');
  const functions = await introspectService.introspectPackage(packageId);
  return c.json({ success: true, data: functions });
});

apiRouter.post('/resolve', zValidator('json', ResolveSchema), async (c) => {
  const { packageId, moduleName, functionName } = c.req.valid('json');
  const manifest = await resolverService.resolveSemantics(packageId, moduleName, functionName);
  return c.json({ success: true, data: manifest });
});

apiRouter.post('/compile', zValidator('json', CompileSchema), async (c) => {
  const { flow } = c.req.valid('json');
  const { transaction, warnings } = await compilerService.compileFlow(flow);
  const serializedTx = transaction.serialize();

  return c.json({
    success: true,
    data: { txBytes: serializedTx, warnings },
  });
});

apiRouter.post('/simulate', zValidator('json', SimulateSchema), async (c) => {
  const { flow } = c.req.valid('json');
  const { transaction, warnings } = await compilerService.compileFlow(flow);
  const simulation = await simulatorService.simulateTransaction(transaction);

  return c.json({
    success: true,
    data: { simulation, warnings },
  });
});

apiRouter.post('/publish', zValidator('json', PublishSchema), async (c) => {
  const { flow, policyId } = c.req.valid('json');
  const { warnings } = await compilerService.compileFlow(flow);

  const skillId = `skill_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
  const toolDefs = buildToolDefs(flow, skillId);
  const mcpUrl = `${config.publicBaseUrl}/api/mcp/${skillId}`;

  skillsStore.save({
    id: skillId,
    name: toolDefs.name,
    description: toolDefs.description,
    flow,
    toolDefs,
    policyId,
    createdAt: new Date().toISOString(),
  });

  return c.json({
    success: true,
    data: { skillId, mcpUrl, toolDefs, warnings },
  });
});

apiRouter.get('/skills', (c) => {
  const skills = skillsStore.list().map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    mcpUrl: `${config.publicBaseUrl}/api/mcp/${s.id}`,
    toolDefs: s.toolDefs,
    createdAt: s.createdAt,
  }));
  return c.json({ success: true, data: skills });
});

apiRouter.post('/execute', zValidator('json', ExecuteSchema), async (c) => {
  const { flow, params, skillId, execute, forceExecute } = c.req.valid('json');

  const targetFlow =
    skillId && skillsStore.get(skillId) ? skillsStore.get(skillId)!.flow : flow;

  if (!targetFlow) {
    return c.json({ success: false, error: 'flow or skillId is required' }, 400);
  }

  const result = await skillRunnerService.runFlow(targetFlow, params ?? {}, {
    execute: execute ?? false,
    forceExecute: forceExecute ?? false,
  });

  return c.json({ success: true, data: result });
});

/** MCP JSON-RPC endpoint (tools/list, tools/call) */
apiRouter.post('/mcp/:skillId', async (c) => {
  const skillId = c.req.param('skillId');
  const body = await c.req.json();
  const response = await handleMcpJsonRpc(skillId, body);
  return c.json(response);
});
