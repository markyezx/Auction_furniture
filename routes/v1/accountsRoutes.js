const express = require('express');
const router = express.Router();

const { 
  changePassword, 
  forgotPassword,  // ✅ เพิ่มฟังก์ชัน forgot password
  resetPassword, 
  sendEmailVerification, 
  sendPhoneVerification, 
  verifyEmail, 
  verifyPhone, 
  verifyPhoneTemp, 
  deactivateAccount, 
  unverifyEmail, 
  unverifyPhone, 
  verifyRefreshTokenOTP, 
  getOneAccount, 
  getAllAccounts, 
  deleteOneAccount, 
  deleteAllAccounts, 
  updateBusinessesByUserId 
} = require('../../controllers/accountsControllers');

const { verifyAccessToken, verifyRefreshToken } = require('../../middlewares/auth');

const { checkLogin } = require("../../middlewares/authMiddleware");

//? Change Password
router.patch("/password/change/:user", changePassword);

//? Forgot Password (✅ เพิ่ม Endpoint)
router.post("/forgot-password", forgotPassword);

//? Reset Password (✅ อัปเดตให้ใช้ token-based reset)
router.post("/reset-password", resetPassword);

//? Send Email Verification
router.post("/verification/email/:email", verifyAccessToken, sendEmailVerification);

//? Send Phone Verification
router.post("/verification/phone/:phone", verifyAccessToken, sendPhoneVerification);

//? Verify Email
router.get("/verify/email", verifyEmail);

//? Verify Phone
router.post("/verify/phone", verifyAccessToken, verifyPhone);
router.post("/verify/phonetemp", verifyAccessToken, verifyPhoneTemp);

//? Deactivate Account
router.patch("/deactivate/:user", verifyAccessToken, deactivateAccount);

//? Unverify Email
router.patch("/unverify/email/:user", verifyAccessToken, unverifyEmail);

//? Unverify Phone
router.patch("/unverify/phone/:user", verifyAccessToken, unverifyPhone);

//? Verify Password
router.post("/refreshtokenotp/verify", verifyRefreshToken, verifyRefreshTokenOTP);

//? Get One Account
router.get("/:user", verifyAccessToken, getOneAccount);

//? Get All Accounts
router.get("/", verifyAccessToken, getAllAccounts);

//? Delete One Account
router.delete("/:user", verifyAccessToken, deleteOneAccount);

//? Delete All Accounts
router.delete("/", verifyAccessToken, deleteAllAccounts);

//? Update Businesses by User ID
router.post("/udb0", verifyAccessToken, updateBusinessesByUserId);

module.exports = router;
