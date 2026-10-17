-- Limpieza — compatible con la versión publicada.
--
-- Dos tipos que quedaron de una versión vieja del esquema: ninguna columna ni
-- función los usa (spaces.type y plants.stage son texto con su propio check),
-- y el de etapas ni siquiera tiene las mismas etapas que la app
-- ("Esqueje", "Vegetación"). Sólo confundían a quien leía la base.

drop type if exists public.grow_stage;
drop type if exists public.space_type;
