const Wallet=require('../../models/walletSchema')
const User=require("../../models/userSchema")
const env = require('dotenv').config()
const crypto = require('crypto');
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// First, modify the loadWallet function
const loadWallet = async (req, res) => {
    try {
        const user=req.session.user;
        const userData=await User.findById(user)
        // Get user ID from either regular session or passport session
        const userId = req.session.user || (req.session.passport && req.session.passport.user);
        
        if (!userId) {
            return res.redirect('/login');
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;

        const wallet = await Wallet.findOne({ userId }).sort({createdOn:1}).populate('transactions.orderId').lean();

        if (!wallet) {
            return res.render('wallet', {
                user:userData,
                balance: 0,
                transactions: [],
                currentPage: page,
                totalPages: 0,
                limit,
                keyId: process.env.RAZORPAY_KEY_ID
            });
        }

        const totalTransactions = wallet.transactions.length;
        const paginatedTransactions = wallet.transactions
            .slice()
            .reverse()
            .slice(skip, skip + limit);

        const totalPages = Math.ceil(totalTransactions / limit);

        res.render('wallet', {
            user:userData,
            balance: wallet.balance || 0,
            transactions: paginatedTransactions,
            currentPage: page,
            totalPages,
            limit,
            keyId: process.env.RAZORPAY_KEY_ID,
            user: userId
        });
    } catch (error) {
        console.error('Error loading wallet page:', error);
        res.redirect('/pageNotFound');
    }
};

// Update the createWallet function
const createWallet = async (req, res) => {
    try {
        // Get user ID from either regular session or passport session
        const userId = req.session.user || (req.session.passport && req.session.passport.user);
        
        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const amount = req.body.amount * 100;
        const options = {
            amount: amount,
            currency: "INR",
            receipt: `rcpt_${Date.now()}_${userId.toString().substr(-6)}`,
            payment_capture: 1
        };
        
        razorpay.orders.create(options, (err, order) => {
            if (err) {
                console.error('Error creating Razorpay order:', err);
                return res.status(500).json({ message: 'Error creating order', error: err });
            }
            
            req.session.amount = amount;
            res.json({ orderId: order.id, amount: order.amount });
        });
    } catch (error) {
        console.error('Error in createWallet:', error);
        res.status(500).send({ message: 'Error creating order', error: error });
    }
};

// Update the verifyWallet function
const verifyWallet = async (req, res) => {
    try {
        const { paymentId, orderId, signature } = req.body;
        
        // Get user ID from either regular session or passport session
        const userId = req.session.user || (req.session.passport && req.session.passport.user);
        
        if (!userId) {
            return res.status(401).send({ message: 'User not authenticated' });
        }

        const amount = req.session.amount/100;
         
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(orderId + "|" + paymentId);
        const generatedSignature = hmac.digest('hex');
       
        if (generatedSignature === signature) {
            const transaction = {
                type: 'Deposit',
                amount: amount,
                status: 'Completed',
                date: new Date()
            };

            await Wallet.findOneAndUpdate(
                { userId },
                {
                    $inc: { balance: amount },
                    $push: { transactions: transaction }
                },
                { new: true, upsert: true } // Create wallet if it doesn't exist
            );

            req.session.amount = null;
            res.status(200).send({ message: 'Payment successful' });
        } else {
            res.status(400).send({ message: 'Payment verification failed' });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).send({ message: 'Error verifying payment', error: error });
    }
};



module.exports={
    loadWallet,
    verifyWallet,
    createWallet
}