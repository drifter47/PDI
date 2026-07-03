// --- State & Mock Data ---
const IS_ANDROID_STANDALONE = true;


// Pre-defined Plant manifest database of vehicles that can arrive from the plant
const PLANT_MANIFEST = [
    { vin: "MA3XXA7B1KG102948", model: "XUV700 AX7 L", color: "Everest White", engine: "mStallion 2.0 TGDi", trans: "Automatic" },
    { vin: "MA3XXT3C4KG203849", model: "Thar ROXX AX7L", color: "Deep Forest", engine: "mHawk 2.2 mHEV", trans: "Manual" },
    { vin: "MA3XXS5D8KG304721", model: "Scorpio-N Z8L", color: "Napoli Black", engine: "mHawk 2.2 Diesel", trans: "Automatic" },
    { vin: "MA3XXB2A5KG405839", model: "XUV 3XO AX5L", color: "Rage Red", engine: "mStallion 1.2 TGDi", trans: "Automatic" },
    { vin: "MA3XXN6F9KG506924", model: "Bolero Neo N10", color: "Dazzling Silver", engine: "mHawk 100", trans: "Manual" },
    { vin: "MA3XXT2C3KG708910", model: "Thar LX 4x4", color: "Red Rage", engine: "mStallion 2.0 TGDi", trans: "Automatic" },
    { vin: "MA3XXS8E1KG809123", model: "Scorpio Classic S11", color: "Pearl White", engine: "mHawk 2.2 Diesel", trans: "Manual" },
    { vin: "MA3XXA5B9KG901234", model: "XUV700 AX5", color: "Midnight Black", engine: "mHawk 2.2 Diesel", trans: "Automatic" },
    { vin: "MA3XXB1C2KG409581", model: "XUV 3XO MX3", color: "Nebula Blue", engine: "mStallion 1.2 TGDi", trans: "Manual" },
    { vin: "MA3XXT7E6KG501938", model: "Thar ROXX MX5", color: "Everest White", engine: "mHawk 2.2 Diesel", trans: "Manual" },
    { vin: "MA3XXEV1AKG601928", model: "XUV400 EV EL Pro", color: "Infinity Blue", engine: "Electric Motor (110 kW)", trans: "Automatic" },
    { vin: "MA3XXEV2BKG702849", model: "BE 6e EV L1", color: "Electro Silver", engine: "Electric Motor (150 kW)", trans: "Automatic" },
    { vin: "MA3XXC1A5KG301938", model: "Bolero Pik-Up FB", color: "Dazzling Silver", engine: "m2DiCR 2.5L", trans: "Manual" },
    { vin: "MA3XXC2B6KG402849", model: "Mahindra Furio 7", color: "Rage Red", engine: "mDiTech 3.5L", trans: "Manual" }
];

// Active State
let state = {
    currentView: "dashboard",
    currentYard: "beach",
    vehicles: [],          // Complete database of vehicles in showroom/yards
    selectedDamagePoints: [], // Transient state for current form damage plot points
    currentUploadedPhotos: [], // Transient state for current form uploaded base64 photos
    selectedBayId: null,      // Selected slot in the yard manager
    selectedYardId: null,
    activeVehicleForPDI: null  // If editing/checking from the yard grid
};

// Yard Grid Specifications
let yardSpecs = {
    beach: { name: "Beach Yard", rows: 6, cols: 8, capacity: 48 },
    bhima: { name: "Bhima Yard", rows: 5, cols: 10, capacity: 50 },
    showroom: { name: "Showroom Yard", rows: 4, cols: 4, capacity: 16 }
};

async function loadYardSpecs() {
    if (IS_ANDROID_STANDALONE) {
        const cachedSpecs = localStorage.getItem("mahindra_pdi_yard_specs");
        if (cachedSpecs) {
            yardSpecs = JSON.parse(cachedSpecs);
        } else {
            // Keep default specs initialized on top
            localStorage.setItem("mahindra_pdi_yard_specs", JSON.stringify(yardSpecs));
        }
        return;
    }
    try {
        const res = await fetch('/api/yard-specs');
        yardSpecs = await res.json();
    } catch (err) {
        console.error("Failed to load yard specs from server:", err);
    }
}

async function saveYardSpecs() {
    if (IS_ANDROID_STANDALONE) {
        localStorage.setItem("mahindra_pdi_yard_specs", JSON.stringify(yardSpecs));
        return;
    }
    try {
        await fetch('/api/yard-specs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(yardSpecs)
        });
    } catch (err) {
        console.error("Failed to save yard specs to server:", err);
    }
}


// Initial Mock Vehicles
const INITIAL_VEHICLES = [];

async function checkConnectionStatus() {
    const statusText = document.querySelector(".connection-status-indicator .status-text");
    const indicator = document.getElementById("connection-status");
    
    if (IS_ANDROID_STANDALONE) {
        if (indicator) {
            indicator.className = "connection-status-indicator online";
            if (statusText) statusText.textContent = "Local Database";
        }
        return false; // Return false to bypass any other API fetch attempts
    }
    
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 2000);
        const res = await fetch('/api/vehicles', { method: 'GET', signal: controller.signal });
        clearTimeout(id);
        
        if (res.ok) {
            if (indicator) {
                indicator.className = "connection-status-indicator online";
                if (statusText) statusText.textContent = "Online";
            }
            return true;
        }
        throw new Error("HTTP error");
    } catch (err) {
        if (indicator) {
            indicator.className = "connection-status-indicator offline";
            if (statusText) statusText.textContent = "Offline (Cached)";
        }
        return false;
    }
}


// --- App Initialization ---
document.addEventListener("DOMContentLoaded", async () => {
    await loadYardSpecs();
    await loadState();
    setupNavigation();
    setupDashboard();
    setupYardVisualizer();
    setupInspectionForm();
    setupRegistry();
    setupModals();
    setupChecklistPage();
    updateDashboardStats();
    
    // Initial connection check and keep-alive intervals
    await checkConnectionStatus();
    setInterval(checkConnectionStatus, 10000);
});

async function loadState() {
    if (IS_ANDROID_STANDALONE) {
        loadFromLocalStorage();
        return;
    }
    const isOnline = await checkConnectionStatus();
    if (isOnline) {
        try {
            const res = await fetch('/api/vehicles');
            state.vehicles = await res.json();
            localStorage.setItem("mahindra_pdi_vehicles", JSON.stringify(state.vehicles));
        } catch (err) {
            console.error("Failed to load vehicles from server, falling back to cache:", err);
            loadFromLocalStorage();
        }
    } else {
        loadFromLocalStorage();
    }
}

function loadFromLocalStorage() {
    const cached = localStorage.getItem("mahindra_pdi_vehicles");
    if (cached) {
        state.vehicles = JSON.parse(cached);
        showToast("Loaded data from offline browser cache.");
    } else {
        state.vehicles = [];
    }
}

async function saveState() {
    localStorage.setItem("mahindra_pdi_vehicles", JSON.stringify(state.vehicles));
    
    if (IS_ANDROID_STANDALONE) {
        return;
    }
    
    const isOnline = await checkConnectionStatus();
    if (isOnline) {
        try {
            const res = await fetch('/api/vehicles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state.vehicles)
            });
            if (!res.ok) throw new Error("Failed response");
        } catch (err) {
            console.error("Failed to save vehicles to server, kept in local storage:", err);
            showToast("Server offline. Inspection saved to browser storage.");
        }
    } else {
        showToast("Server offline. Inspection saved to browser storage.");
    }
}


// --- Navigation Controller ---
function setupNavigation() {
    const navItems = document.querySelectorAll(".sidebar-nav .nav-item");
    const views = document.querySelectorAll(".content-view");
    const pageTitle = document.getElementById("page-title");
    const pageSubtitle = document.getElementById("page-subtitle");

    function switchView(targetViewId) {
        views.forEach(v => v.classList.remove("active"));
        navItems.forEach(item => item.classList.remove("active"));

        const viewToShow = document.getElementById(`view-${targetViewId}`);
        const activeNav = document.getElementById(`nav-${targetViewId}`);

        if (viewToShow) viewToShow.classList.add("active");
        if (activeNav) activeNav.classList.add("active");

        state.currentView = targetViewId;

        // Header Titles update
        switch (targetViewId) {
            case "dashboard":
                pageTitle.textContent = "Dashboard";
                pageSubtitle.textContent = "Real-time overview of arrivals and PDI statuses";
                updateDashboardStats();
                renderRecentArrivalsTable();
                break;
            case "yards":
                pageTitle.textContent = "Yard Visualizer";
                pageSubtitle.textContent = "Visual map and bay allocator for vehicles";
                renderYardGrid();
                break;
            case "inspections":
                pageTitle.textContent = "New Inspection Form";
                pageSubtitle.textContent = "Carry out a complete pre-delivery checks";
                break;
            case "vehicles":
                pageTitle.textContent = "Vehicle Registry";
                pageSubtitle.textContent = "Search, review, and print reports of all PDI vehicle checks";
                renderRegistryTable();
                break;
            case "checklist":
                pageTitle.textContent = "PDI Reference Checklist";
                pageSubtitle.textContent = "Complete standard and EV technician verification checklist";
                renderChecklistPage();
                break;
        }
    }

    // Bind sidebar clicks
    navItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const viewId = item.id.replace("nav-", "");
            switchView(viewId);
            window.location.hash = viewId;
        });
    });

    // Handle Quick PDI button
    document.getElementById("btn-quick-inspect").addEventListener("click", () => {
        resetInspectionForm();
        switchView("inspections");
        window.location.hash = "inspections";
    });

    // Handle hash on load
    if (window.location.hash) {
        const hashView = window.location.hash.substring(1);
        if (["dashboard", "yards", "inspections", "vehicles", "checklist"].includes(hashView)) {
            switchView(hashView);
        }
    }

    // Setup mobile drawer menu toggle
    const toggleBtn = document.getElementById("mobile-menu-toggle");
    const sidebar = document.querySelector(".sidebar");
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener("click", () => {
            sidebar.classList.toggle("open");
        });
        
        // Close sidebar drawer when clicking a navigation link
        navItems.forEach(item => {
            item.addEventListener("click", () => {
                sidebar.classList.remove("open");
            });
        });
    }
}

// --- Dashboard Module ---
function setupDashboard() {
    // Simulator Button
    document.getElementById("btn-mock-delivery").addEventListener("click", () => {
        simulateNewPlantDelivery();
    });

    renderRecentArrivalsTable();
}

