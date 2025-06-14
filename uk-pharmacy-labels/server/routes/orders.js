/**
 * Order API Routes
 * Handles all HTTP endpoints for order management
 */

const express = require('express');
const router = express.Router();
const OrderModel = require('../models/order');
const { verifyToken, hasRole } = require('../middleware/auth');
const logger = require('../utils/logger');

// Apply authentication middleware to all routes
router.use(verifyToken);

/**
 * GET /api/orders
 * Get all orders with optional filtering
 * Accessible to admin, pharmacy, and ordering roles
 */
router.get('/', hasRole(['admin', 'pharmacy', 'ordering']), async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      type: req.query.type,
      wardId: req.query.ward_id,
      hospitalId: req.query.hospital_id,
      limit: req.query.limit ? parseInt(req.query.limit) : null
    };

    const orders = await OrderModel.getOrders(filters);
    res.json({ success: true, orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error retrieving orders',
      error: error.message 
    });
  }
});

/**
 * GET /api/orders/:id
 * Get a specific order by ID
 * Accessible to admin, pharmacy, and ordering roles
 */
router.get('/:id', hasRole(['admin', 'pharmacy', 'ordering']), async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await OrderModel.getOrderById(orderId);
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }
    
    res.json({ success: true, order });
  } catch (error) {
    console.error('Error fetching order by ID:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error retrieving order',
      error: error.message 
    });
  }
});

/**
 * POST /api/orders
 * Create a new order
 * Accessible to ordering role
 */
router.post('/', hasRole(['ordering']), async (req, res) => {
  try {
    const { id, type, wardId, patient, medications, requester, notes } = req.body;
    
    // Validate required fields
    if (!id || !type || !wardId || !medications || !requester) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    // Validate order type
    if (type !== 'patient' && type !== 'ward-stock') {
      return res.status(400).json({
        success: false,
        message: 'Invalid order type'
      });
    }
    
    // Validate ward ID for ward stock orders
    if (type === 'ward-stock' && !wardId) {
      return res.status(400).json({ 
        success: false,
        message: 'Ward ID required for ward stock orders' 
      });
    }
    
    // Validate medications
    if (!Array.isArray(medications) || medications.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one medication is required'
      });
    }
    
    for (const med of medications) {
      if (!med.name || !med.quantity) {
        return res.status(400).json({ 
          success: false,
          message: 'All medications must have a name and quantity' 
        });
      }
      // Ensure dose field is present (can be null/empty)
      if (!('dose' in med)) {
        med.dose = null;
      }
    }
    
    const orderData = {
      id,
      type,
      wardId,
      timestamp: new Date().toISOString(),
      status: 'pending',
      patient,
      medications,
      requesterName: requester.name,
      requesterRole: requester.role,
      notes
    };

    const result = await OrderModel.createOrder(orderData);
    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      orderId: result.id
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating order',
      error: error.message
    });
  }
});

/**
 * PUT /api/orders/:id
 * Update an order's status or processing information
 * Accessible to pharmacy role
 */
router.put('/:id', hasRole(['pharmacy']), async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status, processedBy, checkedBy, processingNotes } = req.body;

    // Validate status if provided
    if (status && !['pending', 'processing', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order status'
      });
    }

    // Update the order
    const result = await OrderModel.updateOrder(orderId, {
      status,
      processedBy,
      checkedBy,
      processingNotes
    });

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or no changes made'
      });
    }

    res.json({
      success: true,
      message: 'Order updated successfully'
    });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating order',
      error: error.message
    });
  }
});

/**
 * DELETE /api/orders/:id
 * Delete an order (admin only)
 */
router.delete('/:id', hasRole(['admin']), async (req, res) => {
  try {
    const orderId = req.params.id;
    const result = await OrderModel.deleteOrder(orderId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting order',
      error: error.message
    });
  }
});

/**
 * PUT /api/orders/:id/cancel
 * Cancel an order with a specific reason
 * Accessible to admin, pharmacy, and ordering roles
 */
