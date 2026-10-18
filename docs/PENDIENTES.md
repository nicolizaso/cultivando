# Pendientes: lo que te toca a vos

Son las cosas que no puedo hacer desde el código. Seguí el orden de la tabla:
cada paso necesita el anterior.

| # | Qué | Cuánto lleva | Estado |
|---|---|---|---|
| 1 | Actualizar la base de datos | — | ✅ Hecho (18/10) |
| 2 | Cargar las claves en Vercel | 10 min | ⬜ Falta |
| 3 | Dos ajustes de contraseñas en Supabase | 2 min | ⬜ Falta |
| 4 | Probar la app en la versión de prueba | 30–60 min | ⬜ Falta |
| 5 | Publicar (merge del PR) | 1 min | ⬜ Falta |
| 6 | Terminar la base de datos | 5 min | ⬜ Falta (después del 5) |
| 7 | Borrar fotos que sobran | 5 min | ⬜ Opcional |

---

## 1 · Actualizar la base de datos ✅

Ya está. Se aplicaron los 12 cambios a la base y los revisé: no se perdió
nada y está todo lo que la app nueva necesita. No tenés que hacer nada más acá.

---

## 2 · Cargar las claves en Vercel

La app necesita cinco claves que no pueden ir en el código porque son
secretas. Se cargan en Vercel.

### a) Generá las claves de las notificaciones

En tu computadora, en una terminal, corré **una sola vez**:

```
npx web-push generate-vapid-keys
```

Te muestra dos textos: **Public Key** y **Private Key**. Guardalos.

> No las vuelvas a generar más adelante: si cambian, los celulares que ya
> activaron las notificaciones dejan de recibirlas.

### b) Cargalas en Vercel

En Vercel, entrá a tu proyecto → **Settings → Environment Variables**. Agregá
estas cinco y en cada una tildá **Production** y **Preview**:

| Nombre (copialo tal cual) | Qué valor va | Para qué sirve |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | En Supabase: **Project Settings → API Keys**, la clave `service_role` | Entrar con nombre de usuario y mandar el aviso diario |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | La **Public Key** del paso a) | Que el celular pueda activar las notificaciones |
| `VAPID_PRIVATE_KEY` | La **Private Key** del paso a) | Firmar cada notificación |
| `VAPID_SUBJECT` | `mailto:` y tu email, todo junto. Ej.: `mailto:tu-email@ejemplo.com` | Un contacto que piden los servicios de notificaciones |
| `CRON_SECRET` | Cualquier texto largo inventado (30 letras y números o más) | Que nadie más que Vercel pueda disparar el aviso diario |

⚠️ Copiá los nombres exactos. Las dos secretas (`SUPABASE_SERVICE_ROLE_KEY` y
`VAPID_PRIVATE_KEY`) **nunca** van con `NEXT_PUBLIC_` adelante: eso las haría
visibles para cualquiera que abra la app.

### c) Volvé a publicar la versión de prueba

Las claves nuevas recién se usan en la próxima publicación. En Vercel →
**Deployments**, buscá la última del PR (la de la rama
`claude/fervent-cerf-u5zjei`) → menú **⋯** → **Redeploy**.

---

## 3 · Dos ajustes de contraseñas en Supabase

En Supabase → **Authentication**, en la configuración de contraseñas:

- [ ] Subí el **largo mínimo a 8 caracteres**, igual que pide la app.
- [ ] Activá la **protección contra contraseñas filtradas** (*leaked password
  protection*). Si no te deja, es porque es del plan pago: dejalo así.

---

## 4 · Probar la app

Usá la versión de prueba del PR (el link de Vercel que aparece en el PR). Está
conectada a tu base real, así que lo que crees para probar, borralo después.

Si algo no anda como dice acá, pasame qué hiciste y qué pasó (con una captura
si podés).

### Entrar y cuenta
- [ ] Entrar con email y contraseña.
- [ ] Entrar con nombre de usuario.
- [ ] Crear una cuenta nueva: pide 8 caracteres como mínimo y avisa si el usuario ya existe.
- [ ] En esa cuenta nueva, tocar "Omitir por ahora" en la bienvenida y recargar: no vuelve a aparecer.

### Lo general
- [ ] Entrar a Plantas, Ciclos, Espacios, Nutrición y Agenda, y en cada una
  crear algo y borrarlo. Todo tiene que andar igual que antes.

