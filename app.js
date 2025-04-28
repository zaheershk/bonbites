const API_URL = 'https://script.google.com/macros/s/AKfycbxBEqC2-wZGio8gPDPNqddI1ZhJOvjQFKVmTcpvvMQe3gI-EoGY5gMGYoH055E4wSe6/exec';

let settings = [];
let products = [];
let orders = [];
let cart = [];

let storeType = ''
let workflowContext = '';

let user_agt = '';
let user_ip = '';

// Global variables for inventory management sorting
let invmgmtSortColumns = ['segment', 'type', 'name'];
let invmgmtSortDirections = {
    segment: 'asc',
    type: 'asc',
    name: 'asc'
};

// Global variables for inventory management filtering
let invmgmtFilteredProducts = [];
let invmgmtFilters = {
    segment: '',
    type: '',
    available: ''
};

function getUrlParameter(name) {
    const urlSearchParams = new URLSearchParams(window.location.search);
    return urlSearchParams.get(name);
}

function showLoader(visible) {
    const loader = document.getElementById('loader');
    loader.style.display = visible ? 'flex' : 'none';
}

async function callAPIviaPOST(data) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            mode: "cors",
            cache: "no-cache",
            headers: {
                "Content-Type": "text/plain",
            },
            redirect: "follow",
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (error) {
        console.error('Error occured in callAPIviaPOST method.', error);
        throw error;
    }
}

