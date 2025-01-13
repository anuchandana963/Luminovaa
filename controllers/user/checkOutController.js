const User = require('../../models/userSchema')
const Cart = require('../../models/cartSchema')
const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const Address = require('../../models/addressSchema')
const Order = require('../../models/orderSchema')




const checkout = async (req, res) => {
    try {
        const userId = req.session.user;
        const productId = req.query.id;
        console.log('productId', productId);


        if (!userId) {
            console.log('user not found');
            return res.redirect('/login')
        }

        const address = await Address.findOne({ userId })
        const addresses = address ? address.address : [];
 
        let totalPrice = 0;


        if (productId) {
            const product = await Product.findOne({ _id: productId, isBlock: false });
            if (!product) {
                console.log('Product not founded');
                return res.redirect('/');

            }

            totalPrice = product.salePrice;
            return res.render('checkout', { cart: null, product, address: addresses, totalPrice })
        } else {
            const cart = await Cart.findOne({ userId }).populate('items.productId');
            if (!cart || cart.items.length === 0) {
                console.log('Cart not found or empty');
                return res.redirect('/');
            }

            totalPrice = cart.items.reduce((total, item) => total + item.totalPrice, 0);
            return res.render('checkout', { cart, products: cart.items, address: addresses, totalPrice, product: null })

        }
    } catch (error) {
        console.error('get check out', error);
        res.render('page-404')
    }
}



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

            if (!product || product.isBlocked) {
                console.error(`Product is blocked or not found: ${item.productId}`);
                return res.status(400).send(`Product not available for purchase: ${item.productId}`);
            }

            orderedItems.push({
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
        console.log(req.body);

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
        const order = await Order.findById(id);
        res.render('successCheckOut', { orderId: order._id })

    } catch (error) {
        console.error("Error loading cofirmation page", error);
        res.redirect('/page-not-found');
    }
}


    const placeOrder= async (req, res) => {
        try {
            const { orderId, paymentDetails, paymentSuccess } = req.body;
    
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






module.exports = {
    checkout,
    placeOrderInitial,
    orderConfirm,
    PostCheckOut,
    placeOrder,

}