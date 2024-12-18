const API_URL = 'https://script.google.com/macros/s/AKfycbzRSKMHPLlqIy58Pch6WQvoyd5IHsFjVOnRjKiyyJd9aMdSx8Uw44wohjPeJvFegMNd/exec';

let products = [];
let orders = [];
let cart = [];

window.onload = async function () {
    const workflowContext = document.querySelector('meta[name="workflow-context"]').getAttribute('content');
    showLoader(true);

    if (workflowContext.toLowerCase() === 'intake') {
        const storeType = document.querySelector('meta[name="store-type"]').getAttribute('content');
        products = await fetchProducts(storeType);

        if (!products) {
            showLoader(false);
            console.error('Failed to load products.');
            return;
        }

        if (storeType === 'online') {
            loadProductsForOnlineStore();
            clearExistingDataForOnlineStore();
        } else if (storeType === 'local') {
            loadProductsForLocalStore();
            clearExistingDataForLocalStore();
        }
    }

    if (workflowContext.toLowerCase() === 'process') {
        orders = await fetchOrders();

        if (!orders) {
            showLoader(false);
            console.error('Failed to load orders.');
            return;
        }

        loadOrders();
    }

    showLoader(false);
};

async function fetchProducts(storeType) {
    try {
        const response = await fetch(API_URL + `?type=inventory&storeType=${storeType}`);
        const products = await response.json();
        return Array.isArray(products) ? products : [];
    } catch (error) {
        console.error('Failed to fetch products:', error);
        showLoader(false);
        return [];
    }
}

function showLoader(visible) {
    const loader = document.getElementById('loader');
    loader.style.display = visible ? 'flex' : 'none';
}

//------------ONLINE STORE LOGIC

function loadProductsForOnlineStore() {
    const productsContainer = document.getElementById('products');
    let segments = {};

    products.forEach(product => {
        if (!segments[product.segment]) {
            segments[product.segment] = document.createElement('div');
            segments[product.segment].className = 'segment';
            segments[product.segment].innerHTML = `<h3>${product.segment}</h3>`;
            productsContainer.appendChild(segments[product.segment]);
        }
        const productDiv = document.createElement('div');
        productDiv.className = 'product';
        productDiv.innerHTML = `
            <img src="resources/product-images/${product.imageName}" alt="${product.name}">
            <p class="product-name">${product.name}</p> 
            <p class="product-description">${product.description}</p> 
            <p class="product-price">Price: ₹${product.price}</p> 
            <button title="Add this item to cart" class="add-to-cart" onclick="addToCart(this, '${product.name}', ${product.price})"><i class="fa fa-plus"></i></button> 
            <!-- <button title="Express interest to buy this later" class="interested" onclick="markAsInterested(this, '${product.name}')"><i class="fa fa-heart"></i></button> -->
        `;
        segments[product.segment].appendChild(productDiv);
    });
}

function addToCart(button, name, price) {
    // Create a tooltip element and add it to the button
    let tooltip = document.createElement('span');
    tooltip.className = 'tooltip';

    let item = cart.find(item => item.name === name);
    if (item) {
        item.quantity++;
    } else {
        cart.push({ name, price, quantity: 1 });
    }

    localStorage.setItem('cart', JSON.stringify(cart));  // store cart into local storage
    tooltip.innerText = 'Added to Cart';

    // Show tooltip
    button.parentNode.appendChild(tooltip);
    tooltip.style.visibility = 'visible';
    tooltip.style.opacity = '1';

    // Remove the tooltip after a few seconds
    setTimeout(() => {
        tooltip.style.visibility = 'hidden';
        tooltip.style.opacity = '0';
        button.parentNode.removeChild(tooltip);
    }, 1000);  // 1 second

    updateCartUI();
}

