import express from 'express';
import {
    getMonthlySummary,
    getSpendingTrends,
    getSavingSuggestions,
    exportTransactions,
} from '../controllers/reportController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.get('/monthly-summary', protect, getMonthlySummary);
router.get('/trends', protect, getSpendingTrends);
router.get('/suggestions', protect, getSavingSuggestions);
router.get('/export', protect, exportTransactions);

export default router;