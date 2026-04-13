import express from "express";
import sql from "mssql";
import { poolPromise } from "../config/db.js";

const router = express.Router();

// POST / — create a group with members
router.post("/", async (req, res) => {
    const { name, createdBy, memberIds } = req.body;

    if (
        !name ||
        !createdBy ||
        !Array.isArray(memberIds) ||
        memberIds.length === 0
    ) {
        return res
            .status(400)
            .json({ error: "name, createdBy and memberIds are required" });
    }

    try {
        const pool = await poolPromise;
        if (!pool)
            return res.status(503).json({ error: "Database not connected" });

        // Insert group
        const groupResult = await pool
            .request()
            .input("name", sql.NVarChar(100), name)
            .input("createdBy", sql.Int, createdBy).query(`
                INSERT INTO dbo.GroupChat (NAME, CREATED_BY)
                OUTPUT INSERTED.ID
                VALUES (@name, @createdBy)
            `);

        const groupId = groupResult.recordset[0].ID;

        // Insert all members (including creator if not already in list)
        const allMembers = [...new Set([createdBy, ...memberIds])];
        for (const userId of allMembers) {
            await pool
                .request()
                .input("groupId", sql.Int, groupId)
                .input("userId", sql.Int, userId).query(`
                    INSERT INTO dbo.GroupChatMember (GROUP_ID, USER_ID)
                    VALUES (@groupId, @userId)
                `);
        }

        res.status(201).json({ success: true, groupId });
    } catch (err) {
        console.error("Error creating group:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// GET /user/:userId — get all groups a user is a member of, with member list
router.get("/user/:userId", async (req, res) => {
    const { userId } = req.params;

    try {
        const pool = await poolPromise;
        if (!pool)
            return res.status(503).json({ error: "Database not connected" });

        // Get groups where user is a member
        const groupsResult = await pool
            .request()
            .input("userId", sql.Int, userId).query(`
                SELECT g.ID, g.NAME, g.CREATED_BY, g.CREATED_AT
                FROM dbo.GroupChat g
                INNER JOIN dbo.GroupChatMember gm ON g.ID = gm.GROUP_ID
                WHERE gm.USER_ID = @userId
                ORDER BY g.CREATED_AT DESC
            `);

        const groups = groupsResult.recordset;

        // For each group, fetch members
        for (const group of groups) {
            const membersResult = await pool
                .request()
                .input("groupId", sql.Int, group.ID).query(`
                    SELECT e.ID, e.Username
                    FROM dbo.GroupChatMember gm
                    INNER JOIN dbo.Employee e ON gm.USER_ID = e.ID
                    WHERE gm.GROUP_ID = @groupId
                `);
            group.MEMBERS = membersResult.recordset;
        }

        res.json(groups);
    } catch (err) {
        console.error("Error fetching groups for user:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// GET /:groupId/messages — get all messages in a group
router.get("/:groupId/messages", async (req, res) => {
    const { groupId } = req.params;

    try {
        const pool = await poolPromise;
        if (!pool)
            return res.status(503).json({ error: "Database not connected" });

        const result = await pool.request().input("groupId", sql.Int, groupId)
            .query(`
                SELECT
                    m.ID,
                    m.GROUP_ID,
                    m.SENDER_ID,
                    m.MESSAGE_CONTENT,
                    m.DATE_SENT,
                    e.Username AS SenderUsername
                FROM dbo.GroupChatMessage m
                INNER JOIN dbo.Employee e ON m.SENDER_ID = e.ID
                WHERE m.GROUP_ID = @groupId
                ORDER BY m.DATE_SENT ASC
            `);

        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching group messages:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// POST /:groupId/messages — send a message to a group
router.post("/:groupId/messages", async (req, res) => {
    const { groupId } = req.params;
    const { senderId, messageContent } = req.body;

    if (!senderId || !messageContent) {
        return res
            .status(400)
            .json({ error: "senderId and messageContent are required" });
    }

    try {
        const pool = await poolPromise;
        if (!pool)
            return res.status(503).json({ error: "Database not connected" });

        const result = await pool
            .request()
            .input("groupId", sql.Int, groupId)
            .input("senderId", sql.Int, senderId)
            .input("messageContent", sql.NVarChar(sql.MAX), messageContent)
            .query(`
                INSERT INTO dbo.GroupChatMessage (GROUP_ID, SENDER_ID, MESSAGE_CONTENT)
                OUTPUT INSERTED.ID
                VALUES (@groupId, @senderId, @messageContent)
            `);

        const messageId = result.recordset[0].ID;

        // Auto-mark as read for the sender
        await pool
            .request()
            .input("messageId", sql.Int, messageId)
            .input("userId", sql.Int, senderId).query(`
                INSERT INTO dbo.GroupChatMessageRead (MESSAGE_ID, USER_ID)
                VALUES (@messageId, @userId)
            `);

        res.status(201).json({ success: true, messageId });
    } catch (err) {
        console.error("Error sending group message:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// PUT /:groupId/messages/read/:userId — mark all unread messages in group as read for user
router.put("/:groupId/messages/read/:userId", async (req, res) => {
    const { groupId, userId } = req.params;

    try {
        const pool = await poolPromise;
        if (!pool)
            return res.status(503).json({ error: "Database not connected" });

        // Get all message IDs in this group not yet read by this user
        const unreadResult = await pool
            .request()
            .input("groupId", sql.Int, groupId)
            .input("userId", sql.Int, userId).query(`
                SELECT m.ID
                FROM dbo.GroupChatMessage m
                WHERE m.GROUP_ID = @groupId
                  AND m.ID NOT IN (
                      SELECT r.MESSAGE_ID
                      FROM dbo.GroupChatMessageRead r
                      WHERE r.USER_ID = @userId
                  )
            `);

        for (const row of unreadResult.recordset) {
            await pool
                .request()
                .input("messageId", sql.Int, row.ID)
                .input("userId", sql.Int, userId).query(`
                    INSERT INTO dbo.GroupChatMessageRead (MESSAGE_ID, USER_ID)
                    VALUES (@messageId, @userId)
                `);
        }

        res.json({ success: true, markedCount: unreadResult.recordset.length });
    } catch (err) {
        console.error("Error marking group messages as read:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// GET /:groupId/unread/:userId — count unread messages in a group for a user
router.get("/:groupId/unread/:userId", async (req, res) => {
    const { groupId, userId } = req.params;

    try {
        const pool = await poolPromise;
        if (!pool)
            return res.status(503).json({ error: "Database not connected" });

        const result = await pool
            .request()
            .input("groupId", sql.Int, groupId)
            .input("userId", sql.Int, userId).query(`
                SELECT COUNT(*) AS UnreadCount
                FROM dbo.GroupChatMessage m
                WHERE m.GROUP_ID = @groupId
                  AND m.ID NOT IN (
                      SELECT r.MESSAGE_ID
                      FROM dbo.GroupChatMessageRead r
                      WHERE r.USER_ID = @userId
                  )
            `);

        res.json({ unreadCount: result.recordset[0].UnreadCount });
    } catch (err) {
        console.error("Error fetching group unread count:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// DELETE /:groupId — delete a group and all its members/messages (cascades via FK)
router.delete("/:groupId", async (req, res) => {
    const { groupId } = req.params;

    try {
        const pool = await poolPromise;
        if (!pool)
            return res.status(503).json({ error: "Database not connected" });

        const check = await pool
            .request()
            .input("groupId", sql.Int, groupId)
            .query(`SELECT ID FROM dbo.GroupChat WHERE ID = @groupId`);

        if (check.recordset.length === 0) {
            return res.status(404).json({ error: "Group not found" });
        }

        await pool
            .request()
            .input("groupId", sql.Int, groupId)
            .query(`DELETE FROM dbo.GroupChat WHERE ID = @groupId`);

        res.json({ success: true });
    } catch (err) {
        console.error("Error deleting group:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
