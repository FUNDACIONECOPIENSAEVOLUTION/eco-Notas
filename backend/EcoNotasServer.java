/*
 * Eco-Notas Pro · Servicio Java 21 sin dependencias externas.
 * Uso: javac backend/EcoNotasServer.java && ECONOTAS_PASSWORD=... java -cp backend EcoNotasServer
 *
 * Pensado para uso detrás de un proxy HTTPS (Caddy, Nginx, Railway, etc.).
 * El servidor se enlaza a 127.0.0.1 de forma predeterminada.
 * Un solo espacio privado de trabajo por instancia/docente.
 */
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.PosixFilePermission;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.EnumSet;
import java.util.Locale;
import java.util.concurrent.Executors;

public final class EcoNotasServer {
    private static final int MAX_BYTES = 8 * 1024 * 1024;
    private static final String DEFAULT_ORIGIN = "https://fundacionecopiensaevolution.github.io";
    private EcoNotasServer() {}

    public static void main(String[] args) throws Exception {
        String password = env("ECONOTAS_PASSWORD", "");
        if (password.length() < 14) {
            System.err.println("Configura ECONOTAS_PASSWORD con al menos 14 caracteres. No hay contraseña predeterminada.");
            System.exit(1);
        }
        String host = env("ECONOTAS_BIND", "127.0.0.1");
        int port = Integer.parseInt(env("PORT", "8080"));
        String user = env("ECONOTAS_USER", "docente");
        String origin = env("ECONOTAS_ALLOWED_ORIGIN", DEFAULT_ORIGIN);
        Path directory = Path.of(env("ECONOTAS_DATA_DIR", "./private-data"));
        HttpServer server = start(host, port, user, password, origin, directory);
        System.out.println("Eco-Notas Java 21: escuchando en " + server.getAddress() + " (sin registrar información de alumnos)");
        System.out.println("IMPORTANTE: publica este servidor exclusivamente mediante HTTPS y conserva private-data fuera de Git.");
    }

