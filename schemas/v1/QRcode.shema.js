const mongoose = require("mongoose");

const QRCodeSchema = new mongoose.Schema({
  recipient: { type: String, required: true },
  amount: { type: Number, required: true },
  payload: { type: String, required: true },
  qrCode: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  isPaid: { type: Boolean, default: false },
});

module.exports = mongoose.model("QRCode", QRCodeSchema);