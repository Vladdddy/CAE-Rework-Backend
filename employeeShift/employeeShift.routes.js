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
            FROM EmployeeShift
        `);

        const transformedData = result.recordset.map((record) => ({
            ...record,
            id: record.ID,
        }));

        res.json(transformedData);
    } catch (err) {
        console.error("Error in /employeeShift endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.post("/", async (req, res) => {
    const { employeeShift } = req.body;
    const { EMPLOYEE_ID, SELECTED_DATE, SHIFT_TYPE } = employeeShift;

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        const result = await pool
            .request()
            .input("EMPLOYEE_ID", sql.Int, EMPLOYEE_ID)
            .input("SELECTED_DATE", sql.Date, SELECTED_DATE)
            .input("SHIFT_TYPE", sql.NVarChar(20), SHIFT_TYPE).query(`
                INSERT INTO EmployeeShift (EMPLOYEE_ID, SELECTED_DATE, SHIFT_TYPE)
                VALUES (@EMPLOYEE_ID, @SELECTED_DATE, @SHIFT_TYPE);
                SELECT SCOPE_IDENTITY() AS ID;
            `);

        res.status(201).json({
            id: result.recordset[0].ID,
        });
    } catch (err) {
        console.error("Error creating employee shift:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { employeeShift } = req.body;
    const { EMPLOYEE_ID, SELECTED_DATE, SHIFT_TYPE } = employeeShift;

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        await pool
            .request()
            .input("ID", sql.Int, id)
            .input("EMPLOYEE_ID", sql.Int, EMPLOYEE_ID)
            .input("SELECTED_DATE", sql.Date, SELECTED_DATE)
            .input("SHIFT_TYPE", sql.NVarChar(20), SHIFT_TYPE).query(`
                UPDATE EmployeeShift
                SET EMPLOYEE_ID = @EMPLOYEE_ID,
                    SELECTED_DATE = @SELECTED_DATE,
                    SHIFT_TYPE = @SHIFT_TYPE
                WHERE ID = @ID
            `);

        res.json({ message: "Employee shift updated successfully" });
    } catch (err) {
        console.error("Error updating employee shift:", err.message);
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

        await pool
            .request()
            .input("ID", sql.Int, id)
            .query("DELETE FROM EmployeeShift WHERE ID = @ID");

        res.json({ message: "Employee shift deleted successfully" });
    } catch (err) {
        console.error("Error deleting employee shift:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
