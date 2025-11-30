
let user_agt = '';
let user_ip = '';
let mobileShowingCart = false;
let mobileShowingOptions = false;
let currentOptionsProduct = null;
let settings = {};

async function initMobileApp() {
    // capture user info
    user_agt = navigator.userAgent;
    user_ip = await fetchIPAddress();

    // fetch settings
    settings = await fetchAppSettings();

    setupMobileEventListeners();
    getDeliverySlots();
    loadProductsForMobile(true);
    updateMobileCartDisplay();
}

function getDeliverySlots() {
    const url = API_URL + '?type=deliverySlots';
    fetch(url)
        .then(response => response.json())
        .then(data => {
            localStorage.setItem('deliverySlots', JSON.stringify(data));
            window.deliverySlots = data || {};
            
            // Hide pickup option if not enabled
            const pickupOption = document.getElementById('pickup-option');
            if (pickupOption && !data.enabled) {
                pickupOption.style.display = 'none';
            }
        });
}

// Load products from API (exact pattern from app.js)
async function loadProductsForMobile(isAvailableFilter) {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'flex';

    try {
        // Exact same API call pattern as in app.js
        const response = await fetch(API_URL + `?type=products&isAvailableFilter=${isAvailableFilter}`);
        const data = await response.json();

        const productsArray = Array.isArray(data) ? data : []
        if (!productsArray.length) {
            console.error('Failed to load products:', data.message);
            showMobileToast('Failed to load products. Please refresh.');

            // Try to load from localStorage as fallback
            loadFromLocalStorage();
        }
        else {
            // Store in localStorage for offline access
            localStorage.setItem('products', productsArray);
            window.products = productsArray || [];

            // Load mobile products UI
            loadMobileProducts();
        }
    } catch (error) {
        console.error('Error loading products:', error);
        showMobileToast('Network error. Please check your connection.');

        // Try to load from localStorage as fallback
        loadFromLocalStorage();
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

// Load from localStorage as fallback
function loadFromLocalStorage() {
    const storedProducts = localStorage.getItem('products');
    const storedDeliverySlots = localStorage.getItem('deliverySlots');

    if (storedProducts) {
        window.products = JSON.parse(storedProducts);
        window.deliverySlots = JSON.parse(storedDeliverySlots || '{}');
        loadMobileProducts();
        showMobileToast('Loaded cached products');
    } else {
        showMobileToast('No products available. Please check your connection and refresh.');
    }
}

function setupMobileEventListeners() {
    // Navigation
    const navProducts = document.getElementById('nav-products');
    const navCart = document.getElementById('nav-cart');
    const navCheckout = document.getElementById('nav-checkout');
    const navAbout = document.getElementById('nav-about');

    if (navProducts) navProducts.addEventListener('click', () => switchToSection('products'));
    if (navCart) navCart.addEventListener('click', toggleMobileCart);
    if (navCheckout) navCheckout.addEventListener('click', () => switchToSection('checkout'));
    if (navAbout) navAbout.addEventListener('click', () => switchToSection('about'));

    // Cart controls
    const cartFab = document.getElementById('mobile-cart-fab');
    const cartClose = document.getElementById('mobile-cart-close');
    const checkoutBtn = document.getElementById('mobile-checkout-btn');

    if (cartFab) cartFab.addEventListener('click', toggleMobileCart);
    if (cartClose) cartClose.addEventListener('click', closeMobileCart);
    if (checkoutBtn) checkoutBtn.addEventListener('click', proceedToMobileCheckout);

    // Options panel
    const optionsClose = document.getElementById('mobile-options-close');
    const addSelectedBtn = document.getElementById('mobile-add-selected-btn');

    if (optionsClose) optionsClose.addEventListener('click', closeMobileOptions);
    if (addSelectedBtn) addSelectedBtn.addEventListener('click', addSelectedMobileOptions);

    // Delivery type radio buttons
    const deliveryTypeRadios = document.querySelectorAll('input[name="deliveryType"]');
    deliveryTypeRadios.forEach(radio => {
        radio.addEventListener('change', updateMobileDeliverySlots);
    });

    // Customer form
    const customerForm = document.getElementById('mobile-customer-form');
    if (customerForm) customerForm.addEventListener('submit', handleMobileOrderSubmission);
}

function switchToSection(section) {
    // Hide all sections
    document.getElementById('mobile-products').style.display = 'none';
    document.getElementById('mobile-customer-section').style.display = 'none';
    document.getElementById('mobile-about-section').style.display = 'none';

    // Remove active class from all nav buttons
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => btn.classList.remove('active'));

    // Show selected section and activate nav
    switch (section) {
        case 'products':
            document.getElementById('mobile-products').style.display = 'block';
            document.getElementById('nav-products').classList.add('active');
            break;
        case 'checkout':
            if (cart.length === 0) {
                showMobileToast('Your cart is empty');
                switchToSection('products');
                return;
            }
            document.getElementById('mobile-customer-section').style.display = 'block';
            document.getElementById('nav-checkout').classList.add('active');
            updateMobileDeliverySlots();
            break;
        case 'about':
            document.getElementById('mobile-about-section').style.display = 'block';
            document.getElementById('nav-about').classList.add('active');
            break;
    }

    // Close any open panels
    closeMobileCart();
    closeMobileOptions();

    // Scroll to top
    window.scrollTo(0, 0);
}

function loadMobileProducts() {
    const container = document.getElementById('mobile-products');
    if (!container) return;

    container.innerHTML = '';

    // Group products by segment
    const segments = {};
    products.forEach(product => {
        if (!segments[product.segment]) {
            segments[product.segment] = [];
        }
        segments[product.segment].push(product);
    });

    // Get segment sort order from settings
    let segmentNames = Object.keys(segments);
    if (settings && settings.SegmentsSortOrder) {
        const sortOrder = settings.SegmentsSortOrder.split(',').map(s => s.trim());
        segmentNames.sort((a, b) => {
            const indexA = sortOrder.indexOf(a);
            const indexB = sortOrder.indexOf(b);
            if (indexA === -1 && indexB === -1) {
                return a.localeCompare(b); // both not in order, sort alphabetically
            } else if (indexA === -1) {
                return 1; // a not in order, b is, b comes first
            } else if (indexB === -1) {
                return -1; // b not in order, a is, a comes first
            } else {
                return indexA - indexB; // both in order, sort by index
            }
        });
    }

    // Create segments
    segmentNames.forEach(segmentName => {
        const segmentDiv = document.createElement('div');
        segmentDiv.className = 'mobile-segment';

        const segmentTitle = document.createElement('h3');
        segmentTitle.textContent = segmentName;
        segmentDiv.appendChild(segmentTitle);

        const productsGrid = document.createElement('div');
        productsGrid.className = 'mobile-products-grid';

        segments[segmentName].forEach(product => {
            const productCard = createMobileProductCard(product);
            productsGrid.appendChild(productCard);
        });

        segmentDiv.appendChild(productsGrid);
        container.appendChild(segmentDiv);
    });
}

function createMobileProductCard(product) {
    const card = document.createElement('div');
    card.className = 'mobile-product';

    // Determine price display
    let priceDisplay = `₹${product.price}`;
    let hasMultipleVariations = product.variations && product.variations.length > 1;

    if (hasMultipleVariations) {
        const prices = product.variations.map(v => parseFloat(v.price)).filter(p => !isNaN(p));
        if (prices.length > 0) {
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            priceDisplay = minPrice === maxPrice ? `₹${minPrice}` : `₹${minPrice} - ₹${maxPrice}`;
        }
    } else if (product.variations && product.variations.length === 1) {
        priceDisplay = `₹${product.variations[0].price}`;
    }

    // Type logo
    let typeLogoHtml = '';
    if (!hasMultipleVariations) {
        const type = product.variations && product.variations.length === 1
            ? product.variations[0].type
            : product.type || 'Veg';
        const logoSrc = type === 'Veg' ? '../resources/veg-logo.png' : '../resources/nonveg-logo.png';
        typeLogoHtml = `<img src="${logoSrc}" alt="${type}" class="mobile-type-logo">`;
    }

    // Improved layout structure
    card.innerHTML = `
        <div class="mobile-product-info">
            <div class="product-name">${product.name}</div>
            <div class="product-ingredients">${product.ingredients}</div>
            <div class="product-description"><strong>${product.description}</strong></div>
            <div class="product-price">${priceDisplay}</div>
        </div>
        <div class="mobile-product-right">
            <div class="mobile-product-image-container">
                ${typeLogoHtml}
                <img src="${product.imageUrl}" alt="${product.name}" class="mobile-product-image" loading="lazy">
            </div>
            <div class="mobile-product-actions">
                <!-- Button will be added here -->
            </div>
        </div>
    `;

    // Add button
    const addButton = document.createElement('button');
    addButton.className = 'mobile-add-btn';
    addButton.innerHTML = '<i class="fas fa-plus"></i>';

    if (hasMultipleVariations) {
        addButton.onclick = () => showMobileOptions(product);
    } else {
        const variation = product.variations && product.variations.length === 1 ? product.variations[0] : null;
        const price = variation ? variation.price : product.price;
        const type = variation ? variation.type : product.type || 'Mixed';
        const variationName = variation ? variation.name : '';

        addButton.onclick = () => addToMobileCart(product.segment, type, product.name, price, variationName);
    }

    const actionsContainer = card.querySelector('.mobile-product-actions');
    actionsContainer.appendChild(addButton);

    return card;
}

function showMobileOptions(product) {
    currentOptionsProduct = product;
    const optionsPanel = document.getElementById('mobile-options-panel');
    const optionsTitle = document.getElementById('mobile-options-title');
    const optionsContent = document.getElementById('mobile-options-content');

    if (!optionsPanel || !optionsTitle || !optionsContent) return;

    optionsTitle.textContent = `${product.name} - Options`;

    optionsContent.innerHTML = product.variations.map((variation, idx) => `
        <div class="mobile-option-item">
            <input type="checkbox" class="mobile-option-checkbox" id="mobile-option-${idx}" 
                   data-price="${variation.price}" data-name="${variation.name}" data-type="${variation.type}">
            <div class="mobile-option-info">
                <div class="mobile-option-name">${variation.name}</div>
                <div class="mobile-option-type">
                    <img src="${variation.type === 'Veg' ? '../resources/veg-logo.png' : '../resources/nonveg-logo.png'}" 
                         alt="${variation.type}">
                    ${variation.type}
                </div>
            </div>
            <div class="mobile-option-price">₹${variation.price}</div>
            <input type="number" class="mobile-option-qty" value="1" min="1" max="10" id="mobile-qty-${idx}">
        </div>
    `).join('');

    optionsPanel.classList.add('show');
    mobileShowingOptions = true;
}

function closeMobileOptions() {
    const optionsPanel = document.getElementById('mobile-options-panel');
    if (optionsPanel) {
        optionsPanel.classList.remove('show');
        mobileShowingOptions = false;
        currentOptionsProduct = null;
    }
}

function addSelectedMobileOptions() {
    if (!currentOptionsProduct) return;

    const optionsContent = document.getElementById('mobile-options-content');
    const checkboxes = optionsContent.querySelectorAll('.mobile-option-checkbox:checked');

    if (checkboxes.length === 0) {
        showMobileToast('Please select at least one option');
        return;
    }

    let totalAdded = 0;
    checkboxes.forEach(checkbox => {
        const variationName = checkbox.getAttribute('data-name');
        const price = parseFloat(checkbox.getAttribute('data-price'));
        const type = checkbox.getAttribute('data-type');
        const idx = checkbox.id.split('-')[2];
        const qtyInput = document.getElementById(`mobile-qty-${idx}`);
        const quantity = parseInt(qtyInput.value) || 1;

        for (let i = 0; i < quantity; i++) {
            addToMobileCart(currentOptionsProduct.segment, type, currentOptionsProduct.name, price, variationName);
            totalAdded++;
        }
    });

    closeMobileOptions();
    showMobileToast(`${totalAdded} item(s) added to cart!`);
}

function addToMobileCart(segment, type, name, price, variation = '') {
    let existingItem = cart.find(item =>
        item.name === name &&
        (variation ? item.variation === variation : !item.variation)
    );

    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            segment,
            type,
            name,
            price: parseFloat(price),
            quantity: 1,
            variation
        });
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    updateMobileCartDisplay();
}

