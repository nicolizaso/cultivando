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
2. `20261017150000_nutricion.sql`
3. `20261017160000_tareas.sql`
4. `20261017170000_plantas.sql`
5. `20261017180000_bitacora_y_borrados.sql`
6. `20261017190000_rendimiento.sql`
7. `20261017200000_limpieza.sql`

---

## 2 · Probar

Checklist para el preview del PR, una vez hechos los pasos de arriba:

- [ ] Entrar con email y contraseña.
- [ ] Entrar con nombre de usuario.
- [ ] Registrar una cuenta nueva: pide 8 caracteres y avisa si el usuario ya existe.
- [ ] Subir una foto a la bitácora de una planta.
- [ ] Subir una foto a la galería de un ciclo y después borrarla.
- [ ] Editar la ficha técnica de un espacio.
- [ ] Nutrición: tus 3 productos muestran su dosis y el combo sus 2 productos.
- [ ] Editar un producto (abre con sus datos) y editar el combo.
- [ ] Agendar un fertilizante con un combo: la receta aparece en los detalles con la semana de la etapa.
- [ ] Agendar una serie semanal de fertilizante: cada tarea tiene la dosis de su semana.
- [ ] Agendar una serie mensual que empiece un 31: cae el último día de los meses cortos.
- [ ] Crear una planta nueva: al día siguiente dice "1 día" en su etapa (antes quedaba en 0).
- [ ] Crear un esqueje con madre; después borrar la madre: el esqueje sigue, sin madre.
- [ ] Editar una planta de un ciclo finalizado: el desplegable muestra su ciclo; probar "Sin ciclo".
- [ ] Regar desde el menú de la tarjeta: aparece en la bitácora.
- [ ] Aceptar una sugerencia de etapa del panel; descartar otra con "Ahora no" y recargar: no vuelve.
- [ ] Ficha de una planta: aparecen notas, riegos y cambios de etapa, no sólo fotos.
- [ ] Ficha de una planta: aparecen las tareas de su ciclo entero, pero no las de otra planta del mismo ciclo.
- [ ] Agenda: cambiar de mes (carga ese mes), tocar un día del mes vecino, ver registros con su tipo.
- [ ] Agenda: editar un "Cambio de etapa" a Floración y guardar: sigue en Floración.
- [ ] Finalizar y reactivar un ciclo; borrar un ciclo de prueba con fotos: sus plantas quedan sin ciclo.
- [ ] Borrar un espacio de prueba que sea destino de una tarea "Cambiar ambiente".
- [ ] Panel después de las 21:00: "Tareas de hoy" sigue mostrando las de hoy, no las de mañana.
- [ ] Panel: una tarea pendiente de ayer aparece en "Atrasadas"; completarla la saca de ahí.
- [ ] Panel: una planta archivada no cuenta en "Plantas en curso" ni en el sugeridor.
- [ ] Completar un riego y tocar "Deshacer" en el aviso: vuelve a pendiente y el riego anterior queda como estaba.
- [ ] Completar una "Declarar muerta": pide confirmación; después "Deshacer" desarchiva las plantas.
- [ ] Completar un "Cambiar ambiente": pide confirmación; "Deshacer" devuelve el ciclo a su espacio.
- [ ] Tocar dos veces rápido una tarea de riego: se completa una sola vez.
- [ ] Esquejado: completar con 2 esquejes en un ciclo nuevo; desmarcar y volver a completar: no duplica.
- [ ] Editar una tarea de una serie con "Esta y todas las futuras", cambiando la fecha: todas se corren igual.
- [ ] En una cuenta sin espacios, "Omitir por ahora" en la bienvenida y recargar: no vuelve a aparecer.
- [ ] En un ciclo con plantas numeradas ("X #1-6"), tocar el grupo: la lista de plantas abre filtrada.
- [ ] Después de aplicar `rendimiento.sql`: entrar, ver plantas, ciclos, espacios, nutrición y agenda; crear y borrar algo en cada una (las reglas de acceso se reescribieron).
- [ ] Crear un ciclo desde "Ciclos" (y un espacio nuevo desde ahí mismo); crear un espacio desde "Espacios".
- [ ] Agregar una planta: el desplegable de ciclos y el de madres se cargan; elegir una madre completa genética y nombre.
- [ ] "Gestionar tareas" en el panel: filtrar por ciclo muestra las tareas de ese ciclo.
- [ ] Editar un producto y un combo de nutrición, cerrar y abrir otro: cada uno abre con sus datos.
- [ ] Ficha de un ciclo con varias mediciones: aparece el historial; pasar el dedo o el mouse muestra los tres valores del día; el botón de tabla muestra lo mismo en filas.
- [ ] Ficha de un ciclo en floración: el VPD dice "ideal 1,2–1,6 kPa en Floración"; en "VPD por etapa" aparecen las etapas que pasó el ciclo.
- [ ] En Supabase → Advisors → Performance: ya no aparecen los avisos "Auth RLS Initialization Plan" ni los de claves foráneas sin índice de las tablas de Cultivando.

---

## 3 · Después de publicar (merge a `main`)

### 3.1 · Migraciones de cierre (`supabase/post-deploy/`)
Cierran cosas que la versión vieja todavía usaba, por eso van **después** de
que el código nuevo esté en producción. Mismo método que en 1.2, en orden:

1. `20261017140000_seguridad_cierre.sql`
2. `20261017170000_plantas_cierre.sql`
3. `20261017180000_bitacora_y_tareas_cierre.sql`

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
