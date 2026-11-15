# Publicación estática e instalación en iPhone

## Preparar GitHub Pages

El repositorio actual es `KasBorrella/balance_familiar`. Se incluye `.github/workflows/deploy-pages.yml`, que compila y publica únicamente `dist/` al subir cambios a `main` o al ejecutarlo manualmente.

1. En GitHub, abre **Settings → Pages → Build and deployment → Source** y selecciona **GitHub Actions**.
2. Sube el archivo del workflow al repositorio.
3. En **Actions**, espera a que termine **Publicar en GitHub Pages**. Si ya estaba subido antes de cambiar Source, ejecútalo con **Run workflow**.
4. Abre `https://kasborrella.github.io/balance_familiar/`.

El workflow obtiene la subruta de la configuración de Pages y se la pasa a Vite. Así, también se adaptan el manifest, los iconos y el service worker. No hay que subir `dist` al repositorio: Actions lo genera y publica como artefacto.

Si se publica directamente la raíz de `main`, Pages sirve el `index.html` de desarrollo: contiene `/src/main.tsx` y `%BASE_URL%`, y el navegador no puede arrancar la aplicación. Este fue el motivo de la pantalla en blanco comprobada el 15 de noviembre de 2026.

## Compilación manual alternativa

El hosting sirve código, estilos, iconos y service worker. No necesita Node en producción, ordenador encendido, cuenta dentro de la aplicación, API ni base de datos remota.

1. Crea o utiliza un repositorio para el **código** del proyecto. No incluyas copias JSON ni datos privados.
2. Para Pages de este repositorio, `balance_familiar`, compila desde PowerShell:

```powershell
npm ci
$env:VITE_BASE_PATH = '/balance_familiar/'
npm run build
Remove-Item Env:VITE_BASE_PATH
```

Usa el nombre exacto de la subruta, incluyendo guiones o guiones bajos. Para dominio propio en raíz, usa `/` (valor predeterminado). Vite y el manifest comparten el mismo `base`, `start_url` y `scope`; los iconos se resuelven desde el manifest. El enrutador usa hash (`/#/planificar`) para funcionar en Pages sin reglas de reescritura.

3. Publica **el contenido generado en `dist/`**, mediante un workflow de GitHub Pages o una rama dedicada. No publiques la carpeta completa de trabajo como artefacto de Pages. Si usas una rama, añade `.nojekyll` junto a `index.html`.
4. En Pages activa HTTPS y abre la URL publicada. Comprueba en las herramientas del navegador que `manifest.webmanifest`, iconos y `sw.js` responden correctamente bajo esa subruta.

El workflow incluido realiza la instalación, comprobación de tipos, lint, pruebas y compilación antes de publicar. No necesita secretos financieros ni credenciales de la aplicación.

## Uso en iPhone

1. Abre la URL HTTPS publicada en Safari con conexión.
2. Usa Compartir → Añadir a pantalla de inicio (la ubicación exacta puede variar según iOS).
3. Abre desde el icono. Espera a completar la primera carga antes de desconectar.
4. Haz una copia inicial en Más. Guarda el archivo en Archivos o iCloud Drive.
5. Activa modo avión y verifica consulta, edición, cierre y reapertura. No necesitas mantener el PC encendido.

No utilices navegación privada para guardar datos duraderos. Cada navegador y origen conserva sus propios datos. Safari y la PWA pueden usar almacenamiento separado según la versión de iOS: valida la instalación y restaura una copia cuando sea necesario. No se promete conservación permanente.

## Actualizaciones y caché

Publica el nuevo `dist/` en la **misma dirección**. El service worker prepara una versión nueva y muestra un aviso. Al pulsar Actualizar se activa; no se borra IndexedDB. No hagas recargas forzadas durante formularios ni borres los datos del sitio para actualizar. Las migraciones de esquema deben ser aditivas y probarse con bases anteriores.

El precaché incluye todos los fragmentos de código, estilos e iconos. La navegación vuelve a `index.html` dentro de la subruta. `offline.html` es un recurso de ayuda precacheado; el flujo normal offline carga la propia aplicación. No hay caché de endpoints financieros: no existen esos endpoints.

Cambiar de dominio, protocolo o puerto cambia el origen y puede hacer que aparezca una base nueva. Antes de cambiar de dirección, exporta y restaura en la nueva. Un cambio de subruta en el mismo origen requiere revisar alcance de service worker y cachés previas; conserva copia y no asumas una migración automática de instalación.

## Seguridad y privacidad

Todos los activos principales son locales; no se incluyen CDN, analítica ni telemetría. El build incorpora una CSP que restringe scripts, conexiones y fuentes al propio origen; los estilos inline se permiten para los gráficos. GitHub Pages no recibe la base de datos. Las copias no están cifradas: guárdalas en un destino privado y no las adjuntes a issues ni las añadas a Git.
