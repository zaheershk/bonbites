function doGet(e) {
  try {
    const requestType = e.parameter.type || 'products';
    const isAvailableFilter = e.parameter.isAvailableFilter || false;
    const productId = e.parameter.productId || 0;
    const itemId = e.parameter.itemId || 0;

    let result;

    switch (requestType) {
      case 'appsettings':
        result = getAppSettings();
        break;
      case 'deliverySlots':
        result = getdeliverySlots();
        break;
      case 'products':
        result = getProducts(isAvailableFilter);
        break;
      case 'product':
        result = getProduct(productId);
        break;
      case 'orders':
        result = getOrders();
        break;
      case 'stock':
        result = getStockItems();
        break;
      case 'stock-item':
        result = getStockItemById(itemId);
        break;
      default:
        return createJsonOutput({ "status": "error", "error": "Invalid requestType" });
    }

    return result;
  } catch (error) {
    return createJsonOutput({ "status": "error", "error": error.toString() });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    let result;

    switch (action) {
      case 'updateAppSetting':
        result = handleUpdateAppSetting(data);
        break;
      case 'insertProduct':
        result = handleInsertProduct(data);
        break;
      case 'updateProduct':
        result = handleUpdateProduct(data);
        break;
      case 'generateSignedUrl':
        result = handleGenerateSignedUrl(data);
        break;
      case 'toggleAvailability':
        result = handleToggleAvailability(data);
        break;
      case 'insertOrder':
        result = handleInsertOrder(data);
        break;
      case 'updateOrder':
        result = handleUpdateOrder(data);
        break;
      case 'insertStockItem':
        result = insertStockItem(data);
        break;
      case 'updateStockItem':
        result = updateStockItem(data);
        break;
      case 'deleteStockItem':
        result = deleteStockItem(data);
        break;
      case 'captureTraffic':
        result = handleCaptureTraffic(data);
        break;
      default:
        return createJsonOutput({ "status": "error", "error": "Invalid action" });
    }

    return result;

  } catch (error) {
    return createJsonOutput({ "status": "error", "error": error.toString() });
  }
}

// ----- PUBLIC FUNCTIONS -----

function createJsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getAppSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('AppSettings');
  const data = sheet.getDataRange().getValues();
  const settings = {};

  data.forEach(row => {
    const key = row[0];
    const value = row[1];
    settings[key] = value;
  });

  return createJsonOutput(settings);
}

function getdeliverySlots() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('AppSettings');
  const data = sheet.getDataRange().getValues();
  const settings = {};

  data.forEach(row => {
    const key = row[0];
    const value = row[1];
    settings[key] = value;
  });

  const result = {
    enabled: settings.EnablePickup === 'Y',
    delivery: settings.DeliverySlots ? settings.DeliverySlots.split(',').map(slot => slot.trim()) : [],
    pickup: {
      slots: settings.PickupSlots ? settings.PickupSlots.split(',').map(slot => slot.trim()) : [],
      location: settings.PickupLocation || ''
    }
  };

  return createJsonOutput(result);
}

function getProducts(isAvailableFilter) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Products');
  const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues(); // Updated to include Variations column

  // Convert isAvailableFilter to a boolean value
  const filter = isAvailableFilter === 'true' || isAvailableFilter === true;

  const productsData = dataRange.reduce((accum, row) => {
    const [productID, segment, type, name, ingredients, description, imageUrl, price, isAvailable, variationsStr] = row;

    if (!filter || (filter && isAvailable.toUpperCase() === 'Y')) {
      // Parse variations if they exist
      let variations = [];
      if (variationsStr && variationsStr.trim()) {
        try {
          variations = JSON.parse(variationsStr);
        } catch (e) {
          console.error(`Failed to parse variations for product ${productID}: ${e}`);
        }
      }

      accum.push({
        id: productID,
        segment,
        type,
        name,
        ingredients,
        description,
        imageUrl,
        price,
        isAvailable,
        variations: variations
      });
    }
    return accum;
  }, []);

  return createJsonOutput(productsData);
}

