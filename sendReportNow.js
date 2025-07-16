import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import Transaction from './src/models/Transaction.js';
import Budget from './src/models/Budget.js';
import { Parser } from 'json2csv';
import { sendMonthlyReportEmail } from './src/config/email.js';

// Load environment variables
dotenv.config();

async function main() {
    await mongoose.connect(process.env.MONGO_URI);

    // CHANGE THIS to your actual email address
    const user = await User.findOne({ email: `${process.env.EMAIL_USERNAME}` });
    if (!user) {
        console.log('User not found!');
        process.exit(1);
    }

    // Get last month range
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const start = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
    const end = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0, 23, 59, 59);

    // Get totals
    const totals = await Transaction.aggregate([
        {
            $match: {
                user: user._id,
                date: { $gte: start, $lte: end },
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

    // Top 3 expenses
    const topExpenses = await Transaction.aggregate([
        {
            $match: {
                user: user._id,
                type: 'expense',
                date: { $gte: start, $lte: end },
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

    // Budget progress
    const budgets = await Budget.find({ user: user._id });
    const budgetProgress = await Promise.all(
        budgets.map(async (budget) => {
            const spent = await Transaction.aggregate([
                {
                    $match: {
                        user: user._id,
                        type: 'expense',
                        category: budget.category,
                        date: { $gte: start, $lte: end },
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

    // All transactions for the CSV
    const transactions = await Transaction.find({
        user: user._id,
        date: { $gte: start, $lte: end },
    }).lean();
    const fields = ['date', 'type', 'category', 'amount', 'description', 'createdAt'];
    const parser = new Parser({ fields });
    const csv = parser.parse(transactions);

    // Send the email
    await sendMonthlyReportEmail(
        user.email,
        user.name,
        {
            totalIncome,
            totalExpenses,
            netSavings,
            topExpenses: topExpenses.map(te => ({ category: te._id, amount: te.total })),
            budgets: budgetProgress,
        },
        csv
    );

    console.log('Monthly report sent to', user.email);
    await mongoose.disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
