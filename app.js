/**
 * Kivaywa High School LMS - Core Frontend Orchestrator & API Integration Engine
 * Architecture: 100% Database-Driven REST Integration (Production Grade)
 */

// 1. API Configuration Context Layer
const API_BASE_URL = 'http://localhost:5000/api'; 

// 2. Monolithic Application State Engine
let state = {
    books: [],
    borrowed: []
};

// 3. Application Lifecycle Event Listeners
document.addEventListener("DOMContentLoaded", async () => {
    initializeTabNavigation();
    setInitialSystemDateContext();
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
}

// 5. High-Fidelity Data Synchronization Layer
async function synchronizeApplicationData() {
    displayTableLoadingIndicators();
    
    try {
        const [booksResponse, borrowedResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/books`),
            fetch(`${API_BASE_URL}/borrowed`)
        ]);

        if (!booksResponse.ok || !borrowedResponse.ok) {
            throw new Error("Critical response anomaly observed while querying server inventory.");
        }

        state.books = await booksResponse.json();
        state.borrowed = await borrowedResponse.json();
        
        updateOnlineStatusIndicator(true);
        renderAppLayout();
    } catch (error) {
        console.error("System sync failed: ", error);
        updateOnlineStatusIndicator(false);
        renderDataSyncFailureState(error.message);
    }
}

function updateOnlineStatusIndicator(isOnline) {
    const statusText = document.querySelector(".status-online");
    if (statusText) {
        statusText.innerText = isOnline ? "System Online" : "Connection Error";
        statusText.style.color = isOnline ? "#22c55e" : "#ef4444"; // Enterprise green or crimson
    }
}

// 6. UI Rendering & Presentation Grid Engines
function renderAppLayout() {
    renderMetricDashboards();
    renderRecentTransactionsGrid();
    renderCatalogTableGrid(state.books);
    renderRegistryTableGrid(state.borrowed);
}

function renderMetricDashboards() {
    const totalBooksEl = document.getElementById("total-books-count");
    const issuedBooksEl = document.getElementById("issued-books-count");
    const overdueBooksEl = document.getElementById("overdue-books-count");

    if (totalBooksEl) totalBooksEl.innerText = state.books.reduce((acc, curr) => acc + parseInt(curr.qty || 0), 0).toLocaleString();
    if (issuedBooksEl) issuedBooksEl.innerText = state.borrowed.length.toLocaleString();
    if (overdueBooksEl) overdueBooksEl.innerText = state.borrowed.filter(b => b.status === "Overdue").length.toLocaleString();
}

function renderRecentTransactionsGrid() {
    const tbody = document.getElementById("recent-transactions-tbody");
    if (!tbody) return;
    
    if (state.borrowed.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:20px;">No transaction history available.</td></tr>`;
        return;
    }

    // Displays the top 5 most recent transactions on the main dashboard tab
    const recentItems = [...state.borrowed].reverse().slice(0, 5);
    tbody.innerHTML = recentItems.map(item => `
        <tr>
            <td><b>${escapeHtml(item.admNo)}</b></td>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.bookTitle)}</td>
            <td>${escapeHtml(item.dueDate)}</td>
            <td><span class="badge ${item.status === 'Overdue' ? 'badge-warning' : 'badge-success'}">${escapeHtml(item.status)}</span></td>
        </tr>
    `).join('');
}

function renderCatalogTableGrid(booksArray) {
    const tbody = document.getElementById("books-table-tbody");
    if (!tbody) return;

    if (booksArray.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:30px;">No books found matching search parameters.</td></tr>`;
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
                <button class="btn btn-danger-outline" onclick="handleBookDelete('${book.isbn}')">
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
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:30px;">No active borrowings currently registered in logs.</td></tr>`;
        return;
    }

    tbody.innerHTML = borrowedArray.map(item => `
        <tr>
            <td><code>${escapeHtml(item.admNo)}</code></td>
            <td><b>${escapeHtml(item.name)}</b></td>
            <td>${escapeHtml(item.form)}</td>
            <td>${escapeHtml(item.bookTitle)}</td>
            <td><span style="color: ${item.status === 'Overdue' ? '#ef4444' : 'inherit'}; font-weight:600;">${escapeHtml(item.dueDate)}</span></td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="handleReturnBook('${item.admNo}')">Mark Returned</button>
            </td>
        </tr>
    `).join('');
}

// 7. Core Business Logic & Transactional Handlers
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

        if (!response.ok) throw new Error("Server failed to commit new book profile data.");

        closeModal("add-book-modal");
        document.getElementById("add-book-form").reset();
        await synchronizeApplicationData();
    } catch (error) {
        alert(`Transaction Denied: ${error.message}`);
    }
}

