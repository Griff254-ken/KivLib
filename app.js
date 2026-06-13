/**
 * Kivaywa Secondary School - Library Management Dashboard Core JS
 * Architecture: Vanilla state-driven component management with structural updates.
 */

// ==========================================
// 1. SYSTEM STATE & SEED DATA
// ==========================================
const LibraryState = {
    books: [
        {
            id: "BOK-0943",
            title: "Blossoms of the Savannah",
            author: "H. R. Ole Kulet",
            category: "Languages",
            location: "Shelf 3A (English Lit)",
            status: "Available",
            borrower: null,
            dueDate: null,
            overdueDays: 0
        },
        {
            id: "CHM-2210",
            title: "KLB Secondary Chemistry Form 4",
            author: "Kenya Literature Bureau",
            category: "Science",
            location: "Cabinet C-1 (Sciences)",
            status: "Borrowed",
            borrower: "John O.",
            dueDate: "Jun 18",
            overdueDays: 0
        },
        {
            id: "COMP-404",
            title: "Introduction to Computer Coding",
            author: "Thomas H. Cormen",
            category: "Science",
            location: "Tech Lab Shelf A",
            status: "Overdue",
            borrower: "Alice Kamau",
            dueDate: "Jun 09",
            overdueDays: 4
        },
        {
            id: "MATH-101",
            title: "Advanced Mathematics for Sec Schools",
            author: "J. K. Mburu",
            category: "Mathematics",
            location: "Cabinet B-2 (Maths)",
            status: "Available",
            borrower: null,
            dueDate: null,
            overdueDays: 0
        },
        {
            id: "HIST-203",
            title: "A History of Kenya",
            author: "William R. Ochieng",
            category: "Humanities",
            location: "Shelf 2C (Humanities)",
            status: "Available",
            borrower: null,
            dueDate: null,
            overdueDays: 0
        }
    ],
    activities: [
        { type: 'return', user: 'David Otieno (Form 4B)', item: '"Kigogo"', meta: 'Just now • Handed back', icon: '📥', color: 'text-emerald-400' },
        { type: 'borrow', user: 'Mercy Chebet (Form 2 West)', item: '"KLB Mathematics Bk 2"', meta: '14 mins ago • Due Jun 26', icon: '📤', color: 'text-cyan-400' },
        { type: 'alert', user: 'Alice Kamau', item: '"Computer Coding"', meta: '1 hour ago • Reminder triggered', icon: '⚠️', color: 'text-amber-400' },
        { type: 'add', user: 'New book added', item: '"Essential Biology F4" by KLB', meta: '3 hours ago • Added to shelf C-2', icon: '➕', color: 'text-indigo-400' }
    ],
    filters: {
        searchQuery: '',
        category: 'All Categories'
    }
};

// ==========================================
// 2. DOM ELEMENT REGISTRY
// ==========================================
const DOM = {
    // Stats
    totalBooksCount: document.querySelector('.stat-card:nth-child(1) p.text-4xl'),
    borrowedCount: document.querySelector('.stat-card:nth-child(2) p.text-4xl'),
    availableCount: document.querySelector('.stat-card:nth-child(3) p.text-4xl'),
    damagedCount: document.querySelector('.stat-card:nth-child(4) p.text-4xl'),
    overdueWarningText: document.querySelector('.bg-gradient-to-r.from-amber-500\/10 p span.text-amber-300'),
    
    // Elements & Inputs
    searchBar: document.querySelector('header input[type="text"]'),
    categoryButtonsContainer: document.querySelector('.glass-panel.rounded-xl.p-3 .flex.flex-wrap.gap-2'),
    entriesCounter: document.querySelector('.glass-panel.rounded-xl.p-3 div.text-slate-400 span'),
    tableBody: document.querySelector('table tbody'),
    emptyStateRow: document.querySelector('table + div.text-center'),
    activityFeed: document.querySelector('.max-h-64.overflow-y-auto'),
    sidebarModuleCountBadge: document.querySelector('aside nav button span.bg-cyan-900\/50'),

    // Add Book Form
    form: document.querySelector('form'),
    inputTitle: document.querySelector('form input[placeholder*="Biology"]'),
    inputAuthor: document.querySelector('form input[placeholder*="Mburu"]'),
    selectCategory: document.querySelector('form select'),
    inputShelf: document.querySelector('form input[placeholder*="Cabinet"]'),
    btnSubmit: document.querySelector('form button')
};

// ==========================================
// 3. SERVICE LOGIC & MUTATORS
// ==========================================

