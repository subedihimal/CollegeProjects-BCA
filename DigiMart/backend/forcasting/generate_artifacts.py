"""Run DigiMart forecasting experiments and create deployable JSON artifacts.

Usage:
    python generate_artifacts.py

The command is deterministic for a fixed dataset and configuration.  Model
selection, baseline comparison, diagnostics, and interval calibration happen
here rather than during an HTTP request.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
from typing import Any, Sequence

import numpy as np
import pandas as pd

try:
    from .evaluation import (
        OUTER_TRAIN_RATIO,
        REVENUE_TRAINING_WINDOWS,
        SEASONAL_PERIOD,
        VALIDATION_FOLDS,
        candidate_orders,
        compare_statsmodels_coefficients,
        evaluate_baseline,
        evaluate_bootstrap_mean,
        evaluate_custom_holdout,
        evaluate_custom_order,
        evaluate_statsmodels_arima,
        evaluate_statsmodels_sarima,
        final_test_windows,
        naive_forecast,
        seasonal_naive_forecast,
        select_arima_baseline,
        select_custom_order,
        serialize_order,
        stationarity_evidence,
        training_sample,
        chronological_split,
    )
    from .sarima import FromScratchSARIMA, SarimaOrder, sample_autocorrelation
except ImportError:  # Supports direct script execution.
    from evaluation import (
        OUTER_TRAIN_RATIO,
        REVENUE_TRAINING_WINDOWS,
        SEASONAL_PERIOD,
        VALIDATION_FOLDS,
        candidate_orders,
        compare_statsmodels_coefficients,
        evaluate_baseline,
        evaluate_bootstrap_mean,
        evaluate_custom_holdout,
        evaluate_custom_order,
        evaluate_statsmodels_arima,
        evaluate_statsmodels_sarima,
        final_test_windows,
        naive_forecast,
        seasonal_naive_forecast,
        select_arima_baseline,
        select_custom_order,
        serialize_order,
        stationarity_evidence,
        training_sample,
        chronological_split,
    )
    from sarima import FromScratchSARIMA, SarimaOrder, sample_autocorrelation


DIRECTORY = Path(__file__).resolve().parent
DATA_FILE = DIRECTORY / "data" / "cleaned_customer_data.csv"
ARTIFACT_DIRECTORY = DIRECTORY / "artifacts"
REPORT_DIRECTORY = DIRECTORY.parents[1] / "Documentation" / "report"
SCHEMA_VERSION = 2
HORIZONS = (15,)
SMOOTHING_WINDOW = 3
INTERVAL_SIMULATIONS = 2_000
REQUIRE_SEASONAL_REVENUE_FORECAST = True


def load_daily_data(path: Path = DATA_FILE) -> tuple[pd.DataFrame, dict[str, pd.DataFrame]]:
    """Load cleaned transactions and build complete raw daily series."""
    frame = pd.read_csv(path)
    required = {"Date", "Revenue", "Quantity", "Product_Type"}
    missing = required.difference(frame.columns)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")
    frame["Date"] = pd.to_datetime(frame["Date"], errors="raise").dt.normalize()
    frame["Revenue"] = pd.to_numeric(frame["Revenue"], errors="raise")
    frame["Quantity"] = pd.to_numeric(frame["Quantity"], errors="raise")
    if frame[["Revenue", "Quantity"]].isna().any().any():
        raise ValueError("Revenue and quantity must not contain missing values")

    start = frame["Date"].min()
    end = frame["Date"].max()
    calendar = pd.date_range(start, end, freq="D", name="Date")

    def aggregate(source: pd.DataFrame) -> pd.DataFrame:
        return (
            source.groupby("Date")
            .agg(Revenue=("Revenue", "sum"), Quantity=("Quantity", "sum"))
            .reindex(calendar, fill_value=0.0)
            .rename_axis("Date")
            .reset_index()
        )

    daily = aggregate(frame)
    categories = {
        str(category): aggregate(category_frame)
        for category, category_frame in frame.groupby("Product_Type")
    }
    return daily, categories


def run_target_experiment(
    series: Sequence[float],
    label: str,
    *,
    full_comparison: bool = True,
    require_seasonal_dynamics: bool = False,
) -> dict[str, Any]:
    """Evaluate one target definition for the supported forecast horizon."""
    values = np.asarray(series, dtype=float)
    development, final_test = chronological_split(values)
    horizons: dict[str, Any] = {}

    for horizon in HORIZONS:
        selection = select_custom_order(
            development,
            horizon,
            training_windows=REVENUE_TRAINING_WINDOWS,
            require_seasonal_dynamics=require_seasonal_dynamics,
        )
        selected_order = selection["selected_order"]
        selected_training_window = selection["selected_training_window"]
        validation_windows = selection["windows"]
        validation_comparison = {
            "custom_sarima": selection["selected_result"],
            "naive": evaluate_baseline("Naive", naive_forecast, validation_windows),
            "seasonal_naive": evaluate_baseline(
                "Seasonal naive", seasonal_naive_forecast, validation_windows
            ),
        }

        holdout_windows = final_test_windows(development, final_test, horizon)
        custom_holdout = (
            evaluate_custom_holdout(
                selected_order,
                holdout_windows,
                interval_simulations=INTERVAL_SIMULATIONS,
                training_window=selected_training_window,
            )
            if full_comparison
            else evaluate_custom_order(
                selected_order,
                holdout_windows,
                training_window=selected_training_window,
            )
        )
        final_comparison = {
            "custom_sarima": custom_holdout,
            "naive": evaluate_baseline("Naive", naive_forecast, holdout_windows),
            "seasonal_naive": evaluate_baseline(
                "Seasonal naive", seasonal_naive_forecast, holdout_windows
            ),
        }
        arima_order = None
        coefficient_comparison = []
        point_forecast_comparison = {}
        if full_comparison:
            arima_selection = select_arima_baseline(development, horizon)
            arima_order = arima_selection["selected_order"]
            validation_comparison.update(
                {
                    "arima": evaluate_statsmodels_arima(
                        arima_order, validation_windows
                    ),
                    "statsmodels_sarima": evaluate_statsmodels_sarima(
                        selected_order,
                        validation_windows,
                        training_window=selected_training_window,
                    ),
                }
            )
            final_comparison.update(
                {
                    "arima": evaluate_statsmodels_arima(arima_order, holdout_windows),
                    "statsmodels_sarima": evaluate_statsmodels_sarima(
                        selected_order,
                        holdout_windows,
                        training_window=selected_training_window,
                    ),
                }
            )
            selected_fit_data = training_sample(
                development, selected_training_window
            )
            coefficient_comparison = compare_statsmodels_coefficients(
                selected_order, selected_fit_data
            )
            bootstrap_mean = evaluate_bootstrap_mean(
                selected_order,
                validation_windows,
                training_window=selected_training_window,
                simulations=INTERVAL_SIMULATIONS,
            )
            point_forecast_comparison = {
                "conditional_log": selection["selected_result"]["metrics"],
                "bootstrap_mean": bootstrap_mean["metrics"],
                "deployed_method": "conditional_log",
            }

        development_model = FromScratchSARIMA(selected_order).fit(
            training_sample(development, selected_training_window)
        )
        horizons[str(horizon)] = {
            "horizon": horizon,
            "selected_order": selected_order,
            "selected_training_window": selected_training_window,
            "training_window_candidates": list(REVENUE_TRAINING_WINDOWS),
            "arima_order": arima_order,
            "selected_result": selection["selected_result"],
            "candidate_results": selection["candidate_results"],
            "adequate_candidates": selection["adequate_candidates"],
            "adequacy_fallback_used": selection["adequacy_fallback_used"],
            "seasonal_dynamics_required": selection[
                "seasonal_dynamics_required"
            ],
            "seasonal_requirement_fallback_used": selection[
                "seasonal_requirement_fallback_used"
            ],
            "validation_comparison": validation_comparison,
            "final_comparison": final_comparison,
            "coefficient_comparison": coefficient_comparison,
            "point_forecast_comparison": point_forecast_comparison,
            "diagnostics": development_model.residual_diagnostics(),
        }

    return {
        "label": label,
        "observations": len(values),
        "development_size": len(development),
        "final_test_size": len(final_test),
        "stationarity": stationarity_evidence(
            training_sample(
                development,
                horizons[str(HORIZONS[0])]["selected_training_window"],
            )
        ),
        "horizons": horizons,
    }


def run_category_experiments(
    categories: dict[str, pd.DataFrame], horizon: int
) -> dict[str, Any]:
    """Select and evaluate raw-quantity models for each product category."""
    results = {}
    for category, daily in sorted(categories.items()):
        values = daily["Quantity"].to_numpy(dtype=float)
        development, final_test = chronological_split(values)
        selection = select_custom_order(development, horizon)
        order = selection["selected_order"]
        holdout = evaluate_custom_order(
            order, final_test_windows(development, final_test, horizon)
        )
        results[category] = {
            "order": order,
            "validation": selection["selected_result"]["metrics"],
            "final_test": holdout["metrics"],
            "zero_days": int(np.sum(values == 0)),
        }
    return results


def build_forecast_response(
    daily: pd.DataFrame,
    categories: dict[str, pd.DataFrame],
    experiment: dict[str, Any],
    category_experiment: dict[str, Any],
    horizon: int,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Create contract-compatible forecast and metrics responses."""
    horizon_result = experiment["horizons"][str(horizon)]
    order: SarimaOrder = horizon_result["selected_order"]
    target = daily["Revenue"].to_numpy(dtype=float)
    training_window = horizon_result["selected_training_window"]
    model = FromScratchSARIMA(order).fit(training_sample(target, training_window))
    point = model.forecast(horizon)
    samples = model.forecast_samples(
        horizon,
        simulations=INTERVAL_SIMULATIONS,
        random_state=42 + horizon,
    )
    lower80, upper80 = np.quantile(samples, (0.10, 0.90), axis=0)
    totals = np.sum(samples, axis=1)
    total_lower80, total_upper80 = np.quantile(totals, (0.10, 0.90))
    last_date = pd.Timestamp(daily["Date"].iloc[-1])

    daily_forecast = []
    for index in range(horizon):
        date = last_date + timedelta(days=index + 1)
        daily_forecast.append(
            {
                "date": date.strftime("%Y-%m-%d"),
                "predicted": round(float(point[index]), 2),
                "lower80": round(float(lower80[index]), 2),
                "upper80": round(float(upper80[index]), 2),
            }
        )

    category_forecasts = _build_category_forecasts(
        categories, category_experiment, horizon, last_date
    )
    predicted_total = float(np.sum(point))
    previous_total = float(np.sum(target[-horizon:]))
    growth_rate = (
        (predicted_total - previous_total) / previous_total * 100
        if previous_total > 0
        else 0.0
    )
    final_custom = horizon_result["final_comparison"]["custom_sarima"]
    final_metrics = final_custom["metrics"]
    line_graph = _build_line_graph(
        daily,
        point,
        final_custom["predictions"],
        lower80,
        upper80,
    )

    forecast_response = {
        "summary": {
            "predictedRevenue": round(predicted_total, 2),
            "growthRate": round(growth_rate, 2),
            "bestCase": round(float(total_upper80), 2),
            "worstCase": round(float(total_lower80), 2),
            "dailyAverage": round(predicted_total / horizon, 2),
            "historicalRevenue": round(previous_total, 2),
            "interval80": {
                "level": 0.80,
            },
        },
        "dailyForecast": daily_forecast,
        "categoryForecast": category_forecasts,
        "lineGraphData": line_graph,
        "modelInfo": {
            "type": order.name,
            "implementation": "From-scratch multiplicative SARIMA estimated by CSS",
            "seasonalPeriod": SEASONAL_PERIOD,
            "targetSeries": "Raw daily revenue",
            "dataPoints": len(daily),
            "forecastHorizon": f"{horizon} days",
            "validationMethod": (
                f"{VALIDATION_FOLDS} expanding {horizon}-day rolling origins inside an 80% "
                "development period, followed by horizon-matched final testing"
            ),
            "outerTrainPercentage": int(OUTER_TRAIN_RATIO * 100),
            "rollingValidationFolds": VALIDATION_FOLDS,
            "rollingValidationHorizon": horizon,
            "selectedTrainingWindowDays": training_window,
            "finalTestPeriod": f"{experiment['final_test_size']} days",
            "lastDataDate": last_date.strftime("%Y-%m-%d"),
            "trainEndDate": daily["Date"].iloc[experiment["development_size"] - 1].strftime(
                "%Y-%m-%d"
            ),
            "mape": f"{final_metrics['mape']:.1f}%",
            "mase": round(final_metrics["mase"], 3),
            "categoryModels": len(category_forecasts),
            "trainSize": experiment["development_size"],
            "testSize": experiment["final_test_size"],
            "predictionIntervalLevel": "80%",
        },
    }

    metrics_response = _build_metrics_response(
        daily, experiment, category_experiment, horizon
    )
    return forecast_response, metrics_response


