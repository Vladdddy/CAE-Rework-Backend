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
            FROM EmployeeOverview
        `);

        res.json(result.recordset);
    } catch (err) {
        console.error("Error in /employeeOverview endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.post("/", async (req, res) => {
    const {
        EMPLOYEE_ID,
        EXPECTED_MONTHLY_HOURS,
        ACTUAL_MONTHLY_HOURS,
        ANNUAL_DAYS_OFF,
    } = req.body;

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        const result = await pool
            .request()
            .input("EMPLOYEE_ID", sql.Int, EMPLOYEE_ID)
            .input("EXPECTED_MONTHLY_HOURS", sql.Int, EXPECTED_MONTHLY_HOURS)
            .input("ACTUAL_MONTHLY_HOURS", sql.Int, ACTUAL_MONTHLY_HOURS)
            .input("ANNUAL_DAYS_OFF", sql.Decimal(5, 2), ANNUAL_DAYS_OFF)
            .query(`
                INSERT INTO EmployeeOverview (EMPLOYEE_ID, EXPECTED_MONTHLY_HOURS, ACTUAL_MONTHLY_HOURS, ANNUAL_DAYS_OFF)
                VALUES (@EMPLOYEE_ID, @EXPECTED_MONTHLY_HOURS, @ACTUAL_MONTHLY_HOURS, @ANNUAL_DAYS_OFF);
                SELECT SCOPE_IDENTITY() AS ID;
            `);

        res.status(201).json({
            message: "Employee overview created successfully",
            ID: result.recordset[0].ID,
        });
    } catch (err) {
        console.error("Error creating employee overview:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const {
        EMPLOYEE_ID,
        EXPECTED_MONTHLY_HOURS,
        ACTUAL_MONTHLY_HOURS,
        ANNUAL_DAYS_OFF,
    } = req.body;

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        await pool
            .request()
            .input("ID", sql.Int, id)
            .input("EMPLOYEE_ID", sql.Int, EMPLOYEE_ID)
            .input("EXPECTED_MONTHLY_HOURS", sql.Int, EXPECTED_MONTHLY_HOURS)
            .input("ACTUAL_MONTHLY_HOURS", sql.Int, ACTUAL_MONTHLY_HOURS)
            .input("ANNUAL_DAYS_OFF", sql.Decimal(5, 2), ANNUAL_DAYS_OFF)
            .query(`
                UPDATE EmployeeOverview
                SET EMPLOYEE_ID = @EMPLOYEE_ID,
                    EXPECTED_MONTHLY_HOURS = @EXPECTED_MONTHLY_HOURS,
                    ACTUAL_MONTHLY_HOURS = @ACTUAL_MONTHLY_HOURS,
                    ANNUAL_DAYS_OFF = @ANNUAL_DAYS_OFF
                WHERE ID = @ID
            `);

        res.json({ message: "Employee overview updated successfully" });
    } catch (err) {
        console.error("Error updating employee overview:", err.message);
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
            .query("DELETE FROM EmployeeOverview WHERE ID = @ID");

        res.json({ message: "Employee overview deleted successfully" });
    } catch (err) {
        console.error("Error deleting employee overview:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
