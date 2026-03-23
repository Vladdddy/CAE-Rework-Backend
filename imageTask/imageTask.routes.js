import express from "express";
import sql from "mssql";
import { poolPromise } from "../config/db.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const UPLOAD_DIR =
    process.env.UPLOAD_DIR ||
    "/mnt/c/Users/VladyslavBukator/Downloads/Allegati";

const toUnixPath = (value) => String(value || "").replace(/\\/g, "/");

const normalizeStoredPath = (value) => {
    if (!value) {
        return "";
    }

    return String(value).replace(/\\/g, "/").replace(/^\/+/, "");
};

const isHttpPath = (value) => /^https?:\/\//i.test(String(value || ""));

const getTaskRelativePath = (value) => {
    const normalized = normalizeStoredPath(value);
    const match = normalized.match(/(Task-\d+\/.+)$/i);

    return match ? match[1] : "";
};

const resolvePathCandidate = (value) => {
    if (!value || isHttpPath(value)) {
        return null;
    }

    const raw = String(value);
    const normalized = normalizeStoredPath(raw);
    const taskRelative = getTaskRelativePath(normalized);

    const candidates = [
        raw,
        normalized,
        taskRelative,
        normalized.replace(/^uploads\//i, ""),
        normalized.replace(/^allegati\//i, ""),
        normalized.replace(/^attachments\//i, ""),
    ]
        .filter(Boolean)
        .map((item) => {
            if (path.isAbsolute(item)) {
                return item;
            }

            return path.join(UPLOAD_DIR, item);
        });

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return null;
};

// Ensure the upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
        const { taskId } = req.params;
        const taskDir = path.join(UPLOAD_DIR, `Task-${taskId}`);
        fs.mkdirSync(taskDir, { recursive: true });
        cb(null, taskDir);
    },
    filename: (_req, file, cb) => {
        cb(null, path.basename(file.originalname || "attachment"));
    },
});

const upload = multer({ storage });

const router = express.Router();

const sendFileByPath = (filePath, res) => {
    const resolvedPath = resolvePathCandidate(filePath);

    if (!resolvedPath) {
        return res.status(404).json({ error: "Image file not found" });
    }

    return res.sendFile(path.resolve(resolvedPath));
};

const getImageRecordById = async (id) => {
    const pool = await poolPromise;
    if (!pool) {
        return { error: "Database not connected" };
    }

    const result = await pool.request().input("id", sql.Int, id).query(`
            SELECT TOP 1 *
            FROM dbo.ImageTask
            WHERE ID = @id;
        `);

    if (result.recordset.length === 0) {
        return { notFound: true };
    }

    return { record: result.recordset[0] };
};

// GET image file by image ID (frontend candidate: /imageTask/file/:id)
router.get("/file/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const lookup = await getImageRecordById(id);
        if (lookup.error) {
            return res.status(503).json({ error: lookup.error });
        }

        if (lookup.notFound) {
            return res.status(404).json({ error: "Image not found" });
        }

        return sendFileByPath(lookup.record.PATH, res);
    } catch (err) {
        console.error("Error in /imageTask/file/:id endpoint:", err.message);
        console.error("Full error:", err);
        return res
            .status(500)
            .json({ error: "Server error", details: err.message });
    }
});

// GET image file by image ID (frontend candidate: /imageTask/:id/file)
router.get("/:id/file", async (req, res) => {
    const { id } = req.params;

    try {
        const lookup = await getImageRecordById(id);
        if (lookup.error) {
            return res.status(503).json({ error: lookup.error });
        }

        if (lookup.notFound) {
            return res.status(404).json({ error: "Image not found" });
        }

        return sendFileByPath(lookup.record.PATH, res);
    } catch (err) {
        console.error("Error in /imageTask/:id/file endpoint:", err.message);
        console.error("Full error:", err);
        return res
            .status(500)
            .json({ error: "Server error", details: err.message });
    }
});