window.onload = async function () {
    showLoader(true);

    const workflowContextMetaTag = document.querySelector('meta[name="workflow-context"]').getAttribute('content');
    workflowContext = workflowContextMetaTag.toLowerCase();
    //console.log('workflowContext:', workflowContext);

    settings = await fetchAppSettings();
    if (settings.StoreClosed === 'Y') {
        // Only redirect if this is the index/order page
        const isIndexPage = !workflowContextMetaTag || workflowContext === 'intake';
        if (isIndexPage) {
            window.location.href = 'storeclosed';
            return; // Stop further execution
        }
    }

    if (workflowContext === 'admin') {
        // Initialize admin-specific components
        initStoreStatusToggle();
    }

    if (workflowContext === 'intake' || workflowContext === 'menu' || workflowContext === 'inventory') {
        storeType = document.querySelector('meta[name="store-type"]').getAttribute('content');
        //console.log('storeType:', storeType);

        if (workflowContext === 'inventory') {
            await invmgmtLoadInventory(false);
        }

        if (workflowContext === 'menu') {
            products = await fetchProducts(storeType, true);
            loadMenu();
        }

        if (workflowContext === 'intake') {
            products = await fetchProducts(storeType, true);
            if (storeType === 'online') {
                // capture traffic info
                user_agt = navigator.userAgent;
                user_ip = await fetchIPAddress();
                //await captureTraffic();

                getDeliveryOptions();
                loadProductsForOnlineStore();
                clearExistingDataForOnlineStore();
            } else if (storeType === 'local') {
                loadProductsForLocalStore();
                clearExistingDataForLocalStore();
            }
        }
    }

    if (workflowContext === 'stock') {
        //console.log('Loading stock management page...');
        await stockLoadItems(false);
    }

    if (workflowContext === 'process') {
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

async function captureTraffic() {

    const formData = {
        action: 'captureTraffic',
        storeType: 'online',
        userAgent: user_agt,
        userIp: user_ip
    };

    try {
        const result = await callAPIviaPOST(formData);
        if (result.status === 'success') {
            // do nothing
        } else {
            console.warn('Failed to capture traffic info.');
        }
    } catch (error) {
        showLoader(false);
        console.warn('Failed to capture traffic info.');
    }
}

async function fetchAppSettings() {
    try {
        const response = await fetch(API_URL + '?type=appsettings');
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch app settings:', error);
        return {};
    }
}

async function updateAppSetting(key, value) {
    try {
        showLoader(true);
        
        const data = {
            action: "updateAppSetting",
            key: key,
            value: value
        };
        
        const result = await callAPIviaPOST(data);
        
        if (result.status === 'success') {
            console.log(`Setting '${key}' updated successfully`);
        } else {
            console.error(`Failed to update setting '${key}':`);
        }
    } catch (error) {
        console.error(`Error updating setting '${key}':`, error);
    } finally {
        showLoader(false);
    }
}

function initStoreStatusToggle() {
    const toggle = document.getElementById('storeStatusToggle');
    const actionText = document.getElementById('storeActionText');

    if (!toggle || !actionText) return;
    
    // Set initial toggle state based on settings
    const isStoreOpen = settings.StoreClosed !== 'Y';
    
    if (isStoreOpen) {
        toggle.classList.remove('fa-toggle-off', 'invmgmt-toggle-inactive');
        toggle.classList.add('fa-toggle-on', 'invmgmt-toggle-active');
        if (actionText) actionText.textContent = 'Click to Close'; 
    } else {
        toggle.classList.remove('fa-toggle-on', 'invmgmt-toggle-active');
        toggle.classList.add('fa-toggle-off', 'invmgmt-toggle-inactive');
        if (actionText) actionText.textContent = 'Click to Open';
    }
}

async function toggleStoreStatus() {
    const toggle = document.getElementById('storeStatusToggle');
    const actionText = document.getElementById('storeActionText');

    if (!toggle || !actionText) return;
    
    // Get current state based on toggle icon
    const isCurrentlyOpen = toggle.classList.contains('fa-toggle-on');
    
    // Update to new state
    if (isCurrentlyOpen) {
        // Change to closed
        toggle.classList.remove('fa-toggle-on', 'invmgmt-toggle-active');
        toggle.classList.add('fa-toggle-off', 'invmgmt-toggle-inactive');
        if (actionText) actionText.textContent = 'Click to Open';
        
        // Update setting
        await updateAppSetting('StoreClosed', 'Y');
    } else {
        // Change to open
        toggle.classList.remove('fa-toggle-off', 'invmgmt-toggle-inactive');
        toggle.classList.add('fa-toggle-on', 'invmgmt-toggle-active');
        if (actionText) actionText.textContent = 'Click to Close';
        
        // Update setting
        await updateAppSetting('StoreClosed', 'N');
    }
}

async function fetchProducts(storeType, isAvailableFilter) {
    try {
        //console.log('isAvailableFilter:', isAvailableFilter);

        const response = await fetch(API_URL + `?type=inventory&storeType=${storeType}&isAvailableFilter=${isAvailableFilter}`);
        const products = await response.json();
        const productsArray = Array.isArray(products) ? products : []
        if (!productsArray.length) {
            showLoader(false);
            console.error('No products found.');
        }
        //console.log('Fetched products:', productsArray);
        return productsArray;
    } catch (error) {
        console.error('Failed to fetch products:', error);
        showLoader(false);
        return [];
    }
}

//------------INVENTORY MGMT LOGIC

async function invmgmtLoadInventory(reapplyFilters = false) {
    try {
        showLoader(true);

        // Fetch products from server
        products = await fetchProducts(storeType, false);

        if (!reapplyFilters) {
            // Reset filters and use all products
            invmgmtFilteredProducts = [...products];
            invmgmtInitFilters();
        } else {
            // Re-apply current filters to the fresh data
            invmgmtApplyFilters();
        }

        // Load the inventory display
        loadInventoryTable(invmgmtFilteredProducts);

        // Ensure segment dropdown is populated
        if (settings && settings.Segments) {
            populateSegmentDropdown(settings.Segments);
        }
    } catch (error) {
        console.error('Error loading inventory:', error);
    } finally {
        showLoader(false);
    }
}

function loadInventoryTable(products) {
    // Sort products by default
    invmgmtSortProducts(products);

    const tbody = document.getElementById('invmgmtProductTableBody');
    tbody.innerHTML = '';

    products.forEach(product => {
        const row = document.createElement('tr');

        // Image thumbnail cell
        const imgCell = document.createElement('td');
        imgCell.className = 'invmgmt-table-img-cell';

        if (product.imageUrl) {
            // Create image thumbnail wrapper
            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'invmgmt-table-img-wrapper';
            imgWrapper.setAttribute('data-image-url', product.imageUrl);
            imgWrapper.setAttribute('role', 'button');
            imgWrapper.setAttribute('aria-label', 'Click to preview image');
            imgWrapper.classList.add('invmgmt-preview-trigger');

            // Create the image element
            const img = document.createElement('img');
            img.src = product.imageUrl;
            img.alt = product.name;
            img.className = 'invmgmt-table-img';

            // Add image to wrapper, wrapper to cell
            imgWrapper.appendChild(img);
            imgCell.appendChild(imgWrapper);
        } else {
            // If no image, show placeholder
            imgCell.innerHTML = '<div class="invmgmt-no-img-placeholder">No Image</div>';
        }
        row.appendChild(imgCell);

        // Add other cells
        row.innerHTML += `
            <td>${product.segment}</td>
            <td>${product.type}</td>
            <td>${product.name}</td>
            <td>${product.ingredients}</td>
            <td>${product.description}</td>
            <td>₹${product.price}</td>
            <td>${product.isAvailable === 'Y' ? 'Yes' : 'No'}</td>
            <td>
                <i class="fas ${product.isAvailable === 'Y' ? 'fa-toggle-on' : 'fa-toggle-off'} action-icons ${product.isAvailable === 'Y' ? 'invmgmt-toggle-active' : 'invmgmt-toggle-inactive'}" 
                   onclick="invmgmtToggleAvailability('${product.id}', '${product.isAvailable}')"
                   title="${product.isAvailable === 'Y' ? 'Click to mark unavailable' : 'Click to mark available'}"></i>
                <i class="fas fa-edit action-icons" onclick="invmgmtEditProduct('${product.id}')" title="Edit product"></i>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Initialize sorting functionality
    invmgmtInitSorting();

    // Add click event listeners to image preview triggers
    document.querySelectorAll('.invmgmt-preview-trigger').forEach(trigger => {
        trigger.addEventListener('click', function () {
            const imageUrl = this.getAttribute('data-image-url');
            invmgmtShowEnlargedImage(imageUrl);
        });
    });
}

function invmgmtInitFilters() {
    // Get unique values for segments and types
    const uniqueSegments = [...new Set(products.map(product => product.segment))].sort();
    const uniqueTypes = [...new Set(products.map(product => product.type))].sort();

    // Populate segment filter dropdown
    const segmentFilterEl = document.getElementById('invmgmtSegmentFilter');
    if (segmentFilterEl) {
        // Clear existing options first to prevent duplicates
        segmentFilterEl.innerHTML = '<option value="">[All Segments]</option>';

        uniqueSegments.forEach(segment => {
            const option = document.createElement('option');
            option.value = segment;
            option.textContent = segment;
            segmentFilterEl.appendChild(option);
        });
        segmentFilterEl.addEventListener('change', invmgmtApplyFilters);
    }

    // Populate type filter dropdown
    const typeFilterEl = document.getElementById('invmgmtTypeFilter');
    if (typeFilterEl) {
        // Clear existing options first to prevent duplicates
        typeFilterEl.innerHTML = '<option value="">[All Types]</option>';

        uniqueTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            typeFilterEl.appendChild(option);
        });
        typeFilterEl.addEventListener('change', invmgmtApplyFilters);
    }

    // Set up available filter
    const availableFilterEl = document.getElementById('invmgmtAvailableFilter');
    if (availableFilterEl) {
        availableFilterEl.addEventListener('change', invmgmtApplyFilters);
    }

    const resetFiltersBtn = document.getElementById('invmgmtResetFiltersBtn');
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', invmgmtResetFilters);
    }
}

function invmgmtApplyFilters() {
    // Update filter values
    const segmentFilterEl = document.getElementById('invmgmtSegmentFilter');
    const typeFilterEl = document.getElementById('invmgmtTypeFilter');
    const availableFilterEl = document.getElementById('invmgmtAvailableFilter');

    invmgmtFilters.segment = segmentFilterEl ? segmentFilterEl.value : '';
    invmgmtFilters.type = typeFilterEl ? typeFilterEl.value : '';
    invmgmtFilters.available = availableFilterEl ? availableFilterEl.value : '';

    // Apply filters to the products array
    invmgmtFilteredProducts = products.filter(product => {
        return (invmgmtFilters.segment === '' || product.segment === invmgmtFilters.segment) &&
            (invmgmtFilters.type === '' || product.type === invmgmtFilters.type) &&
            (invmgmtFilters.available === '' || product.isAvailable === invmgmtFilters.available);
    });

    // Reload the table with filtered products
    loadInventoryTable(invmgmtFilteredProducts);
}

function invmgmtResetFilters() {
    const segmentFilterEl = document.getElementById('invmgmtSegmentFilter');
    const typeFilterEl = document.getElementById('invmgmtTypeFilter');
    const availableFilterEl = document.getElementById('invmgmtAvailableFilter');

    if (segmentFilterEl) segmentFilterEl.value = '';
    if (typeFilterEl) typeFilterEl.value = '';
    if (availableFilterEl) availableFilterEl.value = '';

    invmgmtFilters = {
        segment: '',
        type: '',
        available: ''
    };

    // Reset filtered products to all products
    invmgmtFilteredProducts = [...products];

    // Reload the table
    loadInventoryTable(invmgmtFilteredProducts);
}

function invmgmtSortProducts(productsArray) {
    // Apply multi-column sorting
    productsArray.sort((a, b) => {
        // Compare by segment first
        if (a.segment.toLowerCase() !== b.segment.toLowerCase()) {
            return invmgmtSortDirections.segment === 'asc'
                ? a.segment.toLowerCase().localeCompare(b.segment.toLowerCase())
                : b.segment.toLowerCase().localeCompare(a.segment.toLowerCase());
        }

        // Then by type
        if (a.type.toLowerCase() !== b.type.toLowerCase()) {
            return invmgmtSortDirections.type === 'asc'
                ? a.type.toLowerCase().localeCompare(b.type.toLowerCase())
                : b.type.toLowerCase().localeCompare(a.type.toLowerCase());
        }

        // Finally by name
        return invmgmtSortDirections.name === 'asc'
            ? a.name.toLowerCase().localeCompare(b.name.toLowerCase())
            : b.name.toLowerCase().localeCompare(a.name.toLowerCase());
    });

    return productsArray;
}

function invmgmtInitSorting() {
    const headers = document.querySelectorAll('#invmgmtProductTable th.invmgmt-sortable');
    headers.forEach(header => {
        header.addEventListener('click', function () {
            const column = this.getAttribute('data-column');

            // Update sort direction
            if (column === invmgmtSortColumns[0]) {
                // Toggle direction for primary sort column
                invmgmtSortDirections[column] = invmgmtSortDirections[column] === 'asc' ? 'desc' : 'asc';
            } else {
                // Make this the primary sort column
                invmgmtSortColumns = [column, ...invmgmtSortColumns.filter(col => col !== column)];
            }

            // Re-sort and reload
            invmgmtSortProducts(products);
            loadInventoryTable(products);

            // Update sort indicators
            invmgmtUpdateSortIndicators();
        });
    });

    // Initialize sort indicators
    invmgmtUpdateSortIndicators();
}

function invmgmtUpdateSortIndicators() {
    // Remove all sort indicators
    document.querySelectorAll('#invmgmtProductTable th.invmgmt-sortable').forEach(th => {
        th.classList.remove('invmgmt-sort-asc', 'invmgmt-sort-desc');
        th.setAttribute('data-sort-order', '');
    });

    // Add indicators for active sort columns
    invmgmtSortColumns.forEach((column, index) => {
        const th = document.querySelector(`#invmgmtProductTable th[data-column="${column}"]`);
        if (th) {
            const direction = invmgmtSortDirections[column];
            th.classList.add(`invmgmt-sort-${direction}`);
            th.setAttribute('data-sort-order', index + 1);
        }
    });
}

function populateSegmentDropdown(segments) {
    const segmentDropdown = document.getElementById('segment');
    segmentDropdown.innerHTML = '<option value="">[Select]</option>'; // Clear existing options and add default
    const segmentArray = segments.split(',');
    segmentArray.forEach(segment => {
        const option = document.createElement('option');
        option.value = segment;
        option.textContent = segment;
        segmentDropdown.appendChild(option);
    });
}

const addProductBtn = document.getElementById('invmgmtAddProductBtn');
if (addProductBtn) {
    addProductBtn.addEventListener('click', () => {
        invmgmtOpenModal();
    });
}

const productForm = document.getElementById('invmgmtProductForm');
if (productForm) {
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Reset previous error states
        invmgmtClearValidationErrors();

        let hasErrors = false;
        const formData = new FormData(e.target);
        const productId = formData.get('productId');

        // Validate name
        const name = formData.get('name').trim();
        if (!name) {
            displayValidationError('name', 'Product name is required');
            hasErrors = true;
        }

        // Validate ingredients
        const ingredients = formData.get('ingredients').trim();
        if (!ingredients) {
            displayValidationError('ingredients', 'Ingredients are required');
            hasErrors = true;
        }

        // Validate description
        const description = formData.get('description').trim();
        if (!description) {
            displayValidationError('description', 'Description is required');
            hasErrors = true;
        }

        // Validate image
        const imageFile = formData.get('image');
        const existingImageUrl = formData.get('imageUrl');
        if (!imageFile || imageFile.size === 0) {
            if (!existingImageUrl && !document.getElementById('productId').value) {
                displayValidationError('image', 'Image is required');
                hasErrors = true;
            }
        }

        // Validate price
        const price = formData.get('price').trim();
        if (!price) {
            displayValidationError('price', 'Price is required');
            hasErrors = true;
        } else if (!/^\d+(\.\d{1,2})?$/.test(price)) {
            displayValidationError('price', 'Price must be a number with up to 2 decimal places');
            hasErrors = true;
        }

        // If there are errors, stop form submission
        if (hasErrors) {
            return;
        }

        // Continue with form submission
        showLoader(true);

        let imageUrl = '';
        if (imageFile && imageFile.size > 0) {
            try {
                const fileName = `${imageFile.name}`;
                const imageData = {
                    action: 'generateSignedUrl',
                    fileName: fileName
                };

                const signedUrlResult = await callAPIviaPOST(imageData);
                const signedUrl = signedUrlResult.signedUrl;

                if (!signedUrl) {
                    throw new Error("Signed URL is undefined in the response.");
                }

                const uploadResponse = await fetch(signedUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/octet-stream'
                    },
                    body: imageFile
                });

                if (uploadResponse.ok) {
                    imageUrl = `https://storage.googleapis.com/bonbites-product-images/${fileName}`;
                } else {
                    console.error('Failed to upload image');
                }
            } catch (error) {
                console.error('Error processing image upload:', error);
                showLoader(false);
                return;
            }
        }

        const productData = {
            action: productId ? 'updateProduct' : 'insertProduct',
            storeType: document.querySelector('meta[name="store-type"]').getAttribute('content'),
            productId: productId || '',
            segment: formData.get('segment'),
            type: formData.get('type'),
            name: formData.get('name'),
            ingredients: formData.get('ingredients'),
            description: formData.get('description'),
            imageUrl: imageUrl || formData.get('imageUrl'),
            price: formData.get('price'),
            isAvailable: formData.get('isAvailable') === 'on' ? 'Y' : 'N'
        };

        // save product data
        await invmgmtSaveProduct(productData);

        // reload inventory
        await invmgmtLoadInventory(false);
        invmgmtCloseModal();
        showLoader(false);
    });
}


