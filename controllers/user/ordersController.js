const User = require('../../models/userSchema')
const Order = require('../../models/orderSchema')
const Product = require('../../models/productSchema')
const Address = require('../../models/addressSchema')
const Coupon = require('../../models/couponSchema')
const Return = require("../../models/returnSchema")
const Wallet=require('../../models/walletSchema')

const PDFDocument = require('pdfkit');
const path = require('path');
const { exists } = require('../../models/categorySchema')



const getOrders = async (req, res) => {
    try {
        const user = req.session.user;
        if (!user) {
            res.redirect("/login")
        }

        const orders = await Order.find({ user }).sort({ createdOn: -1 })
        const userData=await User.findById(user)
        res.render("orderList", { orders,user: userData})


    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.query.id;
        const userId = req.session.user;
        if (!userId) {
            res.redirect("/login")
        }
        const user = await User.findById(userId);
        const order = await Order.findById(orderId)
        const address = await Address.findOne({ 'address._id': order.address }, { 'address.$': 1 })
        const products = await Promise.all(
            order.orderedItems.map(async (item) => {
                return await Product.findOne({ _id: item.product })
            })
        );
      
       console.log("address",address)
        res.render('viewOrderDetails', { order, products, address: address.address[0], user })

    } catch (error) {
        console.error(error);
        res.redirect('/pageNotFound')
    }
}

const getOrderCancel= async (req,res)=>{
    try {
        
        const userId=req.session.user;
        if(!userId){
            console.log('user not found');
            return res.redirect('/login')
        }

        const id=req.query.id;
        const reason=req.query.reason;
        const order = await Order.findById(id);
        if (!order) {
            console.log('Order not found');
            return res.redirect('/orders');
        }
        if (order.paymentMethod === 'Online' && order.paymentStatus === 'Completed') {
            const refundAmount = order.finalAmount;
            console.log(refundAmount);
            

     
            const wallet = await Wallet.findOneAndUpdate(
                { userId },
                {
                    $inc: { balance: refundAmount }, 
                    $push: {
                        transactions: {
                            type: 'Refund',
                            amount: refundAmount,
                            orderId: id,
                            description: `Refund for cancelled order #${id}`,
                            status: 'Completed', 
                        },
                    },
                    lastUpdated: new Date(),
                },
                { new: true, upsert: true } 
            );
            

            console.log(`Refund of ₹${refundAmount} added to wallet for user ${userId}`);
        }else if(order.paymentMethod=='COD'){
            await Order.findByIdAndUpdate(id,{$set:{paymentStatus:'Failed'}})
        }
        for(let i=0;i<order.orderedItems.length;i++){
            const product=await Product.findById(order.orderedItems[i].product)
            product.quantity+=order.orderedItems[i].quantity
            await product.save()
        }
        


        await Order.findByIdAndUpdate(id,{$set:{status:'Cancelled',cancelleationReson:reason}})
        res.redirect('/orders')
    } catch (error) {
        console.error(error);
        res.redirect('/pageNotFound')

        
    }
}

const returnRequest = async (req, res) => {
    try {
        const userId = req.session.user;
        const { orderId, reason } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        const exists = await Return.findOne({ orderId });
        if (exists) {
            return res.status(400).json({ message: "Order already applied for return request" });
        }

        const refundAmount = order.finalAmount;
        const newReturn = new Return({
            userId,
            orderId,
            reason,
            refundAmount,
        });

        await newReturn.save();
        return res.status(200).json({ message: "Return request successfully applied" });
    } catch (error) {
        console.error("Error on return:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};



const getCoupons = async (req, res) => {
    try {
        const userId = req.session.user;
        console.log(userId);

        if (!userId) {
            res.redirect("/login")
        }
        const currentDate = new Date()
        console.log("Fetching coupons for user:", userId);

        const coupons = await Coupon.find({
            isList: true,
            userId: { $ne: userId },
            expiredOn: { $gt: new Date() },
        });

        console.log("Coupons fetched:", coupons);

        res.render('couponList', { coupons, user: userId });

    } catch (error) {
        console.log("error", error);
        res.redirect("/pageNotFound")
    }
}




const applyCoupon = async (req, res) => {
    try {
        const { couponCode, totalAmount } = req.body;
        const userId = req.session.user;
        if (!couponCode || !totalAmount) {
            return res.status(400).json({ success: false, message: "Missing coupon code or price" })
        }

        const coupon = await Coupon.findOne({ name: couponCode, expiredOn: { $gt: Date.now() } })
        if (!coupon) {
            return res.json({ success: false, meassge: 'invalid or expired coupon' })
        }
        if (coupon.minimumPrice > totalAmount) {
            return res.json({ success: false, message: `minimum price to apply coupon ${coupon.minimumPrice}` });
        }
        if (coupon.userId.includes(userId)) {
            return res.json({ success: false, message: "coupon is already used by you" });

        }
        const discount = parseFloat(coupon.offerPrice);
        if (isNaN(discount)) {
            return res.status(400).json({ success: false, message: "Invalid discount value" });
        }
        const discountAmount = (totalAmount * discount) / 100;
        const finalTotal = totalAmount - discountAmount

        res.status(200).json({
            success: true,
            discountAmount: discountAmount.toFixed(2),
            finalTotal: finalTotal.toFixed(2),
            message: "Coupon applied successfully!"
        })
    } catch (error) {
        console.error(error);
        res.redirect('/pageNotFound')
    }
}

// Backend
const removeCoupon = async (req, res) => {
    try {
        console.log('Request body:', req.body); // Debug log

        const { totalPrice } = req.body;

        if (totalPrice === undefined) {
            console.log('Total price is undefined'); // Debug log
            return res.status(400).json({
                success: false,
                message: 'Total price is required'
            });
        }

        const discountAmount = 0;
        const finalTotal = totalPrice;

        console.log('Sending response:', { success: true, discountAmount, finalTotal }); // Debug log

        return res.status(200).json({
            success: true,
            discountAmount,
            finalTotal
        });
    } catch (error) {
        console.error("Detailed error in removeCoupon:", error); // More detailed error logging
        return res.status(500).json({
            success: false,
            message: "Failed to remove coupon",
            error: error.message
        });
    }
};








module.exports = {
    getOrders,
    getOrderDetails,
    getOrderCancel,
    returnRequest,
    getCoupons,
    applyCoupon,
    removeCoupon,
}