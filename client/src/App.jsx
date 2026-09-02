import { useState } from "react";
import "./App.css";

// =====================================================
// API CONFIGURATION
// =====================================================
//
// Vercel Environment Variable:
//
// VITE_API_URL=https://api.kqphfa.store
//
// Production API:
// https://api.kqphfa.store
//
// The trailing slash is removed automatically so that
// API calls don't become:
// https://api.kqphfa.store//api/send-otp
// =====================================================

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "https://api.kqphfa.store"
).replace(/\/+$/, "");

// =====================================================
// RAZORPAY PUBLIC KEY
// =====================================================
//
// Vercel Environment Variable:
//
// VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx
//
// IMPORTANT:
// NEVER put RAZORPAY_KEY_SECRET in this frontend.
// =====================================================

const RAZORPAY_KEY_ID =
  import.meta.env.VITE_RAZORPAY_KEY_ID;

// =====================================================
// PRODUCTS
// =====================================================

const products = [
  {
    id: 1,
    name: "Product One",
    price: 1,
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 2,
    name: "Product Two",
    price: 2,
    image:
      "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=600&q=80",
  },
];

// =====================================================
// APP
// =====================================================

function App() {
  // =====================================================
  // LOGIN STATE
  // =====================================================

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  const [otpSent, setOtpSent] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const [loginLoading, setLoginLoading] =
    useState(false);

  const [loginMessage, setLoginMessage] =
    useState("");

  // =====================================================
  // CART STATE
  // =====================================================

  const [cart, setCart] = useState([]);

  // =====================================================
  // PAYMENT STATE
  // =====================================================

  const [paymentLoading, setPaymentLoading] =
    useState(false);

  const [paymentStatus, setPaymentStatus] =
    useState("");

  // =====================================================
  // SEND OTP
  // =====================================================

  const sendOTP = async () => {
    const cleanPhone = phone.trim();

    if (!cleanPhone) {
      setLoginMessage(
        "Please enter your WhatsApp number"
      );
      return;
    }

    setLoginLoading(true);
    setLoginMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/send-otp`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            phone: cleanPhone,
          }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setPhone(cleanPhone);

        setOtpSent(true);

        setLoginMessage(
          "OTP sent to your WhatsApp"
        );
      } else {
        setLoginMessage(
          data.message ||
            "Failed to send OTP"
        );
      }
    } catch (error) {
      console.error(
        "Send OTP error:",
        error
      );

      setLoginMessage(
        "Cannot connect to server"
      );
    } finally {
      setLoginLoading(false);
    }
  };

  // =====================================================
  // VERIFY OTP
  // =====================================================

  const verifyOTP = async () => {
    const cleanPhone = phone.trim();
    const cleanOtp = otp.trim();

    if (!cleanOtp) {
      setLoginMessage(
        "Please enter the OTP"
      );
      return;
    }

    setLoginLoading(true);
    setLoginMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/verify-otp`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            phone: cleanPhone,
            otp: cleanOtp,
          }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setLoggedIn(true);

        setLoginMessage(
          "Login successful!"
        );
      } else {
        setLoginMessage(
          data.message ||
            "Invalid OTP"
        );
      }
    } catch (error) {
      console.error(
        "Verify OTP error:",
        error
      );

      setLoginMessage(
        "Cannot connect to server"
      );
    } finally {
      setLoginLoading(false);
    }
  };

  // =====================================================
  // LOGOUT
  // =====================================================

  const handleLogout = () => {
    setLoggedIn(false);

    setPhone("");
    setOtp("");

    setOtpSent(false);

    setLoginLoading(false);
    setLoginMessage("");

    setCart([]);

    setPaymentLoading(false);
    setPaymentStatus("");
  };

  // =====================================================
  // ADD TO CART
  // =====================================================

  const addToCart = (product) => {
    setCart((currentCart) => {
      const existing =
        currentCart.find(
          (item) =>
            item.id === product.id
        );

      if (existing) {
        return currentCart.map(
          (item) =>
            item.id === product.id
              ? {
                  ...item,
                  quantity:
                    item.quantity + 1,
                }
              : item
        );
      }

      return [
        ...currentCart,
        {
          ...product,
          quantity: 1,
        },
      ];
    });
  };

  // =====================================================
  // REMOVE FROM CART
  // =====================================================

  const removeFromCart = (id) => {
    setCart((currentCart) =>
      currentCart.filter(
        (item) => item.id !== id
      )
    );
  };

  // =====================================================
  // INCREASE QUANTITY
  // =====================================================

  const increaseQuantity = (id) => {
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity:
                item.quantity + 1,
            }
          : item
      )
    );
  };

  // =====================================================
  // DECREASE QUANTITY
  // =====================================================

  const decreaseQuantity = (id) => {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === id
            ? {
                ...item,
                quantity:
                  item.quantity - 1,
              }
            : item
        )
        .filter(
          (item) => item.quantity > 0
        )
    );
  };

  // =====================================================
  // TOTAL
  // =====================================================

  const total = cart.reduce(
    (sum, item) =>
      sum +
      item.price * item.quantity,
    0
  );

  // =====================================================
  // LOAD RAZORPAY
  // =====================================================

  const loadRazorpay = () => {
    return new Promise(
      (resolve) => {
        if (window.Razorpay) {
          resolve(true);
          return;
        }

        const existingScript =
          document.querySelector(
            'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
          );

        if (existingScript) {
          existingScript.addEventListener(
            "load",
            () => resolve(true)
          );

          existingScript.addEventListener(
            "error",
            () => resolve(false)
          );

          return;
        }

        const script =
          document.createElement(
            "script"
          );

        script.src =
          "https://checkout.razorpay.com/v1/checkout.js";

        script.async = true;

        script.onload = () =>
          resolve(true);

        script.onerror = () =>
          resolve(false);

        document.body.appendChild(
          script
        );
      }
    );
  };

  // =====================================================
  // PAYMENT
  // =====================================================

  const handlePayment = async () => {
    if (!loggedIn) {
      alert(
        "Please login first"
      );
      return;
    }

    if (cart.length === 0) {
      alert(
        "Please add a product"
      );
      return;
    }

    if (!RAZORPAY_KEY_ID) {
      setPaymentStatus(
        "Razorpay Key ID is missing. Add VITE_RAZORPAY_KEY_ID in Vercel."
      );
      return;
    }

    setPaymentLoading(true);
    setPaymentStatus("");

    try {
      // =================================================
      // LOAD RAZORPAY
      // =================================================

      const razorpayLoaded =
        await loadRazorpay();

      if (!razorpayLoaded) {
        setPaymentStatus(
          "Razorpay SDK failed to load"
        );

        setPaymentLoading(false);

        return;
      }

      // =================================================
      // CREATE ORDER
      // =================================================

      const response =
        await fetch(
          `${API_URL}/api/create-order`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              amount: total,

              phone: phone.trim(),

              items: cart.map(
                (item) => ({
                  id: item.id,

                  name: item.name,

                  price: item.price,

                  quantity:
                    item.quantity,
                })
              ),
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        setPaymentStatus(
          data.message ||
            "Unable to create order"
        );

        setPaymentLoading(false);

        return;
      }

      const order =
        data.order;

      if (!order || !order.id) {
        setPaymentStatus(
          "Invalid order received from server"
        );

        setPaymentLoading(false);

        return;
      }

      // =================================================
      // RAZORPAY OPTIONS
      // =================================================

      const options = {
        key:
          data.key ||
          RAZORPAY_KEY_ID,

        amount:
          order.amount,

        currency:
          order.currency,

        name:
          "My MERN Store",

        description:
          "Product Purchase",

        order_id:
          order.id,

        prefill: {
          contact:
            phone.trim(),
        },

        notes: {
          phone:
            phone.trim(),
        },

        theme: {
          color:
            "#2563eb",
        },

        // =================================================
        // PAYMENT SUCCESS
        // =================================================

        handler:
          async function (
            razorpayResponse
          ) {
            try {
              setPaymentStatus(
                "Verifying payment..."
              );

              // =========================================
              // VERIFY PAYMENT
              // =========================================

              const verifyResponse =
                await fetch(
                  `${API_URL}/api/verify-payment`,
                  {
                    method: "POST",

                    headers: {
                      "Content-Type":
                        "application/json",
                    },

                    body:
                      JSON.stringify(
                        razorpayResponse
                      ),
                  }
                );

              const verifyData =
                await verifyResponse.json();

              if (
                verifyResponse.ok &&
                verifyData.success
              ) {
                setPaymentStatus(
                  `Payment successful! Payment ID: ${
                    verifyData.paymentId
                  }`
                );

                setCart([]);
              } else {
                setPaymentStatus(
                  verifyData.message ||
                    "Payment verification failed"
                );
              }
            } catch (error) {
              console.error(
                "Payment verification error:",
                error
              );

              setPaymentStatus(
                "Payment verification failed"
              );
            } finally {
              setPaymentLoading(
                false
              );
            }
          },

        // =================================================
        // RAZORPAY CLOSE
        // =================================================

        modal: {
          ondismiss:
            function () {
              console.log(
                "Razorpay checkout closed"
              );

              setPaymentLoading(
                false
              );

              setPaymentStatus("");
            },
        },
      };

      // =================================================
      // CREATE RAZORPAY INSTANCE
      // =================================================

      const razorpay =
        new window.Razorpay(
          options
        );

      // =================================================
      // PAYMENT FAILED
      // =================================================

      razorpay.on(
        "payment.failed",
        function (response) {
          console.error(
            "Razorpay payment failed:",
            response?.error
          );

          setPaymentStatus(
            response?.error
              ?.description ||
              "Payment failed"
          );

          setPaymentLoading(
            false
          );
        }
      );

      // =================================================
      // OPEN RAZORPAY
      // =================================================

      razorpay.open();
    } catch (error) {
      console.error(
        "Payment error:",
        error
      );

      setPaymentStatus(
        "Something went wrong"
      );

      setPaymentLoading(false);
    }
  };

  // =====================================================
  // LOGIN PAGE
  // =====================================================

  if (!loggedIn) {
    return (
      <div className="login-page">

        <div className="login-card">

          <div className="login-logo">
            M
          </div>

          <h2>
            WhatsApp Login
          </h2>

          <p>
            Login securely using
            your WhatsApp number
          </p>

          {!otpSent ? (
            <>
              <div className="input-label">
                WhatsApp Number
              </div>

              <input
                type="tel"
                placeholder="9876543210"
                value={phone}
                onChange={(e) =>
                  setPhone(
                    e.target.value
                  )
                }
                disabled={
                  loginLoading
                }
              />

              <button
                onClick={sendOTP}
                disabled={
                  loginLoading
                }
              >
                {loginLoading
                  ? "Sending..."
                  : "Send OTP"}
              </button>
            </>
          ) : (
            <>
              <div className="otp-info">

                <span>
                  OTP sent to
                </span>

                <strong>
                  {phone}
                </strong>

              </div>

              <div className="input-label">
                Enter OTP
              </div>

              <input
                type="text"
                inputMode="numeric"
                maxLength="6"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) =>
                  setOtp(
                    e.target.value.replace(
                      /\D/g,
                      ""
                    )
                  )
                }
                disabled={
                  loginLoading
                }
              />

              <button
                onClick={
                  verifyOTP
                }
                disabled={
                  loginLoading
                }
              >
                {loginLoading
                  ? "Verifying..."
                  : "Verify & Login"}
              </button>

              <button
                className="secondary-button"
                onClick={() => {
                  setOtpSent(
                    false
                  );

                  setOtp("");

                  setLoginMessage(
                    ""
                  );
                }}
                disabled={
                  loginLoading
                }
              >
                Change Number
              </button>
            </>
          )}

          {loginMessage && (
            <p className="message">
              {loginMessage}
            </p>
          )}

          <div className="login-footer">
            Secure WhatsApp authentication
          </div>

        </div>

      </div>
    );
  }

  // =====================================================
  // STORE PAGE
  // =====================================================

  return (
    <div className="app">

      {/* =================================================
          HEADER
      ================================================= */}

      <header className="header">

        <div className="header-brand">

          <div className="header-logo">
            M
          </div>

          <div>

            <h1>
              My MERN Store
            </h1>

            <p>
              Logged in with{" "}
              {phone}
            </p>

          </div>

        </div>

        <div className="header-actions">

          <div className="cart-count">
            🛒 Cart{" "}
            <span>
              {cart.reduce(
                (sum, item) =>
                  sum +
                  item.quantity,
                0
              )}
            </span>
          </div>

          <button
            className="logout-button"
            onClick={
              handleLogout
            }
          >
            Logout
          </button>

        </div>

      </header>

      {/* =================================================
          MAIN
      ================================================= */}

      <main>

        {/* =================================================
            PRODUCTS
        ================================================= */}

        <section className="products">

          <div className="section-heading">

            <div>

              <span className="eyebrow">
                OUR PRODUCTS
              </span>

              <h2>
                Choose your product
              </h2>

              <p>
                Simple products,
                simple checkout.
              </p>

            </div>

          </div>

          <div className="product-grid">

            {products.map(
              (product) => (
                <div
                  className="product-card"
                  key={
                    product.id
                  }
                >

                  <div className="product-image-wrapper">

                    <img
                      src={
                        product.image
                      }
                      alt={
                        product.name
                      }
                    />

                    <span className="product-badge">
                      NEW
                    </span>

                  </div>

                  <div className="product-content">

                    <h3>
                      {product.name}
                    </h3>

                    <div className="product-bottom">

                      <p className="price">
                        ₹
                        {
                          product.price
                        }
                      </p>

                      <button
                        onClick={() =>
                          addToCart(
                            product
                          )
                        }
                      >
                        Add to Cart
                      </button>

                    </div>

                  </div>

                </div>
              )
            )}

          </div>

        </section>

        {/* =================================================
            CART
        ================================================= */}

        <section className="cart">

          <div className="cart-heading">

            <div>

              <span className="eyebrow">
                YOUR ORDER
              </span>

              <h2>
                Shopping Cart
              </h2>

            </div>

            {cart.length > 0 && (
              <span className="cart-items-label">

                {cart.reduce(
                  (sum, item) =>
                    sum +
                    item.quantity,
                  0
                )}{" "}
                items

              </span>
            )}

          </div>

          {cart.length === 0 ? (
            <div className="empty-cart">

              <div className="empty-cart-icon">
                🛒
              </div>

              <h3>
                Your cart is empty
              </h3>

              <p>
                Add a product above
                to start shopping.
              </p>

            </div>
          ) : (
            <>

              <div className="cart-list">

                {cart.map(
                  (item) => (
                    <div
                      className="cart-item"
                      key={item.id}
                    >

                      <div className="cart-product">

                        <img
                          src={
                            item.image
                          }
                          alt={
                            item.name
                          }
                        />

                        <div>

                          <strong>
                            {item.name}
                          </strong>

                          <p>
                            ₹
                            {
                              item.price
                            }{" "}
                            each
                          </p>

                        </div>

                      </div>

                      <div className="quantity">

                        <button
                          onClick={() =>
                            decreaseQuantity(
                              item.id
                            )
                          }
                        >
                          −
                        </button>

                        <span>
                          {
                            item.quantity
                          }
                        </span>

                        <button
                          onClick={() =>
                            increaseQuantity(
                              item.id
                            )
                          }
                        >
                          +
                        </button>

                      </div>

                      <div className="item-total">

                        ₹
                        {item.price *
                          item.quantity}

                      </div>

                      <button
                        className="remove"
                        onClick={() =>
                          removeFromCart(
                            item.id
                          )
                        }
                      >
                        Remove
                      </button>

                    </div>
                  )
                )}

              </div>

              {/* =================================================
                  CHECKOUT
              ================================================= */}

              <div className="checkout">

                <div className="total">

                  <span>
                    Total
                  </span>

                  <strong>
                    ₹{total}
                  </strong>

                </div>

                <button
                  className="pay-button"
                  onClick={
                    handlePayment
                  }
                  disabled={
                    paymentLoading
                  }
                >
                  {paymentLoading
                    ? "Processing..."
                    : `Pay ₹${total} with Razorpay`}
                </button>

                <p className="secure-payment">
                  🔒 Secure payment powered
                  by Razorpay
                </p>

              </div>

            </>
          )}

          {paymentStatus && (
            <div className="status">
              {paymentStatus}
            </div>
          )}

        </section>

      </main>

    </div>
  );
}

export default App;