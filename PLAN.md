# DevPanel: plan de desarrollo (2 horas)

> Fuente: `Prueba_Tecnica_Devpanel_IA.pdf` (Credicorp Bank, examen técnico práctico).
> Enfoque: API REST, principios SOA y seguridad como requisito de primera clase.
> Las tecnologías concretas se definen en el siguiente paso; este plan no depende de ellas.

---

## 1. Requerimientos

### 1.1 Funcionales

| ID | Requerimiento | Prioridad | Tiempo |
|----|---------------|-----------|--------|
| RF-01 | Login con email y password (POST al backend) | P0 MUST | 15 min |
| RF-02 | Sesión persistente: el token se guarda y sobrevive a un reload | P0 MUST | 15 min |
| RF-03 | Ruta protegida: sin sesión, redirige al login | P0 MUST | 10 min |
| RF-04 | Dashboard con al menos 2 tarjetas de métricas | P0 MUST | 10 min |
| RF-05 | Tabla de usuarios cargada desde el backend | P0 MUST | 20 min |
| RF-06 | Búsqueda en la tabla con debounce, sin recargar todo | P0 MUST | 15 min |
| RF-07 | Paginación (o scroll infinito) | P1 SHOULD | 10 min |
| RF-08 | Logout funcional | P1 SHOULD | 5 min |
| RF-09 | Manejo de 401: token vencido lleva al login | P1 SHOULD | 10 min |
| RF-10 | Usuario logueado visible en el header | P2 NICE | 5 min |
| RF-11 | Filtros por rol o estado | P2 NICE | 10 min |
| RF-12 | Diseño cuidado (Tailwind, shadcn, etc.) | P2 NICE | — |

### 1.2 Restricciones y entregables

- Corre en local con instrucciones claras: clonar y correr en **menos de 5 minutos**.
- Base de datos libre (PostgreSQL, MySQL, SQLite o in-memory). **Prohibido** guardar usuarios fijos en un JSON.
- Repo público en GitHub `devpanel-[nombre]`, con **commits frecuentes y progresivos**.
- Archivos obligatorios en la raíz: `README.md`, `AI-LOG.md`, `CLAUDE.md`, `.env.example`.
- **README**: stack en 1-2 líneas, prerrequisitos, pasos copy-paste, credenciales de prueba, 3-4 decisiones técnicas, limitaciones conocidas.
- **AI-LOG.md**: herramientas usadas, stack y su justificación, prompts representativos (prompt, resultado, qué se hizo con él), al menos un rechazo o modificación del output de la IA con su motivo, % de código IA vs propio, algo que la IA hizo excelente y algo que hizo mal.
- No usar un boilerplate de login y dashboard ya hecho. Los starters estándar (vite, nest new, etc.) sí están permitidos.

### 1.3 Criterios de evaluación (guían la priorización)

| Dimensión | Peso | Implicación para el plan |
|-----------|------|--------------------------|
| P0 funcionando end-to-end | 30% | Ningún P1 o P2 se toca antes de cerrar los P0 |
| Calidad del código | 20% | Tipado estricto, sin `any`, revisar todo lo que genere la IA |
| Stack y arquitectura | 15% | SOA y REST justificados en el AI-LOG |
| Uso efectivo de IA | 15% | Registrar prompts y rechazos *mientras* se trabaja |
| AI-LOG.md | 10% | Honestidad y detalle |
| README | 10% | Setup sin fricción (seed automático, `.env.example` funcional) |

### 1.4 Requerimientos no funcionales de seguridad (añadidos por nosotros)

