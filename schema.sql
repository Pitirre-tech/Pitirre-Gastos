-- Run in the Neon SQL editor. Safe to re-run any time (also upgrades older versions).

create table if not exists expenses (
  id              serial primary key,
  spent_on        date not null,
  vendor          text not null,
  category        text not null,
  amount          numeric(10,2) not null,      -- negative = refund / return
  ivu             numeric(10,2) not null default 0,
  payment_method  text not null,
  client_project  text,
  notes           text,
  receipt_url     text,
  receipt_missing boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists expenses_spent_on_idx on expenses (spent_on);

create table if not exists expense_log (
  id         serial primary key,
  expense_id int,
  action     text not null,      -- created | edited | trashed | restored | purged
  detail     text,
  at         timestamptz not null default now()
);

-- Receipt reading
alter table expenses add column if not exists receipt_data jsonb;
create table if not exists expense_items (
  id          serial primary key,
  expense_id  int not null references expenses(id) on delete cascade,
  description text not null,
  qty         numeric(10,3),
  unit_price  numeric(10,2),
  total       numeric(10,2)
);
create index if not exists expense_items_expense_idx on expense_items (expense_id);

-- Permanent reference numbers, trash, business-use %, refunds
alter table expenses add column if not exists ref text;
alter table expenses add column if not exists deleted_at timestamptz;
alter table expenses add column if not exists business_pct int not null default 100;
alter table expenses drop constraint if exists expenses_amount_check;   -- old "amount > 0"
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'expenses_amount_nonzero') then
    alter table expenses add constraint expenses_amount_nonzero check (amount <> 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'expenses_business_pct_range') then
    alter table expenses add constraint expenses_business_pct_range check (business_pct between 1 and 100);
  end if;
end $$;
create unique index if not exists expenses_ref_idx on expenses (ref);

create table if not exists ref_counters (
  year int primary key,
  last int not null
);

-- Give any existing expenses a permanent number (only touches rows without one)
with numbered as (
  select e.id, extract(year from e.spent_on)::int as y,
         coalesce(c.last, 0) + row_number() over (partition by extract(year from e.spent_on) order by e.spent_on, e.id) as n
  from expenses e left join ref_counters c on c.year = extract(year from e.spent_on)::int
  where e.ref is null
)
update expenses e set ref = numbered.y || '-' || lpad(numbered.n::text, greatest(3, length(numbered.n::text)), '0')
from numbered where e.id = numbered.id;

insert into ref_counters (year, last)
select split_part(ref, '-', 1)::int, max(split_part(ref, '-', 2)::int) from expenses where ref is not null group by 1
on conflict (year) do update set last = greatest(ref_counters.last, excluded.last);

-- Login lockout
create table if not exists login_failures (
  id serial primary key,
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists login_failures_at_idx on login_failures (at);
