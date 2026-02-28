import Prescription from '../models/Prescription.js';
import ManualReviewQueue from '../models/ManualReviewQueue.js';
import fs from 'fs';
import crypto from 'crypto';
import axios from 'axios';
import FormData from 'form-data';
import User from '../models/User.js';
import { supabase } from '../services/supabaseClient.js';
import { readFile } from 'fs/promises';
import { normalizeMedicines } from '../services/medicineService.js';
import path from 'path';

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

// @desc    Upload and Process Prescription
// @route   POST /api/prescriptions/upload
// @access  Private
export const uploadPrescription = async (req, res) => {
    try {
        console.log(`[DEBUG] uploadPrescription: User ID ${req.user?._id}, Role ${req.user?.role}`);
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const filePath = req.file.path;

        // 1. Generate SHA256 Hash for Duplicate Check
        const fileBuffer = fs.readFileSync(filePath);
        const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // 2. Check for duplicate hash for THIS user
        const existing = await Prescription.findOne({ fileHash, userId: req.user._id });
        if (existing && existing.extractedData?.medicines?.length > 0) {
            // Clean up the newly uploaded file since we're reusing the old one
            fs.unlinkSync(filePath);
            return res.json({
                id: existing._id,
                extractedData: existing.extractedData,
                status: existing.aiVerificationStatus,
                message: 'This data already uploaded, please check uploaded prescription'
            });
        }

        console.log("hhhhhhh");

        // 3. Forward to FastAPI for processing
        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath), {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });
        formData.append('userId', req.user._id.toString());

        console.log(`[PROCESS] Forwarding to FastAPI: ${FASTAPI_URL}/api/prescription/process`);

        const fastApiResponse = await axios.post(`${FASTAPI_URL}/api/prescription/process`, formData, {
            headers: {
                ...formData.getHeaders()
            },
            timeout: 120000 // 2 minute timeout for complex OCR/AI
        });

        console.log(`[PROCESS] FastAPI result status: ${fastApiResponse.data.status}`);
        const { extractedData, id: fastApiId, status, rawOcrText, suspiciousScore, manualReviewReason } = fastApiResponse.data;

        if (status === 'AI_REJECTED' || status === 'OCR_COMPLETE') {
            console.warn(`[WARN] AI Extraction failed for User: ${req.user._id}. Status: ${status}`);
        }

        // 4. Upload to Supabase Storage
        let supabasePublicUrl = filePath; // Fallback to local path if upload fails/not configured
        try {
            const bucketName = process.env.SUPABASE_BUCKET || 'prescriptions';
            const fileExt = path.extname(req.file.originalname);
            const fileName = `${req.user._id}/${Date.now()}${fileExt}`;
            const fileContent = await readFile(filePath);

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from(bucketName)
                .upload(fileName, fileContent, {
                    contentType: req.file.mimetype,
                    upsert: true
                });

            if (uploadData) {
                const { data: publicUrlData } = supabase.storage
                    .from(bucketName)
                    .getPublicUrl(fileName);

                supabasePublicUrl = publicUrlData.publicUrl;

                // Safety check: If for some reason getPublicUrl returns a relative or localhost URL 
                // while we have a proper SUPABASE_URL, we should force the correct base.
                if (supabasePublicUrl.includes('localhost') && process.env.SUPABASE_URL) {
                    supabasePublicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucketName}/${fileName}`;
                }

                console.log(`[STORAGE] Final Supabase URL: ${supabasePublicUrl}`);

                // Clean up local file after successful upload
                fs.unlinkSync(filePath);
            } else if (uploadError) {
                console.error('[STORAGE_ERROR] Supabase upload failed:', uploadError.message);
            }
        } catch (storageErr) {
            console.error('[STORAGE_ERROR] Unexpected error during Supabase upload:', storageErr.message);
        }

        // 5. Normalize extracted medicines against global catalog
        const normalizedMedicines = await normalizeMedicines(extractedData?.medicines || []);

        // Sanitize prescriptionDate to avoid Mongoose CastError ("N/A" -> null)
        let sanitizedDate = extractedData?.prescriptionDate;
        if (sanitizedDate === "N/A" || !sanitizedDate) {
            sanitizedDate = null;
        } else {
            const dateObj = new Date(sanitizedDate);
            if (isNaN(dateObj.getTime())) {
                sanitizedDate = null;
            }
        }

        // Update extractedData with normalized medicines and sanitized date
        const updatedExtractedData = {
            ...extractedData,
            medicines: normalizedMedicines,
            prescriptionDate: sanitizedDate
        };

        // 6. Create Prescription record in Node.js
        const prescription = await Prescription.create({
            userId: req.user._id,
            fileUrl: supabasePublicUrl,
            fileHash: fileHash,
            rawOcrText: rawOcrText,
            extractedData: updatedExtractedData,
            aiVerificationStatus: status,
            suspiciousScore: suspiciousScore || 0
        });

        // 7. If suspicious, create Manual Review Queue entry and assign to random doctor
        if (status === 'MANUAL_REVIEW' || (suspiciousScore && suspiciousScore > 70)) {
            // Find a random online doctor
            const doctors = await User.find({ role: 'doctor', isVerified: true });
            let assignedDoctorId = null;
            if (doctors.length > 0) {
                const randomIndex = Math.floor(Math.random() * doctors.length);
                assignedDoctorId = doctors[randomIndex]._id;
            }

            await ManualReviewQueue.create({
                prescriptionId: prescription._id,
                reason: manualReviewReason || 'High suspicion score or flagged for manual review',
                assignedDoctorId
            });
        }

        res.json({
            id: prescription._id,
            extractedData: prescription.extractedData,
            status: prescription.aiVerificationStatus
        });

    } catch (error) {
        console.log(error);

        console.error('Error in uploadPrescription:', error.response?.data || error.message);
        res.status(500).json({
            message: 'Prescription processing failed',
            error: error.response?.data?.detail || error.message
        });
    }
};

// @desc    Get user's prescriptions
// @route   GET /api/prescriptions
// @access  Private
export const getUserPrescriptions = async (req, res) => {
    try {
        const prescriptions = await Prescription.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.json(prescriptions);
    } catch (error) {
        console.error('Error fetching prescriptions:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Confirm prescription details (User step)
// @route   POST /api/prescriptions/:id/confirm
// @access  Private
export const confirmPrescription = async (req, res) => {
    try {
        const { extractedData, isGenuine } = req.body;
        console.log(`[DEBUG] confirmPrescription: ID ${req.params.id}, User ID ${req.user?._id}`);

        if (!isGenuine) {
            return res.status(400).json({ message: 'User must confirm prescription is genuine' });
        }

        const prescription = await Prescription.findOne({ _id: req.params.id, userId: req.user._id });
        if (!prescription) {
            console.log(`[DEBUG] Prescription NOT FOUND for query: { _id: ${req.params.id}, userId: ${req.user._id} }`);
            return res.status(404).json({ message: 'Prescription not found' });
        }

        // Normalize medicines before saving
        const normalizedMedicines = await normalizeMedicines(extractedData?.medicines || []);
        prescription.extractedData = {
            ...extractedData,
            medicines: normalizedMedicines
        };
        // Status transitions to AI_APPROVED if it was already AI_APPROVED or MANUAL_REVIEW (once approved by doctor)
        // For simplicity, we assume if they are here, they can confirm.

        await prescription.save();
        res.json({ message: 'Prescription details confirmed', prescription });
    } catch (error) {
        console.error('Error confirming prescription:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get pending manual reviews (Admin/Doctor)
// @route   GET /api/manual-review/pending
// @access  Private/Admin
export const getPendingReviews = async (req, res) => {
    try {
        const reviews = await ManualReviewQueue.find({ status: 'PENDING' })
            .populate('prescriptionId')
            .sort({ createdAt: 1 });
        res.json(reviews);
    } catch (error) {
        console.error('Error fetching pending reviews:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Act on manual review
// @route   POST /api/manual-review/:id/action
// @access  Private/Admin
export const handleReviewAction = async (req, res) => {
    try {
        const { action, notes } = req.body; // action: 'APPROVED' or 'REJECTED'
        const review = await ManualReviewQueue.findById(req.params.id);

        if (!review) {
            return res.status(404).json({ message: 'Review entry not found' });
        }

        review.status = action;
        review.reviewNotes = notes;
        review.reviewedByDoctorId = req.user._id;
        await review.save();

        const prescription = await Prescription.findById(review.prescriptionId);
        if (prescription) {
            prescription.manualReviewStatus = action;
            prescription.aiVerificationStatus = action === 'APPROVED' ? 'AI_APPROVED' : 'AI_REJECTED';

            // Log the action
            prescription.reviewLogs.push({
                action: action,
                doctorId: req.user._id,
                notes: notes,
                timestamp: new Date()
            });

            await prescription.save();
        }

        res.json({ message: `Prescription ${action.toLowerCase()} successfully` });
    } catch (error) {
        console.error('Error handling review action:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};
// @desc    Get assigned manual reviews for a doctor
// @route   GET /api/prescriptions/doctor/assigned
// @access  Private/Doctor
export const getDoctorAssignedReviews = async (req, res) => {
    try {
        const reviews = await ManualReviewQueue.find({
            assignedDoctorId: req.user._id,
            status: 'PENDING'
        })
            .populate({
                path: 'prescriptionId',
                populate: { path: 'userId', select: 'name email dateOfBirth' }
            })
            .sort({ createdAt: 1 });

        const formattedReviews = reviews.map(r => {
            const user = r.prescriptionId.userId;
            let age = 'N/A';
            if (user.dateOfBirth) {
                const today = new Date();
                const birthDate = new Date(user.dateOfBirth);
                age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
            }

            return {
                ...r._doc,
                userAge: age,
                userName: user.name,
                userEmail: user.email
            };
        });

        res.json(formattedReviews);
    } catch (error) {
        console.error('Error fetching doctor assignments:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Normalize prescription data via AI (Doctor tool)
// @route   POST /api/prescriptions/manual-review/:id/normalize
// @access  Private/Doctor
export const normalizePrescriptionData = async (req, res) => {
    try {
        const review = await ManualReviewQueue.findById(req.params.id).populate('prescriptionId');
        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        const rawText = review.prescriptionId.rawOcrText;
        if (!rawText) {
            return res.status(400).json({ message: 'No raw OCR text available for normalization' });
        }

        // Call FastAPI for re-normalization
        const fastApiResponse = await axios.post(`${FASTAPI_URL}/api/prescription/normalize-raw`, {
            raw_text: rawText
        });

        res.json({
            message: 'AI Normalization complete',
            extractedData: fastApiResponse.data.extractedData
        });
    } catch (error) {
        console.error('Error in AI normalization:', error.response?.data || error.message);
        res.status(500).json({ message: 'AI Normalization failed' });
    }
};

// @desc    Update prescription extracted data (Doctor tool)
// @route   PUT /api/prescriptions/manual-review/:id/update-data
// @access  Private/Doctor
export const updatePrescriptionExtractedData = async (req, res) => {
    try {
        const { extractedData, notes } = req.body;
        const review = await ManualReviewQueue.findById(req.params.id);
        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        const prescription = await Prescription.findById(review.prescriptionId);
        if (prescription) {
            const oldData = prescription.extractedData;
            // Normalize medicines before saving
            const normalizedMedicines = await normalizeMedicines(extractedData?.medicines || []);
            prescription.extractedData = {
                ...extractedData,
                medicines: normalizedMedicines
            };

            // Log the edit
            prescription.reviewLogs.push({
                action: 'DATA_EDITED',
                doctorId: req.user._id,
                notes: notes || 'Doctor edited extracted data',
                changes: {
                    before: oldData,
                    after: prescription.extractedData
                },
                timestamp: new Date()
            });

            await prescription.save();
        }

        res.json({ message: 'Prescription data updated successfully', extractedData });
    } catch (error) {
        console.error('Error updating prescription data:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};
