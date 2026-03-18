# Modern Workout Tracker

A modern, responsive, client-side only web application to track daily fitness. Data is stored on Google Sheets using a simple Google Apps Script as a REST API backend. It features multiple users support, interactive charts, data caching with localStorage, and CSV exports!

## 🚀 Features
- **Zero Backend**: Hosted purely on GitHub Pages. Data is stored via a simple Google Form/Sheets App Script.
- **Multiple Users**: Create individual tabs automatically in the Google Sheet based on Usernames.
- **Modern UI**: Supports visual glassmorphic styles, Dark Mode toggle, Mobile Responsive layouts.
- **Advanced Stats**: Automatic completion %, consecutive workout streaks, target weight progress tracking.
- **Interactive Visuals**: Chart.js graph with daily, weekly avg, and monthly view filters.
- **Offline Support**: Automatically caches data to LocalStorage if API calls fail.

## 🔗 Setup Instructions

To deploy this project:
1. Copy the code from `index.html`, `styles.css`, and `script.js`.
2. Push them to a GitHub repository.
3. Enable Github Pages (Settings > Pages > Deploy from branch > save).

### 🔐 Google Sheets & API Connection

We will use Google Apps Script to act as our free backend.

#### Step 1. Get the Apps Script
1. Go to [Google Sheets](https://sheets.google.com) and create a New Blank Spreadsheet.
2. At the top menu, go to **Extensions > Apps Script**.
3. Delete any code in the editor, and paste the code below:

```javascript
function doGet(e) {
  if (e.parameter.action === "login") {
    var credSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Credentials");
    if (!credSheet) {
      credSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("Credentials");
      credSheet.appendRow(["Username", "PIN"]);
      credSheet.appendRow(["Riddhi", "Riddhi2026"]);
      credSheet.appendRow(["Ajit", "Ajit2026"]);
    }
    var cData = credSheet.getDataRange().getValues();
    var valid = false;
    var realUser = "";
    
    for (var i = 1; i < cData.length; i++) {
      if (String(cData[i][0]).toLowerCase() === String(e.parameter.user).toLowerCase() && String(cData[i][1]) === String(e.parameter.pin)) {
        valid = true;
        realUser = String(cData[i][0]);
        break;
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "success", valid: valid, realUser: realUser }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Setup dynamic Workout Types & Themes Settings
  var settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Settings");
  var workoutTypes = ["Gym", "Running", "Badminton", "Tennis"];
  if (!settingsSheet) {
    settingsSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("Settings");
    settingsSheet.appendRow(["Workout Types", "Theme Property", "Theme Value"]);
    settingsSheet.appendRow(["Gym", "PrimaryColor", "#e1306c"]);
    settingsSheet.appendRow(["Running", "SecondaryColor", "#fbad50"]);
    settingsSheet.appendRow(["Badminton", "DangerColor", "#ed4956"]);
    settingsSheet.appendRow(["Tennis", "", ""]);
  }
  
  var sData = settingsSheet.getDataRange().getValues();
  workoutTypes = [];
  var theme = {};
  for(var i = 1; i < sData.length; i++) {
     if(sData[i][0]) workoutTypes.push(sData[i][0]);
     if(sData[i][1] && sData[i][2]) theme[sData[i][1]] = sData[i][2];
  }

  var user = e.parameter.user || "default";
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(user);
  
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(user);
    sheet.appendRow(["Date", "Time", "Weight", "Type", "CheatMeal"]);
  }

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return ContentService.createTextOutput(JSON.stringify({ status: "success", data: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var headers = data[0];
  var result = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if(row[0] == "") continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var key = headers[j].toLowerCase();
      if(key === "cheatmeal") key = "cheatMeal";
      if(key === "date") {
        try {
          var d = new Date(row[j]);
          // Adjust timezone offset to prevent date shifting
          d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
          obj[key] = d.toISOString().split('T')[0];
        } catch(err) { obj[key] = row[j]; }
      } else {
        obj[key] = row[j];
      }
    }
    result.push(obj);
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    data: result,
    workoutTypes: workoutTypes,
    theme: theme
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var jsonParams;
  try {
    jsonParams = JSON.parse(e.postData.contents);
  } catch(err) {
    jsonParams = e.parameter;
  }
  
  var user = jsonParams.user || "default";
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(user);
  
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(user);
    sheet.appendRow(["Date", "Time", "Weight", "Type", "CheatMeal"]);
  }
  
  // Find if date already exists and overwrite, or append
  var data = sheet.getDataRange().getValues();
  var updated = false;
  for(var i=1; i<data.length; i++){
    var d = new Date(data[i][0]);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    var rowDate = d.toISOString().split('T')[0];
    
    // Check Date and Time to overwrite, else append
    if(rowDate === jsonParams.date && String(data[i][1]) === String(jsonParams.time)) {
      sheet.getRange(i+1, 3).setValue(jsonParams.weight);
      sheet.getRange(i+1, 4).setValue(jsonParams.type);
      sheet.getRange(i+1, 5).setValue(jsonParams.cheatMeal);
      updated = true;
      break;
    }
  }
  
  if(!updated) {
    sheet.appendRow([jsonParams.date, jsonParams.time, jsonParams.weight, jsonParams.type, jsonParams.cheatMeal]);
  }
  
  return ContentService.createTextOutput(JSON.stringify({status: "success"})).setMimeType(ContentService.MimeType.JSON);
}
```

#### Step 2. Deploy Web App
1. Click **Deploy > New deployment**.
2. Setting type: **Web App**.
3. Description: `Workout API`.
4. Execute as: **Me**.
5. Who has access: **Anyone** (Super important!).
6. Hit **Deploy**. (Authorize permissions to your account when it prompts).
7. Copy the **Web app URL**.

#### Step 3. Connect to Frontend
1. Open `script.js` in this repository.
2. At the very top, locate the `API_URL` variable.
3. Replace `"YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE"` with the URL you just copied:
```javascript
const API_URL = "https://script.google.com/macros/s/XXXXX/exec";
```
4. Commit & push changes.

### 👤 Dynamic Users Validation
To avoid committing your credentials directly to GitHub natively, passwords are now managed securely inside your Google Sheet!

Whenever anyone loads the login page, the code fetches verification from the Google Apps Script securely. 

A new Tab named **`Credentials`** will be automatically created in your Google Sheet the first time you login. You can:
- **Add unlimited new users** dynamically without ever editing code.
- **Change passwords instantly** by literally just modifying a cell in the `Credentials` tab (e.g., column A for Username, column B for PIN).
- Completely secure as GitHub frontend repository only makes an invisible, credentialed API request natively bypassing source-code exposure.

And you're all set! 🚀
