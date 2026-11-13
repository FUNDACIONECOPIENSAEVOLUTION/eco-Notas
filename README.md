# 🌿 Eco-Notas Pro — exámenes en papel con calificación desde celular

**Proyecto de Fundación Ecopiensa Evolution.** Aplicación web para docentes: crea exámenes, importa estudiantes, imprime cuestionarios barajados por estudiante, detecta códigos QR desde la cámara y califica casillas mediante OMR. Incluye OCR para respuestas cortas impresas, revisión docente para escritura manuscrita y libro anual por materia.

Repositorio: https://github.com/FUNDACIONECOPIENSAEVOLUTION/eco-Notas

## Uso rápido

1. **Cursos:** crea el grupo (por ejemplo, 7-A). Agrega alumnos o importa un archivo **.xlsx**, **.csv** o **.docx** con tabla Código | Nombre | Apellidos | Curso. El código institucional es opcional: sin él, Eco-Notas asigna un código generado. Si un código ya existe con el mismo nombre, el sistema actualiza la vinculación de curso sin crear un duplicado.
2. **Exámenes:** pulsa Nuevo examen, indica materia, título, curso, año y fecha. Admite selección única, selección múltiple, verdadero/falso, opciones sobre imagen con zonas previamente etiquetadas, respuesta corta, respuesta abierta y relación de columnas.
3. **Preguntas con imagen:** carga una imagen (JPG/PNG/WEBP) y escribe el enunciado. Ejemplo: **«What is in the picture?»** con imagen de manzana y respuesta corta esperada «apple; an apple». El programa no inventa la respuesta al analizar la imagen: el docente configura la clave.
4. **Puntuación:** sin pesos, cada pregunta aporta **5 ÷ número de preguntas**. Con pesos, las preguntas con valor personalizado usan ese peso; las que queden sin él equivalen a peso 1 y se normaliza la suma a una escala final de 0 a 5.
5. **Imprimir:** entra en Imprimir, elige un examen y pulsa Imprimir. El sistema crea la hoja de preguntas de cada alumno más hojas de marcas y respuestas escritas con QR. Imprime en **A4, 100% de escala y sin márgenes añadidos**.
6. **Escanear:** abre Eco-Notas desde **HTTPS**, importa en ese dispositivo la copia de datos que contiene las versiones de examen y activa la cámara. Muestra la **hoja de respuestas completa**, incluyendo QR y las **cuatro marcas negras** de sus esquinas. El navegador captura el fotograma automáticamente; **no hace falta pulsar para tomar fotos**.
7. **Revisar:** las marcas ambiguas, preguntas abiertas y respuestas manuscritas dudosas quedan pendientes. El docente puede asignar crédito 0, 0.5 o 1 (o cualquier valor entre 0 y 1). Una nota incompleta **no se publica como definitiva**.
8. **Calificaciones:** filtra por curso, materia y año. La misma tabla muestra un alumno por fila y **una columna diferente por cada quiz, parcial o evaluación**. Exporta a **Excel .xlsx** (incluye hoja de detalle) o CSV.

## Importante: PC y celular

Hay **dos modos**: uso local sin servidor y uso sincronizado con el **servidor Java 21** incluido en `backend/`.

- **Modo local:** los datos se almacenan en el navegador. Para pasar del PC al celular exporta una copia JSON en **Datos**, transfiérela de forma privada, impórtala en el otro equipo y trae la copia actualizada de vuelta. Al importar se **reemplazan** los datos anteriores; haz siempre una copia previa.
- **Modo Java (opcional):** una vez que el administrador despliegue el servicio privado con HTTPS, abre **7. Nube Java**, introduce su URL, usuario y contraseña, y pulsa **Conectar y descargar**. Tras conectarte, las ediciones se enviarán automáticamente al servidor. En el segundo equipo inicia sesión y descarga la misma información. La contraseña se mantiene solo en la memoria del navegador y se vuelve a pedir después de recargar la página.
- Si dos equipos editan datos simultáneamente y uno intenta sobrescribir los cambios del otro, el servidor devuelve un **conflicto 409** y la sincronización se detiene. Exporta una copia JSON antes de descargar o fusionar datos manualmente. **No hay combinación automática** de cambios concurrentes.

