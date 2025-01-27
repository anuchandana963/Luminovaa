const User = require("../../models/userSchema")
const Address = require("../../models/addressSchema");
const req = require("express/lib/request");
const nodemailer = require("nodemailer");
const { render } = require("ejs");
const bcrypt = require('bcrypt')

const userProfile = async (req, res) => {
    try {
        console.log("Form data received:", req.body)
        const userId = req.session.user;

        //console.log('userData',userId);
        if (!userId) {
            res.redirect('/login')
        }
        const userData = await User.findById(userId)
        const addressData = await Address.findOne({ userId: userId })
        //  console.log('userData');
        res.render("profile", {
            user: userData,
            userAddress: addressData,
        })

    } catch (error) {
        console.error("error for retrieve profile data", error);
        res.redirect("/pageNotFound")
    }
}

const getEditProfile = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            res.redirect("/login")
        }
        const userData = await User.findById(userId)
        // console.log(userData);

        res.render("edit-profile", { userData })
    } catch (error) {
        console.error(error);
        res.redirect("/pageNotFount")
    }
}
const EditProfile = async (req, res) => {
    try {
        const { name, phone } = req.body
        const user = req.session.user
        await User.findByIdAndUpdate(user, { $set: { name, phone } })
        res.redirect('/userProfile')
    } catch (error) {
        console.log(error);
        res.redirect("/pageNotFound")
    }
}




