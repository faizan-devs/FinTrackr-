import express from 'express';
import {
    createBudget,
    getBudgets,
    getBudgetById,
    updateBudget,
    deleteBudget,
} from '../controllers/budgetController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router
    .route('/')
    .post(protect, createBudget)
    .get(protect, getBudgets);

router
    .route('/:id')
    .get(protect, getBudgetById)
    .put(protect, updateBudget)
    .delete(protect, deleteBudget);

export default router;