"""Flask API and clean data pipeline for DigiMart SARIMA forecasting."""

from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Sequence

import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

try:
    from .sarima import FromScratchSARIMA, SarimaOrder, calculate_forecast_metrics
except ImportError:  # Supports `python forcastingengine.py`.
    from sarima import FromScratchSARIMA, SarimaOrder, calculate_forecast_metrics


DATA_DIRECTORY = Path(__file__).resolve().parent
DEFAULT_DATA_FILE = DATA_DIRECTORY / "cleaned_customer_data.csv"
SEASONAL_PERIOD = 7
PRIMARY_TRAIN_RATIO = 0.75
SPLIT_RATIOS = (0.70, 0.75, 0.80, 0.90)

# A small weekly-SARIMA search space keeps model selection reproducible. Every
# candidate uses seasonal differencing; there are no post-forecast weekend or
# bias adjustments.
CANDIDATE_ORDERS = (
    SarimaOrder(0, 0, 0, 0, 1, 0, SEASONAL_PERIOD),
    SarimaOrder(1, 0, 0, 0, 1, 0, SEASONAL_PERIOD),
    SarimaOrder(0, 0, 1, 0, 1, 0, SEASONAL_PERIOD),
    SarimaOrder(1, 0, 1, 0, 1, 0, SEASONAL_PERIOD),
    SarimaOrder(0, 0, 0, 1, 1, 0, SEASONAL_PERIOD),
    SarimaOrder(1, 0, 0, 1, 1, 0, SEASONAL_PERIOD),
    SarimaOrder(0, 0, 1, 1, 1, 0, SEASONAL_PERIOD),
    SarimaOrder(1, 0, 1, 1, 1, 0, SEASONAL_PERIOD),
    SarimaOrder(0, 0, 0, 0, 1, 1, SEASONAL_PERIOD),
    SarimaOrder(1, 0, 0, 0, 1, 1, SEASONAL_PERIOD),
    SarimaOrder(0, 0, 1, 0, 1, 1, SEASONAL_PERIOD),
)


def _ordinal(number: int) -> str:
    if 10 <= number % 100 <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(number % 10, "th")
    return f"{number}{suffix}"


