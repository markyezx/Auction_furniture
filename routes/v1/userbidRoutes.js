const express = require("express");
const router = express.Router();
const UserBid = require("../../schemas/v1/userbid.schema");
const User = require("../../schemas/v1/user.schema")
const Auction = require("../../schemas/v1/auction.schema");

// Get all bids for a specific user
router.get("/", async (req, res) => {
  try {
    const { userId } = req.params;
    const userBids = await UserBid.find({ userId }).populate("auctionId");

    if (!userBids || userBids.length === 0) {
      return res.status(404).json({ message: "No bids found for this user" });
    }

    res.status(200).json(userBids);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving bids", error: error.message });
  }
});

// Add a new bid
router.post("/:auctionId/bid", async (req, res) => {
  try {
    const { auctionId } = req.params;
    const { userId, bidAmount } = req.body;

    // ตรวจสอบว่า auctionId มีอยู่หรือไม่
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    // ตรวจสอบว่า bidAmount มากกว่าราคาปัจจุบันหรือไม่
    if (bidAmount <= auction.currentBid) {
      return res.status(400).json({ message: "Bid amount must be higher than the current bid" });
    }

    // สร้าง bid ใหม่
    const newBid = new UserBid({ auctionId, userId, bidAmount });
    await newBid.save();

    // เพิ่ม bid นี้ใน participants ของ auction
    auction.participants.push(newBid._id);
    auction.currentBid = bidAmount; // อัปเดตราคาปัจจุบัน
    await auction.save();

    res.status(201).json({ message: "Bid added successfully", bid: newBid });
  } catch (error) {
    res.status(500).json({ message: "Error adding bid", error: error.message });
  }
});

// Update a bid (ถ้ามีกรณีที่ต้องการแก้ไข bid)
router.put("/:bidId", async (req, res) => {
  try {
    const { bidId } = req.params;
    const { bidAmount } = req.body;

    const bid = await UserBid.findById(bidId);
    if (!bid) {
      return res.status(404).json({ message: "Bid not found" });
    }

    bid.bidAmount = bidAmount; // อัปเดต bidAmount ใหม่
    await bid.save();

    res.status(200).json({ message: "Bid updated successfully", bid });
  } catch (error) {
    res.status(500).json({ message: "Error updating bid", error: error.message });
  }
});

// Delete a bid
router.delete("/:bidId", async (req, res) => {
  try {
    const { bidId } = req.params;

    const bid = await UserBid.findByIdAndDelete(bidId);
    if (!bid) {
      return res.status(404).json({ message: "Bid not found" });
    }

    res.status(200).json({ message: "Bid deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting bid", error: error.message });
  }
});

module.exports = router;
