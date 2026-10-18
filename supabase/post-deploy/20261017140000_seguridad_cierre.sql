-- Etapa 1 · Seguridad — cierre. Aplicar DESPUÉS de publicar el código nuevo:
-- la versión vieja de la app resuelve el login por usuario con la clave
-- anónima y sube fotos a la raíz del bucket, y las dos cosas dejan de andar.

-- 1 · Usuario → email sólo desde el servidor. Abierta a `anon`, cualquiera con
-- la clave pública podía preguntar "¿qué email tiene el usuario X?". Ahora la
-- llama el login con la clave de servicio (SUPABASE_SERVICE_ROLE_KEY).
revoke execute on function public.email_for_username(text) from public, anon, authenticated;
grant execute on function public.email_for_username(text) to service_role;

-- 2 · Cada uno sube sólo en su carpeta (`<user_id>/…`). Antes cualquier
-- usuario con sesión podía subir cualquier archivo en cualquier ruta.
drop policy if exists "images: suben sólo usuarios con sesión" on storage.objects;
drop policy if exists "images: cada uno sube en su carpeta" on storage.objects;
create policy "images: cada uno sube en su carpeta"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
