let stockItems = [];
let stockFilteredItems = [];
let stockSortColumns = ['expirationDate', 'name', 'type', 'location'];
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
    status: '',
    searchTerm: ''
};

async function loadStockItems(reapplyFilters = false) {
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

    // Get current date for expiration warning calculation
    const currentDate = new Date();
    const warningDays = settings.ExpirationWindow || 15; // Show warning for items expiring within this many days

    items.forEach(item => {
        const row = document.createElement('tr');

        // Format the date for display - handle potential invalid dates
        let formattedDate = 'N/A';
        let expirationWarning = '';

        if (item.ExpirationDate) {
            try {
                const expirationDate = new Date(item.ExpirationDate);
                if (!isNaN(expirationDate.getTime())) {
                    formattedDate = expirationDate.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                    });

                    // Calculate days until expiration
                    const timeDiff = expirationDate.getTime() - currentDate.getTime();
                    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

                    // Add appropriate warning icon based on expiration status
                    if (daysDiff < 0) {
                        // Expired - show red circle
                        expirationWarning = `<i class="fas fa-exclamation-circle expiry-warning-expired" 
                                             title="Expired ${Math.abs(daysDiff)} days ago"></i>`;
                    } else if (daysDiff <= warningDays) {
                        // Soon to expire - show yellow triangle
                        expirationWarning = `<i class="fas fa-exclamation-triangle expiry-warning-soon" 
                                             title="Expires in ${daysDiff} days"></i>`;
                    }
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
            <td class="expiry-date-cell">
                <div class="expiry-date">${formattedDate}</div>
                <div class="expiry-icon">${expirationWarning}</div>
            </td>
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
    const searchInput = document.getElementById('stockSearchInput');
    const typeFilterEl = document.getElementById('stockTypeFilter');
    const locationFilterEl = document.getElementById('stockLocationFilter');
    const statusFilterEl = document.getElementById('stockStatusFilter');
    const resetFiltersBtn = document.getElementById('stockResetFiltersBtn');

    if (searchInput) {
        searchInput.addEventListener('input', function () {
            stockFilters.searchTerm = this.value.toLowerCase();
            stockApplyFilters();
        });
    }

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
    // Note: searchTerm is updated directly from the input event

    stockFilters.type = typeFilterEl ? typeFilterEl.value : '';
    stockFilters.location = locationFilterEl ? locationFilterEl.value : '';
    stockFilters.status = statusFilterEl ? statusFilterEl.value : '';

    // Apply filters to the items array
    stockFilteredItems = stockItems.filter(item => {
        // Search filter - check if search term is included in the name
        const nameMatch = !stockFilters.searchTerm ||
            (item.Name && item.Name.toLowerCase().includes(stockFilters.searchTerm));

        // Other filters
        const typeMatch = stockFilters.type === '' || item.Type === stockFilters.type;
        const locationMatch = stockFilters.location === '' || item.Location === stockFilters.location;
        const statusMatch = stockFilters.status === '' || item.Status === stockFilters.status;

        return nameMatch && typeMatch && locationMatch && statusMatch;
    });

    // Reload the table with filtered items
    loadStockItemTable(stockFilteredItems);
}

function stockResetFilters() {
    const searchInput = document.getElementById('stockSearchInput');
    const typeFilterEl = document.getElementById('stockTypeFilter');
    const locationFilterEl = document.getElementById('stockLocationFilter');
    const statusFilterEl = document.getElementById('stockStatusFilter');

    if (searchInput) searchInput.value = '';
    if (typeFilterEl) typeFilterEl.value = '';
    if (locationFilterEl) locationFilterEl.value = '';
    if (statusFilterEl) statusFilterEl.value = '';

    stockFilters = {
        type: '',
        location: '',
        status: '',
        searchTerm: ''
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
document.addEventListener('DOMContentLoaded', function () {
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
                await loadStockItems(true);
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
            await loadStockItems(true);
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