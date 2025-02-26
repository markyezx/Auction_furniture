const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String },
  address: { type: String },
  profileImage: {
    data: Buffer,  // 🔹 เก็บไฟล์ภาพเป็น Binary (Base64)
    contentType: String // 🔹 เก็บประเภทของไฟล์ (image/png, image/jpeg)
  },
  loginHistory: [
    {
      ipAddress: { type: String },
      userAgent: { type: String },
      timestamp: { type: Date, default: Date.now }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model("Profile", profileSchema);
