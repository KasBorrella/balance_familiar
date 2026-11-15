# Balance Familiar — Especificación técnica v2.0 — PWA local-first

**Fecha:** 14 de noviembre de 2026  
**Producto:** PWA instalable en iPhone para planificación financiera y alimentaria familiar  
**Supermercado inicial:** Mercadona  
**Público inicial:** una unidad familiar, uso personal, sin cuentas ni servicios cloud obligatorios.

## 1. Visión y objetivos

La aplicación asigna ingresos mensuales a obligaciones, provisiones, necesidades, alimentación y objetivos de ahorro; construye un plan de comidas viable y una lista de compra basada en precios trazables de un único supermercado.

Objetivos de producto:
1. Mostrar exactamente de dónde sale cada subtotal y el gasto fijo total.
2. Separar presupuesto, compromisos, movimientos reales y ahorro efectivamente alcanzado.
3. Calcular provisiones para gastos no mensuales sin contarlas dos veces.
4. Generar menús factibles, ajustados al hogar, y convertir ingredientes en envases comprables.
5. Reutilizar existencias de despensa y restos, y evitar compras duplicadas.
6. Trabajar offline para la gestión doméstica; acceso externo solo para importaciones/actualizaciones voluntarias.

Fuera de alcance del MVP: agregación bancaria, conexión a cuentas financieras, pagos, pedidos automáticos, scraping de Mercadona, IA generativa, reconocimiento OCR de tickets y recomendaciones clínicas de alimentación.

## 2. Arquitectura y stack definitivo: PWA sin backend

**Decisión:** uso personal en un único iPhone, con posibilidad de abrir en PC para desarrollo. La app es una PWA **local-first**: todas las operaciones ordinarias son client-side y funcionan offline una vez instalada/cargada. No requiere Node, Fastify ni SQLite en producción. El PC se utiliza para desarrollar y publicar nuevas versiones, no para editar datos.

- React + TypeScript `strict` + Vite + React Router.
- Tailwind CSS + shadcn/ui, formularios React Hook Form + Zod, gráficos Recharts.
- Persistencia IndexedDB con Dexie.js, tablas versionadas y migraciones `db.version(n).stores(...).upgrade(...)`.
- Dominio en TypeScript puro: enteros en céntimos EUR, calendarios, reglas presupuestarias, subtotal por árbol, provisiones y ahorro. Sin `float` para dinero.
- `vite-plugin-pwa` (Workbox), manifest con iconos, `display: standalone`, precaché del app shell, fallback de navegación y página offline. **No cachear información financiera personal en endpoints externos**.
- Vitest para funciones/repositories; Playwright para flujos E2E y prueba offline/responsive; ESLint, Prettier y typecheck.
- Idioma `es-ES`, EUR, fechas calendario ISO, zona `Europe/Madrid`. No registrar datos bancarios ni credenciales.
- Hosting de **archivos estáticos HTTPS** opcional pero recomendado para instalación iOS (p.ej. GitHub Pages); nunca subir la base de datos familiar. La dirección de publicación y el `base` de Vite deben coincidir. Una primera visita con Internet instala/carga la PWA; después funciona offline para funciones ya implementadas y cacheadas.
- Acceso desde pantalla de inicio de Safari en iPhone. La instalación/soporte exacto depende de la versión de iOS; validar en dispositivo real. **No prometer retención permanente:** iOS puede eliminar datos locales o el usuario puede borrarlos.

### Capas

1. `features/` interfaces y casos de uso de presupuesto.
2. `domain/` cálculos y validaciones sin infraestructura.
3. `repositories/` interfaces de repositorio y adaptadores Dexie con transacciones; vistas observables con `useLiveQuery`.
4. `integrations/` importadores CSV/JSON y futuro proveedor de catálogo Mercadona autorizado.
5. `backup/` exportación/importación versionada y verificada; no sincronización multiusuario en MVP.

### Privacidad y copias de seguridad