    private static String env(String name, String fallback) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? fallback : value;
    }

    /**
     * Punto de entrada configurable utilizado también por las pruebas.
     * La autenticación HTTP Basic DEBE circular exclusivamente mediante HTTPS,
     * salvo conexiones de prueba a localhost.
     */
    public static HttpServer start(String host, int port, String username, String password,
                                   String allowedOrigin, Path directory) throws IOException {
        if (username.isBlank() || password.isBlank()) throw new IllegalArgumentException("Credenciales obligatorias");
        if (!allowedOrigin.startsWith("https://") && !allowedOrigin.startsWith("http://localhost:"))
            throw new IllegalArgumentException("El origen autorizado debe utilizar HTTPS (salvo localhost)");
        Files.createDirectories(directory);
        restrictPermissions(directory, true);
        Store store = new Store(directory.resolve("state.json"));
        HttpServer server = HttpServer.create(new InetSocketAddress(host, port), 20);
        server.createContext("/api/health", exchange -> {
            if (!exchange.getRequestMethod().equals("GET")) { send(exchange, 405, "{\"error\":\"Método no permitido\"}"); return; }
            send(exchange, 200, "{\"status\":\"ok\",\"service\":\"Eco-Notas Java\"}");
        });
        server.createContext("/api/state", exchange -> {
            try {
                handleState(exchange, username, password, allowedOrigin, store);
            } catch (Exception e) {
                System.err.println("Error interno en almacenamiento: " + e.getClass().getSimpleName());
                if (exchange.getResponseHeaders().getFirst("Content-Type") == null) {
                    send(exchange, 500, "{\"error\":\"Error interno del servidor\"}");
                } else {
                    exchange.close();
                }
            }
        });
        server.setExecutor(Executors.newCachedThreadPool(r -> {
            Thread thread = new Thread(r, "econotas-api");
            thread.setDaemon(true);
            return thread;
        }));
        server.start();
        return server;
    }

    private static void handleState(HttpExchange ex, String username, String password,
                                    String allowedOrigin, Store store) throws IOException {
        String origin = ex.getRequestHeaders().getFirst("Origin");
        if (origin != null && !origin.equals(allowedOrigin)) {
            send(ex, 403, "{\"error\":\"Origen no autorizado\"}");
            return;
        }
        if (origin != null) {
            ex.getResponseHeaders().set("Access-Control-Allow-Origin", allowedOrigin);
            ex.getResponseHeaders().set("Vary", "Origin");
            ex.getResponseHeaders().set("Access-Control-Allow-Headers", "Authorization, Content-Type, If-Match");
            ex.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
            ex.getResponseHeaders().set("Access-Control-Expose-Headers", "ETag");
        }
        ex.getResponseHeaders().set("Cache-Control", "no-store");
        if (ex.getRequestMethod().equals("OPTIONS")) {
            ex.sendResponseHeaders(204, -1);
            ex.close();
            return;
        }
        if (!isLocal(ex) && !"https".equalsIgnoreCase(ex.getRequestHeaders().getFirst("X-Forwarded-Proto"))) {
            send(ex, 426, "{\"error\":\"Se requiere HTTPS\"}");
            return;
        }
        if (!authorized(ex, username, password)) {
            ex.getResponseHeaders().set("WWW-Authenticate", "Basic realm=\"Eco-Notas Docente\", charset=\"UTF-8\"");
            send(ex, 401, "{\"error\":\"Credenciales incorrectas\"}");
            return;
        }
        switch (ex.getRequestMethod()) {
            case "GET" -> {
                byte[] json = store.read();
                if (json == null) {
                    ex.getResponseHeaders().set("ETag", "\"0\"");
                    send(ex, 404, "{\"error\":\"Todavía no hay datos en el servidor\"}");
                } else {
                    ex.getResponseHeaders().set("ETag", quotedHash(json));
                    sendBytes(ex, 200, json);
                }
            }
            case "PUT" -> {
                String type = ex.getRequestHeaders().getFirst("Content-Type");
                if (type == null || !type.toLowerCase(Locale.ROOT).startsWith("application/json")) {
                    send(ex, 415, "{\"error\":\"Content-Type debe ser application/json\"}");
                    return;
                }
                byte[] candidate;
                try (InputStream in = ex.getRequestBody()) {
                    candidate = in.readNBytes(MAX_BYTES + 1);
                }
                if (candidate.length > MAX_BYTES) {
                    send(ex, 413, "{\"error\":\"El archivo excede 8 MB\"}");
                    return;
                }
                String value = new String(candidate, StandardCharsets.UTF_8).trim();
                if (!(value.startsWith("{") && value.endsWith("}"))) {
                    send(ex, 400, "{\"error\":\"Se espera un objeto JSON\"}");
                    return;
                }
                String expected = ex.getRequestHeaders().getFirst("If-Match");
                if (expected == null) {
                    send(ex, 428, "{\"error\":\"If-Match obligatorio para evitar sobrescribir cambios\"}");
                    return;
                }
                String freshHash = store.saveIfMatches(expected, candidate);
                if (freshHash == null) {
                    ex.getResponseHeaders().set("ETag", store.currentETag());
                    send(ex, 409, "{\"error\":\"Conflicto: hay cambios en otro dispositivo. Descarga antes de sobrescribir.\"}");
                    return;
                }
                ex.getResponseHeaders().set("ETag", freshHash);
                send(ex, 200, "{\"status\":\"saved\"}");
            }
            default -> send(ex, 405, "{\"error\":\"Método no permitido\"}");
        }
    }

    private static boolean isLocal(HttpExchange ex) {
        if (ex.getRequestHeaders().getFirst("X-Forwarded-Proto") != null) return false;
        return ex.getRemoteAddress().getAddress().isLoopbackAddress();
    }

    private static boolean authorized(HttpExchange ex, String username, String password) {
        String header = ex.getRequestHeaders().getFirst("Authorization");
        if (header == null || !header.startsWith("Basic ")) return false;
        try {
            byte[] supplied = Base64.getDecoder().decode(header.substring(6));
            byte[] expected = (username + ":" + password).getBytes(StandardCharsets.UTF_8);
            return MessageDigest.isEqual(supplied, expected);
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static void send(HttpExchange ex, int status, String body) throws IOException {
        sendBytes(ex, status, body.getBytes(StandardCharsets.UTF_8));
    }

    private static void sendBytes(HttpExchange ex, int status, byte[] body) throws IOException {
        ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        ex.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
        ex.getResponseHeaders().set("X-Frame-Options", "DENY");
        ex.getResponseHeaders().set("Referrer-Policy", "no-referrer");
        ex.sendResponseHeaders(status, body.length);
        try (var out = ex.getResponseBody()) { out.write(body); }
    }

    private static String quotedHash(byte[] content) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(content);
            StringBuilder s = new StringBuilder("\"");
            for (byte b : hash) s.append(String.format("%02x", b & 0xff));
            return s.append("\"").toString();
        } catch (Exception e) { throw new IllegalStateException(e); }
    }

    private static void restrictPermissions(Path path, boolean directory) {
        try {
            Files.setPosixFilePermissions(path, directory
                ? EnumSet.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE, PosixFilePermission.OWNER_EXECUTE)
                : EnumSet.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE));
        } catch (UnsupportedOperationException | IOException ignored) {
            // Windows no utiliza permisos POSIX; configurar permisos del volumen.
        }
    }

    private static final class Store {
        private final Path path;
        Store(Path path) { this.path = path; }
        synchronized byte[] read() throws IOException { return Files.exists(path) ? Files.readAllBytes(path) : null; }
        synchronized String currentETag() throws IOException {
            byte[] previous = read();
            return previous == null ? "\"0\"" : quotedHash(previous);
        }
        synchronized String saveIfMatches(String etag, byte[] newState) throws IOException {
            if (!currentETag().equals(etag)) return null;
            Path tmp = Files.createTempFile(path.getParent(), "econotas-", ".tmp");
            try {
                Files.write(tmp, newState);
                restrictPermissions(tmp, false);
                try {
                    Files.move(tmp, path, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
                } catch (AtomicMoveNotSupportedException e) {
                    Files.move(tmp, path, StandardCopyOption.REPLACE_EXISTING);
                }
                restrictPermissions(path, false);
            } finally {
                Files.deleteIfExists(tmp);
            }
            return quotedHash(newState);
        }
    }
}