function updateDashboardStats() {
    const total = state.vehicles.length;
    const pending = state.vehicles.filter(v => v.status === "Pending PDI").length;
    const passed = state.vehicles.filter(v => v.status === "Passed").length;
    const failed = state.vehicles.filter(v => v.status === "Failed").length;
    const delivered = state.vehicles.filter(v => v.status === "Delivered").length;

    // Numbers
    document.getElementById("stat-total").textContent = total;
    document.getElementById("stat-pending").textContent = pending;
    document.getElementById("stat-passed").textContent = passed;
    document.getElementById("stat-failed").textContent = failed;
    document.getElementById("stat-delivered").textContent = delivered;

    // Yard ratios
    Object.keys(yardSpecs).forEach(yardKey => {
        const capacity = yardSpecs[yardKey].capacity;
        const occupied = state.vehicles.filter(v => v.yard === yardKey).length;
        const pct = (occupied / capacity) * 100;
        
        document.getElementById(`occupancy-${yardKey}-text`).textContent = `${occupied}/${capacity} spots`;
        document.getElementById(`occupancy-${yardKey}-bar`).style.width = `${pct}%`;
    });
}

function renderRecentArrivalsTable() {
    const tbody = document.querySelector("#table-recent-arrivals tbody");
    tbody.innerHTML = "";

    // Show recent 5 sorted by date (newest first)
    const sorted = [...state.vehicles].sort((a,b) => new Date(b.arrivalDate) - new Date(a.arrivalDate)).slice(0, 5);

    if (sorted.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No vehicles in database</td></tr>`;
        return;
    }

    sorted.forEach(car => {
        const tr = document.createElement("tr");
        const statusBadge = getStatusBadgeHTML(car.status);
        const yardName = yardSpecs[car.yard] ? yardSpecs[car.yard].name : "Not Assigned";
        const bayVal = car.bay ? `${yardName} (Bay ${car.bay})` : "Unassigned";

        tr.innerHTML = `
            <td><strong>${car.model}</strong></td>
            <td><code style="font-family:monospace; font-weight:600;">${car.vin}</code></td>
            <td>${car.color}</td>
            <td>${bayVal}</td>
            <td>${statusBadge}</td>
            <td>
                ${car.status === "Pending PDI" 
                    ? `<button class="btn btn-primary btn-sm btn-action-inspect" data-vin="${car.vin}">Inspect</button>` 
                    : `<button class="btn btn-secondary btn-sm btn-action-view" data-vin="${car.vin}">View Report</button>`}
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Bind action clicks
    tbody.querySelectorAll(".btn-action-inspect").forEach(btn => {
        btn.addEventListener("click", () => {
            const vin = btn.getAttribute("data-vin");
            startPDIForVehicle(vin);
        });
    });

    tbody.querySelectorAll(".btn-action-view").forEach(btn => {
        btn.addEventListener("click", () => {
            const vin = btn.getAttribute("data-vin");
            showVehicleDetails(vin);
        });
    });
}

function getStatusBadgeHTML(status) {
    if (status === "Passed") return `<span class="badge badge-success"><i class="fa-solid fa-check"></i> Passed</span>`;
    if (status === "Failed") return `<span class="badge badge-failed"><i class="fa-solid fa-triangle-exclamation"></i> Repair</span>`;
    if (status === "Delivered") return `<span class="badge" style="background-color: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.2);"><i class="fa-solid fa-truck-fast"></i> Delivered</span>`;
    return `<span class="badge badge-pending"><i class="fa-solid fa-hourglass-half"></i> Pending</span>`;
}

function simulateNewPlantDelivery() {
    // Pick a random manifest car that isn't already in the local registry
    const existingVins = state.vehicles.map(v => v.vin);
    const availableManifest = PLANT_MANIFEST.filter(m => !existingVins.includes(m.vin));

    if (availableManifest.length === 0) {
        alert("All mock manifest vehicles are already delivered to showroom.");
        return;
    }

    const randomManifest = availableManifest[Math.floor(Math.random() * availableManifest.length)];
    const today = new Date().toISOString().split("T")[0];

    const newCar = {
        vin: randomManifest.vin,
        model: randomManifest.model,
        color: randomManifest.color,
        yard: "", // Unassigned yard
        bay: "",  // Unassigned bay
        status: "Pending PDI",
        arrivalDate: today,
        checklist: {},
        defects: [],
        photos: []
    };
    newCar.checklist = getVehicleChecklist(newCar);

    state.vehicles.push(newCar);
    saveState();
    updateDashboardStats();
    renderRecentArrivalsTable();
    
    // Smooth Notification toast
    showToast(`New ${randomManifest.model} (${randomManifest.color}) arrived from Plant! VIN matched.`);
}

function showToast(message) {
    // Simple custom notification element
    const toast = document.createElement("div");
    toast.className = "toast-message";
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background-color: var(--bg-sidebar);
        border-left: 4px solid var(--mahindra-red);
        color: var(--text-primary);
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 12px;
        animation: toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        font-weight: 500;
    `;
    toast.innerHTML = `<i class="fa-solid fa-circle-info" style="color: var(--mahindra-red);"></i> <span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = "toastOut 0.3s ease forwards";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Add animation rules to page
const styleEl = document.createElement("style");
styleEl.textContent = `
    @keyframes toastIn { from { transform: translateY(50px) scale(0.9); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
    @keyframes toastOut { from { transform: translateY(0) scale(1); opacity: 1; } to { transform: translateY(20px) scale(0.9); opacity: 0; } }
    .toast-message { transition: transform 0.3s, opacity 0.3s; }
`;
document.head.appendChild(styleEl);

// --- Yard Visualizer Module ---
function setupYardVisualizer() {
    const tabButtons = document.querySelectorAll("#yard-tab-switcher .tab-btn");
    
    // Dynamically update tab labels based on configured dimensions
    tabButtons.forEach(btn => {
        const yardKey = btn.getAttribute("data-yard");
        const spec = yardSpecs[yardKey];
        let iconClass = "fa-umbrella-beach";
        if (yardKey === "bhima") iconClass = "fa-mountain";
        if (yardKey === "showroom") iconClass = "fa-store";
        btn.innerHTML = `<i class="fa-solid ${iconClass}"></i> ${spec.name} (${spec.rows} &times; ${spec.cols})`;
        
        btn.addEventListener("click", () => {
            tabButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            state.currentYard = btn.getAttribute("data-yard");
            renderYardGrid();
        });
    });

    // Configure Layout button click listener
    document.getElementById("btn-config-yard-layout").addEventListener("click", () => {
        openYardConfigModal();
    });

    renderYardGrid();
}

function openYardConfigModal() {
    const yardKey = state.currentYard;
    const spec = yardSpecs[yardKey];

    const title = `<i class="fa-solid fa-gears"></i> Configure ${spec.name} Grid`;
    
    const bodyHTML = `
        <p style="margin-bottom:16px; color:var(--text-secondary);">Set the grid dimensions for <strong>${spec.name}</strong>. The capacity will automatically calculate.</p>
        <div class="form-grid" style="margin-bottom:20px;">
            <div class="input-field">
                <label for="config-rows">Number of Rows (A, B, C...)</label>
                <input type="number" id="config-rows" value="${spec.rows}" min="1" max="15" style="padding:12px; background-color:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:8px; outline:none;">
            </div>
            <div class="input-field">
                <label for="config-cols">Number of Columns (1, 2, 3...)</label>
                <input type="number" id="config-cols" value="${spec.cols}" min="1" max="20" style="padding:12px; background-color:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:8px; outline:none;">
            </div>
        </div>
        <div style="padding:12px; background-color:rgba(239, 68, 68, 0.08); border:1px solid rgba(239, 68, 68, 0.2); border-radius:8px; color:var(--status-failed); font-size:0.8rem; display:flex; gap:8px; align-items:flex-start;">
            <i class="fa-solid fa-circle-exclamation" style="margin-top:2px;"></i>
            <span><strong>Warning:</strong> Shrinking the grid dimensions will displace any vehicles parked in bays that are cut off (e.g. beyond the new row or column limits). Displaced vehicles will be moved to "Unassigned" status.</span>
        </div>
    `;

    const footerHTML = `
        <button class="btn btn-secondary" onclick="closeSlotModal()">Cancel</button>
        <button class="btn btn-primary" id="btn-save-yard-config">Save Grid Layout</button>
    `;

    openSlotModal(title, bodyHTML, footerHTML);

    document.getElementById("btn-save-yard-config").addEventListener("click", () => {
        const newRows = parseInt(document.getElementById("config-rows").value);
        const newCols = parseInt(document.getElementById("config-cols").value);

        if (isNaN(newRows) || newRows < 1 || newRows > 15 || isNaN(newCols) || newCols < 1 || newCols > 20) {
            alert("Please enter valid rows (1-15) and columns (1-20).");
            return;
        }

        // Apply grid change
        const oldRows = spec.rows;
        const oldCols = spec.cols;
        
        spec.rows = newRows;
        spec.cols = newCols;
        spec.capacity = newRows * newCols;

        // Check for displaced vehicles in this yard
        let displacedCount = 0;
        state.vehicles.forEach(v => {
            if (v.yard === yardKey && v.bay) {
                const parts = v.bay.split('-');
                const rChar = parts[0];
                const colNum = parseInt(parts[1]);
                
                const rowIndex = rChar.charCodeAt(0) - 65; // A = 0
                if (rowIndex >= newRows || colNum > newCols) {
                    v.yard = "";
                    v.bay = "";
                    displacedCount++;
                }
            }
        });

        saveYardSpecs();
        saveState();
        closeSlotModal();

        // Dynamically update the tab buttons' display names
        const tabBtn = document.querySelector(`#yard-tab-switcher .tab-btn[data-yard="${yardKey}"]`);
        if (tabBtn) {
            let iconClass = "fa-umbrella-beach";
            if (yardKey === "bhima") iconClass = "fa-mountain";
            if (yardKey === "showroom") iconClass = "fa-store";
            tabBtn.innerHTML = `<i class="fa-solid ${iconClass}"></i> ${spec.name} (${newRows} &times; ${newCols})`;
        }

        renderYardGrid();
        updateDashboardStats();

        let msg = `Updated ${spec.name} layout to ${newRows}x${newCols} (${spec.capacity} bays).`;
        if (displacedCount > 0) {
            msg += ` ${displacedCount} vehicle(s) relocated to unassigned parking due to layout shrinkage.`;
        }
        showToast(msg);
    });
}

function renderYardGrid() {
    const grid = document.getElementById("yard-visual-grid");
    const currentYardTitle = document.getElementById("current-yard-title");
    const capLabel = document.getElementById("current-yard-capacity");
    const occLabel = document.getElementById("current-yard-occupied");

    const spec = yardSpecs[state.currentYard];
    currentYardTitle.innerHTML = `<i class="fa-solid fa-parking"></i> ${spec.name}`;
    capLabel.textContent = `Capacity: ${spec.capacity} Bays`;

    const occupiedCount = state.vehicles.filter(v => v.yard === state.currentYard).length;
    occLabel.textContent = `Occupied: ${occupiedCount}`;

    // Calculate grid columns dynamically
    grid.style.gridTemplateColumns = `repeat(${spec.cols}, 1fr)`;
    grid.innerHTML = "";

    // Generate Bays A-1, A-2... B-1...
    for (let r = 0; r < spec.rows; r++) {
        const rowChar = String.fromCharCode(65 + r); // A, B, C...
        for (let c = 1; c <= spec.cols; c++) {
            const bayId = `${rowChar}-${c}`;
            
            // Check if there's a vehicle in this bay in the active yard
            const vehicle = state.vehicles.find(v => v.yard === state.currentYard && v.bay === bayId);
            
            const slotEl = document.createElement("div");
            slotEl.className = "grid-slot";
            slotEl.setAttribute("data-bay-id", bayId);
            
            if (vehicle) {
                // Determine styling class based on inspection status
                let statusClass = "status-pending";
                if (vehicle.status === "Passed") statusClass = "status-passed";
                if (vehicle.status === "Failed") statusClass = "status-failed";

                slotEl.classList.add("occupied", statusClass);
                
                // Set inner contents
                slotEl.innerHTML = `
                    <div class="slot-id">${bayId}</div>
                    <div class="slot-badge ${vehicle.status.toLowerCase().replace(" ", "-")}"></div>
                    <div class="slot-car-info">
                        <span class="slot-car-model">${vehicle.model}</span>
                        <span class="slot-car-vin">${vehicle.vin.substring(0, 5)}...${vehicle.vin.substring(13)}</span>
                    </div>
                `;

                // Handle clicking occupied slot
                slotEl.addEventListener("click", () => {
                    handleOccupiedSlotClick(vehicle, bayId);
                });
            } else {
                slotEl.classList.add("empty-bay");
                slotEl.innerHTML = `
                    <div class="slot-id">${bayId}</div>
                    <div style="font-size:0.65rem; color:var(--text-muted); align-self:center;">EMPTY</div>
                `;

                // Handle clicking empty slot
                slotEl.addEventListener("click", () => {
                    handleEmptySlotClick(bayId);
                });
            }
            grid.appendChild(slotEl);
        }
    }
}

// --- Action Modals & Dialogs for Yard slots ---
const slotModal = document.getElementById("modal-slot-action");

function openSlotModal(title, bodyHTML, footerHTML) {
    document.getElementById("modal-slot-title").innerHTML = title;
    document.getElementById("modal-slot-body").innerHTML = bodyHTML;
    document.getElementById("modal-slot-footer").innerHTML = footerHTML;
    slotModal.classList.add("active");
}

function closeSlotModal() {
    slotModal.classList.remove("active");
}

// Click empty slot: allows assigning a vehicle that doesn't have a bay assigned
function handleEmptySlotClick(bayId) {
    const unassignedVehicles = state.vehicles.filter(v => !v.yard || !v.bay);

    const title = `Manage Bay ${bayId} - ${yardSpecs[state.currentYard].name}`;

    let bodyHTML = `
        <p style="margin-bottom:16px; color:var(--text-secondary);">This parking bay is currently empty. You can assign an arriving vehicle to this slot.</p>
    `;

    if (unassignedVehicles.length === 0) {
        bodyHTML += `
            <div style="padding:16px; background-color:rgba(255,255,255,0.03); border-radius:8px; text-align:center; color:var(--text-secondary);">
                <i class="fa-solid fa-truck-ramp-box" style="font-size:1.5rem; margin-bottom:8px; display:block; color:var(--text-muted);"></i>
                No unassigned vehicles. All arrived vehicles are currently parked. 
                Use <strong>Simulate Delivery</strong> on the dashboard to bring in new vehicles.
            </div>
        `;
        openSlotModal(title, bodyHTML, `<button class="btn btn-secondary" onclick="closeSlotModal()">Close</button>`);
    } else {
        bodyHTML += `
            <div class="input-field">
                <label for="assign-vehicle-select">Select Vehicle to park in ${bayId}</label>
                <select id="assign-vehicle-select" style="width:100%; padding:12px; background-color:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:8px; outline:none;">
                    ${unassignedVehicles.map(v => `<option value="${v.vin}">${v.model} (${v.color}) - VIN: ${v.vin}</option>`).join("")}
                </select>
            </div>
        `;
        
        const footerHTML = `
            <button class="btn btn-secondary" onclick="closeSlotModal()">Cancel</button>
            <button class="btn btn-primary" id="btn-confirm-assign">Assign Parking</button>
        `;
        
        openSlotModal(title, bodyHTML, footerHTML);

        document.getElementById("btn-confirm-assign").addEventListener("click", () => {
            const vin = document.getElementById("assign-vehicle-select").value;
            const vehicle = state.vehicles.find(v => v.vin === vin);
            if (vehicle) {
                vehicle.yard = state.currentYard;
                vehicle.bay = bayId;
                saveState();
                closeSlotModal();
                renderYardGrid();
                showToast(`Parked ${vehicle.model} in ${yardSpecs[state.currentYard].name} Bay ${bayId}`);
            }
        });
    }
}

// Click occupied slot: Options to view details, inspect, or move the car
function handleOccupiedSlotClick(vehicle, bayId) {
    const title = `Bay ${bayId} - ${yardSpecs[state.currentYard].name}`;

    const bodyHTML = `
        <div class="assign-car-info">
            <div class="assign-car-title">${vehicle.model}</div>
            <div class="assign-car-vin">VIN: ${vehicle.vin}</div>
            <div class="assign-details-grid">
                <div class="assign-detail-item">
                    <span>Color</span>
                    <span>${vehicle.color}</span>
                </div>
                <div class="assign-detail-item">
                    <span>Inspection</span>
                    <span>${getStatusBadgeHTML(vehicle.status)}</span>
                </div>
            </div>
        </div>
        <p style="margin-bottom:16px; color:var(--text-secondary);">Select the action you want to perform on this vehicle:</p>
    `;

    let footerHTML = `<button class="btn btn-secondary" onclick="closeSlotModal()">Close</button>`;

    if (vehicle.status === "Pending PDI") {
        footerHTML += `<button class="btn btn-primary" id="btn-grid-inspect">Inspect</button>`;
    } else {
        footerHTML += `<button class="btn btn-secondary" id="btn-grid-view">View Report</button>`;
        footerHTML += `
            <button class="btn btn-secondary" id="btn-grid-deliver" style="border-color:var(--status-passed); color:var(--status-passed);">
                <i class="fa-solid fa-truck-fast"></i> Delivered
            </button>
        `;
    }
    
    footerHTML += `
        <button class="btn btn-secondary" id="btn-grid-move" style="border-color:var(--status-pending); color:var(--status-pending);">
            <i class="fa-solid fa-arrows-up-down-left-right"></i> Move Slot
        </button>
    `;

    openSlotModal(title, bodyHTML, footerHTML);

    // Bind dialog click event handlers
    document.getElementById("btn-grid-move").addEventListener("click", () => {
        handleMoveSlotInitiate(vehicle);
    });

    if (document.getElementById("btn-grid-inspect")) {
        document.getElementById("btn-grid-inspect").addEventListener("click", () => {
            closeSlotModal();
            startPDIForVehicle(vehicle.vin);
        });
    }

    if (document.getElementById("btn-grid-view")) {
        document.getElementById("btn-grid-view").addEventListener("click", () => {
            closeSlotModal();
            showVehicleDetails(vehicle.vin);
        });
    }

    if (document.getElementById("btn-grid-deliver")) {
        document.getElementById("btn-grid-deliver").addEventListener("click", () => {
            if (confirm(`Mark ${vehicle.model} [VIN: ${vehicle.vin}] as Delivered? This will remove the vehicle from Bay ${vehicle.bay} and set its status to Delivered.`)) {
                const oldBay = vehicle.bay;
                const oldYard = vehicle.yard;
                vehicle.status = "Delivered";
                vehicle.bay = "";
                vehicle.yard = "";
                saveState();
                closeSlotModal();
                renderYardGrid();
                updateDashboardStats();
                showToast(`Vehicle ${vehicle.model} marked as Delivered and cleared from ${yardSpecs[oldYard].name} Bay ${oldBay}.`);
            }
        });
    }
}

// Initiate Move dialog
function handleMoveSlotInitiate(vehicle) {
    const title = `Relocate ${vehicle.model}`;
    
    // Gather all empty bays across all yards
    let bodyHTML = `
        <p style="margin-bottom:16px; color:var(--text-secondary);">Move this vehicle from <strong>${yardSpecs[vehicle.yard].name} (Bay ${vehicle.bay})</strong> to an empty slot:</p>
        <div class="form-grid" style="grid-template-columns:1fr; gap:16px;">
            <div class="input-field">
                <label for="move-yard-select">Target Yard</label>
                <select id="move-yard-select" style="width:100%; padding:12px; background-color:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:8px; outline:none;">
                    <option value="beach" ${vehicle.yard === "beach" ? "selected" : ""}>Beach Yard</option>
                    <option value="bhima" ${vehicle.yard === "bhima" ? "selected" : ""}>Bhima Yard</option>
                    <option value="showroom" ${vehicle.yard === "showroom" ? "selected" : ""}>Showroom Yard</option>
                </select>
            </div>
            <div class="input-field">
                <label for="move-bay-select">Available Bays</label>
                <select id="move-bay-select" style="width:100%; padding:12px; background-color:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:8px; outline:none;">
                    <!-- Filled by listener -->
                </select>
            </div>
        </div>
    `;

    const footerHTML = `
        <button class="btn btn-secondary" onclick="closeSlotModal()">Cancel</button>
        <button class="btn btn-primary" id="btn-confirm-move">Confirm Relocation</button>
    `;

    openSlotModal(title, bodyHTML, footerHTML);

    const yardSelect = document.getElementById("move-yard-select");
    const baySelect = document.getElementById("move-bay-select");

    function populateEmptyBays(selectedYardKey) {
        baySelect.innerHTML = "";
        const spec = yardSpecs[selectedYardKey];
        
        // Find all bays, then filter out occupied ones
        const occupiedBays = state.vehicles
            .filter(v => v.yard === selectedYardKey)
            .map(v => v.bay);
            
        let optionsHTML = "";
        for (let r = 0; r < spec.rows; r++) {
            const rowChar = String.fromCharCode(65 + r);
            for (let c = 1; c <= spec.cols; c++) {
                const bayId = `${rowChar}-${c}`;
                if (!occupiedBays.includes(bayId)) {
                    optionsHTML += `<option value="${bayId}">Bay ${bayId}</option>`;
                }
            }
        }

        if (optionsHTML === "") {
            baySelect.innerHTML = `<option value="">-- No Empty Bays Available --</option>`;
            document.getElementById("btn-confirm-move").disabled = true;
        } else {
            baySelect.innerHTML = optionsHTML;
            document.getElementById("btn-confirm-move").disabled = false;
        }
    }

    // Populate initial
    populateEmptyBays(yardSelect.value);

    // Watch select changes
    yardSelect.addEventListener("change", () => {
        populateEmptyBays(yardSelect.value);
    });

    document.getElementById("btn-confirm-move").addEventListener("click", () => {
        const targetYard = yardSelect.value;
        const targetBay = baySelect.value;

        if (targetBay) {
            const oldYard = vehicle.yard;
            const oldBay = vehicle.bay;
            vehicle.yard = targetYard;
            vehicle.bay = targetBay;
            saveState();
            closeSlotModal();
            renderYardGrid();
            showToast(`Relocated ${vehicle.model} from ${yardSpecs[oldYard].name} ${oldBay} to ${yardSpecs[targetYard].name} ${targetBay}`);
        }
    });
}


// --- PDI Inspection Form Module ---
function setupInspectionForm() {
    const vinInput = document.getElementById("inspect-vin");
    const verifyBtn = document.getElementById("btn-verify-vin");
    const verifyResult = document.getElementById("vin-verify-result");
    const verifyTitle = document.getElementById("vin-verify-title");
    const verifyDetails = document.getElementById("vin-verify-details");
    const typeSelect = document.getElementById("inspect-type");

    // Manual inputs
    const manualDiv = document.getElementById("manual-vehicle-inputs");
    const manualModel = document.getElementById("inspect-model-manual");
    const manualColor = document.getElementById("inspect-color-manual");

    const yardSelect = document.getElementById("inspect-yard");
    const baySelect = document.getElementById("inspect-bay");

    const steps = [
        document.getElementById("card-step-location"),
        document.getElementById("card-step-checks"),
        document.getElementById("card-step-damage"),
        document.getElementById("card-step-photos"),
        document.getElementById("form-actions-container")
    ];

    // Click Verify VIN
    verifyBtn.addEventListener("click", () => {
        const inputVal = vinInput.value.trim().toUpperCase();
        if (inputVal.length < 5) {
            alert("Please enter a valid VIN number");
            return;
        }

        // Try to match in existing list or plant manifest
        const matched = PLANT_MANIFEST.find(m => m.vin === inputVal) || 
                        state.vehicles.find(v => v.vin === inputVal);

        if (matched) {
            // Hide manual input area
            manualDiv.style.display = "none";

            // Find if it's already registered in our active local yard database
            let existing = state.vehicles.find(v => v.vin === matched.vin);
            
            if (!existing) {
                // If it is in manifest but not in active vehicles registry, add it as a new arrival
                const today = new Date().toISOString().split("T")[0];
                existing = {
                    vin: matched.vin,
                    model: matched.model,
                    color: matched.color,
                    yard: "",
                    bay: "",
                    status: "Pending PDI",
                    arrivalDate: today,
                    checklist: {},
                    defects: [],
                    photos: []
                };
                existing.checklist = getVehicleChecklist(existing);
                state.vehicles.push(existing);
                saveState();
            }

            state.activeVehicleForPDI = existing;

            // Update Verification block styling
            verifyResult.style.display = "flex";
            verifyResult.className = "verification-status match";
            verifyResult.style.borderColor = "";
            verifyResult.style.color = "";
            verifyTitle.textContent = "VIN Verified!";
            verifyDetails.textContent = `${matched.model} (${matched.color}) - Matches Manifest Plant Shipment.`;

            // Enable subsequent form steps
            steps.forEach(step => step.classList.remove("disabled"));
            
            yardSelect.disabled = false;
            baySelect.disabled = false;
            typeSelect.disabled = false;

            // Set type select value
            existing.type = existing.type || (isEV(existing.model) ? "electric" : (isCommercial(existing.model) ? "commercial" : "petrol"));
            typeSelect.value = existing.type;

            // Load values if already assigned
            yardSelect.value = existing.yard || "";
            populateFormBays(existing.yard, existing.bay);

            // Ensure checklist is initialized and render it
            existing.checklist = getVehicleChecklist(existing);
            renderFormChecklist();
            updateLiveInspectionStatus();

            // Populate defect list & SVG markers
            state.selectedDamagePoints = [...existing.defects];
            renderDamageMarkers();
            renderDamageList();

            // Photos Preview
            state.currentUploadedPhotos = [...existing.photos];
            renderPhotoPreviews();

        } else {
            // Not found in plant manifests - Enable Manual verification input
            verifyResult.style.display = "flex";
            verifyResult.className = "verification-status match";
            verifyResult.style.borderColor = "var(--status-pending)";
            verifyResult.style.color = "var(--status-pending)";
            verifyTitle.textContent = "Manual Verification Required";
            verifyDetails.textContent = "VIN not found in plant manifest. Enter details below to register manually.";
            
            // Show manual inputs
            manualDiv.style.display = "block";

            let existing = state.vehicles.find(v => v.vin === inputVal);
            if (!existing) {
                const today = new Date().toISOString().split("T")[0];
                existing = {
                    vin: inputVal,
                    model: "",
                    color: "",
                    yard: "",
                    bay: "",
                    status: "Pending PDI",
                    arrivalDate: today,
                    checklist: {},
                    defects: [],
                    photos: []
                };
                existing.checklist = getVehicleChecklist(existing);
                state.vehicles.push(existing);
                saveState();
            }

            state.activeVehicleForPDI = existing;
            manualModel.value = existing.model || "";
            manualColor.value = existing.color || "";

            // Enable subsequent form steps
            steps.forEach(step => step.classList.remove("disabled"));
            yardSelect.disabled = false;
            baySelect.disabled = false;
            typeSelect.disabled = false;

            // Set type select value
            existing.type = existing.type || (isEV(existing.model) ? "electric" : (isCommercial(existing.model) ? "commercial" : "petrol"));
            typeSelect.value = existing.type;

            // Load values if already assigned
            yardSelect.value = existing.yard || "";
            populateFormBays(existing.yard, existing.bay);

            // Ensure checklist is initialized and render it
            existing.checklist = getVehicleChecklist(existing);
            renderFormChecklist();
            updateLiveInspectionStatus();

            // Populate defect list & SVG markers
            state.selectedDamagePoints = [...existing.defects];
            renderDamageMarkers();
            renderDamageList();

            // Photos Preview
            state.currentUploadedPhotos = [...existing.photos];
            renderPhotoPreviews();
        }
    });

    // Populate bay selection dropdown
    function populateFormBays(yardKey, defaultBay = "") {
        baySelect.innerHTML = '<option value="">-- Select Bay --</option>';
        if (!yardKey) return;

        const spec = yardSpecs[yardKey];
        const occupiedBays = state.vehicles
            .filter(v => v.yard === yardKey && v.vin !== state.activeVehicleForPDI?.vin)
            .map(v => v.bay);

        for (let r = 0; r < spec.rows; r++) {
            const rowChar = String.fromCharCode(65 + r);
            for (let c = 1; c <= spec.cols; c++) {
                const bayId = `${rowChar}-${c}`;
                const isOccupied = occupiedBays.includes(bayId);
                
                const option = document.createElement("option");
                option.value = bayId;
                option.textContent = `Bay ${bayId} ${isOccupied ? '(Occupied)' : '(Available)'}`;
                if (isOccupied) option.disabled = true;
                if (bayId === defaultBay) option.selected = true;

                baySelect.appendChild(option);
            }
        }
    }

    yardSelect.addEventListener("change", () => {
        populateFormBays(yardSelect.value);
    });

    typeSelect.addEventListener("change", () => {
        if (state.activeVehicleForPDI) {
            const oldType = state.activeVehicleForPDI.type;
            const newType = typeSelect.value;
            if (oldType !== newType) {
                state.activeVehicleForPDI.type = newType;
                state.activeVehicleForPDI.checklist = getVehicleChecklist(state.activeVehicleForPDI);
                renderFormChecklist();
                updateLiveInspectionStatus();
            }
        }
    });

    // --- Interactive Damage Plotter ---
    const svgEl = document.getElementById("car-wireframe");
    
    // Bind damage type buttons
    const typeButtons = [
        document.getElementById("btn-damage-scratch"),
        document.getElementById("btn-damage-dent"),
        document.getElementById("btn-damage-other")
    ];
    
    typeButtons.forEach(btn => {
        if (btn) {
            btn.addEventListener("click", () => {
                typeButtons.forEach(b => {
                    if (b) {
                        b.classList.remove("active");
                        b.style.borderColor = "";
                    }
                });
                btn.classList.add("active");
                const type = btn.getAttribute("data-type");
                let color = "var(--status-pending)";
                if (type === "dent") color = "var(--status-failed)";
                if (type === "other") color = "#3b82f6";
                btn.style.borderColor = color;
            });
        }
    });

    svgEl.addEventListener("click", (e) => {
        if (!state.activeVehicleForPDI) return;

        // Get relative coordinates on the SVG element
        const rect = svgEl.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        // Get active damage type
        const activeBtn = document.querySelector(".damage-type-selector .btn.active");
        const type = activeBtn ? activeBtn.getAttribute("data-type") : "scratch";
        
        // Add a point with type
        const index = state.selectedDamagePoints.length + 1;
        let typeName = "Scratch";
        if (type === "dent") typeName = "Dent";
        if (type === "other") typeName = "Issue";

        state.selectedDamagePoints.push({
            x: Math.round(x),
            y: Math.round(y),
            type: type,
            note: `${typeName} #${index} (double click to edit)`
        });

        renderDamageMarkers();
        renderDamageList();
        updateLiveInspectionStatus();
    });

    // Pass All Button handler
    const passAllBtn = document.getElementById("btn-checklist-pass-all");
    if (passAllBtn) {
        passAllBtn.addEventListener("click", () => {
            if (!state.activeVehicleForPDI) return;
            const car = state.activeVehicleForPDI;
            const type = car.type || (isEV(car.model) ? "electric" : (isCommercial(car.model) ? "commercial" : "petrol"));
            const checklistData = PDI_CHECKLIST_DATA[type] || PDI_CHECKLIST_DATA.standard;
            
            const allItems = Object.values(checklistData.categories).flat();
            allItems.forEach(item => {
                car.checklist[item] = "Passed";
            });
            
            updateLiveInspectionStatus();
            renderFormChecklist();
            showToast("All checklist items marked as Passed.");
        });
    }

    // --- Photos Upload handling ---
    const dropZone = document.getElementById("photo-drop-zone");
    const photoInput = document.getElementById("photo-input");

    dropZone.addEventListener("click", () => photoInput.click());
    
    // Drag/Drop visual triggers
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "var(--mahindra-red)";
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.style.borderColor = "rgba(255, 255, 255, 0.15)";
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "rgba(255, 255, 255, 0.15)";
        handleFiles(e.dataTransfer.files);
    });

    photoInput.addEventListener("change", () => {
        handleFiles(photoInput.files);
    });

    function handleFiles(files) {
        Array.from(files).forEach(file => {
            if (!file.type.startsWith("image/")) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                state.currentUploadedPhotos.push(e.target.result);
                renderPhotoPreviews();
            };
            reader.readAsDataURL(file);
        });
    }

    // --- Cancel / Complete buttons ---
    document.getElementById("btn-cancel-inspection").addEventListener("click", () => {
        if (confirm("Are you sure you want to discard this inspection?")) {
            resetInspectionForm();
            window.location.hash = "dashboard";
            setupNavigation();
        }
    });

    document.getElementById("btn-submit-inspection").addEventListener("click", () => {
        if (!state.activeVehicleForPDI) return;

        // If manual inputs are visible, validate and save them first
        if (manualDiv.style.display === "block") {
            const enteredModel = manualModel.value.trim();
            const enteredColor = manualColor.value.trim();
            if (!enteredModel || !enteredColor) {
                alert("Please enter both Model Name and Color for the manual vehicle entry.");
                return;
            }
            state.activeVehicleForPDI.model = enteredModel;
            state.activeVehicleForPDI.color = enteredColor;
        }

        const yard = yardSelect.value;
        const bay = baySelect.value;

        if (!yard || !bay) {
            alert("Please assign a Yard and Bay location for the vehicle.");
            return;
        }

        // Determine final inspection status based on checks & defects
        const checklistStatuses = Object.values(state.activeVehicleForPDI.checklist);
        const hasFailed = checklistStatuses.includes("Failed") || state.selectedDamagePoints.length > 0;
        const hasPending = checklistStatuses.includes("Pending");
        
        let finalStatus = "Pending PDI";
        if (hasFailed) {
            finalStatus = "Failed";
        } else if (!hasPending) {
            finalStatus = "Passed";
        }

        // Update active vehicle record
        const vehicleIndex = state.vehicles.findIndex(v => v.vin === state.activeVehicleForPDI.vin);
        if (vehicleIndex > -1) {
            state.vehicles[vehicleIndex] = {
                ...state.vehicles[vehicleIndex],
                yard,
                bay,
                type: state.activeVehicleForPDI.type,
                status: finalStatus,
                checklist: { ...state.activeVehicleForPDI.checklist },
                defects: [...state.selectedDamagePoints],
                photos: [...state.currentUploadedPhotos]
            };
        }

        saveState();
        showToast(`PDI Inspection for ${state.activeVehicleForPDI.model} completed. Status: ${finalStatus}`);
        resetInspectionForm();
        
        // Go back to Registry
        window.location.hash = "vehicles";
        setupNavigation();
    });
}

