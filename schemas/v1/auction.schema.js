// models/auction.schema.js
const mongoose = require("mongoose");

const auctionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String, required: true }, // ✅ เพิ่มฟิลด์รูปภาพสินค้า
  startingPrice: { type: Number, required: true },
  currentPrice: { type: Number, required: true },
  minimumBidIncrement: { type: Number, required: true, default: 10 },
  expiresAt: { type: Date, required: true },
  status: { type: String, enum: ["active", "ended"], default: "active" },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  highestBidder: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  highestBidderEmail: { type: String },
  finalPrice: { type: Number },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  bids: [{ type: mongoose.Schema.Types.ObjectId, ref: "Bid" }],
  history: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      action: { type: String, enum: ["BID", "UPDATE", "END"] },
      amount: Number,
      timestamp: { type: Date, default: Date.now }
    }
  ],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Auction", auctionSchema);
