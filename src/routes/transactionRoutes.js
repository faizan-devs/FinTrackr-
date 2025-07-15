import express from 'express';
import {
    addTransaction,
    getTransactions,
    getTransactionById,
    updateTransaction,
    deleteTransaction,
} from '../controllers/transactionController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router
    .route('/')
    .post(protect, addTransaction)
    .get(protect, getTransactions);

router
    .route('/:id')
    .get(protect, getTransactionById)
    .put(protect, updateTransaction)
    .delete(protect, deleteTransaction);

export default router;