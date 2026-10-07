import { Test, TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';

// Requires the database to be running and seeded (docker compose up).
describe('Users (e2e)', () => {
  let app: NestExpressApplication;
  let session: string;
  const list = (query: string) =>
    request(app.getHttpServer())
      .get(`/api/v1/users?${query}`)
      .set('Cookie', session);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      })
      .expect(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    session = cookies.find((c) => c.startsWith('access_token='))!.split(';')[0];
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers 400 (not 500) for a page beyond the cap', async () => {
    const res = await list('page=100000000000000000000').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns an empty page with consistent meta past the last page', async () => {
    const res = await list('page=1000&pageSize=10').expect(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.page).toBe(1000);
  });

  it('matches wildcards and SQL literally', async () => {
    expect((await list('search=%25').expect(200)).body.meta.total).toBe(0);
    expect(
      (await list(`search=${encodeURIComponent("' OR 1=1--")}`).expect(200))
        .body.meta.total,
    ).toBe(0);
  });

  it('never exposes password data', async () => {
    const res = await list('pageSize=50').expect(200);
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });
});
