import axios from 'axios';
import { addMessage, getRecentMessages } from '../services/redisService.js';
import UserMedicine from '../models/UserMedicine.js';
import Medicine from '../models/Medicine.js';
import ChatSession from '../models/ChatSession.js';
import LLMExtractionLog from '../models/LLMExtractionLog.js'; // Import Log model
import PreOrder from '../models/PreOrder.js';
import Prescription from '../models/Prescription.js';
import { createDraftOrder, confirmOrder } from '../services/orderService.js'; // Use draft creation and confirmation
import { notifyAdmins } from '../services/adminNotificationService.js';

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
if (!process.env.FASTAPI_URL) {
    console.warn('[WARN] FASTAPI_URL is not defined in environment variables. Falling back to http://localhost:8000');
} else {
    console.log(`[CONNECTIVITY] Using FASTAPI_URL: ${FASTAPI_URL}`);
}

export const handleChatMessage = async (req, res) => {
    console.log(`[CHAT] Incoming message from user: ${req.user?._id || 'unknown'}`);
    try {
        const startTime = Date.now();
        const { text } = req.body;
        const userId = req.user._id;

        // 0. Profile Context (Optional)
        const user = req.user;
        const profileStatus = (user.age && user.gender && user.city) ? "Complete" : "Incomplete";
        console.log(`[CHAT] User ${userId} profile status: ${profileStatus}`);

        // 1. Fetch Chat History
        const history = await getRecentMessages(userId);

        // 2. Fetch Context Data
        const userMedicine = await UserMedicine.findOne({ userId }).populate('medicines.medicine');
        let medicineContext = "";

        // 2a. Fetch User's Personal Inventory
        if (userMedicine && userMedicine.medicines.length > 0) {
            medicineContext += userMedicine.medicines.map(item => {
                const med = item.medicine || {}; // Fallback if ref is missing
                const name = med.name || item.name || "Unknown Medicine";
                const unit = item.unit || med.unit || "tablet";
                const category = item.category || med.category || "general";
                const lastOrderedAt = med.lastOrderedAt || item.createdAt;

                const nextRefillDate = item.nextRefillDate;
                const currentStock = item.userStock;
                const lowStockThreshold = med.lowStockThreshold || 50;

                let status = item.isActive ? 'Active' : 'Paused';
                if (nextRefillDate && new Date(nextRefillDate) < new Date() && currentStock <= 0) {
                    status = "EXPIRED";
                } else if (currentStock <= lowStockThreshold && (!nextRefillDate || new Date(nextRefillDate) >= new Date())) {
                    status = "LOW_STOCK";
                }

                return `- ${name}: Stock ${currentStock} ${unit}, Status: ${status}, Category: ${category}, Next Refill: ${status === 'EXPIRED' ? 'None (Expired)' : nextRefillDate ? new Date(nextRefillDate).toDateString() : 'Unknown'}, Last Ordered ${lastOrderedAt ? new Date(lastOrderedAt).toDateString() : 'N/A'}`;
            }).filter(s => s !== '').join('\n');
        } else {
            medicineContext += "None recorded yet.\n";
        }

        // 2b. Add GLOBAL PHARMACY CATALOG (All Available Items)
        const globalMedicines = await Medicine.find({ currentStock: { $gt: 0 } }).select('name category unit pricePerUnit requiresPrescription');
        if (globalMedicines.length > 0) {
            medicineContext += "\n\nAVAILABLE GLOBAL PHARMACY CATALOG:\n";
            medicineContext += globalMedicines.map(m => `- ${m.name} (${m.category}): ₹${m.pricePerUnit}/${m.unit}${m.requiresPrescription ? ' [RX]' : ''}`).join('\n');
        }

        // 2b. Add Latest Prescription Context (including pending/manual review)
        const latestPrescription = await Prescription.findOne({ userId }).sort({ createdAt: -1 });

        if (latestPrescription) {
            const statusStr = latestPrescription.aiVerificationStatus === 'MANUAL_REVIEW'
                ? `PENDING MANUAL REVIEW (Status: ${latestPrescription.manualReviewStatus})`
                : latestPrescription.aiVerificationStatus;

            let prescriptionInfo = `LATEST PRESCRIPTION (Status: ${statusStr}, Uploaded: ${latestPrescription.createdAt.toDateString()}):\n`;

            if (latestPrescription.extractedData?.medicines && latestPrescription.extractedData.medicines.length > 0) {
                const list = latestPrescription.extractedData.medicines
                    .map(m => `- ${m.name}: ${m.dosage || 'N/A'}, Frequency/Dosage: ${m.frequency || 'N/A'}, Qty: ${m.quantity || 1}`)
                    .join('\n');
                prescriptionInfo += list;
            } else if (latestPrescription.rawOcrText) {
                prescriptionInfo += "Automated medicine extraction failed, but here is the raw text from the document:\n";
                prescriptionInfo += latestPrescription.rawOcrText.substring(0, 500) + "...";
            } else {
                prescriptionInfo += "No medicine details could be extracted or identified from this upload.";
            }
            medicineContext += `\n\n${prescriptionInfo}`;
        } else {
            medicineContext += `\n\nUSER HAS NO UPLOADED PRESCRIPTIONS.`;
        }

        // 2c. Add User Bio Context (to prevent AI from asking for City)
        const bioContext = `\nUSER BIO DATA:\n- City: ${user.city}\n(Do NOT ask the user for this detail if it's already here.)`;

        // 3. Call FastAPI for Normalization/Response
        const payload = {
            text: text,
            chat_history: history,
            medicine_context: medicineContext + bioContext
        };

        // NOTE: We need to update FastAPI main.py to handle these extra fields in InputPayload
        // For now, let's look at how correct this is.
        // We might need to split: 
        // IF it's an order -> /normalize
        // IF it's a chat -> /generate-response

        // Actually, the previous flow was: api.ts calls /orders/ai-order which hits FastAPI /normalize
        // Now we want a chat endpoint.

        // Let's call /normalize first to classify
        console.log(`[CHAT] Calling FastAPI Normalize: ${FASTAPI_URL}/normalize`);
        const normalizeResponse = await axios.post(`${FASTAPI_URL}/normalize`, payload, { timeout: 30000 });
        const data = normalizeResponse.data;
        console.log(`[CHAT] FastAPI Normalize Response Type: ${data.type}`);

        // 4. Save User Message
        await addMessage(userId, { role: "user", parts: [text] });

        let responseMessage = "";

        if (data.type === 'chat') {
            responseMessage = data.message;
        } else if (data.type === 'query_history') {
            // If FastAPI classified as specific history query, it might have already generated a message 
            // OR we need to call /generate-response with specific context.
            // The implementation plan says: "Call FastAPI /normalize with text + context".
            // Let's assume /normalize can now handle answer generation if we pass context.

            // If /normalize returned a message (because it's smart enough), use it.
            // If it returns type 'query_history', we might need to do a second pass?
            // PROPOSAL: Let's make /normalize do the generation if it detects a query type.
            if (data.message) {
                responseMessage = data.message;
            } else {
                responseMessage = "Checking your history...";
                const genResponse = await axios.post(`${FASTAPI_URL}/generate-response`, {
                    query: text,
                    context: medicineContext
                }, { timeout: 30000 });
                responseMessage = genResponse.data.message;
            }
        } else if (data.type === 'order') {
            // It's an order request -> Check for necessary info
            const orders = data.orders || [];

            // NEW: Reminders are now OPTIONAL. If missing, we proceed with defaults.
            // We only ask if we really want to be helpful, but we don't BLOCK draft creation.
            const hasMissingInfo = orders.some(o => !o.daily_consumption);
            let reminderNote = "";
            if (hasMissingInfo) {
                reminderNote = "\n\n(I've set your daily consumption to 1 for now. You can change this and set up reminders in your medicine cabinet later!)";
            }

            if (orders.length > 0) {
                try {
                    // 1. Fetch DB records for all medicines in the order (using robust matching)
                    const { findBestMedicineMatch } = await import('../services/medicineService.js');

                    const medStatuses = await Promise.all(orders.map(async (o) => {
                        const dbMed = await findBestMedicineMatch(o.medicine_name);

                        // Use matched name if found, else original
                        const displayName = dbMed ? dbMed.name : o.medicine_name;
                        const isAvailable = dbMed ? dbMed.currentStock >= o.quantity_converted : false;
                        const needsPrescription = dbMed ? dbMed.requiresPrescription : false;

                        return {
                            originalName: o.medicine_name,
                            name: displayName,
                            available: isAvailable,
                            needsPrescription: needsPrescription,
                            dbMed,
                            didCorrection: dbMed && dbMed.name.toLowerCase() !== o.medicine_name.toLowerCase()
                        };
                    }));

                    // 2. Format Status List for Chat Response (Show corrected names and converted quantities)
                    const statusList = medStatuses.map((s, index) => {
                        const o = orders[index];
                        const quantityDisplay = o.quantity_converted ? `**${o.quantity_converted} tablets**` : `**${o.quantity} ${o.unit || 'units'}**`;
                        const correctionTag = s.didCorrection ? ` (matched as **${s.name}**)` : "";

                        return `- 💊 ${quantityDisplay} of **${s.originalName}**${correctionTag}: ${s.available ? '✅ In Stock' : '❌ Out of Stock'}`;
                    }).join('\n');

                    const allAvailable = medStatuses.every(s => s.available);

                    if (!allAvailable) {
                        const outOfStockNames = medStatuses.filter(s => !s.available).map(s => s.name).join(', ');
                        responseMessage = `I've checked the inventory, dear! Here is the status:\n\n${statusList}\n\nI'm sorry, but ${outOfStockNames} are currently out of stock or have insufficient quantity. I've alerted the manager to restock them! Is there anything else you'd like?`;
                        data.type = "blocked_order";
                    } else {
                        // NEW: Check if user is CONFIRMING an existing draft
                        const confirmationWords = ["yes", "ok", "confirm", "place order", "go ahead", "yep", "do it", "sure", "correct"];
                        const isConfirmation = confirmationWords.some(word => text.toLowerCase().includes(word));

                        // Find latest draft for this user
                        const latestDraft = await PreOrder.findOne({ user: userId, status: 'draft' }).sort({ createdAt: -1 });

                        if (isConfirmation && latestDraft) {
                            console.log(`[CHAT] Finalizing order for draft: ${latestDraft._id}`);
                            await confirmOrder(latestDraft._id, userId);

                            // Use AI message if it looks like a confirmation, otherwise generate one
                            responseMessage = (data.message && data.message.length > 20) ? data.message : `Wonderful! I've confirmed your order for **${latestDraft.items.map(i => i.medicineName).join(', ')}**. I've also updated your medicine cabinet with these items, dear! 💊`;
                            data.type = "confirmed_order";
                            data.order = latestDraft;
                        } else {
                            // Proceed to create a NEW draft
                            const orderItems = orders.map(o => ({
                                medicineName: o.medicine_name,
                                quantity: o.quantity,
                                unit: o.unit || 'tablet',
                                quantityConverted: o.quantity_converted,
                                dailyConsumption: o.daily_consumption || 1,
                                reminderTimes: o.reminder_times || []
                            }));

                            const draftOrder = await createDraftOrder(userId, orderItems);
                            const itemDetails = draftOrder.items.map(i => `${i.quantity} ${i.unit} ${i.medicineName} (₹${i.pricePerUnit}/unit)`).join(', ');

                            responseMessage = `Good news! I've prepared your draft:\n\n${statusList}\n\nOrder summary: ${itemDetails}. Total: ₹${draftOrder.totalAmount}. Shall I confirm this for you, dear?`;

                            data.type = "order"; // Ensure type is order so frontend shows confirmation
                            data.draftOrder = draftOrder;
                            data.session_id = draftOrder._id;
                            data.order_id = draftOrder._id;
                        }
                    }
                } catch (orderError) {
                    // Check if it's a stock error or not found error
                    if (orderError.message.includes('Insufficient stock') || orderError.message.includes('not found in global catalog')) {
                        responseMessage = `I'm sorry, I couldn't place the order because: ${orderError.message}. I've notified the administration about this shortage.`;

                        // Alert Admin
                        await notifyAdmins(
                            'Stock Shortage Alert',
                            `User ${req.user.name} (${req.user.email}) attempted to order items that are out of stock or missing: ${orderError.message}`,
                            { userId: req.user._id, error: orderError.message }
                        );
                    } else {
                        console.error('Unhandled Order Error:', orderError);
                        responseMessage = "I'm having a little bit of trouble preparing that order for you, dear. Don't you worry, I've noted it down and I'll see what I can do. Is there anything else I can help you with in the meantime?";
                    }
                }
            } else {
                responseMessage = "I couldn't process the order details.";
            }

        } else if (data.type === 'cancel') {
            responseMessage = data.message || "Order cancelled.";
            // Update latest draft to cancelled if it exists
            try {
                const latestDraft = await PreOrder.findOneAndUpdate(
                    { user: userId, status: 'draft' },
                    { status: 'cancelled' },
                    { sort: { createdAt: -1 } }
                );
                if (latestDraft) {
                    console.log(`Cancelled draft order ${latestDraft._id}`);
                }
            } catch (err) {
                console.error("Error cancelling draft order:", err);
            }
        }


        // 5. Save AI Response (Redis)
        if (responseMessage) {
            await addMessage(userId, { role: "model", parts: [responseMessage] });
        }

        // 6. Save to MongoDB (Long-term Persistence)
        try {
            // Find active session or create new one
            let session = await ChatSession.findOne({ user: userId, status: 'active' }).sort({ createdAt: -1 });

            if (!session) {
                session = new ChatSession({ user: userId, messages: [] });
            }

            // Append User Message
            session.messages.push({
                sender: 'user',
                text: text,
                timestamp: new Date()
            });

            // Append AI Response
            if (responseMessage) {
                session.messages.push({
                    sender: 'agent',
                    text: responseMessage,
                    timestamp: new Date()
                });
            }

            await session.save();

        } catch (dbError) {
            console.error("Error saving to MongoDB ChatSession:", dbError);
        }

        // 7. Log to LLMExtractionLog
        try {
            const endpointStart = Date.now(); // We ideally capture start at top of function, but this is approx for AI part if we move it
            // Actually, let's use the start time from beginning of request if we had it, or just measure AI call time?
            // The model has 'processingTimeMs'.
            // Let's refine: The prompt asked to 'use this model'.
            // I'll log the full interaction here.

            await LLMExtractionLog.create({
                user: userId,
                rawInput: text,
                extractedOutput: data, // The JSON from FastAPI
                confidenceScore: data.orders?.[0]?.confidence || 1.0, // Extract if available, else 1
                processingTimeMs: Date.now() - startTime, // Need to define startTime at top
                geminiModelVersion: 'gemini-1.5-flash', // Hardcoded or from env
                status: 'success'
            });
        } catch (logError) {
            console.error("Error saving LLM Log:", logError);
        }

        res.json({
            ...data,
            message: responseMessage || data.message
        });

    } catch (error) {
        console.log('[CHAT_ERROR] Global Exception Caught:');
        console.log(JSON.stringify({
            message: error.message,
            code: error.code,
            url: error.config?.url,
            status: error.response?.status,
            data: error.response?.data,
            stack: error.stack?.substring(0, 200)
        }, null, 2));

        let userFriendlyMessage = "I'm so sorry, dear, but my system is taking a little nap right now. 💤";
        if (error.code === 'ECONNABORTED') {
            userFriendlyMessage = "The system is taking a bit longer than usual to respond. Please try again in 15 seconds while I wake everything up! ☕";
        }

        res.json({
            type: 'chat',
            message: userFriendlyMessage,
            blocked: false
        });
    }
};
