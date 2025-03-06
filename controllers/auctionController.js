// controllers/auctionController.js
const Auction = require("../schemas/v1/auction.schema");
const Bid = require("../schemas/v1/bid.schema");
const User = require("../schemas/v1/user.schema"); // ✅ เปลี่ยน path ตามที่ถูกต้อง
const Profile = require("../schemas/v1/profile.schema");
const Notification = require("../schemas/v1/notification.schema");
const sendWinnerEmail = require("../modules/email/emailService");
const sendNextWinnerEmail = require("../modules/email/emailService");
const { isValidObjectId } = require("mongoose");
const mongoose = require("mongoose");

exports.createAuction = async (req, res) => {
  try {
    const { name, description, startingPrice, minimumBidIncrement = 10, image, category } = req.body;

    // ตรวจสอบค่าที่จำเป็น
    if (!name || !startingPrice || !category) {
      return res.status(400).send({ status: "error", message: "Missing required fields" });
    }

    // ตรวจสอบหมวดหมู่ที่ถูกต้อง
    const validCategories = [
      "designer_toys", "vinyl_figures", "resin_figures", "blind_box",
      "anime_figures", "movie_game_collectibles", "robot_mecha",
      "soft_vinyl", "kaiju_monsters", "diy_custom", "retro_vintage",
      "limited_edition", "gunpla_models", "plastic_models"
    ];

    if (!validCategories.includes(category)) {
      return res.status(400).send({ status: "error", message: "Invalid category" });
    }

    // ตรวจสอบว่ามี userId หรือไม่
    if (!req.user || !req.user.userId) {
      return res.status(401).send({ status: "error", message: "Unauthorized" });
    }

    // กำหนดเวลาหมดอายุอัตโนมัติ
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5); 

    const auction = new Auction({
      name,
      description: description || "",  // แก้ไขให้มีค่าเริ่มต้น
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
    console.error(err);
    res.status(500).send({ status: "error", message: "Internal Server Error" });
  }
};

// exports.createAuction = async (req, res) => {
//   try {

//     console.log("📌 Request Body:", req.body);
//     console.log("📌 Uploaded Files:", req.files);

//     const { name, description, startingPrice, minimumBidIncrement = 10, category } = req.body;

//     if (!name || !description || !startingPrice || !category) {
//       return res.status(400).send({ status: "error", message: "Missing required fields" });
//     }

//     const validCategories = [
//       "designer_toys", "vinyl_figures", "resin_figures", "blind_box",
//       "anime_figures", "movie_game_collectibles", "robot_mecha",
//       "soft_vinyl", "kaiju_monsters", "diy_custom", "retro_vintage",
//       "limited_edition", "gunpla_models", "plastic_models"
//     ];

//     if (!validCategories.includes(category)) {
//       return res.status(400).send({ status: "error", message: "Invalid category" });
//     }

//     if (!req.files || req.files.length === 0) {
//       return res.status(400).send({ status: "error", message: "ต้องอัปโหลดภาพสินค้าอย่างน้อย 1 ภาพ" });
//     }

//     if (req.files.length > 5) {
//       return res.status(400).send({ status: "error", message: "สามารถอัปโหลดภาพสินค้าได้ไม่เกิน 5 รูป" });
//     }

//     const images = req.files.map((file) => ({
//       data: file.buffer.toString("base64"),
//       contentType: file.mimetype,
//     }));

//     const expiresAt = new Date();
//     expiresAt.setMinutes(expiresAt.getMinutes() + 5);

//     const auction = new Auction({
//       name,
//       description,
//       image: images || "https://example.com/default.jpg", // ✅ ตั้งค่า default image,
//       startingPrice,
//       currentPrice: startingPrice,
//       minimumBidIncrement,
//       expiresAt,
//       owner: req.user.userId,
//       category,
//     });

//     await auction.save();
//     res.status(201).send({ status: "success", data: auction });
//   } catch (err) {
//     console.error("❌ Error creating auction:", err);
//     res.status(500).send({ status: "error", message: err.message });
//   }
// };

exports.checkAndEndAuctions = async () => {
  try {
    console.log("📌 กำลังตรวจสอบการประมูลที่หมดเวลา...");

    const now = new Date();
    const expiredAuctions = await Auction.find({ expiresAt: { $lte: now }, status: "active" })
      .populate("highestBidder", "email name")
      .populate("owner", "email name");

    if (expiredAuctions.length === 0) {
      console.log("⚠️ ไม่มีการประมูลที่ต้องปิด");
      return;
    }

    for (const auction of expiredAuctions) {
      console.log(`🚨 ปิดการประมูล: ${auction.name}`);

      auction.status = "ended";
      auction.finalPrice = auction.currentPrice;

      let winnerEmail = auction.highestBidder?.email || auction.highestBidderEmail;
      let winnerName = auction.highestBidder?.name || "ไม่มีผู้ชนะ";

      // ✅ ถ้า `highestBidderEmail` ไม่มี ให้ดึงจากฐานข้อมูล
      if (!winnerEmail && auction.highestBidder) {
        console.log("🔍 ไม่พบอีเมลของผู้ชนะ กำลังดึงข้อมูลใหม่...");
        const winner = await User.findById(auction.highestBidder);
        winnerEmail = winner?.email || null;

        if (winnerEmail) {
          auction.highestBidderEmail = winnerEmail; // ✅ อัปเดตฐานข้อมูล
          console.log(`✅ พบอีเมลของผู้ชนะจากฐานข้อมูล: ${winnerEmail}`);
        } else {
          console.log(`⚠️ ไม่พบอีเมลของผู้ชนะในฐานข้อมูล`);
        }
      }

      // ✅ ส่งอีเมลแจ้งผู้ชนะ (ถ้ามี)
      if (winnerEmail) {
        console.log(`📢 ส่งอีเมลแจ้งเตือนถึงผู้ชนะ: ${winnerEmail}`);
        try {
          await sendWinnerEmail(winnerEmail, auction.name, auction.finalPrice);
          console.log(`✅ ส่งอีเมลสำเร็จถึง: ${winnerEmail}`);
        } catch (emailError) {
          console.error(`❌ ส่งอีเมลล้มเหลว: ${emailError.message}`);
        }
      }

      await auction.save();
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
    const userId = req.user?.userId;

    const auction = await Auction.findById(id);
    if (!auction) return res.status(404).send({ status: "error", message: "Auction not found" });

    if (amount < auction.currentPrice + auction.minimumBidIncrement) {
      return res.status(400).send({ status: "error", message: "Bid too low" });
    }

    // ✅ อ่าน email จากคุกกี้ และแก้ปัญหา %40
    // ✅ ดึง Email จาก Token แทนที่จะใช้จากคุกกี้อย่างเดียว
    const token = req.cookies?.accessToken || req.headers.authorization?.split(" ")[1];
    console.log("📌 Token ที่ใช้:", token);

    if (!token) {
      return res.status(401).send({ status: "error", message: "Unauthorized: No token found" });
    }

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

     // ✅ สร้างแจ้งเตือนการบิดสำเร็จ
     await Notification.create({
      user: userId,
      message: `🎯 คุณได้ทำการบิดประมูล "${auction.name}" สำเร็จแล้ว!`,
      type: "bid_success"
    });

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
    if (!isValidObjectId(id)) {
      return res.status(400).send({ status: "error", message: "Invalid auction ID" });
    }

    console.log(`🚨 กำลังบังคับปิดการประมูล ID: ${id}`);

    const auction = await Auction.findById(id).select("name highestBidderEmail currentPrice status");

    if (!auction) {
      return res.status(404).send({ status: "error", message: "Auction not found" });
    }

    if (auction.status === "ended") {
      return res.status(400).send({ status: "error", message: "Auction already ended" });
    }

    auction.status = "ended";
    auction.finalPrice = auction.currentPrice;
    await auction.save();

    if (auction.highestBidderEmail) {
      console.log(`📢 ส่งอีเมลแจ้งเตือนถึงผู้ชนะ: ${auction.highestBidderEmail}`);
      await sendWinnerEmail(auction.highestBidderEmail, auction.name, auction.finalPrice);
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

const getUserIdFromRequest = (req) => {
  try {
    if (req.user && req.user.userId) {
      return req.user.userId;
    }
    if (req.cookies && req.cookies.accesstoken) {
      const decoded = jwt.verify(req.cookies.accesstoken, process.env.JWT_SECRET);
      return decoded.userId;
    }
    return null;
  } catch (err) {
    console.error("❌ Error decoding access token:", err);
    return null;
  }
};

exports.getMyAuctionHistory = async (req, res) => {
  try {
    const userId = req.user?.userId; // ดึง userId โดยตรงจาก req.user
    if (!userId) {
      return res.status(401).send({ status: "error", message: "Unauthorized or invalid token" });
    }

    // ✅ ดึงประวัติการประมูลของตัวเอง + รูป
    const myAuctions = await Auction.find({ owner: userId })
      .select("name startingPrice currentPrice image createdAt expiresAt status")
      .sort({ createdAt: -1 });

    res.status(200).send({ status: "success", data: myAuctions });
  } catch (err) {
    console.error("❌ Error fetching auction history:", err);
    res.status(500).send({ status: "error", message: err.message });
  }
};

exports.getMyBidHistory = async (req, res) => {
  try {
    console.log("📌 Checking My Bid History...");

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).send({ status: "error", message: "Unauthorized or invalid token" });
    }

    // ✅ ดึงประวัติการบิด และรวมถึงรูปของการประมูลที่บิดไป
    const myBids = await Bid.find({ user: userId })
      .populate("auction", "name currentPrice image")
      .sort({ createdAt: -1 });

    console.log("✅ Found Bids:", myBids.length);
    res.status(200).send({ status: "success", data: myBids });
  } catch (err) {
    console.error("❌ Error fetching bid history:", err);
    res.status(500).send({ status: "error", message: err.message });
  }
};

exports.getAuctionHistory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).send({ status: "error", message: "Invalid auction ID" });
    }

    const auction = await Auction.findById(id)
      .select("history image")  // ✅ เพิ่มให้ดึงรูปของประมูลด้วย
      .populate("history.user", "name email");

    if (!auction) {
      return res.status(404).send({ status: "error", message: "Auction not found" });
    }

    res.status(200).send({ status: "success", data: auction.history, image: auction.image });
  } catch (err) {
    console.error("❌ Error fetching auction history:", err);
    res.status(500).send({ status: "error", message: err.message });
  }
};

