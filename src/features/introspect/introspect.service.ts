import { suiClient } from '../../core/config';
import { DiscoveredFunction, MoveParameter } from './types';

export class IntrospectService {
  /**
   * Introspects a Move package and extracts public/entry functions.
   */
  async introspectPackage(packageId: string): Promise<DiscoveredFunction[]> {
    try {
      const modules = await suiClient.getNormalizedMoveModulesByPackage({
        package: packageId,
      }) as Record<string, any>;

      const result: DiscoveredFunction[] = [];

      for (const [moduleName, moduleDef] of Object.entries(modules)) {
        if (!moduleDef || !moduleDef.exposedFunctions) continue;
        
        for (const [functionName, functionDef] of Object.entries(moduleDef.exposedFunctions) as [string, any][]) {
          // We only expose public or entry functions to the UI/agent
          if (!functionDef.isEntry && functionDef.visibility?.toLowerCase() !== 'public') {
            continue;
          }

          const typeParameters = (functionDef.typeParameters || []).map((tp: any, idx: number) => ({
            index: idx,
            abilities: tp.abilities || [],
          }));

          const parameters = (functionDef.parameters || []).map((paramType: any, idx: number) => {
            const typeStr = this.normalizeTypeToString(paramType);
            const classified = this.classifyParameter(typeStr);

            return {
              index: idx,
              name: null,
              moveType: typeStr,
              class: classified,
            };
          });

          result.push({
            packageId,
            module: moduleName,
            name: functionName,
            isEntry: functionDef.isEntry,
            typeParameters,
            parameters,
          });
        }
      }

      return result;
    } catch (error: any) {
      throw new Error(`Failed to introspect package ${packageId}: ${error.message}`);
    }
  }

  /**
   * Helper to convert Move normalized type to string representation.
   */
  private normalizeTypeToString(type: any): string {
    if (typeof type === 'string') {
      return type;
    }
    if (type.Reference) {
      return `&${this.normalizeTypeToString(type.Reference)}`;
    }
    if (type.MutableReference) {
      return `&mut ${this.normalizeTypeToString(type.MutableReference)}`;
    }
    if (type.Vector) {
      return `vector<${this.normalizeTypeToString(type.Vector)}>`;
    }
    if (type.Struct) {
      const struct = type.Struct;
      const typeParams = (struct.typeArguments || []).map((ta: any) => this.normalizeTypeToString(ta)).join(', ');
      const suffix = typeParams ? `<${typeParams}>` : '';
      return `${struct.address}::${struct.module}::${struct.name}${suffix}`;
    }
    if (type.TypeParameter !== undefined) {
      return `T${type.TypeParameter}`;
    }
    return JSON.stringify(type);
  }

  /**
   * Categorizes a normalized type representation into standard categories.
   */
  private classifyParameter(typeStr: string): MoveParameter['class'] {
    if (typeStr.includes('0x2::tx_context::TxContext') || typeStr.includes('0x2::clock::Clock')) {
      return 'system';
    }
    if (typeStr.startsWith('T') && !typeStr.includes('::')) {
      return 'generic';
    }
    if (typeStr.includes('0x2::coin::Coin')) {
      return 'coin';
    }
    if (typeStr.startsWith('vector<')) {
      return 'vector';
    }
    if (typeStr.includes('option::Option')) {
      return 'option';
    }
    if (typeStr.includes('::') && (typeStr.includes('&') || !['u8','u16','u32','u64','u128','u256','bool','address'].some(t => typeStr.includes(t)))) {
      return 'object';
    }
    return 'pure';
  }
}

export const introspectService = new IntrospectService();
