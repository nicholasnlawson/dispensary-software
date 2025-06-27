/**
 * Routes for managing order groups
 */
const express = require('express');
const router = express.Router();
const orderGroupModel = require('../models/orderGroup');
const authMiddleware = require('../middleware/auth');

/**
 * Create a new order group
 * POST /api/order-groups
 */
router.post('/', authMiddleware.verifyToken, async (req, res) => {
    try {
        const { orderIds, groupNumber, notes } = req.body;
        
        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({ error: 'Order IDs must be a non-empty array' });
        }
        
        if (!groupNumber) {
            return res.status(400).json({ error: 'Group number is required' });
        }
        
        const group = await orderGroupModel.createGroup({
            orderIds,
            groupNumber,
            notes: notes || ''
        });
        
        res.status(201).json(group);
    } catch (error) {
        console.error('Error creating order group:', error);
        res.status(500).json({ error: 'Failed to create order group' });
    }
});

/**
 * Get all order groups
 * GET /api/order-groups
 */
router.get('/', authMiddleware.verifyToken, async (req, res) => {
    try {
        const groups = await orderGroupModel.getGroups();
        res.json(groups);
    } catch (error) {
        console.error('Error fetching order groups:', error);
        res.status(500).json({ error: 'Failed to fetch order groups' });
    }
});

/**
 * Get a specific order group by ID
 * GET /api/order-groups/:id
 */
router.get('/:id', authMiddleware.verifyToken, async (req, res) => {
    try {
        const groupId = req.params.id;
        const group = await orderGroupModel.getGroupById(groupId);
        
        if (!group) {
            return res.status(404).json({ error: 'Order group not found' });
        }
        
        res.json(group);
    } catch (error) {
        console.error('Error fetching order group:', error);
        res.status(500).json({ error: 'Failed to fetch order group' });
    }
});

// Delete an order group by ID
router.delete('/:id', authMiddleware.verifyToken, async (req, res) => {
    try {
        const groupId = req.params.id;
        const deleted = await orderGroupModel.deleteGroup(groupId);
        if (deleted) {
            return res.status(204).send();
        } else {
            return res.status(404).json({ error: 'Order group not found' });
        }
    } catch (error) {
        console.error('Error deleting order group:', error);
        res.status(500).json({ error: 'Failed to delete order group' });
    }
});

module.exports = router;
