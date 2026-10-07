# Evaluación de seguridad: DevPanel

> Fecha: 2026-10-07 · Alcance: backend NestJS, frontend React, docker-compose de desarrollo.
> Método: revisión del código contra OWASP Top 10 (2021) más pruebas de ataque reales sobre el stack corriendo (curl, tests e2e y navegador).

## 1. Ataques ya mitigados

| Ataque | Control | Verificado con |
|--------|---------|----------------|
| SQL injection | Query builder parametrizado; los comodines `%`/`_` de la búsqueda se escapan | `search=' OR 1=1--` → 0 resultados |
| Robo de token vía XSS | Tokens solo en cookies `HttpOnly`; nunca en el body ni en `localStorage` | `document.cookie === ''` en el navegador |
| CSRF | `SameSite=Strict`, API solo JSON, CORS restringido al origen del frontend | Revisión |
| Fuerza bruta / credential stuffing | Rate limit en capas (ver §3) | e2e + ataque en Docker |
| Enumeración de usuarios | Error genérico y comparación bcrypt contra un hash señuelo cuando el email no existe | e2e: mismo body para email inexistente y contraseña errónea |
| JWT manipulado / `alg: none` | Algoritmo, `iss` y `aud` fijados al verificar | e2e: token `alg: none` → 401 |
| Robo de refresh tokens desde la BD | Solo se guarda el SHA-256 | Consulta SQL: el valor de la cookie no aparece |
| Replay de refresh token | Un solo uso; reusar uno revocado revoca toda la familia | e2e |
| Mass assignment / parámetros extra | `whitelist` + `forbidNonWhitelisted` | `?isAdmin=true` → 400 |
| Volcado masivo de datos | `pageSize` máx. 50, búsqueda máx. 100 caracteres | `pageSize=1000` → 400 |
| Fuga de información en errores | Filtro global: sin stack traces; formato `{error:{code,message}}` | Revisión |
| Open redirect tras el login | Solo se aceptan rutas internas (`/...`, no `//...`) | Revisión |
| Dependencias vulnerables | `npm audit --omit=dev` | 0 vulnerabilidades (back y front) |

## 2. Hallazgos

| ID | Severidad | Hallazgo | Evidencia | Estado |
|----|-----------|----------|-----------|--------|
| SEC-01 | **Alta** | El rate limit del login contaba por IP, pero detrás del proxy todos compartían la IP del proxy: **5 intentos fallidos de un atacante bloqueaban el login de todos los usuarios** (DoS) | Atacante 5×401 → admin con contraseña correcta recibía **429** | ✅ **Corregido** (§3) |
| SEC-02 | **Alta** | PostgreSQL (`5432`) y Adminer (`8080`) publicados en `0.0.0.0` con credenciales que están en el repo público: cualquiera en la misma red (Wi-Fi) puede leer o modificar la BD, hashes incluidos | Desde la IP LAN: Adminer HTTP 200, puerto 5432 abierto | Pendiente |
| SEC-03 | Media | El access token no se puede revocar: tras el logout, tras desactivar al usuario o tras detectar reuso del refresh, el JWT sigue siendo válido hasta 30 min | Token capturado antes del logout → `GET /users` **200** después del logout | Pendiente |
| SEC-04 | Media | Sin autorización por rol (OWASP A01): cualquier usuario autenticado, incluido un `viewer`, ve el listado completo con emails y las métricas | No hay control de rol en `users`/`metrics` | Pendiente |
| SEC-05 | Media | Nada impide arrancar en producción con configuración de desarrollo: `JWT_SECRET` de ejemplo (público), `COOKIE_SECURE=false`, `DB_SYNCHRONIZE=true` | El esquema Joi solo valida tipos y longitud | Pendiente |
| SEC-06 | Media | El HTML del frontend no envía CSP, `X-Frame-Options` ni `nosniff`: el panel se puede embeber (clickjacking), y un XSS futuro correría sin freno (no robaría las cookies, pero sí podría actuar como el usuario) | `curl -I :5173` sin esas cabeceras | Pendiente |
| SEC-07 | Media | Contadores del rate limit en memoria: se reinician con cada deploy y no se comparten entre réplicas (con N réplicas el límite real es N×) | Diseño | Pendiente (producción) |
| SEC-08 | Baja | El bloqueo por cuenta (10 intentos / 15 min) permite que un atacante bloquee a propósito a una víctima durante 15 min | Diseño (trade-off aceptado) | Aceptado / mejorable |
| SEC-09 | Baja | No hay registro de eventos de seguridad (logins fallidos, bloqueos, reuso de refresh) (OWASP A09) | Revisión | Pendiente |
| SEC-10 | Baja | Los contenedores corren como `root` | `whoami` → `root` | Pendiente |
| SEC-11 | Baja | No hay TLS en desarrollo. En producción las cookies `Secure` y HSTS requieren HTTPS | Diseño | Producción |
| SEC-12 | Baja | Dos pestañas que refrescan a la vez disparan una falsa detección de reuso y cierran la sesión (disponibilidad) | Diseño | Pendiente |
| SEC-13 | Info | bcrypt con costo 10. Para hardware de 2026 se recomienda 12, previa medición de la latencia del login | Revisión | Opcional |

