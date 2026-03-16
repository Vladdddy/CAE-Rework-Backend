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
            FROM dbo.ShiftOrderTable
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

        // Check if the employee exists
        const employeeCheck = await pool
            .request()
            .input("employeeId", sql.Int, POSITIONED_USER_ID)
            .query(`SELECT ID FROM dbo.Employee WHERE ID = @employeeId`);

        if (employeeCheck.recordset.length === 0) {
            return res.status(404).json({
                error: "Employee not found",
                details: `Employee with ID ${POSITIONED_USER_ID} does not exist`,
            });
        }

        const result = await pool
            .request()
            .input("POSITION", sql.Int, POSITION)
            .input("POSITIONED_USER_ID", sql.Int, POSITIONED_USER_ID).query(`
                INSERT INTO dbo.ShiftOrderTable (POSITION, POSITIONED_USER_ID)
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
            .query(
                `SELECT ID, POSITION FROM dbo.ShiftOrderTable WHERE ID = @id`,
            );

        if (orderCheck.recordset.length === 0) {
            return res.status(404).json({
                error: "Shift order not found",
                details: `Shift order with ID ${id} does not exist`,
            });
        }

        const currentPosition = orderCheck.recordset[0].POSITION;

        // Check if the employee exists
        const employeeCheck = await pool
            .request()
            .input("employeeId", sql.Int, POSITIONED_USER_ID)
            .query(`SELECT ID FROM dbo.Employee WHERE ID = @employeeId`);

        if (employeeCheck.recordset.length === 0) {
            return res.status(404).json({
                error: "Employee not found",
                details: `Employee with ID ${POSITIONED_USER_ID} does not exist`,
            });
        }

        // Use a transaction to handle position conflicts
        const transaction = pool.transaction();
        await transaction.begin();

        try {
            // Temporarily set current record to a negative position to avoid conflicts
            await transaction
                .request()
                .input("ID", sql.Int, id)
                .input("tempPosition", sql.Int, -1).query(`
                    UPDATE dbo.ShiftOrderTable
                    SET POSITION = @tempPosition
                    WHERE ID = @ID
                `);

            // Update the final position and user
            await transaction
                .request()
                .input("ID", sql.Int, id)
                .input("POSITION", sql.Int, POSITION)
                .input("POSITIONED_USER_ID", sql.Int, POSITIONED_USER_ID)
                .query(`
                    UPDATE dbo.ShiftOrderTable
                    SET POSITION = @POSITION,
                        POSITIONED_USER_ID = @POSITIONED_USER_ID
                    WHERE ID = @ID
                `);

            await transaction.commit();
            res.json({ message: "Shift order updated successfully" });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        console.error("Error updating shift order:", err.message);
        console.error("Full error:", err);

        if (err.number === 2627) {
            return res.status(409).json({
                error: "Position conflict",
                details:
                    "This position is already taken. Use the batch update endpoint to reorder multiple items.",
            });
        }

        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// Batch update endpoint for reordering multiple shift orders at once
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

        const transaction = pool.transaction();
        await transaction.begin();

        try {
            // First, temporarily set all positions to negative values to avoid conflicts
            for (let i = 0; i < orders.length; i++) {
                const order = orders[i];
                await transaction
                    .request()
                    .input("ID", sql.Int, order.ID)
                    .input("tempPosition", sql.Int, -(i + 1)).query(`
                        UPDATE dbo.ShiftOrderTable
                        SET POSITION = @tempPosition
                        WHERE ID = @ID
                    `);
            }

            // Then update to final positions
            for (const order of orders) {
                await transaction
                    .request()
                    .input("ID", sql.Int, order.ID)
                    .input("POSITION", sql.Int, order.POSITION)
                    .input(
                        "POSITIONED_USER_ID",
                        sql.Int,
                        order.POSITIONED_USER_ID,
                    ).query(`
                        UPDATE dbo.ShiftOrderTable
                        SET POSITION = @POSITION,
                            POSITIONED_USER_ID = @POSITIONED_USER_ID
                        WHERE ID = @ID
                    `);
            }

            await transaction.commit();
            res.json({
                message: "Shift orders updated successfully",
                updated: orders.length,
            });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        console.error("Error batch updating shift orders:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
