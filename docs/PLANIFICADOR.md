# Planificador de comidas — fase 2

## Uso

En **Menús → Familia**, añade adultos y niños, raciones, comidas en casa, alergias y palabras que quieras evitar en recetas e ingredientes. Las raciones son decisiones del usuario, no recomendaciones nutricionales. Los perfiles pueden desactivarse temporalmente.

En **Ingredientes**, registra cada alimento en gramos, mililitros o unidades, con sus alérgenos declarados. Una unidad utilizada en recetas no se puede cambiar: crea otro ingrediente para evitar reinterpretar cantidades existentes.

En **Recetas**, indica las cantidades para todas las raciones de la receta, duración, método, comidas, pasos, sustituciones como notas, grupos de alimentos, alérgenos adicionales, coste estimado opcional y máximo de repeticiones por siete días.

En **Calendario**, crea un menú de 7, 30 o 31 días, elige platos manualmente o pulsa **Proponer platos**. Las propuestas solo rellenan huecos. La vista semanal recorre el menú completo; «Todo el menú» muestra todas las fechas. Editar un menú no permite dejar comidas fuera de sus nuevas fechas: hay que quitarlas antes. Eliminar el menú elimina también sus comidas, con confirmación.

El ejemplo se carga solo si el planificador está vacío, nunca automáticamente sobre datos personales. Contiene personas ficticias, nueve recetas y costes ficticios. Puede borrarse por separado, con confirmación. Los costes de las recetas de ejemplo siguen identificados como tales aunque se editen.

## Reglas y límites

- Los comensales son las personas activas que hacen esa comida en casa. Sus raciones se suman; no se reducen para abaratar el menú.
- Las alergias declaradas en recetas e ingredientes bloquean la asignación. Las preferencias son coincidencias de palabras en nombres, sin distinguir mayúsculas ni tildes; no se interpretan dietas desde lenguaje natural. Siempre hay que comprobar etiquetas y contaminación cruzada.
- Las recetas deben corresponder al tipo de comida y al tiempo máximo. El límite de repetición se aplica a cualquier ventana de siete días dentro del menú, incluyendo inserciones manuales anteriores a otras comidas.
- Cambiar una persona, ingrediente o receta puede hacer incompatible un plato ya guardado. El calendario lo señala; los datos se conservan para poder revisarlos. No se presenta como una nueva asignación válida.
- La generación prioriza recetas menos utilizadas y después menor coste conocido. Es una selección sencilla sin búsqueda exhaustiva: dejar huecos no demuestra que no exista otra combinación viable. Los motivos se muestran por fecha y comida.
- Un presupuesto es opcional. Con límite, el generador necesita costes conocidos para las comidas existentes y las nuevas, y no lo supera. Las asignaciones manuales pueden superar el límite; aparece un aviso. El presupuesto alimentario no crea movimientos ni altera el financiero.
- El coste es el coste indicado para toda la receta, multiplicado por raciones planificadas / raciones de la receta, redondeado hacia arriba a céntimos. Si falta algún coste, el total se etiqueta como parcial. No es un precio de supermercado ni una cesta de envases.
- Los ingredientes se consolidan por ID y unidad. Se suman cantidades proporcionales y se redondea hacia arriba al final. No se descuentan existencias ni se gestionan compras: eso corresponde a fase 3.

## Persistencia y copias

Dexie v3 añade `householdMembers`, `ingredients`, `recipes`, `recipeIngredients`, `mealPlans` y `mealEntries`, sin borrar ni transformar las tablas financieras existentes. El repositorio valida esquemas, unicidad y referencias, y escribe de forma atómica. Guardar una receta y sus ingredientes es una sola operación; borrar recetas utilizadas o ingredientes referenciados se bloquea.

Las copias v3 incluyen las 16 tablas. Las v2 se verifican contra el contenido original antes de añadir las seis tablas vacías. La vista previa normalizada puede volver a validarse al confirmar. Restaurar reemplaza todo el contenido, incluido el alimentario, con rollback ante fallos.

Todo funciona en el mismo navegador sin conexión tras cargar la PWA. No hay cuentas, sincronización, transmisión de perfiles ni precios externos.

## Verificación

Las pruebas de dominio cubren restricciones, costes incompletos, presupuesto, conservación de platos manuales, repeticiones retrospectivas, consolidación y calendarios de 30/31 días entre meses. Las pruebas de base de datos cubren migración v2, copias v2/v3 y referencias.

Los flujos de navegador cubren alta manual, generación, avisos por nuevas alergias, edición offline, recarga, exportación/restauración y anchuras 320/390/1440 en ambos temas, ejecutados contra el build con la subruta de GitHub Pages. La instalación y actualización en Safari de un iPhone físico requieren comprobación en ese dispositivo.
