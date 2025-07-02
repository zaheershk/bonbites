
let settings = [];
let products = [];
let orders = [];

let workflowContext = '';

function getUrlParameter(name) {
    const urlSearchParams = new URLSearchParams(window.location.search);
    return urlSearchParams.get(name);
}

function showLoader(visible) {
    const loader = document.getElementById('loader');
    loader.style.display = visible ? 'flex' : 'none';
}

window.onload = async function () {
    showLoader(true);

    const workflowContextMetaTag = document.querySelector('meta[name="workflow-context"]').getAttribute('content');
    workflowContext = workflowContextMetaTag.toLowerCase();

    //console.log('workflowContext:', workflowContext);

    settings = await fetchAppSettings();

    if (settings.StoreClosed === 'Y') {
        // Only redirect to storeclosed if this is the index page (no workflow context or index context)
        if (!workflowContextMetaTag || workflowContext === 'index') {
            window.location.href = 'storeclosed';
            return;
        }
    } else {
        // Store is open - only redirect if this is the index page (no specific workflow context)
        if (!workflowContextMetaTag || workflowContext === 'index') {
            window.location.href = 'order';
            return;
        }
        // If there's already a specific workflow context, stay on that page
    }

    if (workflowContext === 'admin') {
        initStoreStatusToggle();
    }

    if (workflowContext === 'products') {
        await loadProducts(false);
    }

    if (workflowContext === 'stock') {
        await loadStockItems(false);
    }

    if (workflowContext === 'process') {
        await loadOrders();
    }

    showLoader(false);

};

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

async function fetchProducts(isAvailableFilter) {
    try {
        //console.log('isAvailableFilter:', isAvailableFilter);

        const response = await fetch(API_URL + `?type=products&isAvailableFilter=${isAvailableFilter}`);
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