// GET image file by direct task path (frontend candidates: /Task-:taskId/:fileName and prefixed variants)
router.get(
    [
        "/Task-:taskId/:fileName",
        "/uploads/Task-:taskId/:fileName",
        "/allegati/Task-:taskId/:fileName",
        "/attachments/Task-:taskId/:fileName",
    ],
    (req, res) => {
        const { taskId, fileName } = req.params;
        const relativePath = `Task-${taskId}/${fileName}`;
        return sendFileByPath(relativePath, res);
    },
);

// GET all images for a task
router.get("/:taskId", async (req, res) => {
    const { taskId } = req.params;

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        const result = await pool.request().input("taskId", sql.Int, taskId)
            .query(`
                SELECT *
                FROM dbo.ImageTask
                WHERE TASK_ID = @taskId;
            `);

        console.log(
            "DB result: Fetched images for task",
            taskId,
            result.recordset.length,
        );
        res.json(result.recordset);
    } catch (err) {
        console.error("Error in /imageTask GET endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// POST a new image for a task
router.post("/:taskId", upload.single("file"), async (req, res) => {
    const { taskId } = req.params;
    const requestedPath = req.body?.path || req.body?.PATH || "";

    let filePath = "";
    if (req.file?.path) {
        filePath = toUnixPath(path.resolve(req.file.path));
    } else if (requestedPath) {
        const normalizedRequestedPath = normalizeStoredPath(requestedPath);
        filePath = path.isAbsolute(String(requestedPath))
            ? toUnixPath(path.resolve(String(requestedPath)))
            : toUnixPath(path.resolve(UPLOAD_DIR, normalizedRequestedPath));
    }

    if (!filePath) {
        return res.status(400).json({
            error: "Missing attachment source",
            details: "Provide multipart file field 'file' or body path",
        });
    }

    // For JSON-only create requests, accept only if file already exists on disk.
    // This keeps DB PATH and filesystem in sync and lets frontend fallback to multipart upload.
    if (!req.file) {
        const resolvedExistingPath = resolvePathCandidate(filePath);
        if (!resolvedExistingPath) {
            return res.status(409).json({
                error: "Attachment file not found on server",
                details:
                    "Send multipart field 'file' to upload the binary before creating record",
            });
        }

        filePath = toUnixPath(path.resolve(resolvedExistingPath));
    }

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        // Check if the task exists
        const taskCheck = await pool
            .request()
            .input("taskId", sql.Int, taskId)
            .query(`SELECT ID FROM dbo.Task WHERE ID = @taskId`);

        if (taskCheck.recordset.length === 0) {
            if (req.file?.path) {
                fs.unlink(req.file.path, () => {});
            }

            return res.status(404).json({
                error: "Task not found",
                details: `Task with ID ${taskId} does not exist`,
            });
        }

        const result = await pool
            .request()
            .input("taskId", sql.Int, taskId)
            .input("path", sql.NVarChar(500), filePath).query(`
                INSERT INTO dbo.ImageTask (TASK_ID, PATH)
                VALUES (@taskId, @path);
                SELECT SCOPE_IDENTITY() AS id;
            `);

        res.status(201).json({
            message: "Image record created successfully",
            id: result.recordset[0].id,
            path: filePath,
            fileName:
                req.body?.fileName ||
                req.body?.filename ||
                req.file?.originalname ||
                path.basename(filePath),
            filename:
                req.body?.filename ||
                req.body?.fileName ||
                req.file?.filename ||
                path.basename(filePath),
        });
    } catch (err) {
        console.error("Error in /imageTask POST endpoint:", err.message);
        console.error("Full error:", err);
        // Remove uploaded file if DB insert failed
        if (req.file?.path) {
            fs.unlink(req.file.path, () => {});
        }

        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// DELETE an image by ID
router.delete("/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        const result = await pool.request().input("id", sql.Int, id).query(`
                DELETE FROM dbo.ImageTask
                WHERE ID = @id;
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: "Image not found" });
        }

        res.json({ message: "Image deleted successfully" });
    } catch (err) {
        console.error("Error in /imageTask DELETE endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
