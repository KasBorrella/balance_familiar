# Compra y despensa — fase 3

## Acceso y recorrido

En móvil: **Menús → Lista de compra y despensa**. En escritorio también aparece **Compra** en la barra lateral. Las pestañas son Lista, Catálogo, Despensa y Compras.

1. Crea ingredientes, recetas y comidas en Menús.
2. En Catálogo, añade productos manualmente o importa un CSV/JSON. Revisa la etiqueta y vincula cada alimento a un ingrediente, indicando la cantidad aprovechable por envase.
3. Añade a Despensa los lotes que ya tengas. La cantidad se expresa en la unidad del ingrediente.
4. Prepara una lista de hasta siete días. La app reserva existencias y calcula envases completos para cubrir lo que falta. Puedes añadir higiene y limpieza por separado.
5. En Registrar ticket, revisa cantidad total aprovechable, envases, importes reales y caducidades. Elige la categoría de gasto de cada grupo y confirma.
6. Cuando hayas consumido los ingredientes del menú, pulsa Anotar consumo. Se descuenta una sola vez; los sobrantes quedan disponibles.

## Catálogo y precios

No hay conexión con Mercadona, scraping, pedidos ni precios en tiempo real. El proveedor inicial admite archivos propios o de fuentes que el usuario pueda utilizar. Los precios se guardan como observaciones independientes con fecha, fuente, tienda/zona, moneda EUR y estado de verificación. Una importación no verifica el precio; una entrada manual indica una comprobación del usuario.

El aviso de antigüedad es configurable entre 1 y 365 días, inicialmente 14. Los precios antiguos pueden usarse, pero la lista se identifica como estimada y muestra el aviso. Los precios ficticios están excluidos por defecto. No se proporciona un catálogo de precios inventados.

Los productos pueden archivarse sin borrar precios ni historial. Para modificar el tamaño, unidad o grupo de un producto utilizado, crea una referencia nueva. Un alimento puede tener varios productos equivalentes; cada producto se vincula a un solo ingrediente para evitar contar dos veces su contenido. La cantidad aprovechable no puede superar el contenido del envase. No se convierten gramos a mililitros ni se adivinan sustituciones.

## CSV/JSON

La interfaz permite descargar una plantilla vacía. Admite CSV separado por coma o punto y coma, BOM, campos entre comillas y saltos de línea dentro de esos campos. El JSON debe ser una matriz de objetos. Límites: 5 MB y 5.000 productos.

| Campo             | Contenido                                                                     |
| ----------------- | ----------------------------------------------------------------------------- |
| `sku`             | Referencia única dentro del supermercado.                                     |
| `name`            | Nombre del producto.                                                          |
| `packageQuantity` | Contenido entero del envase en la unidad elegida.                             |
| `unit`            | `g`, `ml` o `ud`.                                                             |
| `group`           | `food`, `hygiene` o `cleaning`; por defecto `food`.                           |
| `priceCents`      | Precio entero en céntimos; por ejemplo 150 equivale a 1,50 €.                 |
| `observedAt`      | Fecha real AAAA-MM-DD, no futura.                                             |
| `sourceReference` | Procedencia del precio.                                                       |
| `storeContext`    | Tienda o zona de referencia.                                                  |
| `variableWeight`  | `true` o `false`; por defecto `false`.                                        |
| `allergens`       | CSV: valores separados por `\|`. JSON: matriz de valores. Por defecto vacío.  |
| `labelChecked`    | `true` solo si has revisado los ingredientes y etiqueta; por defecto `false`. |

Valores de alérgenos: gluten, crustáceos, huevo, pescado, cacahuetes, soja, leche, frutos de cáscara, apio, mostaza, sésamo, sulfitos, altramuces y moluscos. Etiqueta vacía no acredita ausencia de contaminación cruzada. La lista automática exige etiqueta revisada y excluye los productos que contradigan las restricciones actuales.

