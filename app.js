/**
 * Kivaywa High School LMS - Core Frontend Orchestrator & API Integration Engine
 * Architecture: Monolithic Database-Driven REST Integration (Production Grade)
 */

// 1. API Configuration Context Layer
const API_BASE_URL = 'https://kivlibback.onrender.com/api'; 

// 2. Monolithic Application State Engine
let state = {
    books: [],
    borrowed: [],
    fines: [] // Tracked balances calculated from overdue cycles or structural damages
};

// 3. Application Lifecycle Event Listeners
document.addEventListener("DOMContentLoaded", async () => {
    initializeTabNavigation();
    setInitialSystemDateContext();
    attachFormSubmissionHandlers();
    attachUtilityButtonHandlers();
    await synchronizeApplicationData();
});

// 4. Interface Tab Navigation Subsystem
function initializeTabNavigation() {
    const menuButtons = document.querySelectorAll(".menu-item");
    menuButtons.forEach(button => {
        button.addEventListener("click", () => {
            menuButtons.forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");
            
            const selectedTab = button.getAttribute("data-tab");
            switchTab(selectedTab);
        });
    });
}

function switchTab(tabId) {
    document.querySelectorAll(".tab-content").forEach(content => content.classList.remove("active"));
    const activeTab = document.getElementById(`${tabId}-tab`);
    if (activeTab) {
        activeTab.classList.add("active");
    }
    
    // Manage sidebar active styles if tabs are switched programmatically via sub-buttons
    const matchingMenuBtn = document.querySelector(`.menu-item[data-tab="${tabId}"]`);
    if (matchingMenuBtn) {
        document.querySelectorAll(".menu-item").forEach(btn => btn.classList.remove("active"));
        matchingMenuBtn.classList.add("active");
    }
}

// 5. Native Toast Notification Engine Link
function showToast(message, type = 'success', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    if (type === 'info') icon = 'fa-info-circle';
    if (type === 'warning') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `
        <i class="fa-solid ${icon} toast-icon"></i>
        <span class="toast-message">${escapeHtml(message)}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastFadeOut 0.4s ease forwards';
        toast.addEventListener('animationend', () => toast.remove());
    }, duration);
}

// 6. High-Fidelity Data Synchronization Layer
async function synchronizeApplicationData() {
    displayTableLoadingIndicators();
    
    try {
        const [booksResponse, borrowedResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/books`),
            fetch(`${API_BASE_URL}/borrowed`)
        ]);

        if (!booksResponse.ok || !borrowedResponse.ok) {
            throw new Error("Server inventory pipeline returned a bad response packet.");
        }

        state.books = await booksResponse.json();
        state.borrowed = await borrowedResponse.json();
        
        // Derive penalty structures from local data array
        calculateFinesSystemState();
        
        updateOnlineStatusIndicator(true);
        renderAppLayout();
        populateBookTitleDatalist();
    } catch (error) {
        console.error("System sync failed: ", error);
        updateOnlineStatusIndicator(false);
        renderDataSyncFailureState(error.message);
        showToast("Database synchronization failed. Running offline snapshot.", "error");
    }
}

function updateOnlineStatusIndicator(isOnline) {
    const statusText = document.querySelector(".status-online");
    if (statusText) {
        statusText.innerText = isOnline ? "System Online" : "Connection Error";
        statusText.style.color = isOnline ? "#22c55e" : "#ef4444";
    }
}

function calculateFinesSystemState() {
    // Generate derived fine records for items flagged as Overdue
    state.fines = state.borrowed.filter(item => item.status === "Overdue" || (parseInt(item.fineAmount) > 0)).map(item => {
        const dateDue = new Date(item.dueDate);
        const today = new Date();
        const diffTime = Math.max(0, today - dateDue);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return {
            admNo: item.admNo,
            name: item.name,
            bookTitle: item.bookTitle,
            daysOverdue: item.status === "Overdue" ? diffDays : 0,
            conditionDeficit: item.conditionDeficit || "Good",
            fineAmount: item.fineAmount || (diffDays * 20) // Standard KES 20 per day fine policy
        };
    });
}

// 7. UI Rendering & Presentation Grid Engines
function renderAppLayout() {
    renderMetricDashboards();
    renderRecentTransactionsGrid();
    renderCatalogTableGrid(state.books);
    renderRegistryTableGrid(state.borrowed);
    renderFinesTableGrid(state.fines);
}

