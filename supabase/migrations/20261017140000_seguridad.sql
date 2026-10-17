-- Etapa 1 · Seguridad — parte compatible con la versión publicada de la app.
-- Se puede aplicar antes de publicar el código nuevo: nada de lo que usa hoy
-- la app deja de funcionar. Lo que sí rompería la versión vieja (cerrar el
-- login por usuario, exigir carpeta por usuario) está en
-- supabase/post-deploy/20261017140000_seguridad_cierre.sql.

-- 1 · handle_new_user sólo tiene sentido como trigger de auth.users: nadie
-- debería poder llamarla por /rest/v1/rpc. El trigger sigue funcionando, porque
-- el permiso EXECUTE se mira al crear el trigger, no cada vez que se dispara.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 2 · search_path fijo en las funciones de edad y días en etapa (aviso del
-- linter de Supabase). No referencian otras tablas, así que '' alcanza.
alter function public.current_age_days(public.plants) set search_path = '';
alter function public.days_in_stage(public.plants) set search_path = '';

-- 3 · Nombre de usuario único sin distinguir mayúsculas. El login por usuario
-- devolvía el primer email que coincidía; con dos "Nico" uno nunca podía
-- entrar. Hoy no hay repetidos, así que el índice se crea sin conflictos.
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username))
  where username is not null;

-- 4 · Bucket de fotos: hasta 5 MB y sólo imágenes. La app ya comprime a ~1 MB
-- y valida antes de subir; esto frena lo que llegue por fuera de la app.
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp', 'image/gif',
         'image/heic', 'image/heif', 'image/avif'
       ]
 where id = 'images';

-- 5 · Cada uno ve y borra sus propios archivos. Storage necesita SELECT además
-- de DELETE para borrar: sin estas dos, "Eliminar fotos" borraba la fila pero
-- el archivo quedaba público para siempre (hoy hay 11 así).
drop policy if exists "images: cada uno ve lo suyo" on storage.objects;
create policy "images: cada uno ve lo suyo"
  on storage.objects for select to authenticated
  using (bucket_id = 'images' and owner_id = (select auth.uid())::text);

drop policy if exists "images: cada uno borra lo suyo" on storage.objects;
create policy "images: cada uno borra lo suyo"
  on storage.objects for delete to authenticated
  using (bucket_id = 'images' and owner_id = (select auth.uid())::text);

-- 6 · Sin listado público. El bucket es público, así que las fotos se siguen
-- viendo por su URL; lo que se cierra es poder listar todos los archivos de
-- todos los usuarios con la clave anónima.
drop policy if exists "Permitir subida publica 1ffg0oo_0" on storage.objects;

-- 7 · Reglas de un bucket `plant-photos` que ya no existe.
drop policy if exists "Allow authenticated deletes in cycles folder" on storage.objects;
drop policy if exists "Allow authenticated updates to cycles folder" on storage.objects;
drop policy if exists "Allow authenticated uploads to cycles folder" on storage.objects;
drop policy if exists "Allow public viewing of cycles folder" on storage.objects;
