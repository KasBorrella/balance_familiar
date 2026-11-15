# Balance Familiar

PWA de presupuesto, menús y compra familiar para iPhone, en español de España, sin cuentas ni backend. Implementa las **fases 1, 2 y 3** de `ESPECIFICACION_TECNICA.md`: presupuesto financiero, planificador de comidas, catálogo importable, listas de compra y despensa, con modo claro/oscuro.

Puedes cambiar de tema con el botón de sol/luna de la cabecera o en **Más → Apariencia**. Las opciones son **Claro**, **Oscuro** y **Según el dispositivo**. La preferencia queda guardada en el navegador y funciona sin conexión.

## Arrancar en Windows / PowerShell

Requisitos: Node 22.12 o posterior (se ha utilizado Node 24.12), npm y un navegador moderno.

```powershell
cd C:\Users\kasbo\Devs\balance_familiar
npm install
npm run dev
```

Abre la dirección local que imprime Vite, normalmente `http://127.0.0.1:5173`. La primera apertura usa **datos de demostración claramente identificados**. En **Más → Empezar con mis datos** puedes eliminarlos junto con las modificaciones hechas durante la demostración. Desde ese momento arranca vacío y no vuelve a crear ejemplos.

## Funciones

- **Resumen:** mes seleccionado, presupuesto sin asignar o déficit, ingresos previstos y cobrados, obligaciones del mes, variables, reservas, ahorro objetivo y transferido, gráfico previsto/real, próximos pagos y alertas de exceso.
- **Planificar:** categorías/subcategorías hasta tres niveles, reglas de ingreso y gasto, presupuestos variables, saldo inicial, objetivo mensual de ahorro y calendario de vencimientos.
- **Movimientos:** alta, edición, eliminación y búsqueda de cobros, gastos y transferencias a/desde ahorro. Vinculación opcional a reglas, vencimientos y fondos.
- **Ahorro:** objetivos y fondos para gastos futuros, aportaciones/retiradas reales y pagos desde fondos sin duplicar el gasto.
- **Menús:** familia, raciones, alergias y preferencias; ingredientes con unidades y alérgenos; recetas con cantidades, pasos y coste orientativo; calendario de 7/30/31 días, asignación manual y propuestas para los huecos. Suma de ingredientes para todo el menú. El ejemplo ficticio es opcional y puede vaciarse sin borrar el presupuesto.
- **Compra:** desde Menús en móvil o desde la barra lateral en escritorio. Catálogo Mercadona manual/CSV/JSON con vista previa, fuentes y fechas; equivalencias y envases; reservas de despensa; listas semanales; higiene/limpieza; tickets manuales, gastos sin duplicados y consumo con sobrantes. Sin consulta automática de precios.
- **Más:** categorías, exportación JSON, restauración con vista previa/validación/confirmación, conservación de datos e instrucciones de instalación.
- **Offline:** precaché de código, estilos e iconos. Edición y consulta tras la primera carga, sin servicios externos. Aviso para instalar nuevas versiones sin borrar IndexedDB ni interrumpir un formulario abierto.

La app no sincroniza dispositivos. El saldo de caja se calcula a partir del saldo inicial y los movimientos registrados; no se conecta a un banco. Los objetivos y las reservas previstas no producen automáticamente movimientos reales.

## Comprobaciones

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
```

Los E2E ejecutan `vite preview` sobre **el build**, en `http://127.0.0.1:4173`, con service worker real. No prueban el offline contra el servidor de desarrollo. Si ya tienes otro Chromium compatible, puedes indicar su ejecutable:

```powershell
$env:PLAYWRIGHT_EXECUTABLE_PATH = 'C:\ruta\a\chrome.exe'
npm run test:e2e
Remove-Item Env:PLAYWRIGHT_EXECUTABLE_PATH
```

Para inspeccionar el build sin la suite:

```powershell
npm run build
npm run preview
```

Resultados y límites de la comprobación: [docs/VERIFICACION.md](docs/VERIFICACION.md).

## Instalar y publicar

La dirección local sirve para desarrollo en el PC. Para usar la app de forma independiente en el iPhone, publica **solo `dist/`** en un hosting HTTPS. Sigue [la guía de GitHub Pages e iPhone](docs/PUBLICACION.md). No se ha realizado ningún despliegue desde este repositorio.

## Copias de seguridad

En **Más → Exportar copia**, guarda el JSON en Archivos/iCloud Drive o Descargas. Si compartir no está disponible o se deniega, se utiliza una descarga. Cancelar el diálogo de compartir no cuenta como una copia. La fecha de última copia indica generación: comprueba que el archivo realmente se guardó.

Restaurar comprueba versión, checksum SHA-256, esquema, duplicados y relaciones antes de mostrar la vista previa. La confirmación reemplaza todos los registros en una única transacción; un fallo revierte la operación. Las copias v4 incluyen finanzas, menús, catálogo, despensa y compras. Se admiten copias v2 y v3, verificando su checksum antes de migrarlas: las tablas de fases posteriores quedan vacías. No existe fusión de datos. El archivo no se sube a ningún servidor, no está cifrado y contiene información privada.

El almacenamiento local puede ser eliminado por iOS, el navegador o el usuario. Solicitar persistencia no garantiza retención. Exporta antes de borrar datos del navegador, cambiar de dirección o dispositivo, o actualizar el sistema.

## Arquitectura

React + TypeScript estricto + Vite, React Router, Tailwind, componentes shadcn/ui basados en Radix, React Hook Form + Zod, Recharts, Dexie y `vite-plugin-pwa`.

`src/domain` contiene dinero, recurrencias, validación y cálculos puros financieros y alimentarios. `src/db` proporciona los repositorios, las veintiséis tablas y las migraciones. `src/features` contiene las pantallas y el servicio de backup. `src/integrations` contiene el proveedor de importación de catálogos. `src/components` contiene los componentes comunes y el editor de formularios. `tests` separa pruebas de dominio, IndexedDB y navegador. El contrato de backup es independiente del formato interno de Dexie.

Detalles y decisiones contables: [docs/MODELO.md](docs/MODELO.md). Criterios UX: [docs/UX.md](docs/UX.md).

Guías: [planificador y límites](docs/PLANIFICADOR.md), [catálogo, compra y despensa](docs/COMPRA.md). La siguiente fase es la optimización avanzada del menú y las simulaciones.
