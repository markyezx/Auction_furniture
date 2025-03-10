const express = require("express");
const multer = require("multer");
const path = require("path");
const paymentController = require("../../controllers/paymentController");

const router = express.Router();

// 📌 ตั้งค่าอัปโหลดไฟล์สลิป
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/slips/"); // 📂 เก็บไฟล์ไว้ในโฟลเดอร์นี้
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // ตั้งชื่อไฟล์
  },
});
const upload = multer({ storage });

// 🔹 สร้าง QR Code
// router.post("/generate-qr", paymentController.generatePromptPayQR);

router.post("/generate-qr", paymentController.generateSellerQR);

// 🔹 ตรวจสอบสถานะการชำระเงิน
router.get("/payment-status/:id", paymentController.checkPaymentStatus);

// 🔹 อัปโหลดสลิปการโอนเงิน
router.post("/upload-slip/:id", upload.single("slip"), paymentController.uploadSlip);

// ✅ ตรวจสอบสถานะการชำระเงิน
router.get("/check-status/:id", paymentController.checkPaymentStatus);

module.exports = router;