function updateCartUI() {
    const cartItemsContainer = document.getElementById('cart-items');
    cartItemsContainer.innerHTML = '';
    cart.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td>
              <button class="decrease-quantity" onclick="updateQuantityForOnlineStore('${item.name}', ${item.quantity - 1})">-</button>
              <span>${item.quantity}</span>
              <button class="increase-quantity" onclick="updateQuantityForOnlineStore('${item.name}', ${item.quantity + 1})">+</button>
            </td>
            <td><button class="remove-item" onclick="removeItemFromCart('${item.name}')"><i class="fa fa-trash"></i></button></td>
            <td>₹${item.price}</td>
            <td>₹${item.price * item.quantity}</td>
        `;
        cartItemsContainer.appendChild(row);
    });
    updateTotalForOnlineStore();
}

function updateQuantityForOnlineStore(name, newQuantity) {
    if (newQuantity < 1) return; // Prevent negative or zero quantities
    let item = cart.find(item => item.name === name);
    if (item) {
        item.quantity = newQuantity;
    }
    updateCartUI();
}

function removeItemFromCart(name) {
    cart = cart.filter(item => item.name !== name);
    updateCartUI();
}

function updateTotalForOnlineStore() {
    let total = 0;
    cart.forEach(item => {
        total += item.price * item.quantity;
    });
    document.getElementById('total-amount').innerText = `₹${total}`;
}

function validateAndPlaceOnlineOrder(event) {
    event.preventDefault();

    const name = document.getElementById('name');
    const flat = document.getElementById('flat');
    const phone = document.getElementById('phone');
    const email = document.getElementById('email');

    let isFormValid = true;

    // Reset previous tooltips
    [name, flat, phone, email].forEach(input => {
        input.classList.remove('error');
        input.removeAttribute('data-error');
    });

    if (!name.value.trim()) {
        name.classList.add('error');
        name.setAttribute('data-error', 'Please enter your name');
        isFormValid = false;
    }
    if (!flat.value.trim()) {
        flat.classList.add('error');
        flat.setAttribute('data-error', 'Please enter your Tower & Flat No.');
        isFormValid = false;
    }
    if (!phone.value.trim()) {
        phone.classList.add('error');
        phone.setAttribute('data-error', 'Please enter your phone number');
        isFormValid = false;
    }
    if (!email.value.trim()) {
        email.classList.add('error');
        email.setAttribute('data-error', 'Please enter your email');
        isFormValid = false;
    }

    if (isFormValid) {
        placeOnlineOrder();
    } else {
        console.error("Form validation failed.");
    }
}

async function placeOnlineOrder() {
    showLoader(true);
    const cartItems = JSON.parse(localStorage.getItem('cart') || '[]');
    const interestedItems = JSON.parse(localStorage.getItem('interestedItems') || '[]');

    // Combine cartItems and interestedItems into a single array
    const combinedItems = [
        ...cartItems.map(item => ({ ...item, type: 'ordered' })),
        ...interestedItems.map(item => ({ name: item, type: 'interested' }))
    ];

    const formData = {
        action: 'insert',
        storeType: 'online',
        name: document.getElementById('name').value,
        flat: document.getElementById('flat').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        items: combinedItems,  // Pass the combined items array
        totalAmount: document.getElementById('total-amount').textContent.split('₹')[1],
        userAgent: navigator.userAgent,
        user_ip: await fetchIPAddress()
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            mode: "cors",
            cache: "no-cache",
            headers: {
                "Content-Type": "text/plain",
            },
            redirect: "follow",
            body: JSON.stringify(formData)
        });

        const result = await response.json();
        showLoader(false);

        if (result.status === 'success') {
            alert(`Order placed! Your order ID is ${result.orderId}.`);
            //alert(`Data submitted, Thank you!`);
            clearExistingDataForOnlineStore();
        } else {
            alert('Failed to place the order.');
        }
    } catch (error) {
        showLoader(false);
        alert('Failed to place the order. Check console for logs..');
        console.error('Failed to place order:', error);
    }
}

function clearExistingDataForOnlineStore() {
    localStorage.clear();  // Clear local storage
    clearCustomerInfoForOnlineStore(); // Clear customer inputs
    clearOrderDetailsForOnlineStore();  // Clear order details
    //clearInterestedItemsForOnlineStore();  // Clear interested items
}

function clearCustomerInfoForOnlineStore() {
    document.getElementById('name').value = '';
    document.getElementById('flat').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('email').value = '';
}

function clearOrderDetailsForOnlineStore() {
    cart = [];
    updateCartUI();
    document.getElementById('total-amount').innerText = '₹0'; // Reset total amount
}

function clearInterestedItemsForOnlineStore() {
    const list = document.getElementById('interested-list');
    list.innerHTML = ''; // Clear inner HTML to remove all items
}

async function fetchIPAddress() {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
}

function markAsInterested(button, productName) {
    // console.log("Expressed interest in:", productName); 

    // Create a tooltip element and add it to the button
    let tooltip = document.createElement('span');
    tooltip.className = 'tooltip';

    let interestedItems = JSON.parse(localStorage.getItem('interestedItems') || '[]');
    if (!interestedItems.includes(productName)) {
        interestedItems.push(productName);
        localStorage.setItem('interestedItems', JSON.stringify(interestedItems));
        updateInterestedItems();
        tooltip.innerText = 'Added to Wishlist';
    }
    else {
        tooltip.innerText = 'Already in Wishlist';
    }

    // Show tooltip
    button.parentNode.appendChild(tooltip);
    tooltip.style.visibility = 'visible';
    tooltip.style.opacity = '1';

    // Remove the tooltip after a few seconds
    setTimeout(() => {
        tooltip.style.visibility = 'hidden';
        tooltip.style.opacity = '0';
        button.parentNode.removeChild(tooltip);
    }, 1000);  // 1 second
}

function updateInterestedItems() {
    const list = document.getElementById('interested-list');
    list.innerHTML = '';
    let interestedItems = JSON.parse(localStorage.getItem('interestedItems') || '[]');
    interestedItems.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        const removeBtn = document.createElement('button');
        removeBtn.className = "remove-item";
        removeBtn.innerHTML = '<i class="fa fa-remove">';
        removeBtn.onclick = function () { removeInterested(item); };
        li.appendChild(removeBtn);
        list.appendChild(li);
    });
}

function removeInterested(name) {
    const interestedItems = JSON.parse(localStorage.getItem('interestedItems'));
    const filteredItems = interestedItems.filter(item => item !== name);
    localStorage.setItem('interestedItems', JSON.stringify(filteredItems));
    updateInterestedItems();
}

//------------LOCAL STORE LOGIC

function loadProductsForLocalStore() {
    const itemsContainer = document.getElementById('predefined-items');
    products.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td>
                <button class="decrease-quantity" onclick="updateQuantityForLocalStore(${index}, -1)">-</button>
                <span id="quantity-${index}">0</span>
                <button class="increase-quantity" onclick="updateQuantityForLocalStore(${index}, 1)">+</button>
            </td>
            <td>₹${item.price}</td>
            <td id="total-${index}">₹${item.quantity * item.price}</td>
        `;
        itemsContainer.appendChild(row);
    });

    updateTotalForLocalStore();
}

