const jwt = require("jsonwebtoken");

const checkLogin = (req, res, next) => {
  console.log("📌 Cookies ที่ได้รับ:", req.cookies); // ✅ Debug Token

  const token = req.cookies.accessToken || req.headers.authorization?.split(" ")[1];

  if (!token) {
    console.log("❌ ไม่พบ Token");
    return res.status(401).json({ status: "error", message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET);
    console.log("📌 Token ถูกถอดรหัส:", decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.log("🚨 Token ไม่ถูกต้อง:", err.message);
    return res.status(401).json({ status: "error", message: "Invalid or expired token" });
  }
};

module.exports = { checkLogin }; // ✅ Export เป็น Object