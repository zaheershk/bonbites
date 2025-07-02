let currentVariations = [];

// Global variables for products management
let productSortColumns = ['segment', 'type', 'name'];
let productSortDirections = {
    segment: 'asc',
    type: 'asc',
    name: 'asc'
};

let productFilteredProducts = [];
let productFilters = {
    segment: '',
    type: '',
    available: '',
    searchTerm: ''
};

async function loadProducts(reapplyFilters = false) {
    try {
        showLoader(true);

        // Fetch products from server
        products = await fetchProducts(false);

        if (!reapplyFilters) {
            // Reset filters and use all products
            productFilteredProducts = [...products];
            productInitFilters();
        } else {
            // Re-apply current filters to the fresh data
            productApplyFilters();
        }

        // Load the products display
        loadProductsTable(productFilteredProducts);

        // Ensure segment dropdown is populated
        if (settings && settings.Segments) {
            populateSegmentDropdown(settings.Segments);
        }
    } catch (error) {
        console.error('Error loading products:', error);
    } finally {
        showLoader(false);
    }
}

function loadProductsTable(products) {
    // Sort products by default
    productSortItems(products);

    const tbody = document.getElementById('productProductTableBody');
    tbody.innerHTML = '';

    products.forEach(product => {
        const row = document.createElement('tr');

        // Image thumbnail cell
        const imgCell = document.createElement('td');
        imgCell.className = 'product-table-img-cell';

        if (product.imageUrl) {
            // Create image thumbnail wrapper
            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'product-table-img-wrapper';
            imgWrapper.setAttribute('data-image-url', product.imageUrl);
            imgWrapper.setAttribute('role', 'button');
            imgWrapper.setAttribute('aria-label', 'Click to preview image');
            imgWrapper.classList.add('product-preview-trigger');

            // Create the image element
            const img = document.createElement('img');
            img.src = product.imageUrl;
            img.alt = product.name;
            img.className = 'product-table-img';

            // Add image to wrapper, wrapper to cell
            imgWrapper.appendChild(img);
            imgCell.appendChild(imgWrapper);
        } else {
            // If no image, show placeholder
            imgCell.innerHTML = '<div class="product-no-img-placeholder">No Image</div>';
        }
        row.appendChild(imgCell);

        // Determine type display and price display based on variations
        let typeDisplay = product.type || "Mixed";
        let priceDisplay = `₹${product.price}`;
        let hasMultipleVariations = false;

        if (product.variations && product.variations.length > 0) {
            if (product.variations.length === 1) {
                // Single variation - show its type directly
                typeDisplay = product.variations[0].type || "Veg";
                priceDisplay = `₹${product.variations[0].price}`;
            } else {
                // Multiple variations - show "Mixed" as a clickable link
                typeDisplay = `<a href="javascript:void(0)" class="variation-link" data-product-id="${product.id}">Mixed</a>`;
                hasMultipleVariations = true;
                priceDisplay = `<a href="javascript:void(0)" class="variation-link" data-product-id="${product.id}">₹${getMinMaxPriceRange(product.variations)}</a>`;
            }
        }

        // Add other cells
        row.innerHTML += `
            <td>${product.segment}</td>
            <td>${typeDisplay}</td>
            <td>${product.name}</td>
            <td>${product.ingredients}</td>
            <td>${product.description}</td>
            <td class="${hasMultipleVariations ? 'has-variations' : ''}">${priceDisplay}</td>
            <td>${product.isAvailable === 'Y' ? 'Yes' : 'No'}</td>
            <td>
                <i class="fas ${product.isAvailable === 'Y' ? 'fa-toggle-on' : 'fa-toggle-off'} action-icons ${product.isAvailable === 'Y' ? 'product-toggle-active' : 'product-toggle-inactive'}" 
                   onclick="productToggleAvailability('${product.id}', '${product.isAvailable}')"
                   title="${product.isAvailable === 'Y' ? 'Click to mark unavailable' : 'Click to mark available'}"></i>
                <i class="fas fa-edit action-icons" onclick="editProduct('${product.id}')" title="Edit product"></i>
            </td>
        `;

        tbody.appendChild(row);
    });

    // Initialize sorting functionality
    productInitSorting();

    // Add click event listeners to image preview triggers
    document.querySelectorAll('.product-preview-trigger').forEach(trigger => {
        trigger.addEventListener('click', function () {
            const imageUrl = this.getAttribute('data-image-url');
            productShowEnlargedImage(imageUrl);
        });
    });

    // Add click event listeners to variation links
    document.querySelectorAll('.variation-link').forEach(link => {
        link.addEventListener('click', function () {
            const productId = this.getAttribute('data-product-id');
            showVariationsModal(productId);
        });
    });
}