**El repositorio público solo incluye código.** Nunca hagas commit de nombres, notas, respuestas reales, respaldos JSON, fotografías de estudiantes ni listados.


## Servidor Java 21 · instalación y pruebas

El backend es un servicio pequeño **sin dependencias externas** basado en el servidor HTTP incluido en el JDK. Guarda un único documento JSON por instancia, separado del repositorio, con control de versiones **ETag / If-Match**, y autentica al docente mediante HTTP Basic.

> **Importante:** solo usar HTTP Basic a través de HTTPS. En equipos de producción debe colocarse tras un proxy TLS confiable. El servidor Java, a diferencia de los archivos de GitHub Pages, no se ejecuta gratuitamente dentro de GitHub Pages.

### Ejecutar localmente

Instala Java 21 y en la raíz del repositorio ejecuta:

\`\`\`bash
javac backend/EcoNotasServer.java backend/EcoNotasServerTest.java
java -cp backend EcoNotasServerTest
\`\`\`

Para probar el servicio en Linux o macOS:

\`\`\`bash
export ECONOTAS_USER=docente
export ECONOTAS_PASSWORD='CAMBIA_ESTO_POR_UNA_CLAVE_UNICA_LARGA_Y_SEGURA'
export ECONOTAS_ALLOWED_ORIGIN='https://fundacionecopiensaevolution.github.io'
export ECONOTAS_DATA_DIR='./private-data'
java -cp backend EcoNotasServer
\`\`\`

En Windows PowerShell:

\`\`\`powershell
$env:ECONOTAS_USER = "docente"
$env:ECONOTAS_PASSWORD = "CAMBIA_ESTO_POR_UNA_CLAVE_UNICA_LARGA_Y_SEGURA"
$env:ECONOTAS_ALLOWED_ORIGIN = "https://fundacionecopiensaevolution.github.io"
$env:ECONOTAS_DATA_DIR = ".\\private-data"
javac backend/EcoNotasServer.java
java -cp backend EcoNotasServer
\`\`\`

El servicio escucha de forma predeterminada en \`127.0.0.1:8080\`; \`GET /api/health\` devuelve el estado. Para hospedar en nube, hay un \`backend/Dockerfile\` (contexto de compilación: **raíz del repositorio**, ruta del Dockerfile: **backend/Dockerfile**). El contenedor escucha en \`0.0.0.0:$PORT\`, pensado para un proveedor con terminación HTTPS. Monta obligatoriamente un **volumen persistente en \`/data\`**; sin volumen los datos podrían desaparecer al recrearse el contenedor.

### API

| Ruta | Método | Protección | Función |
|---|---|---|---|
| \`/api/health\` | GET | Pública | Verificar ejecución |
| \`/api/state\` | GET | Usuario/contraseña | Descargar JSON y obtener ETag |
| \`/api/state\` | PUT | Usuario/contraseña, \`If-Match\`, JSON | Guardar únicamente si la versión coincide |
| \`/api/state\` | OPTIONS | CORS de origen autorizado | Permitir preflight del navegador |

Configura **\`ECONOTAS_ALLOWED_ORIGIN\`** con el origen exacto del sitio, sin la ruta del repositorio (por ejemplo, \`https://fundacionecopiensaevolution.github.io\`). El navegador enviará credenciales solo a la dirección del backend introducida por el docente. Usa una contraseña única y larga: nunca copies secretos al código, README, variables públicas de Pages ni Git. Verifica que el host del backend esté bajo tu control antes de escribir la contraseña.

**Estado del servidor Java:** piloto para **un docente/una instancia**. No tiene todavía cuentas independientes por docente, roles de institución, cifrado de datos en reposo, combinación de cambios, copias de seguridad automáticas, políticas de retención ni auditoría reglamentaria. Antes de usarlo con expedientes de menores, deben implementarse controles y acuerdos adecuados de protección de datos.

## Compatibilidad por tipo

| Tipo | Corrección |
|---|---|
| Selección única A-D | OMR automático cuando la hoja tiene marcas claras |
| Verdadero/falso | OMR automático |
| Selección múltiple | OMR automático; todas las opciones correctas deben coincidir |
| Señalar objeto en imagen | Opciones A-D con zonas numeradas/etiquetadas en la imagen por el docente |
| Palabra corta o traducción impresa | OCR con Tesseract.js; se acepta automáticamente únicamente si coincide exactamente con la clave y la confianza es alta |
| Palabra manuscrita | OCR experimental que **deja revisión docente**; Tesseract no está diseñado para reconocer caligrafía de forma fiable |
| Abierta / ensayo | OCR como apoyo a transcripción + evaluación docente |
| Relacionar columnas / unir | Evaluación docente en esta versión |

## Límites y validación

- Escaneo OMR implementado mediante detección de los cuatro marcadores negros, cálculo de perspectiva y medición de relleno dentro de cada burbuja. Rechaza hojas incompletas o versiones antiguas; no existe puntuación aleatoria.
- Se incluyen **pruebas sintéticas** del reconocimiento de casillas y el cálculo de notas en el archivo tests/smoke.cjs. **Aún falta ensayar con hojas impresas reales y celulares distintos**. No se garantiza tasa de acierto específica.
- OMR admite **hasta 40 preguntas objetivas por hoja** y OCR hasta **4 respuestas por hoja**. El sistema crea más hojas cuando se supera el límite.
- Para probar con respuestas manuscritas, conviene usar letra de imprenta muy legible y confirmación docente. El OCR de escritura manual fiable requiere agregar en otra fase un motor especializado, evaluado por idioma, licencia y precisión.
- Para preguntas escritas, **no se infiere automáticamente el significado semántico de una imagen**: el profesor introduce las respuestas válidas.
- Las notas quedan identificadas por **estudiante + examen**, no solo por estudiante. Cambiar preguntas o datos de un examen invalida sus versiones impresas y hace que deban revisarse las notas registradas con la versión anterior.
- Las imágenes de preguntas se comprimen y guardan localmente; cantidades grandes pueden alcanzar el límite del almacenamiento del navegador.
- Las librerías web se cargan desde CDN y pueden necesitar internet al cargar el sistema o descargar los modelos OCR por primera vez.
- La cámara requiere HTTPS y autorización del usuario. Google Sites puede restringir la cámara cuando la app está incrustada; recomendamos abrir la URL de GitHub Pages directamente en el teléfono.
- Antes de usar datos de menores, la institución debe validar sus políticas de privacidad, información a acudientes y gestión de autorizaciones conforme a sus obligaciones legales.

## Publicar en GitHub Pages

Incluye .github/workflows/pages.yml con comprobaciones y despliegue mediante GitHub Actions.

En el repositorio abre **Settings → Pages → Build and deployment → Source → GitHub Actions**. Una vez configurado, vuelve a ejecutar el workflow *Eco-Notas · pruebas y publicación* si fuese necesario. URL prevista:

**https://fundacionecopiensaevolution.github.io/eco-Notas/**

> La URL solo funcionará después de que GitHub Pages haya sido habilitado y el workflow termine satisfactoriamente.

## Validar con Node.js

Sin dependencias npm para la prueba de lógica: **node tests/smoke.cjs**.

Prueba sintáctica: **node --check state.js**, **node --check exam.js**, **node --check scan.js**, **node --check app.js**.

## Componentes de código abierto (uso comercial permitido bajo sus respectivas licencias)

| Componente | Uso | Licencia |
|---|---|---|
| [Tesseract.js](https://github.com/naptha/tesseract.js) | OCR de texto impreso | Apache-2.0 |
| [jsQR](https://github.com/cozmo/jsQR) | Lectura de QR | Apache-2.0 |
| [QRCode.js](https://github.com/davidshimjs/qrcodejs) | Generación de QR | MIT |
| [ExcelJS](https://github.com/exceljs/exceljs) | Importación / exportación de Excel | MIT |
| [Mammoth.js](https://github.com/mwilliamson/mammoth.js) | Lectura de tablas Word .docx | BSD-2-Clause |

Las licencias permisivas citadas permiten uso comercial, sujetas a conservar avisos y cumplir sus términos. Los derechos y licencia del código propio del proyecto quedan a decisión de la Fundación.

## Próxima fase para uso institucional

Cuentas individuales de docentes, almacenamiento cifrado en reposo, sincronización multiusuario, roles administrativos, historial de correcciones, auditoría de cambios, procesamiento por lotes, motor especializado para caligrafía, evaluaciones pedagógicas más complejas e integración de calificaciones con sistemas institucionales (previa autorización y validación).
