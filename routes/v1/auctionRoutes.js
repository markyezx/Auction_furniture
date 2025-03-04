const express = require("express");
const multer = require("multer");
const { 
  createAuction, getAuctions, getAuctionById, placeBid, endAuctions, 
  getAuctionHistory, getBidHistory, forceEndAuctions, forceEndAuctionById, 
  getHighestBidder, forceExpirePayment, getCategories,getMyAuctionHistory, getMyBidHistory
} = require("../../controllers/auctionController");
const { checkLogin } = require("../../middlewares/authMiddleware");
const Auction = require("../../schemas/v1/auction.schema");

const router = express.Router();

// ✅ กำหนดค่า `multer` ก่อนใช้งาน
const upload = multer({ storage: multer.memoryStorage() });

router.get("/my-auctions", checkLogin, getMyAuctionHistory);
router.get("/my-bids", checkLogin ,getMyBidHistory);
// ✅ ดึงรายการประมูลทั้งหมด
router.get("/", getAuctions);
router.get("/categories", getCategories);
router.get("/:id", getAuctionById);
router.get("/:id/history", getAuctionHistory);
router.get("/:id/bids", getBidHistory);
router.get("/:id/highest-bidder", getHighestBidder);

// ✅ ใช้ `checkLogin` เพื่อป้องกัน API ที่ต้องมีการล็อกอิน
router.use(checkLogin);

// ✅ สร้างการประมูลใหม่ (รองรับการอัปโหลด 5 รูป)
router.post("/", upload.array("images", 5), createAuction);

// ✅ ทำการบิด
router.post("/:id/bids", placeBid);

// ✅ อัปเดตสถานะการประมูลที่หมดเวลา
router.post("/end-auctions", async (req, res) => {
  try {
    await endAuctions();
    res.status(200).send({ status: "success", message: "Auctions checked and updated" });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
});

// ✅ ปิดการประมูลทั้งหมดแบบบังคับ
router.post("/force-end-auctions", async (req, res) => {
  try {
    await forceEndAuctions();
    res.status(200).send({ status: "success", message: "Auctions forcibly ended" });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
});

// ✅ ปิดการประมูลเฉพาะ ID แบบบังคับ
router.post("/force-end-auction/:id", async (req, res) => {
  try {
    await forceEndAuctionById(req, res);
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
});

// ✅ หมดเวลาชำระเงินแบบบังคับ
router.post("/force-expire-payment/:id", async (req, res) => {
  try {
    await forceExpirePayment(req, res);
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
});

// ✅ ดึงรายการประมูลของตัวเองที่ยังเปิดอยู่
router.get("/my-auctions", async (req, res) => {
  try {
    const auctions = await Auction.find({ owner: req.user.userId, status: "active" });
    res.status(200).send({ status: "success", data: auctions });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
});

// ✅ ดึงรายการประมูลที่ปิดไปแล้ว
router.get("/my-auctions/closed", async (req, res) => {
  try {
    const closedAuctions = await Auction.find({ owner: req.user.userId, status: "ended" });
    res.status(200).send({ status: "success", data: closedAuctions });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
});

module.exports = router;
