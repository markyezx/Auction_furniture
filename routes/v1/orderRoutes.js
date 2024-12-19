// routes/v1/orderRoutes.js
const express = require("express");
const router = express.Router();
const Order = require("../../schemas/v1/order");

// Create Order
// Create Order
router.post("/", async (req, res) => {
  try {
    const { user, products } = req.body;

    // ตรวจสอบว่า products มีข้อมูลครบถ้วน
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: "Products are required and must be a non-empty array." });
    }

    // ตรวจสอบแต่ละ product ว่ามี quantity และ price
    for (const item of products) {
      if (!item.product || typeof item.quantity !== "number" || item.quantity <= 0) {
        return res.status(400).json({ message: "Each product must have a valid product ID and quantity." });
      }
    }

    // คำนวณ totalPrice
    const totalPrice = products.reduce((sum, item) => {
      if (typeof item.price === "number" && typeof item.quantity === "number") {
        return sum + item.quantity * item.price;
      }
      return sum;
    }, 0);

    // ตรวจสอบว่า totalPrice ถูกต้อง
    if (isNaN(totalPrice) || totalPrice <= 0) {
      return res.status(400).json({ message: "Total price calculation failed. Check product data." });
    }

    // สร้างคำสั่งซื้อใหม่
    const newOrder = new Order({ user, products, totalPrice });
    await newOrder.save();
    res.status(201).json(newOrder);
  } catch (error) {
    res.status(500).json({ message: "Error creating order", error });
  }
});


// Get all orders
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find().populate("user products.product");
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving orders", error });
  }
});

// Get orders by user ID
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = await Order.find({ user: userId }).populate("products.product");
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving user's orders", error });
  }
});

// Get order by ID
router.get("/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate("products.product");
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving order", error });
  }
});

// Update Order
router.put("/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { products } = req.body;

    // ตรวจสอบว่า products มีข้อมูลที่ถูกต้อง
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: "Products are required and must be a non-empty array." });
    }

    // ตรวจสอบแต่ละ product ว่ามี quantity และ price
    for (const item of products) {
      if (!item.product || typeof item.quantity !== "number" || item.quantity <= 0) {
        return res.status(400).json({ message: "Each product must have a valid product ID and quantity." });
      }
    }

    // คำนวณ totalPrice
    const totalPrice = products.reduce((sum, item) => {
      if (typeof item.price === "number" && typeof item.quantity === "number") {
        return sum + item.quantity * item.price;
      }
      return sum;
    }, 0);

    // ตรวจสอบว่า totalPrice ถูกต้อง
    if (isNaN(totalPrice) || totalPrice <= 0) {
      return res.status(400).json({ message: "Total price calculation failed. Check product data." });
    }

    // อัปเดตคำสั่งซื้อ
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { products, totalPrice, updatedAt: Date.now() },
      { new: true }
    );
    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: "Error updating order", error });
  }
});


// Delete Order
router.delete("/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const deletedOrder = await Order.findByIdAndDelete(orderId);
    if (!deletedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.status(200).json({ message: "Order deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting order", error });
  }
});

module.exports = router;