### Plantas
- [ ] Crear una planta: al día siguiente dice "1 día" en su etapa (antes quedaba en 0).
- [ ] Agregar una planta: se cargan las listas de ciclos y de madres; al elegir una madre se completan genética y nombre.
- [ ] Crear un esqueje con madre y después borrar la madre: el esqueje sigue, sin madre.
- [ ] Editar una planta de un ciclo terminado: la lista muestra su ciclo. Probar también "Sin ciclo".
- [ ] Regar desde el menú de la tarjeta: aparece en la bitácora.
- [ ] Subir una foto a la bitácora de una planta.
- [ ] En la ficha de una planta aparecen notas, riegos y cambios de etapa, no sólo fotos.
- [ ] En la ficha de una planta aparecen las tareas de su ciclo, pero no las de otra planta del mismo ciclo.
- [ ] En un ciclo con plantas numeradas ("X #1-6"), tocar el grupo: la lista de plantas se abre filtrada.

### Ciclos y espacios
- [ ] Crear un ciclo desde "Ciclos", y un espacio nuevo desde ahí mismo. Crear otro espacio desde "Espacios".
- [ ] Editar la ficha técnica de un espacio.
- [ ] Subir una foto a la galería de un ciclo y después borrarla.
- [ ] Terminar un ciclo y reactivarlo.
- [ ] Borrar un ciclo de prueba que tenga fotos: sus plantas quedan sin ciclo.
- [ ] Borrar un espacio de prueba al que apunte una tarea "Cambiar ambiente".

### Tareas y agenda
- [ ] Agendar un fertilizante con un combo: la receta aparece en los detalles, con la semana de la etapa.
- [ ] Agendar una serie semanal de fertilizante: cada tarea tiene la dosis de su semana.
- [ ] Agendar una serie mensual que empiece un 31: en los meses cortos cae el último día.
- [ ] Editar una tarea de una serie con "Esta y todas las futuras", cambiando la fecha: todas se corren igual.
- [ ] Completar un riego y tocar "Deshacer": vuelve a pendiente y el riego anterior queda como estaba.
- [ ] Completar "Declarar muerta": pide confirmación; "Deshacer" vuelve a activar las plantas.
- [ ] Completar "Cambiar ambiente": pide confirmación; "Deshacer" devuelve el ciclo a su espacio.
- [ ] Tocar dos veces rápido una tarea de riego: se completa una sola vez.
- [ ] Esquejado: completarlo con 2 esquejes en un ciclo nuevo; desmarcarlo y volver a completarlo: no se duplican.
- [ ] Agenda: cambiar de mes (carga ese mes), tocar un día del mes de al lado, ver los registros con su tipo.
- [ ] Agenda: editar un "Cambio de etapa" a Floración y guardar: sigue en Floración.

### Panel
- [ ] Después de las 21:00, "Tareas de hoy" sigue mostrando las de hoy, no las de mañana.
- [ ] Una tarea pendiente de ayer aparece en "Atrasadas"; al completarla desaparece de ahí.
- [ ] Una planta archivada no cuenta en "Plantas en curso" ni en las sugerencias.
- [ ] Aceptar una sugerencia de etapa; descartar otra con "Ahora no" y recargar: no vuelve.
- [ ] "Gestionar tareas": filtrar por ciclo muestra las tareas de ese ciclo.

### Nutrición y riego
- [ ] Tus 3 productos muestran su dosis y el combo muestra sus 2 productos.
- [ ] Editar un producto y después un combo: cada uno abre con sus datos.
- [ ] Editar un producto y cargar "Queda 500 ml", "Envase 1000" y "Avisar con 100": la tarjeta muestra la barra. "Compré" suma un envase.
- [ ] En la ficha de una planta, "Regar" con litros, pH y EC: en la bitácora y en "Último riego" aparece "2 L · pH 6,2 · EC 1,4 (700 ppm)".
- [ ] Riego en grupo con la calculadora: elegir un combo, poner los litros y "Anotar en la nota".
- [ ] Riego con la calculadora y "Descontar del stock": el producto baja; si queda menos de lo que pusiste en "Avisar con", sale "Queda poco" en el aviso, en Nutrición y en el panel.

