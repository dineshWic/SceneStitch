import { describe, it, expect } from 'vitest';
import { CLI_VERSION, DEPENDS_ON_CORE } from '../src/index.js';

describe('cli', () => {
  it('exports cli version and depends on core', () => {
    expect(CLI_VERSION).toBe('0.1.0');
    expect(DEPENDS_ON_CORE).toBe('0.1.0');
  });
});
