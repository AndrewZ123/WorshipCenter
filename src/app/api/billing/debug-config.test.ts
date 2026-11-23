import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('/api/billing/debug-config', () => {
  it('does not exist as a route module', () => {
    const routePath = join(
      process.cwd(),
      'src/app/api/billing/debug-config/route.ts'
    );

    expect(existsSync(routePath)).toBe(false);
  });
});
