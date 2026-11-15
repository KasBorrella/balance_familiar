# UX elegida

**Interfaz actualizada el 15 de noviembre de 2026:** verde intenso, acentos lima, reservas en violeta y gastos en naranja. Importes con mayor tamaño y peso, tarjetas diferenciadas y un indicador circular del porcentaje de ingresos previstos ya asignados. Navegación de seis destinos con Menús en la fase 2. Los colores de texto, superficies, controles, gráficos y avisos se definen mediante variables compartidas; no se utilizan filtros para simular el modo oscuro.

## Apariencia y textos

El botón de sol/luna de la cabecera cambia entre claro y oscuro. En **Más → Apariencia** se puede elegir **Claro**, **Oscuro** o **Según el dispositivo**. La preferencia se guarda en este navegador y se aplica antes de mostrar la interfaz. La opción del dispositivo sigue los cambios del sistema en tiempo real; una elección manual tiene prioridad. Las ventanas de edición, los gráficos, los selectores y los avisos respetan el tema.

La preferencia visual usa localStorage, independiente de los datos financieros de IndexedDB y de sus copias JSON. Se conserva al borrar la demostración o restaurar una copia. Si el navegador impide guardar preferencias, el cambio sigue funcionando durante la sesión y se muestra un aviso. No requiere conexión.

Textos en español de España, breves y descriptivos: «Resumen del mes», «Presupuesto mensual», «Cobrado y pagado», «Copias de seguridad». Se han eliminado los lemas motivacionales y las frases publicitarias. Se usan términos habituales como nómina, importe, recibo, coche y aportación, sin añadir coloquialismos forzados. «Día de cargo» para gastos y «Día de cobro» para ingresos. No se cambian los conceptos financieros de previsto, real, reserva y ahorro ni los nombres que haya introducido el usuario.

## Arquitectura de información

La fase 3 añade Compra en escritorio y el acceso «Lista de compra y despensa» desde Menús en móvil. La barra inferior conserva seis destinos. Compra agrupa Lista, Catálogo, Despensa y Compras; la importación muestra vista previa antes de guardar y el ticket se confirma antes de registrar gastos.

| Destino     | Tarea                                                          |
| ----------- | -------------------------------------------------------------- |
| Resumen     | Entender previsión, realidad, pagos y excesos del mes.         |
| Planificar  | Repartir ingresos, configurar gastos y consultar vencimientos. |
| Movimientos | Registrar y corregir lo que realmente ha ocurrido.             |
| Ahorro      | Construir objetivos y reservar para gastos futuros.            |
| Menús       | Organizar familia, recetas, calendario e ingredientes.         |
| Más         | Categorías, copias, instalación y almacenamiento.              |

El mes se conserva al navegar durante la sesión; al reabrir se muestra el mes actual. La navegación es inferior en móvil y lateral en escritorio. Los formularios se presentan como panel inferior móvil o diálogo de escritorio con foco controlado, Escape, etiquetas visibles y errores junto al campo.

## Jerarquía financiera

La tarjeta principal expresa «Sin asignar» o «Déficit del presupuesto» sobre previsiones. Las métricas reales están en otra sección. Los gráficos incluyen etiquetas y texto accesible con cifras, y no sustituyen a los importes escritos. El ahorro se denomina «transferido», y las provisiones «fondos para gastos futuros».

Los datos demo están señalizados de forma persistente. Empezar desde cero requiere confirmar su eliminación. Las importaciones muestran un resumen antes de reemplazar datos. Los avisos de error nunca presentan un guardado fallido como correcto.

## Interacciones

- Acción visible para registrar movimientos y botón accesible con el pulgar en móvil.
- Categorías desplegables con subtotales; cada concepto tiene edición y eliminación.
- Frecuencias en lenguaje cotidiano y selector táctil de meses, con atajo para curso escolar y previsualización del mes elegido.
- Registro de pagos desde el calendario, con concepto, importe y vencimiento preseleccionados.
- Las categorías nuevas se crean desde Planificar o Más. Una instalación vacía guía a crear una categoría antes de guardar gastos.
- Las nuevas versiones esperan una actualización explícita y no se aplican mientras hay un editor abierto.

## Accesibilidad

Navegación por teclado, enlace para saltar al contenido, formularios etiquetados, errores anunciados, foco visible, diálogo Radix con contención y restauración de foco, navegación con iconos y texto, información semántica de progreso y respeto por movimiento reducido. Los principales controles táctiles tienen 44 px o más; los textos y colores se revisan en los tamaños móvil/escritorio. La validación en VoiceOver y el ajuste de tamaño de texto de iOS forman parte de la comprobación manual pendiente.