Se pueden relacionar cabeceras diferentes con los campos de destino. La vista previa muestra recuentos, productos y errores por fila. No se importa nada si existen errores. Confirmar escribe productos, observaciones y registro de importación en una transacción. Reimportar el mismo contenido normalizado se bloquea por checksum. Una referencia existente conserva su identidad y añade el nuevo precio; no borra los anteriores.

## Envases y despensa

La demanda suma los ingredientes de las comidas seleccionadas, ajustados a raciones. Para calcular la cesta se resta stock libre y utilizable. Se reservan primero los lotes de menor caducidad que duren **hasta el último día de la lista** y que no estén ya caducados. Esta regla es conservadora: un lote que caduque a mitad de semana queda fuera, aunque pudiera usarse en los primeros días. Los lotes sin fecha se incluyen y se muestran como sin fecha; la app no determina su estado.

Las reservas no descuentan cantidades, pero impiden que dos listas pendientes utilicen el mismo stock. Una comida solo puede pertenecer a una lista. Eliminar un borrador libera sus reservas. Recalcular actualiza necesidades, reservas y precios alimentarios; conserva los extras de higiene y limpieza. Si faltan equivalencias, etiquetas o precios, la lista queda incompleta y no permite confirmar el ticket.

La selección de formatos minimiza el coste total y, a igualdad de coste, el exceso de cantidad. El cálculo exacto usa cantidades enteras y un máximo de 100.000 estados y 100 formatos por ingrediente; ante cantidades desproporcionadas pide dividir la lista en lugar de bloquear la interfaz o inventar una solución. No optimiza el menú: eso queda para fase 4.

Los productos de peso variable siguen siendo estimaciones. En el ticket se introduce la cantidad real aprovechable del conjunto de envases y el importe total de esa línea. Si la cantidad comprada no cubre las necesidades, el consumo se bloquea sin descontar parcialmente ningún lote.

## Ticket y presupuesto

La lista conserva una instantánea de sus cantidades y precios. Muestra coste previsto, límite opcional de la lista, total real y diferencia. El límite de compra es independiente del coste estimado de recetas; no modifica el presupuesto financiero automáticamente.

Confirmar el ticket crea sus líneas, añade alimentos a despensa y registra un gasto por grupo con importe distinto de cero: alimentación, higiene y limpieza. No añade un segundo gasto por el total del ticket. Los gastos participan en el resumen financiero habitual y en los límites por categoría del mes.

Antes de confirmar, revisa todas las líneas. En esta fase se registra el ticket completo de la lista: no hay compras parciales, devoluciones ni edición posterior del ticket. Los tickets confirmados se conservan; la validación impide eliminar sus movimientos o cambiar su importe/fecha dejando el ticket descuadrado. Para corregir una captura antes de confirmar, edita el formulario; para recuperar un estado anterior, utiliza una copia previa. No se realiza OCR.

El consumo se confirma por la lista semanal completa. La escritura es atómica: si falta cantidad utilizable, no descuenta nada. Se respetan reservas de otras listas, caducidades y restricciones vigentes; no se permite consumir dos veces. El descuento manual de un lote solo utiliza cantidad libre. Higiene y limpieza no forman parte de la despensa alimentaria.

## Datos y compatibilidad

Dexie v4 añade diez tablas: supermercados, productos, equivalencias, observaciones de precio, lotes, listas, líneas de lista, compras, líneas de compra e importaciones. Se conservan las dieciséis tablas anteriores. Las copias v4 incluyen todo; las v2 y v3 se verifican primero y se migran con las tablas nuevas vacías. Restaurar sustituye todos los datos, con confirmación y rollback.

No se transmite ningún catálogo, ticket, menú ni dato financiero. La funcionalidad trabaja sin conexión después de cargar la PWA. La comprobación automatizada usa Chromium con viewport móvil; Safari en iPhone físico sigue siendo una comprobación pendiente.
