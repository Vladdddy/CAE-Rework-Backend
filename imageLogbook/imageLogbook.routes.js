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

const getLogbookRelativePath = (value) => {
    const normalized = normalizeStoredPath(value);
    const match = normalized.match(/(Logbook-\d+\/.+)$/i);

    return match ? match[1] : "";
};

const resolvePathCandidate = (value) => {
    if (!value || isHttpPath(value)) {
        return null;
    }

    const raw = String(value);
    const normalized = normalizeStoredPath(raw);
    const logbookRelative = getLogbookRelativePath(normalized);

    const candidates = [
        raw,
        normalized,
        logbookRelative,
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

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
        const { logbookId } = req.params;
        const logbookDir = path.join(UPLOAD_DIR, `Logbook-${logbookId}`);
        fs.mkdirSync(logbookDir, { recursive: true });
        cb(null, logbookDir);
    },
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path.extname(file.originalname)}`);
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
            FROM dbo.ImageLogbook
            WHERE ID = @id;
        `);

    if (result.recordset.length === 0) {
        return { notFound: true };
    }

    return { record: result.recordset[0] };
};

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
        console.error("Error in /imageLogbook/file/:id endpoint:", err.message);
        console.error("Full error:", err);
        return res
            .status(500)
            .json({ error: "Server error", details: err.message });
    }
});

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
        console.error("Error in /imageLogbook/:id/file endpoint:", err.message);
        console.error("Full error:", err);
        return res
            .status(500)
            .json({ error: "Server error", details: err.message });
    }
});

router.get(
    [
        "/Logbook-:logbookId/:fileName",
        "/uploads/Logbook-:logbookId/:fileName",
        "/allegati/Logbook-:logbookId/:fileName",
        "/attachments/Logbook-:logbookId/:fileName",
    ],
    (req, res) => {
        const { logbookId, fileName } = req.params;
        const relativePath = `Logbook-${logbookId}/${fileName}`;
        return sendFileByPath(relativePath, res);
    },
);

router.get("/:logbookId", async (req, res) => {
    const { logbookId } = req.params;

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        const result = await pool
            .request()
            .input("logbookId", sql.Int, logbookId).query(`
                SELECT *
                FROM dbo.ImageLogbook
                WHERE LOGBOOK_ID = @logbookId;
            `);

        res.json(result.recordset);
    } catch (err) {
        console.error("Error in /imageLogbook GET endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.post("/:logbookId", upload.single("file"), async (req, res) => {
    const { logbookId } = req.params;
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

        const logbookCheck = await pool
            .request()
            .input("logbookId", sql.Int, logbookId)
            .query(`SELECT ID FROM dbo.Logbook WHERE ID = @logbookId`);

        if (logbookCheck.recordset.length === 0) {
            if (req.file?.path) {
                fs.unlink(req.file.path, () => {});
            }

            return res.status(404).json({
                error: "Logbook not found",
                details: `Logbook with ID ${logbookId} does not exist`,
            });
        }

        const result = await pool
            .request()
            .input("logbookId", sql.Int, logbookId)
            .input("path", sql.NVarChar(500), filePath).query(`
                INSERT INTO dbo.ImageLogbook (LOGBOOK_ID, PATH)
                VALUES (@logbookId, @path);
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
        console.error("Error in /imageLogbook POST endpoint:", err.message);
        console.error("Full error:", err);
        if (req.file?.path) {
            fs.unlink(req.file.path, () => {});
        }

        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.delete("/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        const result = await pool.request().input("id", sql.Int, id).query(`
                DELETE FROM dbo.ImageLogbook
                WHERE ID = @id;
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: "Image not found" });
        }

        res.json({ message: "Image deleted successfully" });
    } catch (err) {
        console.error("Error in /imageLogbook DELETE endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
