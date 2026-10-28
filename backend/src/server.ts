import { z } from "zod";
import { buildApp } from "./app.js";

const config = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    HOST: z.string().min(1).default("127.0.0.1"),
  })
  .parse(process.env);
const app = buildApp({ logger: true });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void app.close().catch((error: unknown) => {
      app.log.error(error);
      process.exitCode = 1;
    });
  });
}

try {
  await app.listen({ port: config.PORT, host: config.HOST });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
