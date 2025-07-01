/**
 * Dispensary API Routes
 *
 * RESTful API for dispensary management
 */
const express = require('express');
const router = express.Router();
const dispensaryModel = require('../models/dispensary');
const { verifyToken, hasRole, hasFullAdminAccess } = require('../middleware/auth');
const logger = require('../utils/logger');

// Apply authentication middleware to all routes
router.use(verifyToken);

/**
 * Get all dispensaries
 * Accessible to admin, pharmacy, and ordering roles
 */
router.get('/', async (req, res) => {
  try {
    const dispensaries = await dispensaryModel.getAllDispensaries(req.user.id, req.ip);
    res.json({
      success: true,
      dispensaries
    });
  } catch (error) {
    logger.logError(req.user?.id, error, { route: '/dispensaries' }, req.ip);
    res.status(500).json({
      success: false,
      message: 'Error fetching dispensaries',
      error: error.message
    });
  }
});

/**
 * Get dispensary by ID
 * Accessible to admin, pharmacy, and ordering roles
 */
router.get('/:id', async (req, res) => {
  try {
    const dispensary = await dispensaryModel.getDispensaryById(req.params.id, req.user.id, req.ip);
    if (!dispensary) {
      return res.status(404).json({
        success: false,
        message: 'Dispensary not found'
      });
    }
    res.json({
      success: true,
      dispensary
    });
  } catch (error) {
    logger.logError(req.user?.id, error, { route: `/dispensaries/${req.params.id}` }, req.ip);
    res.status(500).json({
      success: false,
      message: 'Error fetching dispensary',
      error: error.message
    });
  }
});

/**
 * Create new dispensary
 * Full admin only (admin or super-admin)
 */
router.post('/', hasFullAdminAccess(), async (req, res) => {
  try {
    const { name, description, hospital_id } = req.body;
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Dispensary name is required'
      });
    }
    const dispensary = await dispensaryModel.createDispensary(req.body, req.user.id, req.ip);
    res.status(201).json({
      success: true,
      message: 'Dispensary created successfully',
      dispensary
    });
  } catch (error) {
    logger.logError(req.user?.id, error, { route: '/dispensaries', action: 'CREATE' }, req.ip);
    res.status(500).json({
      success: false,
      message: 'Error creating dispensary',
      error: error.message
    });
  }
});

/**
 * Update dispensary
 * Full admin only (admin or super-admin)
 */
router.put('/:id', hasFullAdminAccess(), async (req, res) => {
  try {
    const dispensary = await dispensaryModel.updateDispensary(req.params.id, req.body, req.user.id, req.ip);
    res.json({
      success: true,
      message: 'Dispensary updated successfully',
      dispensary
    });
  } catch (error) {
    logger.logError(req.user?.id, error, { route: `/dispensaries/${req.params.id}`, action: 'UPDATE' }, req.ip);
    if (error.message === 'Dispensary not found') {
      return res.status(404).json({
        success: false,
        message: 'Dispensary not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error updating dispensary',
      error: error.message
    });
  }
});

/**
 * Delete dispensary
 * Full admin only (admin or super-admin)
 */
router.delete('/:id', hasFullAdminAccess(), async (req, res) => {
  try {
    const success = await dispensaryModel.deleteDispensary(req.params.id, req.user.id, req.ip);
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Dispensary not found'
      });
    }
    res.json({
      success: true,
      message: 'Dispensary deleted successfully'
    });
  } catch (error) {
    logger.logError(req.user?.id, error, { route: `/dispensaries/${req.params.id}`, action: 'DELETE' }, req.ip);
    res.status(500).json({
      success: false,
      message: 'Error deleting dispensary',
      error: error.message
    });
  }
});

module.exports = router;
