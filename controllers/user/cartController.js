const Cart=require("../../models/cartSchema")
const User=require("../../models/userSchema")
const Product=require("../../models/productSchema");
const req = require("express/lib/request");


const showCart=async (req,res)=>{
    try {
        const userId=req.session.user;
        if(!userId){
            res.redirect("/login")
        }
        const user=await User.findById(userId)
        const cartData= await Cart.findOne({userId}).populate('items.productId')
        const totalAmt=cartData.items.reduce((sum,item)=>sum+item.totalPrice,0)
        if(!cartData){
            res.render("cart",{cart:null,products:[],totalAmt:0,user:user})
        }
        console.log({cart:cartData,products:cartData.items,totalAmt,user:user});
        
        res.render("cart",{cart:cartData,products:cartData.items,totalAmt,user:user})
       
    } catch (error) {
        console.error(error)
        res.redirect("/pageNotFound")
    }
}

const addToCart=async (req,res)=>{
   try {
        const userId=req.session.user;
        console.log("add to cart invoked")
        
        if(!userId){
        return res.status(404).redirect("/login")
        }
        const productId= req.body.productId;
        const quantity=req.body.quantity||1
        const quantityNumber=parseInt(quantity,10)

        console.log("productId",productId);
        
        const product= await Product.findOne({_id:productId})
        console.log(userId);
        console.log("sale price:",product.salePrice);
        const productPrice=product.salePrice
        const productQuantity=product.quantity
        if(quantityNumber>productQuantity){
            return  res.status(400).json({message:"Product Out Of Stock"})
          }
        const itemTotalPrice=product.salePrice*quantityNumber;

      

        let cart= await Cart.findOne({userId:userId})
        if(!cart){
            cart= new Cart({
                userId:userId,
                items:[{
                    productId:productId,
                    quantity:quantityNumber,
                    price:productPrice,
                    totalPrice:itemTotalPrice,
                }]

            })
        }else {
            const itemIndex = cart.items.findIndex(item => item.productId.equals(productId));

            if (itemIndex > -1) {
                if(product.quantity > quantityNumber && cart.items[itemIndex].quantity < 5 ){
                    cart.items[itemIndex].quantity += quantityNumber;
                    cart.items[itemIndex].totalPrice = cart.items[itemIndex].quantity * productPrice;

                }else{
                    console.log('something went wrong');
                    
                    return  res.status(400).json({message:"Product limit reached"});
                }
            }else{
                cart.items.push({
                    productId:productId,
                    quantity:quantityNumber,
                    price:productPrice,
                    totalPrice:itemTotalPrice,
                })
            }
        }
        let dataSave=await cart.save()
        if(dataSave){
            console.log("Cart is Saved");
            return res.status(200).json({success:true})
        }else{
            console.error("Cart Not Saved");
        }
        
        
    } catch (error) {
        res.status(500).send("Error in adding cart")
        console.error("Error in adding cart",error);

    }
}



const removeCart=async (req,res)=>{
    try {
        const user=req.session.user;
        const id=req.query.id;
        console.log(id);
        
        if(!id){
           return res.status(400).redirect("/pageNotFound")
        }
         const cart=await Cart.findOne({userId:user})
         console.log(cart);
         
         const prodId=cart.items.findIndex(item=>item.productId.toString()===id)
         if(prodId||prodId==0){
            cart.items.splice(prodId,1)
            await cart.save()
         }
        
         await Cart.deleteOne({_id:id})
        res.redirect("/showCart")

    } catch (error) {
        console.error(error)
        res.status(500).redirect("/pageNotFound")
    }
} 



const clearCart=async(req,res)=>{
    try {
        const userId =req.session.user;
        if(!userId){
            res.redirect("/login")
        }
        let cart= await Cart.findOne({userId:userId})
        if(cart){
            cart.items=[];
            await cart.save()
            res.redirect('/showCart')
        }else{
            res.redirect('/')
        }
    

    } catch (error) {
        console.log(error);
        res.render('page-404')

    }
}


const updateQuantity=async (req,res)=>{
    const {productId,change}=req.body;
    try {
         
         const user=req.session.user;
         if(!user){
            return res.json({success:false,message:"User is not login"})
         }
        
         const cart=await Cart.findOne({userId:user})
         if(!cart){
            return res.json({success:false,message:"Cart Not Found"})
         }

         const cartItems= cart.items.find((item)=>item.productId.toString()===productId)
         if(cartItems){
            cartItems.quantity+=change;
            cartItems.totalPrice=cartItems.quantity*cartItems.price;

            if (cartItems.quantity <= 0) {
                cart.items = cart.items.filter((item) => item.productId.toString() !== productId);
            }

            cart.totalPrice = cart.items.reduce((total, item) => total + item.totalPrice, 0);
            await cart.save();

            res.json({
                success: true,
                newQuantity: cartItems.quantity,
                newSubtotal: cartItems.totalPrice,
                totalPrice: cart.totalPrice,
            })

         }else{
            res.json({ success: false, message: "Item not found in cart" });
         }

    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Failed to update quantity" });
    }
}







module.exports={
    showCart,
    addToCart,
    removeCart,
    clearCart,
    updateQuantity,
} 
