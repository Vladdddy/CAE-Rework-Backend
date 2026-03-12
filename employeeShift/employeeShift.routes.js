/*import express from "express";
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
*/

import express from "express";
import sql from "mssql";
import { poolPromise } from "../config/db.js";

const router = express.Router();

// Helper functions
const getMonthKey = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const createEmptyMonthJSON = () => {
    const days = {};
    for (let i = 1; i <= 31; i++) {
        days[i] = null; // X = null/no shift
    }
    return JSON.stringify(days);
};

// GET all shifts (transformed back to daily format for frontend compatibility)
router.get("/", async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        const { employeeId, month, startDate, endDate } = req.query;

        let query = `
            SELECT 
                esm.ID as monthly_id,
                esm.EMPLOYEE_ID,
                esm.MONTH_KEY,
                esm.SHIFT_DATA,
                esm.LAST_UPDATED
            FROM EmployeeShiftMonthly esm
            WHERE 1=1
        `;

        const request = pool.request();

        if (employeeId) {
            query += ` AND esm.EMPLOYEE_ID = @employeeId`;
            request.input("employeeId", sql.Int, employeeId);
        }

        if (month) {
            query += ` AND esm.MONTH_KEY = @month`;
            request.input("month", sql.VarChar(7), month);
        }

        const result = await request.query(query);

        // Transform monthly JSON data to daily records for frontend
        const dailyRecords = [];
        result.recordset.forEach((monthRecord) => {
            const shiftData = JSON.parse(monthRecord.SHIFT_DATA);
            const [year, month] = monthRecord.MONTH_KEY.split("-");

            Object.entries(shiftData).forEach(([day, shiftType]) => {
                if (shiftType !== null) {
                    // Only return days with assigned shifts
                    const date = `${year}-${month}-${String(day).padStart(2, "0")}`;
                    dailyRecords.push({
                        ID: `${monthRecord.monthly_id}_${day}`, // Composite ID for frontend
                        EMPLOYEE_ID: monthRecord.EMPLOYEE_ID,
                        SELECTED_DATE: date,
                        SHIFT_TYPE: shiftType,
                        MONTHLY_RECORD_ID: monthRecord.monthly_id,
                    });
                }
            });
        });

        // Sort by date
        dailyRecords.sort(
            (a, b) => new Date(a.SELECTED_DATE) - new Date(b.SELECTED_DATE),
        );

        res.json(dailyRecords);
    } catch (err) {
        console.error("Error in /employeeShift endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// GET shifts for a specific date range
router.get("/range", async (req, res) => {
    try {
        const { employeeId, startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res
                .status(400)
                .json({ error: "startDate and endDate are required" });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        // Get all months in the range
        const months = new Set();
        const currentDate = new Date(start);
        while (currentDate <= end) {
            months.add(getMonthKey(currentDate));
            currentDate.setMonth(currentDate.getMonth() + 1);
        }

        const pool = await poolPromise;
        const request = pool.request();

        let query = `
            SELECT 
                esm.EMPLOYEE_ID,
                esm.MONTH_KEY,
                esm.SHIFT_DATA
            FROM EmployeeShiftMonthly esm
            WHERE esm.MONTH_KEY IN (${Array.from(months)
                .map((_, i) => `@month${i}`)
                .join(",")})
        `;

        Array.from(months).forEach((month, i) => {
            request.input(`month${i}`, sql.VarChar(7), month);
        });

        if (employeeId) {
            query += ` AND esm.EMPLOYEE_ID = @employeeId`;
            request.input("employeeId", sql.Int, employeeId);
        }

        const result = await request.query(query);

        // Filter shifts within the exact date range
        const dailyRecords = [];
        result.recordset.forEach((monthRecord) => {
            const shiftData = JSON.parse(monthRecord.SHIFT_DATA);
            const [year, month] = monthRecord.MONTH_KEY.split("-");

            Object.entries(shiftData).forEach(([day, shiftType]) => {
                if (shiftType !== null) {
                    const dateStr = `${year}-${month}-${String(day).padStart(2, "0")}`;
                    const date = new Date(dateStr);
                    if (date >= start && date <= end) {
                        dailyRecords.push({
                            EMPLOYEE_ID: monthRecord.EMPLOYEE_ID,
                            SELECTED_DATE: dateStr,
                            SHIFT_TYPE: shiftType,
                        });
                    }
                }
            });
        });

        res.json(dailyRecords);
    } catch (err) {
        console.error("Error in /employeeShift/range endpoint:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// POST new shift(s)
router.post("/", async (req, res) => {
    const { employeeShifts } = req.body; // Can be single shift or array

    // Validate request body
    if (!employeeShifts) {
        return res.status(400).json({
            error: "Missing employeeShifts in request body",
        });
    }

    const shifts = Array.isArray(employeeShifts)
        ? employeeShifts
        : [employeeShifts];

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        // Group shifts by month
        const shiftsByMonth = {};

        for (const shift of shifts) {
            // Validate each shift object
            if (!shift || typeof shift !== "object") {
                return res.status(400).json({
                    error: "Invalid shift data - shift object is undefined or not an object",
                });
            }

            const { EMPLOYEE_ID, SELECTED_DATE, SHIFT_TYPE } = shift;

            // Validate required fields
            if (!EMPLOYEE_ID || !SELECTED_DATE || !SHIFT_TYPE) {
                return res.status(400).json({
                    error: "Missing required fields: EMPLOYEE_ID, SELECTED_DATE, and SHIFT_TYPE are required",
                    received: shift,
                });
            }
            const monthKey = getMonthKey(SELECTED_DATE);
            const day = new Date(SELECTED_DATE).getDate();

            const key = `${EMPLOYEE_ID}_${monthKey}`;
            if (!shiftsByMonth[key]) {
                shiftsByMonth[key] = {
                    EMPLOYEE_ID,
                    monthKey,
                    shifts: {},
                };
            }
            shiftsByMonth[key].shifts[day] = SHIFT_TYPE;
        }

        // Process each month group
        for (const key in shiftsByMonth) {
            const { EMPLOYEE_ID, monthKey, shifts } = shiftsByMonth[key];

            // Check if month record exists
            const checkResult = await pool
                .request()
                .input("EMPLOYEE_ID", sql.Int, EMPLOYEE_ID)
                .input("MONTH_KEY", sql.VarChar(7), monthKey).query(`
                    SELECT SHIFT_DATA FROM EmployeeShiftMonthly 
                    WHERE EMPLOYEE_ID = @EMPLOYEE_ID AND MONTH_KEY = @MONTH_KEY
                `);

            if (checkResult.recordset.length > 0) {
                // Update existing month record
                const existingData = JSON.parse(
                    checkResult.recordset[0].SHIFT_DATA,
                );
                const updatedData = { ...existingData, ...shifts };

                await pool
                    .request()
                    .input("EMPLOYEE_ID", sql.Int, EMPLOYEE_ID)
                    .input("MONTH_KEY", sql.VarChar(7), monthKey)
                    .input(
                        "SHIFT_DATA",
                        sql.NVarChar(sql.MAX),
                        JSON.stringify(updatedData),
                    )
                    .input("LAST_UPDATED", sql.DateTime, new Date()).query(`
                        UPDATE EmployeeShiftMonthly
                        SET SHIFT_DATA = @SHIFT_DATA, LAST_UPDATED = @LAST_UPDATED
                        WHERE EMPLOYEE_ID = @EMPLOYEE_ID AND MONTH_KEY = @MONTH_KEY
                    `);
            } else {
                // Create new month record
                const emptyMonth = createEmptyMonthJSON();
                const monthData = JSON.parse(emptyMonth);
                const updatedData = { ...monthData, ...shifts };

                await pool
                    .request()
                    .input("EMPLOYEE_ID", sql.Int, EMPLOYEE_ID)
                    .input("MONTH_KEY", sql.VarChar(7), monthKey)
                    .input(
                        "SHIFT_DATA",
                        sql.NVarChar(sql.MAX),
                        JSON.stringify(updatedData),
                    )
                    .input("LAST_UPDATED", sql.DateTime, new Date()).query(`
                        INSERT INTO EmployeeShiftMonthly (EMPLOYEE_ID, MONTH_KEY, SHIFT_DATA, LAST_UPDATED)
                        VALUES (@EMPLOYEE_ID, @MONTH_KEY, @SHIFT_DATA, @LAST_UPDATED)
                    `);
            }
        }

        res.status(201).json({
            message: "Shifts saved successfully",
            count: shifts.length,
        });
    } catch (err) {
        console.error("Error creating employee shifts:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// PUT (update) - Now handles monthly records
router.put("/:monthlyId", async (req, res) => {
    const { monthlyId } = req.params;
    const { updates } = req.body; // Array of { day, shiftType }

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        // Get current month record
        const currentResult = await pool
            .request()
            .input("ID", sql.Int, monthlyId).query(`
                SELECT SHIFT_DATA FROM EmployeeShiftMonthly WHERE ID = @ID
            `);

        if (currentResult.recordset.length === 0) {
            return res
                .status(404)
                .json({ error: "Monthly shift record not found" });
        }

        const currentData = JSON.parse(currentResult.recordset[0].SHIFT_DATA);

        // Apply updates
        updates.forEach((update) => {
            currentData[update.day] = update.shiftType;
        });

        // Save updated data
        await pool
            .request()
            .input("ID", sql.Int, monthlyId)
            .input(
                "SHIFT_DATA",
                sql.NVarChar(sql.MAX),
                JSON.stringify(currentData),
            )
            .input("LAST_UPDATED", sql.DateTime, new Date()).query(`
                UPDATE EmployeeShiftMonthly
                SET SHIFT_DATA = @SHIFT_DATA, LAST_UPDATED = @LAST_UPDATED
                WHERE ID = @ID
            `);

        res.json({ message: "Shifts updated successfully" });
    } catch (err) {
        console.error("Error updating employee shifts:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// DELETE a specific day's shift
router.delete("/", async (req, res) => {
    const { employeeId, date } = req.query;

    if (!employeeId || !date) {
        return res
            .status(400)
            .json({ error: "employeeId and date are required" });
    }

    try {
        const pool = await poolPromise;
        const monthKey = getMonthKey(date);
        const day = new Date(date).getDate();

        // Get current month record
        const currentResult = await pool
            .request()
            .input("EMPLOYEE_ID", sql.Int, employeeId)
            .input("MONTH_KEY", sql.VarChar(7), monthKey).query(`
                SELECT ID, SHIFT_DATA FROM EmployeeShiftMonthly 
                WHERE EMPLOYEE_ID = @EMPLOYEE_ID AND MONTH_KEY = @MONTH_KEY
            `);

        if (currentResult.recordset.length === 0) {
            return res
                .status(404)
                .json({ error: "Monthly shift record not found" });
        }

        const currentData = JSON.parse(currentResult.recordset[0].SHIFT_DATA);

        // Set the day to null (remove shift)
        currentData[day] = null;

        // Check if all days are null (empty month)
        const hasAnyShift = Object.values(currentData).some(
            (value) => value !== null,
        );

        if (!hasAnyShift) {
            // If month is empty, delete the entire record
            await pool
                .request()
                .input("ID", sql.Int, currentResult.recordset[0].ID)
                .query("DELETE FROM EmployeeShiftMonthly WHERE ID = @ID");

            res.json({
                message: "Monthly record deleted (all shifts removed)",
            });
        } else {
            // Otherwise update the record
            await pool
                .request()
                .input("ID", sql.Int, currentResult.recordset[0].ID)
                .input(
                    "SHIFT_DATA",
                    sql.NVarChar(sql.MAX),
                    JSON.stringify(currentData),
                )
                .input("LAST_UPDATED", sql.DateTime, new Date()).query(`
                    UPDATE EmployeeShiftMonthly
                    SET SHIFT_DATA = @SHIFT_DATA, LAST_UPDATED = @LAST_UPDATED
                    WHERE ID = @ID
                `);

            res.json({ message: "Shift deleted successfully" });
        }
    } catch (err) {
        console.error("Error deleting shift:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// DELETE entire month (optional)
router.delete("/month/:monthlyId", async (req, res) => {
    const { monthlyId } = req.params;

    try {
        const pool = await poolPromise;
        await pool
            .request()
            .input("ID", sql.Int, monthlyId)
            .query("DELETE FROM EmployeeShiftMonthly WHERE ID = @ID");

        res.json({ message: "Monthly shift record deleted successfully" });
    } catch (err) {
        console.error("Error deleting monthly record:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
