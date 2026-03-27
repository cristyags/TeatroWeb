create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  role text not null default 'CLIENTE',
  created_at timestamptz not null default now()
);

create table if not exists plays (
  id bigserial primary key,
  title text not null,
  description text,
  image_url text,
  duration_minutes int,
  rating text,
  created_at timestamptz not null default now()
);

create table if not exists performances (
  id bigserial primary key,
  play_id bigint not null references plays(id) on delete cascade,
  starts_at timestamptz not null,
  hall text default 'Sala Principal',
  status text not null default 'ACTIVE',
  capacity_total int not null default 200,
  capacity_available int not null default 200,
  created_at timestamptz not null default now()
);

create table if not exists price_tiers (
  id bigserial primary key,
  performance_id bigint not null references performances(id) on delete cascade,
  label text not null,
  price_cents int not null check (price_cents >= 0),
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  performance_id bigint not null references performances(id) on delete restrict,
  price_tier_id bigint not null references price_tiers(id) on delete restrict,
  quantity int not null check (quantity > 0),
  subtotal_cents int not null check (subtotal_cents >= 0),
  discount_cents int not null default 0 check (discount_cents >= 0),
  total_cents int not null check (total_cents >= 0),
  coupon_code text,
  created_at timestamptz not null default now()
);

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  performance_id bigint not null references performances(id) on delete restrict,
  code text not null unique,
  status text not null default 'ACTIVE',
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  coupon_code text not null,
  order_id uuid references orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists email_outbox (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  to_email text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create or replace view public.available_performances as
select
  p.id as performance_id,
  p.play_id,
  pl.title,
  pl.description,
  pl.image_url,
  pl.duration_minutes,
  pl.rating,
  p.starts_at,
  p.hall,
  p.status,
  p.capacity_total,
  p.capacity_available
from performances p
join plays pl on pl.id = p.play_id
where p.status = 'ACTIVE'
order by p.starts_at asc;

alter table profiles enable row level security;
alter table plays enable row level security;
alter table performances enable row level security;
alter table price_tiers enable row level security;
alter table orders enable row level security;
alter table tickets enable row level security;
alter table coupon_redemptions enable row level security;
alter table email_outbox enable row level security;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
as $$
  select exists(
    select 1 from profiles pr
    where pr.id = uid and pr.role = 'ADMIN'
  );
$$;

create policy "profiles read own"
on profiles for select
to authenticated
using (id = auth.uid());

create policy "profiles upsert own"
on profiles for insert
to authenticated
with check (id = auth.uid());

create policy "profiles update own"
on profiles for update
to authenticated
using (id = auth.uid());

create policy "plays read all"
on plays for select
to anon, authenticated
using (true);

create policy "performances read all"
on performances for select
to anon, authenticated
using (true);

create policy "price_tiers read all"
on price_tiers for select
to anon, authenticated
using (true);

create policy "admin manage plays"
on plays for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "admin manage performances"
on performances for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "admin manage price_tiers"
on price_tiers for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "orders insert own"
on orders for insert
to authenticated
with check (user_id = auth.uid());

create policy "orders read own"
on orders for select
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "tickets insert own"
on tickets for insert
to authenticated
with check (user_id = auth.uid());

create policy "tickets read own"
on tickets for select
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "tickets update admin"
on tickets for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "coupon redemption insert own"
on coupon_redemptions for insert
to authenticated
with check (user_id = auth.uid());

create policy "coupon redemption read own"
on coupon_redemptions for select
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "email outbox read own"
on email_outbox for select
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "email outbox insert any authenticated"
on email_outbox for insert
to authenticated
with check (true);

create policy "email outbox read admin"
on email_outbox for select
to authenticated
using (public.is_admin(auth.uid()));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''), 'CLIENTE')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();


create or replace function public.buy_tickets(
  p_performance_id bigint,
  p_price_tier_id bigint,
  p_quantity integer,
  p_coupon_code text default null
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_perf public.performances%rowtype;
  v_tier public.price_tiers%rowtype;
  v_subtotal int;
  v_discount int := 0;
  v_total int;
  v_coupon text := null;
  v_order_id uuid;
  v_codes text[] := '{}';
  i int;
  v_code text;
  v_email text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_perf
  from public.performances
  where id = p_performance_id and status = 'ACTIVE'
  for update;

  if not found then
    raise exception 'performance_not_found';
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception 'invalid_quantity';
  end if;

  if v_perf.capacity_available < p_quantity then
    raise exception 'not_enough_capacity';
  end if;

  select * into v_tier
  from public.price_tiers
  where id = p_price_tier_id and performance_id = p_performance_id;

  if not found then
    raise exception 'price_tier_not_found';
  end if;

  v_subtotal := v_tier.price_cents * p_quantity;

  if lower(coalesce(p_coupon_code,'')) = lower('CompraEsen') then
    if not exists (
      select 1
      from public.coupon_redemptions
      where user_id = v_uid and coupon_code = 'CompraEsen'
    ) then
      v_discount := floor(v_subtotal * 0.5);
      v_coupon := 'CompraEsen';
    end if;
  end if;

  v_total := greatest(0, v_subtotal - v_discount);

  insert into public.orders(
    user_id, performance_id, price_tier_id, quantity,
    subtotal_cents, discount_cents, total_cents, coupon_code
  ) values (
    v_uid, p_performance_id, p_price_tier_id, p_quantity,
    v_subtotal, v_discount, v_total, v_coupon
  )
  returning id into v_order_id;

  for i in 1..p_quantity loop
    v_code := 'TNS-' || p_performance_id::text || '-' ||
      substr(
        translate(
          encode(extensions.gen_random_bytes(6), 'base64'),
          '+/=', 'XYZ'
        ),
        1,
        8
      );

    insert into public.tickets(order_id, user_id, performance_id, code, status)
    values (v_order_id, v_uid, p_performance_id, v_code, 'ACTIVE');

    v_codes := array_append(v_codes, v_code);
  end loop;

  if v_coupon is not null then
    insert into public.coupon_redemptions(user_id, coupon_code, order_id)
    values (v_uid, v_coupon, v_order_id);
  end if;

  update public.performances
  set capacity_available = capacity_available - p_quantity
  where id = p_performance_id;

  select email into v_email from public.profiles where id = v_uid;
  if v_email is null then
    select email into v_email from auth.users where id = v_uid;
  end if;

  insert into public.email_outbox(user_id, to_email, subject, body)
  values (
    v_uid,
    coalesce(v_email,''),
    'Confirmación de compra - Teatro Nacional',
    'Tu compra fue realizada. Total final: $' || (v_total/100.0)::text
  );

  return json_build_object(
    'order_id', v_order_id,
    'subtotal_cents', v_subtotal,
    'discount_cents', v_discount,
    'total_cents', v_total,
    'coupon_applied', v_coupon,
    'ticket_codes', v_codes
  );
end;
$$;

grant execute on function public.buy_tickets(bigint, bigint, integer, text) to authenticated;
