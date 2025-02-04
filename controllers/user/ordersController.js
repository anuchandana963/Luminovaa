const User = require('../../models/userSchema')
const Order = require('../../models/orderSchema')
const Product = require('../../models/productSchema')
const Address = require('../../models/addressSchema')
const Coupon = require('../../models/couponSchema')
const Return = require("../../models/returnSchema")
const Wallet=require('../../models/walletSchema')
const Cart = require('../../models/cartSchema')
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


const removeCoupon = async (req, res) => {
    try {
        console.log('Request body:', req.body); 

        const { totalPrice } = req.body;

        if (totalPrice === undefined) {
            console.log('Total price is undefined'); 
            return res.status(400).json({
                success: false,
                message: 'Total price is required'
            });
        }

        const discountAmount = 0;
        const finalTotal = totalPrice;

        console.log('Sending response:', { success: true, discountAmount, finalTotal }); 

        return res.status(200).json({
            success: true,
            discountAmount,
            finalTotal
        });
    } catch (error) {
        console.error("Detailed error in removeCoupon:", error); 
        return res.status(500).json({
            success: false,
            message: "Failed to remove coupon",
            error: error.message
        });
    }
};




const downloadInvoice = async (req, res) => {
    try {
    const { id } = req.query;
    const order = await Order.findById(id).populate('orderedItems.product');
    const addressDoc = await Address.findOne({ userId: req.session.user });
    if (!order) {
        return res.status(404).send("Order not found");
    }
    const address = addressDoc.address.find((addr) => addr._id.toString() === order.address.toString());

    if (!address) {
        return res.status(404).send("Address not found");
    }

    const doc = new PDFDocument({ margin: 50 });

    const filename = `invoice-${order.orderId}.pdf`;

    res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-type', 'application/pdf');
    doc.pipe(res);

    generateHeader(doc);
    doc.moveDown();

    generateCustomerInformation(doc, order, address);
    doc.moveDown();

    generateInvoiceTable(doc, order);
    doc.moveDown();

    generateFooter(doc, order);

    doc.end();
} catch (error) {
    console.error("Error generating invoice:", error);
    res.status(500).send("Error generating invoice");
}
};

const generateHeader = (doc) => {

doc
    .fillColor('#444444')
    .fontSize(20)
    .text('Luminova', 110, 57)
    .fontSize(10)
    .text('Luminova', 200, 50, { align: 'right' })
    .moveDown();

doc.strokeColor('#aaaaaa')
    .lineWidth(1)
    .moveTo(50, 90)
    .lineTo(550, 90)
    .stroke();
};

const generateCustomerInformation = async (doc, order, address) => {
const customerInfoTop = 100;

console.log(address.name);

doc
    .fontSize(16)
    .text('Invoice', 50, customerInfoTop)
    .fontSize(10)
    .text(`Invoice No.: ${order.orderId}`, 50, customerInfoTop + 30)
    .text(`Invoice Date: ${order.createdOn.toLocaleDateString()}`, 50, customerInfoTop + 45)
    .text(`Due Date: ${order.createdOn.toLocaleDateString()}`, 50, customerInfoTop + 60)

    .text('Bill To:', 300, customerInfoTop + 30)
    .font('Helvetica-Bold')
    .text(address.name, 300, customerInfoTop + 45)
    .font('Helvetica')
    .text(address.landMark, 300, customerInfoTop + 60)
    .text(`${address.city}, ${address.state} - ${address.pincode}`, 300, customerInfoTop + 75)
    .text(`Phone: ${address.phone}`, 300, customerInfoTop + 90)
    .moveDown();

doc.strokeColor('#aaaaaa')
    .lineWidth(1)
    .moveTo(50, customerInfoTop + 110)
    .lineTo(550, customerInfoTop + 110)
    .stroke();
};

