import express from "express";
import sql from "mssql";
import { poolPromise } from "../config/db.js";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }
        const result = await pool.request().query(`
            SELECT *
            FROM dbo.ShiftOrderTable_Backup
            ORDER BY POSITION
        `);

        console.log(
            "DB result: Fetched all shift orders",
            result.recordset.length,
        );
        res.json(result.recordset);
    } catch (err) {
        console.error("Error in /shiftOrder endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.post("/", async (req, res) => {
    const { POSITION, POSITIONED_USER_ID } = req.body;

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        const result = await pool
            .request()
            .input("POSITION", sql.Int, POSITION)
            .input("POSITIONED_USER_ID", sql.Int, POSITIONED_USER_ID).query(`
                INSERT INTO dbo.ShiftOrderTable_Backup (POSITION, POSITIONED_USER_ID)
                VALUES (@POSITION, @POSITIONED_USER_ID);
                SELECT SCOPE_IDENTITY() AS ID;
            `);

        res.status(201).json({
            message: "Shift order created successfully",
            id: result.recordset[0].ID,
        });
    } catch (err) {
        console.error("Error creating shift order:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// IMPORTANT: /batch/reorder must be declared BEFORE /:id
// Otherwise Express matches "batch" as the :id param and sql.Int conversion fails
router.put("/batch/reorder", async (req, res) => {
    const { orders } = req.body; // Expected: [{ ID, POSITION, POSITIONED_USER_ID }, ...]

    if (!Array.isArray(orders) || orders.length === 0) {
        return res.status(400).json({
            error: "Invalid request",
            details: "orders must be a non-empty array",
        });
    }

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        // ShiftOrderTable_Backup has no UNIQUE constraint on POSITION,
        // so we can update all rows directly without a two-phase temp approach
        for (const order of orders) {
            await pool
                .request()
                .input("ID", sql.Int, order.ID)
                .input("POSITION", sql.Int, order.POSITION)
                .input("POSITIONED_USER_ID", sql.Int, order.POSITIONED_USER_ID)
                .query(`
                    UPDATE dbo.ShiftOrderTable_Backup
                    SET POSITION = @POSITION,
                        POSITIONED_USER_ID = @POSITIONED_USER_ID
                    WHERE ID = @ID
                `);
        }

        res.json({
            message: "Shift orders updated successfully",
            updated: orders.length,
        });
    } catch (err) {
        console.error("Error batch updating shift orders:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { POSITION, POSITIONED_USER_ID } = req.body;

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        // Check if the shift order exists
        const orderCheck = await pool
            .request()
            .input("id", sql.Int, id)
            .query(`SELECT ID FROM dbo.ShiftOrderTable_Backup WHERE ID = @id`);

        if (orderCheck.recordset.length === 0) {
            return res.status(404).json({
                error: "Shift order not found",
                details: `Shift order with ID ${id} does not exist`,
            });
        }

        await pool
            .request()
            .input("ID", sql.Int, id)
            .input("POSITION", sql.Int, POSITION)
            .input("POSITIONED_USER_ID", sql.Int, POSITIONED_USER_ID)
            .query(`
                UPDATE dbo.ShiftOrderTable_Backup
                SET POSITION = @POSITION,
                    POSITIONED_USER_ID = @POSITIONED_USER_ID
                WHERE ID = @ID
            `);

        res.json({ message: "Shift order updated successfully" });
    } catch (err) {
        console.error("Error updating shift order:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
