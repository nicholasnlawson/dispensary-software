/**
 * Remote Ordering System
 * Order Manager Module
 * Handles order data management, storage, and retrieval
 */

const OrderManager = {
    // Data storage
    orders: [],
    nextOrderId: 1,
    
    /**
     * Initialize the order manager
     */
    init() {
        // Load existing orders from localStorage
        this.loadOrders();
        
        // Set up initial nextOrderId based on existing orders
        if (this.orders.length > 0) {
            // Find the highest ID and set nextOrderId to one more
            const highestId = Math.max(...this.orders.map(order => parseInt(order.id.replace('ORD', ''))));
            this.nextOrderId = highestId + 1;
        }
        
        console.log('Order Manager initialized with', this.orders.length, 'orders');
    },
    
    /**
     * Load orders from localStorage
     */
    loadOrders() {
        try {
            const savedOrders = localStorage.getItem('pharmacy_orders');
            if (savedOrders) {
                this.orders = JSON.parse(savedOrders);
            }
        } catch (error) {
            console.error('Error loading orders:', error);
            this.orders = [];
        }
    },
    
    /**
     * Save orders to localStorage
     */
    saveOrders() {
        try {
            localStorage.setItem('pharmacy_orders', JSON.stringify(this.orders));
        } catch (error) {
            console.error('Error saving orders:', error);
        }
    },
    
    /**
     * Create a new order
     * @param {Object} orderData - Order data
     * @returns {Object} - Created order object
     */
    createOrder(orderData) {
        const orderId = `ORD${String(this.nextOrderId).padStart(6, '0')}`;
        
        // Set default urgency to 'routine' if not provided
        if (!orderData.urgency) {
            orderData.urgency = 'routine';
        }
        
        // Validate required fields
        if (orderData.type === 'patient') {
            // Patient order validation
            if (!orderData.patient || !orderData.patient.name) {
                throw new Error('Patient name is required');
            }
            if (!orderData.patient.hospitalId) {
                throw new Error('Hospital ID is required');
            }
        }
        
        // Always validate ward
        if (!orderData.ward) {
            throw new Error('Ward selection is required');
        }
        
        // Always validate medications
        if (!orderData.medications || !orderData.medications.length) {
            throw new Error('At least one medication is required');
        }
        
        const order = {
            id: orderId,
            timestamp: new Date().toISOString(),
            status: 'pending',
            ...orderData
        };
        
        this.orders.push(order);
        this.nextOrderId += 1;
        this.saveOrders();
        
        return order;
    },
    
    /**
     * Get order by ID
     * @param {string} orderId - Order ID
     * @returns {Object|null} - Order object or null if not found
     */
    getOrderById(orderId) {
        return this.orders.find(order => order.id === orderId) || null;
    },
    
    /**
     * Update an existing order
     * @param {string} orderId - Order ID
     * @param {Object} updateData - Data to update
     * @returns {Object|null} - Updated order or null if not found
     */
    updateOrder(orderId, updateData) {
        const orderIndex = this.orders.findIndex(order => order.id === orderId);
        
        if (orderIndex === -1) {
            return null;
        }
        
        // Create a new order object with updated properties
        this.orders[orderIndex] = {
            ...this.orders[orderIndex],
            ...updateData,
            lastUpdated: new Date().toISOString()
        };
        
        this.saveOrders();
        return this.orders[orderIndex];
    },
    
    /**
     * Delete an order by ID
     * @param {string} orderId - Order ID
     * @returns {boolean} - True if deleted, false if not found
     */
    deleteOrder(orderId) {
        const initialLength = this.orders.length;
        this.orders = this.orders.filter(order => order.id !== orderId);
        
        if (this.orders.length !== initialLength) {
            this.saveOrders();
            return true;
        }
        
        return false;
    },
    
    /**
     * Get orders with filtering
     * @param {Object} filters - Filter options
     * @returns {Array} - Filtered orders
     */
    getOrders(filters = {}) {
        let filteredOrders = [...this.orders];
        
        // Apply filters
        if (filters.status && filters.status !== 'all') {
            filteredOrders = filteredOrders.filter(order => order.status === filters.status);
        }
        
        if (filters.urgency && filters.urgency !== 'all') {
            filteredOrders = filteredOrders.filter(order => order.urgency === filters.urgency);
        }
        
        if (filters.ward && filters.ward !== 'all') {
            filteredOrders = filteredOrders.filter(order => order.ward === filters.ward);
        }
        
        if (filters.type && filters.type !== 'all') {
            filteredOrders = filteredOrders.filter(order => order.type === filters.type);
        }
        
        // Sort by timestamp (newest first) then by urgency
        filteredOrders.sort((a, b) => {
            // Sort by urgency (emergency > urgent > routine)
            const urgencyOrder = { 'emergency': 0, 'urgent': 1, 'routine': 2 };
            if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
                return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
            }
            
            // Then by timestamp (newest first)
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        return filteredOrders;
    },
    
    /**
     * Get statistics about orders
     * @returns {Object} - Order statistics
     */
    getOrderStatistics() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Count orders by status
        const pendingCount = this.orders.filter(order => order.status === 'pending').length;
        
        // Count urgent orders that are pending
        const urgentCount = this.orders.filter(
            order => order.status === 'pending' && 
            (order.urgency === 'urgent' || order.urgency === 'emergency')
        ).length;
        
        // Count orders completed today
        const completedToday = this.orders.filter(order => {
            const orderDate = new Date(order.lastUpdated || order.timestamp);
            return order.status === 'completed' && orderDate >= today;
        }).length;
        
        // Calculate average processing time for completed orders
        const completedOrders = this.orders.filter(order => order.status === 'completed' && order.processingTime);
        let averageTime = 0;
        if (completedOrders.length > 0) {
            const totalTime = completedOrders.reduce((sum, order) => sum + order.processingTime, 0);
            averageTime = Math.round(totalTime / completedOrders.length);
        }
        
        return {
            pendingCount,
            urgentCount,
            completedToday,
            averageProcessingTime: averageTime
        };
    },
    
    /**
     * Process an order and update its status
     * @param {string} orderId - Order ID
     * @param {Object} processingData - Processing data
     * @returns {Object|null} - Updated order or null if not found
     */
    processOrder(orderId, processingData) {
        const order = this.getOrderById(orderId);
        
        if (!order) {
            return null;
        }
        
        // Calculate processing time (in minutes)
        const startTime = new Date(order.timestamp).getTime();
        const endTime = new Date().getTime();
        const processingTime = Math.round((endTime - startTime) / (1000 * 60));
        
        const updatedOrder = this.updateOrder(orderId, {
            status: 'completed',
            processingTime,
            processedBy: processingData.suppliedBy,
            checkedBy: processingData.checkedBy,
            processingNotes: processingData.notes,
            completedAt: new Date().toISOString()
        });
        
        return updatedOrder;
    }
};

// Auto-initialize when the script loads
document.addEventListener('DOMContentLoaded', () => {
    OrderManager.init();
});
