const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema(
  {
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
        device: { type: String },   // ✅ เพิ่มข้อมูลอุปกรณ์
        os: { type: String },       // ✅ เพิ่มระบบปฏิบัติการ
        browser: { type: String },  // ✅ เพิ่มเบราว์เซอร์
        location: { type: String }, // ✅ เพิ่มตำแหน่งที่ตั้ง
        timestamp: { type: Date, default: Date.now }
      }
    ],
    winningBids: [
      {
        auction: { type: mongoose.Schema.Types.ObjectId, ref: "Auction" },
        finalPrice: { type: Number }, 
        wonAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

// ✅ จำกัดให้เก็บแค่ 10 รายการล่าสุด (middleware)
profileSchema.pre("save", function (next) {
  if (this.loginHistory.length > 10) {
    this.loginHistory = this.loginHistory.slice(0, 10);
  }
  next();
});

// ✅ ใช้ Virtual Field เพื่อดึง `email` และ `phone` จาก `User`
profileSchema.virtual("email").get(function () {
  return this.user ? this.user.email : "ไม่มีอีเมล";
});

profileSchema.set("toObject", { virtuals: true });
profileSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Profile", profileSchema);
