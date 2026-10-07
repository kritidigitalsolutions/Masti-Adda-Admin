const fs = require("fs");
const path = require("path");

function buildCollection() {
  const collection = {
    info: {
      _postman_id: "masti-adda-collection-v1",
      name: "Masti Adda OTT - Complete API Collection",
      description: "Complete Postman collection for Masti Adda backend APIs. Includes Admin Auth, User Auth, Movies, Series, Episodes, Microdramas, AI Reels, Watch Progress, Watchlist, Interactions, Payments, and Settings.",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    variable: [
      { key: "baseUrl", value: "http://localhost:5000", type: "string" },
      { key: "adminToken", value: "", type: "string" },
      { key: "userToken", value: "", type: "string" }
    ],
    item: []
  };

  const createReq = (name, method, endpoint, opts = {}) => {
    const { authType = "none", body = null, description = "", query = [] } = opts;
    const headers = [];

    if (body) {
      headers.push({ key: "Content-Type", value: "application/json" });
    }

    if (authType === "admin") {
      headers.push({ key: "Authorization", value: "Bearer {{adminToken}}" });
    } else if (authType === "user") {
      headers.push({ key: "Authorization", value: "Bearer {{userToken}}" });
    }

    const pathParts = endpoint.replace(/^\//, "").split("/");
    const fullRawUrl = query.length > 0
      ? `{{baseUrl}}/${endpoint.replace(/^\//, "")}?${query.map(q => `${q.key}=${encodeURIComponent(q.value)}`).join("&")}`
      : `{{baseUrl}}/${endpoint.replace(/^\//, "")}`;

    const requestObj = {
      name,
      request: {
        method,
        header: headers,
        url: {
          raw: fullRawUrl,
          host: ["{{baseUrl}}"],
          path: pathParts,
          ...(query.length > 0 && { query: query.map(q => ({ key: q.key, value: String(q.value) })) })
        },
        description
      }
    };

    if (body) {
      requestObj.request.body = {
        mode: "raw",
        raw: typeof body === "string" ? body : JSON.stringify(body, null, 2),
        options: { raw: { language: "json" } }
      };
    }

    if (opts.event) {
      requestObj.event = opts.event;
    }

    return requestObj;
  };

  // 1. ADMIN AUTH
  const adminAuthFolder = {
    name: "1. Admin Auth",
    item: [
      createReq("Admin Login (Auto-saves adminToken)", "POST", "/api/admin/auth/login", {
        body: {
          email: "prismmedianet1@gmail.com",
          password: "123456"
        },
        event: [
          {
            listen: "test",
            script: {
              type: "text/javascript",
              exec: [
                "var jsonData = pm.response.json();",
                "if (jsonData.token) {",
                "    pm.collectionVariables.set('adminToken', jsonData.token);",
                "    console.log('adminToken saved successfully');",
                "}"
              ]
            }
          }
        ]
      }),
      createReq("Get Admin Profile", "GET", "/api/admin/auth/profile", {
        authType: "admin"
      }),
      createReq("Send Forgot Password OTP", "POST", "/api/admin/auth/send-otp", {
        body: { email: "prismmedianet1@gmail.com" }
      }),
      createReq("Verify Forgot Password OTP", "POST", "/api/admin/auth/verify-otp", {
        body: { email: "prismmedianet1@gmail.com", otp: "123456" }
      }),
      createReq("Reset Forgot Password", "POST", "/api/admin/auth/reset-password", {
        body: {
          email: "prismmedianet1@gmail.com",
          otp: "123456",
          newPassword: "newpassword123"
        }
      }),
      createReq("Change Password Send OTP", "POST", "/api/admin/auth/change-password/send-otp", {
        authType: "admin"
      }),
      createReq("Change Password", "POST", "/api/admin/auth/change-password", {
        authType: "admin",
        body: {
          currentPassword: "123456",
          newPassword: "newPassword123!",
          otp: "123456"
        }
      })
    ]
  };

  // 2. USER AUTH
  const userAuthFolder = {
    name: "2. User Auth",
    item: [
      createReq("Send OTP (Mobile)", "POST", "/api/auth/send-otp", {
        body: { phone: "+919999999999" },
        description: "For testing, +919999999999 uses fixed dummy OTP '1234'"
      }),
      createReq("Verify OTP (Auto-saves userToken)", "POST", "/api/auth/verify-otp", {
        body: {
          phone: "+919999999999",
          otp: "1234"
        },
        event: [
          {
            listen: "test",
            script: {
              type: "text/javascript",
              exec: [
                "var jsonData = pm.response.json();",
                "if (jsonData.token) {",
                "    pm.collectionVariables.set('userToken', jsonData.token);",
                "    console.log('userToken saved successfully');",
                "}"
              ]
            }
          }
        ]
      }),
      createReq("Google Login", "POST", "/api/auth/google-login", {
        body: { idToken: "FIREBASE_OR_GOOGLE_ID_TOKEN" }
      }),
      createReq("Website Login", "POST", "/api/auth/website-login", {
        body: { token: "{{userToken}}" }
      }),
      createReq("Logout", "POST", "/api/auth/logout", {
        authType: "user"
      })
    ]
  };

  // 3. ADMIN - MOVIES
  const adminMoviesFolder = {
    name: "3. Admin - Movies",
    item: [
      createReq("Get All Movies (Admin)", "GET", "/api/admin/movies", {
        authType: "admin",
        query: [{ key: "page", value: "1" }, { key: "limit", value: "10" }]
      }),
      createReq("Get Movie By ID (Admin)", "GET", "/api/admin/movies/:movieId", {
        authType: "admin"
      }),
      createReq("Add Movie (JSON / CDN URLs)", "POST", "/api/admin/movies/add", {
        authType: "admin",
        body: {
          title: "Inception Test",
          description: "A thief who steals corporate secrets through dream-sharing technology.",
          genre: JSON.stringify(["Sci-Fi", "Action"]),
          category: JSON.stringify(["Hollywood", "Trending"]),
          releaseYear: 2010,
          duration: "148 mins",
          language: "English",
          poster: "https://placehold.co/400x600.png",
          banner: "https://placehold.co/1200x600.png",
          trailerUrl: "https://www.youtube.com/watch?v=YoHD9XEInc0",
          videoUrl: "https://vz-3689aab6-c39.b-cdn.net/example/playlist.m3u8",
          isComingSoon: "false",
          priority: 1
        }
      }),
      createReq("Update Movie (Admin)", "PATCH", "/api/admin/movies/:movieId", {
        authType: "admin",
        body: {
          title: "Inception Test (Updated)",
          description: "Updated movie description"
        }
      }),
      createReq("Delete Movie (Admin)", "DELETE", "/api/admin/movies/:movieId", {
        authType: "admin"
      }),
      createReq("Search Movies (Admin)", "GET", "/api/admin/movies/search", {
        authType: "admin",
        query: [{ key: "query", value: "Inception" }]
      })
    ]
  };

  // 4. ADMIN - SERIES & EPISODES
  const adminSeriesFolder = {
    name: "4. Admin - Series & Episodes",
    item: [
      createReq("Get All Series", "GET", "/api/admin/series", {
        authType: "admin",
        query: [{ key: "page", value: "1" }, { key: "limit", value: "10" }]
      }),
      createReq("Get Series By ID", "GET", "/api/admin/series/:seriesId", {
        authType: "admin"
      }),
      createReq("Add Series", "POST", "/api/admin/series/add", {
        authType: "admin",
        body: {
          title: "Dark Mystery Series",
          description: "A mystery web series thriller.",
          genre: JSON.stringify(["Mystery", "Thriller"]),
          category: JSON.stringify(["Web Series"]),
          releaseYear: 2024,
          language: "Hindi",
          poster: "https://placehold.co/400x600.png",
          banner: "https://placehold.co/1200x600.png"
        }
      }),
      createReq("Update Series", "PATCH", "/api/admin/series/:seriesId", {
        authType: "admin",
        body: { title: "Dark Mystery Series (Updated)" }
      }),
      createReq("Delete Series", "DELETE", "/api/admin/series/:seriesId", {
        authType: "admin"
      }),
      createReq("Get Episodes By Series", "GET", "/api/admin/episodes/:seriesId", {
        authType: "admin"
      }),
      createReq("Add Episode to Series", "POST", "/api/admin/episodes/add", {
        authType: "admin",
        body: {
          seriesId: ":seriesId",
          title: "Episode 1: The Beginning",
          episodeNumber: 1,
          seasonNumber: 1,
          description: "First episode pilot",
          duration: "45 mins",
          videoUrl: "https://vz-3689aab6-c39.b-cdn.net/example/playlist.m3u8",
          poster: "https://placehold.co/400x600.png"
        }
      })
    ]
  };

  // 5. ADMIN - MICRODRAMAS
  const adminMicrodramasFolder = {
    name: "5. Admin - Microdramas",
    item: [
      createReq("Get All Microdramas", "GET", "/api/admin/microdramas", {
        authType: "admin"
      }),
      createReq("Get Microdrama By ID", "GET", "/api/admin/microdramas/:microdramaId", {
        authType: "admin"
      }),
      createReq("Add Microdrama", "POST", "/api/admin/microdramas/add", {
        authType: "admin",
        body: {
          title: "Billionaire Secret Heir",
          description: "Short vertical drama series.",
          genre: JSON.stringify(["Romance", "Drama"]),
          poster: "https://placehold.co/400x600.png"
        }
      }),
      createReq("Get Microdrama Episodes", "GET", "/api/admin/microdramas-episodes/:microdramaId", {
        authType: "admin"
      }),
      createReq("Add Microdrama Episode", "POST", "/api/admin/microdramas-episodes/add", {
        authType: "admin",
        body: {
          microdramaId: ":microdramaId",
          title: "Ep 1",
          episodeNumber: 1,
          videoUrl: "https://vz-3689aab6-c39.b-cdn.net/example/playlist.m3u8"
        }
      })
    ]
  };

  // 6. ADMIN - CATEGORIES, PLANS & PROMO
  const adminPlansCategoriesFolder = {
    name: "6. Admin - Categories, Plans & Promos",
    item: [
      createReq("Get All Categories", "GET", "/api/admin/categories", { authType: "admin" }),
      createReq("Create Category", "POST", "/api/admin/categories", {
        authType: "admin",
        body: {
          name: "Action Blockbusters",
          type: "movies",
          sortOrder: 1,
          isActive: true
        }
      }),
      createReq("Get All Plans", "GET", "/api/admin/plan", { authType: "admin" }),
      createReq("Create Plan", "POST", "/api/admin/plan", {
        authType: "admin",
        body: {
          name: "Premium Annual Plan",
          price: 999,
          duration: 365,
          planType: "yearly",
          features: ["Ultra HD 4K", "No Ads", "4 Screens"],
          isRecommended: true,
          isActive: true
        }
      }),
      createReq("Update Plan", "PATCH", "/api/admin/plan/:planId", {
        authType: "admin",
        body: { price: 899 }
      }),
      createReq("Get All Promos", "GET", "/api/admin/promo", { authType: "admin" }),
      createReq("Create Promo Code", "POST", "/api/admin/promo", {
        authType: "admin",
        body: {
          code: "WELCOME50",
          discountType: "percentage",
          discountValue: 50,
          maxUses: 1000,
          expiryDate: "2027-12-31T23:59:59.000Z",
          isActive: true
        }
      }),
      createReq("Get All Vouchers", "GET", "/api/admin/voucher", { authType: "admin" }),
      createReq("Generate Vouchers", "POST", "/api/admin/voucher", {
        authType: "admin",
        body: {
          planId: ":planId",
          count: 5,
          durationDays: 30
        }
      })
    ]
  };

  // 7. USER - BROWSING (MOVIES, SERIES, MICRODRAMAS)
  const userBrowsingFolder = {
    name: "7. User - Public Content Browsing",
    item: [
      createReq("Get Movies (User/Public)", "GET", "/api/movies", {
        query: [{ key: "page", value: "1" }, { key: "limit", value: "12" }]
      }),
      createReq("Get Movie Details By ID", "GET", "/api/movies/:movieId"),
      createReq("Get Series (User/Public)", "GET", "/api/series", {
        query: [{ key: "page", value: "1" }, { key: "limit", value: "12" }]
      }),
      createReq("Get Series Details By ID", "GET", "/api/series/:seriesId"),
      createReq("Get Series Episodes", "GET", "/api/episodes/:seriesId"),
      createReq("Get Microdramas (User/Public)", "GET", "/api/microdramas"),
      createReq("Get Microdrama Episodes", "GET", "/api/microdramas-episodes/:microdramaId"),
      createReq("Get AI Reels", "GET", "/api/ai-reels"),
      createReq("Get Home Banners", "GET", "/api/home-banners"),
      createReq("Get Intro Screens", "GET", "/api/intro-screens"),
      createReq("Get Categories (User)", "GET", "/api/categories")
    ]
  };

  // 8. USER - WATCH PROGRESS & CONTINUE WATCHING
  const userWatchProgressFolder = {
    name: "8. User - Watch Progress & Continue Watching",
    item: [
      createReq("Save Watch Progress", "POST", "/api/continue-watching", {
        authType: "user",
        body: {
          contentId: ":movieIdOrSeriesId",
          contentType: "movie",
          progressSeconds: 320,
          durationSeconds: 7200,
          completed: false
        }
      }),
      createReq("Get Continue Watching List", "GET", "/api/continue-watching", {
        authType: "user"
      }),
      createReq("Get Progress for Specific Content", "GET", "/api/continue-watching/progress/:contentId", {
        authType: "user"
      }),
      createReq("Mark Watch Progress Completed", "PATCH", "/api/continue-watching/complete/:progressId", {
        authType: "user"
      }),
      createReq("Remove from Continue Watching", "DELETE", "/api/continue-watching/:progressId", {
        authType: "user"
      })
    ]
  };

  // 9. USER - WATCHLIST
  const userWatchlistFolder = {
    name: "9. User - Watchlist",
    item: [
      createReq("Get Watchlist", "GET", "/api/watchlist", {
        authType: "user"
      }),
      createReq("Add to Watchlist", "POST", "/api/watchlist", {
        authType: "user",
        body: {
          itemId: ":contentId"
        }
      }),
      createReq("Remove from Watchlist", "DELETE", "/api/watchlist/:watchlistId", {
        authType: "user"
      })
    ]
  };

  // 10. USER - INTERACTIONS (LIKE, DISLIKE, FOLLOW, BOOKMARK)
  const userInteractionsFolder = {
    name: "10. User - Interactions (Like, Dislike, Follow)",
    item: [
      createReq("Toggle Like", "POST", "/api/interaction/toggle/like/:contentId", {
        authType: "user"
      }),
      createReq("Toggle Dislike", "POST", "/api/interaction/toggle/dislike/:contentId", {
        authType: "user"
      }),
      createReq("Toggle Follow User", "POST", "/api/interaction/toggle/follow/:userId", {
        authType: "user"
      }),
      createReq("Get Content Interaction Stats", "GET", "/api/interaction/stats/:contentId", {
        authType: "user",
        description: "Pass userToken for personal interaction status (userInteraction and isBookmarked)"
      }),
      createReq("Get User Follow Stats", "GET", "/api/interaction/follow/:userId"),
      createReq("Toggle Bookmark", "POST", "/api/interaction/toggle/bookmark/:contentId", {
        authType: "user"
      }),
      createReq("Get All Bookmarks", "GET", "/api/interaction/bookmarks", {
        authType: "user"
      })
    ]
  };

  // 11. USER - COMMENTS
  const userCommentsFolder = {
    name: "11. User - Comments",
    item: [
      createReq("Get Comments for Content", "GET", "/api/comments/:contentId"),
      createReq("Post a Comment", "POST", "/api/comments/:contentId", {
        authType: "user",
        body: {
          text: "Amazing movie, highly recommended!",
          contentType: "movie"
        }
      }),
      createReq("Update Comment", "PATCH", "/api/comments/:commentId", {
        authType: "user",
        body: {
          text: "Updated comment text"
        }
      }),
      createReq("Delete Comment", "DELETE", "/api/comments/:commentId", {
        authType: "user"
      }),
      createReq("Get My Comments", "GET", "/api/comments/user/me", {
        authType: "user"
      })
    ]
  };

  // 12. PLANS, PROMO, VOUCHER & PAYMENT
  const userPaymentFolder = {
    name: "12. Plans, Promo, Voucher & SabPaisa Payment",
    item: [
      createReq("Get Available Plans", "GET", "/api/plans"),
      createReq("Apply Promo Code", "POST", "/api/promo/apply", {
        body: {
          code: "WELCOME50",
          planId: ":planId"
        }
      }),
      createReq("Redeem Voucher", "POST", "/api/voucher/redeem", {
        authType: "user",
        body: {
          code: "VOUCHER-XXXX"
        }
      }),
      createReq("Initiate SabPaisa Payment", "POST", "/api/payment/initiate", {
        authType: "user",
        body: {
          planId: ":planId",
          promoCode: "WELCOME50",
          userName: "Test User",
          userEmail: "testuser@gmail.com",
          userContact: "9999999999"
        }
      }),
      createReq("Check Payment Status", "GET", "/api/payment/status/:clientTxnId", {
        authType: "user"
      }),
      createReq("Get User Subscription", "GET", "/api/subscription", {
        authType: "user"
      })
    ]
  };

  // 13. USER PROFILE & SETTINGS
  const userProfileFolder = {
    name: "13. User - Profile & Settings",
    item: [
      createReq("Get Profile", "GET", "/api/user/profile", {
        authType: "user"
      }),
      createReq("Update Profile", "PATCH", "/api/user/update-profile", {
        authType: "user",
        body: {
          name: "Updated Name",
          email: "user@example.com"
        }
      }),
      createReq("Save FCM Push Token", "PATCH", "/api/user/fcm-token", {
        authType: "user",
        body: {
          fcmToken: "SAMPLE_FCM_DEVICE_TOKEN_HERE"
        }
      }),
      createReq("Get Notification Settings", "GET", "/api/notification-settings", {
        authType: "user"
      }),
      createReq("Update Notification Settings", "PATCH", "/api/notification-settings", {
        authType: "user",
        body: {
          pushEnabled: true,
          emailEnabled: true,
          promotions: false
        }
      }),
      createReq("Get User Notifications", "GET", "/api/notifications", {
        authType: "user"
      })
    ]
  };

  // 14. SUPPORT, LEGAL & COMPANY
  const supportLegalFolder = {
    name: "14. Support, Legal & Company Info",
    item: [
      createReq("Get Company Info", "GET", "/api/companyInfo"),
      createReq("Get Legal Pages (Terms / Privacy)", "GET", "/api/legal"),
      createReq("Get Help / FAQs", "GET", "/api/help"),
      createReq("Submit Support Ticket", "POST", "/api/support", {
        body: {
          name: "John Doe",
          email: "john@example.com",
          subject: "Issue with playback",
          message: "Unable to play episode 2 on mobile app"
        }
      })
    ]
  };

  collection.item.push(
    adminAuthFolder,
    userAuthFolder,
    adminMoviesFolder,
    adminSeriesFolder,
    adminMicrodramasFolder,
    adminPlansCategoriesFolder,
    userBrowsingFolder,
    userWatchProgressFolder,
    userWatchlistFolder,
    userInteractionsFolder,
    userCommentsFolder,
    userPaymentFolder,
    userProfileFolder,
    supportLegalFolder
  );

  return collection;
}

const outputPath = path.resolve(__dirname, "../../Masti_Adda_Postman_Collection.json");
const data = buildCollection();
fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf8");
console.log(`✅ Postman Collection generated successfully at: ${outputPath}`);
