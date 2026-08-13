# 🛒 DigiMart — Intelligent Recommendation & Demand Forecasting System

An intelligent system for DigiMart that combines a **Content-Based Recommendation Engine** with **ARIMA-based Time Series Forecasting** to deliver personalized product suggestions and data-driven sales predictions.

## 📖 Overview

DigiMart integrates two core intelligent components:

- A **recommendation system** that analyzes product attributes and user interaction data to generate personalized suggestions
- A **forecasting model** that analyzes historical sales data to predict future revenue and product demand

Together, these components help improve customer experience through relevant recommendations while supporting operational and strategic decisions through accurate demand prediction.

## 🎯 Content-Based Recommendation System

Generates personalized product recommendations by building a user profile from interaction history and scoring candidate products against it.

**How it works:**
1. **🧾 Check User Activity** — no activity falls back to an Explore Mode showing the latest products; active users get a profile built from their cart, views, and purchase history
2. **👤 Build User Profile** — aggregates recent interactions, extracts features from product descriptions, and compiles average price, average rating, categories, and brands
3. **📦 Score Every Product** — combines two similarity components:
   - **Traditional Similarity (40%)** — category match, brand match, price similarity, rating similarity
   - **Description Similarity (60%)** — deep feature matching against extracted product attributes
4. **🏆 Rank & Paginate** — products are sorted by final similarity score, ranked, and returned with a full scoring breakdown

```
Final Score = 0.40 × Traditional Similarity + 0.60 × Description Similarity
```

Recommendations are served in two modes:
- **🏠 Home Page** — diverse suggestions from full interaction history
- **📱 Product Page** — similar items based on a single product's context

## 📈 ARIMA Time Series Forecasting

Predicts future revenue and product demand from historical sales data using a validated ARIMA pipeline.

**How it works:**
1. **📊 Load & Prepare Data** — aggregates daily sales and smooths noise with a 3-day rolling average
2. **🔧 Preprocess** — applies log transformation, extracts trend via 7-day moving average, and standardizes residuals
3. **🎛️ Tune Parameters** — searches (p, d, q) combinations and selects the best fit via approximate AIC
4. **✅ Train-Test Validation** — 75/25 split with MAE, RMSE, and MAPE evaluation
5. **🔮 Forecast** — retrains on full data and projects revenue and demand 7–15 days ahead
6. **🗂️ Category-Level Forecasts** — separate models per product category, with unreliable categories filtered out

## 📊 Results

**ARIMA Model Evaluation** — the 75/25 train-test split delivered the best accuracy:

| Train-Test Split | MAE | RMSE | MAPE | Accuracy | Rank |
|---|---|---|---|---|---|
| 70-30 | 14,503 | 18,094 | 9.6% | 90.4% | 3rd |
| **75-25** | **12,079** | **14,765** | **8.5%** | **91.5%** | 🥇 1st |
| 80-20 | 18,323 | 21,933 | 12.2% | 87.8% | 4th |
| 90-10 | 13,902 | 17,713 | 9.4% | 90.6% | 2nd |

**Recommendation Quality** — evaluated using a test profile centered on Tablets, Smartwatches, and Laptops (Samsung/Apple):

- 🏠 **Home Page recommendations** scored **92–96%**, effectively aligning multiple product features with historical interaction patterns
- 📱 **Product Page recommendations** correctly prioritized same-category items (e.g., other smartphones) before suggesting cross-category alternatives

## 🛠️ Tech Highlights

- Content-based filtering using product metadata and NLP-driven feature extraction
- Custom ARIMA implementation with automated parameter selection and category-level modeling
- Modular, maintainable architecture built for scalability and future enhancement

## ▲ Deploying to Vercel

The repository includes a Vercel Services configuration that builds the React
frontend and Express backend independently, routes `/api/*` to the backend, and
falls back to `index.html` for React Router pages.

1. Import this repository into Vercel and keep the project root as the Root
   Directory.
2. Add `MONGODB_URI`, `JWT_SECRET`, and `PAYPAL_CLIENT_ID` in **Project Settings
   → Environment Variables**. The MongoDB Atlas integration creates
   `MONGODB_URI` automatically. `PAGINATION_LIMIT` is optional.
3. In MongoDB Atlas, allow connections from Vercel. For a simple setup this is
   commonly `0.0.0.0/0`; use stronger network controls when your Atlas plan and
   Vercel setup support them.
4. Select **Services** as the Framework Preset. Vercel reads the frontend and
   backend build settings from `vercel.json`, so leave the project-level build
   and output-directory overrides disabled.
5. Deploy.

Product image uploads remain available on Vercel. Images up to 1 MB are encoded
as data URIs and saved with the product document, avoiding Vercel's ephemeral
filesystem. Local development continues to save images in `uploads/`.

The Python forecasting engine is deployed as a third Vercel service. Vercel
injects its private URL into the Express backend as `FORECAST_API_URL`, so no
manual forecasting URL or separate hosting account is required. For local
development, run the Flask service on port 5001 or set `FORECAST_API_URL`.

## 🔑 Keywords
DigiMart, Content-Based Filtering, Product Recommendation, ARIMA, Time Series Forecasting, Demand Prediction
