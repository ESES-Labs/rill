import type { FlowGraph, FlowNode } from './compiler.service';

export class PreviewService {
  buildPreview(flow: FlowGraph, warnings: string[]): string {
    const lines: string[] = ['Transaction preview:', ''];

    for (const node of flow.nodes) {
      lines.push(this.describeNode(node));
    }

    if (flow.edges.length > 0) {
      lines.push('');
      lines.push('Wiring:');
      for (const edge of flow.edges) {
        lines.push(`  ${edge.source}.${edge.sourceHandle} → ${edge.target}.${edge.targetHandle}`);
      }
    }

    if (warnings.length > 0) {
      lines.push('');
      lines.push('Warnings:');
      for (const w of warnings) {
        lines.push(`  • ${w}`);
      }
    }

    lines.push('');
    lines.push('Atomic: all steps succeed or the entire transaction reverts.');

    return lines.join('\n');
  }

  private describeNode(node: FlowNode): string {
    switch (node.type) {
      case 'cetus_swap': {
        const amount = node.inputs?.amount_in ?? node.config?.amount_in ?? '?';
        const minOut = node.inputs?.min_amount_out ?? node.config?.min_amount_out ?? '?';
        return `• Cetus swap — amount_in: ${amount} mist, min_out: ${minOut} mist`;
      }
      case 'haedal_stake': {
        const amount = node.inputs?.amount ?? node.config?.amount ?? '?';
        return `• Haedal stake — amount: ${amount} mist SUI`;
      }
      default:
        return `• ${node.type} (unsupported — skipped at compile time)`;
    }
  }
}

export const previewService = new PreviewService();
