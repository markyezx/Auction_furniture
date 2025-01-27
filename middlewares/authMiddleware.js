const jwt = require("jsonwebtoken");

exports.checkLogin = (req, res, next) => {
  // ตรวจสอบ Token จาก Cookies
  const token = req.cookies.accessToken || req.cookies.refreshToken;

  if (!token) {
    return res.status(401).send({ status: "error", message: "Unauthorized" });
  }

  try {
    // ตรวจสอบ Token
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET);
    req.user = decoded; // ใส่ข้อมูลผู้ใช้ใน req.user
    next();
  } catch (err) {
    return res.status(401).send({ status: "error", message: "Invalid or expired token" });
  }
};
