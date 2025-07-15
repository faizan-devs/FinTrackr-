import asyncHandler from 'express-async-handler';
import Transaction from '../models/Transaction.js';
import Budget from '../models/Budget.js';
import { Parser } from 'json2csv';

const getMonthlySummary = asyncHandler(async (req, res) => {
    const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;

    // Calculate date range
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Debug: Log the date range
    console.log(`Querying from ${startDate} to ${endDate}`);

    const matchStage = {
        user: req.user._id,
        date: { $gte: startDate, $lte: endDate }
    };

    // 1. Get totals by type
    const totals = await Transaction.aggregate([
        { $match: matchStage },
        { $group: { _id: "$type", total: { $sum: "$amount" } } }
    ]);

    // 2. Get expenses by category
    const expensesByCategory = await Transaction.aggregate([
        {
            $match: {
                ...matchStage,
                type: "expense"
            }
        },
        { $group: { _id: "$category", total: { $sum: "$amount" } } },
        { $sort: { total: -1 } }
    ]);

    // 3. Get income by category
    const incomeByCategory = await Transaction.aggregate([
        {
            $match: {
                ...matchStage,
                type: "income"
            }
        },
        { $group: { _id: "$category", total: { $sum: "$amount" } } },
        { $sort: { total: -1 } }
    ]);

    res.json({
        totals,
        expensesByCategory,
        incomeByCategory,
        dateRange: { startDate, endDate } // For debugging
    });
});

const getSpendingTrends = asyncHandler(async (req, res) => {
    const { months = 6 } = req.query;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - months);

    const trends = await Transaction.aggregate([
        {
            $match: {
                user: req.user._id,
                type: "expense",
                date: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: "$date" },
                    month: { $month: "$date" }
                },
                total: { $sum: "$amount" },
                count: { $sum: 1 }
            }
        },
        {
            $sort: { "_id.year": 1, "_id.month": 1 }
        },
        {
            $project: {
                _id: 0,
                period: {
                    $dateToString: {
                        format: "%Y-%m",
                        date: {
                            $dateFromParts: {
                                year: "$_id.year",
                                month: "$_id.month"
                            }
                        }
                    }
                },
                total: 1,
                count: 1
            }
        }
    ]);

    res.json({
        startDate,
        endDate,
        trends: trends.length > 0 ? trends : "No spending data found for this period"
    });
});

const getSavingSuggestions = asyncHandler(async (req, res) => {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Get top 3 expense categories
    const topExpenses = await Transaction.aggregate([
        {
            $match: {
                user: req.user._id,
                type: "expense",
                date: { $gte: threeMonthsAgo }
            }
        },
        {
            $group: {
                _id: "$category",
                total: { $sum: "$amount" },
                average: { $avg: "$amount" },
                count: { $sum: 1 }
            }
        },
        { $sort: { total: -1 } },
        { $limit: 3 }
    ]);

    if (topExpenses.length === 0) {
        return res.json({
            message: "No expense data found to generate suggestions",
            defaultSuggestions: [
                {
                    category: "food",
                    suggestion: "Consider meal planning to reduce food expenses",
                    potentialSavings: 200
                },
                {
                    category: "entertainment",
                    suggestion: "Look for free community events instead of paid entertainment",
                    potentialSavings: 150
                }
            ]
        });
    }

    const suggestions = topExpenses.map(expense => {
        const { _id: category, total, average, count } = expense;

        // Generate suggestions based on category
        const suggestionMap = {
            food: {
                suggestion: "Meal planning and cooking at home could save you 20-30%",
                savingsPercent: 0.25
            },
            entertainment: {
                suggestion: "Reducing paid entertainment by 25% could save money",
                savingsPercent: 0.25
            },
            shopping: {
                suggestion: "Implement a 24-hour waiting period before purchases",
                savingsPercent: 0.3
            },
            transportation: {
                suggestion: "Carpooling or public transit could reduce costs",
                savingsPercent: 0.2
            }
        };

        const defaultSuggestion = {
            suggestion: `Review your ${category} expenses for potential savings`,
            savingsPercent: 0.15
        };

        const { suggestion, savingsPercent } = suggestionMap[category] || defaultSuggestion;

        return {
            category,
            totalSpent: total,
            averagePerTransaction: average,
            transactionCount: count,
            suggestion,
            potentialSavings: Math.round(total * savingsPercent),
            timeframe: "3 months"
        };
    });

    res.json(suggestions);
});

const exportTransactions = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const query = { user: req.user._id };

    // Add date filtering if provided
    if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
    }

    // Debug: Log the query
    console.log('Export query:', JSON.stringify(query, null, 2));

    const transactions = await Transaction.find(query)
        .sort('-date')
        .lean(); // Convert to plain JS objects

    if (transactions.length === 0) {
        return res.status(404).json({
            success: false,
            error: "No transactions found for the specified criteria",
            query
        });
    }

    // Transform data for CSV
    const transformed = transactions.map(tx => ({
        Date: tx.date.toISOString().split('T')[0],
        Type: tx.type.charAt(0).toUpperCase() + tx.type.slice(1),
        Category: tx.category,
        Amount: tx.amount,
        Description: tx.description || '',
        Created: tx.createdAt.toISOString()
    }));

    const fields = ['Date', 'Type', 'Category', 'Amount', 'Description', 'Created'];
    const opts = { fields };

    try {
        const parser = new Parser(opts);
        const csv = parser.parse(transformed);

        res.header('Content-Type', 'text/csv');
        res.attachment(`transactions-${Date.now()}.csv`);
        res.send(csv);
    } catch (err) {
        console.error('CSV conversion error:', err);
        res.status(500).json({
            success: false,
            error: 'Error generating CSV',
            details: err.message
        });
    }
});

export {
    getMonthlySummary,
    getSpendingTrends,
    getSavingSuggestions,
    exportTransactions,
};