- Datos almacenados únicamente en el origen HTTPS de la app en **el dispositivo**; GitHub Pages, si se usa, solo aloja el código estático y no recibe la base de datos. Evitar analítica, telemetría y CDN de terceros para activos principales.
- Exportación JSON completa con `{schemaVersion, exportedAt, appVersion, data, checksum}`; validar esquema, relaciones, duplicados y compatibilidad **antes** de importar. Preguntar si reemplazar o fusionar; en MVP solo reemplazo con confirmación y transacción íntegra; rollback si falla.
- **Copias de seguridad manuales** a Archivos/iCloud Drive usando compartir/descarga del navegador, y restauración mediante selector de archivos. Advertencia visible si no existe copia reciente. Opcional: cifrado con Web Crypto y contraseña que **no** se almacena ni se recupera.
- Solicitar `navigator.storage.persist()` cuando esté disponible y explicar que no garantiza permanencia. Considerar Safari almacenamiento privado, cuotas y políticas del sistema.
- Migraciones Dexie testadas con versiones antiguas; no borrar ni reinicializar la DB automáticamente al desplegar versiones nuevas.
- No hay sincronización entre dispositivos, recuperación cloud ni backend en MVP.

## 3. Modelo financiero

### 3.1 Conceptos

- **Ingreso:** cantidad, origen, fecha de cobro, recurrencia, estado confirmado/estimado.
- **Categoría:** vivienda, suministros, educación e hijos, transporte, salud, seguros, suscripciones, alimentación, higiene, ocio, otros; editable y ordenable.
- **Subcategoría (opcional):** p. ej. educación > comedor, educación > extraescolares; jerarquía de hasta 3 niveles para interfaz simple.
- **Gasto recurrente:** concepto individual, categoría, importe previsto, frecuencia y calendario de vigencia.
- **Gasto variable presupuestado:** límite por categoría sin confundirlo con cargo real.
- **Movimiento:** ingreso/gasto real en una fecha; puede vincularse a un concepto recurrente o compra.
- **Provisión:** reserva para obligación futura, con saldo y transacciones propios. Es asignación presupuestaria, no gasto real hasta el pago.
- **Ahorro objetivo:** importe reservado como meta; distinto del ahorro real calculado.
- **Presupuesto mensual:** asignaciones de dinero por categoría para un periodo.

### 3.2 Reglas de periodicidad

Permitir `MONTHLY`, `WEEKLY`, `QUARTERLY`, `YEARLY`, `ONE_OFF`, `CUSTOM_MONTHS` y meses activos (ej. septiembre-junio). Cada entrada conoce primer/último día, meses aplicables y fecha de vencimiento; no asume que cualquier gasto se paga 12 meses.

Para vista de caja, calcular pagos previstos **en ese mes exacto**. Para vista de provisión, calcular aportación mensual destinada a futuros pagos, con regla configurable y saldo acumulado. Ej.: seguro 540 € anual = 45 €/mes cuando se reserva durante 12 meses; cuando se abona el seguro, se consume el saldo reservado y el movimiento real se registra una sola vez.

No usar automáticamente `importe anual / 12` para representar pagos reales mensuales. Una extraescolar de 75 € de septiembre a junio tiene 75 € de salida durante esos diez meses y 0 € en julio/agosto; si el usuario decide provisionarla todo el año, la aportación orientativa sería 62,50 € mensuales.

### 3.3 Fórmulas

```
fixed_cash_outflow_month = sum(due_occurrences(month) for each recurring fixed expense)
variable_budget_month = sum(category allocations marked variable)
planned_income_month = sum(expected incomes for month)
planned_cash_result = planned_income_month - planned_expense_payments_month
unallocated_budget = planned_income_month - allocations_to_current_expenses - allocations_to_sinking_funds - savings_target
actual_net_cash_flow = actual_income - actual_paid_expenses
available_cash = opening_cash + actual_net_cash_flow  // excluye por separado compromisos futuros
actual_saving_progress = dedicated_savings_transfers - withdrawals_from_savings
```

La suma de las categorías hijas debe igualar el subtotal de su padre; el total fijo es la suma de conceptos individuales elegibles en ese mes **una sola vez**. Un pago provisionado no se resta de nuevo como nueva obligación presupuestaria cuando se liquida con dinero de la provisión. Mostrar siempre caja, asignación y saldos de fondos como vistas distintas.

### 3.4 Estados y alertas

