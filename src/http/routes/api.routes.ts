import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { introspectService } from '../../features/introspect/introspect.service';
import { resolverService } from '../../features/introspect/resolver.service';
import { compilerService } from '../../features/compiler/compiler.service';
import { simulatorService } from '../../features/compiler/simulator.service';
import { suiClient } from '../../core/config';
import {
  IntrospectSchema,
  ResolveSchema,
  CompileSchema,
  SimulateSchema,
  PublishSchema,
} from '../schemas/api.schema';

export const apiRouter = new Hono();

// 1. POST /api/introspect
apiRouter.post(
  '/introspect',
  zValidator('json', IntrospectSchema),
  async (c) => {
    const { packageId } = c.req.valid('json');
    const functions = await introspectService.introspectPackage(packageId);
    return c.json({ success: true, data: functions });
  }
);

// 2. POST /api/resolve
apiRouter.post(
  '/resolve',
  zValidator('json', ResolveSchema),
  async (c) => {
    const { packageId, moduleName, functionName } = c.req.valid('json');
    const manifest = await resolverService.resolveSemantics(packageId, moduleName, functionName);
    return c.json({ success: true, data: manifest });
  }
);

// 3. POST /api/compile
apiRouter.post(
  '/compile',
  zValidator('json', CompileSchema),
  async (c) => {
    const { flow } = c.req.valid('json');
    const { transaction, warnings } = compilerService.compileFlow(flow);
    const serializedTx = transaction.serialize();
    
    return c.json({
      success: true,
      data: {
        txBytes: serializedTx,
        warnings
      }
    });
  }
);

// 4. POST /api/simulate
apiRouter.post(
  '/simulate',
  zValidator('json', SimulateSchema),
  async (c) => {
    const { flow } = c.req.valid('json');
    const { transaction, warnings } = compilerService.compileFlow(flow);
    const simulation = await simulatorService.simulateTransaction(transaction);
    
    return c.json({
      success: true,
      data: {
        simulation,
        warnings
      }
    });
  }
);

// 5. POST /api/publish
apiRouter.post(
  '/publish',
  zValidator('json', PublishSchema),
  async (c) => {
    const { flow, policyId } = c.req.valid('json');
    const { transaction, warnings } = compilerService.compileFlow(flow);
    
    const skillId = `skill_${Math.random().toString(36).substring(2, 11)}`;
    const mcpUrl = `http://localhost:3000/mcp/${skillId}`;
    
    const exposedParams = flow.nodes
      .flatMap((node: any) => {
        if (node.type === 'cetus_swap') {
          return [{ name: 'amount_in', type: 'number', description: 'Amount of SUI to swap' }];
        }
        if (node.type === 'haedal_stake') {
          return [{ name: 'amount', type: 'number', description: 'Amount of SUI to stake' }];
        }
        return [];
      });

    const toolDefs = {
      name: `rill_${skillId}`,
      description: `Execute a composed Sui action block containing: ${flow.nodes.map((n: any) => n.type).join(' -> ')}`,
      inputSchema: {
        type: 'object',
        properties: exposedParams.reduce((acc: any, p: any) => {
          acc[p.name] = { type: p.type, description: p.description };
          return acc;
        }, {}),
        required: exposedParams.map((p: any) => p.name),
      }
    };

    return c.json({
      success: true,
      data: {
        skillId,
        mcpUrl,
        toolDefs,
        warnings
      }
    });
  }
);
