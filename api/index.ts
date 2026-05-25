import express from "express";
import path from "path";
import { app } from "../src/createApp";

// Serve static files
const distPath = path.join(process.cwd(), "dist");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

export default app;
