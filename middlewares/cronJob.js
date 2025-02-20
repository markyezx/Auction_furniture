const cron = require("node-cron");
const { endAuctions } = require("./controllers/auctionController");

cron.schedule("* * * * *", async () => {
  console.log("Checking expired auctions...");
  await endAuctions();
});

const checkPaymentStatus = async () => {
  console.log("🔄 กำลังตรวจสอบการชำระเงินของผู้ชนะ...");

  try {
    const overdueAuctions = await Auction.find({
      paymentDeadline: { $lte: new Date() },
      status: "ended",
      finalPrice: { $ne: null },
    }).populate("bids");

    for (const auction of overdueAuctions) {
      const allBids = await Bid.find({ auction: auction._id }).sort({ amount: -1 });

      if (allBids.length > 1) {
        const nextBidder = allBids[1]; // 📌 ผู้บิดอันดับถัดไป
        const nextBidderEmail = await User.findById(nextBidder.user).select("email");

        if (nextBidderEmail) {
          console.log(`📢 ส่งอีเมลไปยังผู้บิดคนถัดไป: ${nextBidderEmail.email}`);
          await sendNextWinnerEmail(nextBidderEmail.email, auction.name, nextBidder.amount);

          auction.highestBidder = nextBidder.user;
          auction.highestBidderEmail = nextBidderEmail.email;
          auction.finalPrice = nextBidder.amount;
          auction.paymentDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // ✅ ให้เวลา 24 ชม.
          await auction.save();
        }
      } else {
        console.log(`⚠️ ไม่มีผู้บิดคนถัดไปสำหรับ ${auction.name}`);
      }
    }
  } catch (error) {
    console.error("❌ Error checking payments:", error);
  }
};

// ✅ ตรวจสอบทุก 1 ชั่วโมง
setInterval(checkPaymentStatus, 60 * 60 * 1000);
