const express = require("express");
const { createAuction, getAuctions, getAuctionById, placeBid, endAuctions, getAuctionHistory, getBidHistory ,forceEndAuctions } = require("../../controllers/auctionController");
const { checkLogin } = require("../../middlewares/authMiddleware");

const router = express.Router();

router.use(checkLogin);

router.post("/", createAuction);
router.get("/", getAuctions);
router.get("/:id", getAuctionById);
router.post("/:id/bids", placeBid);
router.get("/:id/history", getAuctionHistory); // 📌 ดูประวัติการประมูล
router.get("/:id/bids", getBidHistory); // 📌 ดูประวัติการ Bid
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


module.exports = router;
