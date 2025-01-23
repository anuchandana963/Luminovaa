const express = require('express');
const router = express.Router();
const userController = require("../controllers/user/userController");
const passport = require('passport');
const req = require('express/lib/request');
const productController = require("../controllers/user/productControllers");
const profileController = require("../controllers/user/profileController")
const cartController = require("../controllers/user/cartController")
const checkOutControllers = require("../controllers/user/checkOutController")
const ordersController = require("../controllers/user/ordersController")
const wishlistController = require("../controllers/user/wishlistController")
const walletController=require("../controllers/user/walletController")


const { adminAuth, userAuth } = require('../middlewares/auth');
const User = require('../models/userSchema')

router.use(async (req, res, next) => {
    if (req.path === "/login") {
        return next();
    }

    if (req.session.user) {
        const user = await User.findById(req.session.user);
        if (user && user.isBlocked) {
            return res.redirect("/login");
        } else if (user) {

            return next();
        }
    }
    next();
});


router.get("/pageNotFound", userController.pageNotFound)

router.get("/", userController.loadHomepage)
router.get("/shop", userAuth, userController.loadShoppingPage)
router.get("/filter", userAuth, userController.filterProduct)



router.get("/signup", userController.loadSignup)
router.post('/signup', userController.signup)
router.post("/verify-otp", userController.verifyOtp)
router.post("/resend-otp", userController.resendOtp)

router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup' }), (req, res) => {
    req.session.user = req.user._id
    return res.redirect("/");
})

router.get('/login', userController.loadLogin);
router.post("/login", userController.login);
router.get('/logout', userAuth, userController.logout)


//product
router.get("/productDetails", userAuth, productController.productDetails)
router.get("/filterPrice", userAuth, userController.filterByPrice)
router.post("/search", userAuth, userController.searchProducts)

//userProfile
router.get("/userProfile", userAuth, profileController.userProfile)
router.get("/edit-profile", userAuth, profileController.getEditProfile)
router.post("/edit-profile", userAuth, profileController.EditProfile)

//address
router.get("getAddress",userAuth,profileController.getAddress)
router.get("/addAddress", userAuth, profileController.addAddress)

router.post("/postAddAddress", userAuth, profileController.postAddAddress)
//edit
router.get("/editAddress", userAuth, profileController.editAddress)
router.post("/editAddress", userAuth, profileController.postEditAddress)
//delete
router.get("/deleteAddress", userAuth, profileController.deleteAddress)

//forgot-pass
router.get('/forgot-password', profileController.getForgotPassPage)
router.post('/forgotPass-otp', profileController.forgotEmailValid)
router.post("/verify-passForgot-otp", profileController.verifyForgotPassOtp)
router.get("/reset-password", profileController.getResetPassPage)
router.post("/resend-forgot-otp", profileController.resendOtp)
router.post("/reset-password", profileController.postNewPassword)


//cart
router.get("/showCart", userAuth, cartController.showCart)
router.post("/addToCart", userAuth, cartController.addToCart)
router.get("/removeCart", userAuth, cartController.removeCart)
router.get("/clearCart", userAuth, cartController.clearCart)
router.post("/updateQuantity", userAuth, cartController.updateQuantity)

//cheakout
router.get('/checkout', userAuth, checkOutControllers.checkout)
router.post('/verify-payment',userAuth,checkOutControllers.verifyPayment) 
router.post('/create-order',checkOutControllers.createOrder);
router.post('/postCheckOut', userAuth, checkOutControllers.PostCheckOut)
router.post('/place-order-initial', userAuth, checkOutControllers.placeOrderInitial)

router.get('/order-confirmation', userAuth, checkOutControllers.orderConfirm)

router.post('/place-order', checkOutControllers.placeOrder);


//order
router.get('/orders', userAuth, ordersController.getOrders)
router.get('/order-details', userAuth, ordersController.getOrderDetails)
router.get('/cancel-order', userAuth, ordersController.getOrderCancel)
router.post("/return-request",userAuth,ordersController.returnRequest)

//coupon
router.get('/coupons', userAuth, ordersController.getCoupons)
router.post("/apply-coupon", userAuth, ordersController.applyCoupon)
// Example route configuration
router.post('/remove-coupon',userAuth,ordersController.removeCoupon);


//wishlist
router.get("/wishlist", userAuth, wishlistController.getWishlist)
router.post("/addToWishlist", userAuth, wishlistController.addToWishlist)
router.delete("/removeFromWishlist", userAuth, wishlistController.removeWishlist)

//wallet
router.get('/wallet',userAuth, walletController.loadWallet);
router.post('/create-wallet',userAuth,walletController.createWallet)
router.post('/verify-wallet',userAuth,walletController.verifyWallet)

module.exports = router;