// Helper function to get min/max price range as a string
function getMinMaxPriceRange(variations) {
    if (!variations || variations.length === 0) return '0';

    const prices = variations.map(v => parseFloat(v.price)).filter(p => !isNaN(p));
    if (prices.length === 0) return '0';

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    if (minPrice === maxPrice) {
        return `${minPrice}`;
    } else {
        return `${minPrice}-${maxPrice}`;
    }
}

function productInitFilters() {
    // Get unique values for segments
    const uniqueSegments = [...new Set(products.map(product => product.segment))].sort();

    // Get unique types from variations and products
    const typeSet = new Set();
    products.forEach(product => {
        if (product.variations && product.variations.length > 0) {
            product.variations.forEach(v => {
                if (v.type) typeSet.add(v.type);
            });

            // If product has multiple variations with different types, add "Mixed"
            if (new Set(product.variations.map(v => v.type)).size > 1) {
                typeSet.add("Mixed");
            }
        } else if (product.type) {
            typeSet.add(product.type);
        }
    });
    const uniqueTypes = [...typeSet].sort();

    // Set up search input
    const searchInput = document.getElementById('productSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            productFilters.searchTerm = this.value.toLowerCase();
            productApplyFilters();
        });
    }

    // Populate segment dropdown
    const segmentFilterEl = document.getElementById('productSegmentFilter');
    if (segmentFilterEl) {
        // Clear existing options first to prevent duplicates
        segmentFilterEl.innerHTML = '<option value="">[All Segments]</option>';

        uniqueSegments.forEach(segment => {
            const option = document.createElement('option');
            option.value = segment;
            option.textContent = segment;
            segmentFilterEl.appendChild(option);
        });
        segmentFilterEl.addEventListener('change', productApplyFilters);
    }

    // Populate type dropdown
    const typeFilterEl = document.getElementById('productTypeFilter');
    if (typeFilterEl) {
        // Clear existing options first to prevent duplicates
        typeFilterEl.innerHTML = '<option value="">[All Types]</option>';

        uniqueTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            typeFilterEl.appendChild(option);
        });
        typeFilterEl.addEventListener('change', productApplyFilters);
    }

    // Set up available filter
    const availableFilterEl = document.getElementById('productAvailableFilter');
    if (availableFilterEl) {
        availableFilterEl.addEventListener('change', productApplyFilters);
    }

    const resetFiltersBtn = document.getElementById('productResetFiltersBtn');
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', productResetFilters);
    }
}

function productApplyFilters() {
    // Update filter values
    const segmentFilterEl = document.getElementById('productSegmentFilter');
    const typeFilterEl = document.getElementById('productTypeFilter');
    const availableFilterEl = document.getElementById('productAvailableFilter');
    const searchInput = document.getElementById('productSearchInput');

    productFilters.segment = segmentFilterEl ? segmentFilterEl.value : '';
    productFilters.type = typeFilterEl ? typeFilterEl.value : '';
    productFilters.available = availableFilterEl ? availableFilterEl.value : '';
    productFilters.searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

    // Apply filters to the products array
    productFilteredProducts = products.filter(product => {
        // Search filter - check if search term is included in the name
        const nameMatch = !productFilters.searchTerm ||
            product.name.toLowerCase().includes(productFilters.searchTerm);

        // Segment filter
        const segmentMatch = productFilters.segment === '' || product.segment === productFilters.segment;

        // Available filter
        const availableMatch = productFilters.available === '' || product.isAvailable === productFilters.available;

        // Type filter - check in variations
        let typeMatch = productFilters.type === '';

        if (!typeMatch) {
            if (productFilters.type === 'Mixed') {
                // For Mixed, check if product has multiple variation types
                if (product.variations && product.variations.length > 1) {
                    const uniqueTypes = new Set(product.variations.map(v => v.type));
                    typeMatch = uniqueTypes.size > 1;
                }
            } else if (product.variations && product.variations.length > 0) {
                // For specific types, check if any variation has that type
                typeMatch = product.variations.some(v => v.type === productFilters.type);
            } else {
                // Fallback to product level type
                typeMatch = product.type === productFilters.type;
            }
        }

        return nameMatch && segmentMatch && typeMatch && availableMatch;
    });

    // Reload the table with filtered products
    loadProductsTable(productFilteredProducts);
}

