// controllers/auctionController.js
const Auction = require("../schemas/v1/auction.schema");
const Bid = require("../schemas/v1/bid.schema");
const User = require("../schemas/v1/user.schema"); // ✅ เปลี่ยน path ตามที่ถูกต้อง
const sendWinnerEmail = require("../modules/email/emailService");
const sendNextWinnerEmail = require("../modules/email/emailService");
const { isValidObjectId } = require("mongoose");
const mongoose = require("mongoose");

exports.createAuction = async (req, res) => {
  try {
    const { name, startingPrice, minimumBidIncrement = 10, image, category } = req.body;

    if (!name || !startingPrice || !category) {
      return res.status(400).send({ status: "error", message: "Missing required fields" });
    }

    const validCategories = [
      "designer_toys", "vinyl_figures", "resin_figures", "blind_box",
      "anime_figures", "movie_game_collectibles", "robot_mecha",
      "soft_vinyl", "kaiju_monsters", "diy_custom", "retro_vintage",
      "limited_edition", "gunpla_models", "plastic_models"
    ];

    if (!validCategories.includes(category)) {
      return res.status(400).send({ status: "error", message: "Invalid category" });
    }

    // ตั้งเวลาหมดอายุอัตโนมัติ
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5); 

    const auction = new Auction({
      name,
      image: image || "https://example.com/default.jpg",
      startingPrice,
      currentPrice: startingPrice,
      minimumBidIncrement,
      expiresAt,
      owner: req.user.userId,
      category,
    });

    await auction.save();
    res.status(201).send({ status: "success", data: auction });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
};

exports.checkAndEndAuctions = async () => {
  try {
    console.log("📌 กำลังตรวจสอบการประมูลที่หมดเวลา...");

    const now = new Date();
    const expiredAuctions = await Auction.find({ expiresAt: { $lte: now }, status: "active" })
      .populate("highestBidder", "email name");

    if (expiredAuctions.length === 0) {
      console.log("⚠️ ไม่มีการประมูลที่ต้องปิด");
      return;
    }

    for (const auction of expiredAuctions) {
      console.log(`🚨 ปิดการประมูล: ${auction.name}`);

      auction.status = "ended";
      auction.finalPrice = auction.currentPrice;
      await auction.save();

      // ✅ ตรวจสอบว่ามีผู้ชนะหรือไม่
      const winnerEmail = auction.highestBidder?.email || auction.highestBidderEmail;
      
      if (winnerEmail) {
        console.log(`📢 ส่งอีเมลแจ้งเตือนถึงผู้ชนะ: ${winnerEmail}`);
        await sendWinnerEmail(winnerEmail, auction.name, auction.finalPrice);
      } else {
        console.log(`⚠️ ไม่พบอีเมลของผู้ชนะสำหรับ: ${auction.name}`);
      }
    }

    console.log(`✅ ปิดการประมูลสำเร็จ ${expiredAuctions.length} รายการ`);
  } catch (err) {
    console.error("❌ Error checking and ending auctions:", err);
  }
};

// ✅ GET: ดึงรายละเอียดของประมูล
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

// ✅ GET: ดึงรายการประมูลทั้งหมด
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

    // ✅ ดึงข้อมูลผู้ใช้จาก `user.name`
    const bidder = await User.findById(req.user.userId).select("user.name email");
    if (!bidder) {
      return res.status(400).send({ status: "error", message: "User not found" });
    }

    // ✅ บันทึกข้อมูลการบิดใหม่ พร้อมชื่อผู้ใช้
    const bid = new Bid({
      auction: auction._id,
      user: req.user.userId,
      amount,
      userName: bidder.user.name, // ✅ ดึง `user.name` แทน `name`
    });

    auction.currentPrice = amount;
    auction.highestBidder = req.user.userId;
    auction.highestBidderEmail = bidder.email;
    auction.bids.push(bid._id);

    await auction.save();
    await bid.save();

    console.log(`✅ บันทึกประวัติการบิดสำเร็จ โดย: ${bidder.user.name}`);

    res.status(201).send({ status: "success", data: { auction, bid, bidderName: bidder.user.name } });
  } catch (err) {
    console.error("❌ Error placing bid:", err);
    res.status(500).send({ status: "error", message: err.message });
  }
};

