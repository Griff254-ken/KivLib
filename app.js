/**
 * 1. BACKEND SERVICE INTERFACE LAYER
 * This acts exactly like an API client. When you implement your backend later, 
 * you will ONLY change the bodies of these methods to use fetch('api/books') calls.
 */
class StorageService {
    static getCollection() {
        const data = localStorage.getItem('nexus_library_data');
        if (!data) {
            // Seed data if database is initialized blank
            const seedData = [
                { id: "1", title: "Structure and Interpretation of Computer Programs", author: "Harold Abelson", loanedTo: null },
                { id: "2", title: "Design Patterns: Elements of Reusable Object-Oriented Software", author: "Erich Gamma", loanedTo: "Student_401" },
                { id: "3", title: "Compilers: Principles, Techniques, and Tools", author: "Alfred Aho", loanedTo: null }
            ];
            this.saveCollection(seedData);
            return seedData;
        }
        return JSON.parse(data);
    }

    static saveCollection(data) {
        localStorage.setItem('nexus_library_data', JSON.stringify(data));
    }
}

/**
 * 2. REACTIVE CENTRAL STATE MANAGEMENT (STORE)
 * Ensures consistent reactive changes across global UI elements
 */
const Store = {
    state: {
        books: [],
        activeTab: 'catalog', // 'catalog' or 'loans'
        searchQuery: ''
    },
    listeners: [],

    init() {
        this.state.books = StorageService.getCollection();
    },

    subscribe(listener) {
        this.listeners.push(listener);
    },

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.listeners.forEach(callback => callback(this.state));
    },

    // Actions mutating state
    commitNewAsset(title, author) {
        const updatedBooks = [
            { id: Date.now().toString(), title, author, loanedTo: null },
            ...this.state.books
        ];
        StorageService.saveCollection(updatedBooks);
        this.setState({ books: updatedBooks });
    },

    toggleAssetCirculation(id) {
        const updatedBooks = this.state.books.map(book => {
            if (book.id === id) {
                return { ...book, loanedTo: book.loanedTo ? null : "Student_Active" };
            }
            return book;
        });
        StorageService.saveCollection(updatedBooks);
        this.setState({ books: updatedBooks });
    }
};

/**
 * 3. COMPONENT RENDER ENGINE & UX INTERACTIONS
 */
