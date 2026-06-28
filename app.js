/**
 * Kivaywa High School — Library Management System
 * Frontend Application Engine (v2.0)
 * Backend: https://kivlibback.onrender.com/api (unchanged)
 */

'use strict';

// ── CONFIG ────────────────────────────────────────────────────────────────
const API = 'https://kivlibback.onrender.com/api';

// ── STATE ─────────────────────────────────────────────────────────────────
let state = { books: [], borrowed: [], fines: [] };
let borrowingChart = null;
let registryFilter = 'all';

// ── BOOT ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    bootUI();
    syncData();
});

function bootUI() {
    setGreeting();
    setDateDisplay();
    initTabs();
    initSidebarToggle();
    initForms();
    initSearch();
    initUtilityButtons();
    initReturnLoanPreview();
    initRegistryFilters();
}

// ── TIME & DATE ───────────────────────────────────────────────────────────
function setGreeting() {
    const h = new Date().getHours();
    const el = document.getElementById('greeting-time');
    if (!el) return;
    el.textContent = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
}

function setDateDisplay() {
    const el = document.getElementById('current-date');
    if (!el) return;
    el.textContent = new Date().toLocaleDateString('en-KE', {
        weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
    });
}

// ── TAB NAVIGATION ───────────────────────────────────────────────────────
function initTabs() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
            // Close mobile nav
            document.body.classList.remove('mobile-nav-open');
        });
    });
}

function switchTab(tabId) {
    // Panels
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById(`${tabId}-tab`);
    if (panel) panel.classList.add('active');

    // Nav items
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    if (btn) btn.classList.add('active');

    // Breadcrumb
    const crumb = document.getElementById('breadcrumb');
    if (crumb) {
        const labels = { dashboard: 'Dashboard', books: 'Book Catalog', students: 'Borrowing Registry', fines: 'Fines & Penalties' };
        crumb.textContent = labels[tabId] || tabId;
    }
}

// ── SIDEBAR TOGGLE ────────────────────────────────────────────────────────
function initSidebarToggle() {
    const toggle = document.getElementById('sidebar-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', () => {
        if (window.innerWidth <= 900) {
            document.body.classList.toggle('mobile-nav-open');
        } else {
            document.body.classList.toggle('sidebar-collapsed');
        }
    });
}

// ── DATA SYNC ─────────────────────────────────────────────────────────────
async function syncData() {
    try {
        setOnlineStatus('connecting');
        const [bRes, borRes] = await Promise.all([
            fetch(`${API}/books`),
            fetch(`${API}/borrowed`)
        ]);
        if (!bRes.ok || !borRes.ok) throw new Error('Server returned a non-OK response');

        state.books    = await bRes.json();
        state.borrowed = await borRes.json();
        
        computeFines();
        setOnlineStatus('online');
        renderAll();
        populateDatalist();
    } catch (err) {
        console.error('Sync error:', err);
        setOnlineStatus('offline');
        renderSyncError();
        showToast('Unable to reach the server. Check your connection.', 'error');
    }
}

function setOnlineStatus(status) {
    const dot  = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (!dot || !text) return;
    dot.className = 'status-dot';
    if (status === 'online')      { dot.classList.add('online');  text.textContent = 'System Online'; }
    else if (status === 'offline'){ dot.classList.add('offline'); text.textContent = 'Connection Error'; }
    else                          { text.textContent = 'Connecting…'; }
}

function computeFines() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    state.fines = state.borrowed
        .filter(item => item.status === 'Overdue' || parseFloat(item.fineAmount) > 0)
        .map(item => {
            const due = new Date(item.dueDate);
            const diffMs = Math.max(0, today - due);
            const days   = Math.ceil(diffMs / 86400000);
            return {
                admNo:          item.admNo,
                name:           item.name,
                bookTitle:      item.bookTitle,
                daysOverdue:    item.status === 'Overdue' ? days : 0,
                conditionDeficit: item.conditionDeficit || 'Good',
                fineAmount:     parseFloat(item.fineAmount) || (days * 20)
            };
        });
}

