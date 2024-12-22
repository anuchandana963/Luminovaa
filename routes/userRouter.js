const express=require('express');
const router=express.Router();
const userController =require("../controllers/user/userController");
const passport = require('passport');
const req = require('express/lib/request');
const productController=require("../controllers/user/productControllers");
const { adminAuth, userAuth } = require('../middlewares/auth');


router.get("/pageNotFound",userController.pageNotFound)
router.get("/",userController.loadHomepage)
router.get("/signup",userController.loadSignup)
router.post('/signup',userController.signup)
router.post("/verify-otp",userController.verifyOtp)
router.post("/resend-otp",userController.resendOtp)

router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));

router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    req.session.user = req.user._id
    return res.redirect("/");
})

router.get('/login',userController.loadLogin);
router.post("/login",userController.login);
router.get('/logout',userAuth,userController.logout)


//product
router.get("/productDetails",userAuth,productController.productDetails)



module.exports=router;