// Update getProduct to include variations
function getProduct(productId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Products');
  const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues();

  let product = null;
  for (let i = 0; i < dataRange.length; i++) {
    if (dataRange[i][0] == productId) {
      // Parse variations if they exist
      let variations = [];
      if (dataRange[i][9] && dataRange[i][9].trim()) {
        try {
          variations = JSON.parse(dataRange[i][9]);
        } catch (e) {
          console.error(`Failed to parse variations for product ${productId}: ${e}`);
        }
      }

      product = {
        id: dataRange[i][0],
        segment: dataRange[i][1],
        type: dataRange[i][2],
        name: dataRange[i][3],
        ingredients: dataRange[i][4],
        description: dataRange[i][5],
        imageUrl: dataRange[i][6],
        price: dataRange[i][7],
        isAvailable: dataRange[i][8],
        variations: variations
      };
      break;
    }
  }

  return createJsonOutput(product);
}

function getOrders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = 'OnlineOrders';
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet || sheet.getLastRow() < 2) {
    // Return an empty array if the sheet is not found or contains no data except headers
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const lastColumnIndex = 12;

  // Make sure to calculate the number of rows properly to avoid retrieving non-existent data
  const numRows = sheet.getLastRow() - 1;
  const dataRange = sheet.getRange(2, 1, numRows, lastColumnIndex).getValues();

  let orderData = [];

  dataRange.forEach(row => {
    let statusIndex = 8;

    let wipStatuses = ['Received', 'Cooking', 'Packed'];
    let shouldInclude = wipStatuses.includes(row[statusIndex]);

    if (shouldInclude) {
      orderData.push({
        orderId: row[0],
        customerName: row[1],
        customerFlat: row[2],
        contactEmail: row[3],
        phoneNumber: row[4],
        deliverySlot: row[5],
        items: JSON.parse(row[6]),
        totalAmount: row[7],
        status: row[8],
        timestamp: row[9],
        deliveryType: row[10],
        pickupLocation: row[11]
      });
    }
  });

  return createJsonOutput(orderData);
}

function handleUpdateAppSetting(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('AppSettings');
  const settingsData = sheet.getDataRange().getValues();

  // Find the row with the matching key
  const key = data.key;
  const newValue = data.value;
  for (let i = 1; i < settingsData.length; i++) {
    if (settingsData[i][0] === key) {
      // Update the value in the second column (index 1)
      sheet.getRange(i + 1, 2).setValue(newValue);
      return createJsonOutput({ "status": "success" });
    }
  }

  // If key not found, optionally add a new row
  sheet.appendRow([key, newValue]);
  return createJsonOutput({ "status": "not found" });
}

function handleInsertProduct(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Products');
  const lastRow = sheet.getLastRow();
  const newRow = lastRow + 1;

  const productId = Utilities.getUuid();
  const segment = data.segment;
  const type = data.type;
  const name = data.name;
  const ingredients = data.ingredients;
  const description = data.description;
  const imageUrl = data.imageUrl;
  const price = data.price;
  const isAvailable = data.isAvailable;
  const variations = data.variations ? JSON.stringify(data.variations) : '';

  sheet.appendRow([productId, segment, type, name, ingredients, description, imageUrl, price, isAvailable, variations]);

  return createJsonOutput({ "status": "success", "productId": productId });
}

function handleUpdateProduct(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Products');
  const productId = data.productId;
  const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues();

  for (let i = 0; i < dataRange.length; i++) {
    if (dataRange[i][0] == productId) {
      const row = i + 2;
      const variations = data.variations ? JSON.stringify(data.variations) : '';
      sheet.getRange(row, 2, 1, 9).setValues([[
        data.segment,
        data.type,
        data.name,
        data.ingredients,
        data.description,
        data.imageUrl,
        data.price,
        data.isAvailable,
        variations
      ]]);
      break;
    }
  }

  return createJsonOutput({ "status": "success" });
}