function renderMetricDashboards() {
    const totalBooksEl = document.getElementById("total-books-count");
    const issuedBooksEl = document.getElementById("issued-books-count");
    const overdueBooksEl = document.getElementById("overdue-books-count");
    const totalFinesEl = document.getElementById("total-fines-count");

    if (totalBooksEl) totalBooksEl.innerText = state.books.reduce((acc, curr) => acc + parseInt(curr.qty || 0), 0).toLocaleString();
    if (issuedBooksEl) issuedBooksEl.innerText = state.borrowed.length.toLocaleString();
    
    const overdueCount = state.borrowed.filter(b => b.status === "Overdue").length;
    if (overdueBooksEl) overdueBooksEl.innerText = overdueCount.toLocaleString();

    const sumFines = state.fines.reduce((acc, curr) => acc + parseFloat(curr.fineAmount || 0), 0);
    if (totalFinesEl) totalFinesEl.innerText = `KES ${sumFines.toLocaleString()}`;
}

function renderRecentTransactionsGrid() {
    const tbody = document.getElementById("recent-transactions-tbody");
    if (!tbody) return;
    
    if (state.borrowed.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:20px;">No active transactions inside database.</td></tr>`;
        return;
    }

    const recentItems = [...state.borrowed].reverse().slice(0, 5);
    tbody.innerHTML = recentItems.map(item => {
        const typeBadgeClass = item.borrowerType === 'Teacher/Staff' ? 'style="background:#0284c7; color:#fff; padding:2px 6px; border-radius:4px; font-size:0.75rem;"' : 'style="background:#f3f4f6; color:#1f2937; padding:2px 6px; border-radius:4px; font-size:0.75rem;"';
        return `
            <tr>
                <td><b>${escapeHtml(item.admNo)}</b></td>
                <td><span ${typeBadgeClass}>${escapeHtml(item.borrowerType || 'Student')}</span></td>
                <td>${escapeHtml(item.name)}</td>
                <td>${escapeHtml(item.bookTitle)}</td>
                <td>${escapeHtml(item.dueDate)}</td>
                <td><span class="badge ${item.status === 'Overdue' ? 'badge-warning' : 'badge-success'}">${escapeHtml(item.status)}</span></td>
            </tr>
        `;
    }).join('');
}

function renderCatalogTableGrid(booksArray) {
    const tbody = document.getElementById("books-table-tbody");
    if (!tbody) return;

    if (booksArray.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#888; padding:30px;">No catalog records found matching parameters.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = booksArray.map(book => `
        <tr>
            <td><code>${escapeHtml(book.isbn)}</code></td>
            <td><b>${escapeHtml(book.title)}</b></td>
            <td>${escapeHtml(book.author)}</td>
            <td>${escapeHtml(book.category)}</td>
            <td>${parseInt(book.qty)} pcs</td>
            <td>
                <button class="btn btn-danger-outline btn-sm" onclick="handleBookDelete('${book.isbn}')">
                    <i class="fa-solid fa-trash-can"></i> Remove
                </button>
            </td>
        </tr>
    `).join('');
}

function renderRegistryTableGrid(borrowedArray) {
    const tbody = document.getElementById("registry-table-tbody");
    if (!tbody) return;

    if (borrowedArray.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#888; padding:30px;">No current logs active inside tracking grid.</td></tr>`;
        return;
    }

    tbody.innerHTML = borrowedArray.map(item => `
        <tr>
            <td><code>${escapeHtml(item.admNo)}</code></td>
            <td><small>${escapeHtml(item.borrowerType || 'Student')}</small></td>
            <td><b>${escapeHtml(item.name)}</b></td>
            <td>${escapeHtml(item.form)}</td>
            <td>${escapeHtml(item.bookTitle)}</td>
            <td><span style="color: ${item.status === 'Overdue' ? '#ef4444' : 'inherit'}; font-weight:600;">${escapeHtml(item.dueDate)}</span></td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="populateAndOpenReturnModal('${item.admNo}')">
                    <i class="fa-solid fa-arrow-rotate-left"></i> Check-In
                </button>
            </td>
        </tr>
    `).join('');
}

function renderFinesTableGrid(finesArray) {
    const tbody = document.getElementById("fines-table-tbody");
    if (!tbody) return;

    if (finesArray.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:green; padding:20px; font-weight:500;"><i class="fa-solid fa-circle-check"></i> Clean Record Ledger: All fines cleared.</td></tr>`;
        return;
    }

    tbody.innerHTML = finesArray.map(fine => `
        <tr>
            <td><code>${escapeHtml(fine.admNo)}</code></td>
            <td><b>${escapeHtml(fine.name)}</b></td>
            <td>${escapeHtml(fine.bookTitle)}</td>
            <td><span class="badge badge-warning">${fine.daysOverdue} Days</span></td>
            <td><small>${escapeHtml(fine.conditionDeficit)}</small></td>
            <td style="font-weight:700; color:#b91c1c;">KES ${parseFloat(fine.fineAmount).toLocaleString()}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="handleClearFine('${fine.admNo}')" style="background-color:#2e7d32; border:none;">
                    <i class="fa-solid fa-receipt"></i> Clear Charge
                </button>
            </td>
        </tr>
    `).join('');
}

