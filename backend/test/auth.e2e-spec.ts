import { Test, TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request, { Response } from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';

// Requires the database to be running and seeded (docker compose up).
const ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL ?? 'admin@devpanel.local',
  password: process.env.SEED_ADMIN_PASSWORD ?? 'DevPanel#2026',
};

const setCookies = (res: Response): string[] => {
  const header = res.headers['set-cookie'] as string[] | string | undefined;
  if (!header) return [];
  return Array.isArray(header) ? header : [header];
};

const cookieValue = (res: Response, name: string): string | undefined =>
  setCookies(res)
    .find((c) => c.startsWith(`${name}=`))
    ?.split(';')[0];

// One app for the whole suite: the in-memory rate limiter must persist
// across tests for the brute-force check at the end.
describe('Auth (e2e)', () => {
  let app: NestExpressApplication;
  const http = () => request(app.getHttpServer());

  const login = () => http().post('/api/v1/auth/login').send(ADMIN);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a wrong password and an unknown email with the same error', async () => {
    const wrongPassword = await http()
      .post('/api/v1/auth/login')
      .send({ email: ADMIN.email, password: 'not-the-password' })
      .expect(401);
    const unknownEmail = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@devpanel.local', password: 'whatever' })
      .expect(401);

    expect(wrongPassword.body).toEqual({
      error: { code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas' },
    });
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });

  it('protects routes by default', async () => {
    const res = await http().get('/api/v1/users').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a tampered access token', async () => {
    const res = await http()
      .get('/api/v1/auth/me')
      .set('Cookie', 'access_token=eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.')
      .expect(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('logs in with HttpOnly cookies, rotates the refresh token and detects reuse', async () => {
    const res = await login().expect(200);

    // The body carries the user, never a token or the password hash.
    expect(res.body).toMatchObject({ email: ADMIN.email, role: 'admin' });
    expect(JSON.stringify(res.body)).not.toMatch(/token|password/i);

    const cookies = setCookies(res);
    const access = cookies.find((c) => c.startsWith('access_token='));
    const refresh = cookies.find((c) => c.startsWith('refresh_token='));
    expect(access).toMatch(/HttpOnly/);
    expect(access).toMatch(/SameSite=Strict/);
    expect(access).toMatch(/Max-Age=1800/); // 30 minutes
    expect(refresh).toMatch(/HttpOnly/);
    expect(refresh).toMatch(/Path=\/api\/v1\/auth/);
    expect(refresh).toMatch(/Max-Age=604800/); // 7 days

    const accessCookie = cookieValue(res, 'access_token')!;
    const firstRefresh = cookieValue(res, 'refresh_token')!;

    const me = await http()
      .get('/api/v1/auth/me')
      .set('Cookie', accessCookie)
      .expect(200);
    expect(me.body.email).toBe(ADMIN.email);
    await http().get('/api/v1/users').set('Cookie', accessCookie).expect(200);

    // Rotation: the refresh token is single-use.
    const rotated = await http()
      .post('/api/v1/auth/refresh')
      .set('Cookie', firstRefresh)
      .expect(200);
    const secondRefresh = cookieValue(rotated, 'refresh_token')!;
    expect(secondRefresh).not.toBe(firstRefresh);

    // Replaying the old token revokes the whole session family...
    const replay = await http()
      .post('/api/v1/auth/refresh')
      .set('Cookie', firstRefresh)
      .expect(401);
    expect(replay.body.error.code).toBe('INVALID_REFRESH_TOKEN');

    // ...so even the newest token stops working.
    await http()
      .post('/api/v1/auth/refresh')
      .set('Cookie', secondRefresh)
      .expect(401);
  });

  it('logout revokes the refresh token and clears both cookies', async () => {
    const res = await login().expect(200);
    const refresh = cookieValue(res, 'refresh_token')!;

    const out = await http()
      .post('/api/v1/auth/logout')
      .set('Cookie', refresh)
      .expect(204);
    const cleared = setCookies(out).join(' ');
    expect(cleared).toMatch(/access_token=;/);
    expect(cleared).toMatch(/refresh_token=;/);

    await http()
      .post('/api/v1/auth/refresh')
      .set('Cookie', refresh)
      .expect(401);
  });

  describe('login rate limiting', () => {
    const attempt = (email: string, ip?: string) => {
      const req = http()
        .post('/api/v1/auth/login')
        .send({ email, password: 'wrong-password' });
      // TRUST_PROXY_HOPS=1 in the e2e env: the test client acts as the proxy.
      return ip ? req.set('X-Forwarded-For', ip) : req;
    };

    it('blocks a 6th attempt on the same account from the same IP', async () => {
      for (let i = 0; i < 5; i++) await attempt('victim1@x.test').expect(401);

      const blocked = await attempt('victim1@x.test').expect(429);
      expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('does not lock out other accounts from the same IP (no global DoS)', async () => {
      await login().expect(200);
    });

    it('locks an account targeted from many IPs (distributed brute force)', async () => {
      for (let i = 1; i <= 10; i++) {
        await attempt('victim2@x.test', `10.0.0.${i}`).expect(401);
      }
      const blocked = await attempt('victim2@x.test', '10.0.0.99').expect(429);
      // Account lock lasts ~15 minutes.
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(60);
    });
  });
});
