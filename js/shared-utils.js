// Shared constants
const API_URL = 'https://script.google.com/macros/s/AKfycbyI9UouLe3xROOGjhPRs7cxsPXE5-1kwIzBkgVo68vbwVNft5e46a9b6WNiflucuDRc/exec';

// Common utility functions
function showLoader(visible) {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = visible ? 'flex' : 'none';
    }
}

async function callAPIviaPOST(data) {
    try {
        //console.log('Calling API via POST:', data);
        
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
        console.error('Error occurred in callAPIviaPOST method.', error);
        throw error;
    }
}

async function fetchIPAddress() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.error('Error fetching IP:', error);
        return 'unknown';
    }
}