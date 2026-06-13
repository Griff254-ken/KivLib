/**
 * Kivaywa Secondary School Library Management System
 * Professional Frontend Core - Version 3.0 (Enterprise Ready)
 * FULLY INTEGRATED with the Kivaywa HTML Dashboard
 * 
 * Features:
 * - Modular Service Layer Architecture (Backend Ready)
 * - Reactive State Management
 * - Dynamic Data Tables & UI Updates
 * - Advanced Search & Filtering
 * - Full CRUD Operations (Add, Edit, Delete, Issue, Return)
 * - Real-time Activity Logging
 * - Local Storage Persistence Layer
 * - No external dependencies beyond standard browser APIs
 * 
 * Author: Kivaywa IT Department
 */

// ===============================
// 1. GLOBAL APP STATE & CONFIGURATION
// ===============================

const APP_CONFIG = {
    API_MODE: false,           // Set to true to enable real backend calls
    API_BASE_URL: '/api/v1',
    STORAGE_KEY: 'kivaywa_library_v3',
    AUTO_REFRESH_INTERVAL: 30000,
    CACHE_TTL: 5 * 60 * 1000
};

const AppState = {
    books: [],
    loans: [],
    activityLog: [],
    filters: {
        category: 'All Categories',
        searchQuery: ''
    },
    stats: {
        totalBooks: 0,
        borrowedOut: 0,
        available: 0,
        lostDamaged: 0
    },
    ui: {
        isLoading: false,
        currentView: 'catalog',
        selectedBookId: null
    },
    listeners: new Set()
};

// ===============================
// 2. HELPER & UTILITY FUNCTIONS
// ===============================

function generateUniqueId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
}

function calculateDueDate() {
    const due = new Date();
    due.setDate(due.getDate() + 14);
    return due.toISOString();
}

