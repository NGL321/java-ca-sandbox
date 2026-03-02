import io.javalin.Javalin;
import io.javalin.http.staticfiles.Location;

public class CASandboxMain {
    public static void main(String[] args) {
        var app = Javalin.create(config -> {
            config.staticFiles.add("res/public", Location.EXTERNAL);
        }).start(8080);
    }
}