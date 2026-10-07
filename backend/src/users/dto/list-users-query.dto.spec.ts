import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListUsersQueryDto, MAX_PAGE } from './list-users-query.dto.js';

// Query strings always arrive as strings, like in a real request.
const parse = async (query: Record<string, string>) => {
  const dto = plainToInstance(ListUsersQueryDto, query);
  const errors = await validate(dto);
  return { dto, failed: errors.map((e) => e.property) };
};

describe('ListUsersQueryDto', () => {
  it('applies defaults and converts numeric strings', async () => {
    const { dto, failed } = await parse({ page: '3', search: '  ana  ' });
    expect(failed).toEqual([]);
    expect(dto).toMatchObject({ page: 3, pageSize: 10, search: 'ana' });
  });

  it('rejects a page beyond the cap (1e20 used to reach SQL and return 500)', async () => {
    expect((await parse({ page: '100000000000000000000' })).failed).toEqual([
      'page',
    ]);
    expect((await parse({ page: String(MAX_PAGE + 1) })).failed).toEqual([
      'page',
    ]);
    expect((await parse({ page: String(MAX_PAGE) })).failed).toEqual([]);
  });

  it.each([
    [{ page: '0' }, 'page'],
    [{ pageSize: '51' }, 'pageSize'],
    [{ role: 'superuser' }, 'role'],
    [{ status: 'deleted' }, 'status'],
    [{ search: 'x'.repeat(101) }, 'search'],
  ])('rejects %o', async (query, property) => {
    expect((await parse(query)).failed).toEqual([property]);
  });
});
