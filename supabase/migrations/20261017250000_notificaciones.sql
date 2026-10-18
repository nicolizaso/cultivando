-- Notificaciones push — compatible con la versión publicada (tabla nueva).

-- Un navegador o teléfono suscripto a los avisos. `endpoint` identifica la
-- suscripción; `p256dh` y `auth` son las claves con las que se cifra cada
-- aviso. `prefs` dice qué avisos quiere ese dispositivo.
create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and length(endpoint) <= 1000),
  p256dh text not null check (length(p256dh) <= 200),
  auth text not null check (length(auth) <= 100),
  user_agent text check (user_agent is null or length(user_agent) <= 300),
  prefs jsonb not null default '{"tasks": true, "overdue": true, "climate": true, "stock": true}'::jsonb,
  created_at timestamptz not null default now(),
  last_sent_on date,
  failures integer not null default 0
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions: las propias" on public.push_subscriptions;
create policy "push_subscriptions: las propias" on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- El envío diario lo hace el servidor con la clave de servicio (que no pasa
-- por la RLS); desde la app cada uno sólo ve y borra lo suyo.
