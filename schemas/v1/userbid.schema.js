const mongoose = require("mongoose");

// สร้าง Schema สำหรับ User
const userSchema = new mongoose.Schema({
  name: { type: String, required: true }, // ชื่อของผู้ใช้
  email: { type: String, unique: true, required: true }, // อีเมล์ของผู้ใช้
  password: { type: String, required: true }, // รหัสผ่าน
  auctionHistory: [
    {
      auctionId: { type: mongoose.Schema.Types.ObjectId, ref: "auction" }, // การประมูลที่เข้าร่วม
      bidAmount: { type: Number }, // จำนวนเงินที่ผู้ใช้ได้ประมูล
      winStatus: { type: Boolean, default: false }, // ผู้ชนะหรือไม่
    },
  ], // ประวัติการประมูล
  createdAt: { type: Date, default: Date.now }, // เวลาที่สร้างบัญชี
});

// สร้างฟังก์ชันสำหรับอัปเดตประวัติการประมูลของผู้ใช้เมื่อชนะการประมูล
userSchema.methods.updateAuctionHistory = async function (auctionId, bidAmount, winStatus) {
  try {
    // เพิ่มประวัติการประมูลลงใน auctionHistory
    this.auctionHistory.push({
      auctionId: auctionId,
      bidAmount: bidAmount,
      winStatus: winStatus,
    });

    // บันทึกการเปลี่ยนแปลงในฐานข้อมูล
    await this.save();
  } catch (err) {
    console.log("Error updating auction history:", err);
  }
};

// Export โมเดล
module.exports = mongoose.model("user", userSchema);