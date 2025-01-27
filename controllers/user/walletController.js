const Wallet=require('../../models/walletSchema')
const env = require('dotenv').config()
const crypto = require('crypto');
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const loadWallet = async (req, res) => {
    try {
        const userId = req.session.user; 
        if (!userId) {
            return res.redirect('/login');
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5; 
        const skip = (page - 1) * limit;

        const wallet = await Wallet.findOne({ userId }).sort({createdOn:1}).populate('transactions.orderId').lean();

        if (!wallet) {
            return res.render('wallet', {
                balance: 0,
                transactions: [],
                currentPage: page,
                totalPages: 0,
                limit,
                keyId:process.env.RAZORPAY_KEY_ID

            });
        }

        const totalTransactions = wallet.transactions.length; 
        const paginatedTransactions = wallet.transactions
            .slice()
            .reverse()
            .slice(skip, skip + limit); 

        const totalPages = Math.ceil(totalTransactions / limit); 

    
        res.render('wallet', {
            balance: wallet.balance || 0,
            transactions: paginatedTransactions,
            currentPage: page,
            totalPages,
            limit,
            keyId:process.env.RAZORPAY_KEY_ID,
            user:userId
        });
    } catch (error) {
        console.error('Error loading wallet page:', error);
        res.redirect('/pageNotFound');
    }
};


const createWallet = async (req, res) => {
    try {
        const amount = req.body.amount * 100;  
        const options = {
            amount: amount,
            currency: "INR",
            receipt: "order_rcptid_11", // Use dynamic receipt id
            payment_capture: 1
        };
        console.log('    17');

        razorpay.orders.create(options, (err, order) => {
            if (err) {
                return res.status(500).json({ message: 'Error creating order', error: err });
            }
            
        console.log('    16');
           
            req.session.amount = amount;  
            
        console.log('    15');
            res.json({ orderId: order.id, amount: order.amount });
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Error creating order', error: error });
    }
}


const verifyWallet = async (req, res) => {
    try {
        const { paymentId, orderId, signature } = req.body;
        
        const userId = req.session.user;
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


            Wallet.findOneAndUpdate(
                { userId },
                {
                    $inc: { balance: amount },
                    $push: { transactions: transaction } 
                }
            )
                .then(() => {
                    req.session.amount = null; 
                    res.status(200).send({ message: 'Payment successful' });
                })
                .catch((err) => {
                    
                    res.status(500).send({ message: 'Error updating wallet', error: err });
                });
        } else {
           
            res.status(400).send({ message: 'Payment verification failed' });
        }
    } catch (error) {
       
        res.status(500).send({ message: 'Error verifying payment', error: error });
    }
};




module.exports={
    loadWallet,
    verifyWallet,
    createWallet
}