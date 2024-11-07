const API_URL = 'https://script.google.com/macros/s/AKfycbw5uFvVeqDMd1l2iejXyX3yg97KmOBldp_imEbzpMf9ynUyP1DciZwG8s5J8n7X4dcu/exec';

let cart = [];

window.onload = function() {
    fetchProducts();
    updateInterestedItems();
};

async function fetchProducts() {
    try {
        showLoader(true);
        const response = await fetch(API_URL + '?type=inventory');
        const products = await response.json();
        renderProducts(products);
        showLoader(false);
    } catch (error) {
        console.error('Failed to fetch products:', error);
        showLoader(false);
    }
}

function showLoader(visible) {
    const loader = document.getElementById('loader');
    loader.style.display = visible ? 'flex' : 'none';
}

function renderProducts(data) {
    const productsContainer = document.getElementById('products');
    let segments = {};

    data.forEach(product => {
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
            <button title="Add this item to cart" class="add-to-cart" onclick="addToCart('${product.name}', ${product.price})"><i class="fa fa-plus"></i></button>
            <button title="Express interest to buy this later" class="interested" onclick="markAsInterested('${product.name}')"><i class="fa fa-heart"></i></button>
        `;
        segments[product.segment].appendChild(productDiv);
    });
}

function addToCart(name, price) {
    let item = cart.find(item => item.name === name);
    if (item) {
        item.quantity++;
    } else {
        cart.push({ name, price, quantity: 1 });
    }
    localStorage.setItem('cart', JSON.stringify(cart));  // store cart into local storage
    updateCartUI();
}

function updateCartUI() {
    const cartItemsContainer = document.getElementById('cart-items');
    cartItemsContainer.innerHTML = '';
    cart.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td><input type="number" value="${item.quantity}" min="1" onchange="updateQuantity('${item.name}', this.value)"></td>
            <td><button class="remove-item" onclick="removeItemFromCart('${item.name}')"><i class="fa fa-trash"></i></button></td>
            <td>₹${item.price}</td>
            <td>₹${item.price * item.quantity}</td>
        `;
        cartItemsContainer.appendChild(row);
    });
    updateTotal();
}

function updateQuantity(name, quantity) {
    let item = cart.find(item => item.name === name);
    if (item) {
        item.quantity = quantity;
    }
    updateCartUI();
}

function removeItemFromCart(name) {
    cart = cart.filter(item => item.name !== name);
    updateCartUI();
}

function updateTotal() {
    let total = 0;
    cart.forEach(item => {
        total += item.price * item.quantity;
    });
    document.getElementById('total-amount').innerText = `₹${total}`;
}

function validateAndPlaceOrder(event) {
    const name = document.getElementById('name');
    const phone = document.getElementById('phone');
    const email = document.getElementById('email');

    let isFormValid = true;

    // Reset previous tooltips
    [name, phone, email].forEach(input => {
        input.classList.remove('error');
        input.removeAttribute('data-error');
    });

    if (!name.value.trim()) {
        name.classList.add('error');
        name.setAttribute('data-error', 'Please enter your name');
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
        placeOrder(event);
    } else {
        console.error("Form validation failed.");
    }
}

async function placeOrder(event) {
    event.preventDefault();
    const cartItems = JSON.parse(localStorage.getItem('cart') || '[]');
    const interestedItems = JSON.parse(localStorage.getItem('interestedItems') || '[]');

    // Combine cartItems and interestedItems into a single array
    const combinedItems = [
        ...cartItems.map(item => ({ ...item, type: 'cart' })),
        ...interestedItems.map(item => ({ name: item, type: 'interested' }))
    ];
    
    const formData = {
        name: document.getElementById('name').value,
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
        if (result.status === 'success') {
            alert(`Order placed! Your order ID is ${result.orderId}.`);
            localStorage.clear();  // Clear local storage
            clearCustomerInfo(); // Clear customer inputs
            clearOrderSummary();  // Clear order summary UI
            clearInterestedItems();  // Clear interested items UI
        } else {
            alert('Failed to place the order.');
        }
    } catch (error) {
        console.error('Failed to place order:', error);
    }
}

function clearCustomerInfo() {
    document.getElementById('name').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('email').value = '';
}

function clearOrderSummary() {
    // Also assume here that updateCartUI() handles DOM clearing for you
    cart = []; // Clear internal cart representation
    updateCartUI();
    document.getElementById('total-amount').innerText = '₹0'; // Reset total amount
}

function clearInterestedItems() {
    const list = document.getElementById('interested-list');
    list.innerHTML = ''; // Clear inner HTML to remove all items
}

async function fetchIPAddress() {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
}

function markAsInterested(name) {
    let interestedItems = JSON.parse(localStorage.getItem('interestedItems') || '[]');
    if (!interestedItems.includes(name)) {
        interestedItems.push(name);
        localStorage.setItem('interestedItems', JSON.stringify(interestedItems));
        updateInterestedItems();
    }
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
        removeBtn.onclick = function() { removeInterested(item); };
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