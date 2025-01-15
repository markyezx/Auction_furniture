const mongoose = require("mongoose");

// สร้าง Schema สำหรับการประมูล
const auctionSchema = new mongoose.Schema(
  {
    businessId: { type: String, required: true },
    auctionId: { type: String, unique: true, required: true },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "organization",
      required: true,
    },
    itemName: { type: String, required: true },
    itemImage: { type: String, required: true },
    description: { type: String, required: true },
    startingBid: { type: Number, required: true, min: 0 },
    currentBid: { type: Number, default: 0, min: 0 },
    bidIncrement: { type: Number, required: true, min: 1 },
    endTime: { type: Date, required: true },
    participants: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
        bidAmount: { type: Number, required: true, min: 0 },
        bidTime: { type: Date, default: Date.now },
      },
    ],
    winner: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
      winningBid: { type: Number, min: 0 },
    },
    notifications: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
        message: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ["open", "closed", "cancelled"],
      default: "open",
    },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// ตรวจสอบเวลาสิ้นสุดของการประมูล
auctionSchema.pre("save", function (next) {
  if (this.endTime < Date.now()) {
    return next(new Error("เวลาที่สิ้นสุดของการประมูลต้องไม่อยู่ในอดีต"));
  }
  next();
});

// ฟังก์ชันปิดประมูล
auctionSchema.methods.closeAuction = async function () {
  if (this.status !== "open") {
    throw new Error("Auction is already closed or cancelled.");
  }

  const winner = this.participants.reduce((max, p) =>
    p.bidAmount > (max?.bidAmount || 0) ? p : max
  , null);

  if (winner) {
    this.winner = {
      userId: winner.userId,
      winningBid: winner.bidAmount,
    };
    this.notifications.push({
      userId: winner.userId,
      message: `Congratulations! You won the auction for "${this.itemName}" with a bid of ${winner.bidAmount}.`,
    });
  }

  this.participants.forEach((participant) => {
    if (!winner || !participant.userId.equals(winner.userId)) {
      this.notifications.push({
        userId: participant.userId,
        message: `The auction for "${this.itemName}" has ended. Thank you for your participation!`,
      });
    }
  });

  this.status = "closed";
  return this.save();
};

// อัปเดตราคาประมูล
auctionSchema.methods.updateBid = async function (userId, bidAmount) {
  if (this.status !== "open" || this.endTime < Date.now()) {
    throw new Error("Auction is closed or has expired.");
  }

  const lastBid = this.participants.find(
    (p) => p.userId.equals(userId)
  );

  // ป้องกันไม่ให้ผู้ใช้บิดซ้ำภายใน 1 นาที
  if (lastBid && Date.now() - new Date(lastBid.bidTime) < 60 * 1000) {
    throw new Error("You must wait 1 minute before placing another bid.");
  }

  if (bidAmount < this.currentBid + this.bidIncrement) {
    throw new Error("Bid amount must be higher than the current bid plus the bid increment.");
  }

  // อัปเดตราคาปัจจุบันและเวลาสิ้นสุด
  this.currentBid = bidAmount;
  this.endTime = new Date(Date.now() + 5 * 60 * 1000); // ขยายเวลา 5 นาที
  this.participants.push({ userId, bidAmount, bidTime: new Date() });

  return this.save();
};

// Export โมเดล
module.exports = mongoose.model("auction", auctionSchema);