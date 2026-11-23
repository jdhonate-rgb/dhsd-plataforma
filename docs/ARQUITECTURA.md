# Arquitectura

## Principios
1. **Aislamiento:** las áreas usan solo esta web. Nunca reciben acceso directo a la base de datos ni al software de la empresa.
2. **Mínimo privilegio:** el rol `area` solo ve y crea lo de su área; el rol `propietario` decide. Se aplica con RLS en la base, no solo en la web.
3. **GitHub no es base de datos:** guarda código, decisiones y documentación. Las solicitudes y archivos viven en Supabase.
4. **Sin datos reales en el repositorio** ni en el Handbook; solo identificadores internos y resúmenes.

## Componentes y estado

| Componente | Estado |
|---|---|
| Web PWA: ingreso, nueva solicitud, tablero, detalle y decisión, carga de Excel con vista previa de columnas | IMPLEMENTED en modo demostración (probado en navegador) |
| Esquema: áreas, perfiles, solicitudes, bitácora, cargas, reglas de transición, RLS, almacenamiento privado | TESTED en PostgreSQL 16 con 12 pruebas de seguridad (usa un stub de Supabase) |
| Conexión a Supabase real (Auth, Storage, políticas de `storage.objects`) | PENDING: espera el proyecto del Propietario; las políticas de Storage no se pueden probar sin Supabase |
| Cargador de Excel → tablas de staging y validación | PROPOSED: no construido. Opciones: función Edge de Supabase o n8n |
| Creación de la Issue al aprobar y vínculo con el Project #6 | PROPOSED: al inicio manual (el Propietario anota el n.º de Issue en el detalle) para no crear tokens |
| Resumen hacia el Handbook por PR | PROPOSED |
| Alertas por WhatsApp/correo | PROPOSED (requiere proveedor y presupuesto) |

## Flujo de una solicitud
`recibida → en_analisis → pendiente_decision → aprobada → en_ejecucion → cerrada` (o `rechazada` desde las tres primeras etapas). Las transiciones válidas están en la base (trigger) y en la web (`web/lib.js`); aprobar exige prioridad y nota. Las áreas no pueden cambiar estados.

## Flujo de un Excel
1. El usuario del área elige el archivo; el navegador lee **solo los nombres de columna** y el número de filas para mostrar una vista previa.
2. Al confirmar, el archivo va a un espacio privado de Storage, en una carpeta con el id de su área, y se registra en `cargas` con estado `recibida`.
3. (Siguiente fase) Un proceso con permisos de servicio lo valida y lo carga a tablas de staging, y cambia el estado a `cargada`, `rechazada` o `error`.

El archivo contiene datos reales: por eso solo el Propietario y la propia área lo pueden leer, y nunca pasa por GitHub.

## Más adelante: servidor local
El esquema es PostgreSQL estándar con RLS, así que puede moverse a Supabase autoalojado. Hacerlo es una decisión del Propietario y requiere plan de respaldo y mantenimiento (ver Handbook, `09_SECURITY/BACKUP_POLICY.md`).

## Decisiones de diseño
- Web sin framework ni compilación: la misma idea de las otras apps del Propietario, fácil de mantener desde tablet y de publicar en GitHub Pages.
- Todo el texto dinámico se inserta con `textContent`; la política CSP bloquea scripts y estilos en línea.
- `supabase-js` y el lector de Excel (SheetJS) se cargan desde CDN con versión fija.
- Solo existen las áreas Cartera y Laboratorio clínico, que son las únicas que el Propietario ha mencionado. El resto se agregan desde la tabla `areas`.