def _build_metrics_response(
    daily: pd.DataFrame,
    experiment: dict[str, Any],
    category_experiment: dict[str, Any],
    horizon: int,
) -> dict[str, Any]:
    result = experiment["horizons"][str(horizon)]
    final_metrics = result["final_comparison"]["custom_sarima"]["metrics"]
    diagnostics = result["diagnostics"]
    comparison = []
    labels = {
        "custom_sarima": "From-scratch selected model",
        "naive": "Naive",
        "seasonal_naive": "Seasonal naive",
        "arima": "Non-seasonal ARIMA",
        "statsmodels_sarima": "statsmodels SARIMA reference",
    }
    for key, label in labels.items():
        validation = result["validation_comparison"][key]["metrics"]
        final = result["final_comparison"][key]["metrics"]
        comparison.append(
            {"key": key, "model": label, "validation": validation, "final_test": final}
        )

    return {
        "main_model": {
            "type": result["selected_order"].name,
            "implementation": "from_scratch_css",
            "mae": round(final_metrics["mae"], 2),
            "rmse": round(final_metrics["rmse"], 2),
            "mape": round(final_metrics["mape"], 2),
            "wape": round(final_metrics["wape"], 2),
            "mase": round(final_metrics["mase"], 3),
            "rmsse": round(final_metrics["rmsse"], 3),
            "rmse_normalized": round(final_metrics["rmse_normalized"], 4),
            "mean_actual": round(final_metrics["mean_actual"], 2),
            "train_size": experiment["development_size"],
            "fitted_history_days": result["selected_training_window"],
            "test_size": experiment["final_test_size"],
            "horizon_days": horizon,
        },
        "model_comparison": comparison,
        "rolling_validation": [
            {
                "model": candidate["name"],
                "training_window_days": candidate["training_window"],
                "mae": round(candidate["metrics"]["mae"], 2),
                "rmse": round(candidate["metrics"]["rmse"], 2),
                "mape": round(candidate["metrics"]["mape"], 2),
                "mase": round(candidate["metrics"]["mase"], 3),
                "rank": candidate["rank"],
                "selected": candidate["selected"],
                "adequate": candidate["adequate"],
            }
            for candidate in result["candidate_results"]
        ],
        "diagnostics": diagnostics,
        "coefficient_comparison": result["coefficient_comparison"],
        "point_forecast_comparison": result["point_forecast_comparison"],
        "prediction_intervals": {
            "80": {
                "coverage": result["final_comparison"]["custom_sarima"][
                    "intervals"
                ]["80"]["coverage"],
                "mean_width": result["final_comparison"]["custom_sarima"][
                    "intervals"
                ]["80"]["mean_width"],
            }
        },
        "methodology": {
            "split_type": "chronological",
            "outer_train_percentage": round(OUTER_TRAIN_RATIO * 100),
            "outer_test_percentage": round((1 - OUTER_TRAIN_RATIO) * 100),
            "order_selection": "Joint training-window and SARIMA selection among adequate weekly-dynamic candidates, ranked by MASE and RMSE on development rolling origins",
            "training_window_candidates_days": list(REVENUE_TRAINING_WINDOWS),
            "selected_training_window_days": result["selected_training_window"],
            "declared_candidate_count": len(candidate_orders())
            * len(REVENUE_TRAINING_WINDOWS),
            "converged_candidate_count": len(result["candidate_results"]),
            "adequate_candidate_count": result["adequate_candidates"],
            "adequacy_fallback_used": result["adequacy_fallback_used"],
            "seasonal_dynamics_required": result[
                "seasonal_dynamics_required"
            ],
            "seasonal_requirement_fallback_used": result[
                "seasonal_requirement_fallback_used"
            ],
            "rolling_validation_folds": VALIDATION_FOLDS,
            "rolling_validation_horizon_days": horizon,
            "target": "raw daily revenue",
            "seasonal_period": SEASONAL_PERIOD,
        },
        "data_points": experiment["observations"],
        "category_models_count": len(category_experiment),
    }


