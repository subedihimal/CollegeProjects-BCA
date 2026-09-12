# DigiMart: Recommendation and Sales Forecasting

DigiMart is a MERN electronics marketplace with deterministic content-based recommendation and a reproducible, from-scratch SARIMA forecasting study.

## Overview

- The recommendation service builds a temporary profile from viewed products, cart items, and completed orders.
- The offline forecasting pipeline evaluates raw daily revenue and category quantities for a 15-day forecast horizon.
- The deployed Flask service validates and serves pre-generated JSON artifacts during normal page loads. An administrator can explicitly start a rebuild from the forecasting page.

## Content-Based Recommendation

The service compares each product with the user's recent interactions:

1. No activity returns the latest products in Explore Mode.
2. Product identifiers from the cart, views, and orders are deduplicated.
3. A profile is built from category, brand, price, rating, and colon-delimited key-value specifications.
4. Traditional similarity contributes 40%. Exact and partial specification matching contributes 60%.
5. Products are ranked by the deterministic combined score.

```
Final Score = 0.40 × Traditional Similarity + 0.60 × Description Similarity
```

The score is a similarity value, not recommendation accuracy. Automated tests cover parsing, aggregation, exact and partial matching, and the declared weights. The project does not yet include relevance labels or a user study.

## From-Scratch SARIMA Study

The primary target is raw daily revenue from 366 chronological observations. A trailing 3-day mean is evaluated only as an ablation.

1. Reserve the first 80% for development and the final 20% for protected rolling testing.
2. Create seven expanding 15-day rolling-origin validation folds.
3. Combine 72 declared combinations of d,D,p,q,P,Q with 91-day, 126-day, 182-day, and expanding training histories.
4. Evaluate the 288 configurations on every validation origin, using the complete available history for a common MASE scale.
5. For the dashboard revenue forecast, retain adequate candidates with weekly seasonal dynamics, then rank them by mean MASE, pooled RMSE, and fewer terms. Retain the unrestricted ranking for comparison.
6. Compare the selected order and coefficients with naive, weekly seasonal-naive, non-seasonal ARIMA, and a same-order statsmodels SARIMA reference.
7. Evaluate all 73 final observations in expanding 15-day blocks.
8. Report MAE, RMSE, MAPE, WAPE, MASE, RMSSE, residual diagnostics, and bootstrap interval coverage.
9. Fit the selected revenue configuration using its selected history and generate versioned artifacts.

## Main Results

| Horizon | Selected custom order | Validation MASE | Final-test MASE | Final-test MAPE |
|---|---|---:|---:|---:|
| 15 days | SARIMA(2,0,0)(0,1,1,7), 126 days | 0.817 | 0.761 | 16.97% |

The 72 orders and four history policies are evaluated on the same rolling origins. Candidates with patterned residuals or unstable roots are excluded. The selected model improves validation MASE from 0.824 for the naive baseline to 0.817 and produces a recurring seven-day pattern. On the protected final test, its MAPE is 16.97%, compared with 20.28% for the naive baseline.

## Reproduce the Forecasting Study

~~~bash
cd backend/forcasting
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python data/datapreprocess.py
python generate_artifacts.py
python -m unittest discover -s tests -p 'test_*.py'
~~~

Run the recommendation scoring tests from the repository root:

~~~bash
npm run test:recommendations
~~~

The report source and generated PDF are in **Documentation/report**. Editable SVG diagrams are in **Documentation/svg**.

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

The Python forecasting artifact API is deployed as a third Vercel service. Vercel
injects its private URL into the Express backend as `FORECAST_API_URL`, so no
manual forecasting URL or separate hosting account is required. For local
development, run the Flask service on port 5001 or set `FORECAST_API_URL`.
The forecasting page can trigger a manual recalculation, which can take one to
two minutes. Local recalculation replaces the JSON artifact files. On Vercel,
the generated result is returned to the current page, but serverless storage is
temporary, so permanent deployment artifacts should still be generated locally
and committed.

## 🔑 Keywords
DigiMart, Content-Based Filtering, Product Recommendation, SARIMA, Rolling-Origin Evaluation, Time Series Forecasting, Demand Prediction
