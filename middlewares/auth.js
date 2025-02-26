const jwt = require("jsonwebtoken");

const JWT_ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_TOKEN_SECRET;

// Middleware: ตรวจสอบ accessToken และแนบข้อมูล user ไปยัง req
const verifyAccessToken = (req, res, next) => {
  // ✅ ตรวจสอบ token ใน cookies
  const accessToken = req.cookies?.accessToken;

  if (!accessToken) {
    return res.status(401).json({
      status: "error",
      message: "Access token is required.",
    });
  }

  try {
    // ✅ ตรวจสอบ JWT Token
    const decoded = jwt.verify(accessToken, JWT_ACCESS_TOKEN_SECRET);
    req.user = decoded; // ✅ แนบข้อมูลผู้ใช้ไปยัง req
    console.log("✅ Authenticated User:", req.user);
    next();
  } catch (err) {
    console.error("❌ JWT Error:", err);
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        status: "error",
        message: "Access token expired.",
      });
    }
    return res.status(401).json({
      status: "error",
      message: "Invalid access token.",
    });
  }
};

// ✅ Middleware: ตรวจสอบ role
const authorize = (allowedRoles) => (req, res, next) => {
  const userRole = req.user?.role;
  if (!userRole || !allowedRoles.includes(userRole)) {
    return res.status(403).json({
      status: "error",
      message: "Access denied. Insufficient permissions.",
    });
  }
  next();
};

// ✅ Middleware: ตรวจสอบ refreshToken (ยังคงใช้ hardwareId)
const verifyRefreshToken = (req, res, next) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({
      status: "error",
      message: "Refresh token is required.",
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_TOKEN_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      status: "error",
      message: "Invalid or expired refresh token.",
    });
  }
};

// ✅ Middleware: ตรวจสอบ API Key
const verifyAPIKey = (req, res, next) => {
  const apiKey = req.headers["authorization"];
  if (!apiKey || apiKey !== process.env.SUPER_ADMIN_API_KEY) {
    return res.status(403).json({
      status: "error",
      message: "Invalid or missing API key.",
    });
  }
  next();
};

module.exports = {
  verifyAccessToken,
  authorize,
  verifyRefreshToken,
  verifyAPIKey,
};