// ── RENDER ALL ────────────────────────────────────────────────────────────
function renderAll() {
    renderMetrics();
    renderRecentTransactions();
    renderBooksTable(state.books);
    renderRegistryTable(state.borrowed);
    renderFinesTable(state.fines);
    renderPopularBooks();
    renderChart();
    updateCatalogStats();
    updateFinesSummary();
}

// ── METRICS ───────────────────────────────────────────────────────────────
function renderMetrics() {
    const totalQty  = state.books.reduce((s, b) => s + parseInt(b.qty || 0), 0);
    const overdue   = state.borrowed.filter(b => b.status === 'Overdue').length;
    const totalFine = state.fines.reduce((s, f) => s + parseFloat(f.fineAmount || 0), 0);

    setText('total-books-count',   totalQty.toLocaleString());
    setText('issued-books-count',  state.borrowed.length.toLocaleString());
    setText('overdue-books-count', overdue.toLocaleString());
    setText('total-fines-count',   `KES ${totalFine.toLocaleString()}`);
}

// ── RECENT TRANSACTIONS ───────────────────────────────────────────────────
function renderRecentTransactions() {
    const tbody = document.getElementById('recent-transactions-tbody');
    if (!tbody) return;

    const items = [...state.borrowed].reverse().slice(0, 5);

    if (items.length === 0) {
        tbody.innerHTML = emptyRow(6, 'No transactions recorded yet.');
        return;
    }

    tbody.innerHTML = items.map(item => {
        const isOverdue = item.status === 'Overdue';
        const typeClass = item.borrowerType === 'Teacher/Staff' ? 'badge-teacher' : 'badge-student';
        return `
            <tr>
                <td><code>${esc(item.admNo)}</code></td>
                <td><span class="badge ${typeClass}">${esc(item.borrowerType || 'Student')}</span></td>
                <td><b>${esc(item.name)}</b></td>
                <td>${esc(item.bookTitle)}</td>
                <td style="color:${isOverdue ? 'var(--clr-danger)' : 'inherit'}; font-weight:${isOverdue ? '600' : '400'};">${esc(item.dueDate)}</td>
                <td><span class="badge ${isOverdue ? 'badge-overdue' : 'badge-active'}">${esc(item.status)}</span></td>
            </tr>
        `;
    }).join('');
}

// ── BOOKS TABLE ───────────────────────────────────────────────────────────
function renderBooksTable(books) {
    const tbody = document.getElementById('books-table-tbody');
    if (!tbody) return;

    if (books.length === 0) {
        tbody.innerHTML = emptyRow(6, 'No books found matching your search.');
        return;
    }

    tbody.innerHTML = books.map(book => `
        <tr>
            <td><code>${esc(book.isbn)}</code></td>
            <td><b>${esc(book.title)}</b></td>
            <td>${esc(book.author)}</td>
            <td>
                <span style="background:var(--clr-parchment); border:1px solid var(--clr-border); padding:2px 8px; border-radius:999px; font-size:11px; font-weight:600; color:var(--clr-text-2);">
                    ${esc(book.category)}
                </span>
            </td>
            <td>
                <span style="font-family:'JetBrains Mono',monospace; font-weight:600; color:var(--clr-green);">
                    ${parseInt(book.qty)} pcs
                </span>
            </td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="handleBookDelete('${esc(book.isbn)}')">
                    <i class="fa-solid fa-trash-can"></i> Remove
                </button>
            </td>
        </tr>
    `).join('');
}

function updateCatalogStats() {
    const el = document.getElementById('catalog-stats');
    if (el) el.textContent = `${state.books.length} titles · ${state.books.reduce((s,b) => s + parseInt(b.qty||0), 0).toLocaleString()} volumes`;
}

