const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const axios = require("axios");

dotenv.config();

const app = express();

// =====================================================
// ENVIRONMENT VARIABLES
// =====================================================

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const WASENDER_API_KEY = process.env.WASENDER_API_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL;

// =====================================================
// BASIC ENVIRONMENT CHECK
// =====================================================

console.log("Server starting...");

console.log(
  "Razorpay Key ID:",
  RAZORPAY_KEY_ID ? "Loaded" : "MISSING"
);

console.log(
  "Razorpay Secret:",
  RAZORPAY_KEY_SECRET ? "Loaded" : "MISSING"
);

console.log(
  "WASender API Key:",
  WASENDER_API_KEY ? "Loaded" : "MISSING"
);

console.log(
  "Frontend URL:",
  FRONTEND_URL || "Not configured"
);

// =====================================================
// CORS
// =====================================================

// Your deployed frontend URL should be stored in
// FRONTEND_URL in Vercel Environment Variables.

const allowedOrigins = [];

if (FRONTEND_URL) {
  allowedOrigins.push(
    FRONTEND_URL.replace(/\/$/, "")
  );
}

// Allow known Vercel frontend URL
allowedOrigins.push(
  "https://cupnsaucer-bj4o-hrs75pg82-stephane17081999-2036.vercel.app"
);

app.use(
  cors({
    origin: function (origin, callback) {
      // Requests such as Postman/server-to-server
      if (!origin) {
        return callback(null, true);
      }

      const cleanOrigin = origin.replace(/\/$/, "");

      // Exact allowed frontend
      if (allowedOrigins.includes(cleanOrigin)) {
        return callback(null, true);
      }

      // Allow Vercel preview deployments
      if (
        cleanOrigin.endsWith(".vercel.app")
      ) {
        return callback(null, true);
      }

      console.log(
        "CORS blocked:",
        cleanOrigin
      );

      // Return false instead of throwing an error.
      // This prevents Express from returning an HTML error
      // response during a browser preflight request.
      return callback(null, false);
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],

    credentials: true,

    optionsSuccessStatus: 204,
  })
);

// =====================================================
// JSON
// =====================================================

app.use(express.json());

// =====================================================
// RAZORPAY
// =====================================================

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

// =====================================================
// TEMPORARY OTP STORAGE
// =====================================================

// This is only for testing/sample use.
// Vercel serverless storage is NOT permanent.

const otpStore = new Map();

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function generateOTP() {
  return Math.floor(
    100000 + Math.random() * 900000
  ).toString();
}

function normalizePhone(phone) {
  let number = String(phone || "").trim();

  // Remove spaces, -, brackets
  number = number.replace(/[\s\-()]/g, "");

  // Example:
  // 6369879061
  // becomes:
  // +916369879061

  if (/^\d{10}$/.test(number)) {
    number = "+91" + number;
  }

  // Example:
  // 916369879061
  // becomes:
  // +916369879061

  if (/^91\d{10}$/.test(number)) {
    number = "+" + number;
  }

  return number;
}

function isValidPhone(phone) {
  return /^\+91\d{10}$/.test(phone);
}

// =====================================================
// TEST ROUTE
// =====================================================

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message:
      "WhatsApp OTP + Razorpay server is running",
  });
});

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/api/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Backend is healthy",
  });
});

// =====================================================
// SEND WHATSAPP OTP
// =====================================================

