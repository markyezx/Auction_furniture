const mongoose = require("mongoose");

// สร้าง Collection ชื่อ auction
const auctionSchema = new mongoose.Schema(
  {
    businessId: { type: String, required: true }, // ID ของธุรกิจ
    auctionId: { type: String, unique: true, required: true }, // ID ของการประมูล
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "organization",
      required: true,
    },
    itemName: { type: String, required: true }, // ชื่อของสินค้าที่ประมูล
    itemImage: { type: String, required: true }, // รูปของสินค้าที่ประมูล
    description: { type: String, required: true }, // รายละเอียดของสินค้าที่ประมูล
    startingBid: { type: Number, required: true, min: 0 }, // ราคาเริ่มต้นประมูล
    currentBid: { type: Number, default: 0, min: 0 }, // ราคาสูงสุดที่ประมูลในขณะนี้
    bidIncrement: { type: Number, required: true, min: 1 }, // ขั้นต่ำที่เพิ่มในการประมูล
    endTime: { type: Date, required: true }, // เวลาสิ้นสุดของการประมูล
    participants: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true }, // ผู้เข้าร่วมประมูล
        bidAmount: { type: Number, required: true, min: 0 }, // จำนวนเงินที่เสนอ
        bidTime: { type: Date, default: Date.now }, // เวลาที่เสนอราคา
      },
    ], // รายชื่อผู้เข้าร่วมและการเสนอราคา
    winner: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "user" }, // ผู้ชนะการประมูล
      winningBid: { type: Number, min: 0 }, // ราคาที่ชนะการประมูล
    },
    createdAt: { type: Date, default: Date.now }, // เวลาที่สร้างการประมูล
  },
  { timestamps: true }
);

auctionSchema.pre("save", function (next) {
  // ตรวจสอบว่า endTime ต้องไม่อยู่ในอดีต
  if (this.endTime < Date.now()) {
    return next(new Error("เวลาที่สิ้นสุดของการประมูลต้องไม่อยู่ในอดีต"));
  }
  next();
});

// สำหรับอัปเดตราคาประมูล
auctionSchema.methods.updateBid = async function (userId, bidAmount) {
  if (bidAmount < this.currentBid + this.bidIncrement) {
    throw new Error("Bid amount must be higher than the current bid plus the bid increment.");
  }
  this.currentBid = bidAmount;
  this.participants.push({ userId, bidAmount });
  return this.save();
};

auctionSchema.index({ endTime: 1 });

// ฟังก์ชันดึงข้อมูลประมูลพร้อมข้อมูลผู้เข้าร่วม (Populate)
const getAuctionWithParticipants = async (auctionId) => {
  try {
    const auction = await mongoose.model("auction").findOne({ auctionId })
      .populate("participants.userId") // ทำการ populate ข้อมูลผู้ใช้ใน participants
      .exec();

    return auction;
  } catch (err) {
    console.log("Error fetching auction data:", err);
    throw err;
  }
};

// Export โมเดล
module.exports = mongoose.model("auction", auctionSchema);