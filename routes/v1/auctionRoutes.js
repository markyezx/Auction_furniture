const express = require("express");
const router = express.Router();
const Auction = require("../../schemas/v1/auction.schema");
const UserBid = require("../../schemas/v1/userbid.schema");
const User = require("../../schemas/v1/user.schema");
const Organization = require("../../schemas/v1/organization.schema");
const mongoose = require('mongoose');

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

    // Validation
    if (!businessId || !auctionId || !organizationId || !itemName || !itemImage || !description) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (startingBid <= 0 || bidIncrement <= 0) {
      return res.status(400).json({ message: "Starting bid and bid increment must be greater than 0" });
    }

    // กำหนด endTime เป็น 2 นาทีหลังจากเวลาปัจจุบัน
    const endTime = new Date(Date.now() + 2 * 60 * 1000); // เพิ่ม 2 นาที (120,000 มิลลิวินาที)

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
    });

    await newAuction.save();
    res.status(201).json(newAuction);
  } catch (error) {
    console.error("Error creating auction:", error.message);
    res.status(500).json({ message: "Internal server error", error: error.message || error });
  }
});
/*router.post("/", async (req, res) => {
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
      endTime,
    } = req.body;

    // Validation
    if (!businessId || !auctionId || !organizationId || !itemName || !itemImage || !description) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (startingBid <= 0 || bidIncrement <= 0) {
      return res.status(400).json({ message: "Starting bid and bid increment must be greater than 0" });
    }
    if (new Date(endTime) <= Date.now()) {
      return res.status(400).json({ message: "End time must be in the future" });
    }

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
    });

    await newAuction.save();
    res.status(201).json(newAuction);
  } catch (error) {
    console.error("Error creating auction:", error.message);
    res.status(500).json({ message: "Internal server error", error: error.message || error });
  }
});*/

// API สำหรับการเพิ่ม bid ใหม่
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

    if (bidAmount < auction.currentBid + auction.bidIncrement) {
      return res.status(400).json({ message: "Bid amount must be higher than the current bid plus the bid increment" });
    }

    auction.currentBid = bidAmount;
    auction.participants.push({ userId, bidAmount });
    await auction.save();

    res.status(200).json({ message: "Bid placed successfully", auction });
  } catch (error) {
    console.error("Error placing bid:", error);
    res.status(500).json({ message: "Internal server error", error: error.message || error });
  }
});

// Get all auctions
router.get("/:auctionId", async (req, res) => {
  try {
    const { auctionId } = req.params;
    const singleAuction = await Auction.findOne({ auctionId })
      .populate("organizationId participants.userId");

    if (!singleAuction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    res.status(200).json(singleAuction);
  } catch (error) {
    console.error("Error retrieving auction:", error);
    res.status(500).json({ message: "Error retrieving auction", error });
  }
});

// Endpoint สำหรับประกาศผู้ชนะ
router.put("/auction/:auctionId/declare-winner", async (req, res) => {
  try {
    const { auctionId } = req.params;

    // ค้นหา auction
    const auction = await Auction.findOne({ auctionId });
    if (!auction) {
      return res.status(404).json({ error: "Auction not found" });
    }

    // เรียกใช้ฟังก์ชันประกาศผู้ชนะ
    await auction.declareWinner();

    res.status(200).json({
      message: "Winner declared successfully",
      winner: auction.winner,
    });
  } catch (error) {
    console.error("Error declaring winner:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete Auction
router.delete("/:auctionId", async (req, res) => {
  try {
    const { auctionId } = req.params;
    const deletedAuction = await Auction.findByIdAndDelete(auctionId);
    if (!deletedAuction) {
      return res.status(404).json({ message: "Auction not found" });
    }
    res.status(200).json({ message: "Auction deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting auction", error });
  }
});

module.exports = router;
