import { z } from 'zod';

export const IntrospectSchema = z.object({
  packageId: z.string().min(4, 'Invalid Sui Package ID'),
});

export const ResolveSchema = z.object({
  packageId: z.string().min(4, 'Invalid Sui Package ID'),
  moduleName: z.string().min(1, 'Module name is required'),
  functionName: z.string().min(1, 'Function name is required'),
});

export const FlowEdgeSchema = z.object({
  source: z.string(),
  sourceHandle: z.string(),
  target: z.string(),
  targetHandle: z.string(),
});

export const FlowNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  config: z.record(z.string(), z.any()).optional(),
  inputs: z.record(z.string(), z.any()).optional(),
});

export const CompileSchema = z.object({
  flow: z.object({
    nodes: z.array(FlowNodeSchema),
    edges: z.array(FlowEdgeSchema),
  }),
});

export const SimulateSchema = z.object({
  flow: z.object({
    nodes: z.array(FlowNodeSchema),
    edges: z.array(FlowEdgeSchema),
  }),
});

export const PublishSchema = z.object({
  flow: z.object({
    nodes: z.array(FlowNodeSchema),
    edges: z.array(FlowEdgeSchema),
  }),
  policyId: z.string().optional(),
});

export const ExecuteSchema = z.object({
  flow: z
    .object({
      nodes: z.array(FlowNodeSchema),
      edges: z.array(FlowEdgeSchema),
    })
    .optional(),
  skillId: z.string().optional(),
  params: z.record(z.string(), z.any()).optional(),
  execute: z.boolean().optional(),
  forceExecute: z.boolean().optional(),
});
