# AI-LOG

## 1. Herramientas de IA usadas
- Claude Code (Claude Opus 5.5), agente en terminal.

## 2. Stack y por qué
_Pendiente de justificar (React + NestJS + PostgreSQL + Docker)._

## 3. Prompts representativos

### 3.1 Análisis de requerimientos y plan
- **Prompt:** "levanta los requerimientos plasmados en el documento y genera un plan para desarrollarlo en un periodo de dos horas, usaremos una arquitectura rest y los principios de la Arquitectura SOA, además tendremos énfasis en la seguridad del sistema"
- **Resultado:** `PLAN.md` con los requerimientos (P0/P1/P2), 12 controles de seguridad, la decisión de aplicar SOA como monolito modular, los contratos REST y el cronograma.
- **Qué hice con eso:** _pendiente_

### 3.2 Bases tecnológicas
- **Prompt:** "crea las bases tecnológicas del proyecto, usaremos docker…, react, Nestjs y postgreSQL… usa el puerto por defecto para su interfaz gráfica según la documentación oficial de la imagen de postgres en docker hub"
- **Resultado:** scaffolds de Nest y Vite, docker-compose (db, adminer:8080, backend, frontend), validación de entorno y capa de seguridad base.
- **Qué hice con eso:** _pendiente_

### 3.3 Módulo de usuarios
- **Prompt:** "comencemos a trabajar en el modulo de user" (después de validar con la IA el modelo de datos: una sola entidad `users`, con rol y estado como enums).
- **Resultado:** entidad `User`, `UsersService` exportado como contrato SOA, `GET /api/v1/users` con búsqueda, filtros y paginación, y un seed idempotente.
- **Qué hice con eso:** _pendiente_

### 3.4 Módulo de autenticación
- **Prompt:** "sigue con el módulo auth, aquí ten presente que usaremos el access token con una duración de 30 minutos por seguridad y el refresh token lo guardado en la base de datos será vigente por 7 días"
- **Resultado:** JWT de 30 min y refresh opaco de 7 días en cookies HttpOnly; tabla `refresh_tokens` que guarda solo el hash SHA-256; rotación con detección de reuso; guard global con `@Public()`; filtro de errores uniforme; 6 tests e2e del flujo.
- **Qué hice con eso:** el refresh token persistido en BD fue decisión mía; el plan inicial de la IA lo había dejado fuera del alcance. _Completar._

### 3.5 Módulo de métricas
- **Prompt:** "sí, sigue con el módulo metrics"
- **Resultado:** `GET /api/v1/metrics/summary` (total, activos, admins, nuevos del mes en UTC). Compone `UsersService.countUsers()` sin acceder a la tabla. Test e2e que verifica que las métricas cuadran con los totales de `/users`.
- **Qué hice con eso:** _pendiente_

## 4. Output de la IA rechazado o modificado
- **`bcrypt` → `bcryptjs`:** npm 11 bloqueó los scripts de instalación nativos de `bcrypt`, que además fallaría al compilar en Alpine. Se cambió por la versión JS pura.
- **Regex de acentos del seed:** el regex con el rango de diacríticos U+0300–U+036F (escrito con escapes `\u`) terminó guardado como caracteres combinantes invisibles. Funcionaba, pero no se podía leer ni revisar. Se reemplazó por `/\p{M}/gu`. El primer intento de corregirlo con `sed` perdió la barra invertida y rompió el build (el linter lo detectó).
- **`rows.map(UserResponseDto.fromEntity)`:** el linter lo marcó como método sin enlazar (`unbound-method`); se cambió por una arrow function.
- **`#` en `.env` (bug detectado por los tests e2e):** `SEED_ADMIN_PASSWORD=DevPanel#2026` sin comillas lo lee completo Docker Compose, pero dotenv lo corta en `DevPanel` porque trata `#` como comentario. Corriendo fuera de Docker, el admin habría quedado con otra contraseña. Se citó el valor y se verificó que ambos parsers lean lo mismo.
- **Comentario falso sobre el orden de los guards:** la IA escribió que el ThrottlerGuard "corre antes" que el guard JWT. Nest no garantiza ese orden entre `APP_GUARD` de módulos distintos, así que se eliminó la afirmación en lugar de dejar documentación incorrecta.
- _Pendiente: agregar los rechazos propios del desarrollador._

## 5. % de código IA vs propio
_Pendiente._

## 6. Lo que la IA hizo excelente / lo que hizo mal
_Pendiente._
