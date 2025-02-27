const User = require('../../models/userSchema')
const Cart = require('../../models/cartSchema')
const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const Address = require('../../models/addressSchema')
const Order = require('../../models/orderSchema')
const Razorpay = require('razorpay');
const { post } = require('../../routes/adminRouter')
const crypto = require('crypto');



const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});


const RAZORPAY_MAX_AMOUNT = 5000000000;
const RAZORPAY_MIN_AMOUNT = 100;



const checkout = async (req, res) => {
    try {
        const userId = req.session.user;
        const productId = req.query.id;
        console.log('product id passed', productId);


        if (!userId) {
            console.log('user not found');
            return res.redirect('/login')
        }


        const userData= await User.findById(userId)
        console.log("userrrr",userData)

        const address = await Address.findOne({ userId})
        const addresses = address ? address.address : [];
 
        let totalPrice = 0;


        if (productId) {
            const product = await Product.findOne({ _id: productId, isBlock: false });
            if (!product) {
                console.log('Product not founded');
                return res.redirect('/');

            }

            totalPrice = product.salePrice;
            return res.render('checkout', { cart: null, product, address: addresses, totalPrice,user: userData })
        } else {
            const cart = await Cart.findOne({ userId }).populate('items.productId');
            if (!cart || cart.items.length === 0) {
                console.log('Cart not found or empty');
                return res.redirect('/');
            }

            totalPrice = cart.items.reduce((total, item) => total + item.totalPrice, 0);
            return res.render('checkout', {user:userData, cart, products: cart.items, address: addresses, totalPrice, product: null })

        }
    } catch (error) {
        console.error('get check out', error);
        res.render('page-404')
    }
}




const verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: 'Missing required payment verification parameters'
            });
        }

        if (!req.session.razorpayOrderId || !req.session.razorpayOrderExpiry ||
            Date.now() > req.session.razorpayOrderExpiry) {
            return res.status(400).json({
                success: false,
                message: 'Order session has expired'
            });
        }

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature !== expectedSign) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment signature'
            });
        }

        if (req.session.razorpayOrderId !== razorpay_order_id) {
            return res.status(400).json({
                success: false,
                message: 'Order verification failed'
            });
        }

        const payment = await razorpay.payments.fetch(razorpay_payment_id);

        if (payment.status !== 'captured') {
            return res.status(400).json({
                success: false,
                message: `Payment not captured. Current status: ${payment.status}`
            });
        }

        delete req.session.razorpayOrderId;
        delete req.session.razorpayOrderExpiry;

        res.status(200).json({
            success: true,
            message: 'Payment verified successfully',
            paymentId: razorpay_payment_id,
        });

    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Payment verification failed',
            error: error.message
        });
    }
};





