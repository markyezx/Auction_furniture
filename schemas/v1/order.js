// schemas/v1/order.js
const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    products: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true }, // ราคาต่อหน่วย
      }
    ],
    shippingAddress: { type: String, required: true },
    paymentStatus: { type: String, required: true, enum: ["Unpaid", "Paid"] },
    totalPrice: { type: Number, required: true }, // คำนวณราคารวม
    status: { type: String, default: "Pending" },
  },
  { timestamps: true } // เพิ่ม createdAt และ updatedAt
);

// คำนวณราคาสินค้าทั้งหมด
orderSchema.pre('save', function (next) {
  this.totalPrice = this.products.reduce((total, item) => total + (item.quantity * item.price), 0);
  next();
});

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