const addAddress = async (req, res) => {
    try {
        const user = req.session.user;
        const userData=await User.findById(user)
        res.render("add-address", { user: userData })
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const postAddAddress = async (req, res) => {

    try {
        const userId = req.session.user;
        const userData = await User.findOne({ _id: userId })
        const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;

        const userAddress = await Address.findOne({ userId: userData._id })

        if (!userAddress) {
            const newAddress = new Address({
                userId: userData._id,
                address: [{ addressType, name, city, landMark, state, pincode, phone, altPhone }],
            })
            await newAddress.save()
        } else {
            userAddress.address.push({ addressType, name, city, landMark, state, pincode, phone, altPhone })
            await userAddress.save()
        }

        res.redirect("/userProfile")

    } catch (error) {
        console.error("Got error to adding address:", error);
        res.redirect("/pageNotFound")
    }


}

const getAddress=async(req,res)=>{
    try {
        const user=req.session.user;
        if(!user){
            res.redirect("/login")
        }
        res.render("address")
    } catch (error) {
        console.log(error);
        res.redirect("/pageNotFound")
        
    }
}

const editAddress = async (req, res) => {
    try {
        const addressId = req.query.id;
        const user = req.session.user;
        // console.log("addressId",addressId);

        const currentAddress = await Address.findOne({
            userId: user,
        })
       

        if (!currentAddress) {
            return res.redirect("/paggeNotFound")
        }
        const addressData = currentAddress.address.find((item) => {
            return item._id.toString() === addressId.toString()
        })
        

        if (!addressData) {
            return res.redirect("/pageNotFound")
        }
 
         
        const userData=await User.findById(user)
        console.log(userData);
        
        res.render("edit-address", { address: addressData, user: userData })

    } catch (error) {
        console.error("Error in edit address", error)
        res.redirect("/pageNotFound")
    }
}

const postEditAddress = async (req, res) => {
    try {
        const data = req.body;
        const addressId = req.query.id;
        const user = req.session.user;
        const findAddress = await Address.findOne({ "address._id": addressId })
        if (!findAddress) {
            res.redirect("/pagrNotFound")
        }
        await Address.updateOne(
            { "address._id": addressId },
            {
                $set: {
                    "address.$": {
                        id: addressId,
                        addressType: data.addressType,
                        name: data.name,
                        city: data.city,
                        landMark: data.landMark,
                        state: data.state,
                        pincode: data.pincode,
                        phone: data.phone,
                        altPhone: data.altPhone,
                    }
                }
            }
        )
        res.redirect("/userProfile")

    } catch (error) {
        console.log("Error for edit address", error);
        res.redirect("/pageNotFound")
    }
}

// addressController.js
const deleteAddress = async (req, res) => {
    try {
        const addressId = req.query.id;
        const findAddress = await Address.findOne({ "address._id": addressId });
        if (!findAddress) {
            return res.status(404).send("Address not found");
        }
        await Address.updateOne(
            {
                "address._id": addressId,
            },
            {
                $pull: {
                    address: {
                        _id: addressId,
                    }
                }
            }
        );
        res.redirect("/userProfile");
    } catch (error) {
        console.log("Error in deleting address", error);
        res.redirect("/pageNotFound");
    }
};




const getForgotPassPage = async (req, res) => {
    try {
        res.render("forgot-password")
    } catch (error) {
        res.redirect("/pageNotFound")
    }

}

function generateOtp() {

    return Math.floor(100000 + Math.random() * 900000).toString();
}


async function sendVerificationEmail(email, otp) {
    try {
        if (!email) {
            console.error("No recipient email provided.");
            return false;
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            },
        });

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Verify your account",
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP: ${otp}</b>`,
        });

        console.log("Email sent info:", info);
        return info.accepted.length > 0;

    } catch (error) {
        console.error("Error sending email:", error.message);
        console.error(error.stack);
        return false;
    }
}

const forgotEmailValid = async (req, res) => {
    try {
        const { email } = req.body;
        const findUser = await User.find({ email: email })
        //console.log("findUser",findUser);

        if (findUser) {
            const otp = generateOtp()
            //console.log("otp",otp);

            const emailSend = await sendVerificationEmail(email, otp);
            if (emailSend) {
                req.session.userOtp = otp;
                req.session.email = email;
                res.render("forgotPass-otp")
                // console.log("OTP:",otp);

            } else {
                res.json({ success: false, message: "false to send OTP.Place try again later" })
            }
        } else {
            res.render("forgot-password", { message: "User with this email dose not exist" })
        }

    } catch (error) {
        res.redirect("/pageNotFound")
    }
}


const verifyForgotPassOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp
        if (enteredOtp === req.session.userOtp) {
            res.json({ success: true, render: "reset-password", redirectUrl: "/reset-password" })
        } else {
            res.json({ success: false, message: "OTP not matching" })
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "An error occured.Please try again" })
    }

}

const getResetPassPage = async (req, res) => {
    try {
        res.render("reset-password")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}


const resendOtp = async (req, res) => {
    //console.log("resend otp");

    try {
        const otp = generateOtp()
        req.session.userOtp = otp
        const email = req.session.email
        //console.log(email);
        // console.log(req.session);

        const emailSent = await sendVerificationEmail(email, otp)
        if (emailSent) {
            // console.log("resend OTP:",otp);
            res.status(200).json({ success: true, message: "Resend OTP successful" })
        }
    } catch (error) {
        console.error("error in resend otp", error)
        res.status(500).json({ success: false, message: "Internal server error" })
    }
}

const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10)
        return passwordHash
    } catch (error) {

    }
}

const postNewPassword = async (req, res) => {
    try {
        const { newPass1, newPass2 } = req.body;
        console.log("newpass", newPass1, newPass2);
        const email = req.session.email;
        console.log("reset", email);

        if (newPass1 === newPass2) {
            const passwordHash = await securePassword(newPass1)
            console.log(passwordHash)


            await User.findOneAndUpdate(
                { email: email }, { password: passwordHash }
            )
            res.redirect("/login")
        } else {
            res.render("reset-password", { message: 'password do not matching' })
        }
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}


module.exports = {
    forgotEmailValid,
    getForgotPassPage,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
    userProfile,
    getAddress,
    getEditProfile,
    addAddress,
    postAddAddress,
    editAddress,
    postEditAddress,
    deleteAddress,
    EditProfile
}