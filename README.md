# Planificador de Evaluaciones

Aplicación web para que profesores universitarios **planifiquen, apliquen y hagan seguimiento** de las evaluaciones de sus materias, con la ayuda de **EvaPlanner**, una asistente de inteligencia artificial integrada en la app.

Pensada para el contexto venezolano: notas de 0 a 20, feriados nacionales y hora de Caracas.

## Qué hace

| Módulo | Descripción |
|---|---|
| **Planificador** | Hasta 6 evaluaciones por sección (A, B, C…), con peso, fecha, estrategia, enfoque, grupos, descripción, rúbrica y recursos de estudio. Los pesos de cada sección deben sumar 100 %. |
| **EvaPlanner (IA)** | Chat en tiempo real que propone evaluaciones, crea rúbricas y exámenes, reprograma, ajusta pesos, carga notas y prepara mensajes. Cada acción aparece como una tarjeta que **el profesor confirma** antes de aplicarse. Acepta documentos (PDF, Word) y dictado por voz. |
| **Exámenes en línea** | El estudiante los presenta en su página, dentro de una ventana de tiempo y con cronómetro. Cada estudiante ve las preguntas y opciones en un **orden distinto**, y el profesor ve cuántas veces **salió de la página** durante el examen. Las preguntas de selección se corrigen solas; las abiertas las corrige la IA como **sugerencia** y el profesor publica la nota. |
| **Notas** | Escala 0–20, promedio ponderado, calificación con rúbrica, detección de estudiantes en riesgo, análisis por criterio y **acta de notas por sección para Excel**. |
| **Portal del estudiante** | Cada estudiante tiene un enlace secreto (`/e/<token>`) con su plan, recursos, rúbricas y notas. Puede marcar «ya me preparé», opinar sobre el plan y descargar el calendario (`.ics`) y el PDF. No necesita cuenta. |
| **Avisos** | Envío del plan, de las notas y de mensajes; recordatorios automáticos 3 días, 1 día y 2 horas antes de cada evaluación. Por **correo** (Gmail) o por WhatsApp; además, un botón abre el WhatsApp del profesor con el mensaje ya escrito (gratis). |
| **Administración** | Roles, supervisión del trabajo de los profesores, observaciones, registro de actividad, papelera de 30 días y configuración del sistema. |

## Roles

- **Profesor (USUARIO):** gestiona sus materias, secciones, estudiantes, notas y exámenes. Solo ve sus propios datos.
- **ADMIN:** ve el trabajo de todos los profesores, deja observaciones y gestiona cuentas de profesores.
- **SUPERADMIN:** control total: configuración del sistema, registro de actividad, recuperación de contraseñas y uso del agente.
- **Estudiante:** sin cuenta; entra por su enlace personal.

## Tecnologías

- **Next.js 16** (App Router) y **React 19**, con Tailwind CSS y framer-motion.
- **Prisma 6** sobre **PostgreSQL** (Supabase).
- Despliegue en **Vercel**.
- IA: **Google Gemini**, con respaldo automático en OpenRouter y Groq (Llama 3.3) si el modelo principal falla o no tiene cupo.
- Correo: **Gmail SMTP** con nodemailer. PDF: pdf-lib. Videos de estudio: YouTube Data API.

## Seguridad

- Contraseñas cifradas con **scrypt**; sesiones en cookie `httpOnly` firmada con **HMAC-SHA256**, renovación automática y tope de 24 h.
- Permisos por dueño de los datos (cada profesor solo ve lo suyo) y por rol.
- Registro solo con nombre, correo y contraseña; la cuenta se activa con un código de 6 dígitos que llega al correo (se guarda cifrado, con límite de intentos).
- Suma de verificación en el login y el registro, generada y validada en el servidor (cada suma sirve una sola vez y vence en 10 minutos).
- Enlaces de estudiante imposibles de adivinar; las respuestas correctas de los exámenes nunca se envían al navegador del estudiante (las preguntas solo cuando empieza el examen).
- Consentimiento para el tratamiento de datos personales al registrarse, y registro de actividad (auditoría).

