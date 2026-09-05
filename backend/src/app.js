import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import { errorHandler, notFound } from "./middlewares/errorHandler.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(cors());
  app.use(express.json({ limit: "128kb" }));

  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.use("/api", routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