exports.getMyWinningBids = async (req, res) => {
  try {
    const userId = req.user.userId;

    // 🔍 ค้นหาการประมูลที่ชนะ (highest bid และประมูลจบแล้ว)
    const winningBids = await Bid.find({ user: userId })
      .populate({
        path: "auction",
        match: { status: "ended" }, // ✅ ตรวจสอบว่า Auction สิ้นสุดแล้ว
        select: "name image expiresAt currentPrice"
      })
      .sort({ createdAt: -1 });

    // ✅ กรองเฉพาะที่ชนะ (Auction ที่ `currentPrice === bid.amount`)
    const filteredWinningBids = winningBids.filter(bid => 
      bid.auction && bid.amount === bid.auction.currentPrice
    );

    // 🔹 อัปเดตลง Profile
    const profile = await Profile.findOneAndUpdate(
      { user: userId },
      { $set: { winningBids: filteredWinningBids.map(bid => ({
          auction: bid.auction._id,
          finalPrice: bid.amount,
          wonAt: bid.auction.expiresAt
        })) 
      }},
      { new: true, upsert: true }
    );

    res.status(200).json({ status: "success", data: filteredWinningBids });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getAllAuctions = async (req, res) => {
  try {
    // 🔍 ดึงข้อมูลการประมูลทั้งหมด
    const auctions = await Auction.find({})
      .populate("owner", "name") // แสดงชื่อเจ้าของ
      .populate("winner", "name email") // แสดงชื่อผู้ชนะ
      .sort({ expiresAt: -1 }); // เรียงลำดับจากใหม่ไปเก่า

    // 🔥 เช็คว่ามีการประมูลที่กำลังเปิดอยู่หรือไม่
    const updatedAuctions = await Promise.all(
      auctions.map(async (auction) => {
        let highestBidder = null;
        let highestBid = auction.currentPrice;

        // ถ้ายังเปิดอยู่ หา "ผู้บิดสูงสุด"
        if (auction.status === "active") {
          const highestBidEntry = await Bid.findOne({ auction: auction._id })
            .sort({ amount: -1 }) // เรียงจากมากไปน้อย
            .populate("user", "name email"); // ดึงชื่อผู้บิดสูงสุด

          if (highestBidEntry) {
            highestBidder = highestBidEntry.user;
            highestBid = highestBidEntry.amount;
          }
        }

        return {
          _id: auction._id,
          name: auction.name,
          image: auction.image || "/default-image.jpg",
          currentPrice: highestBid,
          status: auction.status,
          expiresAt: auction.expiresAt,
          winner: auction.status === "ended" ? auction.winner : null,
          winningBid: auction.status === "ended" ? auction.currentPrice : null,
          highestBidder: auction.status === "active" ? highestBidder : null,
        };
      })
    );

    res.status(200).json({ status: "success", data: updatedAuctions });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ✅ ดึงรายการแจ้งเตือนทั้งหมดของผู้ใช้
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(400).json({ status: "error", message: "Unauthorized: User ID not found" });

    const notifications = await Notification.find({ user: userId }).sort({ timestamp: -1 });

    res.status(200).json({ status: "success", data: notifications });
  } catch (err) {
    console.error("❌ Error fetching notifications:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ✅ ตั้งค่าแจ้งเตือนทั้งหมดเป็น "อ่านแล้ว"
exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ status: "error", message: "Unauthorized" });

    await Notification.updateMany({ user: userId, read: false }, { $set: { read: true } });

    res.status(200).json({ status: "success", message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.handleAuctionNotifications = async () => {
  try {
    console.log("🔔 กำลังตรวจสอบแจ้งเตือนการประมูล...");

    const now = new Date();
    const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);

    // 🔍 หา Auction ที่เหลือ 5 นาที
    const soonToEndAuctions = await Auction.find({
      expiresAt: { $gte: now, $lte: fiveMinutesLater },
      status: "active"
    }).populate("highestBidder", "name");

    for (const auction of soonToEndAuctions) {
      if (auction.highestBidder) {
        // ✅ เช็คว่าแจ้งเตือนนี้เคยถูกสร้างไปแล้วหรือไม่
        const existingNotification = await Notification.findOne({
          user: auction.highestBidder._id,
          message: `🔥 การประมูล "${auction.name}" กำลังจะจบใน 5 นาที!`,
          type: "time_warning"
        });

        if (!existingNotification) {
          console.log(`⏳ แจ้งเตือน: การประมูล "${auction.name}" เหลือ 5 นาที!`);

          await Notification.create({
            user: auction.highestBidder._id,
            message: `🔥 การประมูล "${auction.name}" กำลังจะจบใน 5 นาที!`,
            type: "time_warning"
          });
        }
      }
    }

    // 🔍 หา Auction ที่จบแล้ว
    const expiredAuctions = await Auction.find({ expiresAt: { $lte: now }, status: "ended" })
      .populate("highestBidder", "name");

    for (const auction of expiredAuctions) {
      if (auction.highestBidder) {
        // ✅ เช็คว่าแจ้งเตือนนี้เคยถูกสร้างไปแล้วหรือไม่
        const existingNotification = await Notification.findOne({
          user: auction.highestBidder._id,
          message: `🎉 คุณชนะการประมูล "${auction.name}"`,
          type: "auction_end"
        });

        if (!existingNotification) {
          console.log(`🎉 แจ้งเตือน: การประมูล "${auction.name}" จบลงแล้ว!`);

          await Notification.create({
            user: auction.highestBidder._id,
            message: `🎉 คุณชนะการประมูล "${auction.name}"`,
            type: "auction_end"
          });
        }
      }
    }

    console.log("✅ ตรวจสอบแจ้งเตือนเสร็จสิ้น!");
  } catch (err) {
    console.error("❌ Error in handleAuctionNotifications:", err);
  }
};
