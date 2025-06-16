/**
 * Unit tests for recent medication order checking feature
 * Tests both encrypted and unencrypted scenarios
 */

const OrderModel = require('../models/order');
const { db } = require('../db/init');
const encryption = require('../utils/encryption');
const { expect } = require('chai');
const sinon = require('sinon');

describe('Recent Medication Orders Check', () => {
  // Database stub
  let dbStub;
  
  // Test data
  const testPatientData = {
    patientName: 'Test Patient',
    nhsNumber: 'NHS12345678',
    hospitalNumber: 'HOSP12345'
  };
  
  const testMedications = [
    { name: 'Amoxicillin', form: 'Capsules', strength: '500mg' }
  ];
  
  // Prepare mock data with pre-formatted "encrypted" values
  // Instead of actually encrypting, we'll just simulate encrypted values with a prefix
  const mockOrders = [
    {
      id: 'test-order-1',
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
      patient_name: 'ENCRYPTED:Test Patient', // Simulate encrypted data with prefix
      patient_hospital_id: 'HOSP12345',
      patient_nhs: 'NHS12345678',
      name: 'Amoxicillin'
    },
    {
      id: 'test-order-2',
      timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
      patient_name: 'ENCRYPTED:Test Patient', // Simulate encrypted data with prefix
      patient_hospital_id: 'HOSP12345',
      patient_nhs: 'NHS12345678',
      name: 'Amoxicillin'
    }
  ];
  
  beforeEach(() => {
    // Setup database stub
    dbStub = sinon.stub(db, 'all');
    
    // Stub encryption methods
    sinon.stub(encryption, 'isEncryptionConfigured').returns(true);
    sinon.stub(encryption, 'encrypt').callsFake(text => `ENCRYPTED:${text}`);
    sinon.stub(encryption, 'decrypt').callsFake(text => {
      // Simple mock that just removes "ENCRYPTED:" prefix if it exists
      return text.replace(/^ENCRYPTED:/, '');
    });
  });
  
  afterEach(() => {
    // Restore all stubs
    sinon.restore();
  });
  
  it('should find recent orders with encrypted patient names using hospital ID', async () => {
    // Setup the stub to return mock data when SQL query is executed
    dbStub.resolves(mockOrders);
    
    const result = await OrderModel.checkRecentMedicationOrders(testPatientData, testMedications);
    
    // Verify results
    expect(result).to.be.an('array');
    expect(result).to.have.lengthOf(2);
    expect(result[0].id).to.equal('test-order-1');
    expect(result[1].id).to.equal('test-order-2');
    
    // Verify the SQL query included hospital ID but not patient name
    const sqlCall = dbStub.getCall(0);
    const sqlQuery = sqlCall.args[0];
    const sqlParams = sqlCall.args[1];
    
    expect(sqlQuery).to.include('order_patients.patient_hospital_id = ?');
    expect(sqlQuery).to.not.include('order_patients.patient_name = ?');
    expect(sqlParams).to.include(testPatientData.hospitalNumber);
  });
  
  it('should find recent orders with encrypted patient names using NHS number', async () => {
    // Setup test without hospital ID but with NHS number
    const patientDataNhsOnly = {
      patientName: 'Test Patient',
      nhsNumber: 'NHS12345678',
      hospitalNumber: null
    };
    
    // Setup the stub to return mock data
    dbStub.resolves(mockOrders);
    
    const result = await OrderModel.checkRecentMedicationOrders(patientDataNhsOnly, testMedications);
    
    // Verify results
    expect(result).to.be.an('array');
    expect(result).to.have.lengthOf(2);
    
    // Verify SQL used NHS number
    const sqlCall = dbStub.getCall(0);
    const sqlQuery = sqlCall.args[0];
    const sqlParams = sqlCall.args[1];
    
    expect(sqlQuery).to.include('order_patients.patient_nhs = ?');
    expect(sqlParams).to.include(patientDataNhsOnly.nhsNumber);
  });
  
  it('should fall back to patient name when encryption is disabled', async () => {
    // Disable encryption for this test
    encryption.isEnabled.returns(false);
    
    // Setup test with only patient name
    const patientNameOnly = {
      patientName: 'Test Patient',
      nhsNumber: null,
      hospitalNumber: null
    };
    
    // Setup the stub to return mock data
    dbStub.resolves(mockOrders);
    
    const result = await OrderModel.checkRecentMedicationOrders(patientNameOnly, testMedications);
    
    // Verify SQL used patient name
    const sqlCall = dbStub.getCall(0);
    const sqlQuery = sqlCall.args[0];
    const sqlParams = sqlCall.args[1];
    
    expect(sqlQuery).to.include('order_patients.patient_name = ?');
    expect(sqlParams).to.include(patientNameOnly.patientName);
  });
  
  it('should only return orders within the last 14 days', async () => {
    // Add an older order outside the 14 day window
    const oldOrder = {
      id: 'test-order-old',
      timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), // 20 days ago
      patient_name: encryption.encrypt('Test Patient'),
      patient_hospital_id: 'HOSP12345',
      patient_nhs: 'NHS12345678',
      name: 'Amoxicillin'
    };
    
    // All orders including old one
    const allOrders = [...mockOrders, oldOrder];
    
    // Setup the stub to return all orders
    dbStub.resolves(allOrders);
    
    const result = await OrderModel.checkRecentMedicationOrders(testPatientData, testMedications);
    
    // Verify SQL has date filter
    const sqlCall = dbStub.getCall(0);
    const sqlQuery = sqlCall.args[0];
    
    expect(sqlQuery).to.include("orders.timestamp > datetime('now', '-14 day')");
    
    // Verify only orders from the last 14 days are returned
    expect(result).to.be.an('array');
    expect(result).to.have.lengthOf(2);
    expect(result.some(order => order.id === 'test-order-old')).to.be.false;
  });
  
  it('should handle partial medication names with LIKE operator', async () => {
    // Setup test with a generic medication name
    const genericMedication = [
      { name: 'Amox' }
    ];
    
    // Setup the stub to return mock data
    dbStub.resolves(mockOrders);
    
    const result = await OrderModel.checkRecentMedicationOrders(testPatientData, genericMedication);
    
    // Verify SQL used LIKE for medication name
    const sqlCall = dbStub.getCall(0);
    const sqlQuery = sqlCall.args[0];
    const sqlParams = sqlCall.args[1];
    
    expect(sqlQuery).to.include('order_medications.name LIKE ?');
    expect(sqlParams).to.include('%Amox%');
  });
});
