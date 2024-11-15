const API_URL = 'https://script.google.com/macros/s/AKfycbycNm5WtjsZhxgUgWM_9BTYJSUO-LEq_vmL_L00ChO1--LJ1Sm_ctX_xJIGbJhliQ4/exec';

let products = [];
let cart = [];

window.onload = async function () {
    const storeType = document.querySelector('meta[name="store-type"]').getAttribute('content');

    showLoader(true, "pageLoad");
    products = await fetchProducts(storeType);

    if (!products) {
        showLoader(false, "pageLoad");
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

    showLoader(false, "pageLoad");
};

async function fetchProducts(storeType) {
    try {
        const response = await fetch(API_URL + `?type=inventory&storeType=${storeType}`);
        const products = await response.json();
        return Array.isArray(products) ? products : [];
    } catch (error) {
        console.error('Failed to fetch products:', error);
        return [];
        showLoader(false, "pageLoad");
    }
}

function showLoader(visible, event) {
    const loader = document.getElementById('loader');
    if (event === "pageLoad") {
        loader.textContent = "Fetching products from our kitchen...";
    }
    if (event === "orderPlaced") {
        loader.textContent = "Submitting your order to our kitchen...";
    }

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
        placeOnlineOrder();
    } else {
        console.error("Form validation failed.");
    }
}

async function placeOnlineOrder() {
    showLoader(true, "orderPlaced");
    const cartItems = JSON.parse(localStorage.getItem('cart') || '[]');
    const interestedItems = JSON.parse(localStorage.getItem('interestedItems') || '[]');

    // Combine cartItems and interestedItems into a single array
    const combinedItems = [
        ...cartItems.map(item => ({ ...item, type: 'ordered' })),
        ...interestedItems.map(item => ({ name: item, type: 'interested' }))
    ];

    const formData = {
        storeType: 'online',
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
        showLoader(false, "orderPlaced");

        if (result.status === 'success') {
            alert(`Order placed! Your order ID is ${result.orderId}.`);
            clearExistingDataForOnlineStore();
        } else {
            alert('Failed to place the order.');
        }
    } catch (error) {
        showLoader(false, "orderPlaced");
        alert('Failed to place the order. Check console for logs..');
        console.error('Failed to place order:', error);
    }
}

function clearExistingDataForOnlineStore() {
    localStorage.clear();  // Clear local storage
    clearCustomerInfoForOnlineStore(); // Clear customer inputs
    clearOrderDetailsForOnlineStore();  // Clear order details
    clearInterestedItemsForOnlineStore();  // Clear interested items
}

function clearCustomerInfoForOnlineStore() {
    document.getElementById('name').value = '';
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
    showLoader(true, "orderPlaced");

    const formData = {
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
        showLoader(false, "orderPlaced");

        if (result.status === 'success') {
            alert(`Order placed! Your order ID is ${result.orderId}.`);
            clearExistingDataForLocalStore();
        } else {
            alert('Failed to place the order.');
        }
    } catch (error) {
        showLoader(false, "orderPlaced");
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