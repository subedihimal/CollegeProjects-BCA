"""Serve saved forecasts and rebuild them only when explicitly requested."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Lock
from time import perf_counter
from typing import Any

from flask import Flask, jsonify, request


ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / "artifacts"
DATA_FILE = ROOT / "data" / "cleaned_customer_data.csv"
PERIOD = "15days"
HORIZON = 15
FILES = {
    "manifest": "manifest.json",
    "forecast": f"forecast-{PERIOD}.json",
    "metrics": f"metrics-{PERIOD}.json",
}

app = Flask(__name__)
artifact_lock = Lock()
recalculation_lock = Lock()
artifact_bundle: dict[str, dict[str, Any]] | None = None


class ArtifactError(RuntimeError):
    pass


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def _pipeline_hash() -> str:
    digest = hashlib.sha256()
    for name in ("sarima.py", "evaluation.py", "generate_artifacts.py"):
        path = ROOT / name
        digest.update(name.encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def _read_artifacts(directory: Path = ARTIFACTS) -> dict[str, dict[str, Any]]:
    try:
        bundle = {
            key: json.loads((directory / name).read_text(encoding="utf-8"))
            for key, name in FILES.items()
        }
    except (FileNotFoundError, json.JSONDecodeError) as error:
        raise ArtifactError(f"Forecast artifacts are unavailable: {error}") from error

    manifest = bundle["manifest"]
    forecast = bundle["forecast"]
    metrics = bundle["metrics"]
    if manifest.get("schemaVersion") != 2 or manifest.get("horizons") != [HORIZON]:
        raise ArtifactError("Forecast artifacts use an unsupported format")
    if not DATA_FILE.exists() or manifest.get("datasetSha256") != _sha256(DATA_FILE):
        raise ArtifactError("Forecast dataset changed; recalculate the forecast")
    if manifest.get("pipelineSha256") != _pipeline_hash():
        raise ArtifactError("Forecasting code changed; recalculate the forecast")
    if len(forecast.get("dailyForecast", [])) != HORIZON:
        raise ArtifactError("Forecast artifact has the wrong horizon")
    if metrics.get("main_model", {}).get("horizon_days") != HORIZON:
        raise ArtifactError("Metrics artifact has the wrong horizon")
    return bundle


def _current_artifacts() -> dict[str, dict[str, Any]]:
    global artifact_bundle
    if artifact_bundle is None:
        with artifact_lock:
            if artifact_bundle is None:
                artifact_bundle = _read_artifacts()
    return artifact_bundle


def _replace_artifacts(bundle: dict[str, Any]) -> None:
    global artifact_bundle
    normalized = {
        "manifest": bundle["manifest"],
        "forecast": bundle["forecasts"][str(HORIZON)],
        "metrics": bundle["metrics"][str(HORIZON)],
    }
    with artifact_lock:
        artifact_bundle = normalized


def _authorized() -> bool:
    secret = os.environ.get("FORECAST_RECALC_SECRET", "")
    if not secret:
        return not os.environ.get("VERCEL")
    return hmac.compare_digest(
        request.headers.get("X-Forecast-Recalculation-Key", ""), secret
    )


def _generate(directory: Path) -> dict[str, Any]:
    try:
        from .generate_artifacts import generate_artifact_bundle
    except ImportError:
        from generate_artifacts import generate_artifact_bundle
    return generate_artifact_bundle(directory, include_report_assets=False)


def _save_local(directory: Path) -> None:
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    for name in FILES.values():
        (directory / name).replace(ARTIFACTS / name)


@app.errorhandler(ArtifactError)
def artifact_error(error: ArtifactError):
    return jsonify({"error": str(error), "status": "artifact_unavailable"}), 503


def _period_error():
    if request.args.get("period", PERIOD) != PERIOD:
        return jsonify({"error": f"period must be {PERIOD}"}), 400
    return None


@app.get("/api/sales/forecast")
def get_forecast():
    return _period_error() or jsonify(_current_artifacts()["forecast"])


@app.get("/api/sales/metrics")
def get_metrics():
    return _period_error() or jsonify(_current_artifacts()["metrics"])


@app.post("/api/sales/recalculate")
def recalculate_forecast():
    if not _authorized():
        return jsonify({"error": "Forecast recalculation is not authorized"}), 403
    if not recalculation_lock.acquire(blocking=False):
        return jsonify({"error": "Forecast recalculation is already running"}), 409

    started = perf_counter()
    try:
        with TemporaryDirectory(prefix="digimart-forecast-") as temporary:
            directory = Path(temporary)
            bundle = _generate(directory)
            _replace_artifacts(bundle)
            persistence = "temporary"
            if not os.environ.get("VERCEL"):
                _save_local(directory)
                persistence = "local_files"

        return jsonify(
            {
                "status": "success",
                "generatedAt": bundle["manifest"]["generatedAt"],
                "durationSeconds": round(perf_counter() - started, 2),
                "persistence": persistence,
                "forecast": bundle["forecasts"][str(HORIZON)],
                "metrics": bundle["metrics"][str(HORIZON)],
            }
        )
    except Exception as error:
        app.logger.exception("Forecast recalculation failed")
        return jsonify({"error": str(error), "status": "recalculation_failed"}), 500
    finally:
        recalculation_lock.release()


@app.get("/health")
def health():
    try:
        manifest = _current_artifacts()["manifest"]
        return jsonify(
            {
                "status": "healthy",
                "service": "DigiMart forecasting API",
                "generated_at": manifest["generatedAt"],
            }
        )
    except ArtifactError as error:
        return jsonify({"status": "degraded", "error": str(error)}), 503


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
