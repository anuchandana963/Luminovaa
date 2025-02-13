const mongoose=require('mongoose')
const env =require('dotenv').config();
const User = require('../models/userSchema')

const connectDB= async()=>{
    try {
      await  mongoose.connect(process.env.MONGODB_URI)
      console.log('DB Connected');
      console.log("users ", await User.find())
    } catch (error) {
        console.log('DB Connection error',error.message);
        process.exit(1);
        
    }
}

module.exports=connectDB