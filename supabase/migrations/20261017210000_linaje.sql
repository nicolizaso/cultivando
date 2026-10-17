-- Linaje — compatible con la versión publicada (sólo agrega una columna con
-- valor por defecto: lo que hoy crea plantas sin mandarla sigue andando).

-- Marca de planta madre: la que se guarda para sacar esquejes. Hasta ahora
-- sólo se podía deducir mirando si alguna planta la tenía como madre.
alter table public.plants add column if not exists is_mother boolean not null default false;

-- Las que ya dieron esquejes, quedan marcadas.
update public.plants p
   set is_mother = true
 where not p.is_mother
   and exists (select 1 from public.plants c where c.mother_id = p.id);

-- Al registrar un esqueje (desde "Nueva planta" o al completar un
-- esquejado), su madre queda marcada. Sólo al crear: si después alguien la
-- desmarca a mano, editar el esqueje no la vuelve a marcar.
create or replace function public.mark_mother_on_clone()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.mother_id is not null then
    update public.plants set is_mother = true where id = new.mother_id and not is_mother;
  end if;
  return new;
end;
$$;

revoke execute on function public.mark_mother_on_clone() from public, anon, authenticated;

drop trigger if exists plants_mark_mother on public.plants;
create trigger plants_mark_mother
  after insert on public.plants
  for each row execute function public.mark_mother_on_clone();
