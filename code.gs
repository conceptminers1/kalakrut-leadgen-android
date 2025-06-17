const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
const GEMINI_MODEL = 'gemini-2.0-flash'; // You can also use 'gemini-1.5-flash-latest' or 'gemini-1.5-pro-latest'

/**
* Reads data from a specified sheet and returns it as an array of objects.
* @param {string} sheetName The name of the sheet to read from.
* @return {Array<Object>} An array of objects, where each object represents a row.
*/
function getSheetData(sheetName) {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('ArtistCatalog');
    if (!sheet) {
        throw new Error(`Sheet "${'ArtistCatalog'}" not found.`);
    }

    const range = sheet.getDataRange();
    const values = range.getValues();

    if (values.length === 0) {
        return []; // No data in the sheet
    }

    const headers = values[0];
    const data = [];
    for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const rowObject = {};
        for (let j = 0; j < headers.length; j++) {
            rowObject[headers[j]] = row[j];
        }
        data.push(rowObject);
    }
    return data;
}

/**
* Appends a new row to the specified sheet.
* @param {string} sheetName The name of the sheet to append to.
* @param {Array<any>} rowData An array of values to append as a new row.
*/
function appendRowToSheet(sheetName, rowData) {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('Leads');
    if (!sheet) {
        throw new Error(`Sheet "${'Leads'}" not found.`);
    }
    sheet.appendRow(rowData);
}

/**
* Sends a prompt to the Gemini API and returns the response.
* @param {string} promptText The text prompt to send to Gemini.
* @return {string} The text response from Gemini.
*/
function callGeminiAPI(promptText) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const payload = {
        contents: [{
            parts: [{
                text: promptText,
            },
            ],
        },
        ],
        // Optional: Add generation config for more control
        generationConfig: {
            temperature: 0.7,
            // Adjust creativity (0.0-1.0)
            maxOutputTokens: 500,
        },
    };

    const options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
        // Prevents Apps Script from throwing an error on non-200 responses
    };

    try {
        const response = UrlFetchApp.fetch(url, options);
        const data = JSON.parse(response.getContentText());

        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
            return data.candidates[0].content.parts[0].text;
        } else if (data.error) {
            Logger.log('Gemini API Error: ' + JSON.stringify(data.error));
            return `Error from AI: ${data.error.message || 'Unknown error'}`;
        } else {
            Logger.log('Unexpected Gemini API response structure: ' + JSON.stringify(data));
            return "I couldn't get a clear answer from the AI.";
        }
    } catch (e) {
        Logger.log('Error calling Gemini API: ' + e.toString());
        return 'An error occurred while connecting to the AI. Please try again.';
    }
}

/**
* Main function to handle user queries, integrate with Gemini,
* and record lead data. This function will be exposed as a web app.
* @param {Object} e The event object passed to a web app.
* @return {HtmlOutput} The HTML output for the web app.
*/
function doGet(e) {
    // This is typically for initial page load or basic GET requests.
    // For chat interaction, we'll primarily use doPost.
    return HtmlService.createHtmlOutput('<h1>Welcome to the Lead Generation Agent!</h1><p>Send your queries via POST request.</p>');
}

