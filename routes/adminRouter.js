const express=require('express')
const router=express.Router();
const multer = require("multer");
const adminController=require("../controllers/admin/adminController")
const customerController=require("../controllers/admin/customerController")
const categoryController=require("../controllers/admin/categoryController")
const productcontroller=require("../controllers/admin/productController")
const {userAuth,adminAuth}=require("../middlewares/auth")
const storage = require('../helpers/multer')
const uploads = multer({ storage: storage });

//Login 
router.get('/pageerror',adminController.pageerror)
router.get('/login',adminController.loadLogin)
router.post('/login',adminController.login)
router.get('/dashboard',adminAuth,adminController.loadDashboad)
router.get('/logout',adminController.logout)


//Customers
router.get('/customers',adminAuth,customerController.customerInfo)
router.get("/blockCustomer",adminAuth,customerController.customerBlocked)
router.get("/unblockCustomer",adminAuth,customerController.customerUnblocked)


//Category
router.get('/category',adminAuth,categoryController.categoryInfo)
router.post("/addCategory",adminAuth,categoryController.addCategory)
router.get("/listCategory",adminAuth,categoryController.getListCategory)
router.get("/unlistCategory",adminAuth,categoryController.getUnlistCategory)
router.get("/editCategory",adminAuth,categoryController.getEditCategory)
router.post("/editCategory/:id",adminAuth,categoryController.editCategory)


//Product
router.get("/addProducts",adminAuth,productcontroller.getProductAddPage)
router.post("/addProducts",adminAuth,uploads.array("images",4),productcontroller.addProducts)
router.get("/products",adminAuth,productcontroller.getAllProducts)
router.get("/blockProduct",adminAuth,productcontroller.blockProduct)
router.get("/unblockProduct",adminAuth,productcontroller.unblockProduct)
router.get("/editProduct",adminAuth,productcontroller.getEditProduct)
router.post("/editProduct/:id",adminAuth,uploads.array('images',4),productcontroller.editProduct)
router.post("/deleteImage",adminAuth,productcontroller.deleteSingleImage)


module.exports=router