async function handleBookIssue(e) {
    e.preventDefault();

    const newBorrowing = {
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

        if (!response.ok) throw new Error("Server rejected issuance authorization parameters.");

        closeModal("issue-book-modal");
        document.getElementById("issue-book-form").reset();
        setInitialSystemDateContext(); // Reset date values to safe fallbacks
        await synchronizeApplicationData();
    } catch (error) {
        alert(`Issuance Denied: ${error.message}`);
    }
}

async function handleBookDelete(isbn) {
    if (!confirm("Are you sure you want to permanently delete this book configuration from the library database?")) return;

    try {
        const response = await fetch(`${API_BASE_URL}/books/${isbn}`, { method: 'DELETE' });
        if (!response.ok) throw new Error("Backend denied requested deletion routine.");
        await synchronizeApplicationData();
    } catch (error) {
        alert(`Deletion Failed: ${error.message}`);
    }
}

async function handleReturnBook(admNo) {
    if (!confirm("Confirm book has been returned intact to process check-in log closure?")) return;

    try {
        const response = await fetch(`${API_BASE_URL}/borrowed/${admNo}`, { method: 'DELETE' });
        if (!response.ok) throw new Error("Server processing error occurred during collection check-in.");
        await synchronizeApplicationData();
    } catch (error) {
        alert(`Log Closure Aborted: ${error.message}`);
    }
}

// 8. Search & Dynamic Frontend Content Filters
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

// 9. Auxiliary System Utilities & Security Layers
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
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        
        const structuredTodayStr = `${year}-${month}-${day}`;
        issueDateInput.value = structuredTodayStr;
        
        // Default standard borrowing lifecycle configuration: 14 Days return window limit
        const futureReturnDate = new Date(today);
        futureReturnDate.setDate(today.getDate() + 14);
        
        const rYear = futureReturnDate.getFullYear();
        const rMonth = String(futureReturnDate.getMonth() + 1).padStart(2, '0');
        const rDay = String(futureReturnDate.getDate()).padStart(2, '0');
        
        returnDateInput.value = `${rYear}-${rMonth}-${rDay}`;
    }
}

function displayTableLoadingIndicators() {
    const skeletons = ["recent-transactions-tbody", "books-table-tbody", "registry-table-tbody"];
    skeletons.forEach(id => {
        const target = document.getElementById(id);
        if (target) {
            target.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Reading database records...</td></tr>`;
        }
    });
}

function renderDataSyncFailureState(message) {
    const targets = ["recent-transactions-tbody", "books-table-tbody", "registry-table-tbody"];
    targets.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ef4444; padding:20px; font-weight:500;"><i class="fa-solid fa-triangle-exclamation"></i> Sync Timeout: Unable to query records from server.</td></tr>`;
        }
    });
}

function escapeHtml(string) {
    return String(string).replace(/[&<>"']/g, function (s) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s];
    });
}

// 10. Global Window Scope Execution Registration
window.switchTab = switchTab;
window.openModal = openModal;
window.closeModal = closeModal;
window.filterBooks = filterBooks;
window.filterRegistry = filterRegistry;
window.handleInitialBookAdd = handleBookAdd; // Matches onsubmit signature from HTML form precisely
window.handleBookIssue = handleBookIssue;
window.handleBookDelete = handleBookDelete;
window.handleReturnBook = handleReturnBook;
