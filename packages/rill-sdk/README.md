# @rill/sdk

Typed HTTP client for the Rill backend API.

## Install (monorepo)

```json
{ "dependencies": { "@rill/sdk": "workspace:*" } }
```

## Usage

```ts
import { RillClient, haedalStakeFlow } from '@rill/sdk';

const rill = new RillClient({ baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3002/api' });

const { simulation } = await rill.simulate(haedalStakeFlow(1_000_000_000));
const { skillId, mcpUrl } = await rill.publish(haedalStakeFlow(1_000_000_000));
const result = await rill.callSkill(skillId, { amount: 1_000_000_000, execute: false });
```

## Build

```sh
bun run build:sdk
```
