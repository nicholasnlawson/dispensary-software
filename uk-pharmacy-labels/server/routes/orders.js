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
 * POST /api/orders/recent-check
 * Check for recent medication orders for a patient in the past 14 days
 * Returns matching orders to show alerts in the UI
 * Accessible to ordering role
 */
router.post('/recent-check', hasRole(['ordering']), async (req, res) => {
  try {
    const { patient, medications } = req.body;
    
    if (!patient || !medications || !Array.isArray(medications)) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: patient object and medications array'
      });
    }
    
    // Extract necessary patient identification data
    const patientData = {
      patientName: patient.name,
      nhsNumber: patient.nhsNumber || patient.nhs_number,
      hospitalNumber: patient.hospitalNumber || patient.hospital_number
    };
    
    // Check for recent medication orders
    const recentOrders = await OrderModel.checkRecentMedicationOrders(patientData, medications);
    
    // Add explicit warning flag based on presence of recent orders
    const hasRecentOrders = Array.isArray(recentOrders) && recentOrders.length > 0;
    
    // Determine if this is a ward stock order (hospital number starts with 'ward-')
    const isWardStock = patientData.hospitalNumber && patientData.hospitalNumber.startsWith('ward-');
    
    // Use appropriate time window in message (2 days for ward stock, 14 days for patient orders)
    const timeWindow = isWardStock ? '2 days' : '14 days';
    
    res.json({
      success: true,
      recentOrders,
      warning: hasRecentOrders,
      warningMessage: hasRecentOrders ? 
        `This medication was ordered ${recentOrders.length > 1 ? recentOrders.length + ' times' : 'once'} in the last ${timeWindow}` : 
        null
    });
  } catch (error) {
    console.error('Error checking recent medication orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking recent medication orders',
      error: error.message
    });
  }
});

/**
 * GET /api/orders
 * Get all orders with optional filtering
 * Accessible to admin, pharmacy, and ordering roles
 * Now supports medication search with ?search=medication&medicationName=xyz parameter
 */
router.get('/', hasRole(['admin', 'pharmacy', 'ordering']), async (req, res) => {
  try {
    // Check if this is a medication search request
    if (req.query.search === 'medication' && req.query.medicationName) {
      console.log('Processing medication search for:', req.query.medicationName);
      
      const options = {
        limit: req.query.limit ? parseInt(req.query.limit) : 50,
        wardId: req.query.wardId || null,
        searchTokens: req.query.searchTokens ? req.query.searchTokens.split(',') : []
      };
      
      console.log('Search options:', options);
      
      // Use advanced search if we have tokens or wardId
      let orders;
      if (options.searchTokens.length > 0 || options.wardId) {
        orders = await OrderModel.advancedOrderSearch(req.query.medicationName, options);
      } else {
        // Fall back to the basic search if no tokens or wardId
        orders = await OrderModel.searchOrdersByMedication(req.query.medicationName, options);
      }
      
      return res.json({
        success: true,
        orders,
        count: orders.length
      });
    }
    
    // Standard order filtering
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
  // Debug log to verify route is called
  console.log('POST /api/orders called with body:', JSON.stringify(req.body, null, 2));
  console.log('Request headers:', JSON.stringify(req.headers, null, 2));
  try {
    const { id, type, wardId, patient, medications, requester, notes } = req.body;
    
    // Validate required fields
    if (!type || !wardId || !medications || !requester) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: type, wardId, medications, and requester are all required'
      });
    }
    
    // id is optional - will be auto-generated if not provided
    
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
    
    // Get the full order data to return to the client
    const fullOrder = await OrderModel.getOrderById(result.id);
    
    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      orderId: result.id,
      order: fullOrder
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
 * Update an order's status, processing information, or medication details
 * Accessible to pharmacy and ordering roles
 */
// ---------------------------------------------
// PUT /api/orders/:id/status – update order status only
// ---------------------------------------------
router.put('/:id/status', hasRole(['pharmacy', 'ordering']), async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status field is required'
      });
    }

    // Validate status value
    const allowedStatuses = ['pending', 'in-progress', 'processing', 'unfulfilled', 'completed', 'cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status value. Allowed: ${allowedStatuses.join(', ')}`
      });
    }

    // Update order via existing model method
    const updateResult = await OrderModel.updateOrder(orderId, { status });

    if (!updateResult.success) {
      return res.status(404).json({
        success: false,
        message: updateResult.message || 'Order not found'
      });
    }

    // Optionally return updated order data
    const updatedOrder = await OrderModel.getOrderById(orderId);

    return res.json({
      success: true,
      message: 'Order status updated successfully',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating order status',
      error: error.message
    });
  }
});

