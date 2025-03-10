const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  auctionId: { type: mongoose.Schema.Types.ObjectId, ref: "auction", required: true },
  amount: { type: Number, required: true },
  qrCode: { type: String, required: true },
  slipImage: { type: String },
  status: { type: String, enum: ["pending", "completed"], default: "pending" },
  shippingAddress: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Payment", paymentSchema);
