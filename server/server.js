const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const axios = require("axios");

dotenv.config();

const app = express();

const PORT =
  process.env.PORT || 5000;

// =====================================================
// ENVIRONMENT VARIABLES
// =====================================================

const RAZORPAY_KEY_ID =
  process.env.RAZORPAY_KEY_ID;

const RAZORPAY_KEY_SECRET =
  process.env.RAZORPAY_KEY_SECRET;

const WASENDER_API_KEY =
  process.env.WASENDER_API_KEY;

// =====================================================
// CORS
// =====================================================

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(
    process.env.FRONTEND_URL
  );
}

app.use(
  cors({
    origin: function (
      origin,
      callback
    ) {
      // Allow requests without
      // an origin such as Postman

      if (!origin) {
        return callback(
          null,
          true
        );
      }

      if (
        allowedOrigins.includes(
          origin
        )
      ) {
        return callback(
          null,
          true
        );
      }

      return callback(
        new Error(
          "CORS not allowed"
        )
      );
    },
  })
);

app.use(express.json());

// =====================================================
// RAZORPAY
// =====================================================

const razorpay = new Razorpay({
  key_id:
    RAZORPAY_KEY_ID,

  key_secret:
    RAZORPAY_KEY_SECRET,
});

// =====================================================
// TEMPORARY OTP STORAGE
// =====================================================

const otpStore = new Map();

// =====================================================
// FUNCTIONS
// =====================================================

function generateOTP() {
  return Math.floor(
    100000 +
      Math.random() * 900000
  ).toString();
}

function normalizePhone(phone) {
  let number =
    String(phone || "").trim();

  number = number.replace(
    /[\s\-()]/g,
    ""
  );

  if (
    /^\d{10}$/.test(number)
  ) {
    number =
      "+91" + number;
  }

  if (
    /^91\d{10}$/.test(number)
  ) {
    number =
      "+" + number;
  }

  return number;
}

function isValidPhone(phone) {
  return /^\+91\d{10}$/.test(
    phone
  );
}

// =====================================================
// TEST ROUTE
// =====================================================

app.get("/", (req, res) => {
  res.json({
    success: true,

    message:
      "WhatsApp + Razorpay server is running",
  });
});

// =====================================================
// SEND WHATSAPP OTP
// =====================================================

app.post(
  "/api/send-otp",
  async (req, res) => {
    try {
      let { phone } =
        req.body;

      if (!phone) {
        return res.status(400).json({
          success: false,

          message:
            "WhatsApp number is required",
        });
      }

      phone =
        normalizePhone(phone);

      if (
        !isValidPhone(phone)
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Enter a valid 10-digit Indian WhatsApp number",
        });
      }

      if (
        !WASENDER_API_KEY
      ) {
        return res.status(500).json({
          success: false,

          message:
            "WASENDER_API_KEY is missing",
        });
      }

      // ===============================================
      // GENERATE OTP
      // ===============================================

      const otp =
        generateOTP();

      console.log(
        "OTP for:",
        phone
      );

      console.log(
        "OTP:",
        otp
      );

      // ===============================================
      // SAVE OTP
      // ===============================================

      otpStore.set(
        phone,
        {
          otp,

          expiresAt:
            Date.now() +
            5 * 60 * 1000,
        }
      );

      // ===============================================
      // MESSAGE
      // ===============================================

      const message =
        `Your login OTP is: ${otp}\n\n` +
        `This OTP is valid for 5 minutes.\n\n` +
        `Do not share this OTP with anyone.`;

      // ===============================================
      // WASENDER API
      // ===============================================

      const response =
        await axios.post(
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
        "Wasender response:",
        response.data
      );

      if (
        response.data?.success !==
        true
      ) {
        otpStore.delete(
          phone
        );

        return res.status(500).json({
          success: false,

          message:
            "Failed to send WhatsApp OTP",

          error:
            response.data,
        });
      }

      return res.json({
        success: true,

        message:
          "OTP sent successfully",
      });

    } catch (error) {
      console.error(
        "Send OTP error:",
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
  }
);

// =====================================================
// VERIFY OTP
// =====================================================

app.post(
  "/api/verify-otp",
  (req, res) => {
    try {
      let {
        phone,
        otp,
      } = req.body;

      if (
        !phone ||
        !otp
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Phone number and OTP are required",
        });
      }

      phone =
        normalizePhone(phone);

      otp =
        String(otp).trim();

      const saved =
        otpStore.get(phone);

      if (!saved) {
        return res.status(400).json({
          success: false,

          message:
            "OTP not found. Please request a new OTP.",
        });
      }

      // ===============================================
      // EXPIRATION
      // ===============================================

      if (
        Date.now() >
        saved.expiresAt
      ) {
        otpStore.delete(
          phone
        );

        return res.status(400).json({
          success: false,

          message:
            "OTP expired",
        });
      }

      // ===============================================
      // CHECK OTP
      // ===============================================

      if (
        saved.otp !== otp
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Invalid OTP",
        });
      }

      // ===============================================
      // SUCCESS
      // ===============================================

      otpStore.delete(
        phone
      );

      return res.json({
        success: true,

        message:
          "Login successful",

        user: {
          phone,
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
        "Creating Razorpay order"
      );

      // ===============================================
      // VALIDATE AMOUNT
      // ===============================================

      const rupees =
        Number(amount);

      if (
        !Number.isFinite(
          rupees
        ) ||
        rupees <= 0
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Invalid amount",
        });
      }

      // ===============================================
      // CONVERT TO PAISE
      // ===============================================

      const amountInPaise =
        Math.round(
          rupees * 100
        );

      // ===============================================
      // CREATE ORDER
      // ===============================================

      const options = {
        amount:
          amountInPaise,

        currency:
          "INR",

        receipt:
          "receipt_" +
          Date.now(),

        notes: {
          phone:
            phone || "",

          items:
            JSON.stringify(
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
        "Order created:",
        order.id
      );

      // ===============================================
      // RETURN TO FRONTEND
      // ===============================================

      return res.json({
        success: true,

        key:
          RAZORPAY_KEY_ID,

        order,
      });

    } catch (error) {
      console.error(
        "Create order error:"
      );

      console.error(
        error.response?.data ||
          error
      );

      return res.status(500).json({
        success: false,

        message:
          "Unable to create Razorpay order",

        error:
          error.error?.description ||
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

      // ===============================================
      // GENERATE SIGNATURE
      // ===============================================

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

      // ===============================================
      // SAFE COMPARISON
      // ===============================================

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

      console.log(
        "Payment verified:",
        razorpay_payment_id
      );

      return res.json({
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
// START SERVER
// =====================================================

app.listen(
  PORT,
  () => {
    console.log("");
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
    console.log("");
  }
);