function handleGenerateSignedUrl(data) {
  try {
    const bucketName = 'bonbites-product-images';
    const fileName = data.fileName;
    const serviceAccountKey = PropertiesService.getScriptProperties().getProperty('GCS_SERVICE_ACCOUNT_KEY');
    const serviceAccount = JSON.parse(serviceAccountKey);

    const expiration = 3600; // 1 hour expiration

    const options = {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream'
      }
    };

    const signedUrl = generateV4SignedUrl(serviceAccount, bucketName, fileName, expiration, options);
    Logger.log('Generated Signed URL: ' + signedUrl);
    return createJsonOutput({ status: 'success', signedUrl: signedUrl });
  } catch (error) {
    Logger.log('Failed to generate signed URL: ' + error);
    return createJsonOutput({ status: 'error', message: 'Failed to generate signed URL' });
  }
}

function generateV4SignedUrl(serviceAccount, bucketName, fileName, expiration, options) {
  const method = options.method || 'PUT';
  const contentType = options.headers['Content-Type'] || '';
  const date = getDate();
  const dateTime = getDateTime();

  // Properly encode path components
  const encodedFileName = encodeURIComponent(fileName).replace(/%2F/g, '/');
  const canonicalUri = `/${bucketName}/${encodedFileName}`;

  const credential = `${serviceAccount.client_email}/${date}/auto/storage/goog4_request`;
  const canonicalQueryString = `X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=${encodeURIComponent(credential)}&X-Goog-Date=${dateTime}&X-Goog-Expires=${expiration}&X-Goog-SignedHeaders=content-type%3Bhost`;

  const canonicalHeaders = `content-type:${contentType}\nhost:storage.googleapis.com\n`;
  const signedHeaders = 'content-type;host';

  // Empty string hash for 'UNSIGNED-PAYLOAD'
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  // SHA-256 hash of canonical request (hex string, not base64)
  const canonicalRequestHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    canonicalRequest,
    Utilities.Charset.UTF_8
  );
  const canonicalRequestHashHex = toHexString(canonicalRequestHash);

  const stringToSign = `GOOG4-RSA-SHA256\n${dateTime}\n${date}/auto/storage/goog4_request\n${canonicalRequestHashHex}`;

  // Sign the string and convert to hex
  const signature = Utilities.computeRsaSha256Signature(stringToSign, serviceAccount.private_key);
  const signatureHex = toHexString(signature);

  const signedUrl = `https://storage.googleapis.com${canonicalUri}?${canonicalQueryString}&X-Goog-Signature=${signatureHex}`;

  return signedUrl;
}

// Helper function to convert byte array to hex string
function toHexString(byteArray) {
  return Array.from(byteArray).map(byte => {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('');
}

function getDate() {
  const now = new Date();
  return now.toISOString().split('T')[0].replace(/-/g, '');
}

function getDateTime() {
  const now = new Date();
  return now.toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z';
}

function handleToggleAvailability(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Products');
  const productId = data.productId;
  const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();

  for (let i = 0; i < dataRange.length; i++) {
    if (dataRange[i][0] == productId) {
      const row = i + 2;
      const isAvailable = dataRange[i][8];

      sheet.getRange(row, 9).setValue(isAvailable === 'Y' ? 'N' : 'Y');
      break;
    }
  }

  return createJsonOutput({ "status": "success" });
}

function handleInsertOrder(data) {
  let sheetName = 'OnlineOrders';
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  const orderId = generateOrderId();
  const logTimestamp = new Date();

  let rowData = [
    orderId,
    data.name,
    data.flat,
    data.email,
    data.phone,
    data.deliverySlot,
    JSON.stringify(data.items),
    data.totalAmount,
    'Received',
    logTimestamp.toISOString(),
    data.userIp,
    data.userAgent,
    data.deliveryType,
    data.pickupLocation
  ];

  // add row to sheet
  sheet.appendRow(rowData);

  // send email for online orders
  if (data.email) {  // if data.email is not empty or undefined
    try {
      sendConfirmationEmail(data.email, data.name, data.flat, orderId, data.items, data.totalAmount, data.deliverySlot, data.deliveryType, data.pickupLocation);
    } catch (error) {
      console.error('Error sending email: ', error);
    }
  }

  return createJsonOutput({ "status": "success", "orderId": orderId });
}

function handleUpdateOrder(data) {
  let sheetName = 'OnlineOrders';
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  var isUpdated = false;
  if (data.orderId && data.status !== undefined) {
    const rows = sheet.getDataRange().getValues();

    const statusColumnIndex = 9;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0].toString() === data.orderId.toString()) {
        sheet.getRange(i + 1, statusColumnIndex).setValue(data.status);  // set the new status
        isUpdated = true;
        break;
      }
    }
  }

  if (isUpdated) {
    return createJsonOutput({ "status": "success" });
  }
}

