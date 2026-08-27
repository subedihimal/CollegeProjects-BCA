"""Focused correctness tests for the from-scratch SARIMA implementation."""

import unittest

import numpy as np

from sarima import FromScratchSARIMA, SarimaOrder, calculate_forecast_metrics


class FromScratchSarimaTests(unittest.TestCase):
    def test_seasonal_difference_repeats_a_weekly_pattern(self) -> None:
        weekly_pattern = np.array([90, 105, 110, 125, 120, 80, 70], dtype=float)
        series = np.tile(weekly_pattern, 20)
        model = FromScratchSARIMA(
            SarimaOrder(0, 0, 0, 0, 1, 0, 7)
        ).fit(series)

        np.testing.assert_allclose(
            model.forecast(14), np.tile(weekly_pattern, 2), rtol=1e-8
        )

    def test_multiplicative_ar_parameters_are_recovered(self) -> None:
        random = np.random.default_rng(42)
        regular_phi = 0.35
        seasonal_phi = 0.55
        values = np.zeros(600, dtype=float)

        for index in range(8, len(values)):
            values[index] = (
                regular_phi * values[index - 1]
                + seasonal_phi * values[index - 7]
                - regular_phi * seasonal_phi * values[index - 8]
                + random.normal(0, 0.1)
            )

        model = FromScratchSARIMA(
            SarimaOrder(1, 0, 0, 1, 0, 0, 7),
            use_log=False,
            include_intercept=False,
        ).fit(values[100:])

        self.assertAlmostEqual(model.parameters[0], regular_phi, delta=0.12)
        self.assertAlmostEqual(model.parameters[1], seasonal_phi, delta=0.12)

    def test_multiplicative_ma_parameters_are_recovered(self) -> None:
        random = np.random.default_rng(7)
        regular_theta = 0.30
        seasonal_theta = 0.50
        innovations = random.normal(0, 0.1, 800)
        values = innovations.copy()
        values[1:] += regular_theta * innovations[:-1]
        values[7:] += seasonal_theta * innovations[:-7]
        values[8:] += regular_theta * seasonal_theta * innovations[:-8]

        model = FromScratchSARIMA(
            SarimaOrder(0, 0, 1, 0, 0, 1, 7),
            use_log=False,
            include_intercept=False,
            max_iterations=50,
        ).fit(values[100:])

        self.assertAlmostEqual(model.parameters[0], regular_theta, delta=0.12)
        self.assertAlmostEqual(model.parameters[1], seasonal_theta, delta=0.12)

    def test_error_metrics_match_known_values(self) -> None:
        metrics = calculate_forecast_metrics([100, 200], [90, 220])

        self.assertAlmostEqual(metrics["mae"], 15.0)
        self.assertAlmostEqual(metrics["rmse"], np.sqrt(250.0))
        self.assertAlmostEqual(metrics["mape"], 10.0)


if __name__ == "__main__":
    unittest.main()