function invmgmtDisplayValidationError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorMsgId = `invmgmt-${fieldId}-error`;

    // Add error class to the field
    field.classList.add('invmgmt-error-field');

    // Check if error message element exists
    let errorMsg = document.getElementById(errorMsgId);
    if (!errorMsg) {
        errorMsg = document.createElement('div');
        errorMsg.id = errorMsgId;
        errorMsg.className = 'invmgmt-error-message';
        field.parentNode.insertBefore(errorMsg, field.nextSibling);
    }

    errorMsg.textContent = message;
}

function invmgmtClearValidationErrors() {
    // Remove all error messages
    document.querySelectorAll('.invmgmt-error-message').forEach(el => el.remove());

    // Remove error class from all fields
    document.querySelectorAll('.invmgmt-error-field').forEach(el =>
        el.classList.remove('invmgmt-error-field'));
}

// Inventory management image preview functionality
document.addEventListener('DOMContentLoaded', function () {
    const imageInput = document.getElementById('image');
    if (imageInput) {
        imageInput.addEventListener('change', invmgmtHandleImageChange);
    }

    const removeImageBtn = document.getElementById('invmgmtRemoveImageBtn');
    if (removeImageBtn) {
        removeImageBtn.addEventListener('click', invmgmtRemoveImage);
    }
});

