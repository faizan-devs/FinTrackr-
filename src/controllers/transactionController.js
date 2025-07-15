import asyncHandler from 'express-async-handler';
import Transaction from '../models/Transaction.js';

const addTransaction = asyncHandler(async (req, res) => {
    const { amount, type, category, description, date } = req.body;

    const transaction = await Transaction.create({
        user: req.user._id,
        amount,
        type,
        category,
        description,
        date: date || Date.now(),
    });

    res.status(201).json(transaction);
});

const getTransactions = asyncHandler(async (req, res) => {
    const { type, category, startDate, endDate, limit } = req.query;

    const query = { user: req.user._id };

    if (type) query.type = type;
    if (category) query.category = category;

    if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(query)
        .sort('-date')
        .limit(limit ? parseInt(limit) : 0);

    res.json(transactions);
});

const getTransactionById = asyncHandler(async (req, res) => {
    const transaction = await Transaction.findOne({
        _id: req.params.id,
        user: req.user._id,
    });

    if (transaction) {
        res.json(transaction);
    } else {
        res.status(404);
        throw new Error('Transaction not found');
    }
});

const updateTransaction = asyncHandler(async (req, res) => {
    const transaction = await Transaction.findOne({
        _id: req.params.id,
        user: req.user._id,
    });

    if (transaction) {
        transaction.amount = req.body.amount || transaction.amount;
        transaction.type = req.body.type || transaction.type;
        transaction.category = req.body.category || transaction.category;
        transaction.description = req.body.description || transaction.description;
        transaction.date = req.body.date || transaction.date;

        const updatedTransaction = await transaction.save();
        res.json(updatedTransaction);
    } else {
        res.status(404);
        throw new Error('Transaction not found');
    }
});

const deleteTransaction = asyncHandler(async (req, res) => {
    const transaction = await Transaction.findOneAndDelete({
        _id: req.params.id,
        user: req.user._id,
    });

    if (transaction) {
        res.json({ message: 'Transaction removed' });
    } else {
        res.status(404);
        throw new Error('Transaction not found');
    }
});

export {
    addTransaction,
    getTransactions,
    getTransactionById,
    updateTransaction,
    deleteTransaction,
};