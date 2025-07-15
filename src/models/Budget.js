import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        category: {
            type: String,
            required: true,
            enum: [
                'housing', 'transportation', 'food', 'utilities',
                'healthcare', 'insurance', 'entertainment', 'education',
                'shopping', 'personal', 'other'
            ],
        },
        amount: {
            type: Number,
            required: true,
        },
        period: {
            type: String,
            enum: ['weekly', 'monthly', 'yearly'],
            default: 'monthly',
        },
        notifications: {
            type: Boolean,
            default: true,
        },
        threshold: {
            type: Number,
            default: 80, // percentage at which to send warning
        },
    },
    { timestamps: true }
);

const Budget = mongoose.model('Budget', budgetSchema);

export default Budget;