function updateMetrics() {
    const total = LibraryState.books.length;
    const borrowed = LibraryState.books.filter(b => b.status === 'Borrowed').length;
    const overdue = LibraryState.books.filter(b => b.status === 'Overdue').length;
    const available = LibraryState.books.filter(b => b.status === 'Available').length;

    // Fast DOM injection
    if(DOM.totalBooksCount) DOM.totalBooksCount.textContent = String(total).padStart(2, '0');
    if(DOM.borrowedCount) DOM.borrowedCount.textContent = String(borrowed).padStart(2, '0');
    if(DOM.availableCount) DOM.availableCount.textContent = String(available).padStart(2, '0');
    if(DOM.overdueWarningText) DOM.overdueWarningText.textContent = `${overdue} book${overdue !== 1 ? 's' : ''}`;
    if(DOM.sidebarModuleCountBadge) DOM.sidebarModuleCountBadge.textContent = total;
}

function pushActivity(type, user, item, meta, icon, color) {
    LibraryState.activities.unshift({ type, user, item, meta, icon, color });
    renderActivityFeed();
}

// ==========================================
// 4. COMPONENT RENDERING ENGINE
// ==========================================

function renderCatalogTable() {
    const query = LibraryState.filters.searchQuery.toLowerCase().trim();
    const catFilter = LibraryState.filters.category;

    const filtered = LibraryState.books.filter(book => {
        const matchesSearch = book.title.toLowerCase().includes(query) || 
                              book.author.toLowerCase().includes(query) || 
                              book.id.toLowerCase().includes(query);
        
        const matchesCategory = (catFilter === 'All Categories') || 
                                (book.category.toLowerCase() === catFilter.toLowerCase() || 
                                 (catFilter === 'Sciences' && book.category === 'Science')); // Normalize plural matching

        return matchesSearch && matchesCategory;
    });

    DOM.tableBody.innerHTML = '';
    
    if (filtered.length === 0) {
        DOM.emptyStateRow.classList.remove('hidden');
        DOM.entriesCounter.textContent = '0';
        return;
    }

    DOM.emptyStateRow.classList.add('hidden');
    DOM.entriesCounter.textContent = filtered.length;

    filtered.forEach(book => {
        const tr = document.createElement('tr');
        tr.className = 'table-row-hover transition';

        let statusBadge = '';
        let primaryActionBtn = '';

        // Dynamic context configuration
        if (book.status === 'Available') {
            statusBadge = `
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> Available
                </span>`;
            primaryActionBtn = `<button data-id="${book.id}" data-action="issue" class="bg-cyan-500/10 hover:bg-cyan-500 text-cyan-300 hover:text-black border border-cyan-500/20 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer">Issue →</button>`;
        } else if (book.status === 'Borrowed') {
            statusBadge = `
                <div>
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <span class="h-1.5 w-1.5 rounded-full bg-amber-400"></span> Borrowed
                    </span>
                    <div class="text-[11px] text-slate-300 mt-1 font-medium">${book.borrower} • Due ${book.dueDate}</div>
                </div>`;
            primaryActionBtn = `<button data-id="${book.id}" data-action="return" class="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-300 hover:text-black border border-emerald-500/20 text-[11px] font-bold px-3 py-1.5 rounded-xl transition cursor-pointer">Return</button>`;
        } else if (book.status === 'Overdue') {
            statusBadge = `
                <div>
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <span class="h-1.5 w-1.5 rounded-full bg-rose-500 live-dot"></span> Overdue
                    </span>
                    <div class="text-[11px] text-rose-300 mt-1 font-semibold">${book.borrower} • Overdue ${book.overdueDays} days</div>
                </div>`;
            primaryActionBtn = `<button data-id="${book.id}" data-action="alert" class="bg-amber-500/10 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/20 text-[11px] font-bold px-3 py-1.5 rounded-xl transition cursor-pointer">Send Alert</button>`;
        }

        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="font-bold text-white text-sm">${book.title}</div>
                <div class="text-slate-400 text-xs mt-0.5">by ${book.author} • <span class="text-slate-500 font-mono text-[11px]">ID: ${book.id}</span></div>
            </td>
            <td class="px-6 py-4 text-sm text-slate-300">${book.location}</td>
            <td class="px-6 py-4">${statusBadge}</td>
            <td class="px-6 py-4 text-right">
                ${primaryActionBtn}
                <button data-id="${book.id}" data-action="delete" class="text-slate-500 hover:text-rose-400 ml-2 transition text-base cursor-pointer">🗑️</button>
            </td>
        `;
        DOM.tableBody.appendChild(tr);
    });
}

function renderActivityFeed() {
    DOM.activityFeed.innerHTML = '';
    LibraryState.activities.forEach(act => {
        const div = document.createElement('div');
        div.className = 'flex items-start gap-3 pb-3 border-b border-white/5 last:border-0 last:pb-0';
        div.innerHTML = `
            <span class="${act.color} text-sm pt-0.5">${act.icon}</span>
            <div>
                <p class="text-xs font-medium text-slate-200">${act.user} ${act.type === 'add' ? 'added:' : 'returned'} <span class="text-cyan-300 font-semibold">${act.item}</span></p>
                <span class="text-[10px] text-slate-500">${act.meta}</span>
            </div>
        `;
        if (act.type === 'alert') {
            div.innerHTML = `
                <span class="${act.color} text-sm pt-0.5">${act.icon}</span>
                <div>
                    <p class="text-xs font-medium text-slate-200">Overdue alert sent to <span class="text-amber-300">${act.user}</span> for ${act.item}</p>
                    <span class="text-[10px] text-slate-500">${act.meta}</span>
                </div>
            `;
        }
        DOM.activityFeed.appendChild(div);
    });
}

// ==========================================
// 5. INTERACTION & INTERCEPT HANDLERS
// ==========================================

function setupEventListeners() {
    // Dynamic Query Filtering Engine
    if(DOM.searchBar) {
        DOM.searchBar.addEventListener('input', (e) => {
            LibraryState.filters.searchQuery = e.target.value;
            renderCatalogTable();
        });
    }

    // Tab Category Filter Interceptor
    if(DOM.categoryButtonsContainer) {
        DOM.categoryButtonsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            // Clear legacy styling
            Array.from(DOM.categoryButtonsContainer.children).forEach(b => {
                b.className = "px-3 py-1.5 text-xs font-medium rounded-lg text-slate-300 hover:bg-white/5 transition cursor-pointer";
            });

            // Apply premium target design state
            btn.className = "px-3 py-1.5 text-xs font-bold rounded-lg bg-cyan-800/60 text-cyan-200 border border-cyan-500/40 transition cursor-pointer";
            
            LibraryState.filters.category = btn.textContent.trim();
            renderCatalogTable();
        });
    }

    // Row Action Dispatcher Hub (Event Delegation)
    if(DOM.tableBody) {
        DOM.tableBody.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            const targetId = btn.dataset.id;
            const action = btn.dataset.action;
            const targetBook = LibraryState.books.find(b => b.id === targetId);

            if (!targetBook) return;

            switch (action) {
                case 'issue':
                    const student = prompt(`Enter Student Name / Admission ID to issue "${targetBook.title}":`);
                    if (student && student.trim() !== '') {
                        targetBook.status = 'Borrowed';
                        targetBook.borrower = student.trim();
                        targetBook.dueDate = 'Jun 27'; // Auto incremental timeline offset fallback
                        pushActivity('borrow', targetBook.borrower, `"${targetBook.title}"`, 'Just now • Due Jun 27', '📤', 'text-cyan-400');
                    }
                    break;

                case 'return':
                    const previousBorrower = targetBook.borrower || 'Student';
                    targetBook.status = 'Available';
                    targetBook.borrower = null;
                    targetBook.dueDate = null;
                    targetBook.overdueDays = 0;
                    pushActivity('return', `${previousBorrower} (Handed back)`, `"${targetBook.title}"`, 'Just now • Managed Shelf Return', '📥', 'text-emerald-400');
                    break;

                case 'alert':
                    alert(`System Notification broadcast successfully triggered to ${targetBook.borrower} for overdue status on item: ID [${targetBook.id}].`);
                    pushActivity('alert', targetBook.borrower, `"${targetBook.title}"`, 'Just now • Routine Warning Transmitted', '⚠️', 'text-amber-400');
                    break;

                case 'delete':
                    if (confirm(`Are you sure you want to remove "${targetBook.title}" from Database Records?`)) {
                        LibraryState.books = LibraryState.books.filter(b => b.id !== targetId);
                    }
                    break;
            }

            updateMetrics();
            renderCatalogTable();
        });
    }

    // Record Append Processing Engine
    if(DOM.btnSubmit) {
        DOM.btnSubmit.addEventListener('click', (e) => {
            e.preventDefault();

            const title = DOM.inputTitle.value.trim();
            const author = DOM.inputAuthor.value.trim();
            const category = DOM.selectCategory.value;
            const location = DOM.inputShelf.value.trim() || 'Unassigned Center';

            if (!title || !author) {
                alert('Database ingestion failed: Asset Title and Primary Author fields are strictly mandatory.');
                return;
            }

            // Generate deterministic internal unique mapping identity token
            const computedId = `${category.substring(0,3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

            const dynamicNewAsset = {
                id: computedId,
                title: title,
                author: author,
                category: category,
                location: location,
                status: 'Available',
                borrower: null,
                dueDate: null,
                overdueDays: 0
            };

            LibraryState.books.push(dynamicNewAsset);
            pushActivity('add', 'New book added', `"${title}" by ${author}`, `Just now • Added to ${location}`, '➕', 'text-indigo-400');

            // Reset UI state interface parameters
            DOM.form.reset();
            updateMetrics();
            renderCatalogTable();
        });
    }
}

// ==========================================
// 6. INITIALIZATION SEQUENCE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    updateMetrics();
    renderCatalogTable();
    renderActivityFeed();
    setupEventListeners();
});
