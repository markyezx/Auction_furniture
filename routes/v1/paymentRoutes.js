const express = require("express");
const paymentController = require("../../controllers/paymentController"); // นำเข้า controller
const router = express.Router();

// เส้นทาง POST /generate-qr สำหรับสร้าง QR Code
router.post("/generate-qr", paymentController.generatePromptPayQR);

// เส้นทาง GET /payment-status/:id สำหรับตรวจสอบสถานะการชำระเงิน
router.get("/payment-status/:id", paymentController.checkPaymentStatus);

module.exports = router;