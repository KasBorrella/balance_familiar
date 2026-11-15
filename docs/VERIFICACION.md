# Verificación

## Barra inferior móvil — 15 de noviembre de 2026

La pantalla móvil usa un contenedor de altura `100dvh` con navegación inferior fuera de la zona desplazable. Solo `.main-shell` hace scroll; al cambiar de sección se devuelve ese contenedor al inicio. Se conserva el margen seguro inferior del iPhone. En escritorio se mantiene el scroll de la ventana.

TypeScript, ESLint y build correctos; 10 E2E aprobados. La prueba añadida comprueba inicio, mitad y final del contenido, alturas de ventana de 680/844/900 px, cambio de sección, apertura/cierre de un diálogo y vuelta a escritorio. El comportamiento original no se reprodujo en Chromium; el cambio evita depender del posicionamiento fijo durante el scroll del documento. Pendiente confirmar el resultado en el iPhone donde se observó el fallo.

## Fase 3 — 15 de noviembre de 2026

- TypeScript estricto, ESLint y compilación con `/balance_familiar/`: correctos.
- 52 pruebas de dominio e IndexedDB aprobadas, incluidas selección exacta de formatos comparada con búsqueda exhaustiva, importación CSV/JSON, errores por fila, atomicidad, reservas, caducidades, alergias, tickets y consumo único.
- 9 recorridos E2E aprobados con service worker real. El nuevo recorrido crea un menú, rechaza un catálogo duplicado, importa el corregido, vincula un ingrediente, reserva un lote, registra el ticket sin conexión, anota consumo, conserva sobrantes y restaura una copia.
- Se verifica un solo movimiento financiero para el ticket alimentario y un aviso al superar el límite de compra. Se mantienen los ocho recorridos anteriores.
- Vistas Lista/Catálogo/Despensa/Compras comprobadas sin desbordamiento en 320, 390 y 1440 px, en claro y oscuro. Capturas en `test-results/compra-*.png`.
- Migración Dexie v3 → v4 y lectura de copias v2/v3/v4. Sin consulta externa de precios ni despliegue de la rama. Safari en iPhone físico sigue pendiente.

Funcionamiento y límites de esta fase: [COMPRA.md](COMPRA.md).

## Fase 2 — 15 de noviembre de 2026

- TypeScript, lint y compilación para `/balance_familiar/`: correctos.
- 42 pruebas de dominio e IndexedDB aprobadas: incluyen restricciones alimentarias, raciones, costes parciales, repeticiones, calendarios y migración desde v2 sin pérdida financiera.
- 8 pruebas E2E aprobadas contra el build con service worker y la subruta de GitHub Pages. Los seis recorridos financieros y de apariencia anteriores siguen funcionando.
- Alta manual de familia, ingredientes y recetas; menú de 31 días; generación semanal; avisos tras cambiar alergias; bloqueo de asignaciones incompatibles; edición y recarga offline; copia completa, vaciado del planificador y restauración.
- Comprobación de anchuras 320/390/1440 en claro y oscuro. Capturas generadas en `test-results/menus-*.png` (no se versionan).
- Sigue pendiente la instalación y actualización en Safari de un iPhone físico. No se ha publicado esta rama.

Guía funcional y límites: [PLANIFICADOR.md](PLANIFICADOR.md).

## Actualización visual — 15 de noviembre de 2026

Modo claro, oscuro y según el dispositivo; preferencia guardada localmente; revisión de textos en español de España; nuevos colores, jerarquía visual y porcentaje del presupuesto asignado.

- TypeScript estricto, lint y build: correctos.
- 31 pruebas de dominio/IndexedDB y 6 pruebas E2E aprobadas sobre el build con service worker.
- La elección manual de tema se conserva tras recargar y tiene prioridad sobre el sistema. El modo automático responde a los cambios del dispositivo. Dos pestañas comparten la preferencia.
- Se ha probado la reapertura sin conexión con tema oscuro y el guardado de un gasto desde un diálogo y campos oscuros.
- Capturas revisadas de ambos temas en móvil (390 px) y escritorio (1440 px), y comprobación de anchura mínima de 320 px sin desbordamiento horizontal. Se han recorrido todas las secciones en móvil con ambos temas.
- La configuración visual usa localStorage; no modifica los datos financieros ni necesita migrar IndexedDB. Sigue pendiente la comprobación en Safari de un iPhone físico.

Los resultados que siguen corresponden a la entrega inicial.

Fecha de trabajo: 14 de noviembre de 2026. Entorno: Windows, PowerShell, Node 24.12, Chromium disponible localmente, viewport iPhone 13 y escritorio 1440 px.

## Automatización

Las pruebas de navegador se ejecutan contra `vite preview` con el build y service worker, usando datos ficticios en contextos de navegador aislados.