router.put('/:id/cancel', hasRole(['admin', 'pharmacy', 'ordering']), async (req, res) => {
  try {
    const orderId = req.params.id;
    const { reason, cancelledBy, timestamp } = req.body;

    // Validate required fields
    if (!reason || !cancelledBy) {
      return res.status(400).json({
        success: false,
        message: 'Reason and cancelledBy are required'
      });
    }

    // Cancel the order
    const result = await OrderModel.cancelOrder(orderId, {
      reason,
      cancelledBy,
      timestamp: timestamp || new Date().toISOString()
    });

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or cannot be cancelled'
      });
    }

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order: result.order
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling order',
      error: error.message
    });
  }
});

/**
 * PUT /api/orders/:id/medications
 * Update all medications for an order
 * Accessible to pharmacy and ordering roles
 */
router.put('/:id/medications', hasRole(['pharmacy', 'ordering']), async (req, res) => {
  try {
    const orderId = req.params.id;
    const { medications, modifiedBy, reason, timestamp } = req.body;

    // Validate required fields
    if (!medications || !Array.isArray(medications) || !modifiedBy || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Medications array, modifiedBy and reason are required'
      });
    }

    // Validate each medication
    for (const med of medications) {
      if (!med.name || !med.quantity) {
        return res.status(400).json({
          success: false,
          message: 'Each medication must have a name and quantity'
        });
      }
    }

    // Update the order medications
    const result = await OrderModel.updateOrderMedications(orderId, {
      medications,
      modifiedBy,
      reason,
      timestamp: timestamp || new Date().toISOString()
    });

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or cannot be modified'
      });
    }

    res.json({
      success: true,
      message: 'Order medications updated successfully',
      order: result.order
    });
  } catch (error) {
    console.error('Error updating order medications:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating order medications',
      error: error.message
    });
  }
});

/**
 * POST /api/orders/:id/medications
 * Add a medication to an order
 * Accessible to pharmacy and ordering roles
 */
router.post('/:id/medications', hasRole(['pharmacy', 'ordering']), async (req, res) => {
  try {
    const orderId = req.params.id;
    const { medication, modifiedBy, reason, timestamp } = req.body;

    // Validate required fields
    if (!medication || !medication.name || !medication.quantity || !modifiedBy || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Medication details, modifiedBy and reason are required'
      });
    }

    // Add medication to the order
    const result = await OrderModel.addOrderMedication(orderId, {
      medication,
      modifiedBy,
      reason,
      timestamp: timestamp || new Date().toISOString()
    });

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or medication cannot be added'
      });
    }

    res.json({
      success: true,
      message: 'Medication added to order successfully',
      order: result.order
    });
  } catch (error) {
    console.error('Error adding medication to order:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding medication to order',
      error: error.message
    });
  }
});

/**
 * DELETE /api/orders/:orderId/medications/:medicationId
 * Remove a medication from an order
 * Accessible to pharmacy and ordering roles
 */
router.delete('/:orderId/medications/:medicationId', hasRole(['pharmacy', 'ordering']), async (req, res) => {
  try {
    const { orderId, medicationId } = req.params;
    const { modifiedBy, reason, timestamp } = req.body;

    // Validate required fields
    if (!modifiedBy || !reason) {
      return res.status(400).json({
        success: false,
        message: 'ModifiedBy and reason are required'
      });
    }

    // Remove medication from the order
    const result = await OrderModel.removeOrderMedication(orderId, medicationId, {
      modifiedBy,
      reason,
      timestamp: timestamp || new Date().toISOString()
    });

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: 'Order or medication not found'
      });
    }

    res.json({
      success: true,
      message: 'Medication removed from order successfully',
      order: result.order
    });
  } catch (error) {
    console.error('Error removing medication from order:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing medication from order',
      error: error.message
    });
  }
});

/**
 * GET /api/orders/:id/history
 * Get the history/audit trail for an order
 * Accessible to admin and pharmacy roles
 */
router.get('/:id/history', hasRole(['admin', 'pharmacy']), async (req, res) => {
  try {
    const orderId = req.params.id;
    const history = await OrderModel.getOrderHistory(orderId);
    
    if (!history) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order history not found' 
      });
    }
    
    res.json({ 
      success: true, 
      history 
    });
  } catch (error) {
    console.error('Error fetching order history:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error retrieving order history',
      error: error.message 
    });
  }
});

module.exports = router;