function startPDIForVehicle(vin) {
    resetInspectionForm();
    window.location.hash = "inspections";
    
    // Trigger verification sequence automatically
    const navItems = document.querySelectorAll(".sidebar-nav .nav-item");
    const views = document.querySelectorAll(".content-view");
    views.forEach(v => v.classList.remove("active"));
    navItems.forEach(item => item.classList.remove("active"));
    
    document.getElementById("view-inspections").classList.add("active");
    document.getElementById("nav-inspections").classList.add("active");
    state.currentView = "inspections";

    // Set VIN value and trigger click verify
    document.getElementById("inspect-vin").value = vin;
    document.getElementById("btn-verify-vin").click();
}

function resetInspectionForm() {
    state.activeVehicleForPDI = null;
    state.selectedDamagePoints = [];
    state.currentUploadedPhotos = [];
    state.expandedChecklistCategories = null; // reset expanded categories
    
    document.getElementById("inspect-vin").value = "";
    document.getElementById("vin-verify-result").style.display = "none";

    // Clear and hide manual inputs
    const manualDiv = document.getElementById("manual-vehicle-inputs");
    if (manualDiv) {
        manualDiv.style.display = "none";
        document.getElementById("inspect-model-manual").value = "";
        document.getElementById("inspect-color-manual").value = "";
    }

    const steps = [
        document.getElementById("card-step-location"),
        document.getElementById("card-step-checks"),
        document.getElementById("card-step-damage"),
        document.getElementById("card-step-photos"),
        document.getElementById("form-actions-container")
    ];
    steps.forEach(step => step.classList.add("disabled"));

    document.getElementById("inspect-yard").value = "";
    document.getElementById("inspect-bay").innerHTML = '<option value="">-- Select Bay --</option>';
    document.getElementById("inspect-yard").disabled = true;
    document.getElementById("inspect-bay").disabled = true;
    
    const typeSelect = document.getElementById("inspect-type");
    if (typeSelect) {
        typeSelect.value = "petrol";
        typeSelect.disabled = true;
    }

    // Reset checklist
    const chkContainer = document.getElementById("form-checklist-container");
    if (chkContainer) chkContainer.innerHTML = "";

    // Reset damage plotters
    renderDamageMarkers();
    renderDamageList();

    // Reset photos
    renderPhotoPreviews();
}

