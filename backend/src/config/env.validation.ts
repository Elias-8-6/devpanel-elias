import Joi from 'joi';

// Fail fast at boot if the environment is incomplete or insecure,
// instead of discovering it on the first request.
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_DB: Joi.string().required(),
  DB_SYNCHRONIZE: Joi.boolean().default(false),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_MINUTES: Joi.number().integer().min(1).max(60).default(30),
  REFRESH_TOKEN_EXPIRES_DAYS: Joi.number().integer().min(1).max(30).default(7),
  // Must be true whenever the app is served over HTTPS.
  COOKIE_SECURE: Joi.boolean().default(false),

  SEED_ADMIN_EMAIL: Joi.string().email({ tlds: false }).required(),
  SEED_ADMIN_PASSWORD: Joi.string().min(8).required(),

  CORS_ORIGIN: Joi.string().uri().required(),
  // Trusted proxy: its IP/CIDR, or a hop count. No booleans: "true" would
  // trust every peer and make X-Forwarded-For fully client-controlled.
  TRUST_PROXY: Joi.alternatives()
    .try(
      Joi.number().integer().min(0).max(5),
      Joi.string().ip({ cidr: 'optional' }),
    )
    .default(0),
  THROTTLE_TTL_MS: Joi.number().integer().positive().default(60_000),
  THROTTLE_LIMIT: Joi.number().integer().positive().default(100),
});
