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
_Pendiente._

## Limitaciones conocidas
_Pendiente._
