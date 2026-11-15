# Prompt inicial para Codex — Balance Familiar v2 / Fase 1 PWA

Implementa en este repositorio una **aplicación completa y ejecutable**, no solo un diseño o plan. Lee primero `ESPECIFICACION_TECNICA.md` (v2.0); es la fuente de verdad. No implementes fases 2–4 en este turno.

## Objetivo y contexto

Aplicación **PWA instalable en iPhone**, para un solo usuario/familia en España, que gestione ingresos y gastos desde el propio móvil, completamente offline tras la primera carga. No requiere ordenador encendido para uso diario. La publicación debe poder realizarse en hosting estático HTTPS como GitHub Pages; el hosting contiene solo código, nunca presupuestos privados. Mercadona queda como supermercado inicial para fase 3, no consultar datos externos ahora.

## Stack obligatorio

- React + TypeScript estricto + Vite, React Router, Tailwind CSS, shadcn/ui, React Hook Form + Zod, Recharts.
- IndexedDB con Dexie.js (`dexie`, `dexie-react-hooks`), esquema versionado y migraciones. No Fastify, API REST, ORM SQL ni SQLite.
- PWA con `vite-plugin-pwa`, manifest (`name`, `short_name`, iconos 192/512 y maskable, `display: standalone`, `start_url`, `scope`), precaché offline y estrategia de actualización sin borrado de datos.
- Vitest + fake-indexeddb + Playwright, lint/typecheck/build.
- Dinero únicamente como enteros en céntimos; periodo `YYYY-MM`; fechas locales `YYYY-MM-DD`; idioma español, EUR y zona Europe/Madrid.

## Implementar ahora

1. **Dashboard**: selección de mes, ingresos previstos/reales, total fijo de ese mes, gasto variable previsto/real, provisiones, ahorro objetivo/real, saldo sin asignar, alertas y gráfico; etiquetar previstos vs realizados.
2. **Gastos**: categorías y subcategorías editables, desplegables con subtotales sin duplicados, conceptos individuales con frecuencia mensual/semanal/trimestral/anual/única/meses seleccionados, inicio/fin y día de cobro; ejemplo comedor escolar y extraescolares.
3. **Ingresos**: CRUD de reglas con periodicidad y registros efectivos.
4. **Presupuestos**: asignaciones por categoría, ahorro meta, cálculo de disponible (puede ser negativo), gastos por calendario.
5. **Provisiones**: fondos y aportaciones para gastos futuros separados de pagos reales; no duplicar un seguro anual por reservar mensualmente.
6. **Movimientos**: CRUD de ingresos/gastos efectivos; no alterar automáticamente movimientos históricos al editar una regla.
7. **Persistencia**: Dexie + repositorios desacoplados + operaciones atómicas; los datos se mantienen tras cerrar/reabrir. Datos demo opcionales **bien etiquetados**, con opción clara para eliminarlos; no copiar esos datos como reales.
8. **Backup y restauración**: exportar JSON versionado a archivo local; importar con vista previa/validación, confirmación de reemplazo, transacción y manejo de errores; advertencia sobre riesgo de pérdida de datos en iOS y fecha de última copia. No subir datos a repositorios o redes.
9. **PWA offline y móvil**: experiencia iPhone mobile-first, navegación inferior, formularios táctiles, estados de carga/error, accesibilidad, instalar desde Safari, instrucción de instalación y guía GitHub Pages. Verificar que app shell cachea correctamente y permite editar gastos en modo avión después de su primera carga.

## Cálculos obligatorios

- Subtotal de categoría = suma de reglas hijas aplicables al mes, una sola vez por concepto.
- Comedor 130 € y extraescolares 75 € en octubre ⇒ subtotal 205 €; al subir comedor a 150 € ⇒ 225 €.
- Extraescolares septiembre–junio: 75 € en octubre, 0 € en julio.
- Seguro anual 540 € en marzo: 540 € de salida en marzo, 0 € en abril; reserva de 45 €/mes se calcula separada, nunca se cuenta dos veces como gasto.
- Ingresos 3000 €, obligaciones 1650 €, provisiones 150 €, meta ahorro 500 €, otros presupuestos 250 € ⇒ 450 € sin asignar.
- Objetivo de ahorro no equivale a dinero realmente ahorrado; los déficits se muestran negativos.

## Estructura técnica

Usa la estructura del apartado 12 del documento: `src/features`, `src/domain`, `src/db`, `src/components`, `src/lib`, `tests`, `public`, `docs`. Implementa tablas Dexie de fase 1 (settings, categories, incomeRules, expenseRules, monthlyBudgets, budgetAllocations, transactions, sinkingFunds, fundEntries, savingsGoals) con índices y migraciones. No confundir referencias ID con FK SQL; validar integridad de relaciones en dominio/repositorios. Funciones puras para dinero, recurrencias, resumen mensual y provisiones.

## Calidad y comprobación

- Ejecuta y corrige `npm install`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, y E2E cuando se disponga de Chromium.
- Unit tests del cálculo de céntimos, recurrencias, meses personalizados, cambios de año, suma jerárquica y déficit.
- Tests IndexedDB con fake-indexeddb para CRUD, persistencia, migración y backup/restore.
- Playwright: añadir categoría Educación e hijos; comedor 130 y extraescolares 75; ver 205; cambiar comedor a 150 y ver 225; comprobar julio; refrescar y conservar datos; exportar/restaurar; viewport móvil.
- Probar modo offline contra `vite preview` con build y service worker habilitado, no asumir que funciona por pasar tests en servidor dev.
- Documentar pruebas manuales Safari iPhone: instalar desde pantalla de inicio, desactivar Wi-Fi/datos, modificar una regla, reabrir, exportar archivo y restaurar, desplegar nueva versión preservando datos.

## Reglas de entrega

Inspecciona el repositorio antes de modificarlo. Escribe código, configuración y README ejecutables. No sustituyas persistencia por arrays en memoria ni declares pruebas aprobadas sin ejecutarlas. No uses APIs privadas ni scraping Mercadona, cuentas externas, login, cloud o backend en fase 1. Documenta la configuración `base`/`scope` para GitHub Pages bajo una subruta, incluyendo consideraciones de actualización de service worker. Entrega al finalizar: qué implementaste, comandos PowerShell, resultados reales de tests, limitaciones y siguiente paso (fase 2).

**Prioridad: exactitud financiera, persistencia segura y operación real offline en iPhone > estética.**