| ID | Control | Mitiga |
|----|---------|--------|
| RS-01 | Passwords con hash adaptativo (bcrypt o argon2), nunca en texto plano | Robo de la BD |
| RS-02 | Access token JWT de **30 min** + refresh token de **7 días** guardado en BD como hash SHA-256, con rotación y detección de reuso | Robo o falsificación de sesión |
| RS-03 | Token en cookie `HttpOnly` + `Secure` + `SameSite=Strict` (preferido) en lugar de `localStorage` | XSS que roba el token |
| RS-04 | Rate limiting en `/auth/login` (p. ej. 5 intentos/min por IP) | Fuerza bruta |
| RS-05 | Mensaje de error genérico ("credenciales inválidas") y tiempo constante | Enumeración de usuarios |
| RS-06 | Validación de entrada por esquema en todos los endpoints (email, longitud, `page`/`pageSize` con tope) | Inyección, abuso de recursos |
| RS-07 | Consultas parametrizadas u ORM; la búsqueda nunca se concatena en SQL | SQL injection |
| RS-08 | Headers de seguridad (Helmet o equivalente) y CORS restringido al origen del frontend | Clickjacking, CORS abierto |
| RS-09 | DTOs de salida: nunca devolver `passwordHash` ni campos internos | Exposición de datos |
| RS-10 | Manejo centralizado de errores: sin stack traces al cliente | Fuga de información |
| RS-11 | Secretos solo en `.env` (ignorado por git); `.env.example` sin valores reales | Secretos en el repo |
| RS-12 | Autorización por rol en endpoints sensibles (si entra RF-11) | Escalada de privilegios |

---

## 2. Arquitectura

### 2.1 Decisión: SOA aplicada como "monolito modular orientado a servicios"

En 2 horas, levantar servicios desplegados por separado (contenedores, red, service discovery) consume el tiempo de los P0. La decisión es aplicar los **principios SOA dentro de un solo proceso backend**, con fronteras de servicio explícitas, para que cada servicio pueda extraerse después sin reescribirlo. Esta decisión se justificará así en el AI-LOG.

| Principio SOA | Cómo se aplica |
|---------------|----------------|
| Contrato estandarizado | Cada servicio expone un contrato REST versionado (`/api/v1`) con DTOs tipados y validados; documentado en OpenAPI si hay tiempo |
| Bajo acoplamiento | Los servicios no comparten estado interno; se comunican solo a través de interfaces o contratos |
| Abstracción | El frontend no conoce la BD ni la lógica; solo consume contratos |
| Reutilización | `AuthService` (verificación de token) se reutiliza en todos los servicios vía middleware |
| Autonomía | Cada servicio tiene su propio módulo: rutas, controlador, servicio, repositorio |
| Sin estado (statelessness) | La autenticación vive en el token; el servidor no guarda sesiones en memoria |
| Composición | `MetricsService` compone datos de `UserService` en lugar de duplicar consultas |
| Descubrimiento | `GET /api/v1/health` y la documentación del contrato |

### 2.2 Vista lógica

```
[ Frontend SPA ]
       │  HTTPS / JSON (REST)
       ▼
[ API Gateway layer ]   ← CORS, headers de seguridad, rate limit, logging, error handler
       │                  middleware de autenticación (verifica el token)
       ├──► Auth Service     /api/v1/auth/*
       ├──► User Service     /api/v1/users
       └──► Metrics Service  /api/v1/metrics   (compone User Service)
                     │
                     ▼
              [ Repositorios ] ──► [ Base de datos + seed ]
```

### 2.3 Contratos REST

| Método | Endpoint | Auth | Descripción | Respuestas |
|--------|----------|------|-------------|------------|
| GET | `/api/v1/health` | No | Estado del servicio | 200 |
| POST | `/api/v1/auth/login` | No | `{email, password}` → emite token (cookie) + datos básicos del usuario | 200, 400, 401, 429 |
| POST | `/api/v1/auth/refresh` | No (cookie de refresh) | Rota el refresh token y emite un access token nuevo | 200, 401 |
| POST | `/api/v1/auth/logout` | No (funciona con access vencido) | Revoca la sesión en BD y borra las cookies | 204 |
| GET | `/api/v1/auth/me` | Sí | Usuario actual; con esto se restaura la sesión tras un reload | 200, 401 |
| GET | `/api/v1/users?search=&page=1&pageSize=10&role=&status=` | Sí | Lista paginada y filtrada | 200, 400, 401 |
| GET | `/api/v1/metrics/summary` | Sí | `{totalUsers, activeUsers, admins, newThisMonth}` | 200, 401 |