function productResetFilters() {
    const searchInput = document.getElementById('productSearchInput');
    const segmentFilterEl = document.getElementById('productSegmentFilter');
    const typeFilterEl = document.getElementById('productTypeFilter');
    const availableFilterEl = document.getElementById('productAvailableFilter');

    if (searchInput) searchInput.value = '';
    if (segmentFilterEl) segmentFilterEl.value = '';
    if (typeFilterEl) typeFilterEl.value = '';
    if (availableFilterEl) availableFilterEl.value = '';

    productFilters = {
        segment: '',
        type: '',
        available: '',
        searchTerm: ''
    };

    // Reset filtered products to all products
    productFilteredProducts = [...products];

    // Reload the table
    loadProductsTable(productFilteredProducts);
}

function productSortItems(productsArray) {
    // Apply multi-column sorting
    productsArray.sort((a, b) => {
        // Compare by segment first
        if (a.segment.toLowerCase() !== b.segment.toLowerCase()) {
            return productSortDirections.segment === 'asc'
                ? a.segment.toLowerCase().localeCompare(b.segment.toLowerCase())
                : b.segment.toLowerCase().localeCompare(a.segment.toLowerCase());
        }

        // Then by type
        if (a.type.toLowerCase() !== b.type.toLowerCase()) {
            return productSortDirections.type === 'asc'
                ? a.type.toLowerCase().localeCompare(b.type.toLowerCase())
                : b.type.toLowerCase().localeCompare(a.type.toLowerCase());
        }

        // Finally by name
        return productSortDirections.name === 'asc'
            ? a.name.toLowerCase().localeCompare(b.name.toLowerCase())
            : b.name.toLowerCase().localeCompare(a.name.toLowerCase());
    });

    return productsArray;
}

function productInitSorting() {
    const headers = document.querySelectorAll('#productProductTable th.product-sortable');
    headers.forEach(header => {
        header.addEventListener('click', function () {
            const column = this.getAttribute('data-column');

            // Update sort direction
            if (column === productSortColumns[0]) {
                // Toggle direction for primary sort column
                productSortDirections[column] = productSortDirections[column] === 'asc' ? 'desc' : 'asc';
            } else {
                // Make this the primary sort column
                productSortColumns = [column, ...productSortColumns.filter(col => col !== column)];
            }

            // Re-sort and reload
            productSortItems(products);
            loadProductsTable(products);

            // Update sort indicators
            productUpdateSortIndicators();
        });
    });

    // Initialize sort indicators
    productUpdateSortIndicators();
}

function productUpdateSortIndicators() {
    // Remove all sort indicators
    document.querySelectorAll('#productProductTable th.product-sortable').forEach(th => {
        th.classList.remove('product-sort-asc', 'product-sort-desc');
        th.setAttribute('data-sort-order', '');
    });

    // Add indicators for active sort columns
    productSortColumns.forEach((column, index) => {
        const th = document.querySelector(`#productProductTable th[data-column="${column}"]`);
        if (th) {
            const direction = productSortDirections[column];
            th.classList.add(`product-sort-${direction}`);
            th.setAttribute('data-sort-order', index + 1);
        }
    });
}

