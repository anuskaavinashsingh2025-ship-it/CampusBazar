-- ===== Rental Lifecycle Extension =====
-- This migration extends the rental and notes rental systems with a complete lifecycle
-- Status flow: available → pending → accepted → active_rental → return_requested → completed

-- ===== EXTEND RENTAL STATUS ENUM =====
-- Add new statuses to rental_status enum
alter type public.rental_status add value if not exists 'active_rental';
alter type public.rental_status add value if not exists 'return_requested';

-- ===== EXTEND RENTAL REQUEST STATUS ENUM =====
-- Add new statuses to rental_request_status enum
alter type public.rental_request_status add value if not exists 'active_rental';
alter type public.rental_request_status add value if not exists 'return_requested';

-- ===== EXTEND NOTES STATUS ENUM =====
-- Add new statuses to notes_status enum for rental lifecycle
alter type public.notes_status add value if not exists 'active_rental';
alter type public.notes_status add value if not exists 'return_requested';

-- ===== CREATE NOTES PURCHASE REQUEST STATUS ENUM =====
-- Create a proper enum for notes purchase requests (currently using text)
create type public.notes_purchase_status as enum (
  'pending',
  'accepted',
  'rejected',
  'active_rental',
  'return_requested',
  'completed',
  'cancelled'
);

-- ===== CREATE NOTES_PURCHASE_REQUESTS TABLE =====
-- This table mirrors rental_requests for notes purchases/rentals
create table public.notes_purchase_requests (
  id uuid primary key default gen_random_uuid(),
  notes_listing_id uuid not null references public.notes_listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  status public.notes_purchase_status not null default 'pending',
  message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notes_listing_id, buyer_id)
);

create index if not exists notes_purchase_requests_status_created_at_idx
  on public.notes_purchase_requests (status, created_at desc);

alter table public.notes_purchase_requests enable row level security;

create policy "Buyer or seller can read related notes purchase requests"
  on public.notes_purchase_requests for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid());

create policy "Buyer can create notes purchase requests"
  on public.notes_purchase_requests for insert to authenticated
  with check (buyer_id = auth.uid());

create policy "Buyer or seller can update related notes purchase requests"
  on public.notes_purchase_requests for update to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid())
  with check (buyer_id = auth.uid() or seller_id = auth.uid());

grant select, insert, update on public.notes_purchase_requests to authenticated;
grant all on public.notes_purchase_requests to service_role;

create trigger notes_purchase_requests_set_updated_at
  before update on public.notes_purchase_requests
  for each row execute function public.set_updated_at();

-- ===== CREATE RENTAL_HISTORY TABLE =====
-- This table stores persistent history of all rental transactions
create table public.rental_history (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null,
  listing_type text not null check (listing_type in ('rental', 'notes')),
  owner_id uuid not null references auth.users(id) on delete cascade,
  renter_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid null,
  
  -- Timestamps for each lifecycle phase
  requested_at timestamptz not null default now(),
  accepted_at timestamptz null,
  rented_out_at timestamptz null,
  return_requested_at timestamptz null,
  completed_at timestamptz null,
  
  -- Rental metadata
  duration_days integer null check (duration_days >= 1),
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rental_history_listing_id_idx
  on public.rental_history (listing_id);
create index if not exists rental_history_owner_id_idx
  on public.rental_history (owner_id);
create index if not exists rental_history_renter_id_idx
  on public.rental_history (renter_id);
create index if not exists rental_history_listing_type_idx
  on public.rental_history (listing_type);
create index if not exists rental_history_completed_at_idx
  on public.rental_history (completed_at desc);

alter table public.rental_history enable row level security;

create policy "Owner or renter can read their rental history"
  on public.rental_history for select to authenticated
  using (owner_id = auth.uid() or renter_id = auth.uid());

grant select on public.rental_history to authenticated;
grant all on public.rental_history to service_role;

create trigger rental_history_set_updated_at
  before update on public.rental_history
  for each row execute function public.set_updated_at();

-- ===== UPDATE RENTAL LISTINGS RLS POLICY =====
-- Update policy to hide active_rental listings from marketplace
drop policy if exists "Guests can read available rental listings" on public.rental_listings;
create policy "Guests can read available rental listings"
  on public.rental_listings for select to anon
  using (status = 'available');

drop policy if exists "Users can read available or own rental listings" on public.rental_listings;
create policy "Users can read available or own rental listings"
  on public.rental_listings for select to authenticated
  using (status = 'available' or seller_id = auth.uid());

-- ===== UPDATE NOTES LISTINGS RLS POLICY =====
-- Update policy to hide active_rental listings from marketplace
drop policy if exists "Guests can read available notes listings" on public.notes_listings;
create policy "Guests can read available notes listings"
  on public.notes_listings for select to anon
  using (status = 'available');

drop policy if exists "Users can read available or own notes listings" on public.notes_listings;
create policy "Users can read available or own notes listings"
  on public.notes_listings for select to authenticated
  using (status = 'available' or seller_id = auth.uid());

-- ===== UPDATE RENTAL IMAGES RLS POLICY =====
-- Update policy to hide images for active_rental listings
drop policy if exists "Guests can read images for available rentals" on public.rental_images;
create policy "Guests can read images for available rentals"
  on public.rental_images for select to anon
  using (
    exists (
      select 1 from public.rental_listings rl
      where rl.id = rental_id
        and rl.status = 'available'
    )
  );

drop policy if exists "Users can read images for available or own rentals" on public.rental_images;
create policy "Users can read images for available or own rentals"
  on public.rental_images for select to authenticated
  using (
    exists (
      select 1 from public.rental_listings rl
      where rl.id = rental_id
        and (rl.status = 'available' or rl.seller_id = auth.uid())
    )
  );

-- ===== UPDATE NOTES ASSETS RLS POLICY =====
-- Update policy to hide assets for active_rental listings
drop policy if exists "Guests can read assets for available notes listings" on public.notes_assets;
create policy "Guests can read assets for available notes listings"
  on public.notes_assets for select to anon
  using (
    exists (
      select 1 from public.notes_listings nl
      where nl.id = listing_id
        and nl.status = 'available'
    )
  );

drop policy if exists "Users can read assets for available or own notes listings" on public.notes_assets;
create policy "Users can read assets for available or own notes listings"
  on public.notes_assets for select to authenticated
  using (
    exists (
      select 1 from public.notes_listings nl
      where nl.id = listing_id
        and (nl.status = 'available' or nl.seller_id = auth.uid())
    )
  );