function renderDamageMarkers() {
    const markersGroup = document.getElementById("damage-markers-group");
    markersGroup.innerHTML = "";

    state.selectedDamagePoints.forEach((point, i) => {
        const type = point.type || "scratch";
        let fill = "var(--status-pending)"; // scratch = orange
        if (type === "dent") fill = "var(--status-failed)"; // dent = red
        if (type === "other") fill = "#3b82f6"; // other = blue

        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        const cx = (point.x / 100) * 600;
        const cy = (point.y / 100) * 350;

        circle.setAttribute("cx", cx);
        circle.setAttribute("cy", cy);
        circle.setAttribute("r", "12");
        circle.setAttribute("fill", fill);
        circle.setAttribute("stroke", "white");
        circle.setAttribute("stroke-width", "2");
        circle.style.cursor = "pointer";

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", cx);
        text.setAttribute("y", cy + 4);
        text.setAttribute("fill", "white");
        text.setAttribute("font-size", "10px");
        text.setAttribute("font-weight", "bold");
        text.setAttribute("text-anchor", "middle");
        text.style.pointerEvents = "none";
        text.textContent = i + 1;

        group.appendChild(circle);
        group.appendChild(text);

        // Click a dot on the plotter to remove it
        circle.addEventListener("click", (e) => {
            e.stopPropagation();
            state.selectedDamagePoints.splice(i, 1);
            renderDamageMarkers();
            renderDamageList();
            updateLiveInspectionStatus();
        });

        markersGroup.appendChild(group);
    });
}