const createOrder = async (req, res) => {
    try {
        const { amount, addressId } = req.body;
        const userId = req.session.user;
        console.log(req.body);

        if (!amount || typeof amount !== 'number' || amount <= 0) {
            console.log('not 1');
            return res.status(400).json({
                success: false,
                message: 'Invalid amount. Amount must be a positive number'
            });
        }

        if (!addressId) {
            console.log('not 12');
            return res.status(400).json({
                success: false,
                message: 'Delivery address is required'
            });
        }

        if (!userId) {
            console.log('not 13');
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        const amountInPaise = Math.round(amount * 100);

        if (amountInPaise < RAZORPAY_MIN_AMOUNT) {
            console.log('not 14');
            return res.status(400).json({
                success: false,
                message: `Amount must be at least ₹${RAZORPAY_MIN_AMOUNT / 100}`
            });
        }

        if (amountInPaise > RAZORPAY_MAX_AMOUNT) {
            console.log('not 15');
            return res.status(400).json({
                success: false,
                message: `Amount exceeds maximum limit of ₹${RAZORPAY_MAX_AMOUNT / 100}`
            });
        }

        const receipt = crypto
            .randomBytes(16)
            .toString('hex');

            console.log('recept',receipt);

        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt,
            notes: {
                userId: userId.toString(),
                addressId: addressId.toString()
            }
        };

        console.log(options);

        const razorpayOrder = await razorpay.orders.create(options);
        console.log(razorpayOrder+'razorpayOrder');
        

        req.session.razorpayOrderId = razorpayOrder.id;
        console.log(req.session.razorpayOrderId+'eq.session.razorpayOrderId');

        req.session.razorpayOrderExpiry = Date.now() + (30 * 60 * 1000); // 30 minutes expiry
        console.log('not 21');
        res.status(200).json({
            success: true,
            id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            receipt: razorpayOrder.receipt
        });

    } catch (error) {
        console.error('Razorpay order creation error:', error);

  
        if (error.error && error.error.code === 'BAD_REQUEST_ERROR') {
            return res.status(400).json({
                success: false,
                message: error.error.description || 'Invalid request parameters',
                error: error.error
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to create payment order',
            error: error.message
        });
    }
};




const PostCheckOut = async (req, res) => {
    try {
        const { payment_method, cartproducts, addressId, totalPrice, finalPrice,} = req.body;
        console.log(req.body);

        const userId = req.session.user;
        if (!userId) {
            console.log('User not found');
            return res.redirect('/login');
        }

        const cart = await Cart.findOne({ userId }).populate('items.productId');

      
        const orderedItems = [];
        for (const item of cart.items) {
            const product = await Product.findById(item.productId);
            console.log(product)

            if (!product || product.isBlocked) {
                console.error(`Product is blocked or not found: ${item.productId}`);
                return res.status(400).send(`Product not available for purchase: ${item.productId}`);
            }

            orderedItems.push({
                productName: item.productName,
                product: item.productId,
                quantity: item.quantity,
                price: item.totalPrice / item.quantity,
            });
        }
        console.log('workk')

        if (!finalPrice || !addressId || !payment_method) {
            console.log('Missing required fields');
            return res.status(400).send('Incomplete checkout information');
        }


        const createOrder = new Order({
            orderedItems,
            user: userId,
            totalPrice: totalPrice,
            finalAmount: finalPrice,
            address: addressId,
            paymentMethod: payment_method,
            status: 'pending',
            discount: totalPrice - finalPrice + 40,
            deliveryCharge: 40,
            paymentStatus: 'Pending'



        });
        


        console.log('Order created:', createOrder);

        await createOrder.save();
        for (const item of orderedItems) {
            const product = await Product.findById(item.product);
            if (product) {
                console.log(product);
                product.quantity = product.quantity - item.quantity;
                console.log(product.quantity);
                if (product.quantity < 0) {
                    console.error(`Stock insufficient for product ID: ${product._id}`);
                    return res.status(400).send(`Insufficient stock for product: ${product.name}`);
                }
                await product.save();
            }
        }

        cart.items = [];
        await cart.save()
        console.log('Order saved successfully');

        res.render('successCheckOut', { orderId: createOrder._id })
    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).send('Internal Server Error');
    }
};



const placeOrderInitial = async (req, res) => {
    try {
        const { cart, totalPrice, addressId, singleProduct, payment_method, finalPrice, discount } = req.body;
        const userId = req.session.user;
   

        let orderedItems = [];
        if (singleProduct) {
            const product = JSON.parse(singleProduct);
            orderedItems.push({
                product: product._id,
                quantity: 1,
                price: product.salePrice,
            });
            await Product.findByIdAndUpdate(product._id, {
                $inc: { quantity: -1 }
            });
            console.log(product);

        } else if (cart) {
            const cartItems = JSON.parse(cart);
            orderedItems = cartItems.map(item => ({
                productName: item.productName,
                product: item.productId,
                quantity: item.quantity,
                price: item.totalPrice / item.quantity,
            }));
            
            cartItems.forEach(async item => {
                await Product.findByIdAndUpdate(item.productId, {
                    $inc: { quantity: -item.quantity }
                })
            })
        }

        const addressDoc = await Address.findOne({ userId });
        const address = addressDoc.address.find(addr => addr._id.toString() === addressId);

        const newOrder = new Order({
            orderedItems,
            totalPrice,
            discount: discount,
            finalAmount: finalPrice,
            user: userId,
            address: address,
            status: 'pending',
            paymentMethod: payment_method,
            paymentStatus: 'Pending',
        });

        const cartempty = await Cart.findOne({ userId })
        cartempty.items = []
        await cartempty.save()


        await newOrder.save();
        res.status(200).json({ success: true, orderId: newOrder._id });
    } catch (error) {
        console.error("Error placing initial order:", error);
        res.status(500).json({ success: false, message: 'Failed to save order. Please try again.' });
    }
};





