const mongoose = require("mongoose");

const auctionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String, required: true },
  startingPrice: { type: Number, required: true },
  currentPrice: { type: Number, required: true },
  minimumBidIncrement: { type: Number, required: true, default: 10 },
  expiresAt: { 
    type: Date, 
    required: true, 
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000)  // ✅ ตั้งค่าอัตโนมัติ 24 ชม.
  },
  status: { type: String, enum: ["active", "ended"], default: "active" },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  highestBidder: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  highestBidderEmail: { type: String },
  finalPrice: { type: Number },
  paymentDeadline: { type: Date, default: null },
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
  category: { 
    type: String, 
    enum: [
      "designer_toys", "vinyl_figures", "resin_figures", "blind_box",
      "anime_figures", "movie_game_collectibles", "robot_mecha",
      "soft_vinyl", "kaiju_monsters", "diy_custom", "retro_vintage",
      "limited_edition", "gunpla_models", "plastic_models"
    ], 
    required: true 
  }, 
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Auction", auctionSchema);