- `sin_asignar > 0`: presupuesto incompleto, no presumir de ahorro conseguido.
- `sin_asignar < 0`: déficit; mostrar valor exacto y categorías responsables.
- `gasto_previsto > límite`: exceso previsto.
- `gasto_real > límite`: exceso realizado.
- Precio faltante o caducado: marcar cesta incompleta o estimada, nunca certificar un ahorro exacto.

## 4. Menús, recetas y familia

### 4.1 Perfil familiar

Datos mínimos: adultos, niños, raciones por comida, comidas que se hacen en casa, alergias/intolerancias y preferencias; edades opcionales para orientación de raciones. Sin almacenar información médica más detallada de la necesaria. Alergias son **restricciones duras**. El sistema no garantiza seguridad ante contaminación cruzada: siempre verificar etiquetas.

### 4.2 Recetas

Cada receta registra nombre, tipo de comida, duración, método, ingredientes expresados en cantidades base en gramos/ml/unidades, número de raciones, sustituciones, grupos de alimento, alérgenos declarados, repetición máxima y pasos. Datos nutricionales solo si cuentan con fuente verificable y unidades coherentes; nunca inferir valores exactos de textos libres.

### 4.3 Planificación

MVP: calendario de 7/30/31 días y asignación manual de recetas; posibilidad de generar plan sencillo por reglas y presupuesto en fase 2. Reglas de elegibilidad: alergias, comidas en casa, porciones, máxima repetición y tiempo de elaboración.

Etapa posterior: optimizador por restricciones con minimización de coste de la cesta real, variedad, reutilización y límites configurables. Si no hay plan factible, explicar por qué; no reducir raciones por debajo de mínimos configurados para ahorrar.

### 4.4 Ingredientes, inventario y compra

- Canonizar ingredientes (p. ej. arroz crudo, tomate triturado) sin confundirlos con productos comerciales.
- Mapear cada ingrediente a productos del supermercado, con cantidad neta y equivalencias de unidad.
- `required = sum(recipe usage adjusted to portions)`.
- `net_needed = max(0, required - usable_pantry_stock)`.
- Elegir combinación de formatos/paquetes que cubra cantidad neta y minimice precio total y, como desempate, exceso comprado; respetar sustituciones y límites.
- Guardar cantidades sobrantes tras confirmar compras y consumos; evitar dobles descontajes.
- Productos de peso variable: coste estimado, rango o aviso; ajustar al registrar ticket.
- Separar cesta alimentaria, higiene y limpieza cuando proceda, aunque se compren en el mismo supermercado.

## 5. Proveedores y precios Mercadona

### 5.1 Restricciones

Mercadona no ofrece una API pública oficial estable documentada para este uso. No implementar consumo de endpoints privados, scraping, elusión de controles, automatización de cuentas ni pedidos en el MVP. Confirmar términos y fuente autorizada antes de cualquier integración futura.

### 5.2 Interfaz de proveedor

```ts
interface CatalogProvider {
  id: string;
  importCatalog(input: Uint8Array, format: 'csv' | 'json'): Promise<ImportResult>;
  validateRecords(records: unknown[]): CatalogValidationResult;
  normalizeProduct(raw: unknown): NormalizedCatalogProduct | null;
}
```

Providers: `MercadonaImportProvider` en MVP; futuro `MercadonaAuthorizedSourceProvider` solo tras verificar autorización, estabilidad y tratamiento de datos.

Cada precio necesita `priceCents`, `currency`, `unitPrice` opcional, `observedAt`, `sourceType` (`manual`, `import`, `authorized_feed`, `demo`), `sourceReference`, `storeContext`, `verificationStatus`. Política configurable de antigüedad, valor inicial 14 días, etiqueta visible siempre; un precio importado no se denomina "verificado en tiempo real".

Importación en vista previa con validación de esquema, duplicados, errores por fila, mapping de columnas, confirmación y rollback. No mezclar valores demo con reales sin etiquetarlos.

Fuentes orientativas para verificar: https://ayuda.tienda.mercadona.es/hc/es/articles/360000857491-Precios-de-los-productos-SPB ; https://www.mercadona.es/ .

## 6. Modelo de datos IndexedDB (Dexie)

Entidades del dominio; `id` UUID; referencias por ID y validación referencial en servicios/operaciones Dexie (IndexedDB **no tiene claves foráneas SQL**). Índices Dexie por periodo, categoría, fecha y claves de búsqueda. Importes enteros `amountCents`; cantidades enteras g/ml/unidades; fecha ISO local. `createdAt/updatedAt` y `schemaVersion` donde corresponda.