const AppUI = {
    // DOM Cache
    tableBody: document.getElementById('dynamic-table-rows'),
    emptyState: document.getElementById('table-empty-state'),
    globalSearch: document.getElementById('global-search'),
    pageTitle: document.getElementById('page-title'),
    addForm: document.getElementById('add-book-form'),
    toastContainer: document.getElementById('toast-container'),
    
    metrics: {
        total: document.getElementById('metric-total'),
        loans: document.getElementById('metric-loans'),
        available: document.getElementById('metric-available')
    },

    init() {
        // Wire Event Listeners
        this.globalSearch.addEventListener('input', (e) => this.handleSearch(e));
        this.addForm.addEventListener('submit', (e) => this.handleAssetFormSubmit(e));
        this.initTabs();
        this.initKeyboardShortcuts();

        // Bind Store Updates directly to View Rendering
        Store.subscribe((state) => this.render(state));
        
        // Initial Draw
        this.render(Store.state);
    },

    initTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Style Updates
                document.querySelectorAll('.tab-btn').forEach(b => {
                    b.className = "tab-btn w-full flex items-center space-x-3 px-4 py-2.5 text-sm font-medium rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 transition-all cursor-pointer";
                });
                btn.className = "tab-btn w-full flex items-center space-x-3 px-4 py-2.5 text-sm font-medium rounded-lg bg-cyan-950/40 text-cyan-400 border border-cyan-500/10 transition-all cursor-pointer";
                
                const targetTab = btn.getAttribute('data-tab');
                this.pageTitle.innerText = targetTab === 'catalog' ? 'Asset Catalog' : 'Active Circulation Loans';
                Store.setState({ activeTab: targetTab });
            });
        });
    },

    initKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.globalSearch.focus();
            }
        });
    },

    handleSearch(e) {
        Store.setState({ searchQuery: e.target.value });
    },

    handleAssetFormSubmit(e) {
        e.preventDefault();
        const titleEl = document.getElementById('form-title');
        const authorEl = document.getElementById('form-author');
        
        Store.commitNewAsset(titleEl.value, authorEl.value);
        this.triggerNotification("Asset successfully cataloged into registry pipeline.", "success");
        
        titleEl.value = '';
        authorEl.value = '';
    },

    triggerNotification(message, type = "success") {
        const toast = document.createElement('div');
        toast.className = "glass-card px-4 py-3 rounded-lg text-xs font-medium border-l-2 text-slate-300 border-l-cyan-400 flex items-center shadow-2xl transition-all duration-300 transform translate-y-2 opacity-0";
        toast.innerHTML = `✨ <span class="ml-2">${message}</span>`;
        
        this.toastContainer.appendChild(toast);
        
        // Force Reflow animation sequence
        setTimeout(() => {
            toast.classList.remove('translate-y-2', 'opacity-0');
        }, 10);

        setTimeout(() => {
            toast.classList.add('translate-y-2', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },

    // Global Reactive Display Reconciliation Layer
    render(state) {
        this.tableBody.innerHTML = '';
        
        // Calculate Global Matrix metrics completely from current data array state
        const totalCount = state.books.length;
        const loanCount = state.books.filter(b => b.loanedTo).length;
        const availableCount = totalCount - loanCount;

        this.metrics.total.innerText = String(totalCount).padStart(2, '0');
        this.metrics.loans.innerText = String(loanCount).padStart(2, '0');
        this.metrics.available.innerText = String(availableCount).padStart(2, '0');

        // Apply Data Filters cleanly
        let filteredBooks = state.books.filter(book => {
            const matchesSearch = book.title.toLowerCase().includes(state.searchQuery.toLowerCase()) || 
                                  book.author.toLowerCase().includes(state.searchQuery.toLowerCase());
            
            if (state.activeTab === 'loans') {
                return matchesSearch && book.loanedTo !== null;
            }
            return matchesSearch;
        });

        // Toggle visibility conditions if no entities exist
        if (filteredBooks.length === 0) {
            this.emptyState.classList.remove('hidden');
        } else {
            this.emptyState.classList.add('hidden');
        }

        // Build UI nodes iteratively 
        filteredBooks.forEach(book => {
            const statusIndicator = book.loanedTo 
                ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/10 uppercase tracking-wider">Circulating</span>`
                : `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 uppercase tracking-wider">Available</span>`;

            const operationalActionBtn = book.loanedTo
                ? `<button onclick="Store.toggleAssetCirculation('${book.id}')" class="text-[11px] font-medium text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 py-1 px-2.5 rounded-md transition-all cursor-pointer">Inbound Return</button>`
                : `<button onclick="Store.toggleAssetCirculation('${book.id}')" class="text-[11px] font-medium text-cyan-400 hover:text-white bg-cyan-950/30 hover:bg-cyan-950 border border-cyan-900/50 hover:border-cyan-500/40 py-1 px-2.5 rounded-md transition-all cursor-pointer">Outbound Lease</button>`;

            const markup = `
                <tr class="hover:bg-slate-900/20 transition-colors group">
                    <td class="px-6 py-4">
                        <div class="font-medium text-slate-200 group-hover:text-cyan-400 transition-colors">${book.title}</div>
                        <div class="text-[11px] text-slate-500 mt-0.5">${book.author}</div>
                    </td>
                    <td class="px-6 py-4">${statusIndicator}</td>
                    <td class="px-6 py-4 text-right">${operationalActionBtn}</td>
                </tr>
            `;
            this.tableBody.insertAdjacentHTML('beforeend', markup);
        });
    }
};

// Fire core architecture sequences safely on content execution
Store.init();
AppUI.init();
