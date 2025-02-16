const Product=require("../../models/productSchema")
const Category=require("../../models/categorySchema")
const User=require("../../models/userSchema");
const { CURSOR_FLAGS } = require("mongodb");

const productDetails=async(req,res)=>{
    try {
        
        const userId=req.session.user;
        const userData=await User.findById(userId)
        const productId=req.query.id;
        const product=await Product.findById(productId).populate('category')
        const findCategory=product.category;
        
        const categoryOffer=findCategory?.categoryOffer||0;
        const productOffer=product.productOffer||0;
        const totalOffer=categoryOffer+productOffer;

        const recommendedProduct=await Product.find({category:findCategory,_id:{$ne:productId}})
        
        res.render("product-details",{
            user:userData,
            product:product,
            quantity:product.quantity,
            totalOffer:totalOffer,
            category:findCategory,
            recommendedProduct
        });
        
    } catch (error) {
        console.error("Error for fetching Product details",error)
        res.redirect("/pageNotFound")
    }
}




module.exports={
    productDetails,

}