// Add this function to show the variations in a modal
function showVariationsModal(productId) {
    const product = products.find(p => p.id == productId);
    if (!product || !product.variations) return;

    // Create modal element if it doesn't exist
    let modal = document.getElementById('variationsViewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'variationsViewModal';
        modal.className = 'modal variations-view-modal';

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.innerHTML = `
            <span class="close">&times;</span>
            <h3>Product Variations</h3>
            <div id="variationsTableContainer"></div>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Add close button functionality
        modal.querySelector('.close').addEventListener('click', function () {
            modal.style.display = 'none';
        });

        // Close when clicking outside the modal
        window.addEventListener('click', function (event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    // Populate the variations table
    const tableContainer = modal.querySelector('#variationsTableContainer');
    tableContainer.innerHTML = `
        <table class="variations-view-table">
            <thead>
                <tr>
                    <th>Variation</th>
                    <th>Type</th>
                    <th>Price</th>
                </tr>
            </thead>
            <tbody>
                ${product.variations.map(variation => `
                    <tr>
                        <td>${variation.name}</td>
                        <td><img src="${variation.type === 'Veg' ? 'resources/veg-logo.png' : 'resources/nonveg-logo.png'}" 
                                alt="${variation.type}" class="variation-type-icon"> ${variation.type}</td>
                        <td>₹${variation.price}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    // Show the modal
    modal.style.display = 'block';
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

const addProductBtn = document.getElementById('productAddProductBtn');
if (addProductBtn) {
    addProductBtn.addEventListener('click', () => {
        productOpenModal();
    });
}

const addVariationBtn = document.getElementById('addVariationBtn');
if (addVariationBtn) {
    addVariationBtn.addEventListener('click', addVariation);
}

const productForm = document.getElementById('productProductForm');
if (productForm) {
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Reset previous error states
        productClearValidationErrors();

        let hasErrors = false;
        const formData = new FormData(e.target);
        const productId = formData.get('productId');

        // Validate name
        const name = formData.get('name').trim();
        if (!name) {
            productDisplayValidationError('name', 'Product name is required');
            hasErrors = true;
        }

        // Validate ingredients
        const ingredients = formData.get('ingredients').trim();
        if (!ingredients) {
            productDisplayValidationError('ingredients', 'Ingredients are required');
            hasErrors = true;
        }

        // Validate description
        const description = formData.get('description').trim();
        if (!description) {
            productDisplayValidationError('description', 'Description is required');
            hasErrors = true;
        }

        // Validate image
        const imageFile = formData.get('image');
        const existingImageUrl = formData.get('imageUrl');
        if (!imageFile || imageFile.size === 0) {
            if (!existingImageUrl && !document.getElementById('productId').value) {
                productDisplayValidationError('image', 'Image is required');
                hasErrors = true;
            }
        }

        /* // Validate price
        const price = formData.get('price').trim();
        if (!price) {
            productDisplayValidationError('price', 'Price is required');
            hasErrors = true;
        } else if (!/^\d+(\.\d{1,2})?$/.test(price)) {
            productDisplayValidationError('price', 'Price must be a number with up to 2 decimal places');
            hasErrors = true;
        } */

        // Make sure all variations have types
        currentVariations.forEach(v => {
            if (!v.type) v.type = 'Veg';
        });

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
            productId: productId || '',
            segment: formData.get('segment'),
            type: 'Mixed', // Always use Mixed for backend compatibility
            name: formData.get('name'),
            ingredients: formData.get('ingredients'),
            description: formData.get('description'),
            imageUrl: imageUrl || formData.get('imageUrl'),
            price: '0',
            isAvailable: formData.get('isAvailable') === 'on' ? 'Y' : 'N',
            variations: currentVariations
        };

        // save product data
        const result = await saveProduct(productData);

        // If this was a new product (no productId), store the returned ID
        if (!productId && result && result.productId) {
            document.getElementById('productId').value = result.productId;
        }

        // reload products
        await loadProducts(false);
        productCloseModal();
        showLoader(false);
    });
}


function productDisplayValidationError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorMsgId = `product-${fieldId}-error`;

    // Add error class to the field
    field.classList.add('product-error-field');

    // Check if error message element exists
    let errorMsg = document.getElementById(errorMsgId);
    if (!errorMsg) {
        errorMsg = document.createElement('div');
        errorMsg.id = errorMsgId;
        errorMsg.className = 'product-error-message';
        field.parentNode.insertBefore(errorMsg, field.nextSibling);
    }

    errorMsg.textContent = message;
}

function productClearValidationErrors() {
    // Remove all error messages
    document.querySelectorAll('.product-error-message').forEach(el => el.remove());

    // Remove error class from all fields
    document.querySelectorAll('.product-error-field').forEach(el =>
        el.classList.remove('product-error-field'));
}

// Products management image preview functionality
document.addEventListener('DOMContentLoaded', function () {
    const imageInput = document.getElementById('image');
    if (imageInput) {
        imageInput.addEventListener('change', productHandleImageChange);
    }

    const removeImageBtn = document.getElementById('productRemoveImageBtn');
    if (removeImageBtn) {
        removeImageBtn.addEventListener('click', productRemoveImage);
    }
});

function productHandleImageChange(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();

        reader.onload = function (e) {
            const preview = document.getElementById('productImagePreview');
            if (preview) {
                preview.src = e.target.result;

                // Show the preview container
                const previewContainer = document.getElementById('productImagePreviewContainer');
                if (previewContainer) {
                    previewContainer.style.display = 'block';
                }
            }
        };

        reader.readAsDataURL(file);
    }
}

function productRemoveImage() {
    const imageInput = document.getElementById('image');
    if (imageInput) {
        imageInput.value = '';
    }

    const imageUrlInput = document.getElementById('imageUrl');
    if (imageUrlInput) {
        imageUrlInput.value = '';
    }

    const previewContainer = document.getElementById('productImagePreviewContainer');
    if (previewContainer) {
        previewContainer.style.display = 'none';
    }
}

function productShowEnlargedImage(imageUrl) {
    // Check if there's already a modal and remove it
    const existingModal = document.querySelector('.product-enlarged-image-modal');
    if (existingModal) {
        document.body.removeChild(existingModal);
    }

    // Create modal for enlarged image
    const modal = document.createElement('div');
    modal.className = 'product-enlarged-image-modal';

    // Create close button
    const closeBtn = document.createElement('span');
    closeBtn.className = 'product-enlarged-image-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = function (e) {
        e.stopPropagation();
        document.body.removeChild(modal);
    };

    // Create container for the image
    const imgContainer = document.createElement('div');
    imgContainer.className = 'product-enlarged-image-container';

    // Create image element
    const img = document.createElement('img');
    img.src = imageUrl;
    img.className = 'product-enlarged-image';

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

async function saveProduct(productData) {
    await callAPIviaPOST(productData);
}

async function productToggleAvailability(productId, currentStatus) {
    try {
        showLoader(true);

        // Prepare the data to send
        const toggleData = {
            action: 'toggleAvailability',
            productId: productId
        };

        // Send the request to toggle availability
        const result = await callAPIviaPOST(toggleData);
        if (result.status === 'success') {
            // Reload products data with current filters
            await loadProducts(true);

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

async function editProduct(productId) {
    showLoader(true);
    try {
        const response = await fetch(`${API_URL}?type=product&productId=${productId}`);
        const product = await response.json();

        // First open the modal with blank form
        productOpenModal();

        // Then populate the form with product data
        document.getElementById('productId').value = product.id;
        document.getElementById('segment').value = product.segment;

        // Type field might be hidden but we'll set it anyway
        const typeElement = document.getElementById('type');
        if (typeElement) {
            typeElement.value = 'Mixed';
        }

        document.getElementById('name').value = product.name;
        document.getElementById('ingredients').value = product.ingredients;
        document.getElementById('description').value = product.description;
        document.getElementById('isAvailable').checked = product.isAvailable === 'Y';

        // Handle price field
        const priceElement = document.getElementById('price');
        if (priceElement) {
            priceElement.value = product.price;
        }

        // Clear existing variations
        currentVariations = [];

        // Initialize variations
        if (product.variations && product.variations.length > 0) {
            // Use the variations from the product
            currentVariations = product.variations.map(v => ({
                ...v,
                type: v.type || product.type || 'Veg'
            }));
        } else {
            // Create default variation with the product's details
            currentVariations = [{
                name: 'Regular',
                price: product.price || '',
                type: product.type === 'Non-Veg' ? 'Non-Veg' : 'Veg'
            }];
        }

        // Render the variations UI
        renderVariationsUI();

        // Handle image preview
        if (product.imageUrl) {
            document.getElementById('imageUrl').value = product.imageUrl;
            const imagePreview = document.getElementById('productImagePreview');
            const previewContainer = document.getElementById('productImagePreviewContainer');

            if (imagePreview && previewContainer) {
                imagePreview.src = product.imageUrl;
                previewContainer.style.display = 'block';
            }
        }

        showLoader(false);
    } catch (error) {
        console.error('Error fetching product details:', error);
        showLoader(false);
    }
}

function renderVariationsUI() {
    const container = document.getElementById('variationsContainer');
    if (!container) {
        console.error('Variations container not found in the form!');
        return;
    }

    container.innerHTML = '';

    currentVariations.forEach((variation, index) => {
        const isDefault = variation.name === 'Regular';
        const variationRow = document.createElement('div');
        variationRow.className = 'variation-row';

        variationRow.innerHTML = `
            <div class="variation-inputs">
                <input type="text" class="variation-name" value="${variation.name}" 
                       placeholder="Variation name" onchange="updateVariationName(${index}, this.value)">
                       
                <select class="variation-type" onchange="updateVariationType(${index}, this.value)">
                    <option value="Veg" ${variation.type === 'Veg' ? 'selected' : ''}>Veg</option>
                    <option value="Non-Veg" ${variation.type === 'Non-Veg' ? 'selected' : ''}>Non-Veg</option>
                </select>
                
                <div class="price-input-group">
                    <span class="currency-symbol">₹</span>
                    <input type="number" class="variation-price" value="${variation.price}" 
                           placeholder="Price" onchange="updateVariationPrice(${index}, this.value)">
                </div>
            </div>
            ${isDefault ? `
                <div class="default-badge" title="This is the default variation">
                    <i class="fas fa-star"></i>
                </div>
            ` : `
                <button type="button" class="btn-icon delete-variation" onclick="removeVariation(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            `}
        `;
        container.appendChild(variationRow);
    });
}

function updateVariationType(index, type) {
    if (index >= 0 && index < currentVariations.length) {
        currentVariations[index].type = type;
    }
}

function addVariation() {
    currentVariations.push({
        name: '', // Empty name by default, to force user input
        price: '',
        type: 'Veg'
    });
    renderVariationsUI();
}

function updateVariationName(index, name) {
    if (index >= 0 && index < currentVariations.length) {
        currentVariations[index].name = name;
    }
}

function updateVariationPrice(index, price) {
    if (index >= 0 && index < currentVariations.length) {
        currentVariations[index].price = price;

        // If this is the Default variation, update the hidden price field
        if (currentVariations[index].name === 'Regular') {
            document.getElementById('price').value = price;
        }
    }
}

function removeVariation(index) {
    if (index >= 0 && index < currentVariations.length) {
        // Don't allow removing the Default variation
        if (currentVariations[index].name === 'Regular') return;

        currentVariations.splice(index, 1);
        renderVariationsUI();
    }
}

function productOpenModal() {
    // Only reset the form if it's a new product (no ID value)
    const productId = document.getElementById('productId').value;
    if (!productId) {
        document.getElementById('productProductForm').reset();

        // Initialize with default variation for new products
        currentVariations = [{
            name: 'Regular',
            price: '',
            type: 'Veg'
        }];
        renderVariationsUI();
    }

    // Display the modal
    document.getElementById('productProductModal').style.display = 'block';
}

function productCloseModal() {
    const modal = document.getElementById('productProductModal');
    modal.style.display = 'none';
    document.getElementById('productProductForm').reset();
    currentVariations = []; // Reset variations

    // Clear the image preview
    const previewContainer = document.getElementById('productImagePreviewContainer');
    const previewImage = document.getElementById('productImagePreview');

    if (previewContainer) {
        previewContainer.style.display = 'none';
    }

    if (previewImage) {
        previewImage.src = '';
    }
}

const cancelModalBtn = document.getElementById('productCancelModalBtn');
if (cancelModalBtn) {
    cancelModalBtn.addEventListener('click', productCloseModal);
}

const closeModalBtn = document.querySelector('.close');
if (closeModalBtn) {
    closeModalBtn.addEventListener('click', productCloseModal);
}