def _build_category_forecasts(
    categories: dict[str, pd.DataFrame],
    category_experiment: dict[str, Any],
    horizon: int,
    last_date: pd.Timestamp,
) -> list[dict[str, Any]]:
    results = []
    for category, evaluation in sorted(category_experiment.items()):
        daily = categories[category]
        quantity = daily["Quantity"].to_numpy(dtype=float)
        model = FromScratchSARIMA(evaluation["order"]).fit(quantity)
        predictions = model.forecast(horizon)
        recent = daily.tail(min(28, len(daily)))
        recent_quantity = float(recent["Quantity"].sum())
        average_price = (
            float(recent["Revenue"].sum()) / recent_quantity
            if recent_quantity > 0
            else 0.0
        )
        daily_rows = []
        for index, prediction in enumerate(predictions, start=1):
            date = last_date + timedelta(days=index)
            daily_rows.append(
                {
                    "date": date.strftime("%Y-%m-%d"),
                    "predicted_quantity": round(float(prediction), 2),
                    "predicted_revenue": round(float(prediction) * average_price, 2),
                }
            )
        predicted_quantity = float(np.sum(predictions))
        historical_quantity = float(np.sum(quantity[-horizon:]))
        growth = (
            (predicted_quantity - historical_quantity) / historical_quantity * 100
            if historical_quantity > 0
            else 0.0
        )
        results.append(
            {
                "category": category,
                "total_predicted_quantity": int(round(predicted_quantity)),
                "total_predicted_revenue": round(predicted_quantity * average_price, 2),
                "daily_average": round(predicted_quantity / horizon, 1),
                "daily_forecasts": daily_rows,
                "validation_mape": round(evaluation["validation"]["mape"], 1),
                "validation_mase": round(evaluation["validation"]["mase"], 3),
                "final_test_mase": round(evaluation["final_test"]["mase"], 3),
                "model": evaluation["order"].name,
                "average_price": round(average_price, 2),
                "growth": round(growth, 1),
            }
        )
    return sorted(results, key=lambda row: row["total_predicted_quantity"], reverse=True)


