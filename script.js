// -----------------------------------------------------
// Configuration & State
// -----------------------------------------------------

// TODO: Replace this URL with your deployed Google Apps Script Web App URL
const API_URL = "https://script.google.com/macros/s/AKfycbyOzzGfT37V1oRmhPoDbQtby4T3_QVCeH_S9xcAi1qAqrsPaG9Usz79IrJaRH5K35G8hQ/exec";

// Authentication is securely handled backend via Google Sheets 'Credentials' tab.

let currentUser = localStorage.getItem("workout_user") || null;
let currentData = [];
let chartInstance = null;
let workoutStatsChartInstance = null;
let inactivityTimeout;
const TIMEOUT_DURATION = 60000; // 60 Seconds

// DOM Elements
const body = document.body;
const themeToggle = document.getElementById("themeToggle");
const loginContainer = document.getElementById("loginContainer");
const dashboardContainer = document.getElementById("dashboardContainer");
const loginForm = document.getElementById("loginForm");
const logoutBtn = document.getElementById("logoutBtn");
const welcomeMessage = document.getElementById("welcomeMessage");
const loadingOverlay = document.getElementById("loadingOverlay");
const toast = document.getElementById("toast");
const logForm = document.getElementById("logForm");
const historyBody = document.getElementById("historyBody");

// Set native default date and time to today
document.getElementById("logDate").valueAsDate = new Date();
const now = new Date();
document.getElementById("logTime").value = now.toTimeString().slice(0, 5);

// App Theme Initialization
window.applyTheme = function (themeObj) {
    if (!themeObj) return;

    // Using document.body to correctly override the CSS specificity rules between light/dark modes
    if (themeObj.PrimaryColor) document.body.style.setProperty('--primary-color', themeObj.PrimaryColor);
    if (themeObj.SecondaryColor) document.body.style.setProperty('--secondary-color', themeObj.SecondaryColor);
    if (themeObj.DangerColor) document.body.style.setProperty('--danger-color', themeObj.DangerColor);

    // Only apply explicit background color if NOT in dark mode, since dark mode has strict background requirements
    if (themeObj.BackgroundColor && !document.body.classList.contains('dark-mode')) {
        document.body.style.setProperty('--bg-color', themeObj.BackgroundColor);
    }
};
const savedNetTheme = localStorage.getItem("workout_theme_colors");
if (savedNetTheme) applyTheme(JSON.parse(savedNetTheme));

// -----------------------------------------------------
// Theme Management
// -----------------------------------------------------
const savedTheme = localStorage.getItem("workout_theme") || "light-mode";
body.className = savedTheme;
themeToggle.textContent = savedTheme === "light-mode" ? "🌙" : "☀️";

themeToggle.addEventListener("click", () => {
    const isLight = body.classList.contains("light-mode");
    body.className = isLight ? "dark-mode" : "light-mode";
    themeToggle.textContent = isLight ? "☀️" : "🌙";
    localStorage.setItem("workout_theme", body.className);
});

// -----------------------------------------------------
// Auth Flow
// -----------------------------------------------------
if (currentUser) {
    showDashboard(currentUser);
}

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const inputUser = document.getElementById("username").value.trim();
    const pin = document.getElementById("pin").value.trim();
    const err = document.getElementById("loginError");

    err.textContent = "";

    if (API_URL === "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE" || !API_URL) {
        // Safe Offline Fallback Debugging
        if (inputUser.toLowerCase() === "demo" && pin === "1234") {
            currentUser = "Demo";
            localStorage.setItem("workout_user", "Demo");
            showDashboard("Demo");
        } else {
            err.textContent = "Offline Mode: use 'Demo' and '1234' to test locally.";
        }
        return;
    }

    // Backend Auth Verification
    err.textContent = "Verifying securely...";
    document.querySelector("button[type='submit']").disabled = true;

    try {
        // Network Check
        const res = await fetch(`${API_URL}?action=login&user=${encodeURIComponent(inputUser)}&pin=${encodeURIComponent(pin)}`);
        const json = await res.json();

        if (json.status === "success" && json.valid) {
            err.textContent = "";
            const realUser = json.realUser;
            currentUser = realUser;
            localStorage.setItem("workout_user", realUser);

            // Save profile details if returned from backend
            if (json.profile) {
                localStorage.setItem(`profile_${realUser}`, JSON.stringify(json.profile));
            }

            showDashboard(realUser);
        } else {
            err.textContent = "Invalid username or PIN.";
        }
    } catch (error) {
        err.textContent = "Network error. Could not verify.";
    } finally {
        const subBtn = document.querySelector("button[type='submit']");
        if (subBtn) subBtn.disabled = false;
    }
});

