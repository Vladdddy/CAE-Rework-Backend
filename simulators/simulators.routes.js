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
      FROM Simulator
    `);

        res.json(result.recordset);
    } catch (err) {
        console.error("Error in /simulators endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.post("/", async (req, res) => {
    const { simulator } = req.body;

    console.log("Received simulator data:", simulator);

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        const existingSimulatorToday = await pool
            .request()
            .input("name", sql.NVarChar, simulator.name)
            .query(
                "SELECT * FROM Simulator WHERE NAME = @name AND CREATION_DATE = CAST(GETDATE() AS DATE)",
            );

        if (existingSimulatorToday.recordset.length > 0) {
            return res.status(409).json({
                error: "Simulator with this name already exists today",
            });
        }

        // Convert time strings to datetime objects, preserving local timezone
        const creationDate = new Date(simulator.creationDate);

        // Parse time strings and create datetime with proper timezone offset
        const startDateTime = simulator.startHour
            ? new Date(
                  `${creationDate.toISOString().split("T")[0]}T${simulator.startHour}:00.000Z`,
              )
            : null;
        const endDateTime = simulator.endHour
            ? new Date(
                  `${creationDate.toISOString().split("T")[0]}T${simulator.endHour}:00.000Z`,
              )
            : null;

        const result = await pool
            .request()
            .input("name", sql.NVarChar, simulator.name)
            .input("start_hour", sql.DateTime, startDateTime)
            .input("end_hour", sql.DateTime, endDateTime)
            .input("creation_date", sql.Date, simulator.creationDate)
            .input("assigned_to", sql.NVarChar, simulator.assignedTo).query(`
          INSERT INTO dbo.Simulator (
            NAME,
            START_HOUR,
            END_HOUR,
            CREATION_DATE,
            ASSIGNED_TO
          )
          VALUES (
            @name,
            @start_hour,
            @end_hour,
            @creation_date,
            @assigned_to
          );
          SELECT SCOPE_IDENTITY() AS id;
        `);

        res.status(201).json({
            id: result.recordset[0].id,
            ...simulator,
        });
    } catch (err) {
        console.error("Error in /simulators POST endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
