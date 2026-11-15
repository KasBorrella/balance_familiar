# Modelo y decisiones de fase 1

## Dinero y calendarios

Todos los importes se guardan como enteros en céntimos. El formulario interpreta `130,50` o `130.50` mediante componentes enteros, sin multiplicar un decimal binario. Se rechazan separadores de miles, exponentes, más de dos decimales e importes fuera del límite. Los decimales usados en gráficos y porcentajes son solo de presentación.

Fechas de calendario `YYYY-MM-DD`; periodo `YYYY-MM`; instantes técnicos UTC. El día actual se obtiene en Europe/Madrid. La aritmética de fechas usa UTC a mediodía para evitar cambios por horario de verano.

- Mensual: día de cobro, ajustado al último día si el mes es más corto.
- Semanal: cada siete días desde la fecha inicial, con cuatro o cinco cargos según el mes.
- Trimestral/anual: meses anclados al mes de inicio; día de cobro ajustado.
- Única: fecha inicial exacta.
- Meses seleccionados: un cargo en cada mes elegido; también se permite restringir los meses activos de otras frecuencias.
- Inicio y fin son inclusivos. Los meses activos no sustituyen a la vigencia.

## Tres vistas separadas

1. **Plan:** ingresos previstos menos obligaciones sin cobertura, presupuestos variables, aportaciones previstas a fondos y meta mensual de ahorro. El resultado puede ser negativo; nunca es ahorro real.
2. **Caja:** ingresos realmente cobrados menos gastos pagados. El saldo de caja suma el saldo inicial introducido. Es caja global, incluyendo el dinero que pertenece a fondos/ahorro; no es dinero libre para gastar y no descuenta compromisos futuros.
3. **Reservas y ahorro:** saldo de cada fondo y transferencias netas de ahorro. Las reservas previstas no alteran saldos reales.

Las asignaciones por categoría son **variables**. Los compromisos fijos se asignan por su calendario y no se suman otra vez en un límite de categoría. No se permiten límites simultáneos en un padre y sus descendientes, ni límites duplicados para la misma categoría/mes. Las reglas variables sin límite se incluyen en la previsión presupuestaria por su importe. Los excesos de las reglas variables sobre un límite se muestran como alerta; la previsión de salida de caja incorpora esos excesos por categoría.

El subtotal de una categoría recorre sus conceptos descendientes una sola vez, sin sumar de nuevo los subtotales hijos. El total fijo incluye únicamente los conceptos fijos aplicables al mes; el subtotal de una categoría muestra todos sus conceptos previstos.

## Provisiones

Un fondo tiene importe objetivo, reserva mensual prevista, inicio, vencimiento y estado. La reserva mensual es configurable; no se crea una aportación automáticamente ni se presume que exista el dinero. Las aportaciones y retiradas reales son entradas del fondo.

Un gasto fijo puede vincularse a un fondo. La cobertura prevista del mes utiliza el saldo **anterior al mes** más la aportación planificada del mes. Se reparte cronológicamente entre vencimientos sin superar ese saldo. La parte no cubierta sigue asignándose a ingresos del mes. Los fondos inactivos no reciben aportaciones previstas, pero su saldo existente puede cubrir obligaciones. La previsión asume que la aportación de ese mes estará disponible; al registrar un pago se exige saldo real suficiente en esa fecha.

Al pagar con un fondo se registra un único gasto y una salida de fondo vinculada al movimiento en la misma transacción. Editar o borrar ese gasto actualiza/revierte su salida de fondo. Las salidas no pueden causar saldo negativo, ni siquiera en fechas anteriores al saldo actual. Los pagos de fondo se editan desde Movimientos; las aportaciones/retiradas se editan desde el fondo.

## Ahorro

La meta mensual es una asignación. El progreso real suma transferencias a ahorro menos retiradas, con objetivo opcional. No se infiere ahorro de los ingresos no gastados. Las transferencias no son ingresos ni gastos nuevos. El progreso de un objetivo y el saldo de un fondo son acumulados de todos los meses, etiquetados así en la interfaz; el resumen muestra movimientos del mes seleccionado.

## Historial y relaciones

Editar una regla recalcula sus previsiones, pero no modifica movimientos existentes. Los movimientos guardan importe, fecha, concepto, categoría y clasificación fijo/variable propia; el vínculo a una regla es una ayuda, no una instrucción para reescribir el historial. Borrar una regla desvincula los movimientos, conservando su información. Borrar categorías, fondos u objetivos con referencias se bloquea hasta resolverlas.

Los vencimientos pagados se identifican por `expenseRuleId` + `occurrenceDate`, permitiendo pagos parciales y pagos registrados en otro mes. El usuario elige explícitamente el vencimiento al vincular un gasto.

## Persistencia

Diez tablas: settings, categories, incomeRules, expenseRules, monthlyBudgets, budgetAllocations, transactions, sinkingFunds, fundEntries y savingsGoals. UUID para identidades, periodo como clave de presupuesto, clave textual para settings. Índices por fecha, periodo, categoría, regla, fondo y objetivo.

La versión 2 añade índices y migra vínculos de ingresos, vencimientos y clasificación de movimientos existentes. No elimina bases antiguas. El repositorio trabaja con instantáneas consistentes y valida el conjunto de relaciones antes de cada escritura. En este MVP doméstico las mutaciones reescriben las tablas dentro de una transacción; una futura optimización puede limitarse a filas cambiadas sin alterar el contrato del dominio. No está pensado para millones de movimientos.

Zod y las validaciones de dominio comprueban tipos, céntimos enteros, fechas reales, unicidad, referencias, ciclos, profundidad, límites solapados y saldos de fondos. Se usan transacciones Dexie, no claves foráneas SQL. La inicialización nunca reemplaza una base existente por datos demo.

## Backup

Formato 2: `{schemaVersion, exportedAt, appVersion, data, checksum}`. Checksum SHA-256 sobre la representación canónica del resto del sobre. Protege frente a corrupción accidental, no demuestra autoría ni cifra información. La importación actual solo acepta formato 2; versiones desconocidas se rechazan sin mutaciones. Tamaño máximo de archivo: 20 MB.

Las copias contienen el modo demo y sus indicadores originales. La restauración reproduce los datos exactamente y no cambia silenciosamente ejemplos a datos personales. `lastBackup` se actualiza después de solicitar la descarga/compartición; el navegador no permite verificar que el usuario retenga el archivo.