function populateBookTitleDatalist() {
    const datalist = document.getElementById("inventory-datalist");
    if (!datalist) return;
    datalist.innerHTML = state.books.map(book => `<option value="${escapeHtml(book.title)}">${escapeHtml(book.category)}</option>`).join('');
}

// 8. Dynamic Event Binding Anchors
function attachFormSubmissionHandlers() {
    document.getElementById("add-book-form")?.addEventListener("submit", handleBookAdd);
    document.getElementById("issue-book-form")?.addEventListener("submit", handleBookIssue);
    document.getElementById("return-book-form")?.addEventListener("submit", handleReturnBookSubmit);
    
    // Wire local input queries to real-time keystroke processing listeners
    document.getElementById("book-search")?.addEventListener("input", filterBooks);
    document.getElementById("registry-search")?.addEventListener("input", filterRegistry);
}

function attachUtilityButtonHandlers() {
    document.getElementById("export-db-btn")?.addEventListener("click", exportSystemBackupSnapshot);
    document.getElementById("import-db-btn")?.addEventListener("click", () => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".json";
        fileInput.onchange = (e) => importSystemBackupSnapshot(e);
        fileInput.click();
    });
}

// 9. Core Business Logic & Transactional Handlers
async function handleBookAdd(e) {
    e.preventDefault();
    
    const newBook = {
        title: document.getElementById("book-title").value.trim(),
        author: document.getElementById("book-author").value.trim(),
        isbn: document.getElementById("book-isbn").value.trim(),
        category: document.getElementById("book-category").value,
        qty: parseInt(document.getElementById("book-qty").value) || 1
    };

    try {
        const response = await fetch(`${API_BASE_URL}/books`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newBook)
        });

        if (!response.ok) throw new Error("Backend infrastructure rejected initialization payload.");

        closeModal("add-book-modal");
        document.getElementById("add-book-form").reset();
        showToast(`"${newBook.title}" committed successfully to catalog inventory!`, "success");
        await synchronizeApplicationData();
    } catch (error) {
        showToast(`Add Book Failure: ${error.message}`, "error");
    }
}

