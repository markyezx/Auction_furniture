const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

// Middleware สำหรับตรวจสอบการเข้าสู่ระบบ
const checkLogin = (req, res, next) => {
  const token = req.cookies.accessToken;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized, token missing' });
  }

  // ตรวจสอบ validity ของ token
  jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized, invalid token' });
    }

    // ถ้า token ถูกต้อง, ให้ proceed กับการทำงานต่อไป
    req.user = decoded; // ใส่ข้อมูลผู้ใช้ไว้ใน request
    next();
  });
};

module.exports = { checkLogin };
