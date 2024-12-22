const User=  require("../../models/userSchema")
const Category=require("../../models/categorySchema")
const Product=require("../../models/productSchema")

const env=require('dotenv').config()
const nodemailer =require('nodemailer');
const bcrypt=require('bcrypt');
const { render } = require("ejs");

const loadSignup=async(req,res)=>{
    try {
          res.render("signup")
    } catch (error) {
        console.log('Home page not loading:',error)
        res.status(500).send('Server Error')
    }
    
}



const pageNotFound=async(req,res)=>{
    try {
        res.render("page-404")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}



const loadHomepage=async(req,res)=>{
    try{
        // const user = req.user;
        const userId=req.session.user
        
        
        
        const category=await Category.find({isListed:true})
        let productData=await Product.find({
            isBlocked:false,
            category:{$in:category.map(category=>category._id)},quantity:{$gt:0}
        })
        // if (req.isAuthenticated()) {
        //     return res.render("home",{user:userId,productData})
        // }

        productData.sort((a,b)=>new Date(a.createdOn)-new Date(b.createOn)).reverse()
  

        if(userId){
            const userData=await User.findOne({ _id:userId })
            res.render("home",{user:userData,productData})
        }else{
            return res.render("home",{productData})
        }

    }catch(error){
        console.log("home page not found")
        res.status(500).send("server error")
    }
}

function generateOtp(){
    return Math.floor(100000 +Math.random()*900000).toString();
}
async function sendVerificationEmail(email,otp){
    console.log(email);
    
    try {
        const transporter=nodemailer.createTransport({
            service:'gmail',
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD,
            }
        })
        console.log("verification:",email,otp);

        const info= await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"verify your account",
            text:`Your OTP is${otp}`,
            html:`<b>Your OTP: ${otp}</b>`,
        })
        return info.accepted.length>0

    } catch (error) {
        console.error("Error sending email",error)
        return false;
    }
}

const signup= async(req,res)=>{
    
    try {
        const{name,phone,email,password,cpassword}=req.body;
        console.log("Request Body:", req.body);

        if(password !==cpassword){
            return res.render("singup",{message:"Password not matching"})
        }
        const findUser=await User.findOne({email})
    if(findUser){
        return res.render("signup",{message:"User with this email already exits"})
    }
    const otp = generateOtp();

    console.log("Sending OTP to:", email, otp);

    const emailSend=await sendVerificationEmail(email,otp)
     if(!emailSend){
        return res.json('email-error')
     }

     req.session.userOtp=otp;
     req.session.userData={name,phone,email,password}

    res.render("verify-otp")
    console.log("OTP Send",otp);
    

    } catch (error) {
        console.error("signup error",error);
        res.redirect("/pageNotFound")
        
    }
}

const securePassword=async(password)=>{
    try {
        const passwordHash =await bcrypt.hash(password,10)
        return passwordHash;
    } catch (error) {
        
    }
}

const verifyOtp=async (req,res)=>{
    try {
        
        const {otp}=req.body
        console.log("entered otp:",otp);
        console.log("session otp:",req.session.userOtp);
        if(otp===req.session.userOtp){
            const user= req.session.userData
            const passwordHash= await securePassword(user.password)

            const saveUserData=new User({
                name:user.name,
                email:user.email,
                phone:user.phone,
                password:passwordHash,
            })
            await saveUserData.save();
            req.session.user=saveUserData._id;
            res.redirect("/")
            // res.json({success:true,redirectUrl:"/"})
        }else{
            res.status(400).json({success:false,message:"Invalide OTP, Please try again"})
        }
    } catch (error) {
        console.error("Error Verifying OTP",error);
        res.status(500).json({success:false,message:"An error occured"})
    }
}



const resendOtp = async (req, res) => {
    try {
        
        if (!req.session.userData) {
            return res.status(400).json({ 
                success: false, 
                message: "Session expired. Please restart the signup process." 
            });
        }

        const otp = generateOtp();
        console.log("Resend OTP:", otp);
        
        req.session.userOtp = otp;

        const { email } = req.session.userData;

        
        const emailSend = await sendVerificationEmail(email, otp);
        
        if (emailSend) {
            console.log("OTP Resent Successfully");
            res.status(200).json({ 
                success: true, 
                message: "OTP Resent Successfully" 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: "Failed to resend OTP. Please try again." 
            });
        }

    } catch (error) {
        console.error("Error resending OTP", error);
        res.status(500).json({ 
            success: false, 
            message: "Internal Server Error. Please try again." 
        });
    }
}



const loadLogin=async(req,res)=>{
    try {
        if(!req.session.user){
            return res.render('login')
    }else{
        res.redirect('/')
    }

    } catch (error) {
        res.redirect('/pageNotFound')
    }
}

const login=async(req,res)=>{
    try {
        const {email,password}=req.body;
        
        
        const findUser=await User.findOne({isAdmin:0,email:email})
        
        if(!findUser){
            
            return res.render("login",{message:"User not found"})
            
        }
        if(findUser.isBlocked){
            return res.render("login",{message:"User is bloced by admin"})
            
        }
     const passwordMatch= await bcrypt.compare(password, findUser.password)

     if(!passwordMatch){
        return res.render('login',{message:"Incorrect password"})
     }

     req.session.user = findUser._id;
     
     res.redirect("/")

    } catch (error) {
        
        console.error('login error',error)
        res.render('login',{message:"login falied.Please try again later"})

    }
}


const logout=async(req,res)=>{
    try {
        req.session.destroy((err)=>{
            if(err){
                console.log("session destroy error",err.message)
                return res.redirect("/pagenotFound")
            }
            return res.redirect("/login")
        })
    } catch (error) {
        console.log("logout error",error)
        res.redirect("/pagenotFound")
    }
}






module.exports ={
    loadHomepage,
    pageNotFound ,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,   
    logout   
}