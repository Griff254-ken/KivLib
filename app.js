/**
 * Kivaywa Secondary School Library Management System
 * Professional Frontend Core - Version 3.0 (Enterprise Ready)
 * 
 * Features:
 * - Modular Service Layer Architecture (Backend Ready)
 * - Reactive State Management
 * - Dynamic Data Tables & UI Updates
 * - Advanced Search & Filtering
 * - Full CRUD Operations (Add, Edit, Delete, Issue, Return)
 * - Real-time Activity Logging
 * - Local Storage Persistence Layer (for demo, easily swappable with API)
 * - No external dependencies beyond standard browser APIs
 * 
 * Author: Kivaywa IT Department
 * License: School Internal Use
 */

// ===============================
// 1. GLOBAL APP STATE & CONFIGURATION
// ===============================

/**
 * App Configuration
 * Toggle API_MODE to true when backend endpoints are ready.
 * All service calls route through a unified API handler.
 */
const APP_CONFIG = {
    API_MODE: false,           // Set to true to enable real backend calls
    API_BASE_URL: '/api/v1',   // Base path for backend endpoints
    STORAGE_KEY: 'kivaywa_library_data',
    AUTO_REFRESH_INTERVAL: 30000, // 30 seconds for auto-refresh (optional)
    CACHE_TTL: 5 * 60 * 1000      // 5 minutes cache TTL
};

/**
 * Core Application State
 * Single source of truth for the dashboard.
 * All UI mutations are derived from this state.
 */
const AppState = {
    books: [],                 // Array of book objects
    loans: [],                // Array of active loans
    activityLog: [],          // Array of recent activities
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
        currentView: 'catalog', // catalog, loans, registry
        selectedBookId: null
    },
    listeners: new Set()      // Reactive subscription handlers
};

// ===============================
// 2. HELPER & UTILITY FUNCTIONS
// ===============================

/**
 * Generates a unique ID for new records
 * @returns {string} Unique identifier
 */
function generateUniqueId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Formats date to localized string
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
}

/**
 * Calculates due date based on current date + 14 days
 * @returns {string} ISO date string
 */
function calculateDueDate() {
    const due = new Date();
    due.setDate(due.getDate() + 14);
    return due.toISOString();
}

/**
 * Updates app statistics based on current books and loans
 */
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

/**
 * Adds an activity log entry
 * @param {string} action - Description of action
 * @param {string} type - Type of activity (borrow, return, add, delete)
 */
function addActivityLog(action, type = 'system') {
    const logEntry = {
        id: generateUniqueId(),
        action,
        type,
        timestamp: new Date().toISOString(),
        timeAgo: 'Just now'
    };
    AppState.activityLog.unshift(logEntry);
    // Keep only last 50 entries
    if (AppState.activityLog.length > 50) AppState.activityLog.pop();
    notifyStateChange();
}

// ===============================
// 3. BACKEND SERVICE LAYER (READY FOR API)
// ===============================

/**
 * Unified API Service
 * Abstracts fetch logic. When APP_CONFIG.API_MODE = true, sends real requests.
 * For demo/local development, uses localStorage persistence.
 */