| Comprobación                                  | Resultado                                              |
| --------------------------------------------- | ------------------------------------------------------ |
| `npm install`                                 | Completado; dependencias fijadas en package-lock.json. |
| `npm run typecheck`                           | Correcto, TypeScript estricto.                         |
| `npm run lint`                                | Correcto.                                              |
| `npm run test`                                | 31 pruebas aprobadas en 3 archivos.                    |
| `npm run build`                               | Build estático y service worker generados.             |
| Build con `VITE_BASE_PATH=/balance-familiar/` | Correcto, 19 recursos precacheados (~1,04 MiB).        |
| Playwright sobre el build final en `/`        | 4 pruebas aprobadas.                                   |
| Playwright bajo `/balance-familiar/`          | 4 pruebas aprobadas.                                   |
| `npm audit --omit=dev`                        | 0 vulnerabilidades.                                    |

Casos comprobados: céntimos y entradas inválidas; meses activos; inicio/fin; años bisiestos; días 31; semanas y cambios de año; anual/trimestral/único; jerarquía sin duplicados; 205 → 225; julio sin extraescolares; 450 sin asignar; déficit negativo; cobertura parcial de provisiones; clasificación histórica de gastos; límites variables por categoría; CRUD y reapertura de IndexedDB; demo que no reaparece tras limpiar; migración v1 → v2; relaciones inválidas; pagos/consumo de fondo atómicos; rollback por error simulado; exportación/restauración exacta; checksum, duplicados y versiones inválidas.

En Chromium móvil: crear/editar gastos, selección mensual, recarga, exportar archivo, vaciar y restaurar, búsqueda/eliminación de movimientos, déficit, fondos/aportaciones/pago único y ahorro. La prueba offline espera a que el service worker controle la página, corta la red, recarga, edita y abre otra ventana sin conexión para verificar el valor guardado. Se han inspeccionado capturas móviles y de escritorio; no se detectó desbordamiento horizontal en el recorrido probado.

Las herramientas de compilación y Chromium necesitaron ejecución fuera del sandbox de Windows por restricciones de lectura/lanzamiento. Se usó el Chromium ya instalado mediante `PLAYWRIGHT_EXECUTABLE_PATH`, sin instalar otro navegador.

## Lista manual pendiente: Safari en un iPhone real

- [ ] Publicar en HTTPS e instalar desde Compartir → Añadir a pantalla de inicio.
- [ ] Verificar icono, apertura standalone, teclado de importes, áreas seguras y navegación inferior.
- [ ] Terminar primera carga; activar modo avión; consultar y editar gastos; cerrar y reabrir desde el icono.
- [ ] Reiniciar el teléfono y comprobar persistencia.
- [ ] Exportar a Archivos/iCloud Drive, comprobar el archivo guardado, vaciar datos de prueba y restaurar.
- [ ] Cancelar compartir y restaurar: conservar datos e indicadores anteriores.
- [ ] Desplegar una versión nueva en la misma dirección; aceptar actualización y comprobar datos.
- [ ] Probar VoiceOver, ampliación de texto, contraste percibido y foco de formularios.
- [ ] Probar cuota agotada o almacenamiento denegado: mensaje recuperable, sin borrado automático.

La emulación móvil de Chromium no sustituye a Safari, a un dispositivo físico ni a su diálogo nativo de compartir. No se declara la instalación iOS validada sin hacer estas pruebas.

## Límites conocidos

- No hay sincronización, cuentas, conexión bancaria, cifrado de copias ni integración Mercadona. Son decisiones de alcance.
- Reglas y planes recalculan previsiones al editar; los movimientos reales conservan sus datos. No hay versiones históricas de presupuestos ni cierre contable inmutable.
- Los fondos y objetivos muestran saldos acumulados de todos los meses; la selección mensual limita presupuestos y movimientos.
- Compartir/descargar depende del navegador. La fecha de copia no garantiza que el archivo se conserve.
- Una instalación usa una base por origen; varias apps bajo el mismo origen y el mismo nombre de base compartirían almacenamiento. Este MVP asume una única instalación familiar.
- Los cambios se validan y escriben en transacciones completas; está dimensionado para uso doméstico, no para volúmenes empresariales.
- Auditoría de producción: `npm audit --omit=dev` informa **0 vulnerabilidades**. La auditoría completa conserva **12 avisos transitivos de herramientas de desarrollo** (2 bajos y 10 moderados, en Workbox/glob/deepmerge/minimatch y ESLint). Las actualizaciones compatibles disponibles no los eliminan; no se han forzado versiones transitivas incompatibles. No hay avisos altos ni críticos en el resultado final.
- El build puede emitir avisos de anotaciones de optimización en comentarios de Zod; Rollup los elimina y compila correctamente.