function renderDamageList() {
    const container = document.getElementById("damage-list-items");
    const countLabel = document.getElementById("damage-count");
    
    container.innerHTML = "";
    countLabel.textContent = state.selectedDamagePoints.length;

    if (state.selectedDamagePoints.length === 0) {
        container.innerHTML = `<li class="empty-list-placeholder">No scratches or dents plotted. Click the car outline to add.</li>`;
        return;
    }

    state.selectedDamagePoints.forEach((point, i) => {
        const type = point.type || "scratch";
        let badgeStyle = "background-color: var(--status-pending);";
        if (type === "dent") badgeStyle = "background-color: var(--status-failed);";
        if (type === "other") badgeStyle = "background-color: #3b82f6;";

        const li = document.createElement("li");
        li.className = "damage-item";
        li.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; flex-grow: 1;">
                <span class="damage-badge" style="${badgeStyle}">${i+1}</span>
                <span class="damage-desc" style="flex-grow: 1;">
                    <input type="text" value="${point.note}" placeholder="Describe scratch/dent location..." data-index="${i}">
                </span>
            </div>
            <button class="btn-remove-damage" data-index="${i}">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        `;

        // Update note text dynamically
        const input = li.querySelector("input");
        input.addEventListener("input", (e) => {
            state.selectedDamagePoints[i].note = e.target.value;
        });

        li.querySelector(".btn-remove-damage").addEventListener("click", () => {
            state.selectedDamagePoints.splice(i, 1);
            renderDamageMarkers();
            renderDamageList();
            updateLiveInspectionStatus();
        });

        container.appendChild(li);
    });
}

function renderPhotoPreviews() {
    const grid = document.getElementById("photo-previews");
    grid.innerHTML = "";

    state.currentUploadedPhotos.forEach((src, i) => {
        const card = document.createElement("div");
        card.className = "photo-card";
        card.innerHTML = `
            <img src="${src}" alt="Damage Proof #${i+1}">
            <button class="photo-delete-btn" data-index="${i}">&times;</button>
        `;

        card.querySelector(".photo-delete-btn").addEventListener("click", () => {
            state.currentUploadedPhotos.splice(i, 1);
            renderPhotoPreviews();
        });

        grid.appendChild(card);
    });
}

// --- Vehicle Registry Module ---
function setupRegistry() {
    const filterModel = document.getElementById("filter-model");
    const filterYard = document.getElementById("filter-yard");
    const filterStatus = document.getElementById("filter-status");
    const searchBar = document.getElementById("global-search");

    const events = ["change", "input"];
    [filterModel, filterYard, filterStatus].forEach(sel => {
        sel.addEventListener("change", renderRegistryTable);
    });

    searchBar.addEventListener("input", renderRegistryTable);

    document.getElementById("btn-export-data").addEventListener("click", () => {
        exportPDIReportExcel();
    });

    renderRegistryTable();
}

function renderRegistryTable() {
    const tbody = document.querySelector("#table-registry tbody");
    tbody.innerHTML = "";

    const modelVal = document.getElementById("filter-model").value;
    const yardVal = document.getElementById("filter-yard").value;
    const statusVal = document.getElementById("filter-status").value;
    const searchVal = document.getElementById("global-search").value.trim().toLowerCase();

    // Filter vehicle database
    const filtered = state.vehicles.filter(car => {
        const matchesModel = !modelVal || car.model.includes(modelVal);
        const matchesYard = !yardVal || car.yard === yardVal;
        const matchesStatus = !statusVal || car.status === statusVal;

        const term = searchVal;
        const matchesSearch = !term || 
            car.vin.toLowerCase().includes(term) || 
            car.model.toLowerCase().includes(term) || 
            car.color.toLowerCase().includes(term) ||
            car.status.toLowerCase().includes(term);

        return matchesModel && matchesYard && matchesStatus && matchesSearch;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">No matching vehicles in registry</td></tr>`;
        return;
    }

    filtered.forEach(car => {
        const tr = document.createElement("tr");
        const statusBadge = getStatusBadgeHTML(car.status);
        const yardName = yardSpecs[car.yard] ? yardSpecs[car.yard].name : "Not Parked";
        const bayLocation = car.bay ? `${yardName} - Bay ${car.bay}` : "Unassigned";
        const dmsDone = car.dmsPDIComplete || false;
        
        tr.innerHTML = `
            <td><strong>${car.model}</strong></td>
            <td><code style="font-family:monospace; font-weight:600;">${car.vin}</code></td>
            <td>${car.color}</td>
            <td>${bayLocation}</td>
            <td>${car.arrivalDate}</td>
            <td>${car.defects.length} items</td>
            <td>${statusBadge}</td>
            <td style="text-align: center;">
                <button class="btn-dms-toggle" data-vin="${car.vin}" style="background:transparent; border:none; cursor:pointer; font-size:1.25rem; outline:none; padding:4px;">
                    ${dmsDone
                        ? `<i class="fa-solid fa-circle-check" style="color:var(--status-passed);" title="Completed in DMS (Click to toggle)"></i>` 
                        : `<i class="fa-solid fa-circle-xmark" style="color:var(--text-muted);" title="Pending in DMS (Click to toggle)"></i>`}
                </button>
            </td>
            <td>
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-secondary btn-sm btn-view-file" data-vin="${car.vin}">
                        <i class="fa-solid fa-folder-open"></i> File
                    </button>
                    ${car.status === "Pending PDI" 
                        ? `<button class="btn btn-primary btn-sm btn-reinspect" data-vin="${car.vin}">Inspect</button>` 
                        : `<button class="btn btn-secondary btn-sm btn-reinspect" style="color:var(--status-pending);" data-vin="${car.vin}">Recheck</button>`}
                    <button class="btn btn-danger btn-sm btn-delete-vehicle" data-vin="${car.vin}">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });

    // Bind action clicks
    tbody.querySelectorAll(".btn-view-file").forEach(btn => {
        btn.addEventListener("click", () => {
            const vin = btn.getAttribute("data-vin");
            showVehicleDetails(vin);
        });
    });

    tbody.querySelectorAll(".btn-reinspect").forEach(btn => {
        btn.addEventListener("click", () => {
            const vin = btn.getAttribute("data-vin");
            startPDIForVehicle(vin);
        });
    });

    tbody.querySelectorAll(".btn-delete-vehicle").forEach(btn => {
        btn.addEventListener("click", () => {
            const vin = btn.getAttribute("data-vin");
            deleteVehicleFromRegistry(vin);
        });
    });

    tbody.querySelectorAll(".btn-dms-toggle").forEach(btn => {
        btn.addEventListener("click", () => {
            const vin = btn.getAttribute("data-vin");
            toggleDMSPDIStatus(vin);
        });
    });
}

function deleteVehicleFromRegistry(vin) {
    const vehicle = state.vehicles.find(v => v.vin === vin);
    if (!vehicle) return;
    
    if (confirm(`Are you sure you want to delete ${vehicle.model} (${vehicle.color}) [VIN: ${vehicle.vin}] from the registry? This will permanently remove the vehicle and free up its parking bay.`)) {
        state.vehicles = state.vehicles.filter(v => v.vin !== vin);
        saveState();
        renderRegistryTable();
        updateDashboardStats();
        showToast(`Successfully deleted ${vehicle.model} from registry.`);
    }
}

function toggleDMSPDIStatus(vin) {
    const vehicle = state.vehicles.find(v => v.vin === vin);
    if (vehicle) {
        vehicle.dmsPDIComplete = !vehicle.dmsPDIComplete;
        saveState();
        renderRegistryTable();
        showToast(`DMS PDI for ${vehicle.model} marked as ${vehicle.dmsPDIComplete ? 'Completed' : 'Pending'}.`);
    }
}

// Show complete PDI Detail Card Report modal
const detailModal = document.getElementById("modal-vehicle-detail");

function showVehicleDetails(vin) {
    const car = state.vehicles.find(v => v.vin === vin);
    if (!car) return;

    const body = document.getElementById("detail-modal-body");
    
    // Prepare HTML content for vehicle file
    const yardName = yardSpecs[car.yard] ? yardSpecs[car.yard].name : "Unassigned";
    const bayName = car.bay ? `Bay ${car.bay}` : "None";

    let defectsHTML = "";
    if (car.defects.length === 0) {
        defectsHTML = `<div class="empty-list-placeholder" style="padding:10px 0;">No scratches or dents recorded.</div>`;
    } else {
        defectsHTML = `
            <ol style="padding-left:20px; font-size:0.9rem;">
                ${car.defects.map(d => `<li style="margin-bottom:8px;">${d.note} <span style="font-size:0.75rem; color:var(--text-muted);">(X:${d.x}%, Y:${d.y}%)</span></li>`).join("")}
            </ol>
        `;
    }

    let photosHTML = "";
    if (car.photos.length === 0) {
        photosHTML = `<div class="empty-list-placeholder" style="padding:10px 0;">No photos attached.</div>`;
    } else {
        photosHTML = `
            <div class="detail-photo-gallery">
                ${car.photos.map(p => `
                    <div class="detail-photo-item" onclick="openPhotoFullSize('${p}')">
                        <img src="${p}" alt="Verification proof">
                    </div>
                `).join("")}
            </div>
        `;
    }

    // Map checklist dynamically
    const checklistObj = getVehicleChecklist(car);
    let checklistHTML = "";
    for (const [item, status] of Object.entries(checklistObj)) {
        let statusIcon = '<i class="fa-solid fa-hourglass-half" style="color:var(--status-pending)"></i> Pending';
        if (status === "Passed") {
            statusIcon = '<i class="fa-solid fa-circle-check" style="color:var(--status-passed)"></i> OK';
        } else if (status === "Failed") {
            statusIcon = '<i class="fa-solid fa-circle-xmark" style="color:var(--status-failed)"></i> Fail';
        }
        checklistHTML += `
            <div class="detail-info-row" style="margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.02); padding-bottom:6px; align-items:center;">
                <span style="max-width:70%; font-size:0.85rem; line-height:1.4; text-align:left;">${item}</span>
                <span style="font-size:0.85rem; font-weight:600;">${statusIcon}</span>
            </div>
        `;
    }

    // Build the detail modal layout
    body.innerHTML = `
        <div class="detail-grid">
            <div class="detail-section">
                <h4>Vehicle Information</h4>
                <div class="detail-info-list" style="margin-bottom:24px;">
                    <div class="detail-info-row">
                        <span class="detail-info-label">Model:</span>
                        <span class="detail-info-value">${car.model}</span>
                    </div>
                    <div class="detail-info-row">
                        <span class="detail-info-label">VIN Number:</span>
                        <span class="detail-info-value" style="font-family:monospace;">${car.vin}</span>
                    </div>
                    <div class="detail-info-row">
                        <span class="detail-info-label">Exterior Color:</span>
                        <span class="detail-info-value">${car.color}</span>
                    </div>
                    <div class="detail-info-row">
                        <span class="detail-info-label">Plant Dispatch Date:</span>
                        <span class="detail-info-value">${car.arrivalDate}</span>
                    </div>
                    <div class="detail-info-row">
                        <span class="detail-info-label">Yard Allocation:</span>
                        <span class="detail-info-value">${yardName} - ${bayName}</span>
                    </div>
                    <div class="detail-info-row">
                        <span class="detail-info-label">Overall Status:</span>
                        <span class="detail-info-value">${getStatusBadgeHTML(car.status)}</span>
                    </div>
                </div>

                <h4>Checklist Verification</h4>
                <div class="detail-info-list" style="max-height: 250px; overflow-y: auto; padding-right: 8px; border: 1px solid var(--border-color); padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.01);">
                    ${checklistHTML}
                </div>
            </div>

            <div class="detail-section">
                <h4>Damage Mapping</h4>
                <div class="detail-damage-display" style="margin-bottom:24px;">
                    ${defectsHTML}
                </div>

                <h4>Attached Photo Proofs</h4>
                <div>
                    ${photosHTML}
                </div>
            </div>
        </div>
    `;

    detailModal.classList.add("active");
}

function closeDetailModal() {
    detailModal.classList.remove("active");
}

function openPhotoFullSize(base64Src) {
    const fullModal = document.createElement("div");
    fullModal.className = "modal active";
    fullModal.style.zIndex = 2000;
    fullModal.innerHTML = `
        <div class="modal-content" style="max-width:90%; border:none; background:transparent; box-shadow:none;">
            <div style="text-align:right; margin-bottom:10px;">
                <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal').remove()" style="border-radius:50%; width:32px; height:32px; padding:0; display:inline-flex; align-items:center; justify-content:center;">&times;</button>
            </div>
            <img src="${base64Src}" style="width:100%; max-height:80vh; object-fit:contain; border-radius:12px; border:2px solid rgba(255,255,255,0.1)">
        </div>
    `;
    document.body.appendChild(fullModal);
}

// Mock print capability
function printPDIFileReport() {
    window.print();
}

// Export excel capability
function exportPDIReportExcel() {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "VIN,Model,Color,Yard,Bay,PDI Status,Arrival Date,Defects Count\n";

    state.vehicles.forEach(car => {
        const yardName = yardSpecs[car.yard]?.name || "Unassigned";
        const bay = car.bay || "N/A";
        const row = `"${car.vin}","${car.model}","${car.color}","${yardName}","${bay}","${car.status}","${car.arrivalDate}",${car.defects.length}\n`;
        csvContent += row;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "mahindra_showroom_pdi_report.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast("Exported vehicle inspection registry as CSV.");
}

// --- Setup Modal Event Listeners ---
function setupModals() {
    // Close button actions
    document.getElementById("btn-close-modal").addEventListener("click", closeSlotModal);
    document.getElementById("btn-close-detail-modal").addEventListener("click", closeDetailModal);
    document.getElementById("btn-detail-close").addEventListener("click", closeDetailModal);
    document.getElementById("btn-print-report").addEventListener("click", printPDIFileReport);

    // Close on overlay click
    window.addEventListener("click", (e) => {
        if (e.target === slotModal) closeSlotModal();
        if (e.target === detailModal) closeDetailModal();
    });
}

// --- Checklist Reference Page Module ---
const PDI_CHECKLIST_DATA = {
    standard: {
        title: "Standard PDI Checklist",
        categories: {
            "1. Exterior & Transit Prep": [
                "Transport Protection: Remove all exterior protective wraps, transit blocks from springs, & wheel covers.",
                "Body Panel Inspection: Check for chips, scratches, dents, or paint imperfections. Inspect panel gaps.",
                "Glass & Mirrors: Inspect windshield, windows, and side mirrors for cracks, chips, or pitting.",
                "Lights & Lenses: Check headlight, taillight, and indicator housings for cracks or moisture buildup.",
                "Underbody & Trim: Ensure lower plastic cladding, bumpers, and side skirts are securely fastened."
            ],
            "2. Engine Bay (Cold Checks)": [
                "Fluid Levels: Verify engine oil, coolant, brake fluid, and washer fluid are exactly at the MAX line.",
                "Battery Health: Run state-of-charge test; ensure terminals are tight, clean, and free of corrosion.",
                "Belts & Hoses: Visually check accessory belts for tension; verify coolant & vacuum lines are clamped.",
                "Wiring Harnesses: Ensure all major engine connectors are fully clicked into place and properly routed.",
                "Look for Leaks: Check engine block, radiator connections, and lines for any active fluid weeping."
            ],
            "3. Interior & Electrical Controls": [
                "Fuse Box / Transport Mode: Install transit fuses; take vehicle out of Transport Mode via cluster/OBD.",
                "Dashboard & Cluster: Verify all warning lights illuminate on startup and extinguish correctly.",
                "Infotainment & Audio: Test touchscreen response, radio reception, bluetooth, and all speakers.",
                "HVAC System: Run AC on max cold and heater on max hot; check multi-zone vent airflow distribution.",
                "Windows & Sunroof: Test one-touch up/down functions on all windows; check sunroof tracking/tilt.",
                "Seats & Trims: Check all seat adjustments (manual/power), seat heaters, and seatbelt locking cylinders.",
                "Keys & Locks: Confirm all key fobs operate lock/unlock/tailgate; check physical door lock cylinder."
            ],
            "4. Under Vehicle & Tires": [
                "Tires & Wheels: Deflate shipping pressure down to door-jamb placard specification. Torque lug nuts.",
                "Brakes: Inspect brake rotors for rust/damage; check pad thickness and flexible hose alignment.",
                "Suspension & Steering: Inspect shocks for fluid leaks; check boot seals on ball joints and CV axles.",
                "Exhaust System: Inspect exhaust piping, hangers, and heat shields for clearance and tight fitment.",
                "Underbody Fluid Leaks: Check oil pan, transmission casing, differential, and steering rack for leaks."
            ],
            "5. Road Test (Dynamic)": [
                "Engine Performance: Monitor smooth idle; check for acceleration flat spots, hesitation, or surges.",
                "Transmission: Confirm crisp, precise shifts on manuals or seamless transitions on automatics.",
                "Braking & Steering: Verify vehicle tracks straight. Check for brake shudder, pedal pulsing, or squeals.",
                "NVH Evaluation: Listen for cabin trim rattles, wind leaks around door seals, or suspension clunks.",
                "ADAS / Driver Assist: Confirm functionality of backup camera, parking sensors, and lane-assist alerts."
            ],
            "6. Final Sign-off": [
                "Loose Items Checklist: Verify owner manual, spare tire/kit, jack, tow hook, and floor mats are present.",
                "Final OBD Scan: Connect diagnostic tool, perform full scan, clear historical codes, verify zero active DTCs."
            ]
        }
    },
    ev: {
        title: "EV Specific PDI Checklist",
        categories: {
            "1. High-Voltage (HV) Battery & Safety": [
                "HV Battery Casing: Inspect underside structural enclosure for scratches, impact marks, or dents.",
                "Orange HV Cables & Shielding: Verify orange conduits are completely secure, undamaged, and clipped clear of moving components.",
                "Manual Service Disconnect (MSD): Ensure MSD switch/plug is fully locked and the safety seal/cover is intact.",
                "Coolant Lines: Check high-voltage battery and PEU cooling hoses for tight clamps and zero signs of weeping/leaks."
            ],
            "2. Charging Ports & Systems": [
                "Physical Port Inspection: Check AC (Type 2) and DC Fast Charge (CCS/ChaoJi) pins for debris, moisture, or bent contacts.",
                "Port Door & Locking Actuator: Test electronic release, locking pins during simulated charge, and status LEDs.",
                "Onboard EVSE Cable: Verify factory-supplied portable trickle charger (240V/120V) is inside trunk, undamaged, and turns on."
            ],
            "3. Power Electronics & Thermal": [
                "Inverter & Converter (PEU): Check casing security, electrical grounds, and fluid level of the dedicated electronic coolant loop.",
                "Electric Drive Motor (e-Axle): Inspect drive unit housing for assembly defects or transmission gear-fluid seepage.",
                "12V Auxiliary Battery: Run load test on 12V battery (critical for powering ECUs and closing HV contactors). Check terminal tightness."
            ],
            "4. EV Cabin & Telematics": [
                "SoC & Range Verification: Check State of Charge (%) and estimated range display. Note initial delivery battery level.",
                "Infotainment EV Menus: Verify charge limit configurations, scheduled pre-conditioning settings, and charging station maps load.",
                "Cabin Heat Pump / PTC Heater: Test operation of high-voltage electric heater (PTC) or Heat Pump. Check instant hot/cold air.",
                "Pedestrian Warning System (VESS/AVAS): Ensure external speaker emits legal low-speed pedestrian warning tone when in Drive/Reverse."
            ],
            "5. EV Road Test (Dynamic)": [
                "Regenerative Braking: Verify varying levels of regen braking function (Low/Medium/High/One-Pedal Mode) smoothly.",
                "E-Motor Power Delivery: Test smooth acceleration from a standstill; listen for abnormal high-frequency inverter whines.",
                "Blending Brake Feel: Ensure seamless mechanical brake pad engagement transition when rolling out of regen braking."
            ],
            "6. EV Final Diagnostics": [
                "OBD / Diagnostic Scan: Connect factory scan tool; perform full module check on BMS (Battery Management System) and MCU.",
                "BMS Firmware Check: Confirm Battery Management System is running the newest factory calibration/firmware patch."
            ]
        }
    },
    commercial: {
        title: "Commercial PDI Checklist",
        categories: {
            "1. Exterior & Cargo Prep": [
                "Cargo Bed / Box Inspection: Inspect cargo load bed, tailgate latches, and side drop-gates for secure locks.",
                "Transport Protection: Remove all exterior protective wraps, transit blocks from leaf springs, & wheel covers.",
                "Body Panel & Decals: Check for paint chips, scratches, and cabin panel gaps. Verify commercial branding decals.",
                "Glass & Heavy Mirrors: Inspect wide-angle side mirrors, rear window protector grids, and windshield for chips."
            ],
            "2. Engine Bay & Fluids (Cold)": [
                "Engine Oils & Coolant: Check oil level, heavy duty coolant density, power steering fluid, and brake fluid.",
                "Air Intake & Filter: Inspect heavy-duty air filter casing, clamp tight fitment, and restriction indicator.",
                "Dual Battery Systems: Test State of Charge on primary and auxiliary batteries (if equipped); secure terminals."
            ],
            "3. Cabin & Commercial Electronics": [
                "Digital Tachograph / OBD: Check connectivity, calibration status, and diagnostic logging.",
                "HVAC & Cabin Venting: Test heavy-duty heating, blower speeds, and dashboard distribution ducting.",
                "Speed Governor / Limiter: Verify electronic speed governor is active and set to regional limit (e.g., 80 km/h).",
                "Reverse Warning Horn: Verify backup warning alarm activates immediately when reverse gear is engaged."
            ],
            "4. Underbody & Suspension": [
                "Leaf Springs & Shackle Pins: Inspect leaf pack alignments, U-bolts torque, and chassis grease nipples.",
                "Brakes & Pneumatics: Check air reservoir drain valves, brake lines clearance, drum/disc pads wear.",
                "Tires & Dual Wheels: Verify torque on rear dual-wheel lug nuts; ensure outer and inner tire pressures are even."
            ],
            "5. Dyno & Road Test (Dynamic)": [
                "Loaded Test Run: Evaluate powertrain response, clutch biting point, and heavy-duty transmission gear sync.",
                "Service & Exhaust Brake: Test engine retarder/exhaust brake functionality under deceleration.",
                "Cabin NVH: Listen for differential gear whines, propeller shaft vibrations, or cabin rattles."
            ],
            "6. Sign-off & Safety Gear": [
                "Mandatory Safety Kit: Verify reflective warning triangles, fire extinguisher charge, first aid kit, and wheel chocks.",
                "OBD Final Scan: Clear inactive DTCs in ECU, verify zero active faults, and print diagnostic reports."
            ]
        }
    }
};

let currentChecklistTab = "standard";

function setupChecklistPage() {
    const tabButtons = document.querySelectorAll("#checklist-tab-switcher .tab-btn");
    const searchInput = document.getElementById("checklist-search");
    const printBtn = document.getElementById("btn-print-checklist");
    
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            tabButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentChecklistTab = btn.getAttribute("data-checklist");
            renderChecklistPage();
        });
    });
    
    searchInput.addEventListener("input", () => {
        renderChecklistPage();
    });
    
    printBtn.addEventListener("click", () => {
        window.print();
    });
}

function renderChecklistPage() {
    const container = document.getElementById("checklist-items-container");
    const searchQuery = document.getElementById("checklist-search").value.toLowerCase().trim();
    
    container.innerHTML = "";
    
    const checklistData = PDI_CHECKLIST_DATA[currentChecklistTab];
    if (!checklistData) return;
    
    let totalItemsMatched = 0;
    
    for (const [category, items] of Object.entries(checklistData.categories)) {
        const filteredItems = items.filter(item => item.toLowerCase().includes(searchQuery));
        if (filteredItems.length === 0) continue;
        
        totalItemsMatched += filteredItems.length;
        
        const groupEl = document.createElement("div");
        groupEl.className = "checklist-category-group";
        
        let iconClass = "fa-square-check";
        if (category.includes("Exterior") || category.includes("Cargo")) iconClass = "fa-car";
        else if (category.includes("Engine") || category.includes("HV Battery")) iconClass = "fa-car-battery";
        else if (category.includes("Interior") || category.includes("Cabin")) iconClass = "fa-couch";
        else if (category.includes("Under Vehicle") || category.includes("Underbody") || category.includes("Power Electronics")) iconClass = "fa-wrench";
        else if (category.includes("Road Test") || category.includes("Dyno")) iconClass = "fa-road";
        else if (category.includes("Sign-off") || category.includes("Diagnostics")) iconClass = "fa-file-signature";
        else if (category.includes("Charging")) iconClass = "fa-charging-station";
        
        groupEl.innerHTML = `
            <div class="checklist-category-header">
                <i class="fa-solid ${iconClass}"></i>
                <span>${category}</span>
            </div>
            <div class="checklist-items-list">
                ${filteredItems.map((item, idx) => `
                    <div class="checklist-ref-item">
                        <div class="checklist-ref-number">${idx + 1}</div>
                        <div class="checklist-ref-desc">${item}</div>
                        <div class="checklist-ref-status">
                            <span class="badge badge-pending"><i class="fa-solid fa-hourglass-half"></i> Pending</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        container.appendChild(groupEl);
    }
    
    if (totalItemsMatched === 0) {
        container.innerHTML = `
            <div style="padding:40px; text-align:center; color:var(--text-muted);">
                <i class="fa-solid fa-folder-open" style="font-size:2rem; margin-bottom:12px; display:block;"></i>
                No checklist items match your search.
            </div>
        `;
    }
}

// --- EV / Commercial Detection and Checklist Dynamic Mapper Helpers ---
function isEV(modelName) {
    if (!modelName) return false;
    const name = modelName.toLowerCase();
    return name.includes("ev") || name.includes("electric") || name.includes("xuv400") || name.includes("be.0") || name.includes("be 6") || name.includes("xuv.e");
}

function isCommercial(modelName) {
    if (!modelName) return false;
    const name = modelName.toLowerCase();
    return name.includes("pik-up") || name.includes("pickup") || name.includes("furio") || name.includes("load") || name.includes("cargo") || name.includes("commercial");
}

function getVehicleChecklist(car) {
    const type = car.type || (isEV(car.model) ? "electric" : (isCommercial(car.model) ? "commercial" : "petrol"));
    const listData = PDI_CHECKLIST_DATA[type] || PDI_CHECKLIST_DATA.standard;
    const checklist = {};
    
    // Flatten all items
    const allItems = [];
    for (const cat in listData.categories) {
        listData.categories[cat].forEach(item => {
            allItems.push(item);
        });
    }
    
    // If the car has a checklist, and it's in the new format
    if (car.checklist && typeof car.checklist === 'object' && !('paint' in car.checklist)) {
        // Ensure all current checklist items exist (in case of changes)
        allItems.forEach(item => {
            checklist[item] = car.checklist[item] || "Pending";
        });
        return checklist;
    }
    
    // Otherwise, initialize new checklist
    allItems.forEach(item => {
        checklist[item] = "Pending";
    });
    
    // If it was in the old format, map the old properties to the new ones
    if (car.checklist && typeof car.checklist === 'object') {
        const oldCheck = car.checklist;
        // Map paint
        const paintItem = allItems.find(i => i.toLowerCase().includes("paint") || i.toLowerCase().includes("body panel") || i.toLowerCase().includes("cargo"));
        if (paintItem && oldCheck.paint) checklist[paintItem] = "Passed";
        
        // Map glass
        const glassItem = allItems.find(i => i.toLowerCase().includes("glass") || i.toLowerCase().includes("windshield"));
        if (glassItem && oldCheck.glass) checklist[glassItem] = "Passed";
        
        // Map tires
        const tiresItem = allItems.find(i => i.toLowerCase().includes("tire") || i.toLowerCase().includes("wheel"));
        if (tiresItem && oldCheck.tires) checklist[tiresItem] = "Passed";
        
        // Map dashboard
        const dashItem = allItems.find(i => i.toLowerCase().includes("dashboard") || i.toLowerCase().includes("infotainment") || i.toLowerCase().includes("cabin"));
        if (dashItem && oldCheck.dashboard) checklist[dashItem] = "Passed";
        
        // Map fluids
        const fluidsItem = allItems.find(i => i.toLowerCase().includes("fluid") || i.toLowerCase().includes("oil"));
        if (fluidsItem && oldCheck.fluids) checklist[fluidsItem] = "Passed";
        
        // Map battery
        const batteryItem = allItems.find(i => i.toLowerCase().includes("battery") || i.toLowerCase().includes("volt"));
        if (batteryItem && oldCheck.battery) checklist[batteryItem] = "Passed";
    }
    
    return checklist;
}

function renderFormChecklist() {
    const container = document.getElementById("form-checklist-container");
    if (!container || !state.activeVehicleForPDI) return;
    
    const car = state.activeVehicleForPDI;
    const type = car.type || (isEV(car.model) ? "electric" : (isCommercial(car.model) ? "commercial" : "petrol"));
    
    // Update header badge
    const badgeEl = document.getElementById("checklist-type-badge");
    if (badgeEl) {
        if (type === "electric") {
            badgeEl.textContent = "EV Specific Checklist";
            badgeEl.style.cssText = "background-color: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2);";
        } else if (type === "commercial") {
            badgeEl.textContent = "Commercial Checklist";
            badgeEl.style.cssText = "background-color: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2);";
        } else {
            badgeEl.textContent = "Standard Checklist";
            badgeEl.style.cssText = "background-color: var(--mahindra-red-glow); color: var(--mahindra-red); border: 1px solid rgba(227, 24, 55, 0.2);";
        }
    }
    
    container.innerHTML = "";
    
    const checklistData = PDI_CHECKLIST_DATA[type] || PDI_CHECKLIST_DATA.standard;
    
    // Ensure car.checklist is initialized and up to date
    car.checklist = getVehicleChecklist(car);

    // Initialize accordion categories set
    if (!state.expandedChecklistCategories) {
        state.expandedChecklistCategories = new Set();
        // Expand the first category by default on first load
        const firstCategory = Object.keys(checklistData.categories)[0];
        if (firstCategory) {
            state.expandedChecklistCategories.add(firstCategory);
        }
    }
    
    for (const [category, items] of Object.entries(checklistData.categories)) {
        const isExpanded = state.expandedChecklistCategories.has(category);
        
        const sectionEl = document.createElement("div");
        sectionEl.className = `checklist-category-accordion${isExpanded ? " expanded" : ""}`;
        
        // Calculate category progress
        const passedCount = items.filter(item => car.checklist[item] === "Passed").length;
        const failedCount = items.filter(item => car.checklist[item] === "Failed").length;
        const totalCount = items.length;
        const checkedCount = passedCount + failedCount;
        
        // Accordion Header
        const headerEl = document.createElement("div");
        headerEl.className = "checklist-accordion-header";
        
        let iconClass = "fa-square-check";
        if (category.includes("Exterior") || category.includes("Cargo")) iconClass = "fa-car";
        else if (category.includes("Engine") || category.includes("HV Battery")) iconClass = "fa-car-battery";
        else if (category.includes("Interior") || category.includes("Cabin")) iconClass = "fa-couch";
        else if (category.includes("Under Vehicle") || category.includes("Underbody") || category.includes("Power Electronics")) iconClass = "fa-wrench";
        else if (category.includes("Road Test") || category.includes("Dyno")) iconClass = "fa-road";
        else if (category.includes("Sign-off") || category.includes("Diagnostics")) iconClass = "fa-file-signature";
        else if (category.includes("Charging")) iconClass = "fa-charging-station";
        
        headerEl.innerHTML = `
            <div class="checklist-accordion-title">
                <i class="fa-solid ${iconClass}"></i>
                <span>${category}</span>
            </div>
            <div class="checklist-accordion-status">
                <span class="checklist-accordion-count">${checkedCount}/${totalCount}</span>
                <i class="fa-solid fa-chevron-down checklist-accordion-icon"></i>
            </div>
        `;
        
        headerEl.addEventListener("click", () => {
            if (state.expandedChecklistCategories.has(category)) {
                state.expandedChecklistCategories.delete(category);
                sectionEl.classList.remove("expanded");
            } else {
                state.expandedChecklistCategories.add(category);
                sectionEl.classList.add("expanded");
            }
        });
        
        sectionEl.appendChild(headerEl);
        
        // Accordion Content
        const contentEl = document.createElement("div");
        contentEl.className = "checklist-accordion-content";
        
        // Items list
        items.forEach(item => {
            const currentStatus = car.checklist[item] || "Pending";
            
            const itemRow = document.createElement("div");
            itemRow.className = "checklist-form-item";
            itemRow.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 16px;
                padding: 12px 16px;
                background: rgba(255, 255, 255, 0.02);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                margin-bottom: 10px;
                transition: background-color var(--transition-fast);
            `;
            
            const labelEl = document.createElement("span");
            labelEl.textContent = item;
            labelEl.style.cssText = `
                font-size: 0.85rem;
                color: var(--text-primary);
                line-height: 1.4;
                flex: 1;
                text-align: left;
            `;
            itemRow.appendChild(labelEl);
            
            // Tri-state selector container
            const triStateContainer = document.createElement("div");
            triStateContainer.className = "tri-state-group";
            triStateContainer.style.cssText = `
                display: flex;
                gap: 4px;
                flex-shrink: 0;
            `;
            
            const statuses = [
                { name: "Pending", icon: "fa-hourglass-half", color: "var(--status-pending)", glow: "var(--status-pending-glow)" },
                { name: "Passed", icon: "fa-check", color: "var(--status-passed)", glow: "var(--status-passed-glow)" },
                { name: "Failed", icon: "fa-xmark", color: "var(--status-failed)", glow: "var(--status-failed-glow)" }
            ];
            
            statuses.forEach(statusOpt => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = `btn btn-sm`;
                btn.style.cssText = `
                    padding: 6px 10px;
                    font-size: 0.72rem;
                    background: rgba(255,255,255,0.03);
                    color: var(--text-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                `;
                btn.innerHTML = `<i class="fa-solid ${statusOpt.icon}"></i> ${statusOpt.name}`;
                
                // If active
                if (currentStatus === statusOpt.name) {
                    btn.style.borderColor = statusOpt.color;
                    btn.style.backgroundColor = statusOpt.glow;
                    btn.style.color = statusOpt.color;
                    btn.style.fontWeight = "600";
                }
                
                btn.addEventListener("click", (e) => {
                    e.preventDefault();
                    car.checklist[item] = statusOpt.name;
                    updateLiveInspectionStatus();
                    renderFormChecklist();
                });
                
                triStateContainer.appendChild(btn);
            });
            
            itemRow.appendChild(triStateContainer);
            contentEl.appendChild(itemRow);
        });
        
        sectionEl.appendChild(contentEl);
        container.appendChild(sectionEl);
    }

    // Update progress bar and percent
    const allChecklistItems = Object.values(checklistData.categories).flat();
    const totalItems = allChecklistItems.length;
    const completedItems = allChecklistItems.filter(item => car.checklist[item] === "Passed" || car.checklist[item] === "Failed").length;
    const progressPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    
    const progBar = document.getElementById("checklist-progress-bar");
    const progText = document.getElementById("checklist-progress-percent");
    if (progBar && progText) {
        progBar.style.width = `${progressPct}%`;
        progText.textContent = `${progressPct}%`;
    }
}

function updateLiveInspectionStatus() {
    if (!state.activeVehicleForPDI) return;
    const car = state.activeVehicleForPDI;
    
    // Calculate based on current checks and damage points
    const checklistStatuses = Object.values(car.checklist);
    const hasFailed = checklistStatuses.includes("Failed") || state.selectedDamagePoints.length > 0;
    const hasPending = checklistStatuses.includes("Pending");
    
    let overallStatus = "Pending PDI";
    if (hasFailed) {
        overallStatus = "Failed";
    } else if (!hasPending) {
        overallStatus = "Passed";
    }
    
    car.status = overallStatus;
    
    const verifyResult = document.getElementById("vin-verify-result");
    const verifyTitle = document.getElementById("vin-verify-title");
    const verifyDetails = document.getElementById("vin-verify-details");
    
    if (verifyResult) {
        if (overallStatus === "Passed") {
            verifyResult.style.borderColor = "var(--status-passed)";
            verifyResult.style.color = "var(--status-passed)";
            verifyResult.style.backgroundColor = "var(--status-passed-glow)";
            verifyTitle.textContent = "PDI PASSED (Live Update)";
            verifyDetails.textContent = `All check list requirements satisfied. Ready to submit registry file.`;
        } else if (overallStatus === "Failed") {
            verifyResult.style.borderColor = "var(--status-failed)";
            verifyResult.style.color = "var(--status-failed)";
            verifyResult.style.backgroundColor = "var(--status-failed-glow)";
            verifyTitle.textContent = "PDI FAILED / REPAIR (Live Update)";
            verifyDetails.textContent = `Defects or checklist failures detected. System will log as Repair Required.`;
        } else {
            verifyResult.style.borderColor = "var(--status-pending)";
            verifyResult.style.color = "var(--status-pending)";
            verifyResult.style.backgroundColor = "var(--status-pending-glow)";
            verifyTitle.textContent = "PDI IN PROGRESS (Live Update)";
            verifyDetails.textContent = `Checks in progress. Keep working through the list items.`;
        }
    }
}
