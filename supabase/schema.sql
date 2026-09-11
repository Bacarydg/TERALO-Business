-- TERAL'O BUSINESS — schéma PostgreSQL/Supabase
create extension if not exists pgcrypto;

create table if not exists public.merchants (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null default 'Mon entreprise',
  slug text unique,
  full_name text,
  phone text,
  city text default 'Dakar',
  address text,
  description text,
  logo_url text,
  cover_url text,
  ninea text,
  rccm text,
  sector text default 'Commerce',
  plan text default 'Basic' check (plan in ('Basic','Standard','Premium')),
  currency text default 'FCFA',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name text not null,
  sku text,
  category text,
  description text,
  sale_price numeric(14,2) not null default 0,
  purchase_price numeric(14,2) not null default 0,
  stock numeric(14,2) not null default 0,
  alert_threshold numeric(14,2) not null default 2,
  unit text default 'unité',
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  invoice_number text not null,
  total numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  payment_method text not null default 'Espèces',
  status text not null default 'paid',
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity numeric(14,2) not null default 1,
  unit_price numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0
);

create table if not exists public.cash_entries (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  type text not null check (type in ('income','expense')),
  category text,
  label text not null,
  amount numeric(14,2) not null default 0,
  payment_method text default 'Espèces',
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  quote_number text not null,
  status text not null default 'draft',
  total numeric(14,2) not null default 0,
  valid_until date,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity numeric(14,2) not null default 1,
  unit_price numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0
);

create index if not exists products_merchant_idx on public.products(merchant_id);
create index if not exists sales_merchant_date_idx on public.sales(merchant_id, created_at desc);
create index if not exists customers_merchant_idx on public.customers(merchant_id);
create index if not exists cash_merchant_date_idx on public.cash_entries(merchant_id, created_at desc);

alter table public.merchants enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.cash_entries enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;

drop policy if exists merchants_self on public.merchants;
create policy merchants_self on public.merchants for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists products_self on public.products;
create policy products_self on public.products for all using (merchant_id = auth.uid()) with check (merchant_id = auth.uid());

drop policy if exists customers_self on public.customers;
create policy customers_self on public.customers for all using (merchant_id = auth.uid()) with check (merchant_id = auth.uid());

drop policy if exists sales_self on public.sales;
create policy sales_self on public.sales for all using (merchant_id = auth.uid()) with check (merchant_id = auth.uid());

drop policy if exists sale_items_self on public.sale_items;
create policy sale_items_self on public.sale_items for all
using (exists (select 1 from public.sales s where s.id = sale_items.sale_id and s.merchant_id = auth.uid()))
with check (exists (select 1 from public.sales s where s.id = sale_items.sale_id and s.merchant_id = auth.uid()));

drop policy if exists cash_self on public.cash_entries;
create policy cash_self on public.cash_entries for all using (merchant_id = auth.uid()) with check (merchant_id = auth.uid());

drop policy if exists quotes_self on public.quotes;
create policy quotes_self on public.quotes for all using (merchant_id = auth.uid()) with check (merchant_id = auth.uid());

drop policy if exists quote_items_self on public.quote_items;
create policy quote_items_self on public.quote_items for all
using (exists (select 1 from public.quotes q where q.id = quote_items.quote_id and q.merchant_id = auth.uid()))
with check (exists (select 1 from public.quotes q where q.id = quote_items.quote_id and q.merchant_id = auth.uid()));

-- Storage bucket (à exécuter si votre projet autorise la création via SQL)
insert into storage.buckets (id, name, public)
values ('business-assets', 'business-assets', true)
on conflict (id) do nothing;

drop policy if exists assets_public_read on storage.objects;
create policy assets_public_read on storage.objects for select using (bucket_id = 'business-assets');

drop policy if exists assets_owner_insert on storage.objects;
create policy assets_owner_insert on storage.objects for insert
with check (bucket_id = 'business-assets' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists assets_owner_update on storage.objects;
create policy assets_owner_update on storage.objects for update
using (bucket_id = 'business-assets' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'business-assets' and auth.uid()::text = (storage.foldername(name))[1]);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.merchants(id, full_name, business_name, sector, plan)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(nullif(new.raw_user_meta_data->>'business_name',''),'Mon entreprise'),
    case
      when new.raw_user_meta_data->>'sector' in ('Électronique & High-Tech','Artisanat & Menuiserie','Restauration','Immobilier','Aluminium','Soins & Beauté')
        then new.raw_user_meta_data->>'sector'
      else 'Commerce'
    end,
    case
      when new.raw_user_meta_data->>'plan' in ('Basic','Standard','Premium')
        then new.raw_user_meta_data->>'plan'
      else 'Basic'
    end
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    business_name = excluded.business_name,
    sector = excluded.sector,
    plan = excluded.plan,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