**Formato de error uniforme:** `{ "error": { "code": "INVALID_CREDENTIALS", "message": "..." } }`
**Respuesta paginada:** `{ "data": [...], "meta": { "page", "pageSize", "total", "totalPages" } }`

### 2.4 Modelo de datos

`users`: `id`, `name`, `email` (único), `passwordHash`, `role` (`admin` | `editor` | `viewer`), `status` (`active` | `inactive`), `createdAt`.

Seed automático al arrancar o con un solo comando: 1 admin de prueba con credenciales documentadas en el README y ~50 usuarios generados, con hash real.

---

## 3. Cronograma (120 min)

| Bloque | Min | Entregable | Commit |
|--------|-----|------------|--------|
| **0:00-0:15 Setup** | 15 | Repo `devpanel-[nombre]`, estructura `backend/` + `frontend/`, `CLAUDE.md` con reglas del proyecto, `.gitignore`, `.env.example` | `chore: initial project setup` |
| **0:15-0:25 Datos** | 10 | Modelo `User`, conexión a BD, seed con hash | `feat(db): user model and seed` |
| **0:25-0:42 Auth Service** | 17 | Login con validación, hash, JWT en cookie HttpOnly, `/me`, `/logout`, middleware de auth, rate limit en login (RS-01 a RS-05) | `feat(auth): login, me, logout with secure cookie` |
| **0:42-0:55 User + Metrics + Gateway** | 13 | `/users` con búsqueda parametrizada, paginación y tope de `pageSize`; `/metrics/summary`; Helmet, CORS, error handler (RS-06 a RS-10) | `feat(users): paginated search` / `feat(metrics): summary` |
| **0:55-1:10 Front: login y sesión** | 15 | Pantalla de login, cliente HTTP con `credentials`, contexto de auth que llama a `/me` al cargar | `feat(web): login and persistent session` |
| **1:10-1:20 Front: protección** | 10 | Ruta protegida, interceptor 401 que lleva al login, logout | `feat(web): protected routes, 401 handling, logout` |
| **1:20-1:28 Front: dashboard** | 8 | 2-4 tarjetas de métricas, header con usuario logueado | `feat(web): dashboard metrics` |
| **1:28-1:42 Front: tabla** | 14 | Tabla de usuarios, búsqueda con debounce (300 ms) y cancelación de requests viejos, paginación | `feat(web): users table with debounced search` |
| **1:42-2:00 Cierre** | 18 | Prueba end-to-end manual de todos los P0, README, AI-LOG, verificación de "clonar y correr" | `docs: README and AI-LOG` |

**Checkpoint obligatorio a las 1:42:** si algún P0 falla, se corrige antes de documentar. Los P2 (filtros por rol o estado, pulido visual) solo entran si hay margen antes de 1:42.

### 3.1 Qué se recorta conscientemente (va en "Limitaciones" del README)

- Refresh tokens y revocación en servidor (un token corto + re-login es suficiente para el alcance).
- Servicios desplegados por separado o en contenedores (se justifica el monolito modular).
- CRUD de usuarios (no se pide; la tabla es de solo lectura).
- Suite de tests completa: como máximo 2-3 tests de integración de auth si sobra tiempo.
- CSRF token explícito: se mitiga con `SameSite=Strict` y se documenta.

---

## 4. Disciplina de trabajo con la IA (para el AI-LOG)

- Mantener `AI-LOG.md` abierto desde el minuto 0 y anotar cada prompt relevante en el momento, no al final.
- Revisar cada output contra la lista de seguridad (RS-xx); los rechazos típicos esperables (token en `localStorage`, error que revela si el email existe, `any` en tipos, búsqueda concatenada en SQL) son material para la sección "lo rechacé o modifiqué".
- Un commit por bloque del cronograma, para que el historial muestre avance progresivo.

---

## 5. Próximo paso

Definir el stack: lenguaje y framework del backend, ORM y BD, framework del frontend, librería de UI, y cómo se distribuye el arranque (un comando, Docker opcional).
