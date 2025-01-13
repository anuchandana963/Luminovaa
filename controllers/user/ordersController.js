const User=require('../../models/userSchema')
const Order =require('../../models/orderSchema')
const Product =require('../../models/productSchema')
const Address = require('../../models/addressSchema')


const getOrders=async (req,res)=>{
    try {
       const user=req.session.user;
       if(!user){
        res.redirect("/login")
       }
       
       const orders=await Order.find({user})
       console.log("orders",orders);
       res.render("orderList",{orders})

       
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const getOrderDetails=async (req,res)=>{
     try {
        const orderId=req.query.id;
        const userId=req.session.user;
        if(!userId){
            res.redirect("/login")
        }
        const user=await User.findById(userId);
        const order= await Order.findById(orderId)
        const address=await Address.findOne({'address._id':order.address},{'address.$':1})
        const products=await Promise.all(
            order.orderedItems.map(async (item)=>{
                return await Product.findOne({_id:item.product})
            })
        );
        res.render('viewOrderDetails',{order,products,address:address.address[0],user})

     } catch (error) {
         console.error(error);
         res.redirect('/pageNotFound')
     }
}

const getOrderCancel=async (req,res)=>{
    try {
        const user=req.session.user;
        if(!user){
            res.redirect("/pageNotFound")
        }
        const id=req.query.id;
        const reson=req.query.reson;
        const order=await Order.findById(id)
        if(!order){
            console.log('Order not found'); 
            res.redirect("/orders")
        }
        if(order.paymentMethod=='COD'){
            await Order.findByIdAndUpdate(id,{$set:{paymentStatus:'Failed'}})
        }
        
        await Order.findByIdAndUpdate(id,{$set:{status:'Cancelled',cancelleationReson:reson}})
        res.redirect('/orders')

    } catch (error) {
        console.error(error);
        res.redirect('/pageNotFound')
    }
}



module.exports={
    getOrders,
    getOrderDetails,
    getOrderCancel,
}