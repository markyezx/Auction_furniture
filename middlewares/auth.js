const jwt = require("jsonwebtoken");
const redis = require("../app");

const JWT_ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_TOKEN_SECRET;
const JWT_REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_TOKEN_SECRET;
const SUPER_ADMIN_API_KEY = process.env.SUPER_ADMIN_API_KEY;

// Middleware: ตรวจสอบ accessToken และแนบข้อมูล user ไปยัง req
const authenticate = (req, res, next) => {
  const accessToken = req.headers["authorization"]?.replace("Bearer ", "");
  if (!accessToken) {
    return res.status(401).json({
      status: "error",
      message: "Access token is required.",
    });
  }

  jwt.verify(accessToken, JWT_ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.error("JWT Error:", err);
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          status: "error",
          message: "Access token has expired.",
        });
      }
      return res.status(401).json({
        status: "error",
        message: "Invalid access token.",
      });
    }

    req.user = decoded; // แนบข้อมูลผู้ใช้
    console.log("Authenticated User:", req.user);
    next();
  });
};
// Middleware: ตรวจสอบ role
const authorize = (allowedRoles) => (req, res, next) => {
  const userRole = req.user?.role;
  if (!userRole || !allowedRoles.includes(userRole)) {
    return res
      .status(403)
      .json({ status: "error", message: "Access denied. Insufficient permissions." });
  }
  next();
};

// ตรวจสอบ accessToken พร้อม macAddress และ hardwareId
const verifyAccessToken = async (req, res, next) => {
  const accessToken = req.headers["authorization"]?.replace("Bearer ", "");
  const macAddress = req.headers["mac-address"];
  const hardwareId = req.headers["hardware-id"];
  const role = req.headers["role"];

  if (!accessToken || !macAddress || !hardwareId) {
    return res.status(401).json({
      status: "error",
      message: "Access token, MAC address, and hardware ID are required.",
    });
  }

  if (role === "superadmin") {
    const superAdminApiKey = req.headers["x-super-admin-api-key"];
    if (superAdminApiKey === SUPER_ADMIN_API_KEY) {
      console.log("Super Admin mode enabled.");
      return next();
    }
    return res.status(403).json({ status: "error", message: "Invalid API key for super admin." });
  }

  jwt.verify(accessToken, JWT_ACCESS_TOKEN_SECRET, async (err, decoded) => {
    if (err) {
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

    const macIsValid = await redis.sIsMember(
      `Mac_Address_${decoded.userId}`,
      macAddress
    );
    const hardwareIsValid = await redis.sIsMember(
      `Hardware_ID_${decoded.userId}`,
      hardwareId
    );

    if (!macIsValid || !hardwareIsValid) {
      return res.status(401).json({
        status: "error",
        message: "MAC address or Hardware ID is invalid.",
      });
    }

    const lastAccessToken = await redis.get(
      `Last_Access_Token_${decoded.userId}_${hardwareId}`
    );

    if (lastAccessToken !== accessToken) {
      return res.status(401).json({
        status: "error",
        message: "Access token mismatch.",
      });
    }

    req.user = decoded; // แนบข้อมูลผู้ใช้ไปยัง req
    next();
  });
};

// ตรวจสอบ refreshToken
const verifyRefreshToken = (req, res, next) => {
  const refreshToken = req.headers["authorization"]?.replace("Bearer ", "");
  const hardwareId = req.headers["hardware-id"];

  if (!refreshToken || !hardwareId) {
    return res.status(401).json({
      status: "error",
      message: "Refresh token and hardware ID are required.",
    });
  }

  jwt.verify(refreshToken, JWT_REFRESH_TOKEN_SECRET, async (err, decoded) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          status: "error",
          message: "Refresh token expired.",
        });
      }
      return res.status(401).json({
        status: "error",
        message: "Invalid refresh token.",
      });
    }

    const savedRefreshToken = await redis.get(
      `Last_Refresh_Token_${decoded.userId}_${hardwareId}`
    );

    if (savedRefreshToken !== refreshToken) {
      return res.status(401).json({
        status: "error",
        message: "Refresh token mismatch.",
      });
    }

    req.user = decoded; // แนบข้อมูลผู้ใช้ไปยัง req
    next();
  });
};

// ตรวจสอบ API Key
const verifyAPIKey = (req, res, next) => {
  const apiKey = req.headers["authorization"];
  if (!apiKey || apiKey !== SUPER_ADMIN_API_KEY) {
    return res.status(403).json({
      status: "error",
      message: "Invalid or missing API key.",
    });
  }
  next();
};

module.exports = {
  authenticate,
  authorize,
  verifyAccessToken,
  verifyRefreshToken,
  verifyAPIKey,
};
