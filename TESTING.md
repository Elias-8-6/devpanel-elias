# Plan de pruebas: DevPanel

> Fecha: 2026-10-07 · Alcance: pruebas unitarias e de integración del backend (NestJS) y del frontend (React).

## 1. Punto de partida

| Capa | Archivos | Casos | Observaciones |
|------|----------|-------|---------------|
| Backend unit | `escape-like.spec.ts`, `metrics.service.spec.ts` | 4 | Cobertura medida 40 % de líneas y **12,5 % de ramas**, y solo sobre los archivos que importan los tests. Auth, guard, filtro de errores y refresh tokens: **0 tests unitarios** |
| Backend integración (`test/*.e2e-spec.ts`) | health, auth, metrics | 11 | Corren contra la **BD de desarrollo** y dependen del seed y del orden de ejecución |
| Frontend | — | 0 | Sin runner instalado |

**Problemas estructurales que el plan resuelve primero:**
1. **BD compartida con desarrollo:** los tests escriben `refresh_tokens` en la base que usas a diario, y un cambio en el seed puede romperlos.
2. **Sin fixtures con contraseña conocida:** los usuarios demo tienen contraseña aleatoria. Por eso hoy **no se puede probar** que un usuario inactivo no pueda entrar ni que un `viewer` reciba 403.
3. **Tests acoplados por orden:** la suite de auth comparte una app y su rate limiter en memoria; el resultado depende de cuántos logins hicieron los tests anteriores.

## 2. Estrategia

| Nivel | Qué prueba | Herramientas | Dependencias |
|-------|-----------|--------------|--------------|
| **Unitario backend** | Lógica de una clase aislada (servicios, guards, filtros, DTOs) | Vitest (ya instalado) + mocks | Ninguna: sin BD ni red |
| **Integración backend** | Contrato HTTP completo: pipeline real de Nest + PostgreSQL real | Vitest + supertest | BD de test aislada |
| **Unitario frontend** | Funciones, hooks y componentes aislados | Vitest + React Testing Library + jsdom | `fetch` simulado |
| **Integración frontend** | La app completa renderizada, con la API simulada a nivel de red | RTL + **MSW** (Mock Service Worker) | Ninguna |
| *(Opcional)* E2E navegador | Recorrido P0 sobre el stack real en Docker | Playwright | docker compose |

**Criterio de qué va en cada nivel:** las reglas con muchas ramas (rotación de tokens, mapeo de errores, single-flight del refresh) van como unitarias, porque son rápidas y cada rama se aísla. Lo que solo existe al combinar piezas (cookies reales, guards globales, SQL real, cabeceras HTTP) va como integración.

## 3. Infraestructura (antes de escribir tests)