function invmgmtHandleImageChange(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();

        reader.onload = function (e) {
            const preview = document.getElementById('invmgmtImagePreview');
            if (preview) {
                preview.src = e.target.result;

                // Show the preview container
                const previewContainer = document.getElementById('invmgmtImagePreviewContainer');
                if (previewContainer) {
                    previewContainer.style.display = 'block';
                }
            }
        };

        reader.readAsDataURL(file);
    }
}

function invmgmtRemoveImage() {
    const imageInput = document.getElementById('image');
    if (imageInput) {
        imageInput.value = '';
    }

    const imageUrlInput = document.getElementById('imageUrl');
    if (imageUrlInput) {
        imageUrlInput.value = '';
    }

    const previewContainer = document.getElementById('invmgmtImagePreviewContainer');
    if (previewContainer) {
        previewContainer.style.display = 'none';
    }
}

function invmgmtShowEnlargedImage(imageUrl) {
    // Check if there's already a modal and remove it
    const existingModal = document.querySelector('.invmgmt-enlarged-image-modal');
    if (existingModal) {
        document.body.removeChild(existingModal);
    }

    // Create modal for enlarged image
    const modal = document.createElement('div');
    modal.className = 'invmgmt-enlarged-image-modal';

    // Create close button
    const closeBtn = document.createElement('span');
    closeBtn.className = 'invmgmt-enlarged-image-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = function (e) {
        e.stopPropagation();
        document.body.removeChild(modal);
    };

    // Create container for the image
    const imgContainer = document.createElement('div');
    imgContainer.className = 'invmgmt-enlarged-image-container';

    // Create image element
    const img = document.createElement('img');
    img.src = imageUrl;
    img.className = 'invmgmt-enlarged-image';

    // Append elements
    imgContainer.appendChild(img);
    modal.appendChild(closeBtn);
    modal.appendChild(imgContainer);

    // Append modal to body
    document.body.appendChild(modal);

    // Close modal when clicking outside the image
    modal.onclick = function (e) {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    };
}

async function invmgmtSaveProduct(productData) {
    await callAPIviaPOST(productData);
}

async function invmgmtToggleAvailability(productId, currentStatus) {
    try {
        showLoader(true);

        // Prepare the data to send
        const toggleData = {
            action: 'toggleAvailability',
            productId: productId,
            storeType: storeType
        };

        // Send the request to toggle availability
        const result = await callAPIviaPOST(toggleData);
        if (result.status === 'success') {
            // Reload inventory data with current filters
            await invmgmtLoadInventory(true);

            console.log(`Product ${productId} availability toggled successfully`);
        } else {
            console.error('Failed to toggle availability:', result.message || 'Unknown error');
        }
    } catch (error) {
        console.error('Error toggling availability:', error);
    } finally {
        showLoader(false);
    }
}

