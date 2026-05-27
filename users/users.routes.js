import express from "express";
import bcrypt from "bcrypt";
import sql from "mssql";
import jwt from "jsonwebtoken";
import { poolPromise } from "../config/db.js";
import { poolPromise as simOnePool } from "../config/dbUsers.js";

const router = express.Router();

// AppRole names in SimOneDB for appID=3 (Simtech) → website role names
const APP_ROLE_MAP = {
    Administrator: "Shift Leader",
    Technician: "Employee",
    Guest: "Guest",
};

// Priority: highest privilege first
const APP_ROLE_PRIORITY = ["Administrator", "Technician", "Guest"];

router.get("/", async (req, res) => {
    try {
        const pool = await simOnePool;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }
        const appName = (process.env.APP_NAME || "Simtech").trim();
        const result = await pool
            .request()
            .input("appName", sql.NVarChar, appName).query(`
                WITH RankedRoles AS (
                    SELECT
                        sl.Worker_ID      AS ID,
                        sl.[User]         AS Username,
                        sl.firstname,
                        sl.lastname,
                        CONCAT(sl.firstname, ' ', sl.lastname) AS FullName,
                        CASE ar.[name]
                            WHEN 'Administrator' THEN 'Shift Leader'
                            WHEN 'Technician'    THEN 'Employee'
                            WHEN 'Guest'         THEN 'Guest'
                        END               AS Role,
                        sl.must_reset_psw AS FIRST_ACCESS,
                        sl.Active,
                        ROW_NUMBER() OVER (
                            PARTITION BY sl.Worker_ID
                            ORDER BY CASE ar.[name]
                                WHEN 'Administrator' THEN 1
                                WHEN 'Technician'    THEN 2
                                WHEN 'Guest'         THEN 3
                            END
                        ) AS rn
                    FROM [dbo].[sv_login] sl
                    INNER JOIN [dbo].[UserAppRoles] uar ON uar.userID = sl.Worker_ID
                    INNER JOIN [dbo].[AppRoles] ar
                        ON ar.appRoleID = uar.appRoleID
                        AND ar.appID = (
                            SELECT TOP 1 appID
                            FROM [dbo].[Applications]
                            WHERE LTRIM(RTRIM(name)) = @appName
                        )
                        AND ar.[name] IN ('Administrator', 'Technician', 'Guest')
                    WHERE sl.Active = 1
                )
                SELECT ID, Username, firstname, lastname, FullName, Role, FIRST_ACCESS, Active
                FROM RankedRoles
                WHERE rn = 1
                ORDER BY
                    CASE Role
                        WHEN 'Shift Leader' THEN 1
                        WHEN 'Employee'     THEN 2
                        WHEN 'Guest'        THEN 3
                        ELSE 4
                    END,
                    lastname,
                    firstname
            `);

        res.json(result.recordset);
    } catch (err) {
        console.error("Error in /users endpoint:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// Temporary: returns users from the old dbo.Employee table (pre-migration)
// Used by ShiftsTableVariant to display legacy shift data from EmployeeShiftMonthly
router.get("/legacy", async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }
        const result = await pool.request().query(`
            SELECT
                ID,
                Username,
                '' AS firstname,
                '' AS lastname,
                Username AS FullName,
                Role,
                FIRST_ACCESS,
                1 AS Active
            FROM dbo.Employee
            WHERE IsDeleted = 0
            ORDER BY Username
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error in /users/legacy endpoint:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.post("/register", async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password) {
        return res
            .status(400)
            .json({ error: "Username and password are required" });
    }

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        const existingUser = await pool
            .request()
            .input("username", sql.NVarChar, username)
            .query(
                "SELECT * FROM Employee WHERE Username = @username AND IsDeleted = 0",
            );

        if (existingUser.recordset.length > 0) {
            return res.status(409).json({ error: "Username already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool
            .request()
            .input("username", sql.NVarChar, username)
            .input("password", sql.NVarChar, hashedPassword)
            .input("role", sql.NVarChar, role || "Employee")
            .query(
                "INSERT INTO dbo.Employee (Username, PasswordHash, Role) VALUES (@username, @password, @role)",
            );

        res.status(201).json({
            success: true,
            message: "User registered successfully",
        });
    } catch (err) {
        console.error("Error in /users/register endpoint:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.post("/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res
            .status(400)
            .json({ error: "Username and password are required" });
    }

    try {
        const pool = await simOnePool;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        // Step 1 — find active user in dbo.sv_login (Worker_ID, User, pswhash, Active)
        const userResult = await pool
            .request()
            .input("username", sql.NVarChar, username).query(`
                SELECT Worker_ID, [User], pswhash, Active, must_reset_psw, firstname, lastname
                FROM [dbo].[sv_login]
                WHERE [User] = @username AND Active = 1
            `);

        if (userResult.recordset.length === 0) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const dbUser = userResult.recordset[0];

        // Step 2 — verify password against bcrypt hash (pswhash column)
        const isValid = await bcrypt.compare(password, dbUser.pswhash);
        if (!isValid) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const userId = Number(dbUser.Worker_ID);
        const displayUsername = dbUser.User;

        // Step 3 — resolve appID from dbo.Applications (APP_NAME = 'Simtech', expected ID = 3)
        const appName = (process.env.APP_NAME || "Simtech").trim();
        const appResult = await pool
            .request()
            .input("appName", sql.NVarChar, appName).query(`
                SELECT TOP 1 appID
                FROM [dbo].[Applications]
                WHERE LTRIM(RTRIM(name)) = @appName
            `);

        if (appResult.recordset.length === 0) {
            console.error(
                `APP_NAME '${appName}' not found in dbo.Applications`,
            );
            return res
                .status(403)
                .json({ error: "Application not configured in SimOneDB" });
        }

        const appId = Number(appResult.recordset[0].appID);

        // Step 4 — direct AppRoles assigned to the user for this app
        const directRolesResult = await pool
            .request()
            .input("userID", sql.Int, userId)
            .input("appID", sql.Int, appId).query(`
                SELECT DISTINCT ar.[name]
                FROM [dbo].[UserAppRoles] uar
                JOIN [dbo].[AppRoles] ar ON ar.[appRoleID] = uar.[appRoleID]
                WHERE uar.[userID] = @userID
                  AND ar.[appID] = @appID
            `);

        const directRoleNames = directRolesResult.recordset
            .map((r) => String(r.name).trim())
            .filter(Boolean);

        // Step 5 — inherited AppRoles via OrgRole hierarchy → OrgRoleAppRoles → AppRoles
        const inheritedRolesResult = await pool
            .request()
            .input("userID", sql.Int, userId)
            .input("appID", sql.Int, appId).query(`
                WITH OrgHierarchy AS (
                    SELECT uor.[roleID]
                    FROM [dbo].[UserOrgRoles] uor
                    WHERE uor.[userID] = @userID

                    UNION ALL

                    SELECT org.[parentRoleID]
                    FROM [dbo].[OrgRoles] org
                    INNER JOIN OrgHierarchy oh ON oh.[roleID] = org.[roleID]
                    WHERE org.[parentRoleID] IS NOT NULL
                )
                SELECT DISTINCT ar.[name]
                FROM OrgHierarchy oh
                JOIN [dbo].[OrgRoleAppRoles] orar ON orar.[roleID] = oh.[roleID]
                JOIN [dbo].[AppRoles] ar ON ar.[appRoleID] = orar.[appRoleID]
                WHERE ar.[appID] = @appID
            `);

        const inheritedRoleNames = inheritedRolesResult.recordset
            .map((r) => String(r.name).trim())
            .filter(Boolean);

        // Step 6 — combine all AppRole names and pick highest-priority mapped role
        const allAppRoles = Array.from(
            new Set([...directRoleNames, ...inheritedRoleNames]),
        );

        const matchedAppRole = APP_ROLE_PRIORITY.find((r) =>
            allAppRoles.includes(r),
        );

        if (!matchedAppRole) {
            console.warn(
                `User ${userId} (${displayUsername}) has no AppRole for app '${appName}' (appID=${appId}). All roles found: [${allAppRoles.join(", ")}]`,
            );
            return res.status(403).json({
                error: "Access denied: no valid role assigned for this application",
            });
        }

        const websiteRole = APP_ROLE_MAP[matchedAppRole];

        // Step 7 — issue JWT
        const token = jwt.sign(
            { id: userId, username: displayUsername, role: websiteRole },
            process.env.JWT_SECRET || "your-secret-key-change-this",
            { expiresIn: "7d" },
        );

        res.json({
            user: { id: userId, username: displayUsername, role: websiteRole },
            token,
        });
    } catch (err) {
        console.error("Error in /users/login endpoint:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.get("/validate", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: "No token provided" });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        res.json({
            valid: true,
            user: {
                id: decoded.id,
                username: decoded.username,
                role: decoded.role,
            },
        });
    } catch (err) {
        if (err.name === "TokenExpiredError") {
            return res.status(401).json({ error: "Token expired" });
        }
        if (err.name === "JsonWebTokenError") {
            return res.status(401).json({ error: "Invalid token" });
        }
        res.status(500).json({ error: "Server error", details: err.message });
    }
});

router.post("/:id/change-password", async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: "Password is required" });
    }

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        const userCheck = await pool
            .request()
            .input("id", sql.Int, id)
            .query("SELECT ID FROM Employee WHERE ID = @id");

        if (userCheck.recordset.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool
            .request()
            .input("id", sql.Int, id)
            .input("passwordHash", sql.NVarChar, hashedPassword)
            .query(
                "UPDATE Employee SET PasswordHash = @passwordHash, FIRST_ACCESS = 0 WHERE ID = @id",
            );

        res.json({ success: true, message: "Password changed successfully" });
    } catch (err) {
        console.error(
            "Error in /users/:id/change-password endpoint:",
            err.message,
        );
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
