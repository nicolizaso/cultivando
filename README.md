# Cultivando

Aplicación de seguimiento de cultivo. Organiza el día a día en cuatro objetos:
**espacios** (dónde cultivás), **ciclos** (cada tanda, con su fecha de arranque),
**plantas** (con su etapa y su edad) y **tareas** (riegos, podas, cambios de
etapa) sobre un calendario.

Proyecto personal, construido con Next.js 16 y Supabase.

---

## Qué resuelve

Quien cultiva termina con la información repartida entre un cuaderno, notas del
teléfono y una galería de fotos sin fecha. Acá todo cuelga del ciclo:

| Sección | Qué hace |
| --- | --- |
| **Panel** | Estado del día: tareas pendientes, ciclos en curso y las plantas de cada uno. |
| **Ciclos** | Tandas activas y cerradas, con día de cultivo, plantas vivas y galería de seguimiento. |
| **Plantas** | Inventario con búsqueda, filtros por ciclo y espacio, archivado y acciones en lote. |
| **Agenda** | Calendario mensual de tareas y fotos, con el detalle del día seleccionado. |
| **Espacios** | Carpa, armario o exterior, con ficha técnica (luz, medidas, ventilación) y ocupación. |
| **Nutrición** | Fertilizantes con su dosis y combos para aplicar varios en el mismo riego. |

Además calcula solo: días en cada etapa, edad total de la planta, días desde el
último riego y el **VPD** a partir de temperatura y humedad, con el rango sano
escrito en palabras y no sólo en color.

---

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions)
- **React 19** y **TypeScript**
- **Tailwind CSS v4** sobre tokens semánticos propios
- **Supabase** (Postgres, Auth y Storage) con RLS
- **Motion** para las transiciones de navegación y listas
- **date-fns**, **lucide-react**, **browser-image-compression**

---

## Sistema de diseño

Todo el color vive en `app/globals.css` como tokens semánticos. Ningún
componente escribe un color literal, así que el tema claro y el oscuro salen del
mismo código.

**Paleta "Savia".** Lienzo neutro cálido con un único acento de marca, un verde
savia profundo. El resto de los colores no decoran: o son *estado*
(éxito, aviso, error) o son *taxonomía*, nueve acentos con los que se pintan las
siete etapas del cultivo y los doce tipos de tarea, declarados una sola vez en
`app/lib/constants.tsx`.

**Geometría bloqueada.** Un solo escalón de radios (chips redondos, controles a
12px, tarjetas a 16px, paneles a 20px) y un solo juego de sombras, tintadas al
fondo en vez de negro puro.

**Primitivas antes que utilidades sueltas.** `.btn`, `.field-input`, `.chip`,
`.segmented`, `.metric` y `.action-bar` concentran las decisiones: si un botón
compacto tiene que cambiar de alto, cambia en un sitio.

**Tipografía.** Outfit para títulos y cifras, Plus Jakarta Sans para texto y
JetBrains Mono sólo para números (días, °C, %, VPD), con cifras tabulares para
que no bailen al actualizarse.

### Accesibilidad

- Cada pareja de color está verificada a **WCAG AA**, incluido el caso real de
  un chip: texto de acento sobre su propio tinte tenue, no sobre blanco.
- Auditoría con **axe-core** (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`):
  **cero violaciones** en tema claro, tema oscuro y acceso.
- El color nunca comunica solo: el riego atrasado, el VPD fuera de rango y las
  tareas completadas llevan también icono y texto.
- Foco visible en toda la app, objetivos táctiles de 44px, diálogos con foco
  atrapado y devuelto al disparador, y navegación con flechas en los grupos de
  pestañas.
- Se respetan `prefers-reduced-motion`, `prefers-contrast` y
  `prefers-reduced-transparency`; el zoom nunca se bloquea.
- Los campos miden **16px reales** en pantallas táctiles: por debajo de eso iOS
  hace zoom solo al enfocarlos, y la alternativa (bloquear el zoom) rompería
  WCAG 1.4.4. Con puntero fino se mantiene la escala densa del diseño.

---

## Estructura

```
app/
  layout.tsx          Cromo global: navegación, tema, notificaciones
  page.tsx            Panel
  calendar/           Agenda
  cycles/             Ciclos y detalle de ciclo
  plants/             Inventario, ficha y edición
  spaces/             Espacios
  fertilizers/        Nutrición
  actions/            Server Actions
  lib/                Tokens de taxonomía, navegación, métricas y Supabase
components/
  layout/             PageShell, PageHeader, hoja "Más"
  ui/                 Modal, ConfirmDialog, SegmentedControl, SelectionBar, StatCard
  skeletons/          Siluetas de carga
```

La navegación se declara una sola vez en `app/lib/navigation.ts`: cuatro
secciones de uso diario como pestañas en móvil, dos de configuración en la hoja
"Más", y las seis en una línea a partir de 1024px.

---

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completá las credenciales de Supabase
npm run dev
```

Variables necesarias:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Otros comandos:

```bash
npm run build   # build de producción
npm run lint    # ESLint
```
