-- Ludo Arena online rooms. Run once in Supabase SQL Editor.
create table if not exists public.ludo_rooms (
  code text primary key check (code ~ '^[A-Z2-9]{6}$'),
  host_id uuid not null,
  players jsonb not null default '[]'::jsonb,
  state jsonb not null default '{}'::jsonb,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ludo_rooms enable row level security;
revoke all on public.ludo_rooms from anon, authenticated;
drop policy if exists ludo_member_read on public.ludo_rooms;
create policy ludo_member_read on public.ludo_rooms for select to authenticated
using (exists (select 1 from jsonb_array_elements(players) p where p->>'id' = auth.uid()::text) or host_id = auth.uid());
grant select on public.ludo_rooms to authenticated;

create or replace function public.ludo_create_room()
returns setof public.ludo_rooms language plpgsql security definer set search_path = public, pg_temp as $$
declare c text; newrow public.ludo_rooms;
begin
 if auth.uid() is null then raise exception 'not_signed_in'; end if;
 for i in 1..10 loop
   c := upper(substr(encode(gen_random_bytes(8),'hex'),1,6));
   begin
     insert into public.ludo_rooms(code,host_id,players,state)
     values(c,auth.uid(),'[]'::jsonb,jsonb_build_object('turn',0,'die',0,'rolled',false,'tokens',jsonb_build_array(
       jsonb_build_array(-1,-1,-1,-1),jsonb_build_array(-1,-1,-1,-1),
       jsonb_build_array(-1,-1,-1,-1),jsonb_build_array(-1,-1,-1,-1)
     ),'winner',null))
     returning * into newrow;
     return next newrow; return;
   exception when unique_violation then null;
   end;
 end loop;
 raise exception 'code_generation_failed';
end $$;

create or replace function public.ludo_join_room(p_code text)
returns setof public.ludo_rooms language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.ludo_rooms; seat int; arr jsonb;
begin
 if auth.uid() is null then raise exception 'not_signed_in'; end if;
 select * into r from public.ludo_rooms where code=upper(p_code) for update;
 if not found then raise exception 'room_not_found'; end if;
 if r.host_id=auth.uid() or exists(select 1 from jsonb_array_elements(r.players) p where p->>'id'=auth.uid()::text) then return next r; return; end if;
 if jsonb_array_length(r.players)>=3 then raise exception 'room_full'; end if;
 seat:=jsonb_array_length(r.players)+1;
 arr:=r.players || jsonb_build_array(jsonb_build_object('id',auth.uid(),'seat',seat,'name','Player '|| (seat+1)));
 update public.ludo_rooms set players=arr,version=version+1,updated_at=now() where code=r.code returning * into r;
 return next r;
end $$;

create or replace function public.ludo_save_state(p_code text,p_state jsonb)
returns setof public.ludo_rooms language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.ludo_rooms;
begin
 if auth.uid() is null then raise exception 'not_signed_in'; end if;
 select * into r from public.ludo_rooms where code=upper(p_code) for update;
 if not found then raise exception 'room_not_found'; end if;
 if not (r.host_id=auth.uid() or exists(select 1 from jsonb_array_elements(r.players) p where p->>'id'=auth.uid()::text)) then raise exception 'not_room_member'; end if;
 if jsonb_typeof(p_state)<>'object' or length(p_state::text)>12000 then raise exception 'invalid_state'; end if;
 update public.ludo_rooms set state=p_state,version=version+1,updated_at=now() where code=r.code returning * into r;
 return next r;
end $$;

create or replace function public.ludo_leave_room(p_code text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.ludo_rooms;
begin
 select * into r from public.ludo_rooms where code=upper(p_code) for update;
 if not found then return; end if;
 if r.host_id=auth.uid() then delete from public.ludo_rooms where code=r.code;
 else update public.ludo_rooms set players=(select coalesce(jsonb_agg(p order by (p->>'seat')::int),'[]'::jsonb) from jsonb_array_elements(r.players) p where p->>'id'<>auth.uid()::text),version=version+1,updated_at=now() where code=r.code; end if;
end $$;

grant execute on function public.ludo_create_room() to authenticated;
grant execute on function public.ludo_join_room(text) to authenticated;
grant execute on function public.ludo_save_state(text,jsonb) to authenticated;
grant execute on function public.ludo_leave_room(text) to authenticated;
do $$ begin
 alter publication supabase_realtime add table public.ludo_rooms;
exception when duplicate_object then null;
end $$;
