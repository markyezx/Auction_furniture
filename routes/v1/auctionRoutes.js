const express = require("express");
const router = express.Router();
const Auction = require("../../schemas/v1/auction.schema");
const mongoose = require("mongoose");

// Create Auction
router.post("/", async (req, res) => {
  try {
    const {
      businessId,
      auctionId,
      organizationId,
      itemName,
      itemImage,
      description,
      startingBid,
      bidIncrement,
    } = req.body;

    if (!businessId || !auctionId || !organizationId || !itemName || !itemImage || !description) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (startingBid <= 0 || bidIncrement <= 0) {
      return res.status(400).json({ message: "Starting bid and bid increment must be greater than 0" });
    }

    const endTime = new Date(Date.now() + 10 * 60 * 1000);

    const newAuction = new Auction({
      businessId,
      auctionId,
      organizationId,
      itemName,
      itemImage,
      description,
      startingBid,
      currentBid: startingBid,
      bidIncrement,
      endTime,
      status: "open",
    });

    await newAuction.save();
    res.status(201).json(newAuction);
  } catch (error) {
    console.error("Error creating auction:", error.message);
    res.status(500).json({ message: "Internal server error", error: error.message || error });
  }
});

// Place a bid
router.post("/:auctionId/bid", async (req, res) => {
  try {
    const { auctionId } = req.params;
    const { userId, bidAmount } = req.body;

    if (!userId || !bidAmount) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const auction = await Auction.findOne({ auctionId });
    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    if (auction.status !== "open") {
      return res.status(400).json({ message: "Auction is not open for bidding." });
    }

    if (new Date(auction.endTime) <= Date.now()) {
      return res.status(400).json({ message: "Auction has already ended." });
    }

    const lastBid = auction.participants.find(
      (p) => p.userId.toString() === userId
    );

    // ตรวจสอบว่าผู้ใช้คนเดิมไม่สามารถบิดซ้ำใน 1 นาที
    if (lastBid && Date.now() - new Date(lastBid.bidTime) < 60 * 1000) {
      return res.status(400).json({
        message: "You must wait 1 minute before placing another bid.",
      });
    }

    if (bidAmount < auction.currentBid + auction.bidIncrement) {
      return res.status(400).json({
        message: "Bid amount must be higher than the current bid plus the bid increment",
      });
    }

    // อัปเดตราคาและเพิ่มข้อมูลผู้เข้าร่วม
    auction.currentBid = bidAmount;
    auction.endTime = new Date(Date.now() + 5 * 60 * 1000); // ขยายเวลา 5 นาที
    auction.participants.push({ userId, bidAmount, bidTime: new Date() });

    await auction.save();

    res.status(200).json({ message: "Bid placed successfully", auction });
  } catch (error) {
    console.error("Error placing bid:", error);
    res.status(500).json({ message: "Internal server error", error: error.message || error });
  }
});

// Declare Winner Automatically
router.put("/:auctionId/close", async (req, res) => {
  try {
    const { auctionId } = req.params;

    const auction = await Auction.findOne({ auctionId });
    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    if (auction.status !== "open") {
      return res.status(400).json({ message: "Auction is already closed or cancelled." });
    }

    if (new Date(auction.endTime) > Date.now()) {
      return res.status(400).json({
        message: "Auction is still active. You cannot close it manually.",
      });
    }

    // เรียกใช้ฟังก์ชันปิดประมูล
    await auction.closeAuction();

    res.status(200).json({
      message: "Auction closed successfully",
      winner: auction.winner,
    });
  } catch (error) {
    console.error("Error closing auction:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

// Declare Winner
router.put("/:auctionId/declare-winner", async (req, res) => {
  try {
    const { auctionId } = req.params;

    const auction = await Auction.findOne({ auctionId });
    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    // ตรวจสอบสถานะของการประมูล
    if (auction.status !== "open") {
      return res.status(400).json({ message: "Auction is not open for declaring winner." });
    }

    // หากเวลาหมด แต่สถานะยังเปิดอยู่ ให้ปิดการประมูลก่อน
    if (new Date(auction.endTime) <= Date.now()) {
      auction.status = "closed";
    }

    // ค้นหาผู้ชนะจาก participants
    const winner = auction.participants.reduce((max, p) =>
      p.bidAmount > (max?.bidAmount || 0) ? p : max
    , null);

    // อัปเดตผู้ชนะ
    auction.winner = winner
      ? { userId: winner.userId, winningBid: winner.bidAmount }
      : null;

    // ปิดสถานะการประมูล
    auction.status = "closed";
    await auction.save();

    res.status(200).json({ message: "Winner declared successfully", winner });
  } catch (error) {
    console.error("Error declaring winner:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});


// Get all auctions with Pagination
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const auctions = await Auction.find()
      .sort({ endTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await Auction.countDocuments();

    res.status(200).json({
      auctions,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("Error fetching auctions:", error);
    res.status(500).json({ message: "Error fetching auctions", error });
  }
});

router.get("/:auctionId/winner", async (req, res) => {
  try {
    const { auctionId } = req.params;

    const auction = await Auction.findOne({ auctionId });

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    // หากเวลาหมด และสถานะยังเป็น open ให้ปิดประมูลและคำนวณผู้ชนะ
    if (auction.status === "open" && new Date(auction.endTime) <= Date.now()) {
      const winner = auction.participants.reduce((max, p) =>
        p.bidAmount > (max?.bidAmount || 0) ? p : max
      , null);

      auction.winner = winner
        ? { userId: winner.userId, winningBid: winner.bidAmount }
        : null;
      auction.status = "closed";
      await auction.save();
    }

    // ส่งข้อมูลผู้ชนะ (หากไม่มีผู้ชนะ จะส่ง null)
    res.status(200).json({
      message: "Winner details",
      winner: auction.winner,
      status: auction.status,
    });
  } catch (error) {
    console.error("Error fetching winner:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

// Get Notifications for User
router.get("/:auctionId/notifications/:userId", async (req, res) => {
  try {
    const { auctionId, userId } = req.params;
    const auction = await Auction.findOne({ auctionId });

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    // ดึงการแจ้งเตือนทั้งหมดของผู้ใช้
    const userNotifications = auction.notifications.filter((notif) =>
      notif.userId.equals(userId)
    );

    // ตรวจสอบว่าผู้ใช้เป็นผู้ชนะหรือไม่
    const isWinner =
      auction.winner && auction.winner.userId.equals(userId);

    if (isWinner) {
      userNotifications.push({
        message: `Congratulations! You are the winner of the auction "${auction.itemName}" with a bid of ${auction.winner.winningBid}.`,
        timestamp: auction.updatedAt, // ใช้เวลาที่ประมูลถูกปิด
      });
    }

    res.status(200).json({ notifications: userNotifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});



// Delete Auction with Safe Deletion
router.delete("/:auctionId", async (req, res) => {
  try {
    const { auctionId } = req.params;
    const auction = await Auction.findOne({ auctionId });

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    if (auction.participants.length > 0) {
      return res.status(400).json({ message: "Cannot delete auction with participants." });
    }

    auction.status = "cancelled";
    await auction.save();

    res.status(200).json({ message: "Auction cancelled successfully." });
  } catch (error) {
    res.status(500).json({ message: "Error cancelling auction", error });
  }
});

module.exports = router;
