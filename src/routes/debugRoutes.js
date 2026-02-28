import express from 'express';
import axios from 'axios';

const router = express.Router();
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

router.get('/ping-fastapi', async (req, res) => {
    console.log(`[DEBUG] Explicit Ping Request to: ${FASTAPI_URL}`);
    try {
        const startTime = Date.now();
        const response = await axios.get(`${FASTAPI_URL}/`, { timeout: 10000 });
        const duration = Date.now() - startTime;

        res.json({
            success: true,
            target: FASTAPI_URL,
            durationMs: duration,
            data: response.data
        });
    } catch (error) {
        console.error(`[DEBUG_ERROR] Ping failed to: ${FASTAPI_URL}`);
        res.status(500).json({
            success: false,
            target: FASTAPI_URL,
            error: error.message,
            code: error.code,
            details: error.response?.data
        });
    }
});

export default router;
