import express from "express";
import cors from "cors";
import tasksRoutes from "./tasks/tasks.routes.js";
import logbooksRoutes from "./logbooks/logbooks.routes.js";
import usersRoutes from "./users/users.routes.js";
import notesRoutes from "./notes/notes.routes.js";
import notesLogbookRoutes from "./notesLogbook/notesLogbook.routes.js";
import simulatorsRoutes from "./simulators/simulators.routes.js";
import employeeShiftRoutes from "./employeeShift/employeeShift.routes.js";
import employeeOverviewRoutes from "./employeeOverview/employeeOverview.routes.js";

const app = express();
const FRONTEND_URL = process.env.FRONTEND_URL;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

app.use("/tasks", tasksRoutes);
app.use("/users", usersRoutes);
app.use("/notes", notesRoutes);
app.use("/notesLogbook", notesLogbookRoutes);
app.use("/simulators", simulatorsRoutes);
app.use("/logbooks", logbooksRoutes);
app.use("/employeeShift", employeeShiftRoutes);
app.use("/employeeOverview", employeeOverviewRoutes);
app.listen(FRONTEND_URL, () => {
    console.log(`🚀 Server running on http://localhost:${FRONTEND_URL}`);
});
/*
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
app.createServer(httpsOptions, app).listen(process.env.PORT, "0.0.0.0", () => {
    console.log(
        `✅ Server HTTPS avviato su https://0.0.0.0:${process.env.PORT}`,
    );
});
*/