function updateQuantityForLocalStore(index, change) {
    let product = products[index];
    product.quantity += change;
    if (product.quantity < 0) product.quantity = 0;

    const quantityElement = document.getElementById(`quantity-${index}`);
    const totalElement = document.getElementById(`total-${index}`);

    quantityElement.innerText = product.quantity;
    totalElement.innerText = `₹${product.quantity * product.price}`;

    updateTotalForLocalStore();
}

function updateTotalForLocalStore() {
    const totalAmount = products.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
    const totalAmountElement = document.getElementById('total-amount');
    totalAmountElement.innerText = `₹${totalAmount}`;
}

function validateAndPlaceLocalOrder(event) {
    event.preventDefault();

    const name = document.getElementById('name');

    let isFormValid = true;

    // Reset previous tooltips
    [name].forEach(input => {
        input.classList.remove('error');
        input.removeAttribute('data-error');
    });

    if (!name.value.trim()) {
        name.classList.add('error');
        name.setAttribute('data-error', 'Please enter customer name');
        isFormValid = false;
    }

    if (isFormValid) {
        placeLocalOrder();
    } else {
        console.error("Form validation failed.");
    }
}

async function placeLocalOrder() {
    showLoader(true);

    const formData = {
        action: 'insert',
        storeType: 'local',
        name: document.getElementById('name').value,
        items: products.filter(item => item.quantity > 0).map(item => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity
        })),
        totalAmount: document.getElementById('total-amount').textContent.split('₹')[1]
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            mode: "cors",
            cache: "no-cache",
            headers: {
                "Content-Type": "text/plain",
            },
            redirect: "follow",
            body: JSON.stringify(formData)
        });

        const result = await response.json();
        showLoader(false);

        if (result.status === 'success') {
            alert(`Order placed! Your order ID is ${result.orderId}.`);
            clearExistingDataForLocalStore();
        } else {
            alert('Failed to place the order.');
        }
    } catch (error) {
        showLoader(false);
        alert('Failed to place the order. Check console for logs..');
        console.error('Failed to place order:', error);
    }
}

