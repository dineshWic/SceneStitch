import { describe, it, expect } from 'vitest';
import { COMPOSITION_VERSION, DEPENDS_ON_CORE } from '../src/index.js';

describe('composition', () => {
  it('exports composition version and depends on core', () => {
    expect(COMPOSITION_VERSION).toBe('0.1.0');
    expect(DEPENDS_ON_CORE).toBe('0.1.0');
  });
});