const APIService = {
    /**
     * Generic request handler for backend communication
     * @param {string} endpoint - API endpoint
     * @param {object} options - Fetch options
     * @returns {Promise<any>} Response data
     */
    async request(endpoint, options = {}) {
        if (!APP_CONFIG.API_MODE) {
            // Simulate network delay for realistic UX
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
    
    /**
     * Fetches all books from backend or local storage
     * @returns {Promise<Array>} List of books
     */
    async fetchBooks() {
        if (!APP_CONFIG.API_MODE) {
            const stored = localStorage.getItem(APP_CONFIG.STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                return data.books || [];
            }
            // Return initial mock data
            return this.getMockBooks();
        }
        const response = await this.request('/books');
        return response.data;
    },
    
    /**
     * Saves book (create/update) to backend or local storage
     * @param {object} bookData - Book object
     * @returns {Promise<object>} Saved book
     */
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
        savedBook = response.data;
        return savedBook;
    },
    
    /**
     * Deletes a book
     * @param {string} bookId - ID of book to delete
     * @returns {Promise<boolean>} Success status
     */
    async deleteBook(bookId) {
        if (!APP_CONFIG.API_MODE) {
            AppState.books = AppState.books.filter(b => b.id !== bookId);
            // Also remove any loans associated
            AppState.loans = AppState.loans.filter(loan => loan.bookId !== bookId);
            this.persistToLocalStorage();
            return true;
        }
        await this.request(`/books/${bookId}`, { method: 'DELETE' });
        return true;
    },
    
    /**
     * Issues a book to a student
     * @param {string} bookId - Book ID
     * @param {object} studentInfo - Student details
     * @returns {Promise<object>} Loan record
     */
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
            // Update book status
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
    
    /**
     * Processes a book return
     * @param {string} loanId - Loan record ID
     * @returns {Promise<object>} Updated loan
     */
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
    
    /**
     * Sends an overdue alert (simulated)
     * @param {object} loan - Loan record
     * @returns {Promise<void>}
     */
    async sendOverdueAlert(loan) {
        addActivityLog(`Overdue alert sent to ${loan.studentName} for "${loan.bookTitle}"`, 'alert');
        if (!APP_CONFIG.API_MODE) return;
        await this.request(`/loans/${loan.id}/alert`, { method: 'POST' });
    },
    
    /**
     * Persists current state to localStorage
     */
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
    
    /**
     * Loads initial mock data for first-time setup
     * @returns {Array} Mock books
     */
    getMockBooks() {
        return [
            { id: 'BOK-0943', title: 'Blossoms of the Savannah', author: 'H. R. Ole Kulet', category: 'Languages', location: 'Shelf 3A (English Literature)', status: 'available', copies: 1 },
            { id: 'CHM-2210', title: 'KLB Secondary Chemistry Form 4', author: 'Kenya Literature Bureau', category: 'Science', location: 'Cabinet C-1 (Sciences Area)', status: 'borrowed', borrowedBy: 'John Jackson Onyango', borrowedDate: '2025-06-04T10:00:00Z', dueDate: '2025-06-18T10:00:00Z', copies: 1 },
            { id: 'COMP-404', title: 'Introduction to Computer Coding', author: 'Thomas H. Cormen', category: 'Science', location: 'Tech Lab Shelf A', status: 'overdue', borrowedBy: 'Alice Kamau', borrowedDate: '2025-05-28T10:00:00Z', dueDate: '2025-06-11T10:00:00Z', copies: 1 },
            { id: 'MATH-101', title: 'Advanced Mathematics for Secondary Schools', author: 'J. K. Mburu', category: 'Mathematics', location: 'Cabinet B-2', status: 'available', copies: 2 },
            { id: 'HIST-203', title: 'A History of Kenya', author: 'William R. Ochieng', category: 'Humanities', location: 'Shelf 2C', status: 'available', copies: 1 }
        ];
    },
    
    /**
     * Initializes the application data
     * @returns {Promise<void>}
     */
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
            recalculateStats();
            notifyStateChange();
        } catch (error) {
            console.error('Data initialization failed:', error);
        }
    }
};

// ===============================
// 4. REACTIVE STATE MANAGEMENT
// ===============================

/**
 * Notifies all registered listeners that state has changed
 */
function notifyStateChange() {
    AppState.listeners.forEach(listener => {
        try {
            listener(AppState);
        } catch (err) {
            console.error('State listener error:', err);
        }
    });
}

/**
 * Subscribes to state changes
 * @param {function} listener - Callback function
 * @returns {function} Unsubscribe function
 */
function subscribeToState(listener) {
    AppState.listeners.add(listener);
    return () => AppState.listeners.delete(listener);
}

// ===============================
// 5. DOM UTILITIES & RENDERERS
// ===============================

