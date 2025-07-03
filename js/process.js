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
        const card = document.createElement('div');
        card.className = 'card';

        // Create a content div that wraps all card content except the button container
        const content = document.createElement('div');
        content.innerHTML = `
            <h3>${order.customerName}</h3>
            <p><strong>Flat:</strong> ${order.customerFlat} 
                <br/><strong>Phone:</strong> ${order.phoneNumber} 
                <br/><strong>Delivery Slot:</strong> ${order.deliverySlot} 
                <br/><strong>Status:</strong> ${order.status} 
                <br/><br/><strong>Items:</strong>
            </p>
            <ul>
                ${order.items.map(item => `<li>${item.quantity} x ${item.name} (${item.variation ?? item.type})</li>`).join('')}
            </ul>
            <p style="color: #c1464c;"><strong>Total Amount: ₹${order.totalAmount}</strong></p> 
        `;
        card.appendChild(content);

        // Append button container at the bottom
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-container';
        buttonContainer.innerHTML = `
            <button class="small-button bg-blue" onclick="updateStatus('${order.orderId}', 'Cooking')" ${isPastStatus(order.status, 'Cooking') ? 'disabled' : ''}><i class="fas fa-utensils"></i></button>
            <button class="small-button bg-brown" onclick="updateStatus('${order.orderId}', 'Packed')" ${isPastStatus(order.status, 'Packed') ? 'disabled' : ''}><i class="fas fa-box"></i></button>
            <button class="small-button bg-green" onclick="updateStatus('${order.orderId}', 'Delivered')" ${isPastStatus(order.status, 'Delivered') ? 'disabled' : ''}><i class="fas fa-truck"></i></button>
            <button class="small-button bg-red" onclick="updateStatus('${order.orderId}', 'Cancelled')" ${isPastStatus(order.status, 'Cancelled') ? 'disabled' : ''}><i class="fas fa-times"></i></button>
        `;
        card.appendChild(buttonContainer);

        container.appendChild(card);
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