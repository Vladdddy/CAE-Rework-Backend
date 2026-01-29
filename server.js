/*
// 📄 server.js aggiornato per includere /api/shifts
const express = require("express");
const cors = require("cors");
const path = require("path");
const taskRoutes = require("./routes/tasks");
const logbookRoutes = require("./routes/logbook");
const shiftRoutes = require("./routes/shifts");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const notesRoutes = require("./routes/notes");
const patternsRoutes = require("./routes/patterns");
const fs = require("fs");
const https = require("https");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve uploaded images statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/logbook", logbookRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/patterns", patternsRoutes);
*/
// ✅ Leggi le variabili da .env (con fallback)
const PORT = process.env.PORT || 3003;
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || "./ssl/key.pem";
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || "./ssl/cert.pem";

// ✅ Carica certificati
const httpsOptions = {
    key: fs.readFileSync(SSL_KEY_PATH),
    cert: fs.readFileSync(SSL_CERT_PATH),
};

// ✅ Avvia server HTTPS
https.createServer(httpsOptions, app).listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server HTTPS avviato su https://0.0.0.0:${PORT}`);
});