| Tabla Dexie | Campos esenciales | Fase |
|---|---|---|
| `settings` | key, value, updatedAt; moneda, zona, hogar único | 1 |
| `categories` | id, parentId, name, type, sortOrder, archivedAt | 1 |
| `incomeRules` | id, name, amountCents, frequency, activeMonths, dueDay, startDate, endDate, status | 1 |
| `expenseRules` | id, categoryId, name, amountCents, kind, frequency, activeMonths, dueDay, startDate, endDate, archivedAt | 1 |
| `monthlyBudgets` | period, openingCashCents, savingsTargetCents, status | 1 |
| `budgetAllocations` | id, period, categoryId, amountCents, allocationType | 1 |
| `transactions` | id, date, direction, amountCents, categoryId, expenseRuleId, memo, source, createdAt | 1 |
| `sinkingFunds` | id, name, targetCents, dueDate, active | 1 |
| `fundEntries` | id, fundId, date, entryType, amountCents, transactionId | 1 |
| `savingsGoals` | id, name, targetCents, deadline, active | 1 |
| `householdMembers` | id, alias, type, portionsFactor, active, restrictions | 2 |
| `ingredients` | id, name, baseUnit, allergens | 2 |
| `recipes` | id, name, servings, mealType, minutes, instructions, allergens | 2 |
| `recipeIngredients` | id, recipeId, ingredientId, quantityBase | 2 |
| `mealPlans` | id, startDate, endDate, budgetCents, status | 2 |
| `mealEntries` | id, mealPlanId, date, slot, recipeId, servings | 2 |
| `supermarkets` | id, name, enabled (Mercadona inicial) | 3 |
| `products` | id, supermarketId, externalSku?, name, packageQuantity, unit, active | 3 |
| `ingredientProductMappings` | id, ingredientId, productId, usableQuantity | 3 |
| `priceObservations` | id, productId, priceCents, observedAt, sourceType, sourceRef, storeContext | 3 |
| `pantryLots` | id, ingredientId, productId?, quantityBase, expiryDate | 3 |
| `shoppingLists` | id, mealPlanId, supermarketId, status, createdAt | 3 |
| `shoppingItems` | id, listId, productId, packagesCount, unitPriceSnapshotCents | 3 |
| `purchases` | id, listId?, date, actualTotalCents | 3 |
| `purchaseItems` | id, purchaseId, productId, quantity, totalCents | 3 |
| `catalogImports` | id, sourceType, importedAt, checksum, successCount, errorCount | 3 |

Reglas: el subtotal se obtiene de conceptos asignados a categorías descendientes, nunca sumando subtotal padre e hijo; las transacciones históricas no se alteran cuando cambian reglas. No duplicar ticket total y líneas como transacciones independientes. Import/export utiliza estructuras JSON versionadas ajenas a implementación Dexie; sin exportar información temporal de service worker.

## 7. Contratos de servicio (sin API REST en MVP)

Separar interfaz y persistencia para facilitar futura migración a sincronización sin reescribir UI:

```ts
interface FinanceRepository {
  getExpenseRules(): Promise<ExpenseRule[]>;
  saveExpenseRule(rule: ExpenseRule): Promise<void>;
  getTransactions(period: string): Promise<Transaction[]>;
  saveTransaction(transaction: Transaction): Promise<void>;
  // CRUD completo para categorías, ingresos, presupuestos y fondos.
}
interface BackupService {
  exportAll(): Promise<Blob>;
  validateImport(input: unknown): Promise<BackupValidation>;
  restoreReplace(input: unknown): Promise<void>;
}
```

Los `domain/services` calculan presupuestos sin acceder a React ni a Dexie; cada operación de actualización que afecte a varias tablas se ejecuta en una transacción Dexie. No crear rutas `/api/*` ni dependencias Fastify en fase 1.

## 8. Navegación y UI

Navegación lateral/escritorio e inferior/móvil:
`Resumen`, `Ingresos`, `Gastos`, `Presupuestos`, `Ahorro`, `Menús`, `Supermercado`, `Despensa`, `Historial`, `Configuración`.