/**
 * DOM Element References
 */
const DOM = {
    // Stats elements
    totalBooksEl: document.querySelector('.glass-card:first-child .text-3xl'),
    borrowedOutEl: document.querySelector('.glass-card:nth-child(2) .text-3xl'),
    availableEl: document.querySelector('.glass-card:nth-child(3) .text-3xl'),
    lostDamagedEl: document.querySelector('.glass-card:nth-child(4) .text-3xl'),
    // Table body
    tableBody: document.querySelector('table tbody'),
    emptyStateEl: document.getElementById('table-empty-state'),
    // Activity log container
    activityLogContainer: document.querySelector('.glass-card:last-child .space-y-3\\.5'),
    // Form elements
    addBookForm: document.querySelector('.glass-card:first-child form'),
    // Filter elements
    filterButtons: document.querySelectorAll('.flex.items-center.space-x-1\\.5 button'),
    searchInput: document.querySelector('header input[type="text"]'),
    // Overdue notice bar
    overdueBar: document.querySelector('.bg-gradient-to-r.from-amber-500\\/10'),
    overdueButton: document.querySelector('.bg-gradient-to-r.from-amber-500\\/10 button')
};

/**
 * Renders the book table based on current filters and state
 */
function renderBooksTable() {
    if (!DOM.tableBody) return;
    
    let filteredBooks = [...AppState.books];
    
    // Apply category filter
    if (AppState.filters.category !== 'All Categories') {
        filteredBooks = filteredBooks.filter(book => book.category === AppState.filters.category);
    }
    
    // Apply search query
    if (AppState.filters.searchQuery) {
        const query = AppState.filters.searchQuery.toLowerCase();
        filteredBooks = filteredBooks.filter(book => 
            book.title.toLowerCase().includes(query) ||
            book.author.toLowerCase().includes(query) ||
            (book.id && book.id.toLowerCase().includes(query))
        );
    }
    
    // Update filter count display
    const showingSpan = document.querySelector('.text-slate-400 .text-white.font-bold');
    if (showingSpan) showingSpan.textContent = filteredBooks.length;
    
    // Show/hide empty state
    if (filteredBooks.length === 0) {
        if (DOM.tableBody) DOM.tableBody.innerHTML = '';
        if (DOM.emptyStateEl) DOM.emptyStateEl.classList.remove('hidden');
        return;
    }
    
    if (DOM.emptyStateEl) DOM.emptyStateEl.classList.add('hidden');
    
    // Generate table rows
    const rowsHtml = filteredBooks.map(book => {
        let statusHtml = '';
        let actionButtonHtml = '';
        let loanInfoHtml = '';
        
        // Determine status display
        if (book.status === 'available') {
            statusHtml = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> Available on Shelf
            </span>`;
            actionButtonHtml = `<button class="issue-book-btn bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-black border border-cyan-500/20 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer" data-book-id="${book.id}">
                Issue to Student
            </button>`;
        } else if (book.status === 'borrowed') {
            const loan = AppState.loans.find(l => l.bookId === book.id && !l.returned);
            statusHtml = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <span class="h-1.5 w-1.5 rounded-full bg-amber-400"></span> Borrowed Out
            </span>`;
            loanInfoHtml = `<div class="text-[11px] text-slate-300 font-bold mt-1">${book.borrowedBy || 'Student'}</div>
                            <div class="text-[10px] text-slate-500">Due ${formatDate(book.dueDate)}</div>`;
            actionButtonHtml = `<button class="return-book-btn bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-black border border-emerald-500/20 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer" data-loan-id="${loan?.id}">
                Process Book Return
            </button>`;
        } else if (book.status === 'overdue') {
            const loan = AppState.loans.find(l => l.bookId === book.id && !l.returned);
            statusHtml = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <span class="h-1.5 w-1.5 rounded-full bg-rose-500"></span> Overdue for Return
            </span>`;
            loanInfoHtml = `<div class="text-[11px] text-slate-300 font-bold mt-1">${book.borrowedBy || 'Student'}</div>
                            <div class="text-[10px] text-rose-400 font-semibold">Overdue by ${calculateOverdueDays(book.dueDate)} days</div>`;
            actionButtonHtml = `<button class="send-alert-btn bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-black border border-amber-500/20 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer" data-loan-id="${loan?.id}">
                Send Alert to Student
            </button>`;
        }
        
        return `
            <tr class="hover:bg-slate-900/20 transition-colors" data-book-id="${book.id}">
                <td class="px-6 py-4.5">
                    <div class="font-bold text-slate-200 text-sm">${escapeHtml(book.title)}</div>
                    <div class="text-slate-400 font-medium mt-0.5">by ${escapeHtml(book.author)} <span class="text-slate-600 px-1">•</span> <span class="text-[11px] text-slate-500 font-mono">ID: ${escapeHtml(book.id)}</span></div>
                </td>
                <td class="px-6 py-4.5 font-medium text-slate-400">
                    ${escapeHtml(book.location || 'Not specified')}
                </td>
                <td class="px-6 py-4.5">
                    ${statusHtml}
                    ${loanInfoHtml}
                </td>
                <td class="px-6 py-4.5 text-right space-x-1.5 whitespace-nowrap">
                    ${actionButtonHtml}
                    <button class="delete-book-btn text-slate-500 hover:text-rose-400 px-2 py-1.5 rounded-lg transition-all cursor-pointer" data-book-id="${book.id}" title="Delete Book From Records">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
    
    DOM.tableBody.innerHTML = rowsHtml;
    
    // Attach event listeners to dynamically generated buttons
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

/**
 * Calculate overdue days
 */
function calculateOverdueDays(dueDateStr) {
    if (!dueDateStr) return 0;
    const due = new Date(dueDateStr);
    const today = new Date();
    const diffTime = today - due;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
}

/**
 * Renders the activity log
 */
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
            <div class="flex items-start space-x-3 text-xs border-b border-slate-900/60 pb-3">
                <span class="text-cyan-400 pt-0.5">${icon}</span>
                <div>
                    <p class="text-slate-300 font-medium">${escapeHtml(log.action)}</p>
                    <span class="text-[10px] text-slate-500">${log.timeAgo || formatDate(log.timestamp)}</span>
                </div>
            </div>
        `;
    }).join('');
    
    DOM.activityLogContainer.innerHTML = logsHtml || '<div class="text-center text-slate-500 text-xs">No recent activity</div>';
}

/**
 * Updates statistics in the UI
 */
function updateStatsUI() {
    if (DOM.totalBooksEl) DOM.totalBooksEl.textContent = AppState.stats.totalBooks;
    if (DOM.borrowedOutEl) DOM.borrowedOutEl.textContent = AppState.stats.borrowedOut;
    if (DOM.availableEl) DOM.availableEl.textContent = AppState.stats.available;
    if (DOM.lostDamagedEl) DOM.lostDamagedEl.textContent = AppState.stats.lostDamaged;
    
    // Update overdue notice bar
    const overdueCount = AppState.books.filter(b => b.status === 'overdue').length;
    if (DOM.overdueBar) {
        const noticeText = DOM.overdueBar.querySelector('p');
        if (noticeText) {
            noticeText.textContent = `There ${overdueCount === 1 ? 'is' : 'are'} currently ${overdueCount} book${overdueCount !== 1 ? 's' : ''} overdue for return. Please check the active loans tab to send reminders.`;
        }
    }
}

/**
 * Simple HTML escape to prevent XSS
 */
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ===============================
// 6. EVENT HANDLERS (USER INTERACTIONS)
// ===============================

/**
 * Handles adding a new book
 */
async function handleAddBook(event) {
    event.preventDefault();
    
    const form = DOM.addBookForm;
    const titleInput = form.querySelector('input[placeholder*="Book Title"]');
    const authorInput = form.querySelector('input[placeholder*="Author"]');
    const categorySelect = form.querySelector('select');
    const locationInput = form.querySelector('input[placeholder*="Shelf Location"]');
    
    if (!titleInput.value.trim()) {
        alert('Please enter a book title');
        return;
    }
    
    const newBook = {
        title: titleInput.value.trim(),
        author: authorInput.value.trim() || 'Unknown Author',
        category: categorySelect.value,
        location: locationInput.value.trim() || 'Main Library',
        status: 'available',
        copies: 1
    };
    
    try {
        const savedBook = await APIService.saveBook(newBook);
        addActivityLog(`Added new book: "${savedBook.title}"`, 'add');
        renderBooksTable();
        updateStatsUI();
        
        // Clear form
        titleInput.value = '';
        authorInput.value = '';
        locationInput.value = '';
        categorySelect.selectedIndex = 0;
    } catch (error) {
        console.error('Failed to add book:', error);
        alert('Failed to add book. Please try again.');
    }
}

/**
 * Handles issuing a book to a student
 * @param {Event} event - Click event
 */
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
        alert(error.message || 'Failed to issue book. Please try again.');
    }
}

/**
 * Handles returning a book
 */
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
            alert('Failed to process return. Please try again.');
        }
    }
}

/**
 * Handles sending overdue alert
 */
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

/**
 * Handles deleting a book
 */
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
            alert('Failed to delete book. Please try again.');
        }
    }
}

/**
 * Handles filter button clicks
 */
function handleFilterClick(event) {
    const button = event.currentTarget;
    const category = button.textContent.trim();
    
    // Update active button style
    DOM.filterButtons.forEach(btn => {
        btn.classList.remove('bg-cyan-950', 'text-cyan-400', 'border-cyan-500/20');
        btn.classList.add('text-slate-400');
    });
    button.classList.remove('text-slate-400');
    button.classList.add('bg-cyan-950', 'text-cyan-400', 'border-cyan-500/20');
    
    AppState.filters.category = category;
    renderBooksTable();
}

/**
 * Handles search input
 */
function handleSearchInput(event) {
    AppState.filters.searchQuery = event.target.value;
    renderBooksTable();
}

// ===============================
// 7. INITIALIZATION & SUBSCRIPTIONS
// ===============================

/**
 * Sets up all event listeners and subscriptions
 */
async function initializeApp() {
    // Show loading state (optional)
    console.log('Initializing Kivaywa Library System...');
    
    // Load data from storage/API
    await APIService.initializeData();
    
    // Initial renders
    renderBooksTable();
    renderActivityLog();
    updateStatsUI();
    
    // Subscribe to state changes for real-time UI updates
    subscribeToState(() => {
        renderBooksTable();
        renderActivityLog();
        updateStatsUI();
    });
    
    // Set up event listeners
    if (DOM.addBookForm) {
        DOM.addBookForm.addEventListener('submit', handleAddBook);
        const submitButton = DOM.addBookForm.querySelector('button[type="button"]');
        if (submitButton) submitButton.addEventListener('click', handleAddBook);
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
    
    if (DOM.overdueButton) {
        DOM.overdueButton.addEventListener('click', () => {
            AppState.filters.category = 'All Categories';
            AppState.filters.searchQuery = '';
            if (DOM.searchInput) DOM.searchInput.value = '';
            renderBooksTable();
            alert('Navigate to Active Student Loans section to manage overdue items.');
        });
    }
    
    // Setup navigation buttons (sidebar)
    const catalogBtn = document.querySelector('button:first-child');
    const loansBtn = document.querySelector('button:nth-child(2)');
    if (loansBtn) {
        loansBtn.addEventListener('click', () => {
            alert('Active Loans view: Would show currently borrowed books. (Feature ready for backend integration)');
        });
    }
    
    console.log('Library system ready. API Mode:', APP_CONFIG.API_MODE);
}

// Start the application when DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
