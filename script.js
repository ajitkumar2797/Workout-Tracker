// -----------------------------------------------------
// Configuration & State
// -----------------------------------------------------

// TODO: Replace this URL with your deployed Google Apps Script Web App URL
const API_URL = "https://script.google.com/macros/s/AKfycbyOzzGfT37V1oRmhPoDbQtby4T3_QVCeH_S9xcAi1qAqrsPaG9Usz79IrJaRH5K35G8hQ/exec";

// Authentication is securely handled backend via Google Sheets 'Credentials' tab.

let currentUser = localStorage.getItem("workout_user") || null;
let currentData = [];
let chartInstance = null;

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

// Set default date and time to today
document.getElementById("logDate").valueAsDate = new Date();
const now = new Date();
document.getElementById("logTime").value = now.toTimeString().slice(0, 5);

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
            showDashboard(realUser);
        } else {
            err.textContent = "Invalid username or PIN.";
        }
    } catch (error) {
        err.textContent = "Network error. Could not verify.";
    } finally {
        document.querySelector("button[type='submit']").disabled = false;
    }
});

logoutBtn.addEventListener("click", () => {
    currentUser = null;
    localStorage.removeItem("workout_user");
    currentData = [];
    loginContainer.classList.remove("hidden");
    dashboardContainer.classList.add("hidden");
    logoutBtn.classList.add("hidden");
    welcomeMessage.classList.add("hidden");
    document.getElementById("username").value = "";
    document.getElementById("pin").value = "";
});

function showDashboard(user) {
    loginContainer.classList.add("hidden");
    dashboardContainer.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
    welcomeMessage.textContent = `Hello, ${user}!`;
    welcomeMessage.classList.remove("hidden");
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
    const type = document.getElementById("logType").value;
    const cheat = document.getElementById("logCheat").checked ? "Yes" : "No";

    const payload = {
        user: currentUser,
        date, time, weight, type, cheatMeal: cheat
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
    // Sort data chronologically 
    currentData.sort((a, b) => new Date(a.date) - new Date(b.date));

    renderTable();
    updateStats();
    renderChart("daily");
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
    document.getElementById("totalChange").textContent = diff > 0 ? `+${diff}` : diff;

    // Totals & Completion
    const uniqueDates = [...new Set(currentData.map(d => d.date))];
    const totalDays = uniqueDates.length;
    let completion = totalDays > 0 ? 100 : 0; // Since every logged dataset implies completion

    document.getElementById("totalDaysValue").textContent = totalDays;
    document.getElementById("completionValue").textContent = completion;

    // Streak Calculation (unique consecutive days backward from latest log)
    let streak = 0;
    if (uniqueDates.length > 0) {
        uniqueDates.sort((a, b) => new Date(a) - new Date(b));
        streak = 1;
        for (let i = uniqueDates.length - 1; i > 0; i--) {
            const curr = new Date(uniqueDates[i]);
            const prev = new Date(uniqueDates[i - 1]);
            const diffTime = Math.abs(curr - prev);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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

function renderTable() {
    historyBody.innerHTML = "";
    // Display in reverse chronological order
    const displayData = [...currentData].reverse();

    displayData.forEach(row => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${row.date}</td>
            <td>${row.weight}</td>
            <td>${row.time || "--:--"}</td>
            <td>${row.type || "Undefined"}</td>
            <td>${row.cheatMeal}</td>
        `;
        historyBody.appendChild(tr);
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

function renderChart(filterType) {
    const ctx = document.getElementById("weightChart").getContext("2d");

    if (chartInstance) {
        chartInstance.destroy();
    }

    if (currentData.length === 0) return;

    let labels = [];
    let dataPoints = [];

    if (filterType === "daily") {
        labels = currentData.map(d => d.date);
        dataPoints = currentData.map(d => d.weight);
    } else {
        // Grouping logic for Weekly / Monthly
        const grouped = {};
        currentData.forEach(d => {
            const dateObj = new Date(d.date);
            let key;
            if (filterType === "weekly") {
                // ISO week approximation for chart grouping
                const year = dateObj.getFullYear();
                const week = Math.ceil((dateObj.getDate() - dateObj.getDay() + 1) / 7);
                key = `${year}-W${week}`;
            } else {
                key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
            }
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(d.weight);
        });

        labels = Object.keys(grouped);
        dataPoints = labels.map(k => {
            const sum = grouped[k].reduce((a, b) => a + b, 0);
            return (sum / grouped[k].length).toFixed(1);
        });
    }

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
// Optional Features: BMI & CSV Export
// -----------------------------------------------------
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

document.getElementById("exportCsvBtn").addEventListener("click", () => {
    if (currentData.length === 0) return showToast("No data to export", true);

    let csvContent = "data:text/csv;charset=utf-8,Date,Time,Weight,Type,CheatMeal\n";
    currentData.forEach(row => {
        csvContent += `${row.date},${row.time || ""},${row.weight},${row.type || ""},${row.cheatMeal}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `workout_data_${currentUser}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});
