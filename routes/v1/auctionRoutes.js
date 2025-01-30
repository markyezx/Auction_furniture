const express = require("express");
const { createAuction, getAuctions, placeBid ,endAuctions} = require("../../controllers/auctionController");
const { checkLogin } = require("../../middlewares/authMiddleware");

const router = express.Router();

// Middleware ตรวจสอบ Secure Cookie
router.use(checkLogin);

// Routes
router.post("/", createAuction); // สร้างการประมูล
router.get("/", getAuctions);   // ดูรายการประมูลทั้งหมด
router.post("/:id/bids", placeBid); // ลงประมูล
router.post("/end-auctions", async (req, res) => {
    try {
      await endAuctions();
      res.status(200).send({ status: "success", message: "Auctions checked and updated" });
    } catch (err) {
      res.status(500).send({ status: "error", message: err.message });
    }
  });

module.exports = router;