## Cómo ejecutarlo en local

```bash
npm install
npx prisma db push      # crea las tablas en la base de datos
npm run dev             # http://localhost:3000
```

La primera vez, la pantalla de login pide crear la cuenta de **superadmin**.

Si el superadmin olvida su contraseña: `node scripts/restablecer-superadmin.mjs correo@ejemplo.com NuevaClave123`

## Variables de entorno

Se configuran en `.env` (local) o en Vercel → Settings → Environment Variables. **Nunca se suben al repositorio.**

| Variable | Obligatoria | Para qué |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión a Postgres (pooler de Supabase, puerto 6543, `?pgbouncer=true&connection_limit=1`) |
| `DIRECT_URL` | Sí | Conexión directa (puerto 5432), usada por `prisma db push` |
| `AUTH_SECRET` | Sí | Clave para firmar las sesiones (mínimo 16 caracteres) |
| `GEMINI_API_KEY` | Sí* | Chat de IA, lectura de PDF y búsqueda de recursos |
| `OPENROUTER_API_KEY`, `GROQ_API_KEY` | No | Modelos de respaldo; Groq también transcribe la voz |
| `YOUTUBE_API_KEY` | No | Videos de estudio sugeridos |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Recomendadas | Envío de avisos por **correo** (ver abajo) |
| `CORREO_NOMBRE` | No | Nombre del remitente (por defecto «Planificador de Evaluaciones») |
| `ULTRAMSG_INSTANCE`, `ULTRAMSG_TOKEN` | No | WhatsApp directo, solo si no hay correo configurado |
| `RECORDATORIOS_CLAVE` | Para recordatorios | Clave del cron que llama a `/api/recordatorios/ejecutar` cada 15 min (cron-job.org), en la cabecera `x-clave-app` (o `?clave=`) |
| `APP_URL` | No | URL pública de la app (para los enlaces de los mensajes) |
| `ZONA_HORARIA` | No | Por defecto `America/Caracas` |

\* Al menos una clave de IA (Gemini, OpenRouter o Groq) es necesaria para el chat.

### Configurar el correo (gratis, llega a la bandeja de entrada)

1. Crea (o usa) una cuenta de Gmail para la app, por ejemplo `planificador.evaluaciones@gmail.com`.
2. Activa la **verificación en 2 pasos** en esa cuenta.
3. Entra a <https://myaccount.google.com/apppasswords> y crea una **contraseña de aplicación** (16 letras).
4. En Vercel, agrega `GMAIL_USER` (el correo) y `GMAIL_APP_PASSWORD` (las 16 letras) y vuelve a desplegar.

Con esas dos variables, **todos los avisos salen por correo**: el código de verificación, la recuperación de contraseña, el plan, las notas y los recordatorios. Si el estudiante responde un correo, la respuesta le llega al profesor. Límite aproximado de Gmail: 500 correos al día. Sin esas variables, la app usa WhatsApp (UltraMsg o n8n).

## Estructura

```
app/
  page.tsx            aplicación principal del profesor (planificador, chat, paneles)
  login/              inicio de sesión, registro, verificación y recuperación
  e/[token]/          portal del estudiante
  api/                rutas del servidor (auth, chat, evaluaciones, estudiantes, portal, avisos…)
components/           examen del estudiante, editor de exámenes, tutorial
lib/
  agente/             prompt, herramientas, modelos de IA, consultas y análisis del agente
  correo.ts           envío de correos con Gmail
  whatsappLotes.ts    envíos en lote (correo o WhatsApp)
  permisos.ts, session.ts, authServer.ts   seguridad y roles
prisma/schema.prisma  modelo de datos
proxy.ts              protección de rutas y cabeceras de seguridad
```

## Limitaciones conocidas

- Los límites de intentos (login, códigos) y el registro de sumas ya usadas se guardan en memoria del servidor; en Vercel cada instancia lleva su propio registro.
- `app/page.tsx` concentra casi toda la interfaz del profesor en un solo archivo; está pendiente dividirlo en componentes.
- No hay pruebas automatizadas.
