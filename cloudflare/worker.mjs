/**
 * Eco-Notas · API de sincronización gratuita sobre Cloudflare Workers + D1.
 * API compatible con backend/EcoNotasServer.java.
 *
 * Requisitos: D1 DB binding, secreto ECONOTAS_PASSWORD, origen autorizado.
 * Diseñado para prototipos con datos de prueba, un solo docente por despliegue.
 */
const MAX_BYTES = 1_500_000;

function respond(status, payload, extra = {}) {
  return new Response(typeof payload === "string" ? payload : JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...extra
    }
  });
}

async function sha256(content) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  return '"' + [...new Uint8Array(bytes)].map(v => v.toString(16).padStart(2, "0")).join("") + '"';
}

function equalString(a, b) {
  // La comparación conserva un recorrido fijo para cadenas del mismo tamaño.
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let n = 0;
  for (let i = 0; i < a.length; i++) n |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return n === 0;
}

function authorized(request, env) {
  const value = request.headers.get("Authorization");
  if (!value?.startsWith("Basic ") || !env.ECONOTAS_PASSWORD || !env.ECONOTAS_USER) return false;
  try {
    const raw = atob(value.slice(6));
    const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return equalString(decoded, env.ECONOTAS_USER + ":" + env.ECONOTAS_PASSWORD);
  } catch {
    return false;
  }
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  return origin && origin === env.ECONOTAS_ALLOWED_ORIGIN ? {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type, If-Match",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Expose-Headers": "ETag",
    "Vary": "Origin"
  } : {};
}

async function handler(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/api/health" && request.method === "GET") {
    return respond(200, {status:"ok",service:"Eco-Notas Cloudflare D1"});
  }
  if (url.pathname !== "/api/state") return respond(404, {error:"Ruta no encontrada"});
  if (!env.DB) return respond(503, {error:"Falta vincular la base de datos D1"});
  if (!env.ECONOTAS_ALLOWED_ORIGIN) return respond(503, {error:"Falta configuración CORS"});
  const origin = request.headers.get("Origin");
  if (origin && origin !== env.ECONOTAS_ALLOWED_ORIGIN) return respond(403, {error:"Origen no autorizado"});
  const cors = corsHeaders(request, env);
  if (request.method === "OPTIONS") {
    return new Response(null, {status:204,headers:{...cors,"Cache-Control":"no-store"}});
  }
  if (!authorized(request, env)) {
    return respond(401, {error:"Credenciales incorrectas"}, {...cors,"WWW-Authenticate":'Basic realm="Eco-Notas Docente", charset="UTF-8"'});
  }
  if (request.method === "GET") {
    const row = await env.DB.prepare("SELECT state, etag FROM gradebook WHERE id = 1").first();
    return row
      ? respond(200, row.state, {...cors,ETag:row.etag})
      : respond(404, {error:"Todavía no hay datos en el servidor"}, {...cors,ETag:'"0"'});
  }
  if (request.method !== "PUT") return respond(405, {error:"Método no permitido"}, cors);
  if (!(request.headers.get("Content-Type")||"").toLowerCase().startsWith("application/json")) {
    return respond(415, {error:"Content-Type debe ser application/json"}, cors);
  }
  const expected = request.headers.get("If-Match");
  if (!expected) return respond(428, {error:"If-Match obligatorio"}, cors);
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BYTES) {
    return respond(413, {error:"El respaldo supera 1,5 MB. Reduce imágenes del examen o utiliza el servidor Java."}, cors);
  }
  let doc;
  try {doc = JSON.parse(text)} catch {
    return respond(400, {error:"JSON no válido"}, cors);
  }
  if (!doc || typeof doc !== "object" || !["groups","students","exams","grades"].every(k => Array.isArray(doc[k]))) {
    return respond(400, {error:"El documento debe contener groups, students, exams y grades como listas"}, cors);
  }
  const etag = await sha256(text);
  let result;
  if (expected === '"0"') {
    result = await env.DB.prepare(
      "INSERT INTO gradebook (id, state, etag) VALUES (1, ?, ?) ON CONFLICT(id) DO NOTHING"
    ).bind(text, etag).run();
  } else {
    result = await env.DB.prepare(
      "UPDATE gradebook SET state = ?, etag = ? WHERE id = 1 AND etag = ?"
    ).bind(text, etag, expected).run();
  }
  if ((result?.meta?.changes ?? 0) !== 1) {
    const current = await env.DB.prepare("SELECT etag FROM gradebook WHERE id = 1").first();
    return respond(409, {error:"Conflicto: otro dispositivo guardó una nueva versión"}, {...cors,ETag:current?.etag||'"0"'});
  }
  return respond(200, {status:"saved"}, {...cors,ETag:etag});
}

export default {
  async fetch(request, env) {
    try {
      return await handler(request, env);
    } catch (error) {
      // No registrar contenido ni credenciales de estudiantes en logs.
      console.error("Error Eco-Notas D1:", error?.name ?? "Unknown");
      return respond(500, {error:"No se pudo procesar la solicitud"});
    }
  }
};
