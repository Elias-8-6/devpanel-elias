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

> Si el puerto 3000 está ocupado, cambia `BACKEND_HOST_PORT` en `.env`. El frontend no se ve afectado.

## Credenciales de prueba
_Pendiente: se definen con el seed._

## Decisiones técnicas
_Pendiente._

## Limitaciones conocidas
_Pendiente._
