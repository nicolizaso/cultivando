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
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → `service_role` (secreta) | Login con nombre de usuario y el aviso diario. Sin ella, se entra sólo con email y no salen avisos. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | La "Public Key" que imprime `npx web-push generate-vapid-keys` (ver abajo) | Que el navegador pueda suscribirse a los avisos. |
| `VAPID_PRIVATE_KEY` | La "Private Key" del mismo comando (secreta) | Firmar cada aviso. |
| `VAPID_SUBJECT` | `mailto:` + tu email, por ejemplo `mailto:tu-email@ejemplo.com` | Contacto que piden los servicios de push. |
| `CRON_SECRET` | Cualquier texto largo al azar (por ejemplo, el resultado de `openssl rand -hex 32`) | Que sólo el cron de Vercel pueda disparar el aviso diario. |

Nunca cargues `SUPABASE_SERVICE_ROLE_KEY` ni `VAPID_PRIVATE_KEY` con prefijo
`NEXT_PUBLIC_`: quedarían a la vista en el navegador.

Para las claves VAPID, en tu compu (una sola vez; no las cambies después o los
dispositivos suscriptos dejan de recibir):

```
npx web-push generate-vapid-keys
```

El aviso diario corre con el cron de `vercel.json` a las 8:00 de Argentina
(11:00 UTC) y **sólo en Production**: en el preview se prueba con el botón
"Mandar uno ahora".

### 1.2 · Migraciones compatibles (`supabase/migrations/`)
Se pueden aplicar con la versión actual publicada: no rompen nada de lo que
hoy está en producción.

**Estado:** la primera mitad de `seguridad` ya está aplicada (índice de
usuario único, límites del bucket, reglas nuevas de fotos y `search_path`). El
resto no se pudo aplicar desde el conector: todo lo que tiene `drop` o
`revoke` pide una aprobación que sólo podés dar vos.

Aplicalas en este orden, desde el SQL Editor de Supabase (pegar el archivo
entero y ejecutar) o con `supabase db push`. La 1 se puede volver a correr
entera sin problema: lo ya aplicado no se duplica.

Atajo: en el chat te pasé `aplicar-migraciones.sql`, un solo archivo con todo
lo que falta (resto de la 1 y de la 2 a la 12), que corre todo o nada y deja
el historial de migraciones igual a estos archivos. Se pega una vez en el SQL
Editor y listo.

1. `20261017140000_seguridad.sql`
2. `20261017150000_nutricion.sql`
3. `20261017160000_tareas.sql`
4. `20261017170000_plantas.sql`
5. `20261017180000_bitacora_y_borrados.sql`
6. `20261017190000_rendimiento.sql`
7. `20261017200000_limpieza.sql`
8. `20261017210000_linaje.sql`
9. `20261017220000_stock.sql`
10. `20261017230000_cosechas.sql`
11. `20261017240000_compartir.sql`
12. `20261017250000_notificaciones.sql`

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
- [ ] Ficha de un ciclo con fotos (galería o bitácora de sus plantas): "Timelapse" las pasa en orden con el día y la etapa; probar el filtro por planta.
- [ ] Ficha de una planta que dio esquejes: aparece "Linaje" con sus esquejes; en la ficha de un esqueje, "Viene de" con su madre.
- [ ] Editar una planta y marcar "Planta madre": en Plantas aparece el filtro "Madres" y al crear un esqueje sale primera.
- [ ] Plantas → "Genéticas": aparecen tus genéticas con sus días por etapa; tocar una abre la lista filtrada.
- [ ] Con dos plantas de una genética que ya terminaron la floración, una tercera en floración recibe el aviso "pasaron a secado a los N días".
- [ ] Ficha de una planta → "Regar": cargar litros, pH y EC; en la bitácora aparece "2 L · pH 6,2 · EC 1,4 (700 ppm)" y en "Último riego" también.
- [ ] Riego en lote con la calculadora: elegir un combo, poner los litros y "Anotar en la nota".
- [ ] Nutrición: editar un producto y cargar "Queda 500 ml", "Envase 1000", "Avisar con 100"; la tarjeta muestra la barra. "Compré" suma un envase.
- [ ] Riego con la calculadora y "Descontar del stock": el producto baja; si queda menos del aviso, sale "Queda poco" en el aviso, en Nutrición y en el panel.
- [ ] Ciclo en floración: aparece "Cosecha estimada" con la fecha; en "Cosecha", "Cargar pesos" para varias plantas (pasan a Secado).
- [ ] Ficha de una planta cosechada: "Editar" la cosecha y cargar el peso seco; en el ciclo se actualizan g/planta, g/m² y g/W (si el espacio tiene medidas y potencia).
- [ ] Ciclo en vegetativo → "Plan de cultivo": elegir productos, destildar un par de tareas y crear; aparecen en la agenda con la receta de su semana. Después, el tachito al lado borra las pendientes del plan.
- [ ] Ciclo → "Reporte": "Imprimir o guardar PDF" y bajar los cuatro CSV; abrirlos en Excel (acentos y decimales bien).
- [ ] Ciclo → "Compartir": copiar el enlace y abrirlo en una ventana privada (sin sesión): se ve el ciclo y no la bitácora. "Cortar enlace" y recargar: ya no abre.
- [ ] Menú de la cuenta (en el celular: "Más") → "Notificaciones" → "Activar en este dispositivo" y "Mandar uno ahora": llega el resumen del día. En iPhone, primero agregá la app a la pantalla de inicio.
- [ ] Tocar la notificación abre la app.
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

- El asesor de seguridad puede marcar `get_shared_cycle` por ser `SECURITY DEFINER`
  y poder llamarse sin sesión. Es a propósito: es lo que abre un ciclo compartido, y
  sólo devuelve ese ciclo (sin bitácora ni datos de usuario) si el enlace existe y no
  se cortó. No hace falta tocar nada.


- [ ] **Authentication → Passwords:** activar la protección contra contraseñas
  filtradas (*leaked password protection*).
- [ ] **Authentication → Passwords:** subir el mínimo a 8 caracteres, igual que la app.
