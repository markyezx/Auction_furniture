const express = require("express");
const { 
  createAuction, getAuctions, getAuctionById, placeBid, endAuctions, 
  getAuctionHistory, getBidHistory, forceEndAuctions, forceEndAuctionById, 
  getHighestBidder, forceExpirePayment, getCategories
} = require("../../controllers/auctionController");
const { checkLogin } = require("../../middlewares/authMiddleware");

const router = express.Router();

router.get("/", getAuctions); // ✅ ดึงรายการประมูลทั้งหมด
router.get("/categories", getCategories); // ✅ ดึงหมวดหมู่ที่รองรับ
router.get("/:id", getAuctionById); // ✅ ดึงรายละเอียดการประมูล
router.get("/:id/history", getAuctionHistory); // ✅ ดูประวัติการประมูล
router.get("/:id/bids", getBidHistory); // ✅ ดูประวัติการบิด
router.get("/:id/highest-bidder", getHighestBidder); // ✅ ดูผู้บิดสูงสุด ณ เวลานั้น

router.use(checkLogin);

router.post("/", createAuction); // ✅ สร้างการประมูลใหม่
router.post("/:id/bids", placeBid); // ✅ ทำการบิด
router.post("/end-auctions", async (req, res) => {
  try {
    await endAuctions();
    res.status(200).send({ status: "success", message: "Auctions checked and updated" });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
});

router.post("/force-end-auctions", async (req, res) => {
  try {
    await forceEndAuctions();
    res.status(200).send({ status: "success", message: "Auctions forcibly ended" });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
});

router.post("/force-end-auction/:id", async (req, res) => {
  try {
    await forceEndAuctionById(req, res);
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
});

router.post("/force-expire-payment/:id", async (req, res) => {
  try {
    await forceExpirePayment(req, res);
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
});

module.exports = router;
