import express from "express";
import cors from "cors";
import tasksRoutes from "./tasks/tasks.routes.js";
import usersRoutes from "./users/users.routes.js";
import notesRoutes from "./notes/notes.routes.js";

const app = express();
const FRONTEND_URL = process.env.FRONTEND_URL;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

app.use("/tasks", tasksRoutes);
app.use("/users", usersRoutes);
app.use("/notes", notesRoutes);

app.listen(FRONTEND_URL, () => {
    console.log(`🚀 Server running on http://localhost:${FRONTEND_URL}`);
});
