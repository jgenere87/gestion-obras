# Gestión de Obras — Cap Cana

App real con login, base de datos y fotos. Gratis para tu equipo de 5 usuarios.

---

## Qué incluye

- Login con correo y contraseña (Supabase Auth)
- Base de datos real (Postgres) con seguridad por rol — igual a lo que armamos en AppSheet
- Subida de fotos desde el celular
- Los mismos 57 proyectos, 41 partidas, 171 actividades y 52 contratistas ya cargados
- Roles: Admin (jramos), Supervisor (s.guerrero), Ingeniero (los demás)

---

## PASO 1 — Crear cuenta en Supabase (gratis)

1. Ve a **[supabase.com](https://supabase.com)** → **Start your project** → crea cuenta con Google o correo
2. Clic en **New project**
3. Nombre: `gestion-obras` · elige una contraseña de base de datos (guárdala) · región: la más cercana a República Dominicana (US East)
4. Espera ~2 minutos mientras se crea

---

## PASO 2 — Crear las tablas

1. En el panel izquierdo de Supabase → **SQL Editor** → **New query**
2. Abre el archivo `supabase/schema.sql` de esta carpeta, copia **todo** el contenido
3. Pégalo en el editor → clic en **Run**
4. Deberías ver "Success. No rows returned"

Esto crea las tablas `perfiles` y `reportes`, la seguridad por rol, y carga tus 5 usuarios.

---

## PASO 3 — Crear las cuentas de acceso (Auth)

Supabase separa "quién puede entrar" (Auth) de "qué rol tiene" (la tabla perfiles que ya llenamos).

1. Panel izquierdo → **Authentication** → **Users** → **Add user** → **Create new user**
2. Crea una cuenta para cada uno de tus 5 usuarios:

| Correo | Contraseña temporal |
|---|---|
| jramos@capcana.com | (elige una) |
| juanalbertoramos2009@hotmail.com | (elige una) |
| p.mercedes@capcana.com | (elige una) |
| s.guerrero@capcana.com | (elige una) |
| p.urraca@capcana.com | (elige una) |

3. Marca **Auto Confirm User** en cada uno (para que no necesiten confirmar por correo)
4. Comparte la contraseña con cada persona por un canal seguro — pueden cambiarla después

---

## PASO 4 — Obtener las llaves de conexión

1. Panel izquierdo → **Project Settings** (ícono de engranaje) → **API**
2. Copia:
   - **Project URL** (algo como `https://abcxyz.supabase.co`)
   - **anon public** key (una cadena larga)

---

## PASO 5 — Conectar el código a tu Supabase

1. En esta carpeta, copia `.env.example` y renómbralo a `.env`
2. Pega tus valores:

```
VITE_SUPABASE_URL=https://abcxyz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...tu-llave-larga
```

---

## PASO 6 — Probar localmente (opcional, requiere Node.js instalado)

```bash
npm install
npm run dev
```

Abre `http://localhost:5173` — deberías ver la pantalla de login.

---

## PASO 7 — Publicar en Vercel (gratis, para que todos accedan por internet)

1. Sube esta carpeta a GitHub:
   - Crea un repositorio nuevo en [github.com](https://github.com)
   - Sube todos estos archivos (arrastra la carpeta o usa `git push`)
2. Ve a **[vercel.com](https://vercel.com)** → **Add New Project** → conecta tu cuenta de GitHub → selecciona el repositorio
3. En **Environment Variables**, agrega las mismas dos variables del PASO 5:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Clic en **Deploy**
5. En 1-2 minutos tendrás una URL como `gestion-obras.vercel.app` — esa es la que comparten tus 5 usuarios

---

## Cómo usan la app tus usuarios

1. Abren la URL desde el celular o computadora
2. Entran con su correo y la contraseña que les diste
3. Crean reportes diarios con foto desde el celular
4. El Supervisor o Admin valida/rechaza desde "Reportes"

---

## Próximos pasos posibles

- Agregar más tablas (Contratos, Cubicaciones, Pagos) — mismo patrón que `reportes`
- Notificaciones por correo cuando se valida un reporte (Supabase Edge Functions)
- Exportar a Excel o PDF
- Conectar a Power BI (Supabase expone una API que Power BI puede consumir directo)

Si quieres cualquiera de estos, solo pide que lo agreguemos.
