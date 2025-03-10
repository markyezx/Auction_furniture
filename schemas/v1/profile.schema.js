const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String },
  address: { type: String },
  profileImage: {
    data: Buffer, 
    contentType: String
  },
  loginHistory: [
    {
      ipAddress: { type: String },
      userAgent: { type: String },
      timestamp: { type: Date, default: Date.now }
    }
  ],
  winningBids: [
    {
      auction: { type: mongoose.Schema.Types.ObjectId, ref: "Auction" }, // ✅ เชื่อม Auction
      finalPrice: { type: Number }, 
      wonAt: { type: Date, default: Date.now } // ✅ บันทึกเวลาชนะ
    }
  ]
}, { timestamps: true });

// ✅ ใช้ Virtual Field เพื่อดึง `email` และ `phone` จาก `User`
profileSchema.virtual("email").get(function() {
  return this.user ? this.user.email : "ไม่มีอีเมล";
});


profileSchema.set("toObject", { virtuals: true });
profileSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Profile", profileSchema);
