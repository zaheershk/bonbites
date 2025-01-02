const API_URL = 'https://script.google.com/macros/s/AKfycbzhQkIeJ-ckqKSzwB6POxy__to02K1a6s0UQUpjtdtGoRWXaH9IFgmz5OT6nSOQlnG3/exec';

let products = [];
let orders = [];
let cart = [];

function getUrlParameter(name) {
    const urlSearchParams = new URLSearchParams(window.location.search);
    return urlSearchParams.get(name);
}

window.onload = async function () {
    const workflowContext = document.querySelector('meta[name="workflow-context"]').getAttribute('content');
    showLoader(true);

    var workflowContextLC = workflowContext.toLowerCase();

    if (workflowContextLC === 'intake' || workflowContextLC === 'menu') {
        const storeType = document.querySelector('meta[name="store-type"]').getAttribute('content');
        products = await fetchProducts(storeType);

        if (!products) {
            showLoader(false);
            console.error('Failed to load products.');
            return;
        }

        if (workflowContextLC === 'menu') {
            loadProductsForMenu();
        }

        if (workflowContextLC === 'intake') {
            getDeliveryOptions();

            if (storeType === 'online') {
                loadProductsForOnlineStore();
                clearExistingDataForOnlineStore();
            } else if (storeType === 'local') {
                loadProductsForLocalStore();
                clearExistingDataForLocalStore();
            }
        }
    }

    if (workflowContextLC === 'process') {

        const storeType = getUrlParameter('storeType');
        if (storeType) {
            document.querySelector('.brand h1').textContent = `Orders Pending (${storeType})`;
        }

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

function loadProductsForMenu() {
    const productsContainer = document.getElementById('products');
    let segments = {};

    products.forEach(product => {
        const productType = product.type === "Veg" ? "Vegetarian" : "Non Vegetarian";
        const productTypeCode = product.type === "Veg" ? "V" : "NV";
        const segmentKey = `${product.segment} - ${productType}`;

        if (!segments[product.segment]) {
            segments[product.segment] = document.createElement('div');
            segments[product.segment].className = 'segment';
            segments[product.segment].innerHTML = `<h2 class="segment-title">${product.segment}</h2>`;
            productsContainer.appendChild(segments[product.segment]);
        }
        if (!segments[segmentKey]) {
            segments[segmentKey] = document.createElement('div');
            segments[segmentKey].className = `sub-segment sub-segment-${productTypeCode.toLowerCase()}`;
            segments[segmentKey].innerHTML = `<p>--- ${productType} ---</p>`;
            segments[product.segment].appendChild(segments[segmentKey]);
        }

        const productDiv = document.createElement('div');
        productDiv.className = 'product';
        let typeLogoSrc = product.type === "Veg" ? "resources/veg-logo.png" : "resources/nonveg-logo.png";
        productDiv.innerHTML = `
            <img src="resources/product-images/${product.imageName}" alt="${product.name}">
            <p class="product-name">${product.name}</p> 
            <!-- <p class="product-description">${product.description}</p> -->
            <p class="product-ingredients"><strong>Contains:</strong> ${product.ingredients}</p> 
            <p class="product-price">Price: ₹${product.price}</p> 
            <img src="${typeLogoSrc}" alt="${product.type}" class="type-logo">
        `;
        segments[segmentKey].appendChild(productDiv);

    });
}

/* document.addEventListener('contextmenu', function (event) {
    event.preventDefault();
    showContextMenu(event.pageX, event.pageY);
});

document.addEventListener('click', function () {
    document.getElementById('customContextMenu').style.display = 'none';
});

document.getElementById('generatePdfOption').addEventListener('click', function () {
    generatePDF();
    document.getElementById('customContextMenu').style.display = 'none';
});

function showContextMenu(x, y) {
    const menu = document.getElementById('customContextMenu');
    menu.style.left = `${x}px`; // Position menu at mouse coordinates
    menu.style.top = `${y}px`;
    menu.style.display = 'block';
} 

async function generatePDF() {
    const staticContent = document.querySelector('.static-content');
    const segments = document.querySelectorAll('.segment');
    const backgroundColor = "#28282B";

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });

    // Render static content as the first page
    const staticCanvas = await html2canvas(staticContent, {
        scale: 2,
        useCORS: true,
        backgroundColor: 'transparent',
        logging: true
    });

    let imgWidth = 210;  // A4 width in mm
    let imgHeight = (staticCanvas.height * imgWidth) / staticCanvas.width;
    let yOffset = (297 - imgHeight) / 2;  // Center the image vertically

    doc.setFillColor(backgroundColor);
    doc.rect(0, 0, 210, 297, 'F');  // Fill the page with the background color

    let imgData = staticCanvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', 0, yOffset, imgWidth, imgHeight);

    // Render menu content starting from the second page
    for (let index = 0; index < segments.length; index++) {
        const segment = segments[index];
        const products = segment.querySelectorAll('.product');

        products.forEach(product => {
            product.style.backgroundColor = '#FFFFFF';
            product.style.boxShadow = 'none';
        });

        const canvas = await html2canvas(segment, {
            scale: 2,
            useCORS: true,
            backgroundColor: 'transparent'
        });

        imgHeight = (canvas.height * imgWidth) / canvas.width;
        doc.addPage();  // Add a new page for each segment
        doc.setFillColor(backgroundColor);
        doc.rect(0, 0, 210, 297, 'F');

        imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

        products.forEach(product => {
            product.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
        });
    }

    doc.save('download.pdf');
} */

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
        let typeLogoSrc = product.type === "Veg" ? "resources/veg-logo.png" : "resources/nonveg-logo.png";
        productDiv.innerHTML = `
            <img src="resources/product-images/${product.imageName}" alt="${product.name}">
            <p class="product-name">${product.name}</p> 
            <!-- <p class="product-description">${product.description}</p> -->
            <p class="product-ingredients"><strong>Contains:</strong> ${product.ingredients}</p> 
            <p class="product-price">Price: ₹${product.price}</p> 
            <button title="Add this item to cart" class="add-to-cart" onclick="addToCart(this, '${product.segment}', '${product.type}', '${product.name}', ${product.price})"><i class="fa fa-plus"></i></button> 
            <!-- <button title="Express interest to buy this later" class="interested" onclick="markAsInterested(this, '${product.name}')"><i class="fa fa-heart"></i></button> -->
            <img src="${typeLogoSrc}" alt="${product.type}" class="type-logo">
        `;
        segments[product.segment].appendChild(productDiv);
    });
}

