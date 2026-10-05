import { describe, it, expect } from 'vitest';
import { WEB_VERSION, DEPENDS_ON_CORE } from '../src/index.js';

describe('web', () => {
  it('exports web version and depends on core', () => {
    expect(WEB_VERSION).toBe('0.1.0');
    expect(DEPENDS_ON_CORE).toBe('0.1.0');
  });
});
