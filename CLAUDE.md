# CLAUDE.md: contexto del proyecto DevPanel

Mini panel de administración (prueba técnica, 2 horas). El plan completo y los requerimientos están en `PLAN.md`.

## Stack
- **Backend:** NestJS 12 (ESM, TypeScript strict), TypeORM y PostgreSQL 17. Vive en `backend/`.
- **Frontend:** React 19, Vite, TypeScript strict, Tailwind v4 y React Router. Vive en `frontend/`.
- **Infra:** docker-compose con `db`, `adminer` (:8080), `backend` (:3000) y `frontend` (:5173).

## Arquitectura (SOA sobre REST)
- Un módulo Nest por servicio: `auth`, `users`, `metrics`, `health`. Cada uno es dueño de su controlador, servicio, DTOs y repositorio.
- Un servicio NO accede al repositorio de otro; consume su servicio exportado (p. ej. `metrics` usa `UsersService`).
- Contratos bajo `/api/v1/...`. Las rutas no incluyen `api` ni `v1`, eso lo agrega `app.setup.ts`.
- Error uniforme: `{ error: { code, message } }`. Listas paginadas: `{ data, meta: { page, pageSize, total, totalPages } }`.
- Las preocupaciones transversales (helmet, CORS, validación, rate limit) viven en `app.setup.ts` y `app.module.ts`, no en cada controlador.

## Reglas de seguridad (no negociables)
- Passwords con `bcryptjs` (cost ≥ 10). Nunca devolver `passwordHash`; las respuestas usan DTOs de salida.
- Access token JWT HS256 de **30 min** y refresh token opaco de **7 días**, ambos en cookies `HttpOnly` + `SameSite=Strict` (+ `Secure` en producción). **Nunca** en `localStorage` ni en el body de la respuesta.
- El refresh token se guarda en `refresh_tokens` **solo como hash SHA-256**. Es de un solo uso (rotación); reusar uno revocado revoca toda su familia.
- Guard JWT global: toda ruta nueva es privada salvo que lleve `@Public()`.
- Login: mensaje genérico "Credenciales inválidas" y `@Throttle` estricto.
- Toda entrada pasa por DTOs con `class-validator`; `pageSize` con tope (máx. 50).
- Búsqueda solo con parámetros (`ILike` / query builder con parámetros). Nunca concatenar SQL.
- Secretos solo desde `ConfigService`; nada hardcodeado.

## Convenciones de código
- Prohibido `any`. Usar `unknown` y estrechar el tipo.
- Backend: imports relativos con extensión `.js` (ESM nodenext), comillas simples, Prettier.
- Frontend: el cliente HTTP usa rutas relativas `/api/...` (Vite hace el proxy, así que todo es mismo origen) y `credentials: 'same-origin'`. No usar `'include'`: enviaría las cookies a cualquier origen al que se haga fetch.
- Frontend: el refresh de sesión pasa siempre por `refreshSession()` en `lib/api.ts`, que lo serializa dentro de la pestaña y entre pestañas (Web Locks). Nunca llamar a `/auth/refresh` directamente.
- Toda corrección va con un test que falle sin ella.
- Commits pequeños por bloque del plan (Conventional Commits).

## Comandos
- Todo: `docker compose up --build` (Adminer: `docker compose --profile tools up -d`)
- Backend: `npm run start:dev`, `npm run lint`, `npm test` (unitarias), `npm run test:e2e` (integración, requiere la BD levantada)
- Frontend: `npm run dev`, `npm run build`, `npm run lint`, `npm test`
