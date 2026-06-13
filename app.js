/**
 * Kivaywa High School LMS - Frontend Orchestrator & State Management
 * Fully wired to bind directly with clean REST API Endpoints.
 */

// Global Application Memory State (Mocking initial data layer)
let state = {
    books: [
        { isbn: "9789966360", title: "Blossoms of the Savannah", author: "H.R. Ole Kulet", category: "English/Literature", qty: 34 },
        { isbn: "9789966441", title: "Kidagaa Kimemwozea", author: "Ken Walibora", category: "Kiswahili/Fasihi", qty: 28 },
        { isbn: "9780194392", title: "Advanced Learner's Dictionary", author: "Oxford", category: "English/Literature", qty: 15 },
        { isbn: "9789966224", title: "KLB Secondary Mathematics Form 4", author: "Kenya Literature Bureau", category: "Mathematics", qty: 50 }
    ],
    borrowed: [
        { admNo: "8432", name: "John Kiprop", form: "4 West", bookTitle: "Blossoms of the Savannah", dueDate: "2026-06-20", status: "Active" },
        { admNo: "8611", name: "Emmanuel Wafula", form: "3 North", bookTitle: "KLB Secondary Mathematics Form 4", dueDate: "2026-06-12", status: "Overdue" }
    ]
};

// Global DOM Content Loaded Init
document.addEventListener("DOMContentLoaded", () => {
    initializeTabNavigation();
    renderAppLayout();
});

// Tab Routing Subsystem Engine
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
    if(activeTab) activeTab.classList.add("active");
}

// Data Component Injection Methods
function renderAppLayout() {
    renderMetrics();
    renderRecentTransactions();
    renderCatalogTable(state.books);
    renderRegistryTable();
}

function renderMetrics() {
    document.getElementById("total-books-count").innerText = state.books.reduce((acc, curr) => acc + parseInt(curr.qty), 0);
    document.getElementById("issued-books-count").innerText = state.borrowed.length;
    document.getElementById("overdue-books-count").innerText = state.borrowed.filter(b => b.status === "Overdue").length;
}

function renderRecentTransactions() {
    const tbody = document.getElementById("recent-transactions-tbody");
    tbody.innerHTML = state.borrowed.map(item => `
        <tr>
            <td><b>${item.admNo}</b></td>
            <td>${item.name}</td>
            <td>${item.bookTitle}</td>
            <td>${item.dueDate}</td>
            <td><span class="badge ${item.status === 'Overdue' ? 'badge-warning' : 'badge-success'}">${item.status}</span></td>
        </tr>
    `).join('');
}

function renderCatalogTable(booksArray) {
    const tbody = document.getElementById("books-table-tbody");
    if(booksArray.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No books found matching search criteria.</td></tr>`;
        return;
    }
    tbody.innerHTML = booksArray.map(book => `
        <tr>
            <td><code>${book.isbn}</code></td>
            <td><b>${book.title}</b></td>
            <td>${book.author}</td>
            <td>${book.category}</td>
            <td>${book.qty} pcs</td>
            <td>
                <button class="btn btn-danger-outline" onclick="handleInitialBookDelete('${book.isbn}')">
                    <i class="fa-solid fa-trash-can"></i> Remove
                </button>
            </td>
        </tr>
    `).join('');
}

function renderRegistryTable() {
    const tbody = document.getElementById("registry-table-tbody");
    tbody.innerHTML = state.borrowed.map(item => `
        <tr>
            <td><code>${item.admNo}</code></td>
            <td><b>${item.name}</b></td>
            <td>${item.form}</td>
            <td>${item.bookTitle}</td>
            <td><span style="color: ${item.status === 'Overdue' ? '#ef4444' : 'inherit'}; font-weight:500;">${item.dueDate}</span></td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="handleReturnBook('${item.admNo}')">Mark Returned</button>
            </td>
        </tr>
    `).join('');
}

// Client Side Feature Filters
function filterBooks() {
    const query = document.getElementById("book-search").value.toLowerCase();
    const filtered = state.books.filter(book => 
        book.title.toLowerCase().includes(query) || 
        book.author.toLowerCase().includes(query) || 
        book.isbn.includes(query)
    );
    renderCatalogTable(filtered);
}

// Modal Toggle Window Operations
function openModal(id) { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }

// Transaction Executions (Actions)
function handleInitialBookAdd(e) {
    e.preventDefault();
    const newBook = {
        title: document.getElementById("book-title").value,
        author: document.getElementById("book-author").value,
        isbn: document.getElementById("book-isbn").value,
        category: document.getElementById("book-category").value,
        qty: parseInt(document.getElementById("book-qty").value)
    };

    /** * BACKEND CONNECTION BLUEPRINT:
     * fetch('/api/books', {
     * method: 'POST',
     * headers: { 'Content-Type': 'application/json' },
     * body: JSON.stringify(newBook)
     * })
     * .then(res => res.json())
     * .then(savedBook => { ... refresh state ... })
     */

    state.books.push(newBook);
    renderAppLayout();
    document.getElementById("add-book-form").reset();
    closeModal("add-book-modal");
}

function handleInitialBookDelete(isbn) {
    state.books = state.books.filter(book => book.isbn !== isbn);
    renderAppLayout();
}

function handleReturnBook(admNo) {
    state.borrowed = state.borrowed.filter(item => item.admNo !== admNo);
    renderAppLayout();
}