// Stock management functions
function getStockItems() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Stock');

  if (!sheet) {
    return createJsonOutput([]);
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const items = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const item = {};

    for (let j = 0; j < headers.length; j++) {
      item[headers[j]] = row[j];
    }

    items.push(item);
  }

  return createJsonOutput(items);
}

function getStockItemById(itemId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Stock');

  if (!sheet) {
    return createJsonOutput({ "status": "error", "error": "Sheet not found" });
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0].toString() === itemId.toString()) {
      const item = {};

      for (let j = 0; j < headers.length; j++) {
        item[headers[j]] = row[j];
      }

      return createJsonOutput(item);
    }
  }

  return createJsonOutput({ "status": "error", "error": "Item not found" });
}

function insertStockItem(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Stock');

  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet('Stock');
    sheet.appendRow(['id', 'name', 'type', 'location', 'quantity', 'expirationDate', 'status', 'createdDate', 'updatedDate']);
  }

  // Generate new ID
  const itemId = Utilities.getUuid();
  const currentDate = new Date().toISOString();

  // Format the expiration date
  let expirationDate = data.expirationDate;
  if (expirationDate) {
    const date = new Date(expirationDate);
    expirationDate = date.toISOString();
  }

  // Add the new row
  sheet.appendRow([
    itemId,
    data.name,
    data.type,
    data.location,
    data.quantity,
    expirationDate,
    data.status,
    currentDate,
    currentDate
  ]);

  return createJsonOutput({
    "status": "success",
    "message": "Item added successfully",
    "itemId": itemId
  });
}

function updateStockItem(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Stock');

  if (!sheet) {
    return createJsonOutput({ "status": "error", "error": "Sheet not found" });
  }

  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  // Find the row with the matching ID
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][0].toString() === data.itemId.toString()) {
      rowIndex = i;
      break;
    }
  }

  if (rowIndex === -1) {
    return createJsonOutput({ "status": "error", "error": "Item not found" });
  }

  // Format the expiration date
  let expirationDate = data.expirationDate;
  if (expirationDate) {
    const date = new Date(expirationDate);
    expirationDate = date.toISOString();
  }

  // Update the values in the row
  sheet.getRange(rowIndex + 1, 2).setValue(data.name);
  sheet.getRange(rowIndex + 1, 3).setValue(data.type);
  sheet.getRange(rowIndex + 1, 4).setValue(data.location);
  sheet.getRange(rowIndex + 1, 5).setValue(data.quantity);
  sheet.getRange(rowIndex + 1, 6).setValue(expirationDate);
  sheet.getRange(rowIndex + 1, 7).setValue(data.status);
  sheet.getRange(rowIndex + 1, 9).setValue(new Date().toISOString());

  return createJsonOutput({
    "status": "success",
    "message": "Item updated successfully"
  });
}

function deleteStockItem(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Stock');

  if (!sheet) {
    return createJsonOutput({ "status": "error", "error": "Sheet not found" });
  }

  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  // Find the row with the matching ID
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][0].toString() === data.itemId.toString()) {
      rowIndex = i;
      break;
    }
  }

  if (rowIndex === -1) {
    return createJsonOutput({ "status": "error", "error": "Item not found" });
  }

  // Delete the row
  sheet.deleteRow(rowIndex + 1);

  return createJsonOutput({
    "status": "success",
    "message": "Item deleted successfully"
  });
}

// OTHER functions

