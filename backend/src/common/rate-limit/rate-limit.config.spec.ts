import { attemptedEmail } from './rate-limit.config.js';

describe('attemptedEmail (login rate-limit key)', () => {
  it('normalizes like the DB lookup, so variants share one bucket', () => {
    expect(attemptedEmail({ body: { email: '  Admin@DevPanel.Local ' } })).toBe(
      'admin@devpanel.local',
    );
  });

  it('caps the key length', () => {
    const long = `${'a'.repeat(500)}@x.test`;
    expect(attemptedEmail({ body: { email: long } })).toHaveLength(254);
  });

  it.each([
    ['missing body', {}],
    ['non-object body', { body: 'email=x' }],
    ['non-string email', { body: { email: ['a@x.test'] } }],
  ])('falls back to "-" for %s', (_case, req) => {
    expect(attemptedEmail(req)).toBe('-');
  });
});
