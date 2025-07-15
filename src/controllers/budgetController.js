import asyncHandler from 'express-async-handler';
import Budget from '../models/Budget.js';
import Transaction from '../models/Transaction.js';
import { sendBudgetAlertEmail } from '../config/email.js';

const createBudget = asyncHandler(async (req, res) => {
    const { category, amount, period, notifications, threshold } = req.body;

    // Check if budget already exists for this category
    let budget = await Budget.findOne({
        user: req.user._id,
        category,
    });

    if (budget) {
        // Update existing budget
        budget.amount = amount;
        budget.period = period;
        budget.notifications = notifications;
        budget.threshold = threshold;
    } else {
        // Create new budget
        budget = new Budget({
            user: req.user._id,
            category,
            amount,
            period,
            notifications,
            threshold,
        });
    }

    const savedBudget = await budget.save();
    res.status(201).json(savedBudget);
});

const getBudgets = asyncHandler(async (req, res) => {
    const budgets = await Budget.find({ user: req.user._id });

    // Calculate current spending for each budget
    const budgetsWithSpending = await Promise.all(
        budgets.map(async (budget) => {
            const startDate = getPeriodStartDate(budget.period);

            const spent = await Transaction.aggregate([
                {
                    $match: {
                        user: req.user._id,
                        type: 'expense',
                        category: budget.category,
                        date: { $gte: startDate },
                    },
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$amount' },
                    },
                },
            ]);

            const spentAmount = spent.length > 0 ? spent[0].total : 0;
            const percentage = (spentAmount / budget.amount) * 100;

            return {
                ...budget.toObject(),
                spent: spentAmount,
                remaining: budget.amount - spentAmount,
                percentage: percentage.toFixed(2),
            };
        })
    );

    res.json(budgetsWithSpending);
});

const getBudgetById = asyncHandler(async (req, res) => {
    const budget = await Budget.findOne({
        _id: req.params.id,
        user: req.user._id,
    });

    if (!budget) {
        res.status(404);
        throw new Error('Budget not found');
    }

    res.json(budget);
});

const updateBudget = asyncHandler(async (req, res) => {
    const budget = await Budget.findOne({
        _id: req.params.id,
        user: req.user._id,
    });

    if (!budget) {
        res.status(404);
        throw new Error('Budget not found');
    }

    budget.amount = req.body.amount || budget.amount;
    budget.period = req.body.period || budget.period;
    budget.notifications = req.body.notifications || budget.notifications;
    budget.threshold = req.body.threshold || budget.threshold;

    const updatedBudget = await budget.save();
    res.json(updatedBudget);
});

const deleteBudget = asyncHandler(async (req, res) => {
    const budget = await Budget.findOne({
        _id: req.params.id,
        user: req.user._id,
    });

    if (!budget) {
        res.status(404);
        throw new Error('Budget not found');
    }

    await budget.deleteOne({ _id: budget._id });
    res.json({ message: 'Budget removed' });
});

// Helper function to get period start date
function getPeriodStartDate(period) {
    const now = new Date();

    switch (period) {
        case 'weekly':
            return new Date(now.setDate(now.getDate() - 7));
        case 'yearly':
            return new Date(now.setFullYear(now.getFullYear() - 1));
        default: // monthly
            return new Date(now.setMonth(now.getMonth() - 1));
    }
}

// Function to check budget thresholds (to be called by cron job)
const checkBudgetThresholds = async () => {
    const budgets = await Budget.find({ notifications: true });

    for (const budget of budgets) {
        const startDate = getPeriodStartDate(budget.period);

        const spent = await Transaction.aggregate([
            {
                $match: {
                    user: budget.user,
                    type: 'expense',
                    category: budget.category,
                    date: { $gte: startDate },
                },
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' },
                },
            },
        ]);

        const spentAmount = spent.length > 0 ? spent[0].total : 0;
        const percentage = (spentAmount / budget.amount) * 100;

        if (percentage >= budget.threshold) {
            const user = await User.findById(budget.user);
            if (user) {
                await sendBudgetAlertEmail(
                    user.email,
                    budget.category,
                    percentage,
                    budget.amount,
                    spentAmount
                );
            }
        }
    }
};

export {
    createBudget,
    getBudgets,
    getBudgetById,
    updateBudget,
    deleteBudget,
    checkBudgetThresholds,
};