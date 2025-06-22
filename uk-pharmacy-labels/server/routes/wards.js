/**
 * Ward API Routes
 * 
 * RESTful API for ward and hospital management
 */
const express = require('express');
const router = express.Router();
const wardModel = require('../models/ward');
const { verifyToken, hasRole, hasFullAdminAccess } = require('../middleware/auth');
const logger = require('../utils/logger');

// Apply authentication middleware to all routes
router.use(verifyToken);

/**
 * Get all wards
 * Accessible to admin, pharmacy, and ordering roles
 */
router.get('/', async (req, res) => {
  try {
    const wards = await wardModel.getAllWards(req.user.id, req.ip);
    res.json({
      success: true,
      wards
    });
  } catch (error) {
    logger.logError(req.user?.id, error, { route: '/wards' }, req.ip);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching wards', 
      error: error.message 
    });
  }
});

/**
 * Get ward by ID
 * Accessible to admin, pharmacy, and ordering roles
 */
router.get('/:id', async (req, res) => {
  try {
    const ward = await wardModel.getWardById(req.params.id, req.user.id, req.ip);
    
    if (!ward) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ward not found' 
      });
    }
    
    res.json({
      success: true,
      ward
    });
  } catch (error) {
    logger.logError(req.user?.id, error, { route: `/wards/${req.params.id}` }, req.ip);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching ward', 
      error: error.message 
    });
  }
});

/**
 * Create new ward
 * Full admin only (admin or super-admin)
 */
router.post('/', hasFullAdminAccess(), async (req, res) => {
  try {
    const { name, description, hospital_id, is_active } = req.body;
    
    // Validate required fields
    if (!name) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ward name is required' 
      });
    }
    
    const ward = await wardModel.createWard(req.body, req.user.id, req.ip);
    
    res.status(201).json({
      success: true,
      message: 'Ward created successfully',
      ward
    });
  } catch (error) {
    logger.logError(req.user?.id, error, { route: '/wards', action: 'CREATE' }, req.ip);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating ward', 
      error: error.message 
    });
  }
});

/**
 * Update ward
 * Full admin only (admin or super-admin)
 */
router.put('/:id', hasFullAdminAccess(), async (req, res) => {
  try {
    const ward = await wardModel.updateWard(
      req.params.id,
      req.body,
      req.user.id,
      req.ip
    );
    
    res.json({
      success: true,
      message: 'Ward updated successfully',
      ward
    });
  } catch (error) {
    logger.logError(req.user?.id, error, { route: `/wards/${req.params.id}`, action: 'UPDATE' }, req.ip);
    
    if (error.message === 'Ward not found') {
      return res.status(404).json({ 
        success: false, 
        message: 'Ward not found' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Error updating ward', 
      error: error.message 
    });
  }
});

/**
 * Delete ward
 * Full admin only (admin or super-admin)
 */
router.delete('/:id', hasFullAdminAccess(), async (req, res) => {
  try {
    const success = await wardModel.deleteWard(req.params.id, req.user.id, req.ip);
    
    if (!success) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ward not found' 
      });
    }
    
    res.json({
      success: true,
      message: 'Ward deleted successfully'
    });
  } catch (error) {
    logger.logError(req.user?.id, error, { route: `/wards/${req.params.id}`, action: 'DELETE' }, req.ip);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting ward', 
      error: error.message 
    });
  }
});

/**
 * Get all hospitals
 * Accessible to admin, pharmacy, and ordering roles
 */
router.get('/hospitals/all', async (req, res) => {
  try {
    const hospitals = await wardModel.getAllHospitals(req.user.id, req.ip);
    res.json({
      success: true,
      hospitals
    });
  } catch (error) {
    logger.logError(req.user?.id, error, { route: '/wards/hospitals/all' }, req.ip);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching hospitals', 
      error: error.message 
    });
  }
});

/**
 * Get hospital by ID
 * Accessible to admin, pharmacy, and ordering roles
 */
router.get('/hospitals/:id', async (req, res) => {
  try {
    const hospital = await wardModel.getHospitalById(req.params.id, req.user.id, req.ip);
    
    if (!hospital) {
      return res.status(404).json({ 
        success: false, 
        message: 'Hospital not found' 
      });
    }
    
    res.json({
      success: true,
      hospital
    });
  } catch (error) {
    logger.logError(req.user?.id, error, { route: `/wards/hospitals/${req.params.id}` }, req.ip);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching hospital', 
      error: error.message 
    });
  }
});

/**
 * Create new hospital
 * Admin only
 */
router.post('/hospitals', hasRole('admin'), async (req, res) => {
  try {
    const { name, address } = req.body;
    
    // Validate required fields
    if (!name) {
      return res.status(400).json({ 
        success: false, 
        message: 'Hospital name is required' 
      });
    }
    
    const hospital = await wardModel.createHospital(req.body, req.user.id, req.ip);
    
    res.status(201).json({
      success: true,
      message: 'Hospital created successfully',
      hospital
    });
  } catch (error) {
    logger.logError(req.user?.id, error, { route: '/wards/hospitals', action: 'CREATE' }, req.ip);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating hospital', 
      error: error.message 
    });
  }
});

/**
 * Update hospital
 * Admin only
 */
router.put('/hospitals/:id', hasRole('admin'), async (req, res) => {
  try {
    const hospital = await wardModel.updateHospital(
      req.params.id,
      req.body,
      req.user.id,
      req.ip
    );
    
    res.json({
      success: true,
      message: 'Hospital updated successfully',
      hospital
    });
  } catch (error) {
    logger.logError(req.user?.id, error, { route: `/wards/hospitals/${req.params.id}`, action: 'UPDATE' }, req.ip);
    
    if (error.message === 'Hospital not found') {
      return res.status(404).json({ 
        success: false, 
        message: 'Hospital not found' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Error updating hospital', 
      error: error.message 
    });
  }
});

/**
 * Delete hospital
 * Admin only
 */
router.delete('/hospitals/:id', hasRole('admin'), async (req, res) => {
  try {
    const success = await wardModel.deleteHospital(req.params.id, req.user.id, req.ip);
    
    if (!success) {
      return res.status(404).json({ 
        success: false, 
        message: 'Hospital not found' 
      });
    }
    
    res.json({
      success: true,
      message: 'Hospital deleted successfully'
    });
  } catch (error) {
    logger.logError(req.user?.id, error, { route: `/wards/hospitals/${req.params.id}`, action: 'DELETE' }, req.ip);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting hospital', 
      error: error.message 
    });
  }
});

module.exports = router;
