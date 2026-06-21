import type { FlowGraph } from '../compiler/compiler.service';

export interface PublishedSkill {
  id: string;
  name: string;
  description: string;
  flow: FlowGraph;
  toolDefs: {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  };
  policyId?: string;
  createdAt: string;
}

class SkillsStore {
  private skills = new Map<string, PublishedSkill>();

  save(skill: PublishedSkill): void {
    this.skills.set(skill.id, skill);
  }

  get(id: string): PublishedSkill | undefined {
    return this.skills.get(id);
  }

  list(): PublishedSkill[] {
    return Array.from(this.skills.values());
  }
}

export const skillsStore = new SkillsStore();
