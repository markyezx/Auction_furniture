const mongoose = require("mongoose");

const auctionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  startingPrice: { type: Number, required: true },
  currentPrice: { type: Number, required: true },
  minimumBidIncrement: { type: Number, required: true, default: 10 },
  expiresAt: { type: Date, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  highestBidder: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  status: { type: String, enum: ["active", "ended"], default: "active" },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // 🏆 เพิ่มผู้ชนะ
  finalPrice: { type: Number }, // 💰 เพิ่มราคาปิดประมูล
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Auction", auctionSchema);
