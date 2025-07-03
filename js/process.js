async function fetchOrders() {
    try {
        const response = await fetch(API_URL + `?type=orders`);
        orders = await response.json();
        orders = Array.isArray(orders) ? orders : [];

        // console.log(orders);

        loadOrders();
        return orders;
    } catch (error) {
        console.error('Failed to fetch orders:', error);
        showLoader(false);
        return [];
    }
}

function isPastStatus(currentStatus, checkStatus) {
    const statusLevels = {
        'Received': 1,
        'Cooking': 2,
        'Packed': 3,
        'Delivered': 4,
        'Cancelled': 5
    };
    return statusLevels[currentStatus] >= statusLevels[checkStatus];
}

async function loadOrders() {
    orders = await fetchOrders();
    if (!orders) {
        showLoader(false);
        console.error('Failed to load orders.');
        return;
    }

    const container = document.getElementById('orders-container');
    container.innerHTML = ''; // Clear previous entries

    orders.forEach(order => {
        const row = document.createElement('tr');
        row.className = 'orders-row';

        // Customer Cell
        const customerCell = document.createElement('td');
        customerCell.className = 'orders-customer-cell';
        customerCell.innerHTML = `
            <div>${order.customerName}</div>
            <div style="font-size: 0.75rem; color: #7f8c8d; margin-top: 2px;">Flat: ${order.customerFlat}</div>
        `;

        // Contact Cell
        const contactCell = document.createElement('td');
        contactCell.className = 'orders-contact-cell';
        contactCell.textContent = order.phoneNumber;

        // Delivery Cell
        const deliveryCell = document.createElement('td');
        deliveryCell.className = 'orders-delivery-cell';
        deliveryCell.textContent = order.deliverySlot;

        // Items Cell
        const itemsCell = document.createElement('td');
        itemsCell.className = 'orders-items-cell';
        const itemsList = document.createElement('ul');
        itemsList.className = 'orders-items-list';
        order.items.forEach(item => {
            const listItem = document.createElement('li');
            listItem.textContent = `${item.quantity} x ${item.name} (${item.variation ?? item.type})`;
            itemsList.appendChild(listItem);
        });
        itemsCell.appendChild(itemsList);

        // Amount Cell - Simplified
        const amountCell = document.createElement('td');
        amountCell.className = 'orders-amount-cell';
        amountCell.textContent = `₹${order.totalAmount}`;

        // Status Cell - Simplified
        const statusCell = document.createElement('td');
        statusCell.className = 'orders-status-cell';
        const statusBadge = document.createElement('span');
        statusBadge.className = `status-badge status-${order.status.toLowerCase()}`;
        statusBadge.textContent = order.status;
        statusCell.appendChild(statusBadge);

        // Actions Cell - Simplified
        const actionsCell = document.createElement('td');
        actionsCell.className = 'orders-actions-cell';
        actionsCell.innerHTML = `
            <div class="orders-action-buttons">
                <button class="orders-action-btn bg-blue" onclick="updateStatus('${order.orderId}', 'Cooking')" ${isPastStatus(order.status, 'Cooking') ? 'disabled' : ''}><i class="fas fa-utensils"></i></button>
                <button class="orders-action-btn bg-brown" onclick="updateStatus('${order.orderId}', 'Packed')" ${isPastStatus(order.status, 'Packed') ? 'disabled' : ''}><i class="fas fa-box"></i></button>
                <button class="orders-action-btn bg-green" onclick="updateStatus('${order.orderId}', 'Delivered')" ${isPastStatus(order.status, 'Delivered') ? 'disabled' : ''}><i class="fas fa-truck"></i></button>
                <button class="orders-action-btn bg-red" onclick="updateStatus('${order.orderId}', 'Cancelled')" ${isPastStatus(order.status, 'Cancelled') ? 'disabled' : ''}><i class="fas fa-times"></i></button>
            </div>
        `;

        // Append all cells to row
        row.appendChild(customerCell);
        row.appendChild(contactCell);
        row.appendChild(deliveryCell);
        row.appendChild(itemsCell);
        row.appendChild(amountCell);
        row.appendChild(statusCell);
        row.appendChild(actionsCell);

        container.appendChild(row);
    });
}

async function updateStatus(orderId, status) {
    showLoader(true);

    const formData = {
        action: 'updateOrder',
        orderId: orderId,
        status: status
    };

    try {
        const result = await callAPIviaPOST(formData);
        if (result.status === 'success') {
            alert(`Order status updated!`);
            fetchOrders(); // Refetch orders after updating status
        } else {
            alert('Failed to update the order.');
        }
        showLoader(false);
    } catch (error) {
        showLoader(false);
        alert('Failed to update the order. Check console for logs..');
        console.error('Failed to update order:', error);
    }
}

// Show Prep Summary Modal
function showPrepSummary() {
    const modal = document.getElementById('prep-summary-modal');
    const content = document.getElementById('prep-summary-content');
    
    // Generate summary
    const summary = generatePrepSummary();
    content.innerHTML = summary;
    
    modal.style.display = 'block';
}

// Close Prep Summary Modal
function closePrepSummary() {
    const modal = document.getElementById('prep-summary-modal');
    modal.style.display = 'none';
}

// Generate preparation summary from orders
// Generate preparation summary from orders
function generatePrepSummary() {
    if (!orders || orders.length === 0) {
        return '<p>No orders available for summary.</p>';
    }
    
    // Group items by name, type, and variation
    const itemGroups = {};
    
    orders.forEach(order => {
        // Only include non-cancelled orders
        if (order.status === 'Cancelled') return;
        
        order.items.forEach(item => {
            const key = `${item.name}|${item.type}|${item.variation || 'Standard'}`;
            
            if (!itemGroups[key]) {
                itemGroups[key] = {
                    name: item.name,
                    type: item.type,
                    variation: item.variation || 'Standard',
                    quantity: 0
                };
            }
            
            itemGroups[key].quantity += item.quantity;
        });
    });
    
    // Sort alphabetically by name, then type, then variation
    const sortedItems = Object.values(itemGroups).sort((a, b) => {
        if (a.name !== b.name) return a.name.localeCompare(b.name);
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        return a.variation.localeCompare(b.variation);
    });
    
    if (sortedItems.length === 0) {
        return '<p>No items to prepare.</p>';
    }
    
    // Generate HTML
    let html = `<div class="prep-summary-list">`;
    
    sortedItems.forEach(item => {
        html += `
            <div class="prep-item">
                <div class="prep-item-name">${item.name}</div>
                <div class="prep-item-details">${item.type} - ${item.variation}</div>
                <div class="prep-item-quantity">Quantity: ${item.quantity}</div>
            </div>
        `;
    });
    
    html += `</div>`;
    
    return html;
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('prep-summary-modal');
    if (event.target === modal) {
        closePrepSummary();
    }
}