const mongoose = require("mongoose");

const bidSchema = new mongoose.Schema(
  {
    auction: { type: mongoose.Schema.Types.ObjectId, ref: "Auction", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["Success", "Rejected"], default: "Success" } // 📌 เพิ่มสถานะของการ Bid
  },
  { timestamps: true } // ⏳ บันทึกเวลาการบิด
);

module.exports = mongoose.model("Bid", bidSchema);