const generateInvoiceTable = (doc, order) => {
let i;
const invoiceTableTop = 330;
const tableTop = 250;

doc
    .fontSize(10)
    .text('Item', 50, tableTop)
    .text('Name', 150, tableTop)
    .text('Unit Price', 280, tableTop, { width: 90, align: 'right' })
    .text('Quantity', 370, tableTop, { width: 90, align: 'right' })
    .text('Line Total', 470, tableTop, { width: 90, align: 'right' });

doc
    .strokeColor('#aaaaaa')
    .lineWidth(1)
    .moveTo(50, tableTop + 15)
    .lineTo(550, tableTop + 15)
    .stroke();

let position = 0;
order.orderedItems.forEach((item, index) => {
    position = tableTop + 30 + (index * 30);

    doc
        .fontSize(10)
        .text(`${index + 1}`, 50, position)
        .text(item.product.productName, 150, position)
        .text("₹"+item.product.salePrice.toLocaleString(), 280, position, { width: 90, align: 'right' })
        .text(item.quantity.toString(), 370, position, { width: 90, align: 'right' })
        .text("₹"+(item.quantity * item.product.salePrice).toLocaleString(), 470, position, { width: 90, align: 'right' });
});

const subtotalPosition = position + 30;
doc.strokeColor('#aaaaaa')
    .lineWidth(1)
    .moveTo(50, subtotalPosition)
    .lineTo(550, subtotalPosition)
    .stroke();

doc
    .fontSize(10)
    .text('Subtotal:', 380, subtotalPosition + 15)
    .text("Rs."+order.totalPrice.toLocaleString(), 470, subtotalPosition + 15, { width: 90, align: 'right' })
    .text('Discount:', 380, subtotalPosition + 30)
    .text("Rs."+order.discount.toLocaleString(), 470, subtotalPosition + 30, { width: 90, align: 'right' })
    .fontSize(12)
    .font('Helvetica-Bold')
    .text('Total:', 380, subtotalPosition + 45)
    .text("Rs."+order.finalAmount.toLocaleString(), 470, subtotalPosition + 45, { width: 90, align: 'right' });
};

const generateFooter = (doc, order) => {
doc
    .fontSize(10)
    .text('Payment Status:   ', 50, 700)
    .fillColor(order.paymentStatus === 'PAID' ? '#008000' : '#FF0000')
    .text(order.paymentStatus, 120, 700)
    .fillColor('#444444')
    .text('Shipment Status:   ', 50, 715)
    .text(order.status, 120, 715)
    .fontSize(10)
    .text('Thank you for your business. For any queries, please contact support@yourcompany.com', 50, 750, { align: 'center' });
};


const walletPayment = async (req, res) => {
    try {
        const { cart, totalPrice, addressId, singleProduct, finalPrice, coupon, discount } = req.body;
        const userId = req.session.user;
        console.log(req.body);
        

        if (!userId || !finalPrice || (!cart && !singleProduct)) {
            return res.status(400).json({ success: false, message: 'Missing required fields.' });
        }

        const wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            return res.status(400).json({ success: false, message: 'Wallet not found.' });
        }

        const amount = parseFloat(finalPrice);
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid final price.' });
        }

        if (wallet.balance < amount) {
            return res.status(400).json({ success: false, message: 'Insufficient wallet balance.' });
        }

        let orderedItems = [];
        if (singleProduct) {
            const product = JSON.parse(singleProduct);
            orderedItems.push({
                product: product._id,
                quantity: 1,
                price: product.salePrice,
            });
            await Product.findByIdAndUpdate(product._id, {
                $inc: { quantity: -1 },
            });
        } else if (cart) {
            const cartItems = JSON.parse(cart);
            orderedItems = cartItems.map(item => ({
                product: item.productId,
                quantity: item.quantity,
                price: item.totalPrice / item.quantity,
            }));
            cartItems.forEach(async item => {
                await Product.findByIdAndUpdate(item.productId, {
                    $inc: { quantity: -item.quantity },
                });
            });
        }

        const newOrder = new Order({
            orderedItems,
            totalPrice,
            discount: discount,
            finalAmount: finalPrice,
            user: userId,
            address: addressId,
            status: 'pending',
            paymentMethod: 'Wallet',
            paymentStatus: 'Completed',
            couponCode: coupon,
            couponApplied: Boolean(coupon && discount),
        });

        await newOrder.save();
        if(!singleProduct){
            const cartEmpty=await Cart.findOne({userId})
            cartEmpty.items=[]
            await cartEmpty.save()
        }

        const walletData = {
            $inc: { balance: -newOrder.finalAmount },
            $push: { 
              transactions: {
                type: "Purchase",
                amount: newOrder.totalPrice,
                orderId: newOrder._id
              }
            }
          }
      
          await Wallet.findOneAndUpdate(
            {userId:userId},
            walletData,
            { upsert: true, new: true }
          );


        res.status(200).json({ success: true, orderId: newOrder._id });
    } catch (error) {
        console.error("Error processing wallet payment:", error);
        res.status(500).json({ success: false, message: 'Failed to process wallet payment. Please try again.' });
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
    downloadInvoice,
    walletPayment,
}