Dashboard: periodo elegido, ingresos previstos/reales, gastos fijos totales, desgloses por categoría desplegable, pagos pendientes, provisiones, presupuesto disponible para supermercado, ahorro objetivo y conseguido, distribución y alertas. Siempre indicar si las cifras son estimadas o reales.

Gastos: árbol de categorías expandible, subtotal por categoría, formularios para gasto individual (nombre, monto, periodicidad, meses activos, vencimiento, fijo/variable, notas), añadir/editar/eliminar con confirmación, visualización de fechas y futuro cargo estimado. Edición inline opcional; formularios con validación y errores claros.

Accesibilidad: contraste, etiquetas, navegación teclado, estados de loading y error, objetivos táctiles en móvil, confirmación antes de eliminar datos, formato locale es-ES.

## 9. Reglas de aceptación del MVP

1. Una instalación nueva arranca con datos de demostración **claramente identificados** y puede limpiarlos; no inventa gastos reales del usuario.
2. Crear categoría `Educación e hijos`, gastos `Comedor 130 €/mes` y `Extraescolares 75 €/mes` muestra subtotal 205 € y lo incluye una sola vez en el total fijo.
3. Cambiar comedor a 150 € actualiza subtotal a 225 €, total fijo, disponible y gráficas sin recargar.
4. Crear extraescolares solo septiembre-junio genera cargo 75 € en octubre y 0 € en julio.
5. Seguro 540 € anual pagado en marzo genera pago de caja 540 € en marzo y 0 € en abril; provisión opcional de 45 €/mes se muestra como reserva y no duplica el cargo.
6. Con ingresos 3000 €, obligaciones 1650 €, provisiones 150 €, ahorro meta 500 € y otros presupuestos 250 €, disponible sin asignar 450 €.
7. Un presupuesto deficitario muestra déficit negativo con alerta explícita y nunca lo etiqueta "ahorro".
8. Registrar un gasto real no modifica retrospectivamente la plantilla del gasto previsto.
9. Los movimientos, categorías, reglas y presupuestos se conservan al cerrar y reabrir la PWA (mismo origen/instalación), salvo eliminación de almacenamiento por usuario/sistema.
10. Todos los cálculos son en céntimos, reproducibles con unit tests; no errores de coma flotante.
11. Error de IndexedDB o cuota de almacenamiento muestra mensaje recuperable, nunca pantalla en blanco.
12. La app no necesita conexión a internet para completar el flujo financiero del MVP después de la primera carga/instalación.
13. La exportación y restauración JSON recuperan exactamente los datos tras vaciar una base de prueba, con confirmación y validación.
14. Una actualización de código o migración mantiene los datos del usuario; instalación desde Safari con manifest, iconos y modo standalone verificado.
15. El usuario puede modificar gastos y presupuestos desde el iPhone sin PC.

## 10. Estrategia de pruebas

- **Vitest:** dinero en céntimos, acumulados sin doble cómputo, recursividad de categorías, periodos, fechas 29/02 y 31, vigencia, regla septiembre-junio, seguro anual, déficit y provisiones.
- **Integración Dexie:** `fake-indexeddb` en tests; CRUD, actualización reactiva, migraciones, importación transaccional, rollback, copias de seguridad y datos demo opcionales.
- **Playwright:** crear/editar/eliminar categorías y gastos; cerrar y volver a abrir, conservar datos; descargar/importar backup; viewport iPhone; simular offline **tras cargar la app** y comprobar escritura/lectura (los tests de service worker deben ejecutar build/preview, no solo dev).
- **Dispositivo real:** Safari iOS añadir a inicio, cerrar/reabrir, modo avión, reinicio, actualizar versión publicada, descargar/compartir copia y restaurar.

## 11. Hoja de ruta

**Fase 1 — MVP financiero PWA:** dashboard mensual, categorías desplegables, gastos individuales y recurrencias, ingresos, presupuestos, provisiones, ahorro meta vs real, movimientos, persistencia IndexedDB, copias de seguridad JSON, manifest/service worker/offline, responsive iPhone, tests y guía de publicación estática. No catálogo Mercadona todavía.

**Fase 2 — Planificador alimentario:** perfiles de adultos/niños, alergias/preferencias, recetas y cantidades, calendario de 7/30 días, ingredientes consolidados, generación básica por reglas, edición móvil y datos de ejemplo claramente ficticios.