class SalesForecastingEngine:
    """Prepare daily data, select SARIMA orders, evaluate, and forecast."""

    def __init__(self, data_file: str | Path | None = None) -> None:
        self.data_file = Path(data_file) if data_file else DEFAULT_DATA_FILE
        self.df = pd.DataFrame()
        self.daily_sales: pd.DataFrame | None = None
        self.category_sales: dict[str, pd.DataFrame] = {}
        self.sarima_model: FromScratchSARIMA | None = None
        # Compatibility alias for code that previously used `arima_model`.
        self.arima_model: FromScratchSARIMA | None = None
        self.category_models: dict[str, FromScratchSARIMA] = {}
        self.category_metrics: dict[str, dict[str, float]] = {}
        self.primary_order: SarimaOrder | None = None
        self.primary_metrics: dict[str, float] = {}
        self.primary_predictions = np.array([], dtype=float)
        self.primary_train_size = 0
        self.primary_test_size = 0
        self.split_evaluations: list[dict[str, Any]] = []
        self.load_error: str | None = None

        self._load_and_prepare_data()
        if self.daily_sales is not None and not self.daily_sales.empty:
            self._fit_models_and_evaluate()

    def _load_and_prepare_data(self) -> None:
        """Load and validate the cleaned transaction dataset."""
        try:
            frame = pd.read_csv(self.data_file)
            required = {"Date", "Revenue", "Quantity", "Product_Type"}
            missing = required.difference(frame.columns)
            if missing:
                raise ValueError(
                    "Dataset is missing required columns: "
                    + ", ".join(sorted(missing))
                )
            if frame.empty:
                raise ValueError("The forecasting dataset is empty")

            frame["Date"] = pd.to_datetime(frame["Date"], errors="raise")
            frame["Revenue"] = pd.to_numeric(frame["Revenue"], errors="raise")
            frame["Quantity"] = pd.to_numeric(frame["Quantity"], errors="raise")
            self.df = frame
            self.daily_sales = self._prepare_daily_sales(frame)
            self.category_sales = self._prepare_category_sales(frame)
        except (FileNotFoundError, ValueError, pd.errors.ParserError) as error:
            self.df = pd.DataFrame()
            self.daily_sales = None
            self.category_sales = {}
            self.load_error = str(error)

    @staticmethod
    def _complete_daily_series(frame: pd.DataFrame) -> pd.DataFrame:
        daily = (
            frame.groupby("Date", as_index=False)
            .agg(Revenue=("Revenue", "sum"), Quantity=("Quantity", "sum"))
            .sort_values("Date")
        )
        dates = pd.DataFrame(
            {"Date": pd.date_range(daily["Date"].min(), daily["Date"].max())}
        )
        return dates.merge(daily, on="Date", how="left").fillna(
            {"Revenue": 0.0, "Quantity": 0.0}
        )

    def _prepare_daily_sales(self, frame: pd.DataFrame) -> pd.DataFrame:
        daily = self._complete_daily_series(frame)
        # A trailing mean never reads a future observation. The previous
        # centered mean leaked values across chronological split boundaries.
        daily["Revenue_Smoothed"] = daily["Revenue"].rolling(3, min_periods=1).mean()
        daily["Quantity_Smoothed"] = daily["Quantity"].rolling(3, min_periods=1).mean()
        return daily.reset_index(drop=True)

    def _prepare_category_sales(
        self, frame: pd.DataFrame
    ) -> dict[str, pd.DataFrame]:
        categories: dict[str, pd.DataFrame] = {}
        for category, category_frame in frame.groupby("Product_Type"):
            daily = self._complete_daily_series(category_frame)
            if self.daily_sales is not None:
                all_dates = pd.DataFrame({"Date": self.daily_sales["Date"]})
                daily = all_dates.merge(daily, on="Date", how="left").fillna(
                    {"Revenue": 0.0, "Quantity": 0.0}
                )
            daily["Revenue_Smoothed"] = daily["Revenue"].rolling(3, min_periods=1).mean()
            daily["Quantity_Smoothed"] = daily["Quantity"].rolling(3, min_periods=1).mean()
            categories[str(category)] = daily.reset_index(drop=True)
        return categories

    @staticmethod
    def _split_series(
        series: Sequence[float], train_ratio: float
    ) -> tuple[np.ndarray, np.ndarray]:
        values = np.asarray(series, dtype=float)
        test_size = max(14, int(len(values) * (1.0 - train_ratio)))
        train_size = len(values) - test_size
        if train_size < 30:
            raise ValueError("Not enough training observations for SARIMA evaluation")
        return values[:train_size], values[train_size:]

    def _select_order(self, training_series: Sequence[float]) -> SarimaOrder:
        """Choose an order using only an inner part of the training data."""
        values = np.asarray(training_series, dtype=float)
        inner_test_size = max(14, int(len(values) * 0.20))
        inner_train = values[:-inner_test_size]
        inner_test = values[-inner_test_size:]
        best_order: SarimaOrder | None = None
        best_score = (float("inf"), float("inf"), float("inf"))

        for order in CANDIDATE_ORDERS:
            try:
                model = FromScratchSARIMA(order).fit(inner_train)
                predictions = model.forecast(len(inner_test))
                metrics = calculate_forecast_metrics(inner_test, predictions)
                score = (metrics["mape"], metrics["rmse"], model.aic)
                if score < best_score:
                    best_score = score
                    best_order = order
            except (ValueError, RuntimeError, np.linalg.LinAlgError):
                continue

        if best_order is None:
            raise RuntimeError("No SARIMA candidate could be fitted")
        return best_order

    def _evaluate_split(
        self, series: Sequence[float], train_ratio: float
    ) -> dict[str, Any]:
        train, test = self._split_series(series, train_ratio)
        order = self._select_order(train)
        model = FromScratchSARIMA(order).fit(train)
        predictions = model.forecast(len(test))
        metrics = calculate_forecast_metrics(test, predictions)
        return {
            "train_ratio": train_ratio,
            "test_ratio": 1.0 - train_ratio,
            "train_size": len(train),
            "test_size": len(test),
            "order": order,
            "predictions": predictions,
            "metrics": metrics,
        }

    def _fit_models_and_evaluate(self) -> None:
        if self.daily_sales is None or len(self.daily_sales) < 60:
            return
        revenue = self.daily_sales["Revenue_Smoothed"].to_numpy(dtype=float)
        private_results = [
            self._evaluate_split(revenue, train_ratio)
            for train_ratio in SPLIT_RATIOS
        ]
        primary_result = next(
            result
            for result in private_results
            if result["train_ratio"] == PRIMARY_TRAIN_RATIO
        )

        self.primary_order = primary_result["order"]
        self.primary_metrics = primary_result["metrics"]
        self.primary_predictions = primary_result["predictions"]
        self.primary_train_size = primary_result["train_size"]
        self.primary_test_size = primary_result["test_size"]
        self.sarima_model = FromScratchSARIMA(self.primary_order).fit(revenue)
        self.arima_model = self.sarima_model
        self.split_evaluations = self._rank_split_results(private_results)
        self._fit_category_models()

    @staticmethod
    def _rank_split_results(
        results: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        order = sorted(
            range(len(results)),
            key=lambda index: (
                results[index]["metrics"]["mape"],
                results[index]["metrics"]["rmse"],
            ),
        )
        ranks = {result_index: rank + 1 for rank, result_index in enumerate(order)}
        public_results = []
        for index, result in enumerate(results):
            metrics = result["metrics"]
            rank = ranks[index]
            public_results.append(
                {
                    "split": (
                        f"{round(result['train_ratio'] * 100)}-"
                        f"{round(result['test_ratio'] * 100)}"
                    ),
                    "train_ratio": result["train_ratio"],
                    "test_ratio": result["test_ratio"],
                    "train_size": result["train_size"],
                    "test_size": result["test_size"],
                    "model": result["order"].name,
                    "mae": metrics["mae"],
                    "rmse": metrics["rmse"],
                    "mape": metrics["mape"],
                    "accuracy": max(0.0, 100.0 - metrics["mape"]),
                    "rank_number": rank,
                    "rank": _ordinal(rank),
                }
            )
        return public_results

    def _fit_category_models(self) -> None:
        self.category_models = {}
        self.category_metrics = {}
        for category, category_data in self.category_sales.items():
            quantity = category_data["Quantity_Smoothed"].to_numpy(dtype=float)
            if len(quantity) < 60 or np.sum(quantity) <= 0:
                continue
            try:
                result = self._evaluate_split(quantity, PRIMARY_TRAIN_RATIO)
                if result["metrics"]["mape"] > 300:
                    continue
                self.category_models[category] = FromScratchSARIMA(
                    result["order"]
                ).fit(quantity)
                self.category_metrics[category] = result["metrics"]
            except (ValueError, RuntimeError, np.linalg.LinAlgError):
                continue

    def generate_forecast(self, period: str = "7days") -> dict[str, Any]:
        """Generate a dashboard response from a model fitted to all data."""
        if self.sarima_model is None or self.daily_sales is None:
            return self._empty_forecast()
        steps = 15 if period == "15days" else 7
        future = self.sarima_model.forecast(steps)
        last_date = self.daily_sales["Date"].iloc[-1]
        target = self.daily_sales["Revenue_Smoothed"].to_numpy(dtype=float)

        daily_forecast = []
        for index, prediction in enumerate(future, start=1):
            date = last_date + timedelta(days=index)
            daily_forecast.append(
                {
                    "date": date.strftime("%Y-%m-%d"),
                    "predicted": round(float(prediction), 2),
                    "day_name": date.strftime("%A"),
                    "is_weekend": date.weekday() >= 5,
                }
            )

        total_predicted = float(np.sum(future))
        historical_revenue = float(np.sum(target[-steps:]))
        growth_rate = (
            (total_predicted - historical_revenue) / historical_revenue * 100
            if historical_revenue > 0
            else 0.0
        )
        uncertainty = min(0.50, self.primary_metrics["mape"] / 100)
        train_end_date = self.daily_sales["Date"].iloc[self.primary_train_size - 1]

        return {
            "summary": {
                "predictedRevenue": round(total_predicted, 2),
                "growthRate": round(growth_rate, 1),
                "bestCase": round(total_predicted * (1 + uncertainty), 2),
                "worstCase": round(total_predicted * (1 - uncertainty), 2),
                "dailyAverage": round(total_predicted / steps, 2),
                "historicalRevenue": round(historical_revenue, 2),
            },
            "dailyForecast": daily_forecast,
            "categoryForecast": self._category_forecast(steps, last_date),
            "lineGraphData": self._line_graph_data(target, future),
            "topProducts": self._top_products(steps),
            "modelInfo": {
                "type": self.primary_order.name,
                "implementation": "From-scratch multiplicative SARIMA",
                "seasonalPeriod": SEASONAL_PERIOD,
                "targetSeries": "3-day trailing mean of daily revenue",
                "dataPoints": len(self.daily_sales),
                "forecastHorizon": f"{steps} days",
                "validationMethod": "Chronological holdout with inner order selection",
                "validationPeriod": f"{self.primary_test_size} days",
                "lastDataDate": last_date.strftime("%Y-%m-%d"),
                "trainEndDate": train_end_date.strftime("%Y-%m-%d"),
                "accuracy": f"{max(0.0, 100 - self.primary_metrics['mape']):.1f}%",
                "accuracyDefinition": "100% - MAPE",
                "mape": f"{self.primary_metrics['mape']:.1f}%",
                "categoryModels": len(self.category_models),
                "trainSize": self.primary_train_size,
                "testSize": self.primary_test_size,
                "maePercent": f"{self.primary_metrics['mae_normalized'] * 100:.1f}%",
                "rmsePercent": f"{self.primary_metrics['rmse_normalized'] * 100:.1f}%",
            },
        }

    def _line_graph_data(
        self, actual: np.ndarray, future: np.ndarray
    ) -> list[dict[str, Any]]:
        if self.daily_sales is None:
            return []
        lines = []
        for index, value in enumerate(actual):
            date = self.daily_sales["Date"].iloc[index]
            is_test = index >= self.primary_train_size
            predicted = (
                float(self.primary_predictions[index - self.primary_train_size])
                if is_test
                else None
            )
            lines.append(
                {
                    "date": date.strftime("%Y-%m-%d"),
                    "actual": round(float(value), 2),
                    "testPredicted": round(predicted, 2) if predicted is not None else None,
                    "futurePredicted": None,
                    "type": "test" if is_test else "training",
                }
            )

        # Bridge line segments without adding duplicate dates.
        lines[self.primary_train_size - 1]["testPredicted"] = lines[
            self.primary_train_size - 1
        ]["actual"]
        lines[-1]["futurePredicted"] = lines[-1]["actual"]
        last_date = self.daily_sales["Date"].iloc[-1]
        for index, value in enumerate(future, start=1):
            lines.append(
                {
                    "date": (last_date + timedelta(days=index)).strftime("%Y-%m-%d"),
                    "actual": None,
                    "testPredicted": None,
                    "futurePredicted": round(float(value), 2),
                    "type": "forecast",
                }
            )
        return lines

    def _category_forecast(
        self, steps: int, last_date: pd.Timestamp
    ) -> list[dict[str, Any]]:
        results = []
        for category, model in self.category_models.items():
            data = self.category_sales[category]
            predictions = model.forecast(steps)
            recent = data.tail(min(14, len(data)))
            recent_quantity = float(recent["Quantity"].sum())
            average_price = (
                float(recent["Revenue"].sum()) / recent_quantity
                if recent_quantity > 0
                else 0.0
            )
            daily = []
            for index, quantity in enumerate(predictions, start=1):
                date = last_date + timedelta(days=index)
                daily.append(
                    {
                        "date": date.strftime("%Y-%m-%d"),
                        "predicted_quantity": round(float(quantity), 0),
                        "predicted_revenue": round(float(quantity) * average_price, 2),
                        "day_name": date.strftime("%A"),
                        "is_weekend": date.weekday() >= 5,
                    }
                )
            total_quantity = int(round(float(np.sum(predictions))))
            results.append(
                {
                    "category": category,
                    "total_predicted_quantity": total_quantity,
                    "daily_average": round(total_quantity / steps, 1),
                    "daily_forecasts": daily,
                    "validation_mape": round(self.category_metrics[category]["mape"], 1),
                    "model": model.model_name,
                }
            )
        return sorted(
            results,
            key=lambda result: result["total_predicted_quantity"],
            reverse=True,
        )

    def _top_products(self, steps: int) -> list[dict[str, Any]]:
        products = []
        for category, model in self.category_models.items():
            data = self.category_sales[category]
            predicted_quantity = float(np.sum(model.forecast(steps)))
            recent = data.tail(min(14, len(data)))
            recent_quantity = float(recent["Quantity"].sum())
            if recent_quantity <= 0:
                continue
            average_price = float(recent["Revenue"].sum()) / recent_quantity
            historical_quantity = float(data["Quantity"].tail(steps).sum())
            growth = (
                (predicted_quantity - historical_quantity) / historical_quantity * 100
                if historical_quantity > 0
                else 0.0
            )
            products.append(
                {
                    "name": category,
                    "predictedSales": round(predicted_quantity * average_price, 2),
                    "predictedQuantity": int(round(predicted_quantity)),
                    "growth": round(growth, 1),
                    "avgPrice": round(average_price, 2),
                }
            )
        return sorted(
            products, key=lambda product: product["predictedSales"], reverse=True
        )[:10]

    def metrics_response(self) -> dict[str, Any]:
        if self.sarima_model is None or self.primary_order is None:
            return {"error": "No model"}
        metrics = self.primary_metrics
        return {
            "main_model": {
                "type": self.primary_order.name,
                "implementation": "from_scratch",
                "mae": round(metrics["mae"], 2),
                "rmse": round(metrics["rmse"], 2),
                "mape": round(metrics["mape"], 2),
                "mae_normalized": round(metrics["mae_normalized"], 4),
                "rmse_normalized": round(metrics["rmse_normalized"], 4),
                "mean_actual": round(metrics["mean_actual"], 2),
                "accuracy": f"{max(0.0, 100 - metrics['mape']):.1f}%",
                "accuracy_definition": "100% - MAPE",
                "train_size": self.primary_train_size,
                "test_size": self.primary_test_size,
                "mae_percent": f"{metrics['mae_normalized'] * 100:.1f}%",
                "rmse_percent": f"{metrics['rmse_normalized'] * 100:.1f}%",
                "mape_percent": f"{metrics['mape']:.1f}%",
            },
            "split_evaluations": [
                {
                    **result,
                    "mae": round(result["mae"], 2),
                    "rmse": round(result["rmse"], 2),
                    "mape": round(result["mape"], 2),
                    "accuracy": round(result["accuracy"], 2),
                }
                for result in self.split_evaluations
            ],
            "methodology": {
                "split_type": "chronological",
                "order_selection": "inner validation using training data only",
                "target": "3-day trailing mean of daily revenue",
                "seasonal_period": SEASONAL_PERIOD,
                "ranking": "ascending MAPE, then RMSE",
                "accuracy_definition": "100% - MAPE",
            },
            "data_points": len(self.daily_sales) if self.daily_sales is not None else 0,
            "category_models_count": len(self.category_models),
            "category_models": len(self.category_models),
        }

    def _empty_forecast(self) -> dict[str, Any]:
        return {
            "summary": {
                "predictedRevenue": 0,
                "growthRate": 0,
                "bestCase": 0,
                "worstCase": 0,
                "dailyAverage": 0,
            },
            "dailyForecast": [],
            "categoryForecast": [],
            "lineGraphData": [],
            "topProducts": [],
            "modelInfo": {
                "type": "No model",
                "dataPoints": 0,
                "forecastHorizon": "N/A",
                "lastDataDate": "N/A",
                "accuracy": "0%",
                "categoryModels": 0,
                "error": self.load_error,
            },
        }


app = Flask(__name__)
CORS(app)
engine: SalesForecastingEngine | None = None


def get_engine() -> SalesForecastingEngine:
    global engine
    if engine is None:
        engine = SalesForecastingEngine()
    return engine


@app.get("/api/sales/forecast")
def get_forecast():
    period = request.args.get("period", "7days")
    if period not in {"7days", "15days"}:
        return jsonify({"error": "period must be 7days or 15days"}), 400
    return jsonify(get_engine().generate_forecast(period))


@app.get("/api/sales/metrics")
def get_metrics():
    response = get_engine().metrics_response()
    if "error" in response:
        return jsonify(response), 404
    return jsonify(response)


@app.get("/api/sales/split-evaluation")
def get_split_evaluation():
    response = get_engine().metrics_response()
    if "error" in response:
        return jsonify(response), 404
    return jsonify(
        {
            "split_evaluations": response["split_evaluations"],
            "methodology": response["methodology"],
        }
    )


@app.get("/api/sales/categories")
def get_categories():
    current = get_engine()
    if current.daily_sales is None or current.daily_sales.empty:
        return jsonify({"error": "No data available"}), 404
    period = request.args.get("period", "7days")
    if period not in {"7days", "15days"}:
        return jsonify({"error": "period must be 7days or 15days"}), 400
    steps = 15 if period == "15days" else 7
    last_date = current.daily_sales["Date"].iloc[-1]
    categories = current._category_forecast(steps, last_date)
    return jsonify(
        {
            "categories": categories,
            "period": period,
            "forecast_steps": steps,
            "total_categories": len(categories),
        }
    )


@app.get("/api/sales/data-status")
def get_status():
    current = get_engine()
    categories = {
        category: {
            "data_points": len(data),
            "total_quantity": int(data["Quantity"].sum()),
            "total_revenue": round(float(data["Revenue"].sum()), 2),
            "has_model": category in current.category_models,
        }
        for category, data in current.category_sales.items()
    }
    return jsonify(
        {
            "status": "success" if current.load_error is None else "error",
            "error": current.load_error,
            "data_available": not current.df.empty,
            "record_count": len(current.df),
            "daily_points": len(current.daily_sales) if current.daily_sales is not None else 0,
            "models_trained": current.sarima_model is not None,
            "category_models": len(current.category_models),
            "categories": categories,
        }
    )


@app.post("/api/sales/retrain")
def retrain():
    global engine
    engine = SalesForecastingEngine()
    return jsonify(
        {
            "status": "success" if engine.sarima_model is not None else "error",
            "message": "Retrained",
            "main_model": engine.sarima_model is not None,
            "category_models": len(engine.category_models),
            "categories": list(engine.category_models),
        }
    )


@app.get("/health")
def health():
    current = get_engine()
    return jsonify(
        {
            "status": "healthy" if current.sarima_model else "degraded",
            "engine": "From-scratch multiplicative SARIMA",
            "timestamp": datetime.now().isoformat(),
            "models": {
                "main": current.sarima_model is not None,
                "categories": len(current.category_models),
                "data_loaded": not current.df.empty,
            },
        }
    )


if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=5001)