exports.endAuctions = async () => {
  try {
    console.log("📌 กำลังปิดการประมูลที่หมดเวลา...");

    const now = new Date();
    const expiredAuctions = await Auction.find({ expiresAt: { $lte: now }, status: "active" })
      .populate("highestBidder", "email");

    if (expiredAuctions.length === 0) {
      console.log("⚠️ ไม่มีการประมูลที่ต้องปิด");
      return;
    }

    for (const auction of expiredAuctions) {
      auction.status = "ended";
      auction.finalPrice = auction.currentPrice;
      auction.paymentDeadline = new Date(Date.now() + 5 * 60 * 1000);

      await auction.save();

      if (auction.highestBidder?.email) {
        console.log(`📢 ส่งอีเมลแจ้งผู้ชนะ: ${auction.highestBidder.email}`);
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

    // ✅ ดึงประวัติการบิดทั้งหมดของการประมูล พร้อม `user.name`
    const bids = await Bid.find({ auction: id })
      .populate("user", "user.name email") // ✅ ดึง `user.name` แทน `name`
      .sort({ createdAt: -1 });

    if (!bids.length) {
      return res.status(404).send({ status: "error", message: "No bids found" });
    }

    res.status(200).send({ status: "success", data: bids });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
};


exports.getHighestBidder = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).send({ status: "error", message: "Invalid auction ID" });
    }

    const auction = await Auction.findById(id).populate("highestBidder", "name email");
    if (!auction) {
      return res.status(404).send({ status: "error", message: "Auction not found" });
    }

    if (!auction.highestBidder) {
      return res.status(404).send({ status: "error", message: "No bids placed yet" });
    }

    res.status(200).send({
      status: "success",
      data: {
        highestBidder: auction.highestBidder,
        currentPrice: auction.currentPrice,
      },
    });
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

exports.forceEndAuctionById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🚨 กำลังบังคับปิดการประมูล ID: ${id}`);

    // ✅ ดึงข้อมูลการประมูล พร้อม populate ผู้ชนะ
    const auction = await Auction.findById(id).populate("highestBidder", "email");

    if (!auction) {
      return res.status(404).send({ status: "error", message: "Auction not found" });
    }

    if (auction.status === "ended") {
      return res.status(400).send({ status: "error", message: "Auction already ended" });
    }

    auction.status = "ended";
    auction.finalPrice = auction.currentPrice;
    await auction.save();

    // ✅ ตรวจสอบว่า highestBidder มี email หรือไม่
    const winnerEmail = auction.highestBidder?.email || auction.highestBidderEmail;
    
    if (winnerEmail) {
      console.log(`📢 ส่งอีเมลแจ้งเตือนถึงผู้ชนะ: ${winnerEmail}`);
      await sendWinnerEmail(winnerEmail, auction.name, auction.finalPrice);
    } else {
      console.log(`⚠️ ไม่พบอีเมลของผู้ชนะสำหรับ: ${auction.name}`);
    }

    res.status(200).send({ status: "success", message: `Auction ID ${id} forcibly ended` });
  } catch (err) {
    console.error("❌ Error forcing end auction:", err);
    res.status(500).send({ status: "error", message: err.message });
  }
};

exports.forceExpirePayment = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🚨 กำลังบังคับให้หมดเวลาชำระเงินสำหรับการประมูล ID: ${id}`);

    const auction = await Auction.findById(id).populate("bids").populate("highestBidder", "email");
    if (!auction) return res.status(404).send({ status: "error", message: "Auction not found" });

    if (auction.status !== "ended") {
      return res.status(400).send({ status: "error", message: "Auction is still active" });
    }

    if (!auction.paymentDeadline) {
      console.log("⚠️ ไม่พบ paymentDeadline → กำหนดค่าใหม่เป็นเวลาปัจจุบัน");
      auction.paymentDeadline = new Date();
      await auction.save();
    }

    const allBids = await Bid.find({ auction: auction._id }).sort({ amount: -1 });
    console.log("🔍 รายการบิดทั้งหมด:", allBids);

    if (allBids.length > 1) {
      const nextBidder = allBids[1]; // 📌 ผู้บิดอันดับถัดไป
      console.log("🔍 ผู้บิดอันดับถัดไป:", nextBidder);

      if (!nextBidder?.user) {
        console.log("⚠️ nextBidder.user เป็น undefined หรือ null");
        return res.status(400).send({ status: "error", message: "Next bidder data is missing" });
      }

      const nextBidderUser = await User.findById(nextBidder.user);
      console.log("🔍 ข้อมูลผู้บิดอันดับถัดไปใน User collection:", nextBidderUser);

      // ✅ ตรวจสอบว่าโครงสร้างข้อมูลของ nextBidderUser ถูกต้อง
      console.log("📧 ตรวจสอบค่า nextBidderUser:", JSON.stringify(nextBidderUser, null, 2));

      // ✅ ดึงอีเมลจากโครงสร้างข้อมูลที่ถูกต้อง
      const nextBidderEmail = nextBidderUser?.email || nextBidderUser?.user?.email || null;
      console.log("📧 อีเมลของผู้บิดคนถัดไป:", nextBidderEmail);

      if (!nextBidderEmail) {
        console.log("⚠️ ไม่พบอีเมลของผู้บิดอันดับถัดไป");
        return res.status(400).send({ status: "error", message: "Next bidder has no email" });
      }

      console.log(`📢 ส่งอีเมลไปยังผู้บิดคนถัดไป: ${nextBidderEmail}`);
      await sendNextWinnerEmail(nextBidderEmail, auction.name, nextBidder.amount);

      auction.highestBidder = nextBidder.user;
      auction.highestBidderEmail = nextBidderEmail;
      auction.finalPrice = nextBidder.amount;
      auction.paymentDeadline = new Date(Date.now() + 5 * 60 * 1000); // ✅ ให้เวลา 24 ชม.
      await auction.save();
    } else {
      console.log(`⚠️ ไม่มีผู้บิดคนถัดไปสำหรับ ${auction.name}`);
      return res.status(400).send({ status: "error", message: "No next bidder available" });
    }

    res.status(200).send({ status: "success", message: "Payment time expired and next bidder assigned" });
  } catch (err) {
    console.error("❌ Error forcing payment expiration:", err);
    res.status(500).send({ status: "error", message: err.message });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categories = [
      { key: "designer_toys", name: "Designer Toys" },
      { key: "vinyl_figures", name: "Vinyl Figures" },
      { key: "resin_figures", name: "Resin Figures" },
      { key: "blind_box", name: "Blind Box Toys" },
      { key: "anime_figures", name: "Anime Figures" },
      { key: "movie_game_collectibles", name: "Movie & Game Collectibles" },
      { key: "robot_mecha", name: "Robot & Mecha Toys" },
      { key: "soft_vinyl", name: "Soft Vinyl (Sofubi)" },
      { key: "kaiju_monsters", name: "Kaiju & Monsters" },
      { key: "diy_custom", name: "DIY & Custom Toys" },
      { key: "retro_vintage", name: "Retro & Vintage Toys" },
      { key: "limited_edition", name: "Limited Edition & Exclusive" },
      { key: "gunpla_models", name: "Gunpla & Mecha Models" }, // ✅ เพิ่มกันพลา
      { key: "plastic_models", name: "Plastic Model Kits" } // ✅ เพิ่มโมเดลพลาสติก
    ];
    res.status(200).send({ status: "success", data: categories });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
};