def _build_line_graph(
    daily: pd.DataFrame,
    future: np.ndarray,
    holdout_predictions: np.ndarray,
    future_lower80: np.ndarray,
    future_upper80: np.ndarray,
) -> list[dict[str, Any]]:
    train_size = int(round(len(daily) * OUTER_TRAIN_RATIO))
    rows = []
    for index, row in daily.iterrows():
        is_test = index >= train_size
        predicted = (
            float(holdout_predictions[index - train_size]) if is_test else None
        )
        rows.append(
            {
                "date": row["Date"].strftime("%Y-%m-%d"),
                "actual": round(float(row["Revenue"]), 2),
                "testPredicted": round(predicted, 2) if predicted is not None else None,
                "futurePredicted": None,
                "futureInterval80": None,
                "isForecastBridge": False,
                "type": "test" if is_test else "training",
            }
        )
    rows[train_size - 1]["testPredicted"] = rows[train_size - 1]["actual"]
    rows[-1]["futurePredicted"] = rows[-1]["actual"]
    rows[-1]["futureInterval80"] = [rows[-1]["actual"], rows[-1]["actual"]]
    rows[-1]["isForecastBridge"] = True
    last_date = pd.Timestamp(daily["Date"].iloc[-1])
    for index, value in enumerate(future, start=1):
        rows.append(
            {
                "date": (last_date + timedelta(days=index)).strftime("%Y-%m-%d"),
                "actual": None,
                "testPredicted": None,
                "futurePredicted": round(float(value), 2),
                "futureInterval80": [
                    round(float(future_lower80[index - 1]), 2),
                    round(float(future_upper80[index - 1]), 2),
                ],
                "isForecastBridge": False,
                "type": "forecast",
            }
        )
    return rows


