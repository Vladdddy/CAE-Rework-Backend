import express from "express";

const router = express.Router();

const EMAIL_SERVER = "http://security-server:3000/send-email";
const API_KEY = "key-SimOne";

router.post("/send-pdf", async (req, res) => {
    const {
        pdfBase64,
        fileName,
        subject,
        message,
        site = "RS",
        distribution = "Tech report",
    } = req.body;

    console.log(
        "Email route hit. subject:",
        subject,
        "fileName:",
        fileName,
        "pdfBase64 length:",
        pdfBase64?.length,
    );

    if (!subject || !pdfBase64 || !fileName) {
        return res.status(400).json({
            error: "Missing required fields",
            received: {
                subject: !!subject,
                pdfBase64: !!pdfBase64,
                fileName: !!fileName,
            },
        });
    }

    try {
        const pdfBuffer = Buffer.from(pdfBase64, "base64");
        const pdfBlob = new Blob([pdfBuffer], { type: "application/pdf" });

        const formData = new FormData();
        formData.append("subject", subject);
        formData.append("message", message || "");
        formData.append("distribution", distribution);
        formData.append("site", site);
        formData.append("To", "");
        formData.append("attachment", fileName);
        formData.append("attachment", pdfBlob, fileName);

        const response = await fetch(EMAIL_SERVER, {
            method: "POST",
            headers: { "x-api-key": API_KEY },
            body: formData,
        });

        console.log("Email sent:", response.status);
        res.status(response.status).json({ status: response.status });
    } catch (err) {
        console.error("Failed to send email:", err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
