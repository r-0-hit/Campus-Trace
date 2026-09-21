"""Training and Model Persistence for Campus Trace Exposure Risk Estimation.

SYNTHETIC DEMO DATA ONLY.
Model output is a computational decision-support signal, NOT a clinical diagnosis.
"""
import os
import sys
from pathlib import Path
import numpy as np
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, r2_score

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.features.extractor import FeatureExtractor, ExposureInput


class ModelTrainer:
    """Trains a Random Forest Regressor on synthetic contact scenarios."""

    MODEL_VERSION = "demo-rf-1.0.0"
    FEATURE_VERSION = "v1.0"

    def __init__(self, random_state: int = 42):
        self.random_state = random_state
        self.extractor = FeatureExtractor()
        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=6,
            random_state=self.random_state,
        )

    def generate_synthetic_dataset(self, n_samples: int = 2000):
        rng = np.random.default_rng(self.random_state)
        inputs = []
        targets = []

        for _ in range(n_samples):
            duration = rng.uniform(2.0, 120.0)
            distance = rng.uniform(0.3, 8.0)
            encounters = int(rng.integers(1, 8))
            recency = rng.uniform(0.5, 120.0)
            indoor = bool(rng.choice([True, False], p=[0.7, 0.3]))
            graph_dist = int(rng.choice([1, 2, 3], p=[0.5, 0.35, 0.15]))

            inp = ExposureInput(
                duration_minutes=duration,
                distance_meters=distance,
                encounters=encounters,
                recency_hours=recency,
                indoor=indoor,
                graph_distance=graph_dist,
            )
            features = self.extractor.extract_features(inp)

            # Heuristic synthetic risk formula with controlled noise
            raw_score = (
                features[0] * 30.0 +  # duration
                features[1] * 24.0 +  # distance
                features[2] * 16.0 +  # encounter count
                features[3] * 14.0 +  # recency
                features[4] * 10.0 +  # indoor environment
                features[5] * 6.0     # graph proximity
            )
            # Add small synthetic perturbation
            noise = rng.normal(0.0, 2.0)
            final_score = float(np.clip(raw_score + noise, 0.0, 100.0))

            inputs.append(inp)
            targets.append(final_score)

        X = self.extractor.extract_batch(inputs)
        y = np.array(targets, dtype=np.float32)
        return X, y

    def train_and_evaluate(self, n_samples: int = 2500):
        X, y = self.generate_synthetic_dataset(n_samples=n_samples)
        split = int(0.8 * len(X))
        X_train, X_test = X[:split], X[split:]
        y_train, y_test = y[:split], y[split:]

        self.model.fit(X_train, y_train)
        predictions = self.model.predict(X_test)

        mse = mean_squared_error(y_test, predictions)
        r2 = r2_score(y_test, predictions)

        metrics = {
            "mse": float(mse),
            "rmse": float(np.sqrt(mse)),
            "r2": float(r2),
            "feature_importances": {
                name: float(imp)
                for name, imp in zip(self.extractor.FEATURE_NAMES, self.model.feature_importances_)
            },
            "model_version": self.MODEL_VERSION,
            "feature_version": self.FEATURE_VERSION,
            "dataset": "DEMO / SYNTHETIC DATA",
        }
        return metrics

    def save(self, output_path: str):
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        payload = {
            "model": self.model,
            "model_version": self.MODEL_VERSION,
            "feature_version": self.FEATURE_VERSION,
            "feature_names": self.extractor.FEATURE_NAMES,
            "label": "DEMO / SYNTHETIC DATA",
        }
        joblib.dump(payload, output_path)
        print(f"Saved model artifact to {output_path}")


if __name__ == "__main__":
    trainer = ModelTrainer()
    metrics = trainer.train_and_evaluate()
    print("Training evaluation metrics (Synthetic data):", metrics)

    target_path = os.path.join(str(PROJECT_ROOT), "ml", "models", "demo-risk-model.joblib")
    trainer.save(target_path)