function clearExistingDataForLocalStore() {
    localStorage.clear();  // Clear local storage
    clearCustomerInfoForLocalStore(); // Clear customer inputs
    clearOrderDetailsForLocalStore();  // Clear order details
}

function clearCustomerInfoForLocalStore() {
    document.getElementById('name').value = '';
}

function clearOrderDetailsForLocalStore() {
    products.forEach((product, index) => {
        product.quantity = 0;  // Reset quantity
        updateRowForLocalStore(index); // Update UI for each product
    });

    updateTotalForLocalStore();
}

function updateRowForLocalStore(index) {
    const quantityElement = document.getElementById(`quantity-${index}`);
    const totalElement = document.getElementById(`total-${index}`);

    if (quantityElement && totalElement) {
        quantityElement.innerText = products[index].quantity;
        totalElement.innerText = `₹${products[index].quantity * products[index].price}`;
    }
}

//------------ORDER PROCESSING LOGIC

async function fetchOrders() {
    try {
        const storeType = 'local';  // TODO - hardcoded to local for now
        const response = await fetch(API_URL + `?type=orders&storeType=${storeType}`);
        orders = await response.json();
        orders = Array.isArray(orders) ? orders : []; 

        loadOrders();
        return orders;
    } catch (error) {
        console.error('Failed to fetch orders:', error);
        showLoader(false);
        return [];
    }
}

function loadOrders() {
    const container = document.getElementById('orders-container');
    container.innerHTML = ''; // Clear previous entries
    orders.forEach(order => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
                    <h3>${order.customerName}</h3>
                    <ul>
                        ${order.items.map(item => `<li>${item.quantity} x ${item.name}</li>`).join('')}
                    </ul>
                    <div class="button-container">
                        <button class="big-button" onclick="updateStatus('${order.storeType}', '${order.orderId}', 'Complete')"><i class="fas fa-check"></i>Done</button>
                        <button class="small-button" onclick="updateStatus('${order.storeType}', '${order.orderId}', 'Cancelled')"><i class="fas fa-times"></i></button>
                    </div>
                `;
        container.appendChild(card);
    });
}

async function updateStatus(storeType, orderId, status) {
    showLoader(true);

    const formData = {
        action: 'update',
        storeType: storeType,
        orderId: orderId,
        status: status
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            mode: "cors",
            cache: "no-cache",
            headers: {
                "Content-Type": "text/plain",
            },
            redirect: "follow",
            body: JSON.stringify(formData)
        });

        const result = await response.json();
        showLoader(false);

        if (result.status === 'success') {
            alert(`Order status updated!`);
            fetchOrders(); // Refetch orders after updating status
        } else {
            alert('Failed to update the order.');
        }
    } catch (error) {
        showLoader(false);
        alert('Failed to update the order. Check console for logs..');
        console.error('Failed to update order:', error);
    }
}

// setInterval(fetchOrders, 10000); // Fetch orders every 10 seconds
