import express from "express";
import sql from "mssql";
import { poolPromise } from "../config/db.js";

const router = express.Router();

// ── Top Categories ─────────────────────────────────────────────────────────

router.get("/topCategories", async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });
        const result = await pool.request().query(
            "SELECT id, name, position FROM dbo.score_top_categories ORDER BY position, id",
        );
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching top categories:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.post("/topCategories", async (req, res) => {
    const { name, position = 0 } = req.body;
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });
        const result = await pool
            .request()
            .input("name", sql.VarChar(100), name)
            .input("position", sql.Int, position)
            .query(`
                INSERT INTO dbo.score_top_categories (name, position)
                OUTPUT INSERTED.id
                VALUES (@name, @position)
            `);
        res.status(201).json({ id: result.recordset[0].id });
    } catch (err) {
        console.error("Error creating top category:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.patch("/topCategories/:id", async (req, res) => {
    const { name } = req.body;
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });
        await pool
            .request()
            .input("id", sql.Int, req.params.id)
            .input("name", sql.VarChar(100), name)
            .query("UPDATE dbo.score_top_categories SET name = @name WHERE id = @id");
        res.json({ message: "Updated" });
    } catch (err) {
        console.error("Error updating top category:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.delete("/topCategories/:id", async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });
        await pool
            .request()
            .input("id", sql.Int, req.params.id)
            .query("DELETE FROM dbo.score_top_categories WHERE id = @id");
        res.json({ message: "Deleted" });
    } catch (err) {
        console.error("Error deleting top category:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// ── Row Subcategories ──────────────────────────────────────────────────────

router.get("/rowSubcategories", async (req, res) => {
    const { macroType } = req.query;
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });
        const request = pool.request();
        let query =
            "SELECT id, macro_type, name, position, peso FROM dbo.score_row_subcategories";
        if (macroType) {
            query += " WHERE macro_type = @macroType";
            request.input("macroType", sql.VarChar(20), macroType);
        }
        query += " ORDER BY macro_type, position, id";
        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching row subcategories:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.post("/rowSubcategories", async (req, res) => {
    const { macro_type, name, position = 0 } = req.body;
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });
        const result = await pool
            .request()
            .input("macro_type", sql.VarChar(20), macro_type)
            .input("name", sql.VarChar(100), name)
            .input("position", sql.Int, position)
            .query(`
                INSERT INTO dbo.score_row_subcategories (macro_type, name, position)
                OUTPUT INSERTED.id
                VALUES (@macro_type, @name, @position)
            `);
        res.status(201).json({ id: result.recordset[0].id });
    } catch (err) {
        console.error("Error creating row subcategory:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.patch("/rowSubcategories/:id", async (req, res) => {
    const { peso, name } = req.body;
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });
        const request = pool.request().input("id", sql.Int, req.params.id);
        if (name !== undefined) {
            await request
                .input("name", sql.VarChar(100), name)
                .query("UPDATE dbo.score_row_subcategories SET name = @name WHERE id = @id");
        } else {
            await request
                .input("peso", sql.Decimal(5, 2), peso)
                .query("UPDATE dbo.score_row_subcategories SET peso = @peso WHERE id = @id");
        }
        res.json({ message: "Updated" });
    } catch (err) {
        console.error("Error updating row subcategory:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.delete("/rowSubcategories/:id", async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });
        await pool
            .request()
            .input("id", sql.Int, req.params.id)
            .query("DELETE FROM dbo.score_row_subcategories WHERE id = @id");
        res.json({ message: "Deleted" });
    } catch (err) {
        console.error("Error deleting row subcategory:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// ── Predefined Values ──────────────────────────────────────────────────────

router.get("/predefinedValues", async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });
        const result = await pool.request().query(
            "SELECT id, row_subcategory_id, value, label FROM dbo.score_predefined_values ORDER BY row_subcategory_id, value",
        );
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching predefined values:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.post("/predefinedValues", async (req, res) => {
    const { row_subcategory_id, value, label } = req.body;
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });
        const result = await pool
            .request()
            .input("row_subcategory_id", sql.Int, row_subcategory_id)
            .input("value", sql.Decimal(4, 1), value)
            .input("label", sql.NVarChar(100), label || "")
            .query(`
                INSERT INTO dbo.score_predefined_values (row_subcategory_id, value, label)
                OUTPUT INSERTED.id
                VALUES (@row_subcategory_id, @value, @label)
            `);
        res.status(201).json({ id: result.recordset[0].id });
    } catch (err) {
        console.error("Error adding predefined value:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.delete("/predefinedValues/:id", async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });
        await pool
            .request()
            .input("id", sql.Int, req.params.id)
            .query("DELETE FROM dbo.score_predefined_values WHERE id = @id");
        res.json({ message: "Deleted" });
    } catch (err) {
        console.error("Error deleting predefined value:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// ── Score Notes ────────────────────────────────────────────────────────────

router.get("/notes", async (req, res) => {
    const { employeeId, date } = req.query;
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });
        const result = await pool
            .request()
            .input("employeeId", sql.Int, employeeId)
            .input("date", sql.Date, date)
            .query(`
                SELECT id, employee_id, score_date, note
                FROM dbo.score_notes
                WHERE employee_id = @employeeId AND score_date = @date
            `);
        res.json(result.recordset[0] || null);
    } catch (err) {
        console.error("Error fetching note:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.post("/notes", async (req, res) => {
    const { employee_id, score_date, note } = req.body;
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });
        await pool
            .request()
            .input("employee_id", sql.Int, employee_id)
            .input("score_date", sql.Date, score_date)
            .input("note", sql.NVarChar(sql.MAX), note)
            .query(`
                MERGE dbo.score_notes AS target
                USING (SELECT @employee_id AS employee_id, @score_date AS score_date) AS source
                ON target.employee_id = source.employee_id AND target.score_date = source.score_date
                WHEN MATCHED THEN
                    UPDATE SET note = @note, updated_at = GETDATE()
                WHEN NOT MATCHED THEN
                    INSERT (employee_id, score_date, note) VALUES (@employee_id, @score_date, @note);
            `);
        res.status(201).json({ message: "Note saved" });
    } catch (err) {
        console.error("Error saving note:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// ── Score Values ───────────────────────────────────────────────────────────

router.get("/values/summary", async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });
        const result = await pool.request().query(`
            SELECT
                sv.employee_id,
                CAST(
                    SUM(CASE WHEN rs.macro_type = 'softskills' THEN sv.value ELSE 0 END) * 1.0 /
                    NULLIF(COUNT(DISTINCT sv.score_date), 0)
                AS DECIMAL(10, 2)) AS softskills_total,
                CAST(
                    SUM(CASE WHEN rs.macro_type = 'competenze'  THEN sv.value ELSE 0 END) * 1.0 /
                    NULLIF(COUNT(DISTINCT sv.score_date), 0)
                AS DECIMAL(10, 2)) AS competenze_total
            FROM dbo.score_values sv
            INNER JOIN dbo.score_row_subcategories rs ON sv.row_subcategory_id = rs.id
            GROUP BY sv.employee_id
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching score summaries:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.get("/values/alltimeAll", async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });
        const result = await pool.request().query(`
            SELECT
                sv.employee_id,
                sv.row_subcategory_id,
                AVG(CAST(sv.value AS FLOAT)) AS avg_value
            FROM dbo.score_values sv
            GROUP BY sv.employee_id, sv.row_subcategory_id
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching alltime all values:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.get("/values/alltime", async (req, res) => {
    const { employeeId } = req.query;
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });
        const result = await pool
            .request()
            .input("employeeId", sql.Int, employeeId)
            .query(`
                SELECT
                    sv.row_subcategory_id,
                    sv.top_category_id,
                    AVG(CAST(sv.value AS FLOAT)) AS avg_value
                FROM dbo.score_values sv
                WHERE sv.employee_id = @employeeId
                GROUP BY sv.row_subcategory_id, sv.top_category_id
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching alltime values:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.get("/values/dailySummary", async (req, res) => {
    const { employeeId } = req.query;
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });
        const result = await pool
            .request()
            .input("employeeId", sql.Int, employeeId)
            .query(`
                SELECT
                    CONVERT(CHAR(10), sv.score_date, 120) AS score_date,
                    SUM(CASE WHEN rs.macro_type = 'softskills' THEN sv.value ELSE 0 END) AS softskills_total,
                    SUM(CASE WHEN rs.macro_type = 'competenze'  THEN sv.value ELSE 0 END) AS competenze_total
                FROM dbo.score_values sv
                INNER JOIN dbo.score_row_subcategories rs ON sv.row_subcategory_id = rs.id
                WHERE sv.employee_id = @employeeId
                GROUP BY sv.score_date
                ORDER BY sv.score_date
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching daily summaries:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.get("/values", async (req, res) => {
    const { employeeId, date } = req.query;
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });
        const result = await pool
            .request()
            .input("employeeId", sql.Int, employeeId)
            .input("score_date", sql.Date, date)
            .query(`
                SELECT id, employee_id, row_subcategory_id, top_category_id, value
                FROM dbo.score_values
                WHERE employee_id = @employeeId
                  AND score_date  = @score_date
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching score values:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.post("/values", async (req, res) => {
    const { employee_id, row_subcategory_id, top_category_id, value, score_date } = req.body;
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });
        await pool
            .request()
            .input("employee_id", sql.Int, employee_id)
            .input("row_subcategory_id", sql.Int, row_subcategory_id)
            .input("top_category_id", sql.Int, top_category_id)
            .input("value", sql.Decimal(4, 1), value)
            .input("score_date", sql.Date, score_date)
            .query(`
                MERGE dbo.score_values AS target
                USING (
                    SELECT @employee_id        AS employee_id,
                           @row_subcategory_id AS row_subcategory_id,
                           @top_category_id    AS top_category_id,
                           @score_date         AS score_date
                ) AS source
                ON  target.employee_id        = source.employee_id
                AND target.row_subcategory_id = source.row_subcategory_id
                AND target.top_category_id    = source.top_category_id
                AND target.score_date         = source.score_date
                WHEN MATCHED THEN
                    UPDATE SET value = @value, updated_at = GETDATE()
                WHEN NOT MATCHED THEN
                    INSERT (employee_id, row_subcategory_id, top_category_id, value, score_date)
                    VALUES (@employee_id, @row_subcategory_id, @top_category_id, @value, @score_date);
            `);
        res.status(201).json({ message: "Score saved" });
    } catch (err) {
        console.error("Error saving score value:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
