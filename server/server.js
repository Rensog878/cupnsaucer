const express = require("express");
const cors = require("cors");
const Razorpay = require("razorpay");
const crypto = require("crypto");

require("dotenv").config();

const app = express();

// =====================================================
// CONFIGURATION
// =====================================================

const PORT = process.env.PORT || 5000;

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "https://www.kqphfa.store";

// =====================================================
// OTP SETTINGS
// =====================================================

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_COOLDOWN_MS = 30 * 1000;

// =====================================================
// RAZORPAY TEST ACCOUNT
// =====================================================
//
// Razorpay verification account:
//
// Number: 6369879061
// OTP:    000000
//
// This number NEVER calls WasenderAPI.
//

const RAZORPAY_TEST_PHONE = "+916369879061";
const RAZORPAY_TEST_OTP = "000000";

// =====================================================
// COOLDOWN STORAGE
// =====================================================

const otpCooldowns = new Map();

// Prevent duplicate simultaneous requests.
const otpRequestsInFlight = new Set();

// =====================================================
// CORS
// =====================================================

const allowedOrigins = [
  "https://kqphfa.store",
  "https://www.kqphfa.store",

  "https://kqphfa.vercel.app",
  FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:5174",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow server-to-server requests.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error(
        "CORS blocked origin:",
        origin
      );

      return callback(
        new Error("Not allowed by CORS")
      );
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

app.use(express.json());

// =====================================================
// ERROR HANDLER
// =====================================================

app.use(
  (
    err,
    req,
    res,
    next
  ) => {
    console.error(
      "MIDDLEWARE ERROR:",
      err
    );

    if (
      err &&
      err.message ===
        "Not allowed by CORS"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "CORS origin not allowed",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Internal server error",
    });
  }
);

// =====================================================
// ENVIRONMENT CHECK
// =====================================================

console.log(
  "=========================================="
);

console.log(
  "SERVER ENVIRONMENT CHECK"
);

console.log(
  "RAZORPAY_KEY_ID:",
  !!process.env.RAZORPAY_KEY_ID
);

console.log(
  "RAZORPAY_KEY_SECRET:",
  !!process.env.RAZORPAY_KEY_SECRET
);

console.log(
  "WASENDER_API_KEY:",
  !!process.env.WASENDER_API_KEY
);

console.log(
  "OTP_SECRET:",
  !!process.env.OTP_SECRET
);

console.log(
  "FRONTEND_URL:",
  FRONTEND_URL
);

console.log(
  "=========================================="
);

// =====================================================
// RAZORPAY
// =====================================================

let razorpay = null;

if (
  process.env.RAZORPAY_KEY_ID &&
  process.env.RAZORPAY_KEY_SECRET
) {
  razorpay = new Razorpay({
    key_id:
      process.env.RAZORPAY_KEY_ID,

    key_secret:
      process.env.RAZORPAY_KEY_SECRET,
  });
}

// =====================================================
// BASIC ROUTE
// =====================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message:
      "WhatsApp OTP + Razorpay API is running",
    environment:
      process.env.NODE_ENV ||
      "development",
  });
});

// =====================================================
// HEALTH CHECK
// =====================================================

app.get(
  "/api/health",
  (req, res) => {
    res.status(200).json({
      success: true,
      message:
        "API is healthy",
    });
  }
);

// =====================================================
// NORMALIZE PHONE NUMBER
// =====================================================

function normalizePhone(phone) {
  if (!phone) {
    return null;
  }

  let number =
    String(phone).trim();

  // Remove +, spaces, -, brackets etc.
  number =
    number.replace(
      /\D/g,
      ""
    );

  // Indian 10 digit number.
  //
  // 6369879061
  // ->
  // 916369879061

  if (number.length === 10) {
    number = "91" + number;
  }

  // Remove leading zero.
  //
  // 0916369879061
  // ->
  // 916369879061

  if (
    number.startsWith("0")
  ) {
    number =
      number.substring(1);
  }

  // India E.164.

  if (
    number.startsWith("91") &&
    number.length === 12
  ) {
    return "+" + number;
  }

  // General international E.164.

  if (
    number.length >= 11 &&
    number.length <= 15
  ) {
    return "+" + number;
  }

  return null;
}

