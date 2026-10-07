import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto.js';

const errorsFor = async (password: unknown) => {
  const dto = plainToInstance(LoginDto, { email: 'a@x.test', password });
  const errors = await validate(dto);
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}));
};

describe('LoginDto password', () => {
  it('accepts 72 ASCII characters (72 bytes)', async () => {
    expect(await errorsFor('a'.repeat(72))).toEqual([]);
  });

  it('rejects 72 "ñ" characters: 144 bytes, bcrypt would silently truncate', async () => {
    expect(await errorsFor('ñ'.repeat(72))).toContain('maxBytes');
  });

  it('rejects 37 "ñ" characters (74 bytes) even though it is under 72 chars', async () => {
    expect(await errorsFor('ñ'.repeat(37))).toContain('maxBytes');
  });

  it('rejects an empty or non-string password', async () => {
    expect(await errorsFor('')).toContain('minLength');
    expect(await errorsFor(12345)).toContain('isString');
  });
});
