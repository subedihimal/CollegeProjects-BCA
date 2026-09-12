"""Focused correctness tests for the from-scratch SARIMA implementation."""

import unittest

import numpy as np

from sarima import FromScratchSARIMA, SarimaOrder, calculate_forecast_metrics


class FromScratchSarimaTests(unittest.TestCase):
    def test_declared_search_space_accepts_second_order_ar_and_ma_terms(self) -> None:
        SarimaOrder(2, 0, 2, 1, 1, 1, 7)
        with self.assertRaises(ValueError):
            SarimaOrder(3, 0, 0, 0, 0, 0, 7)
        with self.assertRaises(ValueError):
            SarimaOrder(0, 0, 0, 2, 0, 0, 7)

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
        metrics = calculate_forecast_metrics(
            [100, 200],
            [90, 220],
            insample=[1, 2, 3, 4],
            seasonal_period=1,
        )

        self.assertAlmostEqual(metrics["mae"], 15.0)
        self.assertAlmostEqual(metrics["rmse"], np.sqrt(250.0))
        self.assertAlmostEqual(metrics["mape"], 10.0)
        self.assertAlmostEqual(metrics["mase"], 15.0)
        self.assertAlmostEqual(metrics["wape"], 10.0)

    def test_fitted_coefficients_have_standard_names(self) -> None:
        random = np.random.default_rng(5)
        series = np.exp(10 + random.normal(0, 0.1, 150))
        model = FromScratchSARIMA(SarimaOrder(0, 0, 1, 0, 0, 0, 7)).fit(series)

        coefficients = model.coefficient_map()
        self.assertEqual(set(coefficients), {"intercept", "ma.L1"})
        self.assertTrue(all(np.isfinite(value) for value in coefficients.values()))

    def test_zero_parameter_random_walk_converges_without_optimization(self) -> None:
        series = np.arange(1, 101, dtype=float)
        model = FromScratchSARIMA(
            SarimaOrder(0, 1, 0, 0, 0, 0, 7), use_log=False
        ).fit(series)

        self.assertTrue(model.converged)
        self.assertEqual(model.iterations, 0)
        np.testing.assert_allclose(model.forecast(3), [100, 100, 100])

    def test_bootstrap_intervals_are_reproducible_and_ordered(self) -> None:
        random = np.random.default_rng(21)
        series = 100 + np.cumsum(random.normal(0, 2, 180))
        model = FromScratchSARIMA(SarimaOrder(1, 0, 0, 0, 1, 1, 7)).fit(series)

        first = model.prediction_intervals(7, simulations=200, random_state=9)
        second = model.prediction_intervals(7, simulations=200, random_state=9)
        for level in (0.80, 0.95):
            np.testing.assert_allclose(first[level][0], second[level][0])
            np.testing.assert_allclose(first[level][1], second[level][1])
            self.assertTrue(np.all(first[level][0] <= first[level][1]))
        self.assertTrue(np.all(first[0.95][0] <= first[0.80][0]))
        self.assertTrue(np.all(first[0.80][1] <= first[0.95][1]))

    def test_residual_diagnostics_report_roots_and_ljung_box(self) -> None:
        random = np.random.default_rng(13)
        values = np.zeros(300, dtype=float)
        for index in range(1, len(values)):
            values[index] = 0.4 * values[index - 1] + random.normal(0, 0.2)
        model = FromScratchSARIMA(
            SarimaOrder(1, 0, 0, 0, 0, 0, 7),
            use_log=False,
            include_intercept=False,
        ).fit(values)

        diagnostics = model.residual_diagnostics((7, 14))
        self.assertTrue(diagnostics["stationary_ar"])
        self.assertGreater(diagnostics["minimum_ar_root_modulus"], 1.0)
        self.assertEqual([row["lag"] for row in diagnostics["ljung_box"]], [7, 14])


if __name__ == "__main__":
    unittest.main()
