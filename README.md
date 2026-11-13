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

**La primera versión es local.** Los datos se guardan en el almacenamiento del navegador que se está usando; **no existe aún una base de datos sincronizada en la nube**.

Para pasar del PC al celular: en Datos → **Exportar copia JSON**; transfiere de forma privada esa copia al celular; en el celular, Datos → **Importar copia**; escanea; exporta allí el JSON actualizado; reimpórtalo en el PC. Las importaciones **reemplazan** el estado anterior: realiza una copia de seguridad antes. No edites y escanees a la vez en varios equipos.

**El repositorio público solo incluye código.** Nunca hagas commit de nombres, notas, respuestas reales, respaldos JSON, fotografías de estudiantes ni listados.

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

Autenticación de docentes, almacenamiento cifrado y privado, sincronización real PC-celular, roles administrativos, historial de correcciones, auditoría de cambios, procesamiento por lotes, motor especializado para caligrafía, evaluaciones pedagógicas más complejas e integración de calificaciones con sistemas institucionales (previa autorización y validación).