logoutBtn.addEventListener("click", performLogout);

function performLogout() {
    currentUser = null;
    localStorage.removeItem("workout_user");
    currentData = [];
    loginContainer.classList.remove("hidden");
    dashboardContainer.classList.add("hidden");
    logoutBtn.classList.add("hidden");
    const welcome = document.getElementById("welcomeMessage");
    if (welcome) welcome.classList.add("hidden");
    document.getElementById("username").value = "";
    document.getElementById("pin").value = "";

    // Clear timeout and listeners
    clearTimeout(inactivityTimeout);
    removeActivityListeners();
    showToast("Session timed out due to Inactivity", true);
}

function resetInactivityTimer() {
    clearTimeout(inactivityTimeout);
    if (currentUser) {
        inactivityTimeout = setTimeout(performLogout, TIMEOUT_DURATION);
    }
}

function setupActivityListeners() {
    ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'].forEach(name => {
        document.addEventListener(name, resetInactivityTimer, true);
    });
}

function removeActivityListeners() {
    ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'].forEach(name => {
        document.removeEventListener(name, resetInactivityTimer, true);
    });
}

function showDashboard(user) {
    loginContainer.classList.add("hidden");
    dashboardContainer.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");

    // Show personalized welcome
    const welcome = document.getElementById("welcomeMessage");
    if (welcome) {
        welcome.textContent = `Hello, ${user}!`;
        welcome.classList.remove("hidden");
    }

    // Start Inactivity Guardian
    setupActivityListeners();
    resetInactivityTimer();

    // Refresh display cards with latest profile data
    updateProfileStats();
    fetchData();
}

// -----------------------------------------------------
// API & Data Handling
// -----------------------------------------------------

function showLoading(show) {
    if (show) loadingOverlay.classList.remove("hidden");
    else loadingOverlay.classList.add("hidden");
}

function showToast(msg, isError = false) {
    toast.textContent = msg;
    toast.className = `toast show ${isError ? 'error' : ''}`;
    setTimeout(() => toast.classList.remove("show"), 3000);
}

async function fetchData() {
    showLoading(true);
    try {
        if (API_URL === "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE" || !API_URL) {
            // Fallback to local storage if API is not set
            const localData = localStorage.getItem(`workout_data_${currentUser}`);
            currentData = localData ? JSON.parse(localData) : [];
            showToast("Running in Local Mode (API not configured)");
        } else {
            const res = await fetch(`${API_URL}?user=${currentUser}`);
            const json = await res.json();
            if (json.status === 'success') {
                currentData = json.data;
                localStorage.setItem(`workout_data_${currentUser}`, JSON.stringify(currentData));

                // Populate Workout Types dynamically from backend
                if (json.workoutTypes && json.workoutTypes.length > 0) {
                    const sel = document.getElementById("logType");
                    sel.innerHTML = "";
                    json.workoutTypes.forEach(t => {
                        const opt = document.createElement("option");
                        opt.value = t; opt.textContent = t;
                        sel.appendChild(opt);
                    });
                }

                // Process dynamic theme colors
                if (json.theme) {
                    localStorage.setItem("workout_theme_colors", JSON.stringify(json.theme));
                    window.applyTheme(json.theme);
                }
            } else {
                throw new Error("Failed to fetch");
            }
        }
    } catch (err) {
        console.error("Fetch Error: ", err);
        showToast("Using Offline Data", true);
        const localData = localStorage.getItem(`workout_data_${currentUser}`);
        currentData = localData ? JSON.parse(localData) : [];
    } finally {
        updateUI();
        showLoading(false);
    }
}

logForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const date = document.getElementById("logDate").value;
    const time = document.getElementById("logTime").value;
    const weight = parseFloat(document.getElementById("logWeight").value);
    const status = document.getElementById("logStatus").value;
    
    // Determine type string for database
    let type = "Skipped";
    if (status === "Done") {
        type = document.getElementById("logType").value || "Workout";
    } else if (status === "Rest") {
        type = "Rest Day";
    }
    const isCheat = document.getElementById("logCheat").checked;
    const cheat = isCheat ? (document.getElementById("logCheatText").value.trim() || "Yes") : "No";

    const payload = {
        user: currentUser,
        date, time, weight, type, status, cheatMeal: cheat
    };

    showLoading(true);
    try {
        if (API_URL === "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE" || !API_URL) {
            // Local fallback
            const existingIndex = currentData.findIndex(d => d.date === date && d.time === time);
            if (existingIndex > -1) {
                currentData[existingIndex] = payload;
            } else {
                currentData.push(payload);
            }
            localStorage.setItem(`workout_data_${currentUser}`, JSON.stringify(currentData));
            showToast("Saved Locally");
        } else {
            const res = await fetch(API_URL, {
                method: "POST",
                body: JSON.stringify(payload) // Web app usually handles text/plain JSON strings
            });
            const textResponse = await res.text();
            let json = {};
            try { json = JSON.parse(textResponse); } catch (err) { }

            if (json.status === "success") {
                showToast("Successfully Sync'd");
                // Refresh data
                await fetchData();
                return; // fetch will update UI
            } else {
                throw new Error("API Save Error");
            }
        }
    } catch (err) {
        console.error("Save Error: ", err);
        showToast("Save Failed. Try Again.", true);
    }
    updateUI();
    showLoading(false);
});

// -----------------------------------------------------
// UI Updates & Logic
// -----------------------------------------------------

function updateUI() {
    // Precise Sort: Date + Time ensuring the last entry is the absolute latest
    currentData.sort((a, b) => {
        const dateTimeA = new Date(`${a.date}T${a.time || '00:00'}`);
        const dateTimeB = new Date(`${b.date}T${b.time || '00:00'}`);
        return dateTimeA - dateTimeB;
    });

    updateStats();
    renderTable();
    renderChart();
    renderWorkoutStatsChart();
}

/**
 * Shared filtering logic to keep Table and Charts in sync
 */
function getFilteredData() {
    const range = document.getElementById("historyRange") ? document.getElementById("historyRange").value : "7";
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    if (range === "all") return [...currentData];

    const threshold = new Date(todayStart);
    if (range === "7") threshold.setDate(todayStart.getDate() - 7);
    else if (range === "15") threshold.setDate(todayStart.getDate() - 15);
    else if (range === "30") threshold.setMonth(todayStart.getMonth() - 1);
    else if (range === "90") threshold.setMonth(todayStart.getMonth() - 3);
    else if (range === "180") threshold.setMonth(todayStart.getMonth() - 6);
    threshold.setHours(0, 0, 0, 0);

    return currentData.filter(d => {
        if (!d.date) return false;
        const [y, m, day] = d.date.split("-").map(Number);
        const entryDate = new Date(y, m - 1, day);
        return entryDate >= threshold && entryDate <= todayEnd;
    });
}

function updateStats() {
    if (currentData.length === 0) {
        document.getElementById("planStartDate").textContent = "--";
        document.getElementById("streakValue").textContent = "0";
        document.getElementById("completionValue").textContent = "0";
        document.getElementById("totalDaysValue").textContent = "0";
        document.getElementById("startWeight").textContent = "--";
        document.getElementById("currWeight").textContent = "--";
        document.getElementById("totalChange").textContent = "--";
        document.getElementById("motivationMessage").textContent = "Log your first entry to kick things off!";
        return;
    }

    const firstEntry = currentData[0];
    const lastEntry = currentData[currentData.length - 1];

    document.getElementById("planStartDate").textContent = firstEntry.date;

    // Weights
    const startW = firstEntry.weight;
    const currW = lastEntry.weight;
    const diff = (currW - startW).toFixed(1);

    document.getElementById("startWeight").textContent = startW;
    document.getElementById("currWeight").textContent = currW;
    const tcEl = document.getElementById("totalChange");
    tcEl.textContent = diff > 0 ? `+${diff}` : diff;

    // Clear old classes
    tcEl.classList.remove("loss-value", "gain-value");
    if (diff < 0) {
        tcEl.classList.add("loss-value");
    } else if (diff > 0) {
        tcEl.classList.add("gain-value");
    }

    // Consistency Analysis (Done and Rest days are both positive progress)
    const totalEntries = currentData.length;
    const consistentEntriesCount = currentData.filter(d => d.status === "Done" || d.status === "Rest").length;
    let completion = totalEntries > 0 ? Math.round((consistentEntriesCount / totalEntries) * 100) : 0;

    document.getElementById("totalDaysValue").textContent = totalEntries;
    document.getElementById("completionValue").textContent = completion;

    // Streak Calculation (includes both Workout days and Rest days)
    let streak = 0;
    const consistentDates = [...new Set(currentData.filter(d => d.status === "Done" || d.status === "Rest").map(d => d.date))];
    if (consistentDates.length > 0) {
        consistentDates.sort((a, b) => new Date(a) - new Date(b));
        streak = 1;
        for (let i = consistentDates.length - 1; i > 0; i--) {
            const curr = new Date(consistentDates[i]);
            const prev = new Date(consistentDates[i - 1]);
            const diffTime = Math.abs(curr - prev);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            // A streak continues if there is exactly 1 day difference between logs
            if (diffDays === 1) streak++;
            else break;
        }
    }
    document.getElementById("streakValue").textContent = streak;

    // Motivation msg
    const msgBox = document.getElementById("motivationMessage");
    if (streak >= 5) {
        msgBox.textContent = `Amazing! You're on a ${streak}-day streak 🔥`;
        msgBox.style.borderLeftColor = "var(--primary-color)";
    } else if (completion > 80) {
        msgBox.textContent = "Great consistency! Keep pushing 💪";
        msgBox.style.borderLeftColor = "var(--success-color)";
    } else {
        msgBox.textContent = "Every day is a new chance. Stay focused! 🎯";
        msgBox.style.borderLeftColor = "var(--secondary-color)";
    }
}

