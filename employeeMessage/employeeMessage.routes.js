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
            SELECT 
                em.*,
                sender.Username as SenderUsername,
                receiver.Username as ReceiverUsername
            FROM dbo.EmployeeMessage em
            LEFT JOIN dbo.Employee sender ON em.SENDER_ID = sender.ID
            LEFT JOIN dbo.Employee receiver ON em.RECEIVER_ID = receiver.ID
            ORDER BY em.DATE_SENT DESC
        `);

        res.json(result.recordset);
    } catch (err) {
        console.error("Error in GET /employeeMessage endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.get("/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }
        const result = await pool.request().input("id", sql.Int, id).query(`
                SELECT 
                    em.*,
                    sender.Username as SenderUsername,
                    receiver.Username as ReceiverUsername
                FROM dbo.EmployeeMessage em
                LEFT JOIN dbo.Employee sender ON em.SENDER_ID = sender.ID
                LEFT JOIN dbo.Employee receiver ON em.RECEIVER_ID = receiver.ID
                WHERE em.ID = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: "Message not found" });
        }

        res.json(result.recordset[0]);
    } catch (err) {
        console.error(
            "Error in GET /employeeMessage/:id endpoint:",
            err.message,
        );
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.get("/user/:userId", async (req, res) => {
    const { userId } = req.params;

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }
        const result = await pool.request().input("userId", sql.Int, userId)
            .query(`
                SELECT 
                    em.*,
                    sender.Username as SenderUsername,
                    receiver.Username as ReceiverUsername
                FROM dbo.EmployeeMessage em
                LEFT JOIN dbo.Employee sender ON em.SENDER_ID = sender.ID
                LEFT JOIN dbo.Employee receiver ON em.RECEIVER_ID = receiver.ID
                WHERE em.SENDER_ID = @userId OR em.RECEIVER_ID = @userId
                ORDER BY em.DATE_SENT DESC
            `);

        res.json(result.recordset);
    } catch (err) {
        console.error(
            "Error in GET /employeeMessage/user/:userId endpoint:",
            err.message,
        );
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.get("/sent/:userId", async (req, res) => {
    const { userId } = req.params;

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }
        const result = await pool.request().input("userId", sql.Int, userId)
            .query(`
                SELECT 
                    em.*,
                    receiver.Username as ReceiverUsername
                FROM dbo.EmployeeMessage em
                LEFT JOIN dbo.Employee receiver ON em.RECEIVER_ID = receiver.ID
                WHERE em.SENDER_ID = @userId
                ORDER BY em.DATE_SENT DESC
            `);

        res.json(result.recordset);
    } catch (err) {
        console.error(
            "Error in GET /employeeMessage/sent/:userId endpoint:",
            err.message,
        );
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.get("/received/:userId", async (req, res) => {
    const { userId } = req.params;

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }
        const result = await pool.request().input("userId", sql.Int, userId)
            .query(`
                SELECT 
                    em.*,
                    sender.Username as SenderUsername
                FROM dbo.EmployeeMessage em
                LEFT JOIN dbo.Employee sender ON em.SENDER_ID = sender.ID
                WHERE em.RECEIVER_ID = @userId
                ORDER BY em.DATE_SENT DESC
            `);

        res.json(result.recordset);
    } catch (err) {
        console.error(
            "Error in GET /employeeMessage/received/:userId endpoint:",
            err.message,
        );
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.get("/unread/count/:userId", async (req, res) => {
    const { userId } = req.params;

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }
        const result = await pool.request().input("userId", sql.Int, userId)
            .query(`
                SELECT COUNT(*) as UnreadCount
                FROM dbo.EmployeeMessage
                WHERE RECEIVER_ID = @userId AND IS_READ = 0
            `);

        res.json({ unreadCount: result.recordset[0].UnreadCount });
    } catch (err) {
        console.error(
            "Error in GET /employeeMessage/unread/count/:userId endpoint:",
            err.message,
        );
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.post("/", async (req, res) => {
    const { senderId, receiverId, messageContent } = req.body;

    if (!senderId || !receiverId) {
        return res.status(400).json({
            error: "Sender ID and Receiver ID are required",
        });
    }

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        // Check if sender exists
        const senderCheck = await pool
            .request()
            .input("senderId", sql.Int, senderId)
            .query(`SELECT ID FROM dbo.Employee WHERE ID = @senderId`);

        if (senderCheck.recordset.length === 0) {
            return res.status(404).json({
                error: "Sender not found",
                details: `Employee with ID ${senderId} does not exist`,
            });
        }

        // Check if receiver exists
        const receiverCheck = await pool
            .request()
            .input("receiverId", sql.Int, receiverId)
            .query(`SELECT ID FROM dbo.Employee WHERE ID = @receiverId`);

        if (receiverCheck.recordset.length === 0) {
            return res.status(404).json({
                error: "Receiver not found",
                details: `Employee with ID ${receiverId} does not exist`,
            });
        }

        const result = await pool
            .request()
            .input("senderId", sql.Int, senderId)
            .input("receiverId", sql.Int, receiverId)
            .input("messageContent", sql.NVarChar, messageContent || null)
            .query(`
                INSERT INTO dbo.EmployeeMessage (SENDER_ID, RECEIVER_ID, MESSAGE_CONTENT)
                OUTPUT INSERTED.ID
                VALUES (@senderId, @receiverId, @messageContent)
            `);

        res.status(201).json({
            message: "Message sent successfully",
            messageId: result.recordset[0].ID,
        });
    } catch (err) {
        console.error("Error creating message:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.put("/:id/read", async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        // Check if message exists
        const messageCheck = await pool
            .request()
            .input("id", sql.Int, id)
            .query(`SELECT ID FROM dbo.EmployeeMessage WHERE ID = @id`);

        if (messageCheck.recordset.length === 0) {
            return res.status(404).json({
                error: "Message not found",
                details: `Message with ID ${id} does not exist`,
            });
        }

        await pool.request().input("id", sql.Int, id).query(`
                UPDATE dbo.EmployeeMessage
                SET IS_READ = 1
                WHERE ID = @id
            `);

        res.json({ message: "Message marked as read successfully" });
    } catch (err) {
        console.error("Error marking message as read:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.put("/read-all/:userId", async (req, res) => {
    const { userId } = req.params;

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        const result = await pool.request().input("userId", sql.Int, userId)
            .query(`
                UPDATE dbo.EmployeeMessage
                SET IS_READ = 1
                WHERE RECEIVER_ID = @userId AND IS_READ = 0
            `);

        res.json({
            message: "All messages marked as read successfully",
            updatedCount: result.rowsAffected[0],
        });
    } catch (err) {
        console.error("Error marking all messages as read:", err.message);
        console.error("Full error:", err);
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

        // Check if message exists
        const messageCheck = await pool
            .request()
            .input("id", sql.Int, id)
            .query(`SELECT ID FROM dbo.EmployeeMessage WHERE ID = @id`);

        if (messageCheck.recordset.length === 0) {
            return res.status(404).json({
                error: "Message not found",
                details: `Message with ID ${id} does not exist`,
            });
        }

        await pool
            .request()
            .input("id", sql.Int, id)
            .query(`DELETE FROM dbo.EmployeeMessage WHERE ID = @id`);

        res.json({ message: "Message deleted successfully" });
    } catch (err) {
        console.error("Error deleting message:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
