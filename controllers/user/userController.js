const User = require("../../models/userSchema")
const Category = require("../../models/categorySchema")
const Product = require("../../models/productSchema")
const session = require('express-session')
const env = require('dotenv').config()
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const { render } = require("ejs");
const { search } = require("../../routes/userRouter");
const req = require("express/lib/request")

const loadSignup = async (req, res) => {
    try {
        if(!req.session.user){
            res.render("signup")
        }else{
            res.redirect('/')
        }
    } catch (error) {
        console.log('Home page not loading:', error)
        res.status(500).send('Server Error')
    }

}



const pageNotFound = async (req, res) => {
    try {
        res.render("page-404")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}



const loadHomepage = async (req, res) => {
    try {
        // const user = req.user;
        const userId = req.session.user
        console.log("user Id", userId);


        const category = await Category.find({ isListed: true })
        console.log(category)
        let productData = await Product.find({
            isBlocked: false,
            category: { $in: category.map(category => category._id) }, quantity: { $gt: 0 }
        }).sort({ createdAt: -1 })
      

        // if (req.isAuthenticated()) {
        //     return res.render("home",{user:userId,productData})
        // }

        // productData.sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt)).reverse()


        if (userId) {
            const userData = await User.findOne({ _id: userId })
            console.log(userData);

            res.render("home", { user: userData, productData })
        } else {
            return res.render("home", { productData })
        }

    } catch (error) {
        console.log("home page not found")
        res.status(500).send("server error")
    }
}

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
async function sendVerificationEmail(email, otp) {
    console.log(email);

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            }
        })
        console.log("verification:", email, otp);

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "verify your account",
            text: `Your OTP is${otp}`,
            html: `<b>Your OTP: ${otp}</b>`,
        })
        return info.accepted.length > 0

    } catch (error) {
        console.error("Error sending email", error)
        return false;
    }
}

const signup = async (req, res) => {

    try {
        const { name, phone, email, password, cpassword } = req.body;
        console.log("Request Body:", req.body);

        if (password !== cpassword) {
            return res.render("singup", { message: "Password not matching" })
        }
        const findUser = await User.findOne({ email })
        if (findUser) {
            return res.render("signup", { message: "User with this email already exits" })
        }
        const otp = generateOtp();

        console.log("Sending OTP to:", email, otp);

        const emailSend = await sendVerificationEmail(email, otp)
        if (!emailSend) {
            return res.json('email-error')
        }

        req.session.userOtp = otp;
        req.session.userData = { name, phone, email, password }

        res.render("verify-otp")
        console.log("OTP Send", otp);


    } catch (error) {
        console.error("signup error", error);
        res.redirect("/pageNotFound")

    }
}

const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10)
        return passwordHash;
    } catch (error) {

    }
}

const verifyOtp = async (req, res) => {
    try {

        const { otp } = req.body
        console.log("entered otp:", otp);
        console.log("session otp:", req.session.userOtp);
        if (otp === req.session.userOtp) {
            const user = req.session.userData
            const passwordHash = await securePassword(user.password)

            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone,
                password: passwordHash,
            })
            await saveUserData.save();
            req.session.user = saveUserData._id;
            // res.redirect("/")
            res.status(200).json({ success: true, redirectUrl: "/" })
        } else {
            res.status(400).json({ success: false, message: "Invalide OTP, Please try again" })
        }
    } catch (error) {
        console.error("Error Verifying OTP", error);
        res.status(500).json({ success: false, message: "An error occured" })
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



const loadLogin = async (req, res) => {
    try {
        if (req.session.user) {
            const user = await User.findById(req.session.user);
            if (user && user.isBlocked) {
                req.session.user = null;
                return res.render("login", { message: "User is blocked" });
            }else{
                return res.redirect("/");
            }
            
        } else {
            return res.render("login", { message: '' });
        }


    } catch (error) {
        res.redirect('/pageNotFound')
    }
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;


        const findUser = await User.findOne({ isAdmin: 0, email: email })

        if (!findUser) {

            return res.render("login", { message: "User not found" })

        }
        if (findUser.isBlocked) {
            return res.render("login", { message: "User is bloced by admin" })

        }
        const passwordMatch = await bcrypt.compare(password, findUser.password)

        if (!passwordMatch) {
            return res.render('login', { message: "Incorrect password" })
        }

        req.session.user = findUser._id;

        res.redirect("/")

    } catch (error) {

        console.error('login error', error)
        res.render('login', { message: "login falied.Please try again later" })

    }
}


const logout = async (req, res) => {
    try {
        req.session.user = null;
        res.redirect('/login')
    } catch (error) {
        console.log("logout error", error)
        res.redirect("/pagenotFound")
    }
}