function handleCaptureTraffic(data) {
  let sheetName = 'OnlineTraffic';
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  const ignoreIPs = ['49.37.116.255', '223.176.117.2', '117.97.208.3'];
  const userIp = data.userIp;

  if (!ignoreIPs.includes(userIp)) {
    const logTimestamp = new Date();

    let rowData = [
      logTimestamp.toISOString(),
      userIp,
      data.userAgent
    ];

    // add row to sheet
    sheet.appendRow(rowData);
  }

  return createJsonOutput({ "status": "success" });
}

// ---- PRIVATE FUNCTIONS ----

function generateOrderId() {
  // Get current date and time
  const now = new Date();

  // Format date and time as YYYYMMDDHHMMSS
  // Ensuring each component has leading zeros if needed
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  // Concatenate date and time components
  const dateTime = `${year}${month}${day}${hours}${minutes}${seconds}`;

  // Generate a random number (adjust the range as needed)
  const randomNumber = Math.floor(Math.random() * 10000).toString().padStart(4, '0'); // Generates a random number padded to 4 digits

  // Construct the order ID
  const orderId = `BB${dateTime}_${randomNumber}`;

  return orderId;
}

function sendConfirmationEmail(email, name, flat, orderId, items, totalAmount, deliverySlot, deliveryType, pickupLocation) {
  const subject = `[BonBites] Food Order Confirmation`;

  let body = `
        <html>
        <body>
            <p>Dear ${name} <br/> Thank you for your order (number: <strong>${orderId}</strong>).</p>
    `;

  // To collect 'ordered' types separately
  let orderedItems = "";

  items.forEach(item => {
    // Include variation in the display name if it exists and isn't Default
    const displayName = item.variation && item.variation !== 'Default'
      ? `${item.name} (${item.variation})`
      : item.name;

    orderedItems += `
          <tr>
              <td style="border: 1px solid #dddddd; text-align: left; padding: 8px;">${displayName}</td>
              <td style="border: 1px solid #dddddd; text-align: left; padding: 8px;">${item.quantity}</td>
              <td style="border: 1px solid #dddddd; text-align: left; padding: 8px;">₹${item.price}</td>
          </tr>
      `;
  });

  // Adding "confirmed items" table if any ordered items exist
  body += `
            <p>You have ordered these items:</p>
            <table style="border-collapse: collapse; width: 100%;">
                <tr>
                    <th style="border: 1px solid #dddddd; text-align: left; padding: 8px;">Item</th>
                    <th style="border: 1px solid #dddddd; text-align: left; padding: 8px;">Quantity</th>
                    <th style="border: 1px solid #dddddd; text-align: left; padding: 8px;">Price</th>
                </tr>
                ${orderedItems}
            </table>
            <p style="color: #c1464c;">Total Amount: <strong>₹${totalAmount}</strong></p>
            <div style="margin-top: 40px; background-color: #ffffcc; padding: 10px; border: 1px solid #cccccc; border-radius: 5px;">
                <p>
                    <strong>Delivery Information:</strong>
                </p>
                <ul>
                    ${deliveryType === 'pickup' 
                        ? `<li>Your order will be ready for pickup at <strong>${pickupLocation}</strong> during your selected slot <strong>${deliverySlot}</strong></li>`
                        : `<li>Your order will be delivered to ${flat} as per your preferred slot <strong>${deliverySlot}</strong></li>
                           <li>In case you are unavailable during that time, kindly pick-up the food from <strong>E-502</strong>, when possible.</li>`
                    }
                    <li>In case of item unavailability or delivery delay from our side, we will notify you ASAP.</li>
                </ul>
            </div>
            <p style="margin-top: 40px;">-------------------------------------</p>
            <p>We appreciate your support!</p>
            <p><strong>BonBites Team</strong></p>
        </body>
        </html>
    `;

  var options = {
    cc: "zaheer.azad@gmail.com,simi.nazeem@gmail.com",
    htmlBody: body
  };

  // Send email with HTML body
  GmailApp.sendEmail(email, subject, '', options);
}
