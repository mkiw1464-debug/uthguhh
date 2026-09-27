-- FFEX License System v4 — Fresh Install
-- Run this once in Supabase SQL Editor

-- ============================================================
-- TABLES
-- ============================================================

create table public.users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  role text not null check (role in ('admin','reseller')),
  credit_balance integer not null default 0,
  is_banned boolean not null default false,
  created_by_admin uuid,
  created_at timestamptz not null default now(),
  constraint users_credit_balance_nonneg check (credit_balance >= 0)
);

create table public.licenses (
  id uuid primary key default gen_random_uuid(),
  license_key text unique not null,
  license_type text not null default 'vip' check (license_type in ('global','vip')),
  product_tier text not null default 'lite' check (product_tier in ('lite','pro')),
  created_by uuid references public.users(id) on delete set null,
  duration_hours integer,
  duration_days integer,
  activated_at timestamptz,
  expires_at timestamptz,
  hwid text,
  status text not null default 'unused' check (status in ('unused','active','banned','expired')),
  created_at timestamptz not null default now()
);

create table public.device_logs (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.licenses(id) on delete cascade,
  hwid text not null,
  ip_address text,
  validated_at timestamptz not null default now()
);

-- Self-referencing FK added after table exists
alter table public.users
  add constraint users_created_by_admin_fk
  foreign key (created_by_admin) references public.users(id) on delete set null;

-- ============================================================
-- INDEXES
-- ============================================================

create index licenses_created_by_idx on public.licenses(created_by);
create index licenses_key_idx        on public.licenses(license_key);
create index licenses_status_idx     on public.licenses(status);
create index device_logs_license_idx on public.device_logs(license_id);
create index device_logs_hwid_idx    on public.device_logs(hwid);
create index users_role_idx          on public.users(role);

-- ============================================================
-- ROW LEVEL SECURITY (disabled — using service role key)
-- ============================================================

alter table public.users       disable row level security;
alter table public.licenses    disable row level security;
alter table public.device_logs disable row level security;

-- ============================================================
-- FUNCTIONS
-- ============================================================

create or replace function public.increment_reseller_credit(p_user_id uuid, p_amount integer)
returns integer language plpgsql security definer set search_path = public as $$
declare
  new_balance integer;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Credit amount must be positive';
  end if;
  update public.users
    set credit_balance = credit_balance + p_amount
    where id = p_user_id and role in ('reseller','admin')
    returning credit_balance into new_balance;
  if new_balance is null then
    raise exception 'User not found';
  end if;
  return new_balance;
end;
$$;

create or replace function public.decrement_reseller_credit(p_user_id uuid, p_amount integer)
returns integer language plpgsql security definer set search_path = public as $$
declare
  new_balance integer;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Credit amount must be positive';
  end if;
  update public.users
    set credit_balance = credit_balance - p_amount
    where id = p_user_id
      and role in ('reseller','admin')
      and credit_balance >= p_amount
    returning credit_balance into new_balance;
  if new_balance is null then
    if exists (select 1 from public.users where id = p_user_id) then
      raise exception 'Insufficient credit';
    end if;
    raise exception 'User not found';
  end if;
  return new_balance;
end;
$$;

grant execute on function public.increment_reseller_credit(uuid, integer) to service_role;
grant execute on function public.decrement_reseller_credit(uuid, integer) to service_role;
