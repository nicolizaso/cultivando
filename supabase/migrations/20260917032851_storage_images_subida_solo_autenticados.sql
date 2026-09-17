-- Extra · Storage, con el mismo criterio.
-- El bucket `images` tenía INSERT con `with check (bucket_id = 'images')` para el
-- rol `public`: cualquiera con la anon key, SIN login, podía subir archivos.
-- La app sólo sube desde server actions con sesión (app/cycles/actions.ts),
-- así que acotarlo a `authenticated` no cambia nada del flujo real.
--
-- El SELECT se deja como está a propósito: el bucket es público y la app guarda
-- y renderiza `public_url`. Cerrarlo exige pasar a signed URLs (cambio aparte).

drop policy if exists "Permitir subida publica 1ffg0oo_1" on storage.objects;

create policy "images: suben sólo usuarios con sesión"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'images');