app.post("/api/send-otp", async (req, res) => {
  try {
    let { phone } = req.body;

    // -----------------------------------------------
    // CHECK PHONE
    // -----------------------------------------------

    if (!phone) {
      return res.status(400).json({
        success: false,
        message:
          "WhatsApp number is required",
      });
    }

    // -----------------------------------------------
    // NORMALIZE PHONE
    // -----------------------------------------------

    phone = normalizePhone(phone);

    console.log(
      "OTP requested for:",
      phone
    );

    // -----------------------------------------------
    // VALIDATE PHONE
    // -----------------------------------------------

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message:
          "Enter a valid 10-digit Indian WhatsApp number",
      });
    }

    // -----------------------------------------------
    // CHECK WASENDER KEY
    // -----------------------------------------------

    if (!WASENDER_API_KEY) {
      console.error(
        "WASENDER_API_KEY is missing"
      );

      return res.status(500).json({
        success: false,
        message:
          "WASENDER_API_KEY is missing",
      });
    }

    // -----------------------------------------------
    // GENERATE OTP
    // -----------------------------------------------

    const otp = generateOTP();

    console.log(
      "Generated OTP for:",
      phone
    );

    console.log(
      "OTP:",
      otp
    );

    // -----------------------------------------------
    // SAVE OTP
    // -----------------------------------------------

    otpStore.set(phone, {
      otp: otp,
      expiresAt:
        Date.now() + 5 * 60 * 1000,
    });

    // -----------------------------------------------
    // WHATSAPP MESSAGE
    // -----------------------------------------------

    const message =
      `Your login OTP is: ${otp}\n\n` +
      `This OTP is valid for 5 minutes.\n\n` +
      `Do not share this OTP with anyone.`;

    // -----------------------------------------------
    // SEND THROUGH WASENDER
    // -----------------------------------------------

    const response = await axios.post(
      "https://www.wasenderapi.com/api/send-message",

      {
        to: phone,
        text: message,
      },

      {
        headers: {
          Authorization:
            `Bearer ${WASENDER_API_KEY}`,

          "Content-Type":
            "application/json",
        },

        timeout: 15000,
      }
    );

    console.log(
      "WASender response:",
      response.data
    );

    // -----------------------------------------------
    // CHECK WASENDER RESPONSE
    // -----------------------------------------------

    if (response.data?.success !== true) {
      otpStore.delete(phone);

      return res.status(500).json({
        success: false,
        message:
          "Failed to send WhatsApp OTP",
        error: response.data,
      });
    }

    // -----------------------------------------------
    // SUCCESS
    // -----------------------------------------------

    return res.status(200).json({
      success: true,
      message:
        "OTP sent successfully",
    });
  } catch (error) {
    console.error(
      "Send OTP error:"
    );

    console.error(
      error.response?.data ||
        error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to send OTP",
      error:
        error.response?.data ||
        error.message,
    });
  }
});

// =====================================================
// VERIFY WHATSAPP OTP
// =====================================================

app.post(
  "/api/verify-otp",
  (req, res) => {
    try {
      let { phone, otp } = req.body;

      // -----------------------------------------------
      // VALIDATE INPUT
      // -----------------------------------------------

      if (!phone || !otp) {
        return res.status(400).json({
          success: false,
          message:
            "Phone number and OTP are required",
        });
      }

      // -----------------------------------------------
      // NORMALIZE
      // -----------------------------------------------

      phone = normalizePhone(phone);
      otp = String(otp).trim();

      // -----------------------------------------------
      // GET SAVED OTP
      // -----------------------------------------------

      const saved = otpStore.get(phone);

      if (!saved) {
        return res.status(400).json({
          success: false,
          message:
            "OTP not found. Please request a new OTP.",
        });
      }

      // -----------------------------------------------
      // CHECK EXPIRATION
      // -----------------------------------------------

      if (Date.now() > saved.expiresAt) {
        otpStore.delete(phone);

        return res.status(400).json({
          success: false,
          message: "OTP expired",
        });
      }

      // -----------------------------------------------
      // CHECK OTP
      // -----------------------------------------------

      if (saved.otp !== otp) {
        return res.status(400).json({
          success: false,
          message: "Invalid OTP",
        });
      }

      // -----------------------------------------------
      // LOGIN SUCCESS
      // -----------------------------------------------

      otpStore.delete(phone);

      console.log(
        "OTP verified:",
        phone
      );

      return res.status(200).json({
        success: true,
        message:
          "Login successful",

        user: {
          phone: phone,
        },
      });
    } catch (error) {
      console.error(
        "Verify OTP error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "OTP verification failed",
      });
    }
  }
);

// =====================================================
// CREATE RAZORPAY ORDER
// =====================================================

