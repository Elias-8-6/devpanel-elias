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

### 3.6 Frontend
- **Prompt:** "crea el frontend de la app, para los módulos correspondientes"
- **Resultado:** React por módulos (`auth`, `metrics`, `users`), un cliente HTTP con refresh único y reintento, rutas protegidas, dashboard con 4 tarjetas, tabla con búsqueda con debounce, filtros y paginación. Probado en Chrome: redirección sin sesión, error de credenciales, login, recarga con la sesión intacta, una sola petición por búsqueda, logout y JS sin acceso a los tokens (`document.cookie` vacío).
- **Qué hice con eso:** _pendiente_

### 3.7 Rate limiting y evaluación de seguridad
- **Prompt:** "quiero que implementes un límite a las peticiones por minuto, principalmente para el login, y que evalúes la seguridad y a qué ataques la app está propensa y crees un plan para hacer correcciones"
- **Resultado:** al reproducir el ataque, se vio que el límite que la propia IA había implementado antes (5/min por IP) era un **DoS**: detrás del proxy todos compartían una IP y 5 intentos de un atacante bloqueaban al admin. Se reemplazó por límites en capas (IP+cuenta, IP, cuenta) con la IP real y un único proxy de confianza, más `Retry-After`. `SECURITY.md` documenta 13 hallazgos con evidencia y un plan en 4 fases.
- **Qué hice con eso:** _pendiente_

### 3.8 Code review y correcciones
- **Prompt:** `/code-review` sobre todo el repo (relanzado apuntando a la carpeta del proyecto, porque la primera vez corrió en `C:\WINDOWS\System32` y no encontró nada). Después: "sí, opción a" (corregir los hallazgos, cada uno con su test).
- **Resultado:** 10 hallazgos. La IA verificó en vivo dos de ellos antes de aceptarlos: `page=1e20` → 500, y la falsificación de IP llamando directo a la API. Se corrigieron 9; el 10.º (cookies `Secure` en producción) quedó en la fase 2 de seguridad. Para el #8 la IA no cambió el código sino `CLAUDE.md`, porque el código era el correcto y la convención estaba mal.
- **Qué hice con eso:** _pendiente_

## 4. Output de la IA rechazado o modificado
- **Hallazgos del code review sobre código escrito por la IA:** varios eran errores de la propia IA que sus tests no veían:
  - la confianza en "1 salto" del proxy permitía falsificar la IP;
  - `@MaxLength(72)` contaba caracteres y no bytes, a pesar de que el comentario afirmaba lo contrario;
  - el logout fingía cerrar la sesión cuando fallaba, aunque las cookies seguían vigentes;
  - con dos pestañas, la sesión se cerraba cada 30 min.

  Cada corrección se acompañó de un test que falla sin ella. En el caso de las pestañas, el test reproduce primero el bug.
- **Rate limit del login (detectado al pedirle a la IA una evaluación de seguridad):** el `@Throttle` de 5/min por IP que la IA escribió en el módulo Auth parecía correcto y pasaba su propio test e2e, pero detrás del proxy de Vite todas las peticiones llegaban con la IP del contenedor del proxy. Resultado: un atacante bloqueaba el login de todos. El test no lo detectaba porque supertest no pasa por el proxy. Se rediseñó con IP real y límites por cuenta.
- **Contenedores sin root (fase 1 de seguridad):** el `USER node` "simple" rompió el backend en cadena, y cada error lo destapó el anterior:
  1. `EACCES` al borrar un `dist` creado por root en el bind mount;
  2. `EBUSY` al mover `dist` a un volumen, porque Nest intenta borrar el directorio;
  3. un build vacío (`Cannot find module dist/main`), causado por un `.tsbuildinfo` huérfano fuera de `dist`, que además era un bug latente del build en el host.

  Cada paso se diagnosticó con los logs antes de cambiar nada.
- **`bcrypt` → `bcryptjs`:** npm 11 bloqueó los scripts de instalación nativos de `bcrypt`, que además fallaría al compilar en Alpine. Se cambió por la versión JS pura.
- **Regex de acentos del seed:** el regex con el rango de diacríticos U+0300–U+036F (escrito con escapes `\u`) terminó guardado como caracteres combinantes invisibles. Funcionaba, pero no se podía leer ni revisar. Se reemplazó por `/\p{M}/gu`. El primer intento de corregirlo con `sed` perdió la barra invertida y rompió el build (el linter lo detectó).
- **`rows.map(UserResponseDto.fromEntity)`:** el linter lo marcó como método sin enlazar (`unbound-method`); se cambió por una arrow function.
- **`#` en `.env` (bug detectado por los tests e2e):** `SEED_ADMIN_PASSWORD=DevPanel#2026` sin comillas lo lee completo Docker Compose, pero dotenv lo corta en `DevPanel` porque trata `#` como comentario. Corriendo fuera de Docker, el admin habría quedado con otra contraseña. Se citó el valor y se verificó que ambos parsers lean lo mismo.
- **`setLoading(true)` dentro de un efecto:** el primer `useApiQuery` lo hacía y oxlint lo marcó (`set-state-in-effect`, renders en cascada). Se reescribió para derivar `loading` durante el render, comparando qué petición respondió el último resultado.
- **Spinner con clases en conflicto:** el botón de login le pasaba colores que chocaban con los fijos del componente. Se reemplazó por una prop `tone` explícita.
- **Comentario falso sobre el orden de los guards:** la IA escribió que el ThrottlerGuard "corre antes" que el guard JWT. Nest no garantiza ese orden entre `APP_GUARD` de módulos distintos, así que se eliminó la afirmación en lugar de dejar documentación incorrecta.
- _Pendiente: agregar los rechazos propios del desarrollador._

## 5. % de código IA vs propio
_Pendiente._

## 6. Lo que la IA hizo excelente / lo que hizo mal
_Pendiente._