function getDeliveryOptions() {
    const url = API_URL + '?type=deliveryOptions';
    fetch(url)
        .then(response => response.json())
        .then(data => {
            localStorage.setItem('deliveryOptions', JSON.stringify(data));
        });
}

function addToCart(button, segment, type, name, price) {
    // Create a tooltip element and add it to the button
    let tooltip = document.createElement('span');
    tooltip.className = 'tooltip';

    let item = cart.find(item => item.type === type && item.name === name);
    if (item) {
        item.quantity++;
    } else {
        cart.push({ segment, type, name, price, quantity: 1 });
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

    // console.log(cart);

    cart.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td>
              <button class="decrease-quantity" onclick="updateQuantityForOnlineStore('${item.type}', '${item.name}', ${item.quantity - 1})">-</button>
              <span>${item.quantity}</span>
              <button class="increase-quantity" onclick="updateQuantityForOnlineStore('${item.type}', '${item.name}', ${item.quantity + 1})">+</button>
            </td>
            <td><button class="remove-item" onclick="removeItemFromCart('${item.type}', '${item.name}')"><i class="fa fa-trash"></i></button></td>
            <td>₹${item.price}</td>
            <td>₹${item.price * item.quantity}</td>
        `;
        cartItemsContainer.appendChild(row);
    });
    updateTotalForOnlineStore();

    // Update delivery-options based on items chosen
    const deliveryOptions = JSON.parse(localStorage.getItem('deliveryOptions') || '{}');
    const segments = new Set(Object.values(cart).map(item => item.segment));

    let allDeliveryOptions = [];
    segments.forEach(segment => {
        if (deliveryOptions[segment]) {
            deliveryOptions[segment].forEach(option => {
                if (!allDeliveryOptions.includes(option)) {
                    allDeliveryOptions.push(option);
                }
            });
        }
    });

    // Filter to keep only PM options if both AM and PM options exist
    let pmOptions = allDeliveryOptions.filter(option => option.includes('PM'));
    if (pmOptions.length > 0 && pmOptions.length !== allDeliveryOptions.length) {
        allDeliveryOptions = pmOptions;  // Use only PM options if presentand mixed with AM
    }

    let optionsHtml = `<select id="delivery-time-dropdown" required class="form-input">
                       <option value="">[Select]</option>`;
    allDeliveryOptions.forEach(option => {
        optionsHtml += `<option value="${option}">${option}</option>`;
    });
    optionsHtml += '</select>';

    document.getElementById('deliveryOptionsContainer').innerHTML = optionsHtml;
}

function updateQuantityForOnlineStore(type, name, newQuantity) {
    if (newQuantity < 1) return; // Prevent negative or zero quantities
    let item = cart.find(item => item.type === type && item.name === name);
    if (item) {
        item.quantity = newQuantity;
    }
    updateCartUI();
}

function removeItemFromCart(type, name) {
    cart = cart.filter(item => item.type !== type || item.name !== name);
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
    const deliveryDropdown = document.getElementById('delivery-time-dropdown');

    let isFormValid = true;

    // Reset previous tooltips
    [name, flat, phone, email, deliveryDropdown].forEach(input => {
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
    if (deliveryDropdown.value === "") {
        deliveryDropdown.classList.add('error');
        deliveryDropdown.setAttribute('data-error', 'Please select a delivery slot');
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
        ...cartItems.map(item => ({ ...item, mode: 'ordered' })),
        ...interestedItems.map(item => ({ name: item, mode: 'interested' }))
    ];

    const formData = {
        action: 'insert',
        storeType: 'online',
        name: document.getElementById('name').value,
        flat: document.getElementById('flat').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        deliveryOption: document.getElementById('delivery-time-dropdown').value,
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
        const storeType = getUrlParameter('storeType') || 'local';
        const response = await fetch(API_URL + `?type=orders&storeType=${storeType}`);
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

function loadOrders() {
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
                <br/><strong>Delivery Slot:</strong> ${order.deliveryOption} 
                <br/><strong>Status:</strong> ${order.status} 
                <br/><br/><strong>Items:</strong>
            </p>
            <ul>
                ${order.items.map(item => `<li>${item.quantity} x ${item.name} (${item.type})</li>`).join('')}
            </ul>
            <p style="color: #c1464c;"><strong>Total Amount: ₹${order.totalAmount}</strong></p> 
        `;
        card.appendChild(content);

        // Append button container at the bottom
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-container';
        buttonContainer.innerHTML = `
            <button class="small-button bg-blue" onclick="updateStatus('${order.storeType}', '${order.orderId}', 'Cooking')" ${isPastStatus(order.status, 'Cooking') ? 'disabled' : ''}><i class="fas fa-utensils"></i></button>
            <button class="small-button bg-brown" onclick="updateStatus('${order.storeType}', '${order.orderId}', 'Packed')" ${isPastStatus(order.status, 'Packed') ? 'disabled' : ''}><i class="fas fa-box"></i></button>
            <button class="small-button bg-green" onclick="updateStatus('${order.storeType}', '${order.orderId}', 'Delivered')" ${isPastStatus(order.status, 'Delivered') ? 'disabled' : ''}><i class="fas fa-truck"></i></button>
            <button class="small-button bg-red" onclick="updateStatus('${order.storeType}', '${order.orderId}', 'Cancelled')" ${isPastStatus(order.status, 'Cancelled') ? 'disabled' : ''}><i class="fas fa-times"></i></button>
        `;
        card.appendChild(buttonContainer);

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