async function invmgmtEditProduct(productId) {
    showLoader(true);
    await fetch(`${API_URL}?type=product&productId=${productId}`)
        .then(response => response.json())
        .then(product => {
            document.getElementById('productId').value = product.id;
            document.getElementById('segment').value = product.segment;
            document.getElementById('type').value = product.type;
            document.getElementById('name').value = product.name;
            document.getElementById('ingredients').value = product.ingredients;
            document.getElementById('description').value = product.description;
            document.getElementById('price').value = product.price;
            document.getElementById('isAvailable').checked = product.isAvailable === 'Y';

            // Set the existing image URL and show preview
            if (product.imageUrl) {
                document.getElementById('imageUrl').value = product.imageUrl;

                const imagePreview = document.getElementById('invmgmtImagePreview');
                const previewContainer = document.getElementById('invmgmtImagePreviewContainer');

                if (imagePreview && previewContainer) {
                    // Set the image source
                    imagePreview.src = product.imageUrl;

                    // Apply thumbnail styling
                    imagePreview.style.maxWidth = "150px";
                    imagePreview.style.maxHeight = "100px";
                    imagePreview.style.objectFit = "contain";
                    imagePreview.style.border = "1px solid #ddd";
                    imagePreview.style.borderRadius = "4px";
                    imagePreview.style.padding = "3px";

                    // Show the container
                    previewContainer.style.display = 'block';
                }
            } else {
                // Hide preview if no image
                const previewContainer = document.getElementById('invmgmtImagePreviewContainer');
                if (previewContainer) {
                    previewContainer.style.display = 'none';
                }
            }

            invmgmtOpenModal();
            showLoader(false);
        })
        .catch(error => {
            console.error('Error fetching product details:', error);
            showLoader(false);
        });
}

function invmgmtPreviewImage(event) {
    const file = event.target.files[0];
    const previewImage = document.getElementById('invmgmtImagePreview');
    const previewContainer = document.getElementById('invmgmtImagePreviewContainer');

    if (file && previewImage && previewContainer) {
        const reader = new FileReader();

        reader.onload = function (e) {
            previewImage.src = e.target.result;

            // Apply thumbnail styling
            previewImage.style.maxWidth = "150px";
            previewImage.style.maxHeight = "100px";
            previewImage.style.objectFit = "contain";
            previewImage.style.border = "1px solid #ddd";
            previewImage.style.borderRadius = "4px";
            previewImage.style.padding = "3px";

            previewContainer.style.display = 'block';
        };

        reader.readAsDataURL(file);
    }
}

function invmgmtOpenModal() {
    const modal = document.getElementById('invmgmtProductModal');
    modal.style.display = 'block';
}

function invmgmtCloseModal() {
    const modal = document.getElementById('invmgmtProductModal');
    modal.style.display = 'none';
    document.getElementById('invmgmtProductForm').reset();

    // Clear the image preview to prevent it from showing in a new modal
    const previewContainer = document.getElementById('invmgmtImagePreviewContainer');
    const previewImage = document.getElementById('invmgmtImagePreview');

    if (previewContainer) {
        previewContainer.style.display = 'none';
    }

    if (previewImage) {
        previewImage.src = '';
    }
}

const cancelModalBtn = document.getElementById('invmgmtCancelModalBtn');
if (cancelModalBtn) {
    cancelModalBtn.addEventListener('click', invmgmtCloseModal);
}

const closeModalBtn = document.querySelector('.close');
if (closeModalBtn) {
    closeModalBtn.addEventListener('click', invmgmtCloseModal);
}

//------------ONLINE STORE LOGIC

function loadMenu() {
    const segments = {};
    // Organize products by segments
    products.forEach(product => {
        if (!segments[product.segment]) {
            segments[product.segment] = [];
        }
        segments[product.segment].push(product);
    });

    const menuContainer = document.getElementById('menu-products');

    const menuHeaderDiv = document.createElement('div');
    menuHeaderDiv.className = 'menu-header';

    const menuBrandDiv = document.createElement('div');
    menuBrandDiv.className = 'menu-hf-text';
    menuBrandDiv.innerHTML = `<div><p>Tomorrow's Menu</p></div>`;

    menuHeaderDiv.appendChild(menuBrandDiv);
    menuContainer.appendChild(menuHeaderDiv);

    Object.keys(segments).forEach(segment => {
        const segmentDiv = document.createElement('div');
        segmentDiv.className = 'menu-segment';

        const title = document.createElement('div');
        title.className = 'menu-segment-title';
        title.textContent = segment;
        segmentDiv.appendChild(title);

        segments[segment].forEach(product => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'menu-product-card';

            let typeLogoSrc = product.type === "Veg" ? "resources/veg-logo.png" : "resources/nonveg-logo.png";

            cardDiv.innerHTML = `
                    <img class="menu-product-image" src="${product.imageUrl}" alt="${product.name}">
                    <div class="menu-product-details">
                        <h3>${product.name}</h3>
                        <p><strong>Ingredients:</strong> ${product.ingredients}</p>
                        <p><strong>Serving Info:</strong> ${product.description}</p>
                    </div>
                    <div class="menu-product-price">₹${product.price}</div>
                    <img class="menu-product-logo" src="${typeLogoSrc}" alt="${product.type}">
                `;

            segmentDiv.appendChild(cardDiv);
        });

        menuContainer.appendChild(segmentDiv);
    });

    const menuFooterDiv = document.createElement('div');
    menuFooterDiv.className = 'menu-footer';

    const menuInfoDiv = document.createElement('div');
    menuInfoDiv.className = 'menu-hf-text menu-footer-text';
    menuInfoDiv.innerHTML = `
            <div class="footer-left">
            <p>To Order, please go to <a class="static-title" href="https://food.bonstudio.store" target="_blank">food.bonstudio.store</a></p>
            <p style="display: flex; align-items: center;">Follow us on &nbsp;
                <a style="display: flex; align-items: center;" href="https://www.instagram.com/bonstudio.store/profilecard/?igsh=NW5lMm1wZDhhNTd1" target="_blank">
                    <img src="resources/insta-logo.png" height="30px" , width="30px" />
                </a>
            </p>
            </div>
            <div class="footer-right">
                <img src="resources/logo.png" alt="BonBites" height="150px" , width="150px"/>
            </div>
        `;

    menuFooterDiv.appendChild(menuInfoDiv);
    menuContainer.appendChild(menuFooterDiv);
}

