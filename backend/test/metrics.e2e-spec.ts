import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';

// Requires the database to be running and seeded (docker compose up).
describe('Metrics (e2e)', () => {
  let app: INestApplication<App>;
  let session: string;
  const http = () => request(app.getHttpServer());

  const usersTotal = async (query: string): Promise<number> => {
    const res = await http()
      .get(`/api/v1/users?${query}`)
      .set('Cookie', session)
      .expect(200);
    return (res.body as { meta: { total: number } }).meta.total;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    const res = await http()
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

  it('requires a session', async () => {
    await http().get('/api/v1/metrics/summary').expect(401);
  });

  it('matches the numbers shown by the users table', async () => {
    const res = await http()
      .get('/api/v1/metrics/summary')
      .set('Cookie', session)
      .expect(200);

    expect(res.body).toEqual({
      totalUsers: await usersTotal(''),
      activeUsers: await usersTotal('status=active'),
      admins: await usersTotal('role=admin'),
      newThisMonth: expect.any(Number),
      generatedAt: expect.any(String),
    });
    expect(res.body.newThisMonth).toBeLessThanOrEqual(res.body.totalUsers);
  });
});
