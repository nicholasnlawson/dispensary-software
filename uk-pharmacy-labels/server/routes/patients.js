/**
 * Patient API Routes
 * 
 * RESTful API for patient data access with encryption and GDPR-compliant audit logging
 */
const express = require('express');
const router = express.Router();
const patientModel = require('../models/patient');
const { authenticateToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * Get all patients (limited, for authorized users only)
 * Restricted to pharmacy and admin roles
 */
router.get('/', authenticateToken, requireRole(['pharmacy', 'admin']), async (req, res) => {
    try {
        const userId = req.user.id;
        const userIp = req.ip;
        
        // Optional filtering parameters
        const searchParams = {};
        if (req.query.search) {
            searchParams.patientName = req.query.search;
        }
        
        const patients = await patientModel.searchPatients(searchParams, userId, userIp);
        
        // Return patients with limited sensitive information in the list view
        const limitedPatients = patients.map(patient => ({
            id: patient.id,
            patientName: patient.patientName,
            dateOfBirth: patient.dateOfBirth,
            nhsNumber: patient.nhsNumber ? patient.nhsNumber.substr(-4).padStart(10, '*') : null,
            // Omit other sensitive fields
        }));
        
        res.json(limitedPatients);
    } catch (error) {
        logger.logError(req.user?.id, error, { route: '/patients' }, req.ip);
        res.status(500).json({ message: 'Error fetching patients', error: error.message });
    }
});

/**
 * Get patient by ID
 * Restricted to pharmacy and admin roles
 */
router.get('/:id', authenticateToken, requireRole(['pharmacy', 'admin']), async (req, res) => {
    try {
        const patient = await patientModel.getPatientById(req.params.id, req.user.id, req.ip);
        
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }
        
        res.json(patient);
    } catch (error) {
        logger.logError(req.user?.id, error, { 
            route: `/patients/${req.params.id}` 
        }, req.ip);
        res.status(500).json({ message: 'Error fetching patient', error: error.message });
    }
});

/**
 * Create new patient
 * Restricted to pharmacy and admin roles
 */
router.post('/', authenticateToken, requireRole(['pharmacy', 'admin']), async (req, res) => {
    try {
        // Validate required fields
        const { patientName, nhsNumber } = req.body;
        if (!patientName || !nhsNumber) {
            return res.status(400).json({ 
                message: 'Missing required fields: patientName and nhsNumber are required' 
            });
        }
        
        // Create patient with encryption
        const patient = await patientModel.createPatient(req.body, req.user.id, req.ip);
        
        res.status(201).json(patient);
    } catch (error) {
        logger.logError(req.user?.id, error, { 
            route: '/patients', action: 'CREATE' 
        }, req.ip);
        res.status(500).json({ message: 'Error creating patient', error: error.message });
    }
});

/**
 * Update patient by ID
 * Restricted to pharmacy and admin roles
 */
router.put('/:id', authenticateToken, requireRole(['pharmacy', 'admin']), async (req, res) => {
    try {
        // Verify patient exists
        const existingPatient = await patientModel.getPatientById(req.params.id, req.user.id, req.ip);
        
        if (!existingPatient) {
            return res.status(404).json({ message: 'Patient not found' });
        }
        
        // Update patient with encryption
        const updatedPatient = await patientModel.updatePatient(
            req.params.id, 
            req.body, 
            req.user.id,
            req.ip
        );
        
        res.json(updatedPatient);
    } catch (error) {
        logger.logError(req.user?.id, error, { 
            route: `/patients/${req.params.id}`, action: 'UPDATE' 
        }, req.ip);
        res.status(500).json({ message: 'Error updating patient', error: error.message });
    }
});

/**
 * Delete patient by ID
 * Restricted to admin role only (data deletion is sensitive)
 */
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        // Verify patient exists
        const existingPatient = await patientModel.getPatientById(req.params.id, req.user.id, req.ip);
        
        if (!existingPatient) {
            return res.status(404).json({ message: 'Patient not found' });
        }
        
        // Delete patient
        const success = await patientModel.deletePatient(req.params.id, req.user.id, req.ip);
        
        if (success) {
            res.json({ message: 'Patient deleted successfully' });
        } else {
            res.status(500).json({ message: 'Patient deletion failed' });
        }
    } catch (error) {
        logger.logError(req.user?.id, error, { 
            route: `/patients/${req.params.id}`, action: 'DELETE' 
        }, req.ip);
        res.status(500).json({ message: 'Error deleting patient', error: error.message });
    }
});

module.exports = router;