async function generatePDF() {
    const customMenu = document.querySelector('div.custom-menu');
    if (customMenu) customMenu.style.display = 'none'; // Temporarily hide the context menu

    const element = document.body; // Element to convert to PDF
    const canvas = await html2canvas(element);
    const imageData = canvas.toDataURL('image/png');
    const pdf = new jspdf.jsPDF({
        orientation: 'p',
        unit: 'px',
        format: [canvas.width, canvas.height]
    });
    pdf.addImage(imageData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save('menu.pdf');

    if (customMenu) customMenu.style.display = 'block';
}

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
            <img src="${product.imageUrl}" alt="${product.name}">
            <p class="product-name">${product.name}</p> 
            <p class="product-ingredients"><strong>Contains:</strong> ${product.ingredients}</p> 
            <p class="product-description"><strong>Serving Info:</strong> ${product.description}</p>
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

    allDeliveryOptions.sort((a, b) => {
        const getHour = time => {
            const [hour] = time.split('-');
            return parseInt(hour.trim(), 10);
        };

        // Comparing hours for sorting
        return getHour(a) - getHour(b);
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

function calculateOrderTotal(items) {
    return items.reduce((total, item) => {
        return total + (parseFloat(item.price) * parseInt(item.quantity));
    }, 0);
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
        action: 'insertOrder',
        storeType: 'online',
        name: document.getElementById('name').value,
        flat: document.getElementById('flat').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        deliveryOption: document.getElementById('delivery-time-dropdown').value,
        items: combinedItems,  // Pass the combined items array
        totalAmount: calculateOrderTotal(cartItems),
        userAgent: user_agt,
        userIp: user_ip
    };

    try {
        const result = await callAPIviaPOST(formData);
        if (result.status === 'success') {
            alert(`Order placed! Your order ID is ${result.orderId}.`);
            //alert(`Data submitted, Thank you!`);
            clearExistingDataForOnlineStore();
        } else {
            alert('Failed to place the order.');
        }
        showLoader(false);
    } catch (error) {
        showLoader(false);
        alert('Failed to place the order. Check console for logs..');
        console.error('Failed to place order:', error);
    }
}

function clearExistingDataForOnlineStore() {
    // Save delivery options data first
    const deliveryOptionsData = localStorage.getItem('deliveryOptions');

    // Clear specific items instead of all localStorage
    localStorage.removeItem('cart');
    localStorage.removeItem('interestedItems');

    // Restore delivery options data
    if (deliveryOptionsData) {
        localStorage.setItem('deliveryOptions', deliveryOptionsData);
    }

    // Clear form fields
    clearCustomerInfoForOnlineStore();
    clearOrderDetailsForOnlineStore();
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
        action: 'insertOrder',
        storeType: 'local',
        name: document.getElementById('name').value,
        items: products.filter(item => item.quantity > 0).map(item => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity
        })),
        totalAmount: calculateOrderTotal(cartItems)
    };

    try {
        const result = await callAPIviaPOST(formData);
        if (result.status === 'success') {
            alert(`Order placed! Your order ID is ${result.orderId}.`);
            clearExistingDataForLocalStore();
        } else {
            alert('Failed to place the order.');
        }
        showLoader(false);
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
        action: 'updateOrder',
        storeType: storeType,
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

//------------STOCK MGMT LOGIC

// Global variables for stock management
let stockItems = [];
let stockFilteredItems = [];
let stockSortColumns = ['name', 'type', 'location'];
let stockSortDirections = {
    name: 'asc',
    type: 'asc',
    location: 'asc',
    quantity: 'asc',
    expirationDate: 'asc',
    status: 'asc'
};

let stockFilters = {
    type: '',
    location: '',
    status: ''
};

async function stockLoadItems(reapplyFilters = false) {
    try {
        showLoader(true);

        // Fetch stock items from server
        stockItems = await fetchStockItems();

        if (!reapplyFilters) {
            // Reset filters and use all items
            stockFilteredItems = [...stockItems];
            stockInitFilters();
        } else {
            // Re-apply current filters to the fresh data
            stockApplyFilters();
        }

        // Load the stock items display
        loadStockItemTable(stockFilteredItems);
    } catch (error) {
        console.error('Error loading stock items:', error);
    } finally {
        showLoader(false);
    }
}

async function fetchStockItems() {
    try {
        showLoader(true);
        const response = await fetch(API_URL + '?type=stock');
        const data = await response.json();
        //console.log('Stock data received:', data); // Debug log
        
        if (!data || (Array.isArray(data) && data.length === 0)) {
            console.log('No stock items found or empty array returned.');
            return [];
        }
        
        return data;
    } catch (error) {
        console.error('Error fetching stock items:', error);
        return [];
    } finally {
        showLoader(false);
    }
}

function loadStockItemTable(items) {
    // Sort items
    stockSortItems(items);

    const tbody = document.getElementById('stockItemTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    //console.log('Loading table with items:', items); // Debug log

    items.forEach(item => {
        const row = document.createElement('tr');

        // Format the date for display - handle potential invalid dates
        let formattedDate = 'N/A';
        if (item.ExpirationDate) {
            try {
                const expirationDate = new Date(item.ExpirationDate);
                if (!isNaN(expirationDate.getTime())) {
                    formattedDate = expirationDate.toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: '2-digit', 
                        day: '2-digit' 
                    });
                }
            } catch (e) {
                console.error('Error formatting date:', e);
            }
        }
        // Add cells with data - add null/undefined checks
        row.innerHTML = `
            <td>${item.Name || 'N/A'}</td>
            <td>${item.Type || 'N/A'}</td>
            <td>${item.Location || 'N/A'}</td>
            <td>${item.Quantity || '0'}</td>
            <td>${formattedDate}</td>
            <td>${item.Status || 'N/A'}</td>
            <td>
                <i class="fas fa-edit action-icons" onclick="stockEditItem('${item.Id}')" title="Edit item"></i>
                <i class="fas fa-trash-alt action-icons" onclick="stockDeleteItem('${item.Id}')" title="Delete item"></i>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Initialize sorting functionality
    stockInitSorting();
}

function stockInitFilters() {
    // Set up filter event listeners
    const typeFilterEl = document.getElementById('stockTypeFilter');
    const locationFilterEl = document.getElementById('stockLocationFilter');
    const statusFilterEl = document.getElementById('stockStatusFilter');
    const resetFiltersBtn = document.getElementById('stockResetFiltersBtn');

    if (typeFilterEl) typeFilterEl.addEventListener('change', stockApplyFilters);
    if (locationFilterEl) locationFilterEl.addEventListener('change', stockApplyFilters);
    if (statusFilterEl) statusFilterEl.addEventListener('change', stockApplyFilters);
    if (resetFiltersBtn) resetFiltersBtn.addEventListener('click', stockResetFilters);
}

function stockApplyFilters() {
    // Update filter values
    const typeFilterEl = document.getElementById('stockTypeFilter');
    const locationFilterEl = document.getElementById('stockLocationFilter');
    const statusFilterEl = document.getElementById('stockStatusFilter');

    stockFilters.type = typeFilterEl ? typeFilterEl.value : '';
    stockFilters.location = locationFilterEl ? locationFilterEl.value : '';
    stockFilters.status = statusFilterEl ? statusFilterEl.value : '';

    // Apply filters to the items array with correct casing
    stockFilteredItems = stockItems.filter(item => {
        return (stockFilters.type === '' || item.Type === stockFilters.type) &&
            (stockFilters.location === '' || item.Location === stockFilters.location) &&
            (stockFilters.status === '' || item.Status === stockFilters.status);
    });

    // Reload the table with filtered items
    loadStockItemTable(stockFilteredItems);
}

function stockResetFilters() {
    const typeFilterEl = document.getElementById('stockTypeFilter');
    const locationFilterEl = document.getElementById('stockLocationFilter');
    const statusFilterEl = document.getElementById('stockStatusFilter');

    if (typeFilterEl) typeFilterEl.value = '';
    if (locationFilterEl) locationFilterEl.value = '';
    if (statusFilterEl) statusFilterEl.value = '';

    stockFilters = {
        type: '',
        location: '',
        status: ''
    };

    // Reset filtered items to all items
    stockFilteredItems = [...stockItems];

    // Reload the table
    loadStockItemTable(stockFilteredItems);
}

function stockSortItems(itemsArray) {
    // Apply multi-column sorting
    itemsArray.sort((a, b) => {
        // Compare by first sort column
        const column1 = stockSortColumns[0];
        const direction1 = stockSortDirections[column1];
        
        // Get capitalized property names
        const prop1 = column1.charAt(0).toUpperCase() + column1.slice(1);
        
        if (prop1 === 'ExpirationDate') {
            const dateA = new Date(a[prop1]);
            const dateB = new Date(b[prop1]);
            const comparison = dateA - dateB;
            
            if (comparison !== 0) {
                return direction1 === 'asc' ? comparison : -comparison;
            }
        } else {
            const valA = String(a[prop1]).toLowerCase();
            const valB = String(b[prop1]).toLowerCase();
            const comparison = valA.localeCompare(valB);
            
            if (comparison !== 0) {
                return direction1 === 'asc' ? comparison : -comparison;
            }
        }
        
        // If tied on first column, use second column
        if (stockSortColumns.length > 1) {
            const column2 = stockSortColumns[1];
            const direction2 = stockSortDirections[column2];
            
            if (column2 === 'expirationDate') {
                const dateA = new Date(a[column2]);
                const dateB = new Date(b[column2]);
                const comparison = dateA - dateB;
                
                if (comparison !== 0) {
                    return direction2 === 'asc' ? comparison : -comparison;
                }
            } else {
                const valA = String(a[column2]).toLowerCase();
                const valB = String(b[column2]).toLowerCase();
                const comparison = valA.localeCompare(valB);
                
                if (comparison !== 0) {
                    return direction2 === 'asc' ? comparison : -comparison;
                }
            }
        }
        
        return 0;
    });

    return itemsArray;
}

function stockInitSorting() {
    const headers = document.querySelectorAll('#stockItemTable th.stock-sortable');
    headers.forEach(header => {
        header.addEventListener('click', function () {
            const column = this.getAttribute('data-column');

            // Update sort direction
            if (column === stockSortColumns[0]) {
                // Toggle direction for primary sort column
                stockSortDirections[column] = stockSortDirections[column] === 'asc' ? 'desc' : 'asc';
            } else {
                // Make this the primary sort column
                stockSortColumns = [column, ...stockSortColumns.filter(col => col !== column)];
            }

            // Re-sort and reload
            stockSortItems(stockFilteredItems);
            loadStockItemTable(stockFilteredItems);

            // Update sort indicators
            stockUpdateSortIndicators();
        });
    });

    // Initialize sort indicators
    stockUpdateSortIndicators();
}

function stockUpdateSortIndicators() {
    // Remove all sort indicators
    document.querySelectorAll('#stockItemTable th.stock-sortable').forEach(th => {
        th.classList.remove('stock-sort-asc', 'stock-sort-desc');
        th.setAttribute('data-sort-order', '');
    });

    // Add indicators for active sort columns
    stockSortColumns.forEach((column, index) => {
        const th = document.querySelector(`#stockItemTable th[data-column="${column}"]`);
        if (th) {
            const direction = stockSortDirections[column];
            th.classList.add(`stock-sort-${direction}`);
            th.setAttribute('data-sort-order', index + 1);
        }
    });
}