// =====================================================
// OTP SECRET
// =====================================================

function getOtpSecret() {
  if (
    !process.env.OTP_SECRET
  ) {
    throw new Error(
      "OTP_SECRET environment variable is missing"
    );
  }

  return process.env.OTP_SECRET;
}

// =====================================================
// CREATE OTP TOKEN
// =====================================================

function createOtpToken(
  phone,
  otp,
  expiresAt
) {
  const secret =
    getOtpSecret();

  const payload =
    `${phone}.${otp}.${expiresAt}`;

  const signature =
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(payload)
      .digest("hex");

  return (
    `${payload}.${signature}`
  );
}

// =====================================================
// VERIFY OTP TOKEN
// =====================================================

function verifyOtpToken(token) {
  try {
    if (!token) {
      return null;
    }

    const parts =
      token.split(".");

    if (
      parts.length !== 4
    ) {
      return null;
    }

    const [
      phone,
      otp,
      expiresAtString,
      receivedSignature,
    ] = parts;

    const expiresAt =
      Number(
        expiresAtString
      );

    if (
      !phone ||
      !otp ||
      !expiresAt ||
      !receivedSignature
    ) {
      return null;
    }

    // Check expiry.

    if (
      Date.now() >
      expiresAt
    ) {
      return null;
    }

    const secret =
      getOtpSecret();

    const payload =
      `${phone}.${otp}.${expiresAt}`;

    const expectedSignature =
      crypto
        .createHmac(
          "sha256",
          secret
        )
        .update(payload)
        .digest("hex");

    const expectedBuffer =
      Buffer.from(
        expectedSignature,
        "utf8"
      );

    const receivedBuffer =
      Buffer.from(
        receivedSignature,
        "utf8"
      );

    if (
      expectedBuffer.length !==
      receivedBuffer.length
    ) {
      return null;
    }

    const valid =
      crypto.timingSafeEqual(
        expectedBuffer,
        receivedBuffer
      );

    if (!valid) {
      return null;
    }

    return {
      phone,
      otp,
      expiresAt,
    };
  } catch (error) {
    console.error(
      "OTP TOKEN ERROR:",
      error
    );

    return null;
  }
}

// =====================================================
// GET COOKIE
// =====================================================

function getCookie(
  req,
  name
) {
  const cookieHeader =
    req.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookies =
    cookieHeader
      .split(";")
      .map(
        (cookie) =>
          cookie.trim()
      );

  for (
    const cookie of cookies
  ) {
    const separatorIndex =
      cookie.indexOf("=");

    if (
      separatorIndex === -1
    ) {
      continue;
    }

    const key =
      cookie
        .substring(
          0,
          separatorIndex
        )
        .trim();

    const value =
      cookie
        .substring(
          separatorIndex + 1
        )
        .trim();

    if (key === name) {
      return decodeURIComponent(
        value
      );
    }
  }

  return null;
}

// =====================================================
// SET OTP COOKIE
// =====================================================

function setOtpCookie(
  res,
  token
) {
  const cookieParts = [
    `otp_token=${encodeURIComponent(
      token
    )}`,

    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=300",
  ];

  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    cookieParts.push(
      "Secure"
    );
  }

  res.setHeader(
    "Set-Cookie",
    cookieParts.join("; ")
  );
}

// =====================================================
// CLEAR OTP COOKIE
// =====================================================

function clearOtpCookie(
  res
) {
  const cookieParts = [
    "otp_token=",
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0",
  ];

  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    cookieParts.push(
      "Secure"
    );
  }

  res.setHeader(
    "Set-Cookie",
    cookieParts.join("; ")
  );
}

// =====================================================
// SEND OTP
// =====================================================