### Funciones nuevas
- [ ] **Clima:** en un ciclo con varias mediciones aparece el historial. Al pasar el dedo o el mouse se ven los tres valores del día; el botón de tabla muestra lo mismo en filas.
- [ ] **VPD:** en un ciclo en floración dice "ideal 1,2–1,6 kPa en Floración", y en "VPD por etapa" aparecen las etapas que pasó el ciclo.
- [ ] **Timelapse:** en un ciclo con fotos, "Timelapse" las pasa en orden, con el día y la etapa. Probar el filtro por planta.
- [ ] **Linaje:** en la ficha de una planta que dio esquejes aparece "Linaje"; en la del esqueje, "Viene de" con su madre.
- [ ] **Madres:** marcar una planta como "Planta madre": en Plantas aparece el filtro "Madres", y al crear un esqueje sale primera.
- [ ] **Genéticas:** en Plantas → "Genéticas" aparecen tus genéticas con sus días por etapa; al tocar una se abre la lista filtrada.
- [ ] **Aviso por genética:** con dos plantas de una genética que ya terminaron la floración, una tercera en floración muestra "pasaron a secado a los N días".
- [ ] **Cosecha:** en un ciclo en floración aparece "Cosecha estimada". En "Cosecha" → "Cargar pesos" para varias plantas (pasan a Secado).
- [ ] **Rendimiento:** en una planta cosechada, "Editar" la cosecha y cargar el peso seco. En el ciclo se actualizan g/planta, g/m² y g/W (si el espacio tiene medidas y potencia).
- [ ] **Plan de cultivo:** en un ciclo en vegetativo → "Plan de cultivo": elegir productos, destildar un par de tareas y crear. Aparecen en la agenda con la receta de su semana. El tachito de al lado borra las pendientes del plan.
- [ ] **Reporte:** en un ciclo → "Reporte" → "Imprimir o guardar PDF", y bajar los cuatro CSV. Abrirlos en Excel: acentos y decimales tienen que verse bien.
- [ ] **Compartir:** en un ciclo → "Compartir", copiar el enlace y abrirlo en una ventana privada: se ve el ciclo pero no la bitácora. Después "Cortar enlace" y recargar: ya no abre.
- [ ] **Notificaciones:** menú de la cuenta (en el celular, "Más") → "Notificaciones" → "Activar en este dispositivo" → "Mandar uno ahora": llega el resumen del día. Tocarlo abre la app. En iPhone, primero agregá la app a la pantalla de inicio.

> El aviso diario automático sale a las 8:00 (hora de Argentina) y **sólo en
> la versión publicada**. En la de prueba se prueba con "Mandar uno ahora".

---

## 5 · Publicar

Cuando las pruebas den bien, hacé el merge del PR en GitHub:
https://github.com/nicolizaso/cultivando/pull/115

---

## 6 · Terminar la base de datos (después de publicar)

Quedan tres cambios que borran cosas que la versión vieja de la app todavía
usaba. Por eso van **recién cuando la versión nueva ya está publicada**.

Avisame y te paso un solo archivo, igual que la otra vez:
Supabase → **SQL Editor** → **New query** → pegarlo → **Run**.

---

## 7 · Borrar fotos que sobran (opcional)

Hay 11 fotos (6,3 MB) guardadas en Supabase que ya no usa nada de la app. Sólo
ocupan espacio. Para verlas y borrarlas, en tu computadora, dentro de la
carpeta del proyecto:

```bash
# 1. Ver la lista (no borra nada)
NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/limpiar-fotos-huerfanas.mjs

# 2. Si la lista te cierra, borrarlas
NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/limpiar-fotos-huerfanas.mjs --borrar
```

Donde dice `…` va la URL de tu proyecto de Supabase y la clave `service_role`.

---

## Avisos de Supabase que podés ignorar

En Supabase → **Advisors** vas a ver algunos avisos. Estos están bien:

- **`get_shared_cycle`**: es a propósito. Es lo que abre un ciclo compartido sin
  tener cuenta, y sólo muestra ese ciclo (sin bitácora ni datos tuyos) mientras
  el enlace no esté cortado.
- **`email_for_username`** y **dos claves sin índice en `tasks`**: desaparecen
  con el paso 6.
- **"Unused Index"**: son índices nuevos que todavía no se usaron. Es normal.
- **Los del esquema `vicio`**: no son de Cultivando.
