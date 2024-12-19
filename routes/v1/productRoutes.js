// routes/v1/productRoutes.js
const express = require("express");
const Product = require("../../schemas/v1/products.js"); // ใช้ Product schema
const router = express.Router();

// Create Product
router.post('/', async (req, res) => {
  try {
      const { name, price, description, inStock } = req.body;
      const newProduct = new Product({
          name,
          price,
          description,
          inStock,
      });

      await newProduct.save();
      res.status(201).json(newProduct);
  } catch (err) {
      console.error("Error creating product:", err.message);
      res.status(500).json({ message: 'Error creating product', error: err.message });
  }
});

// Get all Products
router.get("/", async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error.message);
    res.status(500).json({ error: "Unable to fetch products", details: error.message });
  }
});

// Get single Product by ID
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.status(200).json(product);
  } catch (error) {
    console.error("Error fetching product:", error.message);
    res.status(500).json({ error: "Unable to fetch product", details: error.message });
  }
});

// Update Product
router.put("/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.status(200).json(product);
  } catch (error) {
    console.error("Error updating product:", error.message);
    res.status(500).json({ error: "Unable to update product", details: error.message });
  }
});

// Delete Product
router.delete("/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error.message);
    res.status(500).json({ error: "Unable to delete product", details: error.message });
  }
});

module.exports = router;