const loadShoppingPage = async (req, res) => {
    try {
        const user = req.session.user;
        const { sort } = req.query;

        let sortOption = {};
        if (sort === 'price_asc') {
        sortOption.salePrice = 1; // Ascending
        } else if (sort === 'price_desc') {
        sortOption.salePrice = -1; // Descending
        } else if (sort === 'name_asc') {
        sortOption.productName = 1; // Alphabetical A-Z
        } else if (sort === 'name_desc') {
        sortOption.productName = -1; // Alphabetical Z-A
        }else{
            sortOption.createOn=-1;
        }



        const userData = await User.findOne({ _id: user });
        const categorise = await Category.find({ isListed: true })
        const categoryId = categorise.map((category) => category._id.toString())
        const page = parseInt(req.query.page) || 1
        const limit = 8;
        const skip = (page - 1) * limit
        const product = await Product.find({
            isBlocked: false,
            category: { $in: categoryId },
            quantity: { $gt: 0 },
        }).sort(sortOption).skip(skip).limit(limit);

        const totalProducts = await Product.countDocuments({
            isBlocked: false,
            category: { $in: categoryId },
            quantity: { $gt: 0 }
        })
        const totalPages = Math.ceil(totalProducts / limit)


        const categoriseWithIds = categorise.map(category => ({ _id: category._id, name: category.name }))


        return res.render("shop", {
            user: userData,
            products: product,
            category: categoriseWithIds,
            totalProducts: totalProducts,
            currentPage: page,
            totalPages: totalPages
        })
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}


const filterProduct = async (req, res) => {
    try {
        const user = req.session.user;
        const category = req.query.category;
        const findCategory = category ? await Category.findOne({ _id: category }) : null;
        const query = {
            isBlocked: false,
            quantity: { $gt: 0 }
        }
        if (findCategory) {
            query.category = findCategory._id;
        }

        let findProducts = await Product.find(query).lean();
        findProducts.sort((a, b) => new Date(b.createdOn) - new Date(a.createOn));

        const categorise = await Category.find({ isListed: true })

        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(findProducts.length / itemsPerPage)
        let currentProduct = findProducts.slice(startIndex, endIndex)
        let userData = null;
        if (user) {
            userData = await User.findOne({ _id: user });
            if (userData) {
                const searchEntry = {
                    category: findCategory ? findCategory._id : null,
                    searchedOn: new Date(),

                }
                userData.searchHistory.push(searchEntry);
                await userData.save();
            }
        }

        req.session.filterProduct = currentProduct;

        res.render("shop", {
            user: userData,
            products: currentProduct,
            category: categorise,
            totalPages,
            currentPage,
            SelectedCategory: category || null,

        })
    } catch (error) {
        console.error(error)
        res.redirect("/pageNotFound")
    }
}

const filterByPrice = async (req, res) => {
    try {
        console.log('filtering page');

        const user = req.session.user
        const userData = await User.find({ _id: user })
        const category = await Category.find({ isListed: true }).lean()

        let findProducts = await Product.find({
            salePrice: { $gt: req.query.gt, $lt: req.query.lt },
            isBlocked: false,
            quantity: { $gt: 0 },
        }).lean()

        findProducts.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn))

        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(findProducts.length / itemsPerPage);
        const currentProduct = findProducts.slice(startIndex, endIndex)

        req.session.filteredProducts = findProducts;

        res.render("shop", {
            user: userData,
            products: currentProduct,
            category: category,
            totalPages,
            currentPage,
        })




    } catch (error) {
        console.error(error);
        res.redirect("/pageNotFound")

    }
}


const searchProducts = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = await User.findOne({ _id: user });

        let search = req.body.query;

        const category = await Category.find({ isListed: true }).lean();
        const categoryIds = category.map(category => category._id.toString())
        let searchResult
        if (req.session.filteredProducts && req.session.filteredProducts.length > 0) {
            search = req.session.filteredProducts.filter(product => {
                return product.productName.toLowerCase().includes(search.toLowerCase())
            })
        } else {
            searchResult = await Product.find({
                productName: { $regex: ".*" + search + ".*", $options: "i" },
                isBlocked: false,
                quantity: { $gt: 0 },
                category: { $in: categoryIds }
            })
        }
        // console.log("searchResult",searchResult)
        searchResult.sort((a,b) => new Date(b.createOn) - new Date(a.createOn))
        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(searchResult.length / itemsPerPage);
        const currentProduct = searchResult.slice(startIndex, endIndex);

        res.render("shop", {
            user: userData,
            products: currentProduct,
            category: category,
            totalPages,
            currentPage,
            count: searchResult.length
        })

    } catch (error) {
        console.log("Error", error);
        res.redirect("/pageNotFound")
    }
}






module.exports = {
    loadHomepage,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout,
    loadShoppingPage,
    filterProduct,
    filterByPrice,
    searchProducts,

}