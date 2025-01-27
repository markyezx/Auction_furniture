const express = require("express");
const { createAuction, getAuctions, placeBid } = require("../../controllers/auctionController");
const { checkLogin } = require("../../middlewares/authMiddleware");

const router = express.Router();

// Middleware ตรวจสอบ Secure Cookie
router.use(checkLogin);

// Routes
router.post("/", createAuction); // สร้างการประมูล
router.get("/", getAuctions);   // ดูรายการประมูลทั้งหมด
router.post("/:id/bids", placeBid); // ลงประมูล

module.exports = router;