function updateMobileCartDisplay() {
    const cartContainer = document.getElementById('mobile-cart-items');
    const navCartCount = document.getElementById('nav-cart-count');
    const totalAmount = document.getElementById('mobile-total-amount');

    if (!cartContainer) return;

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Update navigation cart count
    if (navCartCount) {
        navCartCount.textContent = totalItems;
        navCartCount.style.display = totalItems > 0 ? 'flex' : 'none';
    }

    if (totalAmount) totalAmount.textContent = `₹${totalPrice}`;

    // Rest of the cart display logic stays the same...
    if (cart.length === 0) {
        cartContainer.innerHTML = `
            <div class="mobile-empty-cart">
                <i class="fas fa-shopping-cart"></i>
                <div>Your cart is empty</div>
                <div style="font-size: 0.9rem; margin-top: 5px;">Add some delicious items!</div>
            </div>
        `;
    } else {
        cartContainer.innerHTML = cart.map((item, index) => `
            <div class="mobile-cart-item">
                <div class="mobile-cart-item-info">
                    <div class="mobile-cart-item-name">${item.name}</div>
                    ${item.variation ? `<div class="mobile-cart-item-variation">${item.variation}</div>` : ''}
                    <div class="mobile-cart-item-price">₹${item.price}</div>
                </div>
                <div class="mobile-quantity-controls">
                    <button class="mobile-qty-btn" onclick="updateMobileCartQuantity(${index}, -1)">-</button>
                    <div class="mobile-qty-display">${item.quantity}</div>
                    <button class="mobile-qty-btn" onclick="updateMobileCartQuantity(${index}, 1)">+</button>
                </div>
                <button class="mobile-remove-btn" onclick="removeMobileCartItem(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    }
}

function updateMobileCartQuantity(index, change) {
    if (index >= 0 && index < cart.length) {
        cart[index].quantity += change;

        if (cart[index].quantity <= 0) {
            cart.splice(index, 1);
        }

        localStorage.setItem('cart', JSON.stringify(cart));
        updateMobileCartDisplay();
    }
}

function removeMobileCartItem(index) {
    if (index >= 0 && index < cart.length) {
        cart.splice(index, 1);
        localStorage.setItem('cart', JSON.stringify(cart));
        updateMobileCartDisplay();
    }
}

function toggleMobileCart() {
    const cart = document.getElementById('mobile-cart');
    if (cart) {
        cart.classList.toggle('show');
    }
}

function closeMobileCart() {
    const cartContainer = document.getElementById('mobile-cart');
    if (cartContainer) {
        cartContainer.classList.remove('show');
        mobileShowingCart = false;
    }
}

function proceedToMobileCheckout() {
    if (cart.length === 0) {
        showMobileToast('Your cart is empty');
        return;
    }
    closeMobileCart();
    switchToSection('checkout');
}

function updateMobileDeliverySlots() {
    const deliveryDropdown = document.getElementById('mobile-delivery-time-dropdown');
    if (!deliveryDropdown) return;

    const deliveryType = document.querySelector('input[name="deliveryType"]:checked').value;
    let availableSlots = [];

    if (deliveryType === 'delivery') {
        availableSlots = window.deliverySlots.delivery || [];
    } else if (deliveryType === 'pickup') {
        availableSlots = window.deliverySlots.pickup.slots || [];
    }

    deliveryDropdown.innerHTML = '<option value="">[Select Time]</option>';
    availableSlots.forEach(slot => {
        const optionEl = document.createElement('option');
        optionEl.value = slot.trim();
        optionEl.textContent = slot.trim();
        deliveryDropdown.appendChild(optionEl);
    });
}

function handleMobileOrderSubmission(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const name = formData.get('name').trim();
    const flat = formData.get('flat').trim();
    const phone = formData.get('phone').trim();
    const email = formData.get('email').trim();
    const deliverySlot = document.getElementById('mobile-delivery-time-dropdown').value;
    const deliveryType = document.querySelector('input[name="deliveryType"]:checked').value;

    if (!name || !flat || !phone || !email || !deliverySlot) {
        showMobileToast('Please fill in all required fields');
        return;
    }

    if (cart.length === 0) {
        showMobileToast('Your cart is empty');
        return;
    }

    const orderData = {
        name: name,
        flat: flat,
        email: email,
        phone: phone,
        deliveryType: deliveryType,
        deliverySlot: deliverySlot,
        pickupLocation: deliveryType === 'pickup' ? window.deliverySlots.pickup.location : null,
        items: cart,
        totalAmount: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    };

    placeOnlineOrder(orderData);
}

// Place order function
async function placeOnlineOrder(orderData) {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'flex';

    try {
        const payload = {
            action: 'insertOrder',
            name: orderData.name,
            flat: orderData.flat,
            email: orderData.email,
            phone: orderData.phone,
            deliverySlot: orderData.deliverySlot,
            items: orderData.items,
            totalAmount: orderData.totalAmount,
            userAgent: user_agt,
            userIp: user_ip
        };

        // Make API call exactly as in app.js
        const response = await callAPIviaPOST(payload);

        if (response.status === 'success') {
            showMobileToast(`Order ${response.orderId} placed successfully!`);

            // Clear everything
            cart = [];
            localStorage.setItem('cart', JSON.stringify(cart));
            updateMobileCartDisplay();

            const mobileForm = document.getElementById('mobile-customer-form');
            if (mobileForm) mobileForm.reset();

            // Go back to products
            switchToSection('products');
        } else {
            showMobileToast('Order failed: ' + (response.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error placing order:', error);
        showMobileToast('Failed to place order. Please try again.');
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

function showMobileToast(message) {
    const existingToast = document.querySelector('.mobile-toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'mobile-toast';
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 100);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// Initialize on load
window.addEventListener('load', initMobileApp);

// Make placeOnlineOrder available globally for compatibility
window.placeOnlineOrder = placeOnlineOrder;