// Event listeners for stock management
document.addEventListener('DOMContentLoaded', function() {
    const addItemBtn = document.getElementById('stockAddItemBtn');
    if (addItemBtn) {
        addItemBtn.addEventListener('click', stockOpenModal);
    }

    const itemForm = document.getElementById('stockItemForm');
    if (itemForm) {
        itemForm.addEventListener('submit', stockSaveItem);
    }

    const cancelModalBtn = document.getElementById('stockCancelModalBtn');
    if (cancelModalBtn) {
        cancelModalBtn.addEventListener('click', stockCloseModal);
    }

    const closeModalBtn = document.getElementById('stockCloseModalBtn');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', stockCloseModal);
    }
});

function stockOpenModal() {
    const modal = document.getElementById('stockItemModal');
    if (modal) {
        // Reset form for new item
        document.getElementById('stockItemId').value = '';
        document.getElementById('stockItemForm').reset();
        modal.style.display = 'block';
    }
}

function stockCloseModal() {
    const modal = document.getElementById('stockItemModal');
    if (modal) {
        modal.style.display = 'none';
        // Clear form and validation errors
        document.getElementById('stockItemForm').reset();
        stockClearValidationErrors();
    }
}

async function stockEditItem(itemId) {
    try {
        showLoader(true);
        
        // Fetch item details from server
        const response = await fetch(`${API_URL}?type=stock-item&itemId=${itemId}`);
        const item = await response.json();
        
        //console.log("Editing item:", item); // Debug log
        
        // Open the modal first (so the form exists in the DOM)
        const modal = document.getElementById('stockItemModal');
        if (modal) {
            modal.style.display = 'block';
        }
        
        // Populate form with item details (notice the capitalized property names)
        document.getElementById('stockItemId').value = item.Id || '';
        document.getElementById('stockName').value = item.Name || '';
        document.getElementById('stockType').value = item.Type || '';
        document.getElementById('stockLocation').value = item.Location || '';
        document.getElementById('stockQuantity').value = item.Quantity || '';
        
        // Format date for input field (YYYY-MM-DD)
        if (item.ExpirationDate) {
            const expirationDate = new Date(item.ExpirationDate);
            if (!isNaN(expirationDate.getTime())) {
                // Format as YYYY-MM-DD for input[type="date"]
                const formattedDate = expirationDate.toISOString().split('T')[0];
                document.getElementById('stockExpirationDate').value = formattedDate;
            }
        }
        
        document.getElementById('stockStatus').value = item.Status || '';
        
    } catch (error) {
        console.error('Error fetching stock item details:', error);
    } finally {
        showLoader(false);
    }
}

