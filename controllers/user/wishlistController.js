const Wishlist = require("../../models/wishlistSchema")
const Product = require("../../models/productSchema")
const User = require("../../models/userSchema")
const Cart = require("../../models/cartSchema")

const getWishlist = async (req, res) => {
    try {
        const user = req.session.user;
        if (!user) {
            res.redirect("/login")
        }
        const userData=await  User.findById(user)
        const wishlist = await Wishlist.findOne({ userId: user }).populate('products.productId')
        if (!wishlist || wishlist.products.length < 0) {
            return res.render('wishlist', { wishlistItems: [] })
        }
        const wishlistItems = wishlist.products.map(item => ({
            id: item.productId._id,
            name: item.productId.productName,
            description: item.productId.description,
            price: item.productId.salePrice,
            stock: item.productId.quantity > 0 ? 'In Stock' : 'Out of Stock',
            image: item.productId.productImage[0],
            stockStatus: item.productId.quantity > 0,
        }));
       
        res.render('wishlist', { wishlistItems, user: userData })
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        res.status(500).send('Internal server error');
    }
}


const addToWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        const productId = req.body.productId;
        if (!userId && !productId) {
            console.log('userId or productId is missing');
            return res.redirect('/')
        }

        const wishlist = await Wishlist.findOne({ userId, "products.productId": productId });

        if (wishlist) {
            return res.status(200).json({ success: false, message: "Product is already in your wishlist!" });
        }

        await Wishlist.updateOne(
            { userId },
            { $addToSet: { products: { productId } } },
            { upsert: true }
        );

        res.status(200).json({ success: true, message: "Product added to wishlist!" });


    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error adding product to wishlist" });

    }
}

const removeWishlist = async (req, res) => {
    try {
        console.log('remove from wishlst');
        const userId = req.session.user;
        if (!userId) {
            console.log('user  not found');
            return res.status(400).redirct('/login')
        }
        const productId = req.query.id;

        await Wishlist.updateOne(
            { userId },
            { $pull: { products: { productId } } }
        );

        res.status(200).json({ success: true, message: 'Product removed from wishlist' });
    } catch (error) {
        console.error('Error removing from wishlist:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}



module.exports = {
    getWishlist,
    addToWishlist,
    removeWishlist,
}