const orderConfirm = async (req, res) => {
    try {

        const id = req.query.id
        const user=req.session.user;
        const order = await Order.findById(id);
        const userData=await User.findById(user)
        res.render('successCheckOut', { orderId: order._id ,user:userData})

    } catch (error) {
        console.error("Error loading cofirmation page", error);
        res.redirect('/page-not-found');
    }
}


    const placeOrder= async (req, res) => {
        try {
            const { orderId, paymentDetails, paymentSuccess } = req.body;
            console.log('reqbody',req.body)
            const order = await Order.findById(orderId);
            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }
    
            if (paymentSuccess) {
                order.paymentStatus = 'Completed';
            } else {
                order.paymentStatus = 'Pending';
            }
    
            if (paymentDetails) {
                order.paymentDetails = paymentDetails;
            }
    
            await order.save();
    
            res.status(200).json({
                success: true,
                message: `Order ${paymentSuccess ? 'completed' : 'pending due to payment failure'}`,
                orderId: order._id
            });
        } catch (error) {
            console.error("Error updating order payment status:", error);
            res.status(500).json({ success: false, message: 'Failed to update order. Please try again.' });
        }
    };

    const addAddress = async (req, res) => {
        try {
            const user = req.session.user;
            const userData=await User.findById(user)
            res.render("checkaddress", { user: userData })
        } catch (error) {
            res.redirect("/pageNotFound")
        }
    }
    
    const postAddAddress = async (req, res) => {
    
        try {
            const userId = req.session.user;
            const userData = await User.findOne({ _id: userId })
            const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;
    
            const userAddress = await Address.findOne({ userId: userData._id })
    
            if (!userAddress) {
                const newAddress = new Address({
                    userId: userData._id,
                    address: [{ addressType, name, city, landMark, state, pincode, phone, altPhone }],
                })
                await newAddress.save()
            } else {
                userAddress.address.push({ addressType, name, city, landMark, state, pincode, phone, altPhone })
                await userAddress.save()
            }
    
            res.redirect("/checkOut")
    
        } catch (error) {
            console.error("Got error to adding address:", error);
            res.redirect("/pageNotFound")
        }
    
    
    }  



    
    const paymentFailed = async (req, res) => {
        try {
            const user=req.session.user;
            const userData=await User.findById(user)
            const { errorReference, message } = req.query;
            const orderId = req.query.id;
            res.render('payment-failed', {user:userData, errorReference, message, orderId });
    
        } catch (error) {
    
        }
    }
    const retryPayment = async (req, res) => {
        const orderId = req.body.orderId || req.query.orderId;
    
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
    
        try {
            const razorpayOrder = await razorpay.orders.create({
                amount: order.finalAmount * 100,
                currency: order.currency,
                receipt: `order_rcptid_${order.id}`,
            });
    
            req.session.razorpayOrderId = razorpayOrder.id;
            req.session.razorpayOrderExpiry = Date.now() + (30 * 60 * 1000);
    
            res.json({
                success: true,
                razorpayOrderId: razorpayOrder.id,
                razorpayKey: process.env.RAZORPAY_KEY_ID,
                amount: order.finalAmount,
                currency: order.currency
            });
        } catch (error) {
            console.error(error)
            res.status(500).json({ success: false, message: 'Failed to create Razorpay order' });
        }
    }
    





module.exports = {
    checkout,
    createOrder,
    placeOrderInitial,
    orderConfirm,
    PostCheckOut,
    placeOrder,
    verifyPayment,
    addAddress,
    postAddAddress,
    paymentFailed,
    retryPayment,                        
}