import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        type: {
            type: String,
            enum: ['income', 'expense'],
            required: true,
        },
        category: {
            type: String,
            required: true,
            enum: [
                'salary', 'freelance', 'investments',
                'housing', 'transportation', 'food', 'utilities',
                'healthcare', 'insurance', 'entertainment', 'education',
                'shopping', 'personal', 'debt', 'other'
            ],
        },
        description: {
            type: String,
            trim: true,
        },
        date: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;

//* Investment Categories:- salary, freelance, investments (remaining are exprense categories)