// ---------------------------------------------
// PUT /api/orders/:id – full/partial order update
// ---------------------------------------------
router.put('/:id', hasRole(['pharmacy', 'ordering']), async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status, processedBy, checkedBy, processingNotes, medications, notes } = req.body;

    // Validate status if provided
    if (status && !['pending', 'in-progress', 'processing', 'unfulfilled', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order status'
      });
    }
    
    // Validate medications if provided
    if (medications && Array.isArray(medications)) {
      // Validate each medication has required fields
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
    }

    // Track if we need to update medications separately
    let medicationsUpdated = false;
    let basicUpdateResult = { success: true };
    
    // If medications are provided, use the dedicated method to update them
    if (medications && Array.isArray(medications)) {
      try {
        // Get current user info for audit trail
        const modifiedBy = req.user ? req.user.username : 'system';
        
        // Update medications with proper audit trail
        const medResult = await OrderModel.updateOrderMedications(orderId, {
          medications,
          modifiedBy,
          reason: 'Medication details updated via API'
        });
        
        if (!medResult.success) {
          return res.status(404).json({
            success: false,
            message: medResult.message || 'Failed to update medications'
          });
        }
        
        medicationsUpdated = true;
        console.log('Medications updated successfully');
      } catch (medError) {
        console.error('Error updating medications:', medError);
        return res.status(500).json({
          success: false,
          message: 'Error updating medications',
          error: medError.message
        });
      }
    }
    
    // Only update basic fields if there are any to update
    if (status || processedBy || checkedBy || processingNotes || notes !== undefined) {
      // Update the basic order fields
      basicUpdateResult = await OrderModel.updateOrder(orderId, {
        status,
        processedBy,
        checkedBy,
        processingNotes,
        notes // Add notes to update payload
      });
      
      if (!basicUpdateResult.success && !medicationsUpdated) {
        return res.status(404).json({
          success: false,
          message: 'Order not found or no changes made'
        });
      }
    }

    res.json({
      success: true,
      message: medicationsUpdated ? 
        'Order and medications updated successfully' : 
        'Order updated successfully'
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
 * GET /api/orders/search/medication
 * Search for orders by medication name
 * Accessible to admin, pharmacy, and ordering roles
 */
router.get('/search/medication', async (req, res) => {
  try {
    const { medicationName, limit } = req.query;
    
    if (!medicationName) {
      return res.status(400).json({
        success: false,
        message: 'Medication name is required for search'
      });
    }
    
    const options = {
      limit: limit ? parseInt(limit) : 50
    };
    
    const orders = await OrderModel.searchOrdersByMedication(medicationName, options);
    
    res.json({
      success: true,
      orders,
      count: orders.length
    });
  } catch (error) {
    console.error('Error searching orders by medication:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching orders',
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
 * Accessible to admin, pharmacy and ordering roles
 */
router.get('/:id/history', hasRole(['admin', 'pharmacy', 'ordering']), async (req, res) => {
  try {
    const orderId = req.params.id;
    console.log(`[DEBUG] Getting history for order: ${orderId}`);
    const historyResult = await OrderModel.getOrderHistory(orderId);
    
    if (!historyResult) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order history not found' 
      });
    }
    
    // Extract the history array directly instead of nesting it
    // This avoids the double-nesting issue where frontend receives {success:true, history:{success:true, history:[...]}}  
    res.json({
      success: true,
      history: historyResult.history || [],
      pagination: historyResult.pagination || null
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