def write_plots(
    daily: pd.DataFrame,
    raw_experiment: dict[str, Any],
    smoothed_experiment: dict[str, Any],
    report_directory: Path = REPORT_DIRECTORY,
) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    report_directory.mkdir(parents=True, exist_ok=True)
    test_dates = pd.to_datetime(daily["Date"].iloc[raw_experiment["development_size"] :])

    figure, axes = plt.subplots(len(HORIZONS), 1, figsize=(11, 4.5), sharex=True)
    axes = np.atleast_1d(axes)
    for axis, horizon in zip(axes, HORIZONS):
        result = raw_experiment["horizons"][str(horizon)]["final_comparison"]
        axis.plot(test_dates, result["custom_sarima"]["actual"], label="Actual", color="#2563eb")
        axis.plot(
            test_dates,
            result["custom_sarima"]["predictions"],
            label="From-scratch SARIMA",
            color="#ea580c",
        )
        axis.plot(
            test_dates,
            result["seasonal_naive"]["predictions"],
            label="Seasonal naive",
            color="#16a34a",
            linestyle="--",
        )
        interval = result["custom_sarima"]["intervals"]["80"]
        axis.fill_between(
            test_dates,
            interval["lower"],
            interval["upper"],
            color="#ea580c",
            alpha=0.15,
            label="80% interval",
        )
        axis.set_title(f"{horizon}-day rolling final-test forecasts")
        axis.set_ylabel("Daily revenue ($)")
        axis.grid(alpha=0.25)
    axes[0].legend(ncol=4, fontsize=8)
    axes[-1].set_xlabel("Date")
    figure.tight_layout()
    figure.savefig(report_directory / "forecast-evaluation.png", dpi=220)
    plt.close(figure)

    figure, axes = plt.subplots(
        len(HORIZONS), 2, figsize=(11, 4.5), squeeze=False
    )
    development = daily["Revenue"].to_numpy(dtype=float)[: raw_experiment["development_size"]]
    for row, horizon in enumerate(HORIZONS):
        result = raw_experiment["horizons"][str(horizon)]
        model = FromScratchSARIMA(result["selected_order"]).fit(
            training_sample(development, result["selected_training_window"])
        )
        residuals = model.residuals[model._maximum_lag :]
        axes[row, 0].plot(residuals, color="#334155", linewidth=0.8)
        axes[row, 0].axhline(0, color="black", linewidth=0.6)
        axes[row, 0].set_title(f"{horizon}-day model residuals")
        acf = sample_autocorrelation(residuals, 21)
        axes[row, 1].stem(range(len(acf)), acf, linefmt="#2563eb", markerfmt=" ", basefmt=" ")
        bound = 1.96 / np.sqrt(len(residuals))
        axes[row, 1].axhline(bound, color="#dc2626", linestyle="--", linewidth=0.8)
        axes[row, 1].axhline(-bound, color="#dc2626", linestyle="--", linewidth=0.8)
        axes[row, 1].set_title(f"{horizon}-day model residual ACF")
        axes[row, 1].set_xlim(0, 21)
    figure.tight_layout()
    figure.savefig(report_directory / "residual-diagnostics.png", dpi=220)
    plt.close(figure)

    labels = ["Raw 15-day", "Smoothed 15-day"]
    values = [
        raw_experiment["horizons"]["15"]["final_comparison"]["custom_sarima"]["metrics"]["mase"],
        smoothed_experiment["horizons"]["15"]["final_comparison"]["custom_sarima"]["metrics"]["mase"],
    ]
    figure, axis = plt.subplots(figsize=(8, 4.5))
    bars = axis.bar(labels, values, color=["#2563eb", "#94a3b8"])
    axis.axhline(1.0, color="#dc2626", linestyle="--", label="Seasonal-naive scale")
    axis.set_ylabel("Final-test MASE")
    axis.set_title("Raw and smoothed target ablation")
    axis.bar_label(bars, fmt="%.3f")
    axis.legend()
    figure.tight_layout()
    figure.savefig(report_directory / "target-ablation.png", dpi=220)
    plt.close(figure)