**Fase 3 — Mercadona y compra:** catálogo Mercadona importable CSV/JSON, edición manual y metadatos de fuente/fecha; equivalencias ingredientes-productos, despensa, envases completos, lista de compra por semanas, tickets/manuales, comparación coste previsto-real. Precios automáticos **solo con fuente legal/técnicamente verificada**; la app seguirá funcionando offline con datos ya guardados.

**Fase 4 — Optimización:** restricciones y minimización del coste de cesta con variedad razonable, simulaciones financieras, propuestas explicables, mejor manejo de copias cifradas opcionalmente, posible OCR local de tickets. IA local no obligatoria y no decide importes/alérgenos.

## 12. Estructura del repositorio

```text
balance-familiar/
├── src/
│   ├── app/                  # router, layout, providers
│   ├── features/
│   │   ├── dashboard/
│   │   ├── categories/
│   │   ├── expenses/
│   │   ├── income/
│   │   ├── budgets/
│   │   ├── savings/
│   │   ├── transactions/
│   │   ├── backup/
│   │   ├── meal-planning/    # fase 2
│   │   ├── catalog/          # fase 3
│   │   └── pantry/           # fase 3
│   ├── domain/               # lógica financiera y recurrencias puras
│   ├── db/                   # Dexie, esquemas/versiones, repositorios
│   ├── integrations/         # importadores Mercadona fase 3
│   ├── components/ui/
│   ├── lib/                  # dinero, fechas, utilidades
│   └── styles/
├── public/                   # iconos PWA, manifest servido por plugin
├── tests/                    # unitarios, integración, E2E
├── docs/                     # modelo, arquitectura, roadmap
├── index.html
├── vite.config.ts            # PWA y base de despliegue
├── package.json
├── playwright.config.ts
├── README.md
└── ESPECIFICACION_TECNICA.md
```

## 13. Comandos objetivo

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
npm run preview
```

`npm run dev` inicia Vite en PC para desarrollo. `build` genera solo ficheros estáticos en `dist/`; la producción no necesita Node. Si se usa GitHub Pages en subruta `/balance-familiar/`, configurar `base` y manifest `start_url/scope` coherentemente; publicar **solo `dist/`**, jamás datos del usuario o un JSON exportado. Verificar caché de nuevas versiones con aviso/recarga controlada.

## 14. Riesgos y medidas

- **Precios no actuales:** guardar procedencia, fecha y estado; nunca vender exactitud falsa.
- **Acceso no oficial Mercadona:** no acoplar la aplicación a endpoints no documentados; conector importable de inicio.
- **Menús inviables:** advertir déficit o restricción incompatible, no inventar solución.
- **Alérgenos:** restricciones duras y recordatorio de comprobar etiqueta.
- **Doble cómputo:** separar cargos, provisiones, asignaciones, transferencias y líneas de ticket.
- **Pérdida de datos locales:** riesgo real en iOS; exportación y restauración verificada, aviso de última copia, no prometer conservación indefinida.
- **Seguridad:** contenido estático HTTPS, CSP razonable, sin datos en Git ni servicios de telemetría; validar importaciones; no secretos hardcodeados.
- **Ampliación futura:** dominio y repositorios desacoplados para poder añadir sincronización sin obligarla ahora.
- **Actualización de PWA:** los cambios de código requieren nuevo despliegue; el trabajo diario y los cambios de datos, no.

## 15. Fuentes públicas contrastadas (14-11-2026)

- Mercadona, política de precios online y físicos: https://ayuda.tienda.mercadona.es/hc/es/articles/360000857491-Precios-de-los-productos-SPB
- Mercadona, selección de tienda online por código postal: https://www.mercadona.es/
- Ejemplo de catálogo comunitario no oficial: https://github.com/datania/mercadona-catalog
- Documentación PWA de Vite: https://vite-pwa-org.netlify.app/ ; Dexie: https://dexie.org/ ; soporte Safari de apps web: https://support.apple.com/guide/iphone/add-a-website-icon-to-your-home-screen-iph42ab2f3a7/ios

**Nota:** esta especificación no acredita derechos de uso de datos de terceros. Comprobar licencias, términos y permiso antes de integrar una fuente automática.
