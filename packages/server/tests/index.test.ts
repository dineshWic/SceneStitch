import { describe, it, expect } from 'vitest';

describe('server', () => {
  it('package entry exports buildApp', async () => {
    const { buildApp } = await import('../src/app.js');
    expect(typeof buildApp).toBe('function');
  });
});
