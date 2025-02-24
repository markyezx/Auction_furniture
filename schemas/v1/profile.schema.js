const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String },
  address: { type: String },
  profileImage: { type: String, default: "/images/default-profile.jpg" }, // ✅ เพิ่มเก็บรูป
  loginHistory: [
    {
      ipAddress: { type: String },
      userAgent: { type: String },
      timestamp: { type: Date, default: Date.now }
    }
  ] // 📌 เพิ่มประวัติการ Login
}, { timestamps: true });

module.exports = mongoose.model("Profile", profileSchema);