// ── REGISTRY TABLE ────────────────────────────────────────────────────────
function renderRegistryTable(items) {
    const tbody = document.getElementById('registry-table-tbody');
    if (!tbody) return;

    // Apply filter
    const filtered = registryFilter === 'all' ? items : items.filter(i => i.status === registryFilter);

    if (filtered.length === 0) {
        tbody.innerHTML = emptyRow(7, registryFilter === 'all' ? 'No active borrowings found.' : `No ${registryFilter.toLowerCase()} records.`);
        return;
    }

    tbody.innerHTML = filtered.map(item => {
        const isOverdue = item.status === 'Overdue';
        const typeClass = item.borrowerType === 'Teacher/Staff' ? 'badge-teacher' : 'badge-student';
        return `
            <tr>
                <td><code>${esc(item.admNo)}</code></td>
                <td><span class="badge ${typeClass}">${esc(item.borrowerType || 'Student')}</span></td>
                <td><b>${esc(item.name)}</b></td>
                <td style="color:var(--clr-text-3);">${esc(item.form || '—')}</td>
                <td>${esc(item.bookTitle)}</td>
                <td>
                    <span style="color:${isOverdue ? 'var(--clr-danger)' : 'var(--clr-text)'}; font-weight:${isOverdue ? '700' : '500'};">
                        ${isOverdue ? '<i class="fa-solid fa-circle-exclamation"></i> ' : ''}${esc(item.dueDate)}
                    </span>
                </td>
                <td>
                    <button class="btn btn-ghost btn-sm" onclick="populateAndOpenReturnModal('${esc(item.admNo)}')">
                        <i class="fa-solid fa-arrow-rotate-left"></i> Check-In
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ── FINES TABLE ───────────────────────────────────────────────────────────
function renderFinesTable(fines) {
    const tbody = document.getElementById('fines-table-tbody');
    if (!tbody) return;

    if (fines.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="7" style="text-align:center; padding:40px; color:var(--clr-success);">
                <i class="fa-solid fa-circle-check" style="font-size:22px; margin-bottom:8px; display:block;"></i>
                <b>All Clear</b> — No outstanding fines on record.
            </td></tr>`;
        return;
    }

    tbody.innerHTML = fines.map(fine => {
        const condColor = fine.conditionDeficit === 'Good' ? 'var(--clr-success)' : 'var(--clr-danger)';
        return `
            <tr>
                <td><code>${esc(fine.admNo)}</code></td>
                <td><b>${esc(fine.name)}</b></td>
                <td>${esc(fine.bookTitle)}</td>
                <td>
                    <span class="badge ${fine.daysOverdue > 0 ? 'badge-overdue' : 'badge-student'}">
                        ${fine.daysOverdue} day${fine.daysOverdue !== 1 ? 's' : ''}
                    </span>
                </td>
                <td style="color:${condColor}; font-weight:600; font-size:12px;">${esc(fine.conditionDeficit)}</td>
                <td style="font-family:'JetBrains Mono',monospace; font-weight:700; color:var(--clr-danger);">
                    KES ${parseFloat(fine.fineAmount).toLocaleString()}
                </td>
                <td>
                    <button class="btn btn-success btn-sm" onclick="handleClearFine('${esc(fine.admNo)}')">
                        <i class="fa-solid fa-check"></i> Clear Fine
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function updateFinesSummary() {
    const el = document.getElementById('fines-summary');
    if (!el) return;
    const total = state.fines.reduce((s, f) => s + parseFloat(f.fineAmount || 0), 0);
    if (total === 0) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    el.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> KES ${total.toLocaleString()} outstanding across ${state.fines.length} record${state.fines.length !== 1 ? 's' : ''}`;
}

// ── POPULAR BOOKS ─────────────────────────────────────────────────────────
function renderPopularBooks() {
    const list = document.getElementById('popular-books-list');
    if (!list) return;

    const counts = {};
    state.borrowed.forEach(b => {
        const t = b.bookTitle || 'Unknown';
        counts[t] = (counts[t] || 0) + 1;
    });

    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    if (top.length === 0) {
        list.innerHTML = '<li class="popular-empty">No borrowing data yet</li>';
        return;
    }

    list.innerHTML = top.map(([title, count], i) => `
        <li>
            <span class="popular-rank">${i + 1}</span>
            <span class="popular-title">${esc(title)}</span>
            <span class="popular-count">${count} issues</span>
        </li>
    `).join('');
}

// ── CHART ─────────────────────────────────────────────────────────────────
function renderChart() {
    const canvas  = document.getElementById('borrowingTrendsChart');
    const emptyEl = document.getElementById('chart-empty');
    if (!canvas) return;

    if (borrowingChart) { borrowingChart.destroy(); borrowingChart = null; }

    const monthly = {};
    state.borrowed.forEach(item => {
        if (!item.issueDate) return;
        const d = new Date(item.issueDate);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthly[key] = (monthly[key] || 0) + 1;
    });

    const keys   = Object.keys(monthly).sort();
    const labels = keys.map(k => {
        const [y, m] = k.split('-');
        return new Date(+y, +m - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
    });
    const data = keys.map(k => monthly[k]);

    if (data.length === 0) {
        if (emptyEl) emptyEl.classList.remove('hidden');
        return;
    }
    if (emptyEl) emptyEl.classList.add('hidden');

    borrowingChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Books Borrowed',
                data,
                backgroundColor: 'rgba(122,0,22,0.75)',
                borderColor: 'rgba(122,0,22,1)',
                borderWidth: 2,
                borderRadius: 6,
                maxBarThickness: 44,
                hoverBackgroundColor: 'rgba(163,27,48,0.9)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.raw} book${ctx.raw !== 1 ? 's' : ''} borrowed`
                    },
                    backgroundColor: '#1a1008',
                    titleColor: '#fff',
                    bodyColor: 'rgba(255,255,255,0.8)',
                    padding: 10,
                    cornerRadius: 8
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, font: { size: 10, family: 'Inter' }, color: '#9c8878' },
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    border: { display: false }
                },
                x: {
                    ticks: { font: { size: 10, family: 'Inter' }, color: '#9c8878', maxRotation: 40, minRotation: 30 },
                    grid: { display: false },
                    border: { display: false }
                }
            }
        }
    });
}

