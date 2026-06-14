/**
 * Kivaywa High School LMS - Backend Integration Engine & REST API
 * Technology Stack: Node.js / Express.js / MongoDB Atlas (Mongoose ODM)
 * Architecture: 100% Database-Driven Framework (Production Grade)
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================================================
// 1. Core Production Middleware Setup
// ==========================================================================
app.use(cors());
app.use(express.json());

// ==========================================================================
// 2. MongoDB Atlas Connection Infrastructure
// ==========================================================================
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://MedAI:Griff2009.@medai.qjvleue.mongodb.net/?appName=MedAI";

mongoose.connect(MONGO_URI)
    .then(() => console.log('🚀 Successfully established pipeline link with MongoDB Atlas Cluster.'))
    .catch(err => {
        console.error('❌ MongoDB Connection Failure Structural Exception:', err.message);
        process.exit(1);
    });

// ==========================================================================
// 3. Database Schema Layout Context Maps (Mongoose Models)
// ==========================================================================

// --- Book Catalog Inventory Document Structure ---
const BookSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    isbn: { type: String, required: true, unique: true, trim: true },
    category: { type: String, required: true },
    qty: { type: Number, required: true, min: 0, default: 1 }
}, { timestamps: true });

const Book = mongoose.model('Book', BookSchema);

// --- Borrower Transaction Log Document Structure ---
const BorrowedSchema = new mongoose.Schema({
    borrowerType: { type: String, enum: ['Student', 'Teacher/Staff'], default: 'Student', required: true },
    admNo: { type: String, required: true, trim: true }, 
    name: { type: String, required: true, trim: true },
    form: { type: String, required: true }, // Repurposed for Class/Stream or Department
    bookTitle: { type: String, required: true, trim: true },
    issueDate: { type: String, required: true },
    dueDate: { type: String, required: true },
    status: { type: String, enum: ['Active', 'Overdue'], default: 'Active' },
    conditionDeficit: { type: String, default: 'Good' },
    fineAmount: { type: Number, default: 0 }
}, { timestamps: true });

// Indexing mapping to optimize lookup routines safely without strict unique limits
BorrowedSchema.index({ admNo: 1, bookTitle: 1 });

const Borrowed = mongoose.model('Borrowed', BorrowedSchema);

// ==========================================================================
// 4. Auxiliary System Calculation Routines (Middleware Engine)
// ==========================================================================

/**
 * Sweeps through all ongoing borrowed text profiles to programmatically compute 
 * and flag structural 'Overdue' anomalies if past the calendar execution deadline.
 */
async function computeRealtimeOverdueStatus() {
    try {
        const activeLogs = await Borrowed.find({ status: 'Active' });
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let log of activeLogs) {
            const dueDate = new Date(log.dueDate);
            dueDate.setHours(0, 0, 0, 0);

            if (today > dueDate) {
                log.status = 'Overdue';
                
                // Automatically assess baseline KES 20 standard fine per day if field isn't manually locked
                const diffTime = Math.abs(today - dueDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                log.fineAmount = diffDays * 20;
                
                await log.save();
            }
        }
    } catch (err) {
        console.error("System Engine Error calculating temporal offsets: ", err.message);
    }
}

// ==========================================================================
// 5. REST API Controller Routes Framework
// ==========================================================================

// --------------------------------------------------------------------------
// GET: Fetch Active Inventory Catalog Logs
// --------------------------------------------------------------------------
app.get('/api/books', async (req, res) => {
    try {
        const books = await Book.find().sort({ title: 1 });
        res.status(200).json(books);
    } catch (err) {
        res.status(500).json({ error: "Inventory sync fault occurred on remote lookup.", details: err.message });
    }
});

// --------------------------------------------------------------------------
// POST: Commit New Book Profile to Database Catalog
// --------------------------------------------------------------------------
app.post('/api/books', async (req, res) => {
    try {
        const { title, author, isbn, category, qty } = req.body;
        
        const targetExists = await Book.findOne({ isbn });
        if (targetExists) {
            return res.status(400).json({ error: "A book configuration profile running this unique ISBN context already exists." });
        }

        const addedBook = new Book({ title, author, isbn, category, qty });
        await addedBook.save();
        res.status(201).json(addedBook);
    } catch (err) {
        res.status(400).json({ error: "Payload verification check dropped data mapping rules.", details: err.message });
    }
});

