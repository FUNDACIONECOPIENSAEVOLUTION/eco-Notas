import java.nio.file.Files;
import java.nio.file.Path;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import com.sun.net.httpserver.HttpServer;

public class EcoNotasServerTest {
    public static void main(String[] args) throws Exception {
        Path dir = Files.createTempDirectory("eco-notas-test");
        HttpServer server = EcoNotasServer.start("127.0.0.1", 0, "teacher", "test-password", "https://fundacionecopiensaevolution.github.io", dir);
        try {
            String root = "http://127.0.0.1:" + server.getAddress().getPort() + "/api/state";
            HttpClient client = HttpClient.newHttpClient();
            String credential = Base64.getEncoder().encodeToString("teacher:test-password".getBytes(StandardCharsets.UTF_8));
            String auth = "Basic " + credential;
            HttpResponse<String> unauthorized = client.send(HttpRequest.newBuilder(URI.create(root)).GET().build(), HttpResponse.BodyHandlers.ofString());
            if (unauthorized.statusCode() != 401) throw new AssertionError("unauthorized");
            HttpResponse<String> initial = client.send(HttpRequest.newBuilder(URI.create(root)).header("Authorization", auth).GET().build(), HttpResponse.BodyHandlers.ofString());
            if (initial.statusCode() != 404) throw new AssertionError("missing");
            HttpResponse<String> saved = client.send(HttpRequest.newBuilder(URI.create(root))
                .header("Authorization", auth).header("If-Match", "\"0\"").header("Content-Type", "application/json")
                .PUT(HttpRequest.BodyPublishers.ofString("{\"groups\":[]}")).build(), HttpResponse.BodyHandlers.ofString());
            if (saved.statusCode() != 200) throw new AssertionError("save");
            HttpResponse<String> loaded = client.send(HttpRequest.newBuilder(URI.create(root)).header("Authorization", auth).GET().build(), HttpResponse.BodyHandlers.ofString());
            if (loaded.statusCode() != 200 || !loaded.body().contains("groups")) throw new AssertionError("load");
            System.out.println("Java API: checks passed");
        } finally { server.stop(0); }
    }
}
