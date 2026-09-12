"""Focused tests for chronological forecast evaluation."""

import unittest

import numpy as np

from evaluation import (
    REVENUE_TRAINING_WINDOWS,
    aggregate_fold_metrics,
    candidate_orders,
    chronological_split,
    development_windows,
    final_test_windows,
    naive_forecast,
    seasonal_naive_forecast,
    training_sample,
)


class ForecastEvaluationTests(unittest.TestCase):
    def test_candidate_grid(self) -> None:
        orders = candidate_orders()
        self.assertEqual(len(orders), 72)
        self.assertEqual(len(set(orders)), 72)
        self.assertEqual(REVENUE_TRAINING_WINDOWS, (91, 126, 182, None))

    def test_training_window(self) -> None:
        history = np.arange(200, dtype=float)
        np.testing.assert_array_equal(training_sample(history, 91), history[-91:])

    def test_chronological_split(self) -> None:
        train, test = chronological_split(np.arange(120, dtype=float), 0.80)
        np.testing.assert_array_equal(train, np.arange(96, dtype=float))
        np.testing.assert_array_equal(test, np.arange(96, 120, dtype=float))

    def test_development_windows_do_not_leak(self) -> None:
        windows = development_windows(np.arange(300, dtype=float), 15)
        self.assertEqual(len(windows), 7)
        for window in windows:
            self.assertEqual(window.test[0], window.train[-1] + 1)

    def test_pooled_rmse(self) -> None:
        metrics = {
            key: 1.0
            for key in (
                "mae", "mape", "wape", "mase", "rmsse",
                "mae_normalized", "rmse_normalized", "mean_actual",
            )
        }
        folds = [
            {"test_size": 1, "metrics": {**metrics, "rmse": 3.0}},
            {"test_size": 3, "metrics": {**metrics, "rmse": 4.0}},
        ]
        self.assertAlmostEqual(aggregate_fold_metrics(folds)["rmse"], np.sqrt(14.25))

    def test_final_windows_cover_holdout_once(self) -> None:
        development = np.arange(100, dtype=float)
        holdout = np.arange(100, 123, dtype=float)
        windows = final_test_windows(development, holdout, 15)
        np.testing.assert_array_equal(
            np.concatenate([window.test for window in windows]), holdout
        )

    def test_naive_baselines(self) -> None:
        training = np.arange(1, 15, dtype=float)
        np.testing.assert_array_equal(naive_forecast(training, 3), [14, 14, 14])
        np.testing.assert_array_equal(
            seasonal_naive_forecast(training, 9), [8, 9, 10, 11, 12, 13, 14, 8, 9]
        )


if __name__ == "__main__":
    unittest.main()
