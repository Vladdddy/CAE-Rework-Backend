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
import employeeMessageRoutes from "./employeeMessage/employeeMessage.routes.js";
import patternShiftRoutes from "./patternShift/patternShift.routes.js";
import shiftOrderRoutes from "./shiftOrder/shiftOrder.routes.js";
import imageTaskRoutes from "./imageTask/imageTask.routes.js";
import imageLogbookRoutes from "./imageLogbook/imageLogbook.routes.js";
import trainingLoadRoutes from "./trainingLoad/trainingLoad.routes.js";

const app = express();
const FRONTEND_URL = process.env.FRONTEND_URL;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

app.use("/tasks", tasksRoutes);
app.use("/users", usersRoutes);
app.use("/notes", notesRoutes);
app.use("/notesLogbook", notesLogbookRoutes);
app.use("/simulators", simulatorsRoutes);
app.use("/logbooks", logbooksRoutes);
app.use("/employeeShift", employeeShiftRoutes);
app.use("/employeeOverview", employeeOverviewRoutes);
app.use("/employeeMessage", employeeMessageRoutes);
app.use("/patternShift", patternShiftRoutes);
app.use("/shiftOrder", shiftOrderRoutes);
app.use("/imageTask", imageTaskRoutes);
app.use("/imageLogbook", imageLogbookRoutes);
app.use("/trainingLoad", trainingLoadRoutes);
app.listen(FRONTEND_URL, () => {
    console.log(`Server running on http://localhost:${FRONTEND_URL}`);
});