function calculateOverdueDays(dueDateStr) {
    if (!dueDateStr) return 0;
    const due = new Date(dueDateStr);
    const today = new Date();
    const diffTime = today - due;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function recalculateStats() {
    const totalBooks = AppState.books.length;
    const borrowedOut = AppState.loans.filter(loan => !loan.returned).length;
    const lostDamaged = AppState.books.filter(b => b.status === 'lost' || b.status === 'damaged').length;
    const available = totalBooks - borrowedOut - lostDamaged;
    
    AppState.stats = {
        totalBooks,
        borrowedOut,
        available: available > 0 ? available : 0,
        lostDamaged
    };
    notifyStateChange();
}

function addActivityLog(action, type = 'system') {
    const logEntry = {
        id: generateUniqueId(),
        action,
        type,
        timestamp: new Date().toISOString(),
        timeAgo: 'Just now'
    };
    AppState.activityLog.unshift(logEntry);
    if (AppState.activityLog.length > 50) AppState.activityLog.pop();
    notifyStateChange();
}

function notifyStateChange() {
    AppState.listeners.forEach(listener => {
        try {
            listener(AppState);
        } catch (err) {
            console.error('State listener error:', err);
        }
    });
}

function subscribeToState(listener) {
    AppState.listeners.add(listener);
    return () => AppState.listeners.delete(listener);
}

// ===============================
// 3. BACKEND SERVICE LAYER (READY FOR API)
// ===============================

const APIService = {
    async request(endpoint, options = {}) {
        if (!APP_CONFIG.API_MODE) {
            await new Promise(resolve => setTimeout(resolve, 150));
            throw new Error('LOCAL_MODE');
        }
        const url = `${APP_CONFIG.API_BASE_URL}${endpoint}`;
        const response = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return response.json();
    },
    
    getMockBooks() {
        return [
            { id: 'BOK-0943', title: 'Blossoms of the Savannah', author: 'H. R. Ole Kulet', category: 'Languages', location: 'Shelf 3A (English Literature)', status: 'available', copies: 1 },
            { id: 'CHM-2210', title: 'KLB Secondary Chemistry Form 4', author: 'Kenya Literature Bureau', category: 'Science', location: 'Cabinet C-1 (Sciences Area)', status: 'borrowed', borrowedBy: 'John Jackson Onyango', borrowedDate: new Date(Date.now() - 12*86400000).toISOString(), dueDate: new Date(Date.now() + 2*86400000).toISOString(), copies: 1 },
            { id: 'COMP-404', title: 'Introduction to Computer Coding', author: 'Thomas H. Cormen', category: 'Science', location: 'Tech Lab Shelf A', status: 'overdue', borrowedBy: 'Alice Kamau', borrowedDate: new Date(Date.now() - 20*86400000).toISOString(), dueDate: new Date(Date.now() - 6*86400000).toISOString(), copies: 1 },
            { id: 'MATH-101', title: 'Advanced Mathematics for Secondary Schools', author: 'J. K. Mburu', category: 'Mathematics', location: 'Cabinet B-2', status: 'available', copies: 2 },
            { id: 'HIST-203', title: 'A History of Kenya', author: 'William R. Ochieng', category: 'Humanities', location: 'Shelf 2C', status: 'available', copies: 1 },
            { id: 'ENG-045', title: 'Kigogo', author: 'Pauline Kea', category: 'Languages', location: 'Shelf 3B', status: 'available', copies: 3 }
        ];
    },
    
    async saveBook(bookData) {
        const isNew = !bookData.id;
        let savedBook;
        
        if (!APP_CONFIG.API_MODE) {
            if (isNew) {
                savedBook = { ...bookData, id: generateUniqueId() };
                AppState.books.push(savedBook);
            } else {
                const index = AppState.books.findIndex(b => b.id === bookData.id);
                if (index !== -1) {
                    savedBook = { ...AppState.books[index], ...bookData };
                    AppState.books[index] = savedBook;
                }
            }
            this.persistToLocalStorage();
            return savedBook;
        }
        
        const endpoint = isNew ? '/books' : `/books/${bookData.id}`;
        const method = isNew ? 'POST' : 'PUT';
        const response = await this.request(endpoint, { method, body: JSON.stringify(bookData) });
        return response.data;
    },
    
    async deleteBook(bookId) {
        if (!APP_CONFIG.API_MODE) {
            AppState.books = AppState.books.filter(b => b.id !== bookId);
            AppState.loans = AppState.loans.filter(loan => loan.bookId !== bookId);
            this.persistToLocalStorage();
            return true;
        }
        await this.request(`/books/${bookId}`, { method: 'DELETE' });
        return true;
    },
    
    async issueBook(bookId, studentInfo) {
        const book = AppState.books.find(b => b.id === bookId);
        if (!book) throw new Error('Book not found');
        if (book.status === 'borrowed') throw new Error('Book is already borrowed');
        
        const loanRecord = {
            id: generateUniqueId(),
            bookId: book.id,
            bookTitle: book.title,
            studentName: studentInfo.name,
            studentForm: studentInfo.form,
            issuedDate: new Date().toISOString(),
            dueDate: calculateDueDate(),
            returned: false
        };
        
        if (!APP_CONFIG.API_MODE) {
            book.status = 'borrowed';
            book.borrowedBy = studentInfo.name;
            book.borrowedDate = loanRecord.issuedDate;
            book.dueDate = loanRecord.dueDate;
            AppState.loans.push(loanRecord);
            this.persistToLocalStorage();
            addActivityLog(`${studentInfo.name} (${studentInfo.form}) borrowed "${book.title}"`, 'borrow');
            return loanRecord;
        }
        
        const response = await this.request('/loans', { method: 'POST', body: JSON.stringify(loanRecord) });
        return response.data;
    },
    
    async returnBook(loanId) {
        const loanIndex = AppState.loans.findIndex(l => l.id === loanId);
        if (loanIndex === -1) throw new Error('Loan not found');
        
        const loan = AppState.loans[loanIndex];
        const book = AppState.books.find(b => b.id === loan.bookId);
        
        if (!APP_CONFIG.API_MODE) {
            loan.returned = true;
            loan.returnedDate = new Date().toISOString();
            if (book) {
                book.status = 'available';
                delete book.borrowedBy;
                delete book.borrowedDate;
                delete book.dueDate;
            }
            this.persistToLocalStorage();
            addActivityLog(`${loan.studentName} returned "${loan.bookTitle}"`, 'return');
            return loan;
        }
        
        const response = await this.request(`/loans/${loanId}/return`, { method: 'POST' });
        return response.data;
    },
    
    async sendOverdueAlert(loan) {
        addActivityLog(`Overdue alert sent to ${loan.studentName} for "${loan.bookTitle}"`, 'alert');
        if (!APP_CONFIG.API_MODE) return;
        await this.request(`/loans/${loan.id}/alert`, { method: 'POST' });
    },
    
    persistToLocalStorage() {
        const dataToStore = {
            books: AppState.books,
            loans: AppState.loans,
            activityLog: AppState.activityLog,
            lastUpdated: new Date().toISOString()
        };
        localStorage.setItem(APP_CONFIG.STORAGE_KEY, JSON.stringify(dataToStore));
        recalculateStats();
        notifyStateChange();
    },
    
    async initializeData() {
        try {
            const stored = localStorage.getItem(APP_CONFIG.STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                AppState.books = data.books || this.getMockBooks();
                AppState.loans = data.loans || [];
                AppState.activityLog = data.activityLog || [];
            } else {
                AppState.books = this.getMockBooks();
                AppState.loans = [];
                AppState.activityLog = [
                    { id: 'log1', action: 'David Otieno (Form 4B) returned "Kigogo"', type: 'return', timestamp: new Date().toISOString(), timeAgo: 'Just now' },
                    { id: 'log2', action: 'Mercy Chebet (Form 2 West) borrowed "KLB Mathematics Bk 2"', type: 'borrow', timestamp: new Date(Date.now() - 14 * 60000).toISOString(), timeAgo: '14 mins ago' }
                ];
            }
            
            // Sync loans with book statuses
            AppState.loans.forEach(loan => {
                if (!loan.returned) {
                    const book = AppState.books.find(b => b.id === loan.bookId);
                    if (book && book.status !== 'borrowed') {
                        book.status = 'borrowed';
                        book.borrowedBy = loan.studentName;
                        book.borrowedDate = loan.issuedDate;
                        book.dueDate = loan.dueDate;
                    }
                }
            });
            
            // Ensure overdue status is correctly set
            AppState.books.forEach(book => {
                if (book.status === 'borrowed' && book.dueDate) {
                    if (new Date(book.dueDate) < new Date()) {
                        book.status = 'overdue';
                    }
                }
            });
            
            recalculateStats();
            notifyStateChange();
        } catch (error) {
            console.error('Data initialization failed:', error);
        }
    }
};

// ===============================
// 4. DOM UTILITIES & RENDERERS
// ===============================

const DOM = {
    // Stats elements
    totalBooksEl: document.getElementById('stat-total'),
    borrowedOutEl: document.getElementById('stat-borrowed'),
    availableEl: document.getElementById('stat-available'),
    lostDamagedEl: document.getElementById('stat-lost'),
    // Table body
    tableBody: document.getElementById('books-table-body'),
    emptyStateEl: document.getElementById('table-empty-state'),
    // Activity log container
    activityLogContainer: document.getElementById('activity-feed'),
    // Form elements
    addBookForm: document.getElementById('add-book-form'),
    titleInput: document.getElementById('book-title'),
    authorInput: document.getElementById('book-author'),
    categorySelect: document.getElementById('book-category'),
    locationInput: document.getElementById('book-location'),
    // Filter elements
    filterButtons: document.querySelectorAll('.filter-chip'),
    searchInput: document.getElementById('global-search'),
    // Overdue notice elements
    overdueText: document.getElementById('overdue-text'),
    viewOverdueBtn: document.getElementById('view-overdue-btn'),
    // Showing count
    showingCount: document.getElementById('showing-count'),
    // Sidebar nav
    navCatalog: document.getElementById('nav-catalog'),
    navLoans: document.getElementById('nav-loans'),
    navRegistry: document.getElementById('nav-registry'),
    navOverdue: document.getElementById('nav-overdue'),
    navBookCount: document.getElementById('nav-book-count')
};

function renderBooksTable() {
    if (!DOM.tableBody) return;
    
    let filteredBooks = [...AppState.books];
    
    if (AppState.filters.category !== 'All Categories') {
        filteredBooks = filteredBooks.filter(book => book.category === AppState.filters.category);
    }
    
    if (AppState.filters.searchQuery) {
        const query = AppState.filters.searchQuery.toLowerCase();
        filteredBooks = filteredBooks.filter(book => 
            book.title.toLowerCase().includes(query) ||
            book.author.toLowerCase().includes(query) ||
            (book.id && book.id.toLowerCase().includes(query))
        );
    }
    
    if (DOM.showingCount) DOM.showingCount.textContent = filteredBooks.length;
    if (DOM.navBookCount) DOM.navBookCount.textContent = AppState.books.length;
    
    if (filteredBooks.length === 0) {
        if (DOM.tableBody) DOM.tableBody.innerHTML = '';
        if (DOM.emptyStateEl) DOM.emptyStateEl.classList.remove('hidden');
        return;
    }
    
    if (DOM.emptyStateEl) DOM.emptyStateEl.classList.add('hidden');
    
    const rowsHtml = filteredBooks.map(book => {
        let statusHtml = '';
        let actionButtonHtml = '';
        let loanInfoHtml = '';
        
        if (book.status === 'available') {
            statusHtml = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> Available
            </span>`;
            actionButtonHtml = `<button class="issue-book-btn bg-cyan-500/10 hover:bg-cyan-500 text-cyan-300 hover:text-black border border-cyan-500/20 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all" data-book-id="${book.id}">Issue →</button>`;
        } else if (book.status === 'borrowed') {
            const loan = AppState.loans.find(l => l.bookId === book.id && !l.returned);
            statusHtml = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <span class="h-1.5 w-1.5 rounded-full bg-amber-400"></span> Borrowed
            </span>`;
            loanInfoHtml = `<div class="text-[11px] text-slate-300 font-medium mt-1">${escapeHtml(book.borrowedBy || 'Student')} • Due ${formatDate(book.dueDate)}</div>`;
            actionButtonHtml = `<button class="return-book-btn bg-emerald-500/10 hover:bg-emerald-500 text-emerald-300 hover:text-black border border-emerald-500/20 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all" data-loan-id="${loan?.id}">Return</button>`;
        } else if (book.status === 'overdue') {
            const loan = AppState.loans.find(l => l.bookId === book.id && !l.returned);
            statusHtml = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <span class="h-1.5 w-1.5 rounded-full bg-rose-500 live-dot"></span> Overdue
            </span>`;
            loanInfoHtml = `<div class="text-[11px] text-rose-300 font-semibold mt-1">${escapeHtml(book.borrowedBy || 'Student')} • Overdue ${calculateOverdueDays(book.dueDate)} days</div>`;
            actionButtonHtml = `<button class="send-alert-btn bg-amber-500/10 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/20 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all" data-loan-id="${loan?.id}">Send Alert</button>`;
        }
        
        return `
            <tr class="table-row-hover transition">
                <td class="px-6 py-4">
                    <div class="font-bold text-white text-sm">${escapeHtml(book.title)}</div>
                    <div class="text-slate-400 text-xs mt-0.5">by ${escapeHtml(book.author)} • <span class="text-slate-500 font-mono text-[11px]">ID: ${escapeHtml(book.id)}</span></div>
                </td>
                <td class="px-6 py-4 text-sm text-slate-300">${escapeHtml(book.location || 'Not specified')}</td>
                <td class="px-6 py-4">
                    ${statusHtml}
                    ${loanInfoHtml}
                </td>
                <td class="px-6 py-4 text-right whitespace-nowrap">
                    ${actionButtonHtml}
                    <button class="delete-book-btn text-slate-500 hover:text-rose-400 ml-2 transition text-base" data-book-id="${book.id}" title="Delete">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
    
    DOM.tableBody.innerHTML = rowsHtml;
    
    // Attach event listeners
    document.querySelectorAll('.issue-book-btn').forEach(btn => {
        btn.removeEventListener('click', handleIssueClick);
        btn.addEventListener('click', handleIssueClick);
    });
    document.querySelectorAll('.return-book-btn').forEach(btn => {
        btn.removeEventListener('click', handleReturnClick);
        btn.addEventListener('click', handleReturnClick);
    });
    document.querySelectorAll('.send-alert-btn').forEach(btn => {
        btn.removeEventListener('click', handleAlertClick);
        btn.addEventListener('click', handleAlertClick);
    });
    document.querySelectorAll('.delete-book-btn').forEach(btn => {
        btn.removeEventListener('click', handleDeleteClick);
        btn.addEventListener('click', handleDeleteClick);
    });
}

function renderActivityLog() {
    if (!DOM.activityLogContainer) return;
    
    const logsHtml = AppState.activityLog.slice(0, 5).map(log => {
        let icon = '📝';
        if (log.type === 'borrow') icon = '📤';
        if (log.type === 'return') icon = '📥';
        if (log.type === 'alert') icon = '⚠️';
        if (log.type === 'add') icon = '➕';
        if (log.type === 'delete') icon = '🗑️';
        
        return `
            <div class="flex items-start gap-3 pb-3 border-b border-white/5">
                <span class="text-cyan-400 text-sm pt-0.5">${icon}</span>
                <div>
                    <p class="text-xs font-medium text-slate-200">${escapeHtml(log.action)}</p>
                    <span class="text-[10px] text-slate-500">${log.timeAgo || formatDate(log.timestamp)}</span>
                </div>
            </div>
        `;
    }).join('');
    
    DOM.activityLogContainer.innerHTML = logsHtml || '<div class="text-center text-slate-500 text-xs py-4">No recent activity</div>';
}

function updateStatsUI() {
    if (DOM.totalBooksEl) DOM.totalBooksEl.textContent = AppState.stats.totalBooks;
    if (DOM.borrowedOutEl) DOM.borrowedOutEl.textContent = AppState.stats.borrowedOut;
    if (DOM.availableEl) DOM.availableEl.textContent = AppState.stats.available;
    if (DOM.lostDamagedEl) DOM.lostDamagedEl.textContent = AppState.stats.lostDamaged;
    
    const overdueCount = AppState.books.filter(b => b.status === 'overdue').length;
    if (DOM.overdueText) {
        DOM.overdueText.textContent = `There ${overdueCount === 1 ? 'is' : 'are'} currently ${overdueCount} book${overdueCount !== 1 ? 's' : ''} overdue for return. Immediate action recommended.`;
    }
}

// ===============================
// 5. EVENT HANDLERS
// ===============================

async function handleAddBook(event) {
    event.preventDefault();
    
    if (!DOM.titleInput.value.trim()) {
        alert('Please enter a book title');
        return;
    }
    
    const newBook = {
        title: DOM.titleInput.value.trim(),
        author: DOM.authorInput.value.trim() || 'Unknown Author',
        category: DOM.categorySelect.value,
        location: DOM.locationInput.value.trim() || 'Main Library',
        status: 'available',
        copies: 1
    };
    
    try {
        const savedBook = await APIService.saveBook(newBook);
        addActivityLog(`Added new book: "${savedBook.title}"`, 'add');
        renderBooksTable();
        updateStatsUI();
        
        DOM.titleInput.value = '';
        DOM.authorInput.value = '';
        DOM.locationInput.value = '';
        DOM.categorySelect.selectedIndex = 0;
    } catch (error) {
        console.error('Failed to add book:', error);
        alert('Failed to add book. Please try again.');
    }
}

async function handleIssueClick(event) {
    const button = event.currentTarget;
    const bookId = button.getAttribute('data-book-id');
    const book = AppState.books.find(b => b.id === bookId);
    if (!book) return;
    
    const studentName = prompt(`Enter student name for "${book.title}":`);
    if (!studentName) return;
    
    const studentForm = prompt('Enter student form (e.g., Form 3A):', 'Form 3A');
    if (!studentForm) return;
    
    try {
        await APIService.issueBook(bookId, { name: studentName, form: studentForm });
        renderBooksTable();
        renderActivityLog();
        updateStatsUI();
    } catch (error) {
        console.error('Failed to issue book:', error);
        alert(error.message || 'Failed to issue book.');
    }
}

async function handleReturnClick(event) {
    const button = event.currentTarget;
    const loanId = button.getAttribute('data-loan-id');
    if (!loanId) return;
    
    if (confirm('Confirm book return?')) {
        try {
            await APIService.returnBook(loanId);
            renderBooksTable();
            renderActivityLog();
            updateStatsUI();
        } catch (error) {
            console.error('Failed to return book:', error);
            alert('Failed to process return.');
        }
    }
}

async function handleAlertClick(event) {
    const button = event.currentTarget;
    const loanId = button.getAttribute('data-loan-id');
    const loan = AppState.loans.find(l => l.id === loanId);
    
    if (loan) {
        await APIService.sendOverdueAlert(loan);
        renderActivityLog();
        alert(`Overdue reminder sent to ${loan.studentName}`);
    }
}

async function handleDeleteClick(event) {
    const button = event.currentTarget;
    const bookId = button.getAttribute('data-book-id');
    const book = AppState.books.find(b => b.id === bookId);
    
    if (book && confirm(`Permanently delete "${book.title}" from records?`)) {
        try {
            await APIService.deleteBook(bookId);
            addActivityLog(`Deleted book: "${book.title}"`, 'delete');
            renderBooksTable();
            renderActivityLog();
            updateStatsUI();
        } catch (error) {
            console.error('Failed to delete book:', error);
            alert('Failed to delete book.');
        }
    }
}

function handleFilterClick(event) {
    const button = event.currentTarget;
    const category = button.getAttribute('data-category');
    
    DOM.filterButtons.forEach(btn => {
        btn.classList.remove('bg-cyan-950', 'text-cyan-400', 'border-cyan-500/20');
        btn.classList.add('text-slate-400');
    });
    button.classList.remove('text-slate-400');
    button.classList.add('bg-cyan-950', 'text-cyan-400', 'border-cyan-500/20');
    
    AppState.filters.category = category;
    renderBooksTable();
}

function handleSearchInput(event) {
    AppState.filters.searchQuery = event.target.value;
    renderBooksTable();
}

// ===============================
// 6. INITIALIZATION
// ===============================

async function initializeApp() {
    console.log('🚀 Kivaywa Library System initializing...');
    
    await APIService.initializeData();
    
    renderBooksTable();
    renderActivityLog();
    updateStatsUI();
    
    subscribeToState(() => {
        renderBooksTable();
        renderActivityLog();
        updateStatsUI();
    });
    
    if (DOM.addBookForm) {
        DOM.addBookForm.addEventListener('submit', handleAddBook);
    }
    
    if (DOM.filterButtons) {
        DOM.filterButtons.forEach(btn => {
            btn.removeEventListener('click', handleFilterClick);
            btn.addEventListener('click', handleFilterClick);
        });
    }
    
    if (DOM.searchInput) {
        DOM.searchInput.addEventListener('input', handleSearchInput);
    }
    
    if (DOM.viewOverdueBtn) {
        DOM.viewOverdueBtn.addEventListener('click', () => {
            AppState.filters.category = 'All Categories';
            AppState.filters.searchQuery = '';
            if (DOM.searchInput) DOM.searchInput.value = '';
            renderBooksTable();
            const overdueBooks = AppState.books.filter(b => b.status === 'overdue');
            if (overdueBooks.length > 0) {
                alert(`📖 Overdue Books (${overdueBooks.length}):\n${overdueBooks.map(b => `- ${b.title} (borrowed by ${b.borrowedBy})`).join('\n')}`);
            } else {
                alert('No overdue books at this time.');
            }
        });
    }
    
    console.log('✅ Library system ready. API Mode:', APP_CONFIG.API_MODE);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
