const express = require("express");
const cors = require("cors");
const Razorpay = require("razorpay");
const crypto = require("crypto");
require("dotenv").config();

const app = express();

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// =====================================================
// RAZORPAY
// =====================================================

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// =====================================================
// TEST ROUTE
// =====================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "WhatsApp OTP + Razorpay Server is running",
  });
});

// =====================================================
// CREATE RAZORPAY ORDER
// =====================================================

app.post("/api/create-order", async (req, res) => {
  try {
    console.log("=================================");
    console.log("CREATE ORDER REQUEST");
    console.log("Amount:", req.body.amount);
    console.log(
      "Razorpay Key ID exists:",
      !!process.env.RAZORPAY_KEY_ID
    );
    console.log(
      "Razorpay Secret exists:",
      !!process.env.RAZORPAY_KEY_SECRET
    );
    console.log("=================================");

    const { amount } = req.body;

    // Validate amount
    if (
      amount === undefined ||
      amount === null ||
      Number(amount) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount",
      });
    }

    // Check Razorpay environment variables
    if (
      !process.env.RAZORPAY_KEY_ID ||
      !process.env.RAZORPAY_KEY_SECRET
    ) {
      console.error("Razorpay environment variables missing");

      return res.status(500).json({
        success: false,
        message: "Razorpay configuration missing",
      });
    }

    // Convert INR to paise
    const amountInPaise = Math.round(
      Number(amount) * 100
    );

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: "receipt_" + Date.now(),
    };

    console.log("Creating Razorpay order:", options);

    const order = await razorpay.orders.create(options);

    console.log("Razorpay order created:", order.id);

    return res.status(200).json({
      success: true,
      order: order,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error(
      "================================="
    );
    console.error("RAZORPAY CREATE ORDER ERROR");
    console.error(error);
    console.error(
      "================================="
    );

    return res.status(500).json({
      success: false,
      message: "Unable to create Razorpay order",
      error: error.message,
    });
  }
});

// =====================================================
// VERIFY RAZORPAY PAYMENT
// =====================================================

app.post("/api/verify-payment", (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing payment details",
      });
    }

    const generatedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(
        razorpay_order_id +
          "|" +
          razorpay_payment_id
      )
      .digest("hex");

    // Safe signature comparison
    const generatedBuffer =
      Buffer.from(generatedSignature, "utf8");

    const receivedBuffer =
      Buffer.from(razorpay_signature, "utf8");

    if (
      generatedBuffer.length !==
      receivedBuffer.length
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    const isValid = crypto.timingSafeEqual(
      generatedBuffer,
      receivedBuffer
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    console.log(
      "Payment verified:",
      razorpay_payment_id
    );

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
    });
  } catch (error) {
    console.error(
      "RAZORPAY VERIFY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Payment verification error",
      error: error.message,
    });
  }
});

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "API is healthy",
  });
});

// =====================================================
// LOCAL DEVELOPMENT
// =====================================================

if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(
      "=========================================="
    );
    console.log(
      " WhatsApp OTP + Razorpay Server"
    );
    console.log(
      "=========================================="
    );
    console.log(
      `Server running on http://localhost:${PORT}`
    );
    console.log(
      "=========================================="
    );
  });
}

// =====================================================
// VERCEL
// =====================================================

module.exports = app;