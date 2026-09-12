"""From-scratch multiplicative SARIMA model and forecasting utilities.

The model is estimated with conditional sum of squares.  NumPy implements the
model itself; established scientific libraries are used only for conventional
error metrics and probability distributions used by diagnostics.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import numpy as np
from scipy.stats import chi2
from sklearn.metrics import (
    mean_absolute_error,
    mean_absolute_percentage_error,
    mean_squared_error,
)


@dataclass(frozen=True)
class SarimaOrder:
    """Non-seasonal and seasonal orders for SARIMA(p,d,q)(P,D,Q,s)."""

    p: int
    d: int
    q: int
    seasonal_p: int
    seasonal_d: int
    seasonal_q: int
    seasonal_period: int

    def __post_init__(self) -> None:
        values = (
            self.p,
            self.d,
            self.q,
            self.seasonal_p,
            self.seasonal_d,
            self.seasonal_q,
        )
        if any(value < 0 for value in values):
            raise ValueError("SARIMA orders cannot be negative")
        if self.p > 2 or self.q > 2:
            raise ValueError(
                "This low-order SARIMA implementation supports p and q up to 2"
            )
        if any(
            value > 1
            for value in (
                self.d,
                self.seasonal_p,
                self.seasonal_d,
                self.seasonal_q,
            )
        ):
            raise ValueError("Seasonal and differencing orders must be 0 or 1")
        if self.seasonal_period < 2:
            raise ValueError("The seasonal period must be at least 2")

    @property
    def name(self) -> str:
        return (
            f"SARIMA({self.p},{self.d},{self.q})"
            f"({self.seasonal_p},{self.seasonal_d},"
            f"{self.seasonal_q},{self.seasonal_period})"
        )


class FromScratchSARIMA:
    """Multiplicative SARIMA fitted by conditional sum of squares.

    The implemented model is

        Phi(B^s) phi(B) (1-B)^d (1-B^s)^D y_t
          = Theta(B^s) theta(B) epsilon_t.

    Parameters are estimated with a small Gauss-Newton optimizer whose
    Jacobian is calculated numerically.  Future innovations are set to zero,
    as required for the conditional expectation used in point forecasts.
    """

    def __init__(
        self,
        order: SarimaOrder,
        *,
        use_log: bool = True,
        include_intercept: bool | None = None,
        max_iterations: int = 35,
        tolerance: float = 1e-6,
    ) -> None:
        self.order = order
        self.use_log = use_log
        self.include_intercept = (
            order.d + order.seasonal_d == 0
            if include_intercept is None
            else include_intercept
        )
        self.max_iterations = max_iterations
        self.tolerance = tolerance

        self.parameters: np.ndarray | None = None
        self.residuals: np.ndarray | None = None
        self.differenced_data: np.ndarray | None = None
        self.original_data: np.ndarray | None = None
        self._regular_histories: list[np.ndarray] = []
        self._seasonal_histories: list[np.ndarray] = []
        self.converged = False
        self.iterations = 0
        self.objective = float("inf")

    @property
    def parameter_count(self) -> int:
        count = (
            self.order.p
            + self.order.q
            + self.order.seasonal_p
            + self.order.seasonal_q
        )
        return count + int(self.include_intercept)

    def coefficient_map(self) -> dict[str, float]:
        """Return fitted coefficients using statsmodels-compatible names."""
        if self.parameters is None:
            raise RuntimeError("The SARIMA model must be fitted before reading coefficients")

        phi, theta, seasonal_phi, seasonal_theta, intercept = (
            self._unpack_parameters(self.parameters)
        )
        coefficients: dict[str, float] = {}
        if self.include_intercept:
            coefficients["intercept"] = intercept
        coefficients.update(
            {f"ar.L{lag}": float(value) for lag, value in enumerate(phi, start=1)}
        )
        coefficients.update(
            {
                f"ar.S.L{lag * self.order.seasonal_period}": float(value)
                for lag, value in enumerate(seasonal_phi, start=1)
            }
        )
        coefficients.update(
            {f"ma.L{lag}": float(value) for lag, value in enumerate(theta, start=1)}
        )
        coefficients.update(
            {
                f"ma.S.L{lag * self.order.seasonal_period}": float(value)
                for lag, value in enumerate(seasonal_theta, start=1)
            }
        )
        return coefficients

    def fit(self, data: Sequence[float]) -> "FromScratchSARIMA":
        """Fit the SARIMA parameters to a one-dimensional time series."""
        original = np.asarray(data, dtype=float)
        if original.ndim != 1:
            raise ValueError("SARIMA input must be one-dimensional")
        if not np.all(np.isfinite(original)):
            raise ValueError("SARIMA input contains non-finite values")
        if np.any(original < 0) and self.use_log:
            raise ValueError("Log-transformed SARIMA requires non-negative data")

        transformed = np.log1p(original) if self.use_log else original.copy()
        differenced = self._difference(transformed)
        minimum_length = self._maximum_lag + self.parameter_count + 3
        if len(differenced) < minimum_length:
            raise ValueError(
                f"At least {minimum_length} differenced observations are required"
            )

        initial = self._initial_parameters(differenced)
        fitted_parameters, converged, iterations, objective = self._optimize_parameters(
            differenced, initial
        )
        residuals = self._conditional_residuals(differenced, fitted_parameters)

        self.original_data = original
        self.differenced_data = differenced
        self.parameters = fitted_parameters
        self.residuals = residuals
        self.converged = converged
        self.iterations = iterations
        self.objective = objective

        return self

    def forecast(self, steps: int) -> np.ndarray:
        """Produce recursive point forecasts for the requested horizon."""
        if steps < 1:
            raise ValueError("Forecast steps must be positive")
        if (
            self.parameters is None
            or self.residuals is None
            or self.differenced_data is None
        ):
            raise RuntimeError("The SARIMA model must be fitted before forecasting")

        values = list(self.differenced_data)
        innovations = list(self.residuals)
        forecasts = np.empty(steps, dtype=float)

        for index in range(steps):
            prediction = self._conditional_prediction(
                values, innovations, len(values), self.parameters
            )
            forecasts[index] = prediction
            values.append(prediction)
            innovations.append(0.0)

        integrated = self._inverse_difference(forecasts)
        if self.use_log:
            integrated = np.expm1(integrated)
        return np.maximum(integrated, 0.0)

    def forecast_samples(
        self,
        steps: int,
        *,
        simulations: int = 2_000,
        random_state: int = 42,
    ) -> np.ndarray:
        """Simulate future paths by resampling centered model innovations.

        This residual bootstrap preserves recursive ARIMA dynamics and is used
        to form empirical prediction intervals.  It does not assume normally
        distributed errors.
        """
        if steps < 1:
            raise ValueError("Forecast steps must be positive")
        if simulations < 100:
            raise ValueError("At least 100 simulations are required")
        if (
            self.parameters is None
            or self.residuals is None
            or self.differenced_data is None
        ):
            raise RuntimeError("The SARIMA model must be fitted before forecasting")

        effective = self.residuals[self._maximum_lag :]
        effective = effective[np.isfinite(effective)]
        if effective.size == 0:
            raise RuntimeError("The fitted model has no usable innovations")
        innovations_pool = effective - float(np.mean(effective))
        random = np.random.default_rng(random_state)
        samples = np.empty((simulations, steps), dtype=float)

        for simulation in range(simulations):
            values = list(self.differenced_data)
            innovations = list(self.residuals)
            simulated_differences = np.empty(steps, dtype=float)
            for step in range(steps):
                conditional_mean = self._conditional_prediction(
                    values, innovations, len(values), self.parameters
                )
                innovation = float(random.choice(innovations_pool))
                simulated_value = conditional_mean + innovation
                simulated_differences[step] = simulated_value
                values.append(simulated_value)
                innovations.append(innovation)

            restored = self._inverse_difference(simulated_differences)
            if self.use_log:
                restored = np.expm1(restored)
            samples[simulation] = np.maximum(restored, 0.0)

        return samples

    def prediction_intervals(
        self,
        steps: int,
        *,
        levels: Sequence[float] = (0.80,),
        simulations: int = 2_000,
        random_state: int = 42,
    ) -> dict[float, tuple[np.ndarray, np.ndarray]]:
        """Return empirical lower and upper bounds for each requested level."""
        samples = self.forecast_samples(
            steps,
            simulations=simulations,
            random_state=random_state,
        )
        intervals: dict[float, tuple[np.ndarray, np.ndarray]] = {}
        for level in levels:
            if not 0.0 < level < 1.0:
                raise ValueError("Prediction interval levels must lie between 0 and 1")
            tail = (1.0 - level) / 2.0
            intervals[float(level)] = (
                np.quantile(samples, tail, axis=0),
                np.quantile(samples, 1.0 - tail, axis=0),
            )
        return intervals

    def characteristic_roots(self) -> dict[str, np.ndarray]:
        """Return roots of the fitted AR and MA lag polynomials."""
        if self.parameters is None:
            raise RuntimeError("The SARIMA model must be fitted before diagnostics")
        phi, theta, seasonal_phi, seasonal_theta, _ = self._unpack_parameters(
            self.parameters
        )
        ar_regular = np.concatenate(([1.0], -phi))
        ma_regular = np.concatenate(([1.0], theta))
        ar_seasonal = np.zeros(self.order.seasonal_p * self.order.seasonal_period + 1)
        ma_seasonal = np.zeros(self.order.seasonal_q * self.order.seasonal_period + 1)
        ar_seasonal[0] = 1.0
        ma_seasonal[0] = 1.0
        for index, coefficient in enumerate(seasonal_phi, start=1):
            ar_seasonal[index * self.order.seasonal_period] = -coefficient
        for index, coefficient in enumerate(seasonal_theta, start=1):
            ma_seasonal[index * self.order.seasonal_period] = coefficient

        ar_polynomial = np.polynomial.polynomial.polymul(ar_regular, ar_seasonal)
        ma_polynomial = np.polynomial.polynomial.polymul(ma_regular, ma_seasonal)
        return {
            "ar": _polynomial_roots(ar_polynomial),
            "ma": _polynomial_roots(ma_polynomial),
        }

    def residual_diagnostics(self, lags: Sequence[int] = (7, 14, 21)) -> dict:
        """Summarize residual autocorrelation and Ljung-Box tests."""
        if self.residuals is None:
            raise RuntimeError("The SARIMA model must be fitted before diagnostics")
        residuals = self.residuals[self._maximum_lag :]
        maximum_lag = min(max(lags), max(len(residuals) - 1, 1))
        correlations = sample_autocorrelation(residuals, maximum_lag)
        tests = ljung_box_test(
            residuals,
            [lag for lag in lags if lag <= maximum_lag],
            model_df=self.parameter_count,
        )
        roots = self.characteristic_roots()
        return {
            "count": int(len(residuals)),
            "mean": float(np.mean(residuals)),
            "standard_deviation": float(np.std(residuals, ddof=1)),
            "acf": correlations.tolist(),
            "ljung_box": tests,
            "minimum_ar_root_modulus": _minimum_root_modulus(roots["ar"]),
            "minimum_ma_root_modulus": _minimum_root_modulus(roots["ma"]),
            "stationary_ar": bool(
                roots["ar"].size == 0 or np.all(np.abs(roots["ar"]) > 1.0)
            ),
            "invertible_ma": bool(
                roots["ma"].size == 0 or np.all(np.abs(roots["ma"]) > 1.0)
            ),
        }

    @property
    def _maximum_lag(self) -> int:
        seasonal_period = self.order.seasonal_period
        return max(
            self.order.p,
            self.order.q,
            self.order.seasonal_p * seasonal_period,
            self.order.seasonal_q * seasonal_period,
            self.order.p + self.order.seasonal_p * seasonal_period,
            self.order.q + self.order.seasonal_q * seasonal_period,
            1,
        )

    def _difference(self, values: np.ndarray) -> np.ndarray:
        result = values.copy()
        self._regular_histories = []
        self._seasonal_histories = []

        for _ in range(self.order.d):
            self._regular_histories.append(result.copy())
            result = np.diff(result)

        period = self.order.seasonal_period
        for _ in range(self.order.seasonal_d):
            if len(result) <= period:
                raise ValueError("Not enough observations for seasonal differencing")
            self._seasonal_histories.append(result.copy())
            result = result[period:] - result[:-period]

        return result

    def _inverse_difference(self, forecasts: np.ndarray) -> np.ndarray:
        result = forecasts.copy()
        period = self.order.seasonal_period

        for history in reversed(self._seasonal_histories):
            restored = np.empty_like(result)
            for step, value in enumerate(result):
                source_index = len(history) + step - period
                seasonal_base = (
                    history[source_index]
                    if source_index < len(history)
                    else restored[source_index - len(history)]
                )
                restored[step] = value + seasonal_base
            result = restored

        for history in reversed(self._regular_histories):
            result = history[-1] + np.cumsum(result)

        return result

    def _initial_parameters(self, values: np.ndarray) -> np.ndarray:
        parameters = np.zeros(self.parameter_count, dtype=float)
        offset = int(self.include_intercept)
        if self.include_intercept:
            parameters[0] = float(np.mean(values))

        ar_count = self.order.p + self.order.seasonal_p
        if ar_count == 0:
            return parameters

        start = max(
            self.order.p,
            self.order.seasonal_p * self.order.seasonal_period,
            1,
        )
        features: list[list[float]] = []
        targets: list[float] = []
        for index in range(start, len(values)):
            row = [values[index - lag] for lag in range(1, self.order.p + 1)]
            row.extend(
                values[index - lag * self.order.seasonal_period]
                for lag in range(1, self.order.seasonal_p + 1)
            )
            if self.include_intercept:
                row.insert(0, 1.0)
            features.append(row)
            targets.append(values[index])

        try:
            estimate, *_ = np.linalg.lstsq(
                np.asarray(features), np.asarray(targets), rcond=None
            )
            if self.include_intercept:
                parameters[0] = estimate[0]
                parameters[offset : offset + ar_count] = estimate[1:]
            else:
                parameters[:ar_count] = estimate
        except np.linalg.LinAlgError:
            pass

        parameters[offset : offset + ar_count] = np.clip(
            parameters[offset : offset + ar_count], -0.8, 0.8
        )
        return parameters

    def _optimize_parameters(
        self, values: np.ndarray, initial: np.ndarray
    ) -> tuple[np.ndarray, bool, int, float]:
        parameters = initial.copy()
        start = self._maximum_lag
        finite_difference_step = 1e-5
        ridge = 1e-6

        def objective(candidate: np.ndarray) -> tuple[float, np.ndarray]:
            residuals = self._conditional_residuals(values, candidate)[start:]
            if not np.all(np.isfinite(residuals)):
                return float("inf"), residuals
            with np.errstate(over="ignore", invalid="ignore"):
                score = float(np.dot(residuals, residuals))
            return (score if np.isfinite(score) else float("inf")), residuals

        current_score, current_residuals = objective(parameters)
        if not np.isfinite(current_score):
            parameters = np.zeros_like(parameters)
            current_score, current_residuals = objective(parameters)
        if not np.isfinite(current_score):
            raise RuntimeError("SARIMA optimization could not find a finite start")
        if parameters.size == 0:
            return parameters, True, 0, current_score

        converged = False
        completed_iterations = 0
        for iteration in range(1, self.max_iterations + 1):
            completed_iterations = iteration
            jacobian = np.empty(
                (len(current_residuals), len(parameters)), dtype=float
            )
            for parameter_index in range(len(parameters)):
                perturbed = parameters.copy()
                perturbed[parameter_index] += finite_difference_step
                _, perturbed_residuals = objective(perturbed)
                jacobian[:, parameter_index] = (
                    perturbed_residuals - current_residuals
                ) / finite_difference_step

            with np.errstate(over="ignore", invalid="ignore", divide="ignore"):
                normal_matrix = jacobian.T @ jacobian + ridge * np.eye(
                    len(parameters)
                )
                gradient = jacobian.T @ current_residuals
            if not np.all(np.isfinite(normal_matrix)) or not np.all(
                np.isfinite(gradient)
            ):
                break
            try:
                direction = np.linalg.solve(normal_matrix, -gradient)
            except np.linalg.LinAlgError:
                direction = np.linalg.lstsq(normal_matrix, -gradient, rcond=None)[0]

            accepted = False
            for scale in (1.0, 0.5, 0.25, 0.1, 0.05, 0.01):
                candidate = self._clip_parameters(parameters + scale * direction)
                candidate_score, candidate_residuals = objective(candidate)
                if np.isfinite(candidate_score) and candidate_score < current_score:
                    improvement = current_score - candidate_score
                    parameters = candidate
                    current_score = candidate_score
                    current_residuals = candidate_residuals
                    accepted = True
                    break

            if not accepted:
                converged = bool(
                    np.linalg.norm(gradient, ord=np.inf)
                    <= np.sqrt(self.tolerance) * max(current_score, 1.0)
                )
                break
            if improvement <= self.tolerance * max(current_score, 1.0):
                converged = True
                break

        return parameters, converged, completed_iterations, current_score

    def _clip_parameters(self, parameters: np.ndarray) -> np.ndarray:
        clipped = parameters.copy()
        offset = int(self.include_intercept)
        clipped[offset:] = np.clip(clipped[offset:], -0.98, 0.98)
        return clipped

    def _conditional_residuals(
        self, values: np.ndarray, parameters: np.ndarray
    ) -> np.ndarray:
        residuals = np.zeros(len(values), dtype=float)
        for index in range(len(values)):
            prediction = self._conditional_prediction(
                values, residuals, index, parameters
            )
            residuals[index] = values[index] - prediction
        return residuals

    def _conditional_prediction(
        self,
        values: Sequence[float],
        residuals: Sequence[float],
        index: int,
        parameters: np.ndarray,
    ) -> float:
        phi, theta, seasonal_phi, seasonal_theta, intercept = (
            self._unpack_parameters(parameters)
        )
        period = self.order.seasonal_period
        prediction = intercept

        for lag, coefficient in enumerate(phi, start=1):
            if index >= lag:
                prediction += coefficient * values[index - lag]
        for lag, coefficient in enumerate(seasonal_phi, start=1):
            seasonal_lag = lag * period
            if index >= seasonal_lag:
                prediction += coefficient * values[index - seasonal_lag]
        for regular_lag, regular_coefficient in enumerate(phi, start=1):
            for seasonal_lag, seasonal_coefficient in enumerate(
                seasonal_phi, start=1
            ):
                combined_lag = regular_lag + seasonal_lag * period
                if index >= combined_lag:
                    prediction -= (
                        regular_coefficient
                        * seasonal_coefficient
                        * values[index - combined_lag]
                    )

        for lag, coefficient in enumerate(theta, start=1):
            if index >= lag:
                prediction += coefficient * residuals[index - lag]
        for lag, coefficient in enumerate(seasonal_theta, start=1):
            seasonal_lag = lag * period
            if index >= seasonal_lag:
                prediction += coefficient * residuals[index - seasonal_lag]
        for regular_lag, regular_coefficient in enumerate(theta, start=1):
            for seasonal_lag, seasonal_coefficient in enumerate(
                seasonal_theta, start=1
            ):
                combined_lag = regular_lag + seasonal_lag * period
                if index >= combined_lag:
                    prediction += (
                        regular_coefficient
                        * seasonal_coefficient
                        * residuals[index - combined_lag]
                    )

        return float(prediction)

    def _unpack_parameters(
        self, parameters: np.ndarray
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, float]:
        cursor = 0
        intercept = 0.0
        if self.include_intercept:
            intercept = float(parameters[cursor])
            cursor += 1

        phi = parameters[cursor : cursor + self.order.p]
        cursor += self.order.p
        seasonal_phi = parameters[cursor : cursor + self.order.seasonal_p]
        cursor += self.order.seasonal_p
        theta = parameters[cursor : cursor + self.order.q]
        cursor += self.order.q
        seasonal_theta = parameters[cursor : cursor + self.order.seasonal_q]
        return phi, theta, seasonal_phi, seasonal_theta, intercept


def calculate_forecast_metrics(
    actual: Sequence[float],
    predicted: Sequence[float],
    *,
    insample: Sequence[float] | None = None,
    seasonal_period: int = 7,
) -> dict[str, float]:
    """Calculate scale-dependent, percentage, and scaled forecast errors."""
    actual_values = np.asarray(actual, dtype=float)
    predicted_values = np.asarray(predicted, dtype=float)
    if actual_values.shape != predicted_values.shape or actual_values.size == 0:
        raise ValueError("Actual and predicted values must have equal, non-zero length")

    mae = float(mean_absolute_error(actual_values, predicted_values))
    rmse = float(np.sqrt(mean_squared_error(actual_values, predicted_values)))
    non_zero = np.abs(actual_values) > np.finfo(float).eps
    mape = (
        float(
            mean_absolute_percentage_error(
                actual_values[non_zero], predicted_values[non_zero]
            )
            * 100
        )
        if np.any(non_zero)
        else 0.0
    )
    mean_actual = float(np.mean(actual_values))
    normalizer = abs(mean_actual) if abs(mean_actual) > np.finfo(float).eps else 1.0
    absolute_error_sum = float(np.sum(np.abs(actual_values - predicted_values)))
    actual_sum = float(np.sum(np.abs(actual_values)))
    wape = absolute_error_sum / actual_sum * 100 if actual_sum > 0 else 0.0

    mase = float("nan")
    rmsse = float("nan")
    if insample is not None:
        training = np.asarray(insample, dtype=float)
        lag = seasonal_period if len(training) > seasonal_period else 1
        differences = training[lag:] - training[:-lag]
        mae_scale = float(np.mean(np.abs(differences))) if differences.size else 0.0
        mse_scale = float(np.mean(np.square(differences))) if differences.size else 0.0
        if mae_scale > np.finfo(float).eps:
            mase = mae / mae_scale
        if mse_scale > np.finfo(float).eps:
            rmsse = rmse / np.sqrt(mse_scale)

    return {
        "mae": mae,
        "rmse": rmse,
        "mape": mape,
        "mae_normalized": mae / normalizer,
        "rmse_normalized": rmse / normalizer,
        "mean_actual": mean_actual,
        "wape": wape,
        "mase": mase,
        "rmsse": rmsse,
    }


def sample_autocorrelation(values: Sequence[float], max_lag: int) -> np.ndarray:
    """Calculate the sample autocorrelation from lag zero through max_lag."""
    observations = np.asarray(values, dtype=float)
    if observations.ndim != 1 or observations.size < 2:
        raise ValueError("At least two one-dimensional observations are required")
    max_lag = min(int(max_lag), observations.size - 1)
    centered = observations - float(np.mean(observations))
    denominator = float(np.dot(centered, centered))
    result = np.zeros(max_lag + 1, dtype=float)
    result[0] = 1.0
    if denominator <= np.finfo(float).eps:
        return result
    for lag in range(1, max_lag + 1):
        result[lag] = float(np.dot(centered[lag:], centered[:-lag]) / denominator)
    return result


def ljung_box_test(
    values: Sequence[float],
    lags: Sequence[int],
    *,
    model_df: int = 0,
) -> list[dict[str, float | int]]:
    """Calculate Ljung-Box Q statistics and chi-square p-values."""
    observations = np.asarray(values, dtype=float)
    if observations.ndim != 1 or observations.size < 3:
        raise ValueError("At least three residuals are required")
    requested = sorted({int(lag) for lag in lags if 0 < lag < len(observations)})
    if not requested:
        return []
    acf = sample_autocorrelation(observations, max(requested))
    sample_size = len(observations)
    results: list[dict[str, float | int]] = []
    for lag in requested:
        q_statistic = sample_size * (sample_size + 2.0) * float(
            np.sum(
                [
                    (acf[index] ** 2) / (sample_size - index)
                    for index in range(1, lag + 1)
                ]
            )
        )
        degrees_of_freedom = max(lag - model_df, 1)
        results.append(
            {
                "lag": lag,
                "statistic": q_statistic,
                "degrees_of_freedom": degrees_of_freedom,
                "p_value": float(chi2.sf(q_statistic, degrees_of_freedom)),
            }
        )
    return results


def _polynomial_roots(coefficients: np.ndarray) -> np.ndarray:
    trimmed = np.trim_zeros(np.asarray(coefficients, dtype=float), trim="b")
    if trimmed.size <= 1:
        return np.array([], dtype=complex)
    return np.roots(trimmed[::-1])


def _minimum_root_modulus(roots: np.ndarray) -> float | None:
    return float(np.min(np.abs(roots))) if roots.size else None
