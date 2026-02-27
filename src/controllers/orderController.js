import { createPreOrderFromText, confirmOrder } from '../services/orderService.js';
import PreOrder from '../models/PreOrder.js';

// @desc    Process text to create a pre-order
// @route   POST /api/orders/ai-order
// @access  Private
const createAIOrder = async (req, res) => {
    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ message: 'Text input requirement' });
    }

    try {
        const preOrder = await createPreOrderFromText(req.user._id, text);
        res.json(preOrder);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Confirm an order
// @route   POST /api/orders/:id/confirm
// @access  Private
const confirmUserOrder = async (req, res) => {
    try {
        const order = await confirmOrder(req.params.id, req.user._id);
        res.json(order);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get user orders
// @route   GET /api/orders
// @access  Private
const getUserOrders = async (req, res) => {
    try {
        const orders = await PreOrder.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all orders (Admin only)
// @route   GET /api/orders/all
// @access  Private/Admin
const getAllOrders = async (req, res) => {
    try {
        const orders = await PreOrder.find({})
            .populate('user', 'name email')
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export { createAIOrder, confirmUserOrder, getUserOrders, getAllOrders };
