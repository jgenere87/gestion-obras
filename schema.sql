-- ═══════════════════════════════════════════════════════════
-- GESTIÓN DE OBRAS — Esquema Supabase
-- Ejecutar en: Supabase → SQL Editor → New query → pegar → Run
-- ═══════════════════════════════════════════════════════════

-- 1. Perfiles de usuario (roles)
create table public.perfiles (
  correo text primary key,
  nombre text not null,
  rol text not null default 'Ingeniero'
    check (rol in ('Admin','Supervisor','Ingeniero'))
);

-- 2. Reportes diarios
create table public.reportes (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  proyecto_id int not null,
  proyecto text not null,
  componente text,
  paquete text,
  actividad_id text not null,
  actividad text not null,
  unidad text,
  cantidad numeric not null check (cantidad >= 0),
  contratista text,
  frente text,
  comentario text,
  foto_url text,
  usuario text not null,
  estado text not null default 'Borrador'
    check (estado in ('Borrador','Enviado','Validado','Rechazado')),
  creado timestamptz not null default now()
);

create index reportes_usuario_idx on public.reportes (usuario);
create index reportes_estado_idx  on public.reportes (estado);
create index reportes_fecha_idx   on public.reportes (fecha desc);

-- 3. Función helper: rol del usuario autenticado
create or replace function public.mi_rol()
returns text language sql stable security definer as $$
  select rol from public.perfiles where correo = auth.jwt()->>'email'
$$;

-- 4. Seguridad por fila (RLS) — equivalente a los Security Filters de AppSheet
alter table public.perfiles enable row level security;
alter table public.reportes enable row level security;

create policy "perfiles: lectura autenticados"
  on public.perfiles for select to authenticated using (true);

create policy "reportes: ver propios o rol elevado"
  on public.reportes for select to authenticated
  using (usuario = auth.jwt()->>'email' or public.mi_rol() in ('Admin','Supervisor'));

create policy "reportes: crear solo propios"
  on public.reportes for insert to authenticated
  with check (usuario = auth.jwt()->>'email');

create policy "reportes: editar propios o validar (Supervisor/Admin)"
  on public.reportes for update to authenticated
  using (usuario = auth.jwt()->>'email' or public.mi_rol() in ('Admin','Supervisor'));

create policy "reportes: eliminar solo Admin"
  on public.reportes for delete to authenticated
  using (public.mi_rol() = 'Admin');

-- 5. Tus 5 usuarios (los correos deben coincidir con Auth → Users)
insert into public.perfiles (correo, nombre, rol) values
  ('jramos@capcana.com',                'J. Ramos',    'Admin'),
  ('juanalbertoramos2009@hotmail.com',  'J. Genere',   'Ingeniero'),
  ('p.mercedes@capcana.com',            'P. Mercedes', 'Ingeniero'),
  ('s.guerrero@capcana.com',            'S. Guerrero', 'Supervisor'),
  ('p.urraca@capcana.com',              'P. Urraca',   'Ingeniero');

-- 6. Bucket de fotos (público para lectura)
insert into storage.buckets (id, name, public) values ('fotos','fotos', true);

create policy "fotos: subir autenticados"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos');

create policy "fotos: lectura pública"
  on storage.objects for select using (bucket_id = 'fotos');
