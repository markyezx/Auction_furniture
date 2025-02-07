const jwt = require("jsonwebtoken");

const checkLogin = (req, res, next) => {
  const token = req.cookies?.accessToken || req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ status: "error", message: "Unauthorized: No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET);
    req.user = decoded; // ✅ กำหนดค่า req.user
    console.log("✅ User Authenticated:", req.user);
    next();
  } catch (err) {
    return res.status(401).json({ status: "error", message: "Invalid or expired token" });
  }
};

module.exports = { checkLogin };
