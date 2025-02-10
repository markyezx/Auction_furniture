// controllers/auctionController.js
const Auction = require("../schemas/v1/auction.schema");
const Bid = require("../schemas/v1/bid.schema");
const sendWinnerEmail = require("../modules/email/emailService");
const { isValidObjectId } = require("mongoose");
const mongoose = require("mongoose");

exports.createAuction = async (req, res) => {
  try {
    const { name, startingPrice, minimumBidIncrement = 10, expiresAt, image } = req.body;

    if (!name || !startingPrice || !expiresAt) {
      return res.status(400).send({ status: "error", message: "Missing required fields" });
    }
    if (new Date(expiresAt) <= new Date()) {
      return res.status(400).send({ status: "error", message: "Invalid expiration date" });
    }

    const auction = new Auction({
      name,
      image: image || "https://example.com/default.jpg", // ✅ ตั้งค่า default image
      startingPrice,
      currentPrice: startingPrice,
      minimumBidIncrement,
      expiresAt: new Date(expiresAt),
      owner: req.user.userId,
    });

    await auction.save();
    res.status(201).send({ status: "success", data: auction });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
};


exports.getAuctionById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).send({ status: "error", message: "Invalid auction ID" });
    }
    const auction = await Auction.findById(id).populate("highestBidder", "name email")
      .populate({ path: "bids", select: "user amount createdAt", populate: { path: "user", select: "name" } });
    if (!auction) {
      return res.status(404).send({ status: "error", message: "Auction not found" });
    }
    res.status(200).send({ status: "success", data: auction });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
};

exports.getAuctions = async (req, res) => {
  try {
    const auctions = await Auction.find().populate("highestBidder", "name email");
    res.status(200).send({ status: "success", data: auctions });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
};

exports.getAuctionHistory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).send({ status: "error", message: "Invalid auction ID" });
    }

    const auction = await Auction.findById(id).select("history").populate("history.user", "name email");
    if (!auction) {
      return res.status(404).send({ status: "error", message: "Auction not found" });
    }

    res.status(200).send({ status: "success", data: auction.history });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
};

exports.placeBid = async (req, res) => {
  try {
    console.log("📌 คุกกี้ทั้งหมดที่ได้รับ:", req.cookies);

    const { amount } = req.body;
    const { id } = req.params;

    const auction = await Auction.findById(id);
    if (!auction) return res.status(404).send({ status: "error", message: "Auction not found" });

    if (amount < auction.currentPrice + auction.minimumBidIncrement) {
      return res.status(400).send({ status: "error", message: "Bid too low" });
    }

    // ✅ อ่าน email จากคุกกี้ และแก้ปัญหา %40
    const bidderEmail = req.cookies?.email ? decodeURIComponent(req.cookies.email) : null;
    console.log("📌 ค่าของ bidderEmail:", bidderEmail);

    if (!bidderEmail) {
      console.log("❌ ไม่มีคุกกี้ email");
      return res.status(400).send({ status: "error", message: "User email not found in cookies" });
    }

    const bid = new Bid({ auction: auction._id, user: req.user.userId, amount });

    auction.currentPrice = amount;
    auction.highestBidder = req.user.userId;
    auction.highestBidderEmail = bidderEmail; // ✅ บันทึกอีเมลจากคุกกี้
    auction.bids.push(bid._id);

    await auction.save();
    await bid.save();

    console.log("✅ อัปเดต highestBidderEmail สำเร็จ:", bidderEmail);

    res.status(201).send({ status: "success", data: { auction, bid } });
  } catch (err) {
    console.error("❌ Error placing bid:", err);
    res.status(500).send({ status: "error", message: err.message });
  }
};


exports.endAuctions = async () => {
  try {
    console.log("📌 กำลังปิดการประมูลที่หมดเวลา...");

    const now = new Date();
    console.log(`📌 เวลาปัจจุบันของเซิร์ฟเวอร์: ${now.toISOString()}`);

    // ✅ ลองดึงข้อมูลที่หมดอายุโดยไม่เช็ค status
    const expiredAuctions = await Auction.find({ expiresAt: { $lte: now } })
      .populate("highestBidder", "email");

    console.log(`📌 พบการประมูลที่หมดเวลาแล้ว: ${expiredAuctions.length} รายการ`);

    if (expiredAuctions.length === 0) {
      console.log("⚠️ ไม่มีการประมูลที่ต้องปิด");
      return;
    }

    for (const auction of expiredAuctions) {
      if (auction.status === "ended") {
        console.log(`⏭ การประมูล "${auction.name}" ถูกปิดไปแล้ว`);
        continue; // ข้ามถ้าเคยปิดไปแล้ว
      }

      auction.status = "ended";
      auction.finalPrice = auction.currentPrice;
      await auction.save();

      if (auction.highestBidder?.email) {
        console.log(`📢 กำลังส่งอีเมลแจ้งเตือนถึงผู้ชนะ: ${auction.highestBidder.email}`);
        await sendWinnerEmail(auction.highestBidder.email, auction.name, auction.finalPrice);
      } else {
        console.log("⚠️ ไม่พบอีเมลของผู้ชนะ");
      }
    }

    console.log(`✅ ปิดการประมูลสำเร็จ: ${expiredAuctions.length} รายการ`);
  } catch (err) {
    console.error("❌ Error ending auctions:", err);
  }
};

exports.getBidHistory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).send({ status: "error", message: "Invalid auction ID" });
    }

    const bids = await Bid.find({ auction: id }).populate("user", "name email").sort({ createdAt: -1 });
    if (!bids.length) {
      return res.status(404).send({ status: "error", message: "No bids found" });
    }

    res.status(200).send({ status: "success", data: bids });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
};

exports.forceEndAuctions = async () => {
  try {
    console.log("🚨 กำลังบังคับปิดการประมูลทั้งหมด...");

    // ✅ ใช้ `select("highestBidderEmail")` แทน `populate()`
    const activeAuctions = await Auction.find({ status: "active" }).select("name highestBidderEmail currentPrice");

    console.log(`📌 พบการประมูลที่ยังเปิดอยู่: ${activeAuctions.length} รายการ`);

    if (activeAuctions.length === 0) {
      console.log("⚠️ ไม่มีการประมูลที่ต้องปิดแบบบังคับ");
      return;
    }

    for (const auction of activeAuctions) {
      auction.status = "ended";
      auction.finalPrice = auction.currentPrice;
      await auction.save();

      if (auction.highestBidderEmail) {
        console.log(`📢 ส่งอีเมลแจ้งเตือนถึงผู้ชนะ: ${auction.highestBidderEmail}`);
        await sendWinnerEmail(auction.highestBidderEmail, auction.name, auction.finalPrice);
      } else {
        console.log(`⚠️ ไม่พบอีเมลของผู้ชนะสำหรับ: ${auction.name}`);
      }
    }

    console.log(`✅ บังคับปิดการประมูลสำเร็จ: ${activeAuctions.length} รายการ`);
  } catch (err) {
    console.error("❌ Error forcing end auctions:", err);
  }
};