| # | Tarea | Detalle |
|---|-------|---------|
| I-1 | **BD de test aislada** | Base `devpanel_test` creada por un script en `docker-entrypoint-initdb.d`; `.env.test` apunta a ella. Los tests de integración nunca tocan `devpanel` |
| I-2 | **Fixtures deterministas** | `test/fixtures/users.ts` inserta usuarios con contraseña conocida: `admin`, `editor`, `viewer`, `inactive`, más ~20 de relleno con fechas fijas (incluidos el 1.º del mes en UTC y el último día del mes anterior) |
| I-3 | **Aislamiento por suite** | `beforeAll`: `TRUNCATE users, refresh_tokens RESTART IDENTITY CASCADE` + fixtures. Cada suite crea su propia app, así que el rate limiter arranca limpio |
| I-4 | **Helpers** | `createTestApp()` (módulo + `configureApp`), `loginAs(role)` (devuelve las cookies), `signToken(payload, opts)` (para tokens expirados o con otro secreto) |
| I-5 | **Runner del frontend** | `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `msw`; config `test` en `vite.config.ts`; script `npm test` |
| I-6 | **Cobertura con umbrales** | `@vitest/coverage-v8` con `all: true` (mide también los archivos sin tests) y umbrales por carpeta (§7) |
| I-7 | **CI** | GitHub Actions: servicio `postgres:17`, luego lint, unit back, integración back, unit/integración front y build. Bloquea el merge si falla |

## 4. Pruebas unitarias del backend

Prioridad: **A** = protege seguridad o un requisito P0 · **B** = robustez · **C** = deseable.

### Auth (A)
| Unidad | Casos |
|--------|-------|
| `AuthService.login` | Credenciales válidas → crea la sesión y llama a `purgeExpired`; contraseña incorrecta → `INVALID_CREDENTIALS`; **email inexistente → `bcrypt.compare` se llama igual contra el hash señuelo** (anti-enumeración por tiempo); usuario **inactivo** con contraseña correcta → mismo error genérico |
| `AuthService.refresh` | Rotación válida + usuario activo → nueva sesión **en la misma familia**; usuario desactivado o borrado → `revokeFamily` + `INVALID_REFRESH_TOKEN` |
| `AuthService.logout / me` | Logout con token → revoca la familia, sin token → no hace nada; `me` de un usuario inactivo → `UNAUTHENTICATED` |
| `RefreshTokensService.issue` | Guarda el **SHA-256, nunca el token**; `expiresAt = ahora + 7 días` (fake timers); familia nueva si no se pasa, la misma si se pasa; token base64url de 256 bits |
| `RefreshTokensService.rotate` | Token desconocido → 401; **revocado → revoca toda la familia + 401** (reuso); expirado → 401; `update` con `affected = 0` (carrera) → revoca la familia; éxito → `update` condicionado a `revokedAt IS NULL` |
| `JwtAuthGuard` | Ruta `@Public()` → pasa sin token; sin cookie → `UNAUTHENTICATED`; `TokenExpiredError` → `TOKEN_EXPIRED`; firma inválida → `INVALID_TOKEN`; token válido → asigna `request.user` |
| `auth.cookies` | `readCookie` con cookies ausentes, no-objeto, valor vacío o no-string; opciones: `HttpOnly`, `SameSite=Strict`, `path` correcto (`/api` y `/api/v1/auth`), `secure` según config |

### Rate limiting (A)
| Unidad | Casos |
|--------|-------|
| `buildThrottlers` | Devuelve las 4 capas con sus límites; `skipIf` → `true` en rutas sin `@LoginRateLimit()` y `false` en el login |
| Trackers | `ip|email` normaliza (trim y minúsculas: `" Admin@X "` y `"admin@x"` son la misma clave); recorta a 254 caracteres; body ausente o email no-string → `-` |
| `AppThrottlerGuard` | Pone `Retry-After = timeToBlockExpire` (mínimo 1) y lanza 429 con `code: TOO_MANY_REQUESTS` |

### Contratos y validación (A/B)
| Unidad | Casos |
|--------|-------|
| `HttpExceptionFilter` | HttpException con `code` → se respeta; errores de validación → `VALIDATION_ERROR` + `details`; **error no-HTTP → 500 `INTERNAL_ERROR`, sin mensaje ni stack del error original** y con log del lado servidor |
| `ListUsersQueryDto` | Valores por defecto (`page = 1`, `pageSize = 10`); strings numéricos convertidos; `pageSize = 51` y `page = 0` → error; rol o estado inválido → error; `search` recortado y > 100 caracteres → error |
| `LoginDto` | Email inválido, password vacío, password > 72 → error |
| `UserResponseDto.fromEntity` | Una entidad con `passwordHash` y campos extra → **solo salen los 6 campos de la allowlist** |
| `envValidationSchema` | `JWT_SECRET` < 32 → falla; defaults (30 min, 7 días, `TRUST_PROXY = 0`); `TRUST_PROXY` acepta un número de saltos o una IP/CIDR y rechaza `true` |

### Usuarios y métricas (B)
| Unidad | Casos |
|--------|-------|
| `UsersService.findPaginated` | `skip/take` correctos (página 3, tamaño 10 → `skip = 20`); búsqueda **escapada** y como parámetro, nunca concatenada; filtros solo cuando vienen; orden `createdAt DESC, id` |
| `UsersService.countUsers / normalizeEmail` | Arma el `where` con `MoreThanOrEqual`; normaliza el email |
| `UsersSeeder` | No hace nada si hay usuarios o si `NODE_ENV = production`; crea 51 usuarios; emails únicos y ASCII; resultado determinista |
| `MetricsService` | ✅ existe. Agregar límites de mes: 31-dic → 1-dic; 1-ene 00:00 UTC |

## 5. Pruebas de integración del backend

Contra la BD de test (I-1) con fixtures (I-2). ✅ = ya existe.

| Área | Casos |
|------|-------|
| **Login** | ✅ Error idéntico para email inexistente y contraseña errónea · ✅ cookies `HttpOnly`/`Strict`/`Max-Age` 1800 y 604800 · **usuario inactivo no entra** · login con email en mayúsculas o con espacios funciona · el body nunca contiene tokens |
| **Sesión** | ✅ Rotación + detección de reuso · ✅ logout revoca · **refresh con `expires_at` vencido (forzado en BD) → 401** · **usuario desactivado a mitad de sesión → el refresh falla y la familia queda revocada** · el login purga los tokens expirados del usuario · **dos refresh simultáneos con el mismo token → exactamente uno 200**, y documenta el efecto de SEC-12 |
| **Guard / JWT** | ✅ Ruta protegida sin cookie → 401 · ✅ `alg: none` → 401 · **token expirado → `TOKEN_EXPIRED`** · token firmado con otro secreto → `INVALID_TOKEN` · `iss` o `aud` incorrectos → `INVALID_TOKEN` |
| **Usuarios** | Totales, filtros y orden contra fixtures conocidas · `search=%` → 0 · inyección SQL → 0 · `pageSize=51` / parámetro desconocido → 400 · ninguna respuesta contiene `password` · página fuera de rango → `data: []` con `meta` correcto |
| **Métricas** | ✅ Coinciden con `/users` · `newThisMonth` exacto con fixtures en el límite del mes |
| **Rate limit** | ✅ 6.º intento por IP+cuenta → 429 con `Retry-After` · ✅ sin bloqueo global · ✅ bloqueo distribuido por cuenta · **21.º intento desde una IP con cuentas distintas → 429** · el refresh limitado a 20/min |
| **Pipeline HTTP** | Ruta inexistente → `{error:{code:'NOT_FOUND'}}` · **JSON malformado → 400 con el contrato de error** (verificar, puede no estar cubierto) · cabeceras de helmet presentes · CORS: un origen ajeno no recibe `Access-Control-Allow-Origin` · ✅ health |
| **Fase 2 de seguridad** *(cuando se implemente)* | Token capturado deja de servir tras el logout (SEC-03) · `viewer` → 403 en `/users` y `/metrics` (SEC-04) · el arranque con config de dev y `NODE_ENV=production` falla (SEC-05) |

## 6. Pruebas del frontend

### Unitarias
| Unidad | Casos |
|--------|-------|
| `lib/api` **(A)** | `buildUrl` omite `undefined` y `''`; `toApiError` mapea el contrato y, sin body, da `HTTP_<status>`; lee `Retry-After`; error de red → `NETWORK_ERROR`; **401 → un refresh y un solo reintento**; **3 peticiones con 401 simultáneas → exactamente UNA llamada a `/auth/refresh`** (single-flight); refresh fallido → se notifica la sesión expirada; los 401 de `/auth/login` no disparan refresh |
| `useDebouncedValue` | Emite a los 300 ms; cada cambio reinicia el temporizador (fake timers) |
| `useApiQuery` **(A)** | Cambiar el fetcher **aborta** la petición anterior; una respuesta lenta y obsoleta no pisa a la nueva; `loading` derivado; mantiene los datos previos mientras carga; el error se limpia al relanzar; `reload` vuelve a pedir |
| `LoginPage` | Mensaje por código de error; 429 → "en 59 s" / "en 15 min"; botón deshabilitado con campos vacíos o al enviar; **`safeRedirect('//evil.com')` → `/`**; aviso de sesión expirada desde `location.state` |
| `routes` | `ProtectedRoute`: muestra un spinner mientras carga y, sin sesión, redirige con `from`; `PublicOnlyRoute`: con sesión, redirige a `/` |
| `AuthProvider` | Restaura la sesión al montar; `onSessionExpired` → anónimo con `expired = true`; el logout limpia el estado aunque la petición falle |
| `UsersTable` | Escribir rápido → 1 sola petición; cambiar un filtro → vuelve a la página 1; botones de paginación deshabilitados en los extremos; estado vacío con y sin filtros; error + "Reintentar" |
| `MetricsCards` | Skeleton mientras carga; números formateados; porcentaje (`total = 0` → `0%`); error + "Reintentar" |

### Integración (app completa + MSW)
1. **Flujo P0:** abrir `/` → login → dashboard con 4 tarjetas y la tabla → buscar → paginar → cerrar sesión → `/` redirige al login.
2. **Expiración transparente:** `/users` responde 401 `TOKEN_EXPIRED` → `/auth/refresh` 200 → reintento 200; el usuario no nota nada.
3. **Sesión vencida:** el refresh responde 401 → redirige a `/login` con "Tu sesión expiró".
4. **Recarga:** `/auth/me` 200 al montar → entra directo al dashboard, sin pasar por el login.

## 7. Objetivos de cobertura

| Carpeta | Líneas | Ramas |
|---------|--------|-------|
| `backend/src/auth`, `common/rate-limit`, `common/filters` | ≥ 90 % | ≥ 85 % |
| Resto de `backend/src` | ≥ 80 % | ≥ 70 % |
| `frontend/src/lib`, `shared/hooks` | ≥ 90 % | ≥ 85 % |
| Resto de `frontend/src` | ≥ 70 % | ≥ 60 % |

La cobertura es una alarma, no un objetivo en sí: un test que solo ejecuta código sin afirmar nada no cuenta.

## 8. Trazabilidad con los requisitos

| Requisito | Unitario | Integración |
|-----------|----------|-------------|
| RF-01 Login | `AuthService.login`, `LoginDto`, `LoginPage` | Login, flujo P0 (front) |
| RF-02 Sesión persistente | `AuthProvider` | Recarga (front), `/auth/me` |
| RF-03 Ruta protegida | `JwtAuthGuard`, `routes` | Guard / JWT, flujo P0 |
| RF-04 Dashboard | `MetricsService`, `MetricsCards` | Métricas |
| RF-05 Tabla | `UsersService`, `UsersTable` | Usuarios |
| RF-06 Búsqueda con debounce | `escapeLike`, `useDebouncedValue`, `UsersTable` | Usuarios (search) |
| RF-07 Paginación | `ListUsersQueryDto`, `UsersTable` | Usuarios (paginación) |
| RF-08 Logout | `AuthService.logout`, `AuthProvider` | Sesión, flujo P0 |
| RF-09 401 → login | `lib/api`, `JwtAuthGuard` | Expiración y sesión vencida (front) |
| Seguridad (SECURITY.md) | Rate limit, filtro, cookies, tokens | Rate limit, pipeline HTTP, fase 2 |

## 9. Orden de ejecución propuesto

| Paso | Contenido | Esfuerzo estimado |
|------|-----------|-------------------|
| 1 | Infraestructura: I-1 a I-4 (BD de test, fixtures, helpers) y migrar las 11 pruebas existentes | 30 min |
| 2 | Unitarias **A** del backend: auth, refresh tokens, guard, rate limit, filtro | 45 min |
| 3 | Integración backend: los casos nuevos en **negrita** del §5 | 40 min |
| 4 | I-5 + unitarias **A** del frontend (`lib/api`, `useApiQuery`) | 35 min |
| 5 | Resto de unitarias del front + integración con MSW | 45 min |
| 6 | Unitarias **B/C**, umbrales de cobertura (I-6) y CI (I-7) | 30 min |

Los pasos 1 a 3 cubren lo crítico (seguridad y P0 del backend). Si el tiempo es limitado, el paso 4 es el siguiente más valioso: el single-flight del refresh es la lógica más delicada del frontend y hoy no tiene ninguna prueba.
