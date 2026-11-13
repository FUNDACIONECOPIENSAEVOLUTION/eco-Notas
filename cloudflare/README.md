# Eco-Notas · Cloudflare Workers + D1 (Free)

Esta carpeta incluye la API de sincronización para PC y celular sobre Cloudflare Workers + D1. No ejecuta Java; el servidor Java permanece como alternativa. **El código no se despliega automáticamente en tu cuenta sin autorización.**

## Instalación en tu cuenta

Necesitas Node.js 20+, una cuenta Cloudflare y permisos para Workers y D1. Desde la carpeta cloudflare:

~~~bash
cd cloudflare
npx wrangler@latest login
npx wrangler@latest d1 create eco-notas-db
~~~

El comando devuelve un identificador de base de datos. Edita el archivo **wrangler.toml** y sustituye **REPLACE_WITH_ACTUAL_D1_DATABASE_ID** por el ID recibido. El binding debe llamarse **DB**.

~~~bash
npx wrangler@latest d1 execute eco-notas-db --remote --file=./schema.sql
npx wrangler@latest secret put ECONOTAS_PASSWORD
npx wrangler@latest deploy
~~~

El comando de secreto solicita la contraseña sin tener que guardarla en GitHub. No compartas la contraseña en el chat. El despliegue devuelve la URL real del Worker, bajo HTTPS. Comprueba la ruta **/api/health**.

## Conectar Eco-Notas

1. Abre https://fundacionecopiensaevolution.github.io/eco-Notas/ en el PC.
2. En **7. Nube**, introduce la URL HTTPS real del Worker, el usuario **docente** y tu contraseña de Cloudflare Workers Secret.
3. Pulsa **Conectar y descargar**. Si no hay datos aún, pulsa **Guardar mis datos en la nube**.
4. Abre la misma web en el celular, elige **Escanear y calificar** y entra en **Conectar sincronización**. Conecta el mismo Worker y descarga estudiantes y exámenes.
5. Escanea la hoja. El programa indicará nombre, nota final o revisión pendiente. La siguiente hoja puede escanearse sin tomar una foto manualmente.

La sincronización utiliza **ETag e If-Match**. Si dos dispositivos tienen versiones distintas, el servidor devuelve un conflicto; no se sobrescriben los cambios automáticamente.

## Pruebas y límites

~~~bash
node --check cloudflare/worker.mjs
node tests/cloudflare.mjs
~~~

Para las primeras pruebas usa datos ficticios. La versión inicial guarda un JSON por servidor: admite una sola cuenta de docente, no incluye roles ni auditoría institucional y limita el estado a **1,5 MB**. No se debe usar aún con datos personales reales de menores sin controles de privacidad, autenticación individual, copia de seguridad, recuperación y auditoría. No guardes claves correctas ni expedientes reales en GitHub.

Cloudflare Free está sujeto a límites diarios, entre otros. Documentación oficial:

- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/get-started/
