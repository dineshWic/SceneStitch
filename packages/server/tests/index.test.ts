import { describe, it, expect } from 'vitest';
import { SERVER_VERSION, DEPENDS_ON_CORE } from '../src/index.js';

describe('server', () => {
  it('exports server version and depends on core', () => {
    expect(SERVER_VERSION).toBe('0.1.0');
    expect(DEPENDS_ON_CORE).toBe('0.1.0');
  });
});