def _serializable(value: Any) -> Any:
    if isinstance(value, SarimaOrder):
        return serialize_order(value)
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(key): _serializable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_serializable(item) for item in value]
    return value


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(_serializable(payload), indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def pipeline_hash() -> str:
    """Hash the scientific source files that define generated results."""
    digest = hashlib.sha256()
    for name in ("sarima.py", "evaluation.py", "generate_artifacts.py"):
        digest.update(name.encode("utf-8"))
        digest.update((DIRECTORY / name).read_bytes())
    return digest.hexdigest()


def generate_artifact_bundle(
    artifact_directory: Path = ARTIFACT_DIRECTORY,
    *,
    include_report_assets: bool = True,
) -> dict[str, Any]:
    """Evaluate the pipeline and return the generated deployment payloads."""
    artifact_directory = Path(artifact_directory)
    daily, categories = load_daily_data()
    raw = daily["Revenue"].to_numpy(dtype=float)
    smoothed = daily["Revenue"].rolling(SMOOTHING_WINDOW, min_periods=1).mean().to_numpy()
    print("Evaluating raw daily revenue...")
    raw_experiment = run_target_experiment(
        raw,
        "Raw daily revenue",
        require_seasonal_dynamics=REQUIRE_SEASONAL_REVENUE_FORECAST,
    )
    print("Evaluating the smoothing ablation...")
    smoothed_experiment = run_target_experiment(
        smoothed,
        "Trailing three-day mean of daily revenue",
        full_comparison=False,
    )

    category_experiments = {}
    for horizon in HORIZONS:
        print(f"Evaluating raw category quantities for {horizon} days...")
        category_experiments[str(horizon)] = run_category_experiments(
            categories, horizon
        )

    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    metadata = {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": generated_at,
        "dataset": DATA_FILE.name,
        "datasetSha256": file_hash(DATA_FILE),
        "pipelineSha256": pipeline_hash(),
        "observations": len(daily),
        "dateStart": daily["Date"].iloc[0].strftime("%Y-%m-%d"),
        "dateEnd": daily["Date"].iloc[-1].strftime("%Y-%m-%d"),
        "outerTrainRatio": OUTER_TRAIN_RATIO,
        "validationFolds": VALIDATION_FOLDS,
        "horizons": list(HORIZONS),
        "seasonalPeriod": SEASONAL_PERIOD,
        "primaryTarget": "raw daily revenue",
        "selectionMetric": "MASE",
        "tieBreaker": "RMSE",
        "intervalMethod": "centered residual bootstrap",
        "intervalSimulations": INTERVAL_SIMULATIONS,
    }

    forecasts: dict[str, Any] = {}
    metrics_payloads: dict[str, Any] = {}
    for horizon in HORIZONS:
        forecast, metrics = build_forecast_response(
            daily,
            categories,
            raw_experiment,
            category_experiments[str(horizon)],
            horizon,
        )
        forecast = _serializable(forecast)
        metrics = _serializable(metrics)
        forecasts[str(horizon)] = forecast
        metrics_payloads[str(horizon)] = metrics
        write_json(artifact_directory / f"forecast-{horizon}days.json", forecast)
        write_json(artifact_directory / f"metrics-{horizon}days.json", metrics)

    metadata = _serializable(metadata)
    write_json(artifact_directory / "manifest.json", metadata)
    if include_report_assets:
        write_plots(daily, raw_experiment, smoothed_experiment)
    return {
        "manifest": metadata,
        "forecasts": forecasts,
        "metrics": metrics_payloads,
    }


def main() -> None:
    generate_artifact_bundle()
    print(f"Artifacts written to {ARTIFACT_DIRECTORY}")
    print(f"Report figures written to {REPORT_DIRECTORY}")


if __name__ == "__main__":
    main()