// --------------------------------------------------------------------------
// DELETE: Purge Specific Book Profile configuration
// --------------------------------------------------------------------------
app.delete('/api/books/:isbn', async (req, res) => {
    try {
        const deletedBook = await Book.findOneAndDelete({ isbn: req.params.isbn });
        if (!deletedBook) {
            return res.status(404).json({ error: "Target catalog artifact item not found inside database schema maps." });
        }
        res.status(200).json({ message: "Book configuration profile wiped out smoothly." });
    } catch (err) {
        res.status(500).json({ error: "Internal driver exception processing profile wipe.", details: err.message });
    }
});

// --------------------------------------------------------------------------
// GET: Query All Borrowed Transaction Logs
// --------------------------------------------------------------------------
app.get('/api/borrowed', async (req, res) => {
    try {
        await computeRealtimeOverdueStatus();
        const borrowings = await Borrowed.find().sort({ createdAt: -1 });
        res.status(200).json(borrowings);
    } catch (err) {
        res.status(500).json({ error: "Registry query structural transaction block error.", details: err.message });
    }
});

// --------------------------------------------------------------------------
// POST: Issue/Authorize Book Borrowing and Deduct Quantity
// --------------------------------------------------------------------------
app.post('/api/borrowed', async (req, res) => {
    try {
        const { borrowerType, admNo, name, form, bookTitle, issueDate, dueDate } = req.body;

        // Validation rule lookup check matching specific borrower type context configurations
        const activeCheck = await Borrowed.findOne({ admNo, bookTitle: { $regex: new RegExp(`^${bookTitle.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') } });
        if (activeCheck) {
            return res.status(400).json({ error: `Outstanding transaction detected. Identity item "${admNo}" currently holds a duplicate copy of this asset.` });
        }

        // Case-insensitive lookups protect against typing discrepancies on the frontend
        const bookMatch = await Book.findOne({ title: { $regex: new RegExp(`^${bookTitle.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') } });
        if (!bookMatch) {
            return res.status(404).json({ error: `The book titled "${bookTitle}" does not match any current stock profiles inside the catalog.` });
        }
        if (bookMatch.qty < 1) {
            return res.status(400).json({ error: `Insufficient stock allocation. "${bookMatch.title}" copies are fully checked out.` });
        }

        // Deduct exactly one catalog item instance safely
        bookMatch.qty -= 1;
        await bookMatch.save();

        const authorizedBorrowing = new Borrowed({
            borrowerType: borrowerType || 'Student',
            admNo, 
            name, 
            form, 
            bookTitle: bookMatch.title, 
            issueDate, 
            dueDate, 
            status: "Active"
        });
        await authorizedBorrowing.save();

        res.status(201).json(authorizedBorrowing);
    } catch (err) {
        res.status(400).json({ error: "Issuance processing operation parameters faulted on ingestion checks.", details: err.message });
    }
});

// --------------------------------------------------------------------------
// DELETE: Check-In/Mark Return and Credit Volume Back to Stock
// --------------------------------------------------------------------------
app.delete('/api/borrowed/:idOrAdmNo', async (req, res) => {
    try {
        const identifier = req.params.idOrAdmNo;
        
        // Flexible controller verification lookup selector logic (checks explicit DB id first, then falls back to global code)
        let activeIssue = null;
        if (mongoose.Types.ObjectId.isValid(identifier)) {
            activeIssue = await Borrowed.findById(identifier);
        }
        if (!activeIssue) {
            activeIssue = await Borrowed.findOne({ admNo: identifier });
        }

        if (!activeIssue) {
            return res.status(404).json({ error: "No active transactional ledger matched this identification parameter." });
        }

        // Return asset reference safely back to matching database book inventory
        await Book.findOneAndUpdate(
            { title: activeIssue.bookTitle },
            { $inc: { qty: 1 } }
        );

        await Borrowed.deleteOne({ _id: activeIssue._id });
        res.status(200).json({ message: "Check-in collection log closure executed and stock count credited successfully." });
    } catch (err) {
        res.status(500).json({ error: "Crash condition logged on collection tracking arrays.", details: err.message });
    }
});

// ==========================================================================
// 6. Application Startup Runtime Engine
// ==========================================================================
app.listen(PORT, () => {
    console.log(`================================================================`);
    console.log(` 🔥 KIVAYWA LMS CONTROL CENTER SYSTEM RUNNING ACTIVE ON PORT ${PORT}`);
    console.log(`================================================================`);
});
