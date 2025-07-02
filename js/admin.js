function initStoreStatusToggle() {
    const toggle = document.getElementById('storeStatusToggle');
    const actionText = document.getElementById('storeActionText');

    if (!toggle || !actionText) return;

    // Set initial toggle state based on settings
    const isStoreOpen = settings.StoreClosed !== 'Y';

    if (isStoreOpen) {
        toggle.classList.remove('fa-toggle-off', 'product-toggle-inactive');
        toggle.classList.add('fa-toggle-on', 'product-toggle-active');
        if (actionText) actionText.textContent = 'Click to Close';
    } else {
        toggle.classList.remove('fa-toggle-on', 'product-toggle-active');
        toggle.classList.add('fa-toggle-off', 'product-toggle-inactive');
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
        toggle.classList.remove('fa-toggle-on', 'product-toggle-active');
        toggle.classList.add('fa-toggle-off', 'product-toggle-inactive');
        if (actionText) actionText.textContent = 'Click to Open';

        // Update setting
        await updateAppSetting('StoreClosed', 'Y');
    } else {
        // Change to open
        toggle.classList.remove('fa-toggle-off', 'product-toggle-inactive');
        toggle.classList.add('fa-toggle-on', 'product-toggle-active');
        if (actionText) actionText.textContent = 'Click to Close';

        // Update setting
        await updateAppSetting('StoreClosed', 'N');
    }
}