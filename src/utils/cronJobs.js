import cron from 'node-cron';
import { checkBudgetThresholds } from '../controllers/budgetController.js';
import { sendMonthlyReportEmail } from '../config/email.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { Parser } from 'json2csv';
import Budget from '../models/Budget.js';

// Run every day at 9 AM
cron.schedule('0 9 * * *', async () => {
    console.log('Running daily budget threshold checks...');
    await checkBudgetThresholds();
});

// Run on the 1st of every month at 10 AM
cron.schedule('0 10 1 * *', async () => {
    console.log('Running monthly report generation...');

    const users = await User.find();
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    for (const user of users) {
        // Get monthly totals
        const totals = await Transaction.aggregate([
            {
                $match: {
                    user: user._id,
                    date: {
                        $gte: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
                        $lte: new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0),
                    },
                },
            },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' },
                },
            },
        ]);

        const totalIncome = totals.find(t => t._id === 'income')?.total || 0;
        const totalExpenses = totals.find(t => t._id === 'expense')?.total || 0;
        const netSavings = totalIncome - totalExpenses;

        // Get top 3 expenses
        const topExpenses = await Transaction.aggregate([
            {
                $match: {
                    user: user._id,
                    type: 'expense',
                    date: {
                        $gte: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
                        $lte: new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0),
                    },
                },
            },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' },
                },
            },
            { $sort: { total: -1 } },
            { $limit: 3 },
        ]);

        // Get budget progress
        const budgets = await Budget.find({ user: user._id });
        const budgetProgress = await Promise.all(
            budgets.map(async (budget) => {
                const spent = await Transaction.aggregate([
                    {
                        $match: {
                            user: user._id,
                            type: 'expense',
                            category: budget.category,
                            date: {
                                $gte: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
                                $lte: new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0),
                            },
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
                    category: budget.category,
                    budget: budget.amount,
                    spent: spentAmount,
                    percentage: percentage.toFixed(2),
                };
            })
        );

        // Fetch all transactions for the CSV
        const transactions = await Transaction.find({
            user: user._id,
            date: {
                $gte: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
                $lte: new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0),
            },
        }).lean();

        // Prepare CSV
        const fields = ['date', 'type', 'category', 'amount', 'description', 'createdAt'];
        const parser = new Parser({ fields });
        const csv = parser.parse(transactions);

        // Send email with CSV attachment
        await sendMonthlyReportEmail(
            user.email,
            user.name,
            {
                totalIncome,
                totalExpenses,
                netSavings,
                topExpenses: topExpenses.map(te => ({
                    category: te._id,
                    amount: te.total,
                })),
                budgets: budgetProgress,
            },
            csv // CSV data as attachment
        );
    }
});

export default cron;