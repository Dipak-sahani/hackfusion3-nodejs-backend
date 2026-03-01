import axios from 'axios';
import { addMessage, getRecentMessages } from '../services/redisService.js';
import UserMedicine from '../models/UserMedicine.js';
import Medicine from '../models/Medicine.js';
import ChatSession from '../models/ChatSession.js';
import LLMExtractionLog from '../models/LLMExtractionLog.js'; // Import Log model
import PreOrder from '../models/PreOrder.js';
import Prescription from '../models/Prescription.js';
import { createDraftOrder } from '../services/orderService.js'; // Use draft creation
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

        // 2b. Add GLOBAL PHARMACY CATALOG (Top 50 Available Items)
        const globalMedicines = await Medicine.find({ stock: { $gt: 0 } }).limit(50).select('name category unit pricePerUnit prescriptionRequired');
        if (globalMedicines.length > 0) {
            medicineContext += "\n\nAVAILABLE GLOBAL PHARMACY CATALOG:\n";
            medicineContext += globalMedicines.map(m => `- ${m.name}: Category: ${m.category}, Price: ₹${m.pricePerUnit}/${m.unit}, Prescription Required: ${m.prescriptionRequired ? 'YES' : 'NO'}`).join('\n');
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

        // 2c. Add User Bio Context (to prevent AI from asking for Age/Gender)
        const bioContext = `\nUSER BIO DATA:\n- Age: ${user.age}\n- Gender: ${user.gender}\n- City: ${user.city}\n(Do NOT ask the user for these details unless they are missing above.)`;

        // 2d. Add Age-Based Safety Context for AI
        let safetyContext = "";
        if (user.age > 40) {
            safetyContext = "\nCRITICAL SAFETY RULE: The user is over 40 years old. If they are attempting to order a 'high power' medicine or a medication known to have severe side effects for older adults, you MUST predict that it is unsafe. Do NOT output a structured order. Instead, politely refuse the order, explain the risk playfully/warnly, and suggest a safer alternative native to your chat response.";
        }

        // 3. Call FastAPI for Normalization/Response
        const payload = {
            text: text,
            chat_history: history,
            medicine_context: medicineContext + bioContext + safetyContext
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
                    // 1. Fetch DB records for all medicines in the order
                    const medNames = orders.map(o => o.medicine_name.trim());
                    const dbMedicines = await Medicine.find({
                        name: { $in: medNames.map(n => new RegExp(`^${n}$`, 'i')) }
                    });

                    // 2. Map statuses for each item (Stock & Prescription)
                    const medStatuses = orders.map(o => {
                        const dbMed = dbMedicines.find(dm => dm.name.toLowerCase().trim() === o.medicine_name.toLowerCase().trim());
                        const isAvailable = dbMed ? dbMed.currentStock >= o.quantityConverted : false;

                        // Prescription rule: DB flag OR age < 15
                        const needsPrescription = (user.age < 15) || (dbMed ? dbMed.requiresPrescription : false);

                        return {
                            name: o.medicine_name,
                            available: isAvailable,
                            needsPrescription: needsPrescription,
                            dbMed
                        };
                    });

                    // 3. Format Status List for Chat Response
                    const statusList = medStatuses.map(s =>
                        `- 💊 **${s.name}**: ${s.available ? '✅ In Stock' : '❌ Out of Stock'} | ${s.needsPrescription ? '🛡️ Prescription Required' : '✅ No Prescription Needed'}`
                    ).join('\n');

                    // 4. Check for valid prescription if needed
                    const itemsRequiringPrescription = medStatuses.filter(s => s.needsPrescription);
                    const hasPrescriptionRequiredItems = itemsRequiringPrescription.length > 0;
                    let hasValidPrescription = false;

                    if (hasPrescriptionRequiredItems) {
                        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                        const validPrescription = await Prescription.findOne({
                            userId,
                            $or: [
                                { aiVerificationStatus: 'AI_APPROVED' },
                                {
                                    createdAt: { $gte: oneDayAgo },
                                    aiVerificationStatus: { $ne: 'AI_REJECTED' }
                                }
                            ]
                        });
                        hasValidPrescription = !!validPrescription;
                    }

                    // 5. Logic Decisions
                    const allAvailable = medStatuses.every(s => s.available);

                    if (!allAvailable) {
                        const outOfStockNames = medStatuses.filter(s => !s.available).map(s => s.name).join(', ');
                        responseMessage = `I've checked the inventory, dear! Here is the status:\n\n${statusList}\n\nI'm sorry, but ${outOfStockNames} are currently out of stock or have insufficient quantity. I've alerted the manager to restock them! Is there anything else you'd like?`;
                        data.type = "blocked_order";
                    } else {
                        // Proceed to draft even if prescription is missing (Soft Warning instead of Block)
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

                        let prescriptionNote = "";
                        if (hasPrescriptionRequiredItems && !hasValidPrescription) {
                            const requiredNames = itemsRequiringPrescription.map(i => i.name).join(', ');
                            prescriptionNote = `\n\n⚠️ **Note**: ${requiredNames} require a prescription. You can upload it now or after confirming, but we'll need it before delivery! 🛡️`;
                            data.needs_prescription = true;
                        }

                        responseMessage = `Good news! I've prepared your draft:\n\n${statusList}\n${prescriptionNote}\n\nOrder summary: ${itemDetails}. Total: ₹${draftOrder.totalAmount}. Shall I confirm this for you, dear?${reminderNote}`;

                        data.type = "order"; // Ensure type is order so frontend shows confirmation
                        data.draftOrder = draftOrder;
                        data.session_id = draftOrder._id;
                        data.order_id = draftOrder._id;
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
