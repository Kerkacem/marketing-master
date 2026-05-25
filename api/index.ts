import express from "express";

const app = express();
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Serverless health check" });
});
app.get("/api/test", (req, res) => {
  res.json({ test: true, working: true });
});

export default app;
