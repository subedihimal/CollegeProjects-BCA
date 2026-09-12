"""Reproducible, horizon-specific evaluation for DigiMart forecasting.

This module is intentionally separate from the Flask service.  It performs
model selection and academic evaluation offline, using only chronological
observations available at each forecast origin.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Iterable, Sequence
import warnings

import numpy as np
from statsmodels.tools.sm_exceptions import ConvergenceWarning, InterpolationWarning
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.statespace.sarimax import SARIMAX
from statsmodels.tsa.stattools import adfuller, kpss

try:
    from .sarima import FromScratchSARIMA, SarimaOrder, calculate_forecast_metrics
except ImportError:  # Supports direct script execution.
    from sarima import FromScratchSARIMA, SarimaOrder, calculate_forecast_metrics


SEASONAL_PERIOD = 7
OUTER_TRAIN_RATIO = 0.80
VALIDATION_FOLDS = 7
MINIMUM_TRAINING_WEEKS = 12
REVENUE_TRAINING_WINDOWS: tuple[int | None, ...] = (
    13 * 7,
    18 * 7,
    26 * 7,
    None,
)


@dataclass(frozen=True)
class ForecastWindow:
    """One chronological training and evaluation window."""

    train: np.ndarray
    test: np.ndarray
    start_index: int


def chronological_split(
    series: Sequence[float], train_ratio: float = OUTER_TRAIN_RATIO
) -> tuple[np.ndarray, np.ndarray]:
    """Reserve the final portion of a series without shuffling."""
    values = _as_series(series)
    if not 0.0 < train_ratio < 1.0:
        raise ValueError("Training ratio must lie between zero and one")
    train_size = int(round(len(values) * train_ratio))
    train_size = min(train_size, len(values) - 15)
    if train_size < SEASONAL_PERIOD * MINIMUM_TRAINING_WEEKS:
        raise ValueError("The development period is too short for weekly SARIMA")
    return values[:train_size], values[train_size:]


def development_windows(
    development: Sequence[float],
    horizon: int,
    *,
    folds: int = VALIDATION_FOLDS,
) -> list[ForecastWindow]:
    """Create equal-horizon expanding-origin validation windows."""
    values = _as_series(development)
    _validate_horizon(horizon)
    if folds < 2:
        raise ValueError("At least two rolling-origin folds are required")
    first_origin = len(values) - folds * horizon
    if first_origin < SEASONAL_PERIOD * MINIMUM_TRAINING_WEEKS:
        raise ValueError("Insufficient development data for the requested folds")
    return [
        ForecastWindow(
            train=values[: first_origin + index * horizon],
            test=values[
                first_origin + index * horizon : first_origin + (index + 1) * horizon
            ],
            start_index=first_origin + index * horizon,
        )
        for index in range(folds)
    ]


def final_test_windows(
    development: Sequence[float], final_test: Sequence[float], horizon: int
) -> list[ForecastWindow]:
    """Create expanding forecast blocks that cover the protected final period.

    Earlier final-test observations become available only after they have been
    forecast and observed.  No final-test value is used for order selection.
    """
    initial = _as_series(development)
    holdout = _as_series(final_test)
    _validate_horizon(horizon)
    windows: list[ForecastWindow] = []
    for offset in range(0, len(holdout), horizon):
        history = np.concatenate((initial, holdout[:offset]))
        test = holdout[offset : offset + horizon]
        windows.append(
            ForecastWindow(train=history, test=test, start_index=len(initial) + offset)
        )
    return windows


def naive_forecast(training: Sequence[float], steps: int) -> np.ndarray:
    """Forecast every future observation as the most recent observation."""
    values = _as_series(training)
    _validate_horizon(steps)
    return np.repeat(values[-1], steps).astype(float)


def seasonal_naive_forecast(
    training: Sequence[float], steps: int, seasonal_period: int = SEASONAL_PERIOD
) -> np.ndarray:
    """Repeat the last observed seasonal cycle recursively."""
    history = list(_as_series(training))
    if len(history) < seasonal_period:
        raise ValueError("Seasonal-naive forecasting requires one complete season")
    predictions = np.empty(steps, dtype=float)
    for index in range(steps):
        prediction = float(history[-seasonal_period])
        predictions[index] = prediction
        history.append(prediction)
    return predictions


def candidate_orders() -> tuple[SarimaOrder, ...]:
    """Return the 72 declared parsimonious weekly SARIMA specifications."""
    regular_terms = ((0, 0), (1, 0), (0, 1), (1, 1), (2, 0), (0, 2))
    seasonal_terms = ((0, 0), (1, 0), (0, 1))
    return tuple(
        SarimaOrder(p, d, q, seasonal_p, seasonal_d, seasonal_q, SEASONAL_PERIOD)
        for d in (0, 1)
        for seasonal_d in (0, 1)
        for p, q in regular_terms
        for seasonal_p, seasonal_q in seasonal_terms
    )


def evaluate_custom_order(
    order: SarimaOrder,
    windows: Sequence[ForecastWindow],
    *,
    training_window: int | None = None,
) -> dict:
    """Evaluate one from-scratch SARIMA order on fixed forecast origins."""
    folds = []
    for number, window in enumerate(windows, start=1):
        fit_data = training_sample(window.train, training_window)
        model = FromScratchSARIMA(order).fit(fit_data)
        if not model.converged:
            raise RuntimeError(f"{order.name} did not converge on fold {number}")
        predictions = model.forecast(len(window.test))
        metrics = calculate_forecast_metrics(
            window.test,
            predictions,
            insample=window.train,
            seasonal_period=SEASONAL_PERIOD,
        )
        folds.append(
            {
                "fold": number,
                "train_size": len(fit_data),
                "available_train_size": len(window.train),
                "test_size": len(window.test),
                "iterations": model.iterations,
                "objective": model.objective,
                "metrics": metrics,
            }
        )
    return {
        "name": order.name,
        "order": order,
        "training_window": training_window,
        "folds": folds,
        "metrics": aggregate_fold_metrics(folds),
    }


def select_custom_order(
    development: Sequence[float],
    horizon: int,
    *,
    training_windows: Sequence[int | None] = (None,),
    require_seasonal_dynamics: bool = False,
) -> dict:
    """Select a SARIMA order and history window using development data only.

    A deployed forecast may require a time-varying weekly profile.  When that
    requirement is enabled, selection is restricted to adequate candidates
    containing at least one seasonal AR, difference, or MA term.  Ranking
    within the eligible pool continues to use validation MASE and RMSE.
    """
    windows = development_windows(development, horizon)
    if not training_windows:
        raise ValueError("At least one training window candidate is required")
    candidates = []
    for training_window in training_windows:
        candidates.extend(
            _evaluate_orders(
                candidate_orders(), windows, training_window=training_window
            )
        )
    ranked = sorted(candidates, key=_selection_key)
    for error_rank, result in enumerate(ranked, start=1):
        result["rank"] = error_rank
        try:
            fit_data = training_sample(development, result["training_window"])
            model = FromScratchSARIMA(result["order"]).fit(fit_data)
            diagnostics = model.residual_diagnostics()
            result["diagnostics"] = diagnostics
            result["adequate"] = (
                model.converged
                and diagnostics["stationary_ar"]
                and diagnostics["invertible_ma"]
                and all(
                    test["p_value"] >= 0.05
                    for test in diagnostics["ljung_box"]
                )
            )
        except (ValueError, RuntimeError, np.linalg.LinAlgError, FloatingPointError):
            result["diagnostics"] = None
            result["adequate"] = False

    adequate = [result for result in ranked if result["adequate"]]
    seasonal_adequate = [
        result
        for result in adequate
        if _has_seasonal_dynamics(result["order"])
    ]
    seasonal_requirement_fallback_used = (
        require_seasonal_dynamics and not seasonal_adequate
    )
    if require_seasonal_dynamics and seasonal_adequate:
        selection_pool = seasonal_adequate
    else:
        selection_pool = adequate or ranked
    selected = min(selection_pool, key=_selection_key)
    for result in ranked:
        result["selected"] = result is selected
    return {
        "selected_order": selected["order"],
        "selected_training_window": selected["training_window"],
        "selected_result": selected,
        "candidate_results": ranked,
        "windows": windows,
        "adequate_candidates": len(adequate),
        "adequacy_fallback_used": not adequate,
        "seasonal_dynamics_required": require_seasonal_dynamics,
        "seasonal_requirement_fallback_used": seasonal_requirement_fallback_used,
    }


def evaluate_baseline(
    name: str,
    forecaster: Callable[[Sequence[float], int], np.ndarray],
    windows: Sequence[ForecastWindow],
) -> dict:
    """Evaluate a deterministic baseline on the supplied origins."""
    folds = []
    predictions = []
    actual = []
    for number, window in enumerate(windows, start=1):
        forecast = np.asarray(forecaster(window.train, len(window.test)), dtype=float)
        metrics = calculate_forecast_metrics(
            window.test,
            forecast,
            insample=window.train,
            seasonal_period=SEASONAL_PERIOD,
        )
        folds.append(
            {
                "fold": number,
                "train_size": len(window.train),
                "test_size": len(window.test),
                "metrics": metrics,
            }
        )
        predictions.extend(forecast.tolist())
        actual.extend(window.test.tolist())
    return {
        "name": name,
        "folds": folds,
        "metrics": aggregate_fold_metrics(folds),
        "predictions": np.asarray(predictions),
        "actual": np.asarray(actual),
    }


def select_arima_baseline(
    development: Sequence[float], horizon: int
) -> dict:
    """Select a small non-seasonal statsmodels ARIMA baseline grid."""
    windows = development_windows(development, horizon)
    orders = ((1, 0, 0), (0, 0, 1), (1, 0, 1), (1, 1, 0), (0, 1, 1), (1, 1, 1))
    results = []
    for order in orders:
        folds = []
        try:
            for number, window in enumerate(windows, start=1):
                forecast = _statsmodels_arima_forecast(window.train, len(window.test), order)
                folds.append(
                    {
                        "fold": number,
                        "train_size": len(window.train),
                        "test_size": len(window.test),
                        "metrics": calculate_forecast_metrics(
                            window.test,
                            forecast,
                            insample=window.train,
                            seasonal_period=SEASONAL_PERIOD,
                        ),
                    }
                )
        except (ValueError, RuntimeError, np.linalg.LinAlgError):
            continue
        results.append(
            {
                "name": f"ARIMA{order}",
                "order": order,
                "folds": folds,
                "metrics": aggregate_fold_metrics(folds),
            }
        )
    if not results:
        raise RuntimeError("No ARIMA baseline could be fitted")
    ranked = sorted(results, key=_selection_key)
    return {"selected_order": ranked[0]["order"], "candidate_results": ranked}


def evaluate_statsmodels_arima(
    order: tuple[int, int, int], windows: Sequence[ForecastWindow]
) -> dict:
    return evaluate_baseline(
        f"ARIMA{order}",
        lambda training, steps: _statsmodels_arima_forecast(training, steps, order),
        windows,
    )


def evaluate_statsmodels_sarima(
    order: SarimaOrder,
    windows: Sequence[ForecastWindow],
    *,
    training_window: int | None = None,
) -> dict:
    """Evaluate state-space SARIMA as an independent implementation reference."""
    return evaluate_baseline(
        f"statsmodels {order.name}",
        lambda training, steps: _statsmodels_sarima_forecast(
            training_sample(training, training_window), steps, order
        ),
        windows,
    )


def compare_statsmodels_coefficients(
    order: SarimaOrder, training: Sequence[float]
) -> list[dict[str, float | str]]:
    """Compare custom CSS estimates with same-order statsmodels MLE estimates.

    The estimators optimize different objectives, so close rather than identical
    coefficients are expected.  This is an implementation check, not a model-
    selection criterion.
    """
    values = _as_series(training)
    custom = FromScratchSARIMA(order).fit(values)
    if not custom.converged:
        raise RuntimeError(f"{order.name} did not converge for coefficient comparison")
    reference = _fit_statsmodels_sarima(values, order)
    custom_coefficients = custom.coefficient_map()
    reference_coefficients = {
        str(name): float(value)
        for name, value in zip(reference.param_names, reference.params)
        if str(name) != "sigma2"
    }
    names = list(dict.fromkeys((*custom_coefficients, *reference_coefficients)))
    return [
        {
            "parameter": name,
            "custom_css": custom_coefficients.get(name, float("nan")),
            "statsmodels_mle": reference_coefficients.get(name, float("nan")),
            "absolute_difference": abs(
                custom_coefficients.get(name, float("nan"))
                - reference_coefficients.get(name, float("nan"))
            ),
        }
        for name in names
    ]


def evaluate_bootstrap_mean(
    order: SarimaOrder,
    windows: Sequence[ForecastWindow],
    *,
    training_window: int | None = None,
    simulations: int = 2_000,
) -> dict:
    """Evaluate the original-scale mean of bootstrap paths as a point forecast."""
    folds = []
    predictions: list[float] = []
    actual: list[float] = []
    for number, window in enumerate(windows, start=1):
        fit_data = training_sample(window.train, training_window)
        model = FromScratchSARIMA(order).fit(fit_data)
        if not model.converged:
            raise RuntimeError(f"{order.name} did not converge on bootstrap fold {number}")
        samples = model.forecast_samples(
            len(window.test),
            simulations=simulations,
            random_state=20_000 + number,
        )
        point = np.mean(samples, axis=0)
        metrics = calculate_forecast_metrics(
            window.test,
            point,
            insample=window.train,
            seasonal_period=SEASONAL_PERIOD,
        )
        folds.append(
            {
                "fold": number,
                "train_size": len(fit_data),
                "available_train_size": len(window.train),
                "test_size": len(window.test),
                "metrics": metrics,
            }
        )
        predictions.extend(point.tolist())
        actual.extend(window.test.tolist())
    return {
        "name": f"Bootstrap-mean {order.name}",
        "order": order,
        "folds": folds,
        "metrics": aggregate_fold_metrics(folds),
        "predictions": np.asarray(predictions),
        "actual": np.asarray(actual),
    }


def evaluate_custom_holdout(
    order: SarimaOrder,
    windows: Sequence[ForecastWindow],
    *,
    interval_simulations: int = 500,
    training_window: int | None = None,
) -> dict:
    """Evaluate point forecasts and bootstrap interval coverage on final origins."""
    folds = []
    predictions: list[float] = []
    actual: list[float] = []
    lower80: list[float] = []
    upper80: list[float] = []

    for number, window in enumerate(windows, start=1):
        fit_data = training_sample(window.train, training_window)
        model = FromScratchSARIMA(order).fit(fit_data)
        if not model.converged:
            raise RuntimeError(f"{order.name} did not converge on final fold {number}")
        point = model.forecast(len(window.test))
        samples = model.forecast_samples(
            len(window.test),
            simulations=interval_simulations,
            random_state=10_000 + number,
        )
        current_lower80, current_upper80 = np.quantile(samples, (0.10, 0.90), axis=0)
        metrics = calculate_forecast_metrics(
            window.test,
            point,
            insample=window.train,
            seasonal_period=SEASONAL_PERIOD,
        )
        folds.append(
            {
                "fold": number,
                "train_size": len(fit_data),
                "available_train_size": len(window.train),
                "test_size": len(window.test),
                "metrics": metrics,
            }
        )
        predictions.extend(point.tolist())
        actual.extend(window.test.tolist())
        lower80.extend(current_lower80.tolist())
        upper80.extend(current_upper80.tolist())

    actual_array = np.asarray(actual)
    lower80_array = np.asarray(lower80)
    upper80_array = np.asarray(upper80)
    return {
        "name": order.name,
        "order": order,
        "folds": folds,
        "metrics": aggregate_fold_metrics(folds),
        "predictions": np.asarray(predictions),
        "actual": actual_array,
        "intervals": {
            "80": {
                "lower": lower80_array,
                "upper": upper80_array,
                "coverage": float(
                    np.mean((actual_array >= lower80_array) & (actual_array <= upper80_array))
                ),
                "mean_width": float(np.mean(upper80_array - lower80_array)),
            },
        },
    }


def stationarity_evidence(development: Sequence[float]) -> list[dict]:
    """Run ADF and KPSS on development-only log series transformations."""
    values = np.log1p(_as_series(development))
    transformations = {
        "log level": values,
        "regular difference": np.diff(values),
        "weekly difference": values[SEASONAL_PERIOD:] - values[:-SEASONAL_PERIOD],
        "regular and weekly difference": np.diff(
            values[SEASONAL_PERIOD:] - values[:-SEASONAL_PERIOD]
        ),
    }
    results = []
    for name, transformed in transformations.items():
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", InterpolationWarning)
            adf_statistic, adf_p, *_ = adfuller(transformed, autolag="AIC")
            kpss_statistic, kpss_p, *_ = kpss(
                transformed, regression="c", nlags="auto"
            )
        results.append(
            {
                "transformation": name,
                "observations": len(transformed),
                "adf_statistic": float(adf_statistic),
                "adf_p_value": float(adf_p),
                "kpss_statistic": float(kpss_statistic),
                "kpss_p_value": float(kpss_p),
            }
        )
    return results


def aggregate_fold_metrics(folds: Sequence[dict]) -> dict[str, float]:
    """Return test-size-weighted metrics across forecast origins."""
    if not folds:
        raise ValueError("At least one fold is required")
    weights = np.asarray([fold["test_size"] for fold in folds], dtype=float)
    keys = (
        "mae",
        "rmse",
        "mape",
        "wape",
        "mase",
        "rmsse",
        "mae_normalized",
        "rmse_normalized",
        "mean_actual",
    )
    aggregated = {}
    for key in keys:
        values = np.asarray([fold["metrics"][key] for fold in folds], dtype=float)
        finite = np.isfinite(values)
        if not np.any(finite):
            aggregated[key] = float("nan")
        elif key == "rmse":
            aggregated[key] = float(
                np.sqrt(np.average(np.square(values[finite]), weights=weights[finite]))
            )
        else:
            aggregated[key] = float(
                np.average(values[finite], weights=weights[finite])
            )
    aggregated["observations"] = int(np.sum(weights))
    aggregated["origins"] = len(folds)
    return aggregated


def serialize_order(order: SarimaOrder) -> dict[str, int | str]:
    return {
        "name": order.name,
        "p": order.p,
        "d": order.d,
        "q": order.q,
        "P": order.seasonal_p,
        "D": order.seasonal_d,
        "Q": order.seasonal_q,
        "s": order.seasonal_period,
    }


def _evaluate_orders(
    orders: Iterable[SarimaOrder],
    windows: Sequence[ForecastWindow],
    *,
    training_window: int | None = None,
) -> list[dict]:
    results = []
    for order in orders:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", RuntimeWarning)
                results.append(
                    evaluate_custom_order(
                        order, windows, training_window=training_window
                    )
                )
        except (ValueError, RuntimeError, np.linalg.LinAlgError, FloatingPointError):
            continue
    if not results:
        raise RuntimeError("No custom SARIMA candidate could be evaluated")
    return results


def _selection_key(result: dict) -> tuple[float, float, int]:
    metrics = result["metrics"]
    order = result.get("order")
    if isinstance(order, SarimaOrder):
        parameter_count = order.p + order.q + order.seasonal_p + order.seasonal_q
    else:
        parameter_count = sum(int(value) for value in (order or ()))
    return (metrics["mase"], metrics["rmse"], parameter_count)


def _has_seasonal_dynamics(order: SarimaOrder) -> bool:
    """Return whether an order can produce a recurring seasonal response."""
    return bool(order.seasonal_p or order.seasonal_d or order.seasonal_q)


def _statsmodels_arima_forecast(
    training: Sequence[float], steps: int, order: tuple[int, int, int]
) -> np.ndarray:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", ConvergenceWarning)
        trend = "c" if order[1] == 0 else "n"
        fitted = ARIMA(_as_series(training), order=order, trend=trend).fit()
        if not fitted.mle_retvals.get("converged", True):
            raise RuntimeError(f"statsmodels ARIMA{order} did not converge")
    return np.maximum(np.asarray(fitted.forecast(steps), dtype=float), 0.0)


def training_sample(
    training: Sequence[float], training_window: int | None
) -> np.ndarray:
    """Return the predeclared recent history while preserving metric scaling data."""
    values = _as_series(training)
    if training_window is None:
        return values
    minimum = SEASONAL_PERIOD * MINIMUM_TRAINING_WEEKS
    if training_window < minimum:
        raise ValueError(
            f"A training window must contain at least {minimum} observations"
        )
    return values[-min(training_window, len(values)) :]


def _statsmodels_sarima_forecast(
    training: Sequence[float], steps: int, order: SarimaOrder
) -> np.ndarray:
    fitted = _fit_statsmodels_sarima(training, order)
    return np.maximum(np.expm1(np.asarray(fitted.forecast(steps))), 0.0)


def _fit_statsmodels_sarima(training: Sequence[float], order: SarimaOrder):
    """Fit the independent same-order statsmodels reference."""
    transformed = np.log1p(_as_series(training))
    trend = "n" if order.d + order.seasonal_d > 0 else "c"
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", ConvergenceWarning)
        # Statsmodels can emit NumPy overflow warnings while constructing
        # discarded start-parameter candidates.  The fitted result is still
        # checked for convergence and finite forecasts below.
        warnings.simplefilter("ignore", RuntimeWarning)
        warnings.filterwarnings("ignore", category=UserWarning, module="statsmodels")
        fitted = SARIMAX(
            transformed,
            order=(order.p, order.d, order.q),
            seasonal_order=(
                order.seasonal_p,
                order.seasonal_d,
                order.seasonal_q,
                order.seasonal_period,
            ),
            trend=trend,
            enforce_stationarity=True,
            enforce_invertibility=True,
        ).fit(disp=False, maxiter=500)
        if not fitted.mle_retvals.get("converged", True):
            raise RuntimeError(f"statsmodels {order.name} did not converge")
        if fitted.arroots.size and np.min(np.abs(fitted.arroots)) <= 1.0:
            raise RuntimeError(f"statsmodels {order.name} has unstable AR roots")
        if fitted.maroots.size and np.min(np.abs(fitted.maroots)) <= 1.0:
            raise RuntimeError(f"statsmodels {order.name} has non-invertible MA roots")
    return fitted


def _as_series(values: Sequence[float]) -> np.ndarray:
    series = np.asarray(values, dtype=float)
    if series.ndim != 1 or series.size == 0:
        raise ValueError("A non-empty one-dimensional series is required")
    if not np.all(np.isfinite(series)):
        raise ValueError("The series contains non-finite observations")
    return series


def _validate_horizon(horizon: int) -> None:
    if not isinstance(horizon, int) or horizon < 1:
        raise ValueError("Forecast horizon must be a positive integer")
