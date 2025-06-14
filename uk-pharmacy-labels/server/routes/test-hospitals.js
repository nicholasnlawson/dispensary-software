/**
 * Test route for debugging hospital field persistence
 */
const express = require('express');
const router = express.Router();
const wardModel = require('../models/ward'); // Reusing the ward model
const { verifyToken, hasRole } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(verifyToken);

/**
 * Test update a hospital's postcode and phone
 */
router.post('/:id/test-update', hasRole('admin'), async (req, res) => {
  try {
    const id = req.params.id;
    const testData = {
      name: `Test Hospital ${new Date().toISOString().substring(0, 10)}`,
      address: 'Updated Test Address',
      postcode: 'AB12 3CD',
      phone: '01234 567890'
    };
    
    // Update the hospital
    const updatedHospital = await wardModel.updateHospital(
      id,
      testData,
      req.user.id,
      req.ip
    );
    
    // Fetch it again to verify the data was persisted
    const verifiedHospital = await wardModel.getHospitalById(id, req.user.id, req.ip);
    
    res.json({
      success: true,
      message: 'Hospital test update completed',
      originalUpdate: testData,
      updatedHospital,
      verifiedHospital
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error in test update', 
      error: error.message 
    });
  }
});

module.exports = router;
