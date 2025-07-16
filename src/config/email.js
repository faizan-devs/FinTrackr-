import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
    },
});

export const sendWelcomeEmail = async (email, name) => {
    const mailOptions = {
        from: process.env.EMAIL_USERNAME,
        to: email,
        subject: 'Welcome to FinTrackr!',
        html: `
        <h1>Welcome to FinTrackr, ${name}!</h1>
        <p>Thank you for signing up. We're excited to help you manage your finances better.</p>
        <p>Start by adding your transactions and setting up budgets to get the most out of our service.</p>
        `,
    };

    await transporter.sendMail(mailOptions);
};

export const sendBudgetAlertEmail = async (email, category, percentage, budgetAmount, spentAmount) => {
    const mailOptions = {
        from: process.env.EMAIL_USERNAME,
        to: email,
        subject: `Budget Alert: ${category}`,
        html:
            `
        <h1>Budget Alert</h1>
        <p>You've spent ${percentage}% of your ${category} budget!</p>
        <p><strong>Budget:</strong> ${budgetAmount}</p>
        <p><strong>Spent:</strong> ${spentAmount}</p>
        <p>Consider reviewing your expenses in this category to stay on track.</p>
    `,
    };

    await transporter.sendMail(mailOptions);
};

export const sendMonthlyReportEmail = async (email, name, reportData, csvData) => {
    const mailOptions = {
        from: process.env.EMAIL_USERNAME,
        to: email,
        subject: `Your Monthly Financial Report - ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
        html:
            `
        <h1>Monthly Financial Report</h1>
        <p>Hello ${name}, here's your monthly financial summary:</p>
        
        <h2>Income vs Expenses</h2>
        <p>Total Income: $${reportData.totalIncome}</p>
        <p>Total Expenses: $${reportData.totalExpenses}</p>
        <p>Net Savings: $${reportData.netSavings}</p>
        
        <h2>Top Expense Categories</h2>
        <ul>
        ${reportData.topExpenses.map(exp => `<li>${exp.category}: $${exp.amount}</li>`).join('')}
        </ul>
        
        <h2>Budget Progress</h2>
        <ul>
        ${reportData.budgets.map(b => `<li>${b.category}: $${b.spent} of $${b.budget} (${b.percentage}%)</li>`).join('')}
        </ul>
        
        <p>Log in to your account for more detailed reports and insights.</p>
    `,
        attachments: [
            {
                filename: `Monthly_Report_${new Date().toISOString().slice(0, 10)}.csv`,
                content: csvData,
                contentType: 'text/csv',
            }
        ]
    };

    await transporter.sendMail(mailOptions);
};