# DevPanel

Mini panel de administración con login, dashboard y tabla de usuarios con búsqueda.

**Stack:** React 19 + Vite (frontend), NestJS 12 + TypeORM (API REST), PostgreSQL 17, todo orquestado con Docker Compose.

## Prerrequisitos
- Docker Desktop (con Docker Compose v2)
- Opcional, para correr fuera de Docker: Node.js 24+

## Cómo correrlo

```bash
git clone <repo-url> devpanel && cd devpanel
cp .env.example .env
docker compose up --build
```

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| API | http://localhost:3000/api/v1/health |
| Adminer (GUI de la BD) | http://localhost:8080 (sistema: PostgreSQL, servidor: `db`, usuario, contraseña y BD según `.env`) |
| PostgreSQL | `localhost:5432` |

> **Adminer:** en el campo *Servidor* usa `db`, no `localhost:5432`. Adminer corre dentro de su propio contenedor, donde `localhost` es él mismo. `localhost:5432` solo sirve para clientes instalados en tu máquina (DBeaver, pgAdmin, psql).

> Si el puerto 3000 está ocupado, cambia `BACKEND_HOST_PORT` en `.env`. El frontend no se ve afectado.

## Credenciales de prueba
Al primer arranque, el seed crea automáticamente un administrador y 50 usuarios de demostración (solo si la tabla está vacía y nunca en producción).

| Email | Password |
|-------|----------|
| `admin@devpanel.local` | `DevPanel#2026` |

Se configuran con `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` en `.env`. Los usuarios de demostración tienen una contraseña aleatoria que no se revela: sirven para poblar la tabla, no para iniciar sesión.

## Decisiones técnicas
- **SOA dentro de un monolito modular:** servicios `auth`, `users`, `metrics` y `health` con contratos REST en `/api/v1`. Se comunican entre sí solo a través de sus servicios exportados.
- **Sesión:** access token JWT de 30 min y refresh token de 7 días, ambos en cookies `HttpOnly` + `SameSite=Strict`. El refresh se guarda en BD solo como hash SHA-256, es de un solo uso y reusarlo revoca la sesión completa.
- **Seguro por defecto:** guard JWT global (las rutas públicas se marcan con `@Public()`), validación estricta de entradas, rate limit (login: 5/min) y formato de error uniforme `{ error: { code, message } }`.

## Limitaciones conocidas
- El rate limit se guarda en memoria y se aplica por IP. Detrás del proxy de Vite todos los clientes comparten la IP del proxy; en producción haría falta `trust proxy` y un almacenamiento compartido (Redis).
- Si dos pestañas refrescan la sesión con el mismo token al mismo tiempo, la detección de reuso cierra la sesión. El frontend debe serializar el refresh.
- Las tablas se crean con `synchronize` de TypeORM (solo desarrollo); no hay migraciones.
