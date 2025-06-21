/**
 * Unit tests for ward stock recent order checking feature
 * Tests the 2-day window logic specifically for ward stock orders
 */

const OrderModel = require('../models/order');
const { db } = require('../db/init');
const encryption = require('../utils/encryption');
const { expect } = require('chai');
const sinon = require('sinon');

describe('Ward Stock Recent Orders Check', () => {
  // Database stub
  let dbStub;
  
  // Test data
  const testWardData = {
    hospitalNumber: 'ward-test123', // Format used to identify ward stock orders
    nhsNumber: null,
    patientName: null
  };
  
  const testMedications = [
    { name: 'Paracetamol 500mg', quantity: '30' },
    { name: 'Amoxicillin 250mg', quantity: '21' }
  ];

  beforeEach(() => {
    // Stub encryption methods to avoid needing actual keys
    sinon.stub(encryption, 'isEncryptionConfigured').returns(false);
    
    // Stub database all method
    dbStub = sinon.stub(db, 'all');
  });

  afterEach(() => {
    // Restore all stubs
    sinon.restore();
  });

  it('should use a 2-day window for ward stock orders', async () => {
    // Setup test data
    const today = new Date();
    const oneDayAgo = new Date(today);
    oneDayAgo.setDate(today.getDate() - 1);
    
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);
    
    // Mock DB response with two orders - one within 2 days, one outside
    dbStub.callsFake((query, params, callback) => {
      // First call is for direct debugging query
      if (query.includes('DEBUGGING')) {
        callback(null, []);
        return;
      }
      
      // Check that query includes the correct date range
      expect(query).to.include('o.timestamp >= ?');
      expect(query).to.include('o.type = "ward-stock"');
      
      // Check if the ward ID is properly passed as a parameter
      expect(params).to.include('ward-test123');
      
      // Return mock results - only the one from yesterday (within 2 days)
      callback(null, [
        {
          id: 'recent-order',
          type: 'ward-stock',
          timestamp: oneDayAgo.toISOString(),
          status: 'pending',
          requester_name: 'Test User',
          ward_id: 'test123',
          medication_name: 'Paracetamol 500mg',
          dose: null,
          quantity: '30',
          formulation: 'tablets',
          patient_name: null,
          patient_hospital_id: null,
          patient_nhs: null
        }
      ]);
    });

    // Call the function
    const result = await OrderModel.checkRecentMedicationOrders(testWardData, testMedications);
    
    // Verify results
    expect(result).to.be.an('array');
    expect(result.length).to.equal(1);
    expect(result[0].medication.name).to.equal('Paracetamol 500mg');
    expect(result[0].type).to.equal('ward-stock');
  });

  it('should not return ward stock orders older than 2 days', async () => {
    // Setup test data for orders outside 2-day window
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    // Mock DB with only orders outside the 2-day window
    dbStub.callsFake((query, params, callback) => {
      // First call is for direct debugging query
      if (query.includes('DEBUGGING')) {
        callback(null, []);
        return;
      }
      
      // For the real query, return empty results
      // This simulates that orders from 3+ days ago are filtered out by SQL WHERE clause
      callback(null, []);
    });

    // Call the function
    const result = await OrderModel.checkRecentMedicationOrders(testWardData, testMedications);
    
    // Verify results - should be empty since all orders are outside the 2-day window
    expect(result).to.be.an('array');
    expect(result.length).to.equal(0);
  });

  it('should identify ward stock orders by the ward- prefix', async () => {
    // Mock DB to verify the ward ID detection logic
    dbStub.callsFake((query, params, callback) => {
      // First call is for direct debugging query
      if (query.includes('DEBUGGING')) {
        callback(null, []);
        return;
      }
      
      // Instead of returning results, we'll just verify that the query
      // properly identified this as a ward stock request
      expect(query).to.include('o.type = "ward-stock"');
      
      callback(null, []);
    });

    // Call the function
    await OrderModel.checkRecentMedicationOrders(testWardData, testMedications);
    
    // The assertion is in the stub, this is just to ensure it gets called
    expect(dbStub.called).to.be.true;
  });
});
