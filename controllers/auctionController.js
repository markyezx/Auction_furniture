const Auction = require("../schemas/v1/auction.schema");
const Bid = require("../schemas/v1/bid.schema");

// สร้างการประมูล
exports.createAuction = async (req, res) => {
  try {
    const { name, startingPrice, minimumBidIncrement, expiresAt } = req.body;

    if (!expiresAt || new Date(expiresAt) <= new Date()) {
      return res.status(400).send({ status: "error", message: "Invalid auction expiration time" });
    }

    const auction = new Auction({
      name,
      startingPrice,
      currentPrice: startingPrice,
      minimumBidIncrement: minimumBidIncrement || 10, // ค่าเริ่มต้น 10
      expiresAt: new Date(expiresAt), // เวลาหมดอายุ
      owner: req.user.userId,
    });

    await auction.save();
    res.status(201).send({ status: "success", data: auction });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
};

// ดึงรายการประมูลทั้งหมด
exports.getAuctions = async (req, res) => {
  try {
    const auctions = await Auction.find().populate("highestBidder", "name email");
    res.status(200).send({ status: "success", data: auctions });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
};

// วางประมูล
exports.placeBid = async (req, res) => {
  try {
    const { amount } = req.body;
    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).send({ status: "error", message: "Auction not found" });
    }

    if (new Date() > auction.expiresAt) {
      return res.status(400).send({ status: "error", message: "Auction has expired" });
    }

    // ❌ ห้ามบิดต่อกันเอง
    if (auction.highestBidder && auction.highestBidder.toString() === req.user.userId) {
      return res.status(400).send({ status: "error", message: "You cannot place two consecutive bids." });
    }

    // ✅ ตรวจสอบ bid ต้องมากกว่าขั้นต่ำ
    if (amount < auction.currentPrice + auction.minimumBidIncrement) {
      return res.status(400).send({
        status: "error",
        message: `Bid must be at least ${auction.currentPrice + auction.minimumBidIncrement}`,
      });
    }

    const bid = new Bid({
      auction: auction._id,
      user: req.user.userId,
      amount,
      bidAt: new Date(), // 🕒 บันทึกเวลาที่ bid
    });

    auction.currentPrice = amount;
    auction.highestBidder = req.user.userId;

    await Promise.all([bid.save(), auction.save()]);

    res.status(201).send({ status: "success", data: bid });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
};

exports.endAuctions = async () => {
  try {
    const expiredAuctions = await Auction.find({ expiresAt: { $lt: new Date() }, status: "active" });

    for (let auction of expiredAuctions) {
      auction.status = "ended";
      auction.winner = auction.highestBidder || null; // 🏆 บันทึกผู้ชนะ
      auction.finalPrice = auction.currentPrice; // 💰 บันทึกราคาปิดประมูล
      await auction.save();
      console.log(`Auction ${auction._id} ended. Winner: ${auction.winner} Price: ${auction.finalPrice}`);
    }
  } catch (err) {
    console.error("Error ending auctions:", err);
  }
};
