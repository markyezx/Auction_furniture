const Auction = require("../schemas/v1/auction.schema");
const Bid = require("../schemas/v1/bid.schema");

// สร้างการประมูลใหม่
exports.createAuction = async (req, res) => {
  try {
    const { name, startingPrice } = req.body;

    const auction = new Auction({
      name,
      startingPrice,
      currentPrice: startingPrice,
      owner: req.user.userId, // ใช้ userId จาก Secure Cookie
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

    if (amount <= auction.currentPrice) {
      return res.status(400).send({
        status: "error",
        message: "Bid must be higher than current price",
      });
    }

    const bid = new Bid({
      auction: auction._id,
      user: req.user.userId,
      amount,
    });

    auction.currentPrice = amount;
    auction.highestBidder = req.user.userId;

    await Promise.all([bid.save(), auction.save()]);

    res.status(201).send({ status: "success", data: bid });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
};