// ── DATALIST ──────────────────────────────────────────────────────────────
function populateDatalist() {
    const dl = document.getElementById('inventory-datalist');
    if (dl) dl.innerHTML = state.books.map(b => `<option value="${esc(b.title)}">`).join('');
}

// ── FORM HANDLERS ─────────────────────────────────────────────────────────
function initForms() {
    const addBook    = document.getElementById('add-book-form');
    const issueBook  = document.getElementById('issue-book-form');
    const returnBook = document.getElementById('return-book-form');

    if (addBook)    addBook.addEventListener('submit', handleBookAdd);
    if (issueBook)  issueBook.addEventListener('submit', handleBookIssue);
    if (returnBook) returnBook.addEventListener('submit', handleReturnSubmit);

    setDefaultIssueDates();
}

function setDefaultIssueDates() {
    const issue  = document.getElementById('borrow-issue-date');
    const retDt  = document.getElementById('borrow-return-date');
    if (!issue || !retDt) return;
    const today  = new Date();
    const future = new Date(today);
    future.setDate(today.getDate() + 14);
    issue.value = today.toISOString().split('T')[0];
    retDt.value = future.toISOString().split('T')[0];
}

async function handleBookAdd(e) {
    e.preventDefault();
    const payload = {
        title:    document.getElementById('book-title').value.trim(),
        author:   document.getElementById('book-author').value.trim(),
        isbn:     document.getElementById('book-isbn').value.trim(),
        category: document.getElementById('book-category').value,
        qty:      parseInt(document.getElementById('book-qty').value) || 1
    };

    try {
        const res = await fetch(`${API}/books`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Server rejected the payload');
        closeModal('add-book-modal');
        document.getElementById('add-book-form').reset();
        showToast(`"${payload.title}" added to catalog.`, 'success');
        await syncData();
    } catch (err) {
        showToast(`Failed to add book: ${err.message}`, 'error');
    }
}

async function handleBookIssue(e) {
    e.preventDefault();
    const payload = {
        borrowerType: document.getElementById('borrow-type').value,
        admNo:        document.getElementById('borrow-adm').value.trim(),
        name:         document.getElementById('borrow-name').value.trim(),
        form:         document.getElementById('borrow-form').value,
        bookTitle:    document.getElementById('borrow-book').value.trim(),
        issueDate:    document.getElementById('borrow-issue-date').value,
        dueDate:      document.getElementById('borrow-return-date').value,
        status:       'Active'
    };

    try {
        const res = await fetch(`${API}/borrowed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Server rejected the request');
        closeModal('issue-book-modal');
        document.getElementById('issue-book-form').reset();
        setDefaultIssueDates();
        showToast(`Book issued to ${payload.name} successfully.`, 'info');
        await syncData();
    } catch (err) {
        showToast(`Issue failed: ${err.message}`, 'error');
    }
}

function populateAndOpenReturnModal(admNo) {
    const loan = state.borrowed.find(i => i.admNo === admNo);
    const searchInput = document.getElementById('return-search-id');
    if (searchInput) searchInput.value = admNo;
    
    if (loan) {
        const preview  = document.getElementById('loan-preview');
        const lpName   = document.getElementById('lp-name');
        const lpBook   = document.getElementById('lp-book');
        const lpDue    = document.getElementById('lp-due');
        const fineInput = document.getElementById('return-fine');
        
        if (preview) preview.style.display = 'block';
        if (lpName)  lpName.textContent  = loan.name;
        if (lpBook)  lpBook.textContent  = loan.bookTitle;
        if (lpDue)   lpDue.textContent   = loan.dueDate;

        if (fineInput) {
            const today  = new Date();
            const due    = new Date(loan.dueDate);
            const days   = Math.max(0, Math.ceil((today - due) / 86400000));
            fineInput.value = days > 0 ? days * 20 : 0;
        }
    }
    openModal('return-book-modal');
}

async function handleReturnSubmit(e) {
    e.preventDefault();
    const identifier  = document.getElementById('return-search-id').value.trim();
    const condition   = document.getElementById('return-condition').value;
    const fineAmount  = parseFloat(document.getElementById('return-fine').value) || 0;

    const loan = state.borrowed.find(b => b.admNo === identifier);
    if (!loan) {
        showToast('No active loan found for that ID.', 'warning');
        return;
    }

    try {
        const res = await fetch(`${API}/borrowed/${loan.id || identifier}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Server rejected the deletion');
        closeModal('return-book-modal');
        document.getElementById('return-book-form').reset();
        document.getElementById('loan-preview').style.display = 'none';
        
        if (fineAmount > 0 || condition !== 'Good') {
            showToast(`Check-in complete. Penalty of KES ${fineAmount} recorded.`, 'warning');
        } else {
            showToast('Book returned in good condition. Loan closed.', 'success');
        }
        await syncData();
    } catch (err) {
        showToast(`Check-in failed: ${err.message}`, 'error');
    }
}

async function handleBookDelete(isbn) {
    if (!confirm('Permanently remove this book from the library catalog?')) return;
    try {
        const res = await fetch(`${API}/books/${isbn}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Server denied the removal');
        showToast('Book removed from catalog.', 'success');
        await syncData();
    } catch (err) {
        showToast(`Delete failed: ${err.message}`, 'error');
    }
}

async function handleClearFine(admNo) {
    state.borrowed = state.borrowed.map(item => {
        if (item.admNo === admNo) { item.fineAmount = 0; item.status = 'Active'; }
        return item;
    });
    computeFines();
    renderFinesTable(state.fines);
    renderMetrics();
    updateFinesSummary();
    showToast(`Fine cleared for ${admNo}.`, 'success');
}

// ── LOAN PREVIEW LIVE LOOKUP ──────────────────────────────────────────────
function initReturnLoanPreview() {
    const input = document.getElementById('return-search-id');
    if (!input) return;
    input.addEventListener('input', () => {
        const val   = input.value.trim();
        const loan  = state.borrowed.find(b => b.admNo === val);
        const preview = document.getElementById('loan-preview');
        if (!preview) return;

        if (loan) {
            const lpName  = document.getElementById('lp-name');
            const lpBook  = document.getElementById('lp-book');
            const lpDue   = document.getElementById('lp-due');
            const fineIn  = document.getElementById('return-fine');
            if (lpName) lpName.textContent = loan.name;
            if (lpBook) lpBook.textContent = loan.bookTitle;
            if (lpDue)  lpDue.textContent  = loan.dueDate;
            if (fineIn) {
                const today = new Date();
                const due   = new Date(loan.dueDate);
                const days  = Math.max(0, Math.ceil((today - due) / 86400000));
                fineIn.value = days * 20;
            }
            preview.style.display = 'block';
        } else {
            preview.style.display = 'none';
        }
    });
}

// ── SEARCH & FILTERS ──────────────────────────────────────────────────────
function initSearch() {
    const bookSearch = document.getElementById('book-search');
    const regSearch  = document.getElementById('registry-search');
    if (bookSearch) bookSearch.addEventListener('input', () => {
        const q = bookSearch.value.toLowerCase().trim();
        const filtered = state.books.filter(b =>
            b.title.toLowerCase().includes(q) ||
            b.author.toLowerCase().includes(q) ||
            b.isbn.includes(q)
        );
        renderBooksTable(filtered);
    });
    if (regSearch) regSearch.addEventListener('input', () => {
        const q = regSearch.value.toLowerCase().trim();
        const filtered = state.borrowed.filter(i =>
            i.name.toLowerCase().includes(q) ||
            i.admNo.includes(q) ||
            i.bookTitle.toLowerCase().includes(q)
        );
        renderRegistryTable(filtered);
    });
}

function initRegistryFilters() {
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            registryFilter = chip.dataset.filter || 'all';
            renderRegistryTable(state.borrowed);
        });
    });
}

// ── BACKUP UTILITIES ──────────────────────────────────────────────────────
function initUtilityButtons() {
    const expBtn = document.getElementById('export-db-btn');
    const impBtn = document.getElementById('import-db-btn');

    if (expBtn) expBtn.addEventListener('click', exportBackup);
    if (impBtn) impBtn.addEventListener('click', () => {
        const fi = document.createElement('input');
        fi.type = 'file'; fi.accept = '.json';
        fi.onchange = importBackup;
        fi.click();
    });
}

function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `Kivaywa_LMS_Backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('System backup exported successfully.', 'success');
}

function importBackup(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const parsed = JSON.parse(ev.target.result);
            if (!parsed.books || !parsed.borrowed) throw new Error('Invalid backup file structure');
            state = parsed;
            computeFines();
            renderAll();
            populateDatalist();
            showToast('Backup restored successfully.', 'success');
        } catch (err) {
            showToast(`Restore failed: ${err.message}`, 'error');
        }
    };
    reader.readAsText(file);
}

// ── SYNC ERROR STATE ──────────────────────────────────────────────────────
function renderSyncError() {
    const errRow = `<tr><td colspan="7" style="text-align:center; color:var(--clr-danger); padding:28px; font-size:13px;">
        <i class="fa-solid fa-triangle-exclamation"></i> Could not load data from server. Check connection and try refreshing.
    </td></tr>`;
    ['recent-transactions-tbody','books-table-tbody','registry-table-tbody','fines-table-tbody'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = errRow;
    });
}

// ── MODALS ────────────────────────────────────────────────────────────────
function openModal(id) {
    const m = document.getElementById(id);
    if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; }
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (m) { m.classList.remove('open'); document.body.style.overflow = ''; }
}

// Close on backdrop click
document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-backdrop')) {
        e.target.classList.remove('open');
        document.body.style.overflow = '';
    }
});

// ── TOASTS ────────────────────────────────────────────────────────────────
function showToast(message, type = 'success', duration = 4500) {
    const stack = document.getElementById('toast-stack');
    if (!stack) return;

    const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fa-solid ${icons[type] || icons.info} toast-icon"></i>
        <span class="toast-msg">${esc(message)}</span>
        <button class="toast-close-btn" onclick="this.parentElement.remove()">&times;</button>
    `;
    stack.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastOut 0.35s ease forwards';
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, duration);
}

// ── HELPERS ───────────────────────────────────────────────────────────────
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function emptyRow(cols, msg) {
    return `<tr><td colspan="${cols}" class="table-loading" style="color:var(--clr-text-3);">${msg}</td></tr>`;
}

function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}

// ── GLOBAL REGISTRATION ────────────────────────────────────────────────────
window.switchTab                   = switchTab;
window.openModal                   = openModal;
window.closeModal                  = closeModal;
window.handleBookDelete            = handleBookDelete;
window.populateAndOpenReturnModal  = populateAndOpenReturnModal;
window.handleClearFine             = handleClearFine;