async function handleBookIssue(e) {
    e.preventDefault();

    const newBorrowing = {
        borrowerType: document.getElementById("borrow-type").value,
        admNo: document.getElementById("borrow-adm").value.trim(),
        name: document.getElementById("borrow-name").value.trim(),
        form: document.getElementById("borrow-form").value,
        bookTitle: document.getElementById("borrow-book").value.trim(),
        issueDate: document.getElementById("borrow-issue-date").value,
        dueDate: document.getElementById("borrow-return-date").value,
        status: "Active"
    };

    try {
        const response = await fetch(`${API_BASE_URL}/borrowed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newBorrowing)
        });

        if (!response.ok) throw new Error("System denied lending approval parameters.");

        closeModal("issue-book-modal");
        document.getElementById("issue-book-form").reset();
        setInitialSystemDateContext();
        showToast(`Volume checked out to ${newBorrowing.name} successfully!`, "info");
        await synchronizeApplicationData();
    } catch (error) {
        showToast(`Issuance Aborted: ${error.message}`, "error");
    }
}

function populateAndOpenReturnModal(admNo) {
    const loanRecord = state.borrowed.find(item => item.admNo === admNo);
    if (loanRecord) {
        const searchInput = document.getElementById("return-search-id");
        if (searchInput) searchInput.value = loanRecord.admNo;
        
        // Auto-compute baseline overdue fines before showing UI modal view
        const dateDue = new Date(loanRecord.dueDate);
        const today = new Date();
        if (today > dateDue) {
            const diffDays = Math.ceil((today - dateDue) / (1000 * 60 * 60 * 24));
            document.getElementById("return-fine").value = diffDays * 20;
        } else {
            document.getElementById("return-fine").value = 0;
        }
    }
    openModal("return-book-modal");
}

async function handleReturnBookSubmit(e) {
    e.preventDefault();
    const identifier = document.getElementById("return-search-id").value.trim();
    const condition = document.getElementById("return-condition").value;
    const fineAmount = parseFloat(document.getElementById("return-fine").value) || 0;

    const activeLoan = state.borrowed.find(b => b.admNo === identifier);
    if (!activeLoan) {
        showToast("No matching loan record discovered for input token.", "warning");
        return;
    }

    try {
        // Core execution updates parameters or updates state logs contextually
        const response = await fetch(`${API_BASE_URL}/borrowed/${activeLoan.id || identifier}`, { 
            method: 'DELETE' 
        });
        
        if (!response.ok) throw new Error("REST collection cluster failed validation sweep.");

        closeModal("return-book-modal");
        document.getElementById("return-book-form").reset();
        
        if (fineAmount > 0 || condition !== "Good") {
            showToast(`Check-In complete. Penalty of KES ${fineAmount} logged under condition parameters.`, "warning");
        } else {
            showToast("Book returned intact. Loan record resolved safely.", "success");
        }
        
        await synchronizeApplicationData();
    } catch (error) {
        showToast(`Verification Aborted: ${error.message}`, "error");
    }
}

async function handleBookDelete(isbn) {
    if (!confirm("Are you sure you want to permanently delete this book configuration from the library database?")) return;

    try {
        const response = await fetch(`${API_BASE_URL}/books/${isbn}`, { method: 'DELETE' });
        if (!response.ok) throw new Error("Backend denied server removal instruction context.");
        showToast("Record dropped successfully from inventory cluster.", "success");
        await synchronizeApplicationData();
    } catch (error) {
        showToast(`Deletion Failed: ${error.message}`, "error");
    }
}

async function handleClearFine(admNo) {
    showToast(`Processing receipt settlement ledger entry for ${admNo}...`, "info");
    // Fine settlement sequence updates state or syncs values back down
    state.borrowed = state.borrowed.map(item => {
        if (item.admNo === admNo) {
            item.fineAmount = 0;
            item.status = "Active"; // Clear overdue configuration flags
        }
        return item;
    });
    calculateFinesSystemState();
    renderAppLayout();
    showToast("Fine registry updated. Balances set to zero.", "success");
}

// 10. Search & Dynamic Frontend Content Filters
function filterBooks() {
    const query = document.getElementById("book-search").value.toLowerCase().trim();
    const filtered = state.books.filter(book => 
        book.title.toLowerCase().includes(query) || 
        book.author.toLowerCase().includes(query) || 
        book.isbn.includes(query)
    );
    renderCatalogTableGrid(filtered);
}

function filterRegistry() {
    const query = document.getElementById("registry-search").value.toLowerCase().trim();
    const filtered = state.borrowed.filter(item => 
        item.name.toLowerCase().includes(query) || 
        item.admNo.includes(query) ||
        item.bookTitle.toLowerCase().includes(query)
    );
    renderRegistryTableGrid(filtered);
}

// 11. Offline Snapshots & System Integrity Backup Utilities
function exportSystemBackupSnapshot() {
    try {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `Kivaywa_LMS_Snapshot_2026.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast("System diagnostic local snapshot exported.", "success");
    } catch (e) {
        showToast("Failed to compile state snapshot.", "error");
    }
}

function importSystemBackupSnapshot(e) {
    const fileReader = new FileReader();
    fileReader.onload = async function(event) {
        try {
            const parsedState = JSON.parse(event.target.result);
            if (parsedState.books && parsedState.borrowed) {
                state = parsedState;
                calculateFinesSystemState();
                renderAppLayout();
                showToast("System parameters updated from source backup file.", "success");
            } else {
                throw new Error("Invalid structure formatting inside parsed file configuration.");
            }
        } catch (err) {
            showToast(`Snapshot Restorations Aborted: ${err.message}`, "error");
        }
    };
    fileReader.readAsText(e.target.files[0]);
}

// 12. Auxiliary Modals & Form Control Setup Layer
function openModal(id) { 
    const modal = document.getElementById(id);
    if (modal) modal.classList.add("open"); 
}

function closeModal(id) { 
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove("open"); 
}

function setInitialSystemDateContext() {
    const issueDateInput = document.getElementById("borrow-issue-date");
    const returnDateInput = document.getElementById("borrow-return-date");
    
    if (issueDateInput && returnDateInput) {
        const today = new Date();
        issueDateInput.value = today.toISOString().split('T')[0];
        
        const futureReturnDate = new Date(today);
        futureReturnDate.setDate(today.getDate() + 14); // 2 Weeks Borrow Window
        returnDateInput.value = futureReturnDate.toISOString().split('T')[0];
    }
}

function displayTableLoadingIndicators() {
    const targets = ["recent-transactions-tbody", "books-table-tbody", "registry-table-tbody", "fines-table-tbody"];
    targets.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:#666;"><i class="fa-solid fa-spinner fa-spin"></i> Synchronizing cloud dataset registers...</td></tr>`;
        }
    });
}

function renderDataSyncFailureState(message) {
    const targets = ["recent-transactions-tbody", "books-table-tbody", "registry-table-tbody"];
    targets.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ef4444; padding:20px; font-weight:500;"><i class="fa-solid fa-triangle-exclamation"></i> Network Error: Fallback to local machine memory array.</td></tr>`;
        }
    });
}

function escapeHtml(string) {
    return String(string).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}

// 13. Global Scope Execution Registration Hooks
window.switchTab = switchTab;
window.openModal = openModal;
window.closeModal = closeModal;
window.handleBookDelete = handleBookDelete;
window.populateAndOpenReturnModal = populateAndOpenReturnModal;
window.handleClearFine = handleClearFine;
