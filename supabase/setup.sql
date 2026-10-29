-- AMREL: создание таблиц и хранилища фото в Supabase.
-- Запуск: Supabase → SQL Editor → New query → вставить весь файл → Run. Повторный запуск безопасен.

create table if not exists public.categories (
  id text primary key,
  slug text unique not null,
  name text not null,
  sort integer not null default 0
);

create table if not exists public.products (
  id text primary key,
  slug text unique not null,
  name text not null,
  description text not null default '',
  details text not null default '',
  category_id text references public.categories(id) on delete set null,
  price integer,
  sale_price integer,
  featured boolean not null default false,
  is_new boolean not null default false,
  published boolean not null default true,
  sort integer not null default 0,
  variants jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  key text primary key,
  value jsonb not null
);

create table if not exists public.orders (
  id bigint generated always as identity primary key,
  number text unique not null,
  status text not null default 'new',
  customer jsonb not null,
  items jsonb not null,
  total integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sessions (
  token_hash text primary key,
  created_at bigint not null,
  expires_at bigint not null
);

create table if not exists public.login_attempts (
  ip text primary key,
  first bigint not null,
  count integer not null default 0
);

-- Защита: включаем Row Level Security БЕЗ разрешающих правил.
-- Значит, публичный ключ (anon) не может читать или менять ничего.
-- Доступ есть только у сервера сайта, который использует секретный ключ service_role.
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.settings enable row level security;
alter table public.orders enable row level security;
alter table public.sessions enable row level security;
alter table public.login_attempts enable row level security;

-- Хранилище фото товаров: публичное чтение по ссылке, загрузка только сервером.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('products', 'products', true, 15728640, array['image/webp', 'image/jpeg', 'image/png', 'image/avif'])
on conflict (id) do update set public = true;
