import sql from "mssql";
import "dotenv/config";

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_USER_NAME,
    port: Number(process.env.DB_PORT),
    options: {
        encrypt: false, // true se Azure
        trustServerCertificate: true,
        enableArithAbort: true,
    },
    connectionTimeout: 30000,
    requestTimeout: 30000,
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
    },
};

let poolPromise = null;

const connectToDatabase = async () => {
    try {
        const pool = await new sql.ConnectionPool(config).connect();
        console.log("✅ Connected to SQL Server");
        return pool;
    } catch (err) {
        console.error("❌ Database Connection Failed:", err.message);
        console.error("Connection details:", {
            server: config.server,
            port: config.port,
            database: config.database,
            user: config.user,
        });
        console.warn("⚠️  Server will start without database connection");
        return null;
    }
};

poolPromise = connectToDatabase();

export { poolPromise };