## 3. Rate limiting implementado (SEC-01)

| Capa | Límite | Clave | Frena |
|------|--------|-------|-------|
| `default` | 100 / min | IP | Abuso general de la API |
| `login-ip-account` | 5 / min | IP + email | Fuerza bruta contra una cuenta |
| `login-ip` | 20 / min | IP | Credential stuffing (muchas cuentas desde una IP) |
| `login-account` | 10 / 15 min, bloqueo de 15 min | email | Fuerza bruta distribuida (muchas IPs, una cuenta) |
| `refresh` | 20 / min | IP | Abuso del endpoint de refresh |

- **IP real del cliente:** el proxy agrega `X-Forwarded-For` y el backend confía en **exactamente un salto** (`TRUST_PROXY_HOPS=1`). Un `X-Forwarded-For` falsificado por el cliente se ignora; verificado: 6 intentos con IPs falsas distintas → bloqueado al 6.º.
- **API solo en loopback** (`127.0.0.1`): con un salto de confianza, quien llegara directo a la API podría falsificar la IP.
- **Respuesta 429** con la cabecera estándar `Retry-After`; el login muestra "Inténtalo de nuevo en N s/min".

## 4. Plan de corrección

### Fase 1: inmediata (~15 min)
1. **SEC-02:** publicar `db` y `adminer` solo en `127.0.0.1` y mover Adminer a un perfil opcional (`docker compose --profile tools up`).
2. **SEC-10:** `USER node` en los Dockerfiles.

### Fase 2: robustez de la sesión y del acceso (~45 min)
3. **SEC-03:** agregar al JWT el claim `sid` (id de la familia de refresh). El guard verifica en cada petición, con una consulta indexada, que la familia no esté revocada y que el usuario siga activo. El logout pasa a ser inmediato.
4. **SEC-04:** `RolesGuard` + `@Roles()`. `/users` y `/metrics` quedan para `admin` y `editor`, y un `viewer` recibe 403. Con test e2e.
5. **SEC-05:** reglas Joi condicionales con `NODE_ENV=production`: rechazar el secreto de ejemplo, exigir `COOKIE_SECURE=true` y prohibir `DB_SYNCHRONIZE`.

### Fase 3: antes de producción
6. **SEC-06:** build estático servido por nginx con `Content-Security-Policy: default-src 'self'; frame-ancestors 'none'`, `X-Content-Type-Options: nosniff` y `Referrer-Policy`.
7. **SEC-07:** contadores del rate limit en Redis.
8. **SEC-11:** TLS en el reverse proxy, `COOKIE_SECURE=true`, `TRUST_PROXY_HOPS` según la topología real.
9. **SEC-09:** log estructurado de eventos de seguridad (login fallido, bloqueo, reuso de refresh, logout).
10. Migraciones de TypeORM en lugar de `synchronize`.

### Fase 4: mejoras
11. **SEC-08:** en lugar de bloquear la cuenta, pedir un desafío extra (CAPTCHA) después de N fallos y notificar al usuario.
12. **SEC-12:** período de gracia de unos segundos para el refresh recién rotado, o coordinar el refresh entre pestañas con Web Locks.
13. **SEC-13:** subir el costo de bcrypt a 12, midiendo antes la latencia del login.
