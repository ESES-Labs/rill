export interface MoveParameter {
  index: number;
  name: string | null;
  moveType: string;
  class: 'system' | 'object' | 'coin' | 'pure' | 'vector' | 'option' | 'generic';
}

export interface DiscoveredFunction {
  packageId: string;
  module: string;
  name: string;
  isEntry: boolean;
  typeParameters: { index: number; abilities: string[] }[];
  parameters: MoveParameter[];
}
