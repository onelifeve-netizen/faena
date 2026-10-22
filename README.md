# Faena — GMAO/CMMS + seguimiento de obras para PyMEs

App interna de gestión de mantenimiento (GMAO/CMMS) y seguimiento de obras, pensada para una
PyME de LATAM: inventario de maquinaria, órdenes de trabajo, mantenimiento preventivo
programado, obras con presupuesto/WIP, biblioteca de contactos, acceso por rol y auditoría
exportable.

Hecha con **Next.js** (frontend estático, se aloja gratis en GitHub Pages) + **Supabase** (base
de datos Postgres, autenticación, y las dos Edge Functions que necesita el backend).

## 1. Crear la base de datos (Supabase — 5 minutos)

1. Entrá a https://supabase.com y creá una cuenta gratis.
2. Creá un proyecto nuevo (elegí una región cercana, por ejemplo São Paulo).
3. En **SQL Editor → New query**, corré en orden (una query por archivo, esperando a que cada una
   diga "Success" antes de pasar a la siguiente):
   1. `supabase/schema.sql`
   2. `supabase/migration_006_faena.sql` (roles, órdenes de trabajo, mantenimiento preventivo, facturación/WIP)
   3. `supabase/migration_008_perfil_contactos_depreciacion.sql` (perfil con foto, contactos completos, depreciación de maquinaria)
   4. `supabase/migration_007_cron_pg.sql` (opcional, recordatorios diarios — editá antes la URL/key como indica el propio archivo)

   Los archivos `migration_002_ficha_obra.sql` a `migration_005_auditoria.sql` son de una fase
   vieja del proyecto y ya están incluidos en `schema.sql` — **no los corras** si estás creando un
   proyecto nuevo. Solo sirven para actualizar una base que ya existía antes de que existiera
   `schema.sql`.
4. En **Project Settings → API** copiá la **Project URL** y la **anon public key**.

## 2. Configurar el proyecto localmente

```bash
npm install
cp .env.local.example .env.local
```

Pegá en `.env.local` la URL y la key que copiaste de Supabase, y probá con:

```bash
npm run dev
```

Abrís `http://localhost:3000`.

## 3. Publicarlo en GitHub Pages (gratis, sin Vercel)

1. Subí este repo a GitHub.
2. En **Settings → Pages** del repo, elegí "GitHub Actions" como fuente (no "branch").
3. En **Settings → Secrets and variables → Actions**, agregá dos secrets:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Hacé push a `main`. El workflow `.github/workflows/deploy.yml` construye el sitio como export
   estático y lo publica solo. Queda en `https://TU_USUARIO.github.io/NOMBRE_DEL_REPO/`.

No hace falta Vercel ni ningún otro servicio de hosting — todo el sitio es estático y GitHub lo
sirve directamente.

## 4. El asistente de IA y los recordatorios (Supabase Edge Functions)

Como el sitio es estático, la lógica que necesita un secret del lado del servidor (mandar mails,
llamar a la API de Claude) vive en Supabase, no en GitHub:

```bash
npm install -g supabase
supabase login
supabase link --project-ref tu-proyecto
supabase functions deploy recordatorios
supabase functions deploy ai-diagnostico
supabase secrets set RESEND_API_KEY=tu-api-key-de-resend
supabase secrets set ANTHROPIC_API_KEY=sk-ant-tu-key
```

- `recordatorios`: revisa obras con plazo vencido o a menos de 3 días y manda un mail resumen.
  Se programa sola con `migration_007_cron_pg.sql` (pg_cron, corre todos los días a las 12:00 UTC).
- `ai-diagnostico`: la usa el botón "Diagnosticar" en la ficha de cada equipo (`/inventario/detalle`):
  le manda a Claude el historial real de órdenes de trabajo de esa máquina + la falla reportada,
  y sugiere una causa probable y si conviene adelantar el próximo preventivo.

Mientras no completes estos pasos, la app funciona igual — simplemente esas dos funciones no
responden (recordatorios no manda mail, y el asistente de IA avisa que no está desplegado).

## 5. Acceso del equipo (registro + aprobación + roles)

- Cada persona crea su cuenta desde `/registro`. Queda **pendiente de aprobación** — no entra al
  panel todavía.
- La primera cuenta que se crea en una base nueva queda admin y aprobada automáticamente (para
  que alguien pueda entrar a aprobar al resto).
- Un admin aprueba a cada trabajador y le asigna un rol desde **Usuarios** en el menú:
  - **Admin**: todo, incluida la gestión de usuarios.
  - **Técnico**: puede crear/editar inventario, obras, órdenes de trabajo, gastos, pagos, facturas.
  - **Lectura**: solo puede ver, no puede crear ni editar nada.

Para que no tengan que confirmar el mail antes de poder registrarse (más simple para uso
interno): en Supabase, **Authentication → Providers → Email**, desactivá "Confirm email".

## 6. Uso diario

- **Inventario**: maquinaria/herramientas/materiales, con estado (disponible / en obra /
  mantenimiento). Cada equipo tiene su ficha (`/inventario/detalle`) con historial de órdenes de
  trabajo, mantenimiento programado y el asistente de IA.
- **Órdenes de trabajo**: correctivas, preventivas, de inspección o emergencia, con prioridad y
  tablero por estado (pendiente / en curso / cerrada).
- **Mantenimiento**: reglas de "cada X días" por equipo; el panel marca qué está vencido o
  próximo a vencer.
- **Obras**: presupuesto, gastos, pagos cobrados, facturación emitida, y el cálculo de **WIP**
  (devengado vs. facturado vs. cobrado, y si la obra va en ganancia o pérdida) en la ficha de cada
  obra y resumido en el panel general.
- **Contactos**: biblioteca central de clientes/colaboradores, reusable al crear obras.
- **Auditoría**: todo cambio importante queda registrado con quién y cuándo, con exportación a
  CSV por rango de fechas (lista para mostrar en una auditoría interna o de un cliente).

## Notas

- El plan gratis de Supabase alcanza cómodamente (hasta 500MB de base, 50.000 usuarios
  activos/mes, pg_cron y Edge Functions incluidos).
- El WIP usa el método "costo-a-costo" (porcentaje de avance = costo incurrido / presupuesto),
  el más simple de explicar y de mantener para una PyME sin un área de costos dedicada.
- Si tu base ya tenía datos de una fase anterior (desde "Control de Obra"), corré
  `migration_006_faena.sql` sobre esa misma base — no hace falta recrear nada, solo agrega tablas
  y políticas nuevas sobre las existentes.
