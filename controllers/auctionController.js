// controllers/auctionController.js
const Auction = require("../schemas/v1/auction.schema");
const Bid = require("../schemas/v1/bid.schema");
const { sendWinnerEmail } = require("../modules/email/emailService");
const { isValidObjectId } = require("mongoose");

exports.createAuction = async (req, res) => {
  try {
    const { name, startingPrice, minimumBidIncrement = 10, expiresAt } = req.body;
    if (!name || !startingPrice || !expiresAt) {
      return res.status(400).send({ status: "error", message: "Missing required fields" });
    }
    if (new Date(expiresAt) <= new Date()) {
      return res.status(400).send({ status: "error", message: "Invalid expiration date" });
    }

    const auction = new Auction({
      name,
      startingPrice,
      currentPrice: startingPrice,
      minimumBidIncrement,
      expiresAt: new Date(expiresAt),
      owner: req.user.userId,
    });
    await auction.save();
    res.status(201).send({ status: "success", data: auction });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
};

exports.getAuctionById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).send({ status: "error", message: "Invalid auction ID" });
    }
    const auction = await Auction.findById(id).populate("highestBidder", "name email")
      .populate({ path: "bids", select: "user amount createdAt", populate: { path: "user", select: "name" } });
    if (!auction) {
      return res.status(404).send({ status: "error", message: "Auction not found" });
    }
    res.status(200).send({ status: "success", data: auction });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
};

exports.getAuctions = async (req, res) => {
  try {
    const auctions = await Auction.find().populate("highestBidder", "name email");
    res.status(200).send({ status: "success", data: auctions });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
};

exports.getAuctionHistory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).send({ status: "error", message: "Invalid auction ID" });
    }

    const auction = await Auction.findById(id).select("history").populate("history.user", "name email");
    if (!auction) {
      return res.status(404).send({ status: "error", message: "Auction not found" });
    }

    res.status(200).send({ status: "success", data: auction.history });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
};


exports.placeBid = async (req, res) => {
  try {
    const { amount } = req.body;
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).send({ status: "error", message: "Invalid auction ID" });
    }

    const auction = await Auction.findById(id);
    if (!auction) {
      return res.status(404).send({ status: "error", message: "Auction not found" });
    }
    if (new Date() > auction.expiresAt) {
      return res.status(400).send({ status: "error", message: "Auction has expired" });
    }
    if (auction.highestBidder?.toString() === req.user.userId) {
      return res.status(400).send({ status: "error", message: "You cannot place consecutive bids" });
    }
    if (amount < auction.currentPrice + auction.minimumBidIncrement) {
      return res.status(400).send({ status: "error", message: "Bid too low" });
    }

    // 📌 ตรวจสอบว่า Bid ซ้ำภายใน 5 วินาทีไม่ได้
    const lastBid = await Bid.findOne({ auction: auction._id, user: req.user.userId }).sort({ createdAt: -1 });
    if (lastBid && (Date.now() - lastBid.createdAt.getTime() < 5000)) {
      return res.status(400).send({ status: "error", message: "You must wait 5 seconds before bidding again" });
    }

    const bid = new Bid({ auction: auction._id, user: req.user.userId, amount });
    auction.currentPrice = amount;
    auction.highestBidder = req.user.userId;
    auction.bids.push(bid._id);
    auction.history.push({ user: req.user.userId, action: "BID", amount });

    await Promise.all([bid.save(), auction.save()]);
    res.status(201).send({ status: "success", data: { auction, bid } });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
};


exports.endAuctions = async () => {
  try {
    const expiredAuctions = await Auction.find({ expiresAt: { $lt: new Date() }, status: "active" })
      .populate("highestBidder", "email name")
      .populate("owner", "email name");

    for (let auction of expiredAuctions) {
      auction.status = "ended";
      auction.winner = auction.highestBidder || null;
      auction.finalPrice = auction.currentPrice;
      await auction.save();

      if (auction.winner) {
        await sendWinnerEmail(auction.highestBidder.email, auction.name, auction.finalPrice);
      }
    }
  } catch (err) {
    console.error("Error ending auctions:", err);
  }
};

exports.getBidHistory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).send({ status: "error", message: "Invalid auction ID" });
    }

    const bids = await Bid.find({ auction: id }).populate("user", "name email").sort({ createdAt: -1 });
    if (!bids.length) {
      return res.status(404).send({ status: "error", message: "No bids found" });
    }

    res.status(200).send({ status: "success", data: bids });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
};