async function stockDeleteItem(itemId) {
    if (confirm('Are you sure you want to delete this item?')) {
        try {
            showLoader(true);
            
            const data = {
                action: 'deleteStockItem',
                itemId: itemId
            };
            
            const result = await callAPIviaPOST(data);
            
            if (result.status === 'success') {
                await stockLoadItems(true);
            } else {
                alert('Failed to delete item: ' + result.message);
            }
        } catch (error) {
            console.error('Error deleting stock item:', error);
            alert('Failed to delete item. Check console for details.');
        } finally {
            showLoader(false);
        }
    }
}

async function stockSaveItem(e) {
    e.preventDefault();
    
    // Reset previous error states
    stockClearValidationErrors();
    
    let hasErrors = false;
    const form = e.target;
    const formData = new FormData(form);
    
    // Validate name
    const name = formData.get('stockName').trim();
    if (!name) {
        stockDisplayValidationError('stockName', 'Item name is required');
        hasErrors = true;
    }
    
    // Validate type
    const type = formData.get('stockType');
    if (!type) {
        stockDisplayValidationError('stockType', 'Please select a type');
        hasErrors = true;
    }
    
    // Validate location
    const location = formData.get('stockLocation');
    if (!location) {
        stockDisplayValidationError('stockLocation', 'Please select a storage location');
        hasErrors = true;
    }
    
    // Validate quantity
    const quantity = formData.get('stockQuantity').trim();
    if (!quantity) {
        stockDisplayValidationError('stockQuantity', 'Quantity is required');
        hasErrors = true;
    }
    
    // Validate expiration date
    const expirationDate = formData.get('stockExpirationDate');
    if (!expirationDate) {
        stockDisplayValidationError('stockExpirationDate', 'Expiration date is required');
        hasErrors = true;
    }
    
    // Validate status
    const status = formData.get('stockStatus');
    if (!status) {
        stockDisplayValidationError('stockStatus', 'Please select a status');
        hasErrors = true;
    }
    
    // If there are errors, stop form submission
    if (hasErrors) {
        return;
    }
    
    try {
        showLoader(true);
        
        const itemId = formData.get('stockItemId');
        
        // Prepare the data to send 
        const data = {
            action: itemId ? 'updateStockItem' : 'insertStockItem',
            itemId: itemId || '',
            name: name,  
            type: type,  
            location: location,  
            quantity: quantity,  
            expirationDate: expirationDate,  
            status: status  
        };
        
        const result = await callAPIviaPOST(data);
        
        if (result.status === 'success') {
            stockCloseModal();
            await stockLoadItems(true);
        } else {
            alert('Failed to save item: ' + result.message);
        }
    } catch (error) {
        console.error('Error saving stock item:', error);
        alert('Failed to save item. Check console for details.');
    } finally {
        showLoader(false);
    }
}

function stockDisplayValidationError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorMsgId = `stock-${fieldId}-error`;
    
    // Add error class to the field
    field.classList.add('stock-error-field');
    
    // Check if error message element exists
    let errorMsg = document.getElementById(errorMsgId);
    if (!errorMsg) {
        errorMsg = document.createElement('div');
        errorMsg.id = errorMsgId;
        errorMsg.className = 'stock-error-message';
        field.parentNode.insertBefore(errorMsg, field.nextSibling);
    }
    
    errorMsg.textContent = message;
}

function stockClearValidationErrors() {
    // Remove all error messages
    document.querySelectorAll('.stock-error-message').forEach(el => el.remove());
    
    // Remove error class from all fields
    document.querySelectorAll('.stock-error-field').forEach(el => 
        el.classList.remove('stock-error-field'));
}

// setInterval(fetchOrders, 10000); // Fetch orders every 10 seconds
