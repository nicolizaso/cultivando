# Lo que te toca hacer a vos

Todo lo que no puedo hacer desde el código, en el orden en que conviene
hacerlo. Lo voy completando a medida que avanzan las etapas.

> Si preferís, cualquiera de los pasos de base de datos (migraciones, tipos)
> lo puedo hacer yo: pedímelo y lo aplico.

---

## 1 · Antes de probar el preview

### 1.1 · Variables de entorno en Vercel
Proyecto → Settings → Environment Variables. Cargalas para **Production** y
**Preview**.

| Variable | De dónde sale | Para qué |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → `service_role` (secreta) | Login con nombre de usuario. Sin ella, se entra sólo con email. |

Nunca la cargues con prefijo `NEXT_PUBLIC_`: saltea la seguridad de la base.

### 1.2 · Migraciones compatibles (`supabase/migrations/`)
Se pueden aplicar con la versión actual publicada: no rompen nada de lo que
hoy está en producción. Aplicalas en este orden, desde el SQL Editor de
Supabase (pegar el archivo entero y ejecutar) o con `supabase db push`:

1. `20261017140000_seguridad.sql`

---

## 2 · Probar

Checklist para el preview del PR, una vez hechos los pasos de arriba:

- [ ] Entrar con email y contraseña.
- [ ] Entrar con nombre de usuario.
- [ ] Registrar una cuenta nueva: pide 8 caracteres y avisa si el usuario ya existe.
- [ ] Subir una foto a la bitácora de una planta.
- [ ] Subir una foto a la galería de un ciclo y después borrarla.
- [ ] Editar la ficha técnica de un espacio.

---

## 3 · Después de publicar (merge a `main`)

### 3.1 · Migraciones de cierre (`supabase/post-deploy/`)
Cierran cosas que la versión vieja todavía usaba, por eso van **después** de
que el código nuevo esté en producción. Mismo método que en 1.2, en orden:

1. `20261017140000_seguridad_cierre.sql`

Después de aplicarlas, se pueden mover a `supabase/migrations/` para que el
historial quede en un solo lugar.

### 3.2 · Fotos huérfanas
Hay 11 archivos (6,3 MB) que ya no usa ninguna fila. Primero listalos y,
si la lista te cierra, borralos:

```bash
NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/limpiar-fotos-huerfanas.mjs
NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/limpiar-fotos-huerfanas.mjs --borrar
```

---

## 4 · En el panel de Supabase

- [ ] **Authentication → Passwords:** activar la protección contra contraseñas
  filtradas (*leaked password protection*).
- [ ] **Authentication → Passwords:** subir el mínimo a 8 caracteres, igual que la app.
