import { escapeLike } from './escape-like.js';

describe('escapeLike', () => {
  it('escapes LIKE wildcards and the escape character', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });

  it('leaves regular text untouched', () => {
    expect(escapeLike('ana.perez@mail.com')).toBe('ana.perez@mail.com');
  });
});