function formatTime12h(timeStr) {
    if (!timeStr) return "--:--";
    // If already formatted (contains AM/PM), return as is
    if (timeStr.toLowerCase().includes("am") || timeStr.toLowerCase().includes("pm")) return timeStr;

    let hours, minutes;
    if (timeStr.length > 8 && timeStr.includes("T")) {
        // ISO string format
        const tPart = timeStr.split("T")[1];
        hours = parseInt(tPart.substring(0, 2));
        minutes = tPart.substring(3, 5);
    } else {
        // HH:mm format
        const parts = timeStr.split(":");
        if (parts.length < 2) return timeStr;
        hours = parseInt(parts[0]);
        minutes = parts[1];
    }

    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // conversion of 0 to 12
    return `${hours}:${minutes} ${ampm}`;
}

function renderTable() {
    historyBody.innerHTML = "";

    const filteredData = getFilteredData();

    // Sort: Newest first (Precise Date + Time)
    const displayData = filteredData.sort((a, b) => {
        const da = new Date(`${a.date}T${a.time || '00:00'}`);
        const db = new Date(`${b.date}T${b.time || '00:00'}`);
        return db - da;
    });

    if (displayData.length === 0) {
        historyBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No records found for selected period</td></tr>`;
        return;
    }

    displayData.forEach(row => {
        const tr = document.createElement("tr");
        const status = (row.status || "Done").toLowerCase();
        
        // Dynamic Row Highlighting
        if (status === "skipped") tr.classList.add("missed-workout");
        if (status === "rest") tr.classList.add("rest-day");

        const displayStatus = (row.status || "Done").toUpperCase();
        
        // Process workout type string
        let workoutDisp = "--";
        if (status === 'done') workoutDisp = (row.type || row.workout || "--");
        else if (status === 'rest') workoutDisp = "Rest Day 💤";
        else workoutDisp = "Skipped ❌";

        tr.innerHTML = `
            <td>${row.date}</td>
            <td><span class="status-badge ${status}">${displayStatus}</span></td>
            <td>${workoutDisp}</td>
            <td>${row.weight}</td>
            <td>${status === 'done' ? formatTime12h(row.time) : "--:--"}</td>
            <td>${row.cheatMeal}</td>
        `;
        historyBody.appendChild(tr);
    });
}

// Add history filter listener
const historyRangeSelect = document.getElementById('historyRange');
if (historyRangeSelect) {
    historyRangeSelect.addEventListener('change', () => {
        renderTable();
        renderWorkoutStatsChart();
        renderChart(); // Global sync
    });
}

function renderWorkoutStatsChart() {
    const canvas = document.getElementById("workoutStatsChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (workoutStatsChartInstance) {
        workoutStatsChartInstance.destroy();
    }

    const filteredData = getFilteredData();
    if (filteredData.length === 0) return;

    // Aggregate status and types (EXCLUDE Rest Days from workout distribution)
    const stats = {};
    filteredData.forEach(row => {
        const status = (row.status || "Done").toLowerCase();
        if (status === "rest") return; // Skip rest days in Activity breakdown

        if (status === "skipped") {
            stats["Skipped"] = (stats["Skipped"] || 0) + 1;
        } else {
            const type = row.type || row.workout || "Other";
            stats[type] = (stats[type] || 0) + 1;
        }
    });

    const labels = Object.keys(stats);
    const data = Object.values(stats);

    // Original Instagram-Inspired Palette
    const colorMap = {
        'Gym': '#e1306c',
        'Running': '#fbad50',
        'Swimming': '#405de6',
        'Badminton': '#833ab4',
        'Tennis': '#58C322',
        'Skipped': '#ed4956',
        'Other': '#8e8e8e'
    };

    const backgroundColors = labels.map(label => colorMap[label] || `hsl(${Math.random() * 360}, 70%, 60%)`);

    workoutStatsChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: getComputedStyle(document.body).getPropertyValue('--text-main').trim(),
                        padding: 15,
                        font: { size: 12, weight: '500' },
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14 },
                    bodyFont: { size: 14 }
                }
            }
        }
    });
}

// -----------------------------------------------------
// Charting Logic (Chart.js)
// -----------------------------------------------------
const filterBtns = document.querySelectorAll(".filter-btn");

filterBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
        filterBtns.forEach(b => b.classList.remove("active"));
        e.target.classList.add("active");
        renderChart(e.target.dataset.filter);
    });
});

function renderChart() {
    const ctx = document.getElementById("weightChart").getContext("2d");

    if (chartInstance) {
        chartInstance.destroy();
    }

    const filteredData = getFilteredData();
    if (filteredData.length === 0) return;

    // Use current range from filtered data
    const labels = filteredData.map(d => d.date);
    const dataPoints = filteredData.map(d => d.weight);

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Body Weight (kg)',
                data: dataPoints,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                borderWidth: 2,
                pointBackgroundColor: '#ec4899',
                pointRadius: 4,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: 'rgba(200, 200, 200, 0.2)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

// -----------------------------------------------------
// Optional Features
// -----------------------------------------------------
document.getElementById("logStatus").addEventListener("change", (e) => {
    const val = e.target.value;
    // Hide details if it's not a completed workout
    document.getElementById("workoutDetailsGroup").classList.toggle("hidden", val === "Skipped" || val === "Rest");
});

document.getElementById("logCheat").addEventListener("change", (e) => {
    document.getElementById("cheatMealInputGroup").classList.toggle("hidden", !e.target.checked);
});

document.getElementById("showBmi").addEventListener("change", (e) => {
    document.getElementById("bmiInputs").classList.toggle("hidden", !e.target.checked);
});

document.getElementById("logHeight").addEventListener("input", calculateBMI);
document.getElementById("logWeight").addEventListener("input", calculateBMI);

function calculateBMI() {
    const h = parseFloat(document.getElementById("logHeight").value);
    const w = parseFloat(document.getElementById("logWeight").value);
    const res = document.getElementById("bmiResult");

    if (h > 0 && w > 0) {
        const heightM = h / 100;
        const bmi = (w / (heightM * heightM)).toFixed(1);
        let status = "Normal";
        let color = "var(--success-color)";
        if (bmi < 18.5) { status = "Underweight"; color = "var(--secondary-color)"; }
        else if (bmi >= 25 && bmi < 29.9) { status = "Overweight"; color = "orange"; }
        else if (bmi >= 30) { status = "Obese"; color = "var(--danger-color)"; }

        res.innerHTML = `BMI: <span style="color:${color}">${bmi} (${status})</span>`;
    } else {
        res.innerHTML = "";
    }
}

// -----------------------------------------------------
// Profile Management
// -----------------------------------------------------
function updateProfileStats() {
    if (!currentUser) return;
    const profile = JSON.parse(localStorage.getItem(`profile_${currentUser}`)) || {
        height: "--", age: "--", gender: "--"
    };

    const hEl = document.getElementById("profileHeight");
    const aEl = document.getElementById("profileAge");
    const gEl = document.getElementById("profileGender");

    if (hEl) hEl.textContent = profile.height || "--";
    if (aEl) aEl.textContent = profile.age || "--";

    // Format Gender as M/F (first character uppercase)
    if (gEl) {
        let genderVal = (profile.gender || "--").trim();
        gEl.textContent = genderVal !== "--" ? genderVal.at(0).toUpperCase() : "--";
    }
}

// Ensure profile displays on load if logged in
if (currentUser) {
    updateProfileStats();
}

document.getElementById("exportCsvBtn").addEventListener("click", () => {
    const exportData = getFilteredData();
    if (exportData.length === 0) return showToast("No data to export", true);

    let csvContent = "data:text/csv;charset=utf-8,Date,Status,Workout,Weight,Time,CheatMeal\n";
    // Sort chronological for export
    exportData.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(row => {
        csvContent += `${row.date},${row.status || "Done"},${row.type || row.workout || ""},${row.weight},${row.time || ""},${row.cheatMeal}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `workout_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});
