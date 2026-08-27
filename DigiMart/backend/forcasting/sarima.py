"""From-scratch multiplicative SARIMA model.

Only NumPy is used to fit the model.  Scikit-learn is used for the three
reported error metrics so that the evaluation code remains conventional and
easy to audit.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import numpy as np
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
        self._aic = float("inf")

    @property
    def model_name(self) -> str:
        return self.order.name

    @property
    def aic(self) -> float:
        return self._aic

    @property
    def parameter_count(self) -> int:
        count = (
            self.order.p
            + self.order.q
            + self.order.seasonal_p
            + self.order.seasonal_q
        )
        return count + int(self.include_intercept)

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
        fitted_parameters = self._optimize_parameters(differenced, initial)
        residuals = self._conditional_residuals(differenced, fitted_parameters)
        effective_residuals = residuals[self._maximum_lag :]

        self.original_data = original
        self.differenced_data = differenced
        self.parameters = fitted_parameters
        self.residuals = residuals

        residual_sum_squares = max(
            float(np.dot(effective_residuals, effective_residuals)), 1e-12
        )
        sample_size = len(effective_residuals)
        self._aic = (
            sample_size * np.log(residual_sum_squares / sample_size)
            + 2 * self.parameter_count
        )
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
    ) -> np.ndarray:
        parameters = initial.copy()
        start = self._maximum_lag
        finite_difference_step = 1e-5
        ridge = 1e-6

        def objective(candidate: np.ndarray) -> tuple[float, np.ndarray]:
            residuals = self._conditional_residuals(values, candidate)[start:]
            return float(np.dot(residuals, residuals)), residuals

        current_score, current_residuals = objective(parameters)
        for _ in range(self.max_iterations):
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

            normal_matrix = jacobian.T @ jacobian + ridge * np.eye(len(parameters))
            gradient = jacobian.T @ current_residuals
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

            if not accepted or improvement <= self.tolerance * max(current_score, 1.0):
                break

        return parameters

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
    actual: Sequence[float], predicted: Sequence[float]
) -> dict[str, float]:
    """Calculate MAE, RMSE, MAPE and mean-normalized errors."""
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

    return {
        "mae": mae,
        "rmse": rmse,
        "mape": mape,
        "mae_normalized": mae / normalizer,
        "rmse_normalized": rmse / normalizer,
        "mean_actual": mean_actual,
    }