function doPost(e) {
    let userQuery = '';
    let geminiResponse = '';
    let leadStatus = 'New Lead'; // Default status
    let notes = '';

    try {
        const requestBody = JSON.parse(e.postData.contents);
        userQuery = requestBody.query || '';

        if (!userQuery) {
            return ContentService.createTextOutput(JSON.stringify({
                response: "Please provide a query."
            }))
            .setMimeType(ContentService.MimeType.JSON);
        }

        // 1. Get relevant data from Google Sheet (ArtistCatalog)
        const artistData = getSheetData('ArtistCatalog');
        let artistContext = "Here is some artist and album information from a music catalog:\n";
        if (artistData.length > 0) {
            artistData.forEach(artist => {
                artistContext += `Artist: ${artist.art_name} (Real Name: ${artist.real_name}, Role: ${artist.role}, Born: ${artist.year_of_birth}, Country: ${artist.country}, City: ${artist.city}, Email: ${artist.email}, Zip: ${artist.zip_code}). Album: ${artist.album_title} (Genre: ${artist.genre}, Year: ${artist.year_of_pub}, Tracks: ${artist.num_of_tracks}, Sales: ${artist.num_of_sales}). Critics: Rolling Stone: ${artist.rolling_stone_critic}, MTV: ${artist.mtv_critic}, Music Maniac: ${artist.music_maniac_critic}.\n`;
            });
        } else {
            artistContext += "No artist or album data available.\n";
        }

        // 2. Craft the prompt for Gemini, including the sheet data
        const fullPrompt = `You are a helpful music industry sales assistant. Your goal is to answer user questions about artists and their albums, and identify potential leads for partnerships, bookings, or sales.
        If a user expresses interest in an artist, their music, booking them, or investing, consider them a lead.

        ${artistContext}

        User Query: "${userQuery}"

        Based on the artist and album information provided, answer the user's question. If you identify a potential lead, highlight it.`;

        geminiResponse = callGeminiAPI(fullPrompt);

        // 3. Simple Lead Identification Logic (can be enhanced with NLU or more complex rules)
        const lowerCaseResponse = geminiResponse.toLowerCase();
        const lowerCaseQuery = userQuery.toLowerCase();

        if (
            lowerCaseResponse.includes('lead') ||
            lowerCaseResponse.includes('interested') ||
            lowerCaseResponse.includes('more information') ||
            lowerCaseResponse.includes('booking') ||
            lowerCaseResponse.includes('partnership') ||
            lowerCaseResponse.includes('invest') ||
            lowerCaseQuery.includes('book') ||
            lowerCaseQuery.includes('partner') ||
            lowerCaseQuery.includes('invest') ||
            lowerCaseQuery.includes('contact') ||
            lowerCaseQuery.includes('interested')
        ) {
            leadStatus = 'Qualified Lead';
            notes = 'User showed interest in an artist, booking, or partnership.';
        } else {
            leadStatus = 'Information Inquiry';
            notes = 'General question, no direct lead identified yet.';
        }

        // You could also use Gemini itself to classify the lead:
        // const leadClassificationPrompt = `Classify the following conversation as 'Qualified Lead' or 'Information Inquiry'.
        // Conversation:
        // User: "${userQuery}"
        // AI: "${geminiResponse}"
        // Classification:`;
        // const classification = callGeminiAPI(leadClassificationPrompt).trim();
        // if (classification.includes('Qualified Lead')) {
        //    leadStatus = 'Qualified Lead';
        //    notes = 'Classified by AI as a qualified lead.';
        // }

        // 4. Record the interaction as a lead
        appendRowToSheet('Leads', [new Date(), userQuery, geminiResponse, leadStatus, notes]);

        return ContentService.createTextOutput(JSON.stringify({
            response: geminiResponse
        }))
        .setMimeType(ContentService.MimeType.JSON);

    } catch (e) {
        Logger.log('Error in doPost: ' + e.toString());
        // Record error as a lead for debugging if needed
        appendRowToSheet('Leads', [new Date(), userQuery, `ERROR: ${e.toString()}`, 'Error', `Failed to process: ${e.message}`]);
        return ContentService.createTextOutput(JSON.stringify({
            response: `An unexpected error occurred: ${e.message}`
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
}

/**
* Creates a custom menu in the Google Sheet for easy access (optional).
*/
function onOpen() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('AI Agent Tools')
    .addItem('Deploy Web App', 'deployWebApp')
    .addItem('Test Gemini Call', 'testGeminiCall') // For quick testing
    .addToUi();
}

/**
* A utility function to guide the user on how to deploy the script as a web app.
*/
function deployWebApp() {
    const ui = SpreadsheetApp.getUi();
    ui.alert(
        'Deploy Web App',
        'To deploy this script as a web app:\n\n' +
        '1. In the Apps Script editor, click "Deploy" (top right).\n' +
        '2. Select "New deployment".\n' +
        '3. For "Select type", choose "Web app".\n' +
        '4. Set "Execute as" to "Me".\n' +
        '5. Set "Who has access" to "Anyone" (for public access from Android/webpage).\n' +
        '6. Click "Deploy".\n' +
        '7. Copy the "Web app URL" - this is your API endpoint for your Android app/webpage!',
        ui.ButtonSet.OK
    );
}

/**
* Simple test function to verify Gemini API connection (run from Apps Script editor).
*/
function testGeminiCall() {
    const testPrompt = "What is the capital of France?";
    const response = callGeminiAPI(testPrompt);
    Logger.log('Gemini Test Response: ' + response);
    /* SpreadsheetApp.getUi().alert('Gemini Test Response:', response, SpreadsheetApp.getUi().ButtonSet.OK);*/
}// Function to get OAuth2 service for the service account
function getServiceAccountService() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const privateKey = scriptProperties.getProperty('SERVICE_ACCOUNT_PRIVATE_KEY');
  const clientEmail = scriptProperties.getProperty('SERVICE_ACCOUNT_CLIENT_EMAIL');

  if (!privateKey || !clientEmail) {
    throw new Error('Service account private key and client email not set in script properties.');
  }

  // Define the scopes needed for the services you want to access
  // For Firestore: https://www.googleapis.com/auth/datastore
  // For other services, find the appropriate scope in their documentation
  const scopes = ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/datastore']; // Add other scopes if needed eg https://www.googleapis.com/auth/datastore

  return OAuth2.createService('ServiceAccountFirebase') // Name your service
      .setPrivateKey(privateKey)
      .setIssuer(clientEmail)
      .setSubject(clientEmail) // Usually the same as issuer for service accounts
      .setPropertyStore(PropertiesService.getScriptProperties()) // Store tokens securely
      /*.setCacheExpirationSeconds(3600)*/  // Cache token for 1 hour
      .setScope(scopes)
      .setParam('access_type', 'offline'); // Necessary for service accounts
}

// Function to get a valid access token
function getFirebaseAccessToken() {
  const service = getServiceAccountService();
  if (service.hasAccess()) {
    return service.getAccessToken();
  } else {
    // Handle authorization failure - this shouldn't happen for service accounts
    // unless there's a configuration error or network issue.
    Logger.log('Service account authorization failed: ' + service.getLastError());
    throw new Error('Could not get access token for Firebase.');
  }
}/**
 * Sends data from the active sheet to Cloud Firestore via the REST API.
 */
function sendSheetDataToFirestoreREST() {
  // --- IMPORTANT: Replace with your Firestore Project ID and Database ID (usually '(default)') ---
  const projectId = 'kalakrut-leadgen-android'; // Your Firebase Project ID
  const databaseId = '(default)'; // Usually '(default)' for the default Firestore database
  const collectionPath = 'sheetEntries'; // The Firestore collection path
  // -------------------------------------------------------------------------------------------

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const range = sheet.getDataRange().getValues();

  if (range.length < 2) {
      SpreadsheetApp.getUi().alert('Error', 'Sheet is empty or only has headers.', SpreadsheetApp.getUi().ButtonSet.OK);
      return;
  }

  const headers = range[0];
  const dataToSend = range.slice(1);

  // Prepare data for Firestore's REST API format
  // Firestore REST API expects a specific structure for creating documents:
  // { "fields": { fieldName: { valueType: value, ... } } }
  // See Firestore REST API documentation for details on value types.
  // This mapping is crucial and depends on your data types (string, number, boolean, etc.)
  const documentsToCreate = dataToSend.map(row => {
    const fields = {};
    headers.forEach((header, index) => {
       const cellValue = row[index];
       if (header && header.trim() !== '') {
           const fieldName = header.trim();
           // Basic type mapping - ADD MORE as needed for your data types!
           if (typeof cellValue === 'string') {
               fields[fieldName] = { stringValue: cellValue };
           } else if (typeof cellValue === 'number') {
               // Firestore REST API uses doubleValue for all numbers
               fields[fieldName] = { doubleValue: cellValue };
           } else if (typeof cellValue === 'boolean') {
               fields[fieldName] = { booleanValue: cellValue };
           } else if (cellValue instanceof Date) {
               fields[fieldName] = { timestampValue: cellValue.toISOString() };
           } else if (cellValue === null || cellValue === '') {
               fields[fieldName] = { nullValue: null };
           }
           // Add more checks for arrays, nested objects, etc., if your sheet data includes them.
       }
    });

    // Return in the format expected by the Firestore REST API for a document payload
    return { fields: fields };
  });

  // Firestore REST API's createDocument method is used here.
  // We'll loop through and send each row as a new document.
  // Note: For very large datasets, consider using the batchWrite method for better performance.
  const firestoreApiBaseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/Leads`;

  try {
    const accessToken = getFirebaseAccessToken(); // Get the OAuth2 access token

    documentsToCreate.forEach((docPayload, index) => {
        const options = {
          'method' : 'post',
          'contentType': 'application/json',
          'headers': {
              // Complete the Authorization header with the Bearer token
              'Authorization': 'Bearer ' + accessToken
          },
          // The payload must be a JSON string
          'payload': JSON.stringify(docPayload),
          'muteHttpExceptions': true // Prevents script from stopping on HTTP errors (e.g., 404, 500)
        };

        const response = UrlFetchApp.fetch(firestoreApiBaseUrl, options);
        const responseCode = response.getResponseCode();
        const responseBody = response.getContentText();

        if (responseCode >= 200 && responseCode < 300) {
            console.log(`Document ${index + 1} created successfully: ${responseBody}`);
        } else {
            console.error(`Error creating document ${index + 1}. Response Code: ${responseCode}. Response Body: ${responseBody}`);
            // Optionally, alert the user about the first failure and stop
            throw new Error(`Failed to create document at row ${index + 2}. See logs for details.`);
        }
    });

    SpreadsheetApp.getUi().alert('Success', `${documentsToCreate.length} records have been sent to Firestore successfully.`, SpreadsheetApp.getUi().ButtonSet.OK);

  } catch (e) {
    // Log the error for debugging purposes and show an alert to the user.
    console.error(`Error sending data to Firestore: ${e.toString()}`);
    /*SpreadsheetApp.getUi().alert('Error', `Failed to send data to Firestore: ${e.message}`, SpreadsheetApp.getUi().ButtonSet.OK);*/
  }
}


// --- REQUIRED HELPER FUNCTION FOR AUTHENTICATION ---

/**
 * --- IMPORTANT: This function requires setting up a service account and the OAuth2 library. ---
 *
 * To set this up:
 * 1.  **Create a Service Account:** In your Google Cloud Platform project, go to "IAM & Admin" > "Service Accounts". Create a new service account.
 * 2.  **Grant Permissions:** Grant the service account the "Cloud Datastore User" role (which is used by Firestore).
 * 3.  **Create a JSON Key:** Create a key for the service account and download the JSON file.
 * 4.  **Add Script Properties:** In the Apps Script editor, go to "Project Settings" > "Script Properties". Add two properties:
 * - `CLIENT_EMAIL`: The "client_email" from the downloaded JSON key file.
 * - `PRIVATE_KEY`: The "private_key" from the downloaded JSON key file (including the "-----BEGIN PRIVATE KEY-----" and "-----END PRIVATE KEY-----" lines).
 * 5.  **Add the OAuth2 Library:**
 * - In the Apps Script editor, click the "Libraries" + icon.
 * - Enter the script ID: `1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF`
 * - Select the latest version and click "Add".
 */
function getFirebaseAccessToken() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const clientEmail = scriptProperties.getProperty('CLIENT_EMAIL');
  const privateKey = scriptProperties.getProperty('PRIVATE_KEY');

  if (!clientEmail || !privateKey) {
    throw new Error('Missing required script properties: CLIENT_EMAIL and/or PRIVATE_KEY. Please follow the setup instructions.');
  }

  const service = OAuth2.createService('Firestore')
      .setTokenUrl('https://oauth2.googleapis.com/token')
      .setPrivateKey(privateKey)
      .setIssuer(clientEmail)
      .setSubject(clientEmail)
      .setPropertyStore(PropertiesService.getScriptProperties())
      .setCache(CacheService.getScriptCache())
      .setLock(LockService.getScriptLock())
      .setScope('https://www.googleapis.com/auth/datastore'); // Firestore uses the datastore scope

  if (service.hasAccess()) {
    return service.getAccessToken();
  } else {
    const lastError = service.getLastError();
    console.error(`OAuth2 Error: ${JSON.stringify(lastError, null, 2)}`);
    throw new Error(`Failed to get access token. Check the script logs for details. Error summary: ${lastError.message}`);
  }
}