app.post(
  "/api/create-order",
  async (req, res) => {
    try {
      const {
        amount,
        phone,
        items,
      } = req.body;

      console.log(
        "Creating Razorpay order..."
      );

      // -----------------------------------------------
      // VALIDATE AMOUNT
      // -----------------------------------------------

      const rupees = Number(amount);

      if (
        !Number.isFinite(rupees) ||
        rupees <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid amount",
        });
      }

      // -----------------------------------------------
      // CONVERT RUPEES TO PAISE
      // -----------------------------------------------

      const amountInPaise =
        Math.round(rupees * 100);

      console.log(
        "Amount:",
        rupees,
        "INR"
      );

      console.log(
        "Amount:",
        amountInPaise,
        "paise"
      );

      // -----------------------------------------------
      // CREATE ORDER
      // -----------------------------------------------

      const options = {
        amount: amountInPaise,

        currency: "INR",

        receipt:
          "receipt_" +
          Date.now(),

        notes: {
          phone: phone || "",

          items: JSON.stringify(
            Array.isArray(items)
              ? items
              : []
          ),
        },
      };

      const order =
        await razorpay.orders.create(
          options
        );

      console.log(
        "Razorpay order created:",
        order.id
      );

      // -----------------------------------------------
      // RETURN ORDER
      // -----------------------------------------------

      return res.status(200).json({
        success: true,

        key:
          RAZORPAY_KEY_ID,

        order: order,
      });
    } catch (error) {
      console.error(
        "Create Razorpay order error:"
      );

      console.error(
        error.response?.data ||
          error.message
      );

      return res.status(500).json({
        success: false,

        message:
          "Unable to create Razorpay order",

        error:
          error.response?.data ||
          error.message,
      });
    }
  }
);

// =====================================================
// VERIFY RAZORPAY PAYMENT
// =====================================================

app.post(
  "/api/verify-payment",
  (req, res) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      } = req.body;

      // -----------------------------------------------
      // VALIDATE PAYMENT DATA
      // -----------------------------------------------

      if (
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Missing Razorpay payment details",
        });
      }

      // -----------------------------------------------
      // CREATE EXPECTED SIGNATURE
      // -----------------------------------------------

      const generatedSignature =
        crypto
          .createHmac(
            "sha256",
            RAZORPAY_KEY_SECRET
          )
          .update(
            razorpay_order_id +
              "|" +
              razorpay_payment_id
          )
          .digest("hex");

      // -----------------------------------------------
      // CONVERT TO BUFFERS
      // -----------------------------------------------

      const generatedBuffer =
        Buffer.from(
          generatedSignature,
          "utf8"
        );

      const receivedBuffer =
        Buffer.from(
          razorpay_signature,
          "utf8"
        );

      // -----------------------------------------------
      // CHECK LENGTH
      // -----------------------------------------------

      if (
        generatedBuffer.length !==
        receivedBuffer.length
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Payment verification failed",
        });
      }

      // -----------------------------------------------
      // SAFE COMPARISON
      // -----------------------------------------------

      const isValid =
        crypto.timingSafeEqual(
          generatedBuffer,
          receivedBuffer
        );

      if (!isValid) {
        return res.status(400).json({
          success: false,
          message:
            "Payment verification failed",
        });
      }

      // -----------------------------------------------
      // PAYMENT VERIFIED
      // -----------------------------------------------

      console.log(
        "Payment verified:",
        razorpay_payment_id
      );

      return res.status(200).json({
        success: true,

        message:
          "Payment verified successfully",

        paymentId:
          razorpay_payment_id,

        orderId:
          razorpay_order_id,
      });
    } catch (error) {
      console.error(
        "Payment verification error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Payment verification error",
      });
    }
  }
);

// =====================================================
// 404 HANDLER
// =====================================================

app.use(
  (req, res) => {
    return res.status(404).json({
      success: false,
      message:
        `Route not found: ${req.method} ${req.originalUrl}`,
    });
  }
);

// =====================================================
// ERROR HANDLER
// =====================================================

app.use(
  (error, req, res, next) => {
    console.error(
      "Server error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Internal server error",
    });
  }
);

// =====================================================
// LOCAL DEVELOPMENT ONLY
// =====================================================

if (
  process.env.NODE_ENV !==
  "production"
) {
  const PORT =
    process.env.PORT || 5000;

  app.listen(
    PORT,
    () => {
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
    }
  );
}

// =====================================================
// VERCEL EXPORT
// =====================================================

module.exports = app;