app.post(
  "/api/send-otp",
  async (req, res) => {
    try {
      const {
        phone,
      } = req.body || {};

      // -------------------------------------------------
      // VALIDATE PHONE
      // -------------------------------------------------

      if (!phone) {
        return res.status(400).json({
          success: false,
          message:
            "WhatsApp number is required",
        });
      }

      const whatsappNumber =
        normalizePhone(phone);

      if (!whatsappNumber) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid WhatsApp number. Enter a valid number.",
        });
      }

      const now =
        Date.now();

      // -------------------------------------------------
      // 30 SECOND COOLDOWN
      // -------------------------------------------------

      const cooldownUntil =
        otpCooldowns.get(
          whatsappNumber
        ) || 0;

      if (
        cooldownUntil > now
      ) {
        const remainingSeconds =
          Math.ceil(
            (cooldownUntil -
              now) /
              1000
          );

        return res.status(429).json({
          success: false,

          message:
            `Please wait ${remainingSeconds} seconds before requesting another OTP.`,

          remainingSeconds,

          cooldownSeconds:
            remainingSeconds,
        });
      }

      // Remove expired cooldown.

      if (cooldownUntil) {
        otpCooldowns.delete(
          whatsappNumber
        );
      }

      // -------------------------------------------------
      // DUPLICATE REQUEST PROTECTION
      // -------------------------------------------------

      if (
        otpRequestsInFlight.has(
          whatsappNumber
        )
      ) {
        return res.status(429).json({
          success: false,

          message:
            "OTP request is already being processed. Please wait.",

          remainingSeconds: 1,
        });
      }

      // -------------------------------------------------
      // OTP SECRET REQUIRED
      // -------------------------------------------------

      if (
        !process.env.OTP_SECRET
      ) {
        console.error(
          "OTP_SECRET is missing"
        );

        return res.status(500).json({
          success: false,
          message:
            "OTP configuration is missing",
        });
      }

      otpRequestsInFlight.add(
        whatsappNumber
      );

      try {
        // -------------------------------------------------
        // CHECK RAZORPAY TEST ACCOUNT
        // -------------------------------------------------

        const isRazorpayTestAccount =
          whatsappNumber ===
          RAZORPAY_TEST_PHONE;

        // Normal users get random OTP.
        // Razorpay test user gets 000000.

        const otp =
          isRazorpayTestAccount
            ? RAZORPAY_TEST_OTP
            : crypto
                .randomInt(
                  100000,
                  1000000
                )
                .toString();

        const expiresAt =
          Date.now() +
          OTP_EXPIRY_MS;

        // Create signed OTP token.

        const otpToken =
          createOtpToken(
            whatsappNumber,
            otp,
            expiresAt
          );

        // -------------------------------------------------
        // RAZORPAY TEST ACCOUNT
        // -------------------------------------------------

        if (
          isRazorpayTestAccount
        ) {
          console.log(
            "Razorpay test account OTP request"
          );

          setOtpCookie(
            res,
            otpToken
          );

          // Start cooldown.

          otpCooldowns.set(
            whatsappNumber,
            Date.now() +
              OTP_COOLDOWN_MS
          );

          return res.status(200).json({
            success: true,

            message:
              "Test OTP ready. Use 000000.",

            cooldownSeconds: 30,

            testAccount: true,
          });
        }

        // -------------------------------------------------
        // NORMAL USER
        // -------------------------------------------------

        if (
          !process.env
            .WASENDER_API_KEY
        ) {
          console.error(
            "WASENDER_API_KEY is missing"
          );

          return res.status(500).json({
            success: false,

            message:
              "WasenderAPI configuration is missing",
          });
        }

        console.log(
          "Calling WasenderAPI for:",
          whatsappNumber
        );

        // -------------------------------------------------
        // WASENDER API
        // -------------------------------------------------

        const wasenderResponse =
          await fetch(
            "https://www.wasenderapi.com/api/send-message",
            {
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${process.env.WASENDER_API_KEY}`,

                "Content-Type":
                  "application/json",

                Accept:
                  "application/json",
              },

              body: JSON.stringify({
                to: whatsappNumber,

                text:
                  `🔐 *Cup & Saucer Login*\n\n` +
                  `Your verification code is *${otp}*.\n\n` +
                  `⏱️ This code expires in 5 minutes.\n` +
                  `🔒 Please do not share this code with anyone.`,
              }),
            }
          );

        const responseText =
          await wasenderResponse.text();

        let wasenderData = null;

        try {
          wasenderData =
            responseText
              ? JSON.parse(
                  responseText
                )
              : null;
        } catch {
          wasenderData = {
            raw:
              responseText,
          };
        }

        console.log(
          "Wasender HTTP status:",
          wasenderResponse.status
        );

        // -------------------------------------------------
        // WASENDER HTTP ERROR
        // -------------------------------------------------

        if (
          !wasenderResponse.ok
        ) {
          return res.status(502).json({
            success: false,

            message:
              "WasenderAPI failed to send OTP",

            error:
              wasenderData?.message ||
              wasenderData?.error ||
              `Wasender returned HTTP ${wasenderResponse.status}`,

            wasenderStatus:
              wasenderResponse.status,
          });
        }

        // -------------------------------------------------
        // WASENDER APPLICATION ERROR
        // -------------------------------------------------

        if (
          wasenderData &&
          wasenderData.success ===
            false
        ) {
          return res.status(502).json({
            success: false,

            message:
              "WasenderAPI rejected the OTP request",

            error:
              wasenderData?.message ||
              wasenderData?.error ||
              "WasenderAPI returned success=false",
          });
        }

        // -------------------------------------------------
        // SUCCESS
        // -------------------------------------------------

        setOtpCookie(
          res,
          otpToken
        );

        // IMPORTANT:
        // Start cooldown only AFTER
        // Wasender accepts the message.

        otpCooldowns.set(
          whatsappNumber,
          Date.now() +
            OTP_COOLDOWN_MS
        );

        return res.status(200).json({
          success: true,

          message:
            "OTP sent successfully to WhatsApp",

          cooldownSeconds: 30,

          testAccount: false,
        });
      } finally {
        otpRequestsInFlight.delete(
          whatsappNumber
        );
      }
    } catch (error) {
      console.error(
        "SEND OTP ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to send OTP",

        error:
          error.message,
      });
    }
  }
);

// =====================================================
// OTP COOLDOWN STATUS
// =====================================================

app.get(
  "/api/otp-status",
  (req, res) => {
    try {
      const whatsappNumber =
        normalizePhone(
          req.query.phone
        );

      if (!whatsappNumber) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid phone number",
        });
      }

      const cooldownUntil =
        otpCooldowns.get(
          whatsappNumber
        ) || 0;

      const remainingSeconds =
        Math.max(
          0,
          Math.ceil(
            (cooldownUntil -
              Date.now()) /
              1000
          )
        );

      if (
        remainingSeconds === 0
      ) {
        otpCooldowns.delete(
          whatsappNumber
        );
      }

      return res.status(200).json({
        success: true,

        remainingSeconds,
      });
    } catch (error) {
      console.error(
        "OTP STATUS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Unable to check OTP status",
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
      const {
        phone,
        otp,
      } = req.body || {};

      // -------------------------------------------------
      // VALIDATE
      // -------------------------------------------------

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

      const whatsappNumber =
        normalizePhone(phone);

      if (!whatsappNumber) {
        return res.status(400).json({
          success: false,

          message:
            "Invalid phone number",
        });
      }

      // -------------------------------------------------
      // GET OTP COOKIE
      // -------------------------------------------------

      const otpToken =
        getCookie(
          req,
          "otp_token"
        );

      if (!otpToken) {
        return res.status(400).json({
          success: false,

          message:
            "OTP session not found. Please request a new OTP.",
        });
      }

      // -------------------------------------------------
      // VERIFY SIGNED TOKEN
      // -------------------------------------------------

      const tokenData =
        verifyOtpToken(
          otpToken
        );

      if (!tokenData) {
        clearOtpCookie(
          res
        );

        return res.status(400).json({
          success: false,

          message:
            "OTP expired or invalid. Please request a new OTP.",
        });
      }

      // -------------------------------------------------
      // PHONE CHECK
      // -------------------------------------------------

      if (
        tokenData.phone !==
        whatsappNumber
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Phone number does not match OTP request",
        });
      }

      // -------------------------------------------------
      // OTP CHECK
      // -------------------------------------------------

      if (
        String(otp).trim() !==
        String(
          tokenData.otp
        )
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Invalid OTP",
        });
      }

      // -------------------------------------------------
      // CLEAR OTP COOKIE
      // -------------------------------------------------

      clearOtpCookie(
        res
      );

      console.log(
        "OTP verified successfully"
      );

      return res.status(200).json({
        success: true,

        message:
          "Login successful",

        phone:
          whatsappNumber,
      });
    } catch (error) {
      console.error(
        "VERIFY OTP ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "OTP verification failed",

        error:
          error.message,
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
      } = req.body || {};

      console.log(
        "RAZORPAY CREATE ORDER"
      );

      console.log(
        "Amount:",
        amount
      );

      console.log(
        "Phone:",
        phone
      );

      console.log(
        "Items:",
        items
      );

      // -------------------------------------------------
      // RAZORPAY CONFIG
      // -------------------------------------------------

      if (!razorpay) {
        return res.status(500).json({
          success: false,

          message:
            "Razorpay configuration is missing",
        });
      }

      // -------------------------------------------------
      // VALIDATE AMOUNT
      // -------------------------------------------------

      const numericAmount =
        Number(amount);

      if (
        !Number.isFinite(
          numericAmount
        ) ||
        numericAmount <= 0
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Invalid amount",
        });
      }

      // -------------------------------------------------
      // INR -> PAISE
      // -------------------------------------------------

      const amountInPaise =
        Math.round(
          numericAmount * 100
        );

      // -------------------------------------------------
      // CREATE RAZORPAY ORDER
      // -------------------------------------------------

      const order =
        await razorpay.orders.create({
          amount:
            amountInPaise,

          currency:
            "INR",

          receipt:
            "receipt_" +
            Date.now(),
        });

      console.log(
        "Razorpay order created:",
        order.id
      );

      // -------------------------------------------------
      // RETURN ORDER
      // -------------------------------------------------

      return res.status(200).json({
        success: true,

        order,

        // Public key only.
        // NEVER send the secret.

        key:
          process.env
            .RAZORPAY_KEY_ID,
      });
    } catch (error) {
      console.error(
        "RAZORPAY CREATE ORDER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Unable to create Razorpay order",

        error:
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
      } = req.body || {};

      // -------------------------------------------------
      // VALIDATE
      // -------------------------------------------------

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

      // -------------------------------------------------
      // SECRET CHECK
      // -------------------------------------------------

      if (
        !process.env
          .RAZORPAY_KEY_SECRET
      ) {
        return res.status(500).json({
          success: false,

          message:
            "Razorpay secret is missing",
        });
      }

      // -------------------------------------------------
      // CREATE EXPECTED SIGNATURE
      // -------------------------------------------------

      const generatedSignature =
        crypto
          .createHmac(
            "sha256",
            process.env
              .RAZORPAY_KEY_SECRET
          )
          .update(
            razorpay_order_id +
              "|" +
              razorpay_payment_id
          )
          .digest("hex");

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

      // -------------------------------------------------
      // SAFE COMPARISON
      // -------------------------------------------------

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

      // -------------------------------------------------
      // PAYMENT VERIFIED
      // -------------------------------------------------

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
        "RAZORPAY VERIFY ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Payment verification error",

        error:
          error.message,
      });
    }
  }
);

// =====================================================
// LOCAL DEVELOPMENT
// =====================================================

if (
  require.main === module
) {
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
// VERCEL / SERVERLESS
// =====================================================

module.exports = app;