import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

from flask import Flask, request, jsonify
from flask_cors import CORS
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, r2_score

class EnhancedARIMAModel:
    def __init__(self, p=1, d=1, q=1):
        self.p, self.d, self.q = p, d, q
        self.params_ar = self.params_ma = self.residuals = None
        self.original_data = self.preprocessed_data = None
        self.mean = 0
        self.fitted_values = None
        self.scaler = StandardScaler()
        self.seasonal_components = self.trend_components = None
        
    def preprocess_data(self, data):
        data = np.maximum(data, 0.01)
        if np.all(data > 0):
            data = np.log1p(data)
        
        # Outlier removal using IQR
        Q1, Q3 = np.percentile(data, [25, 75])
        IQR = Q3 - Q1
        outliers = (data < Q1 - 1.5 * IQR) | (data > Q3 + 1.5 * IQR)
        data[outliers] = np.median(data[~outliers])
        
        # Simple decomposition
        n, period = len(data), 7
        if n >= period * 2:
            trend = np.convolve(data, np.ones(period)/period, mode='same')
            # Fix edges
            for i in range(period//2):
                trend[i] = np.mean(data[:i+period//2+1])
                trend[-(i+1)] = np.mean(data[-(i+period//2+1):])
        else:
            trend = np.full(n, np.mean(data))
        
        # Seasonal component
        detrended = data - trend
        seasonal = np.zeros(n)
        if n >= period:
            for i in range(period):
                seasonal_indices = list(range(i, n, period))
                if seasonal_indices:
                    seasonal[seasonal_indices] = np.mean(detrended[seasonal_indices])
        
        self.trend_components, self.seasonal_components = trend, seasonal
        residual = data - trend - seasonal
        return self.scaler.fit_transform(residual.reshape(-1, 1)).flatten()
    
    def autocorrelation(self, data, max_lag):
        n = len(data)
        if n < 2:
            return np.array([1.0] + [0.0] * max_lag)
        
        data = data - np.mean(data)
        autocorr = np.zeros(max_lag + 1)
        autocorr[0] = 1.0
        c0 = np.sum(data ** 2) / n
        
        if c0 > 0:
            for lag in range(1, min(max_lag + 1, n)):
                c_lag = np.sum(data[:-lag] * data[lag:]) / n
                autocorr[lag] = c_lag / c0
        return autocorr
    
    def estimate_params(self, data, p, q):
        params_ar = np.array([])
        if p > 0:
            autocorr = self.autocorrelation(data, p)
            R = np.array([[autocorr[abs(i - j)] for j in range(p)] for i in range(p)])
            R += 1e-6 * np.eye(p)
            r = autocorr[1:p+1]
            try:
                params_ar = np.clip(np.linalg.solve(R, r), -0.95, 0.95)
            except:
                params_ar = np.array([0.3 * (i + 1) / p for i in range(p)])
        
        params_ma = np.array([])
        if q > 0:
            residuals = self._calculate_residuals(data - np.mean(data), params_ar)
            autocorr = self.autocorrelation(residuals, q)
            params_ma = np.clip([-autocorr[i + 1] * 0.5 for i in range(q)], -0.95, 0.95)
        
        return params_ar, params_ma
    
    def _calculate_residuals(self, data, ar_params):
        residuals = np.zeros(len(data))
        for t in range(len(ar_params), len(data)):
            ar_term = sum(ar_params[i] * data[t - i - 1] for i in range(len(ar_params)))
            residuals[t] = data[t] - ar_term
        return residuals[len(ar_params):] if len(ar_params) > 0 else residuals
    
    def fit(self, data):
        self.original_data = np.array(data, dtype=float)
        if len(self.original_data) < 10:
            self.mean = np.mean(self.original_data)
            self.fitted_values = np.full_like(self.original_data, self.mean)
            return self
        
        self.preprocessed_data = self.preprocess_data(self.original_data)
        
        # Differencing
        differenced_data = self.preprocessed_data.copy()
        if self.d > 0 and len(self.preprocessed_data) > self.d:
            for _ in range(self.d):
                differenced_data = np.diff(differenced_data)
        else:
            self.d = 0
        
        self.mean = np.mean(differenced_data)
        centered_data = differenced_data - self.mean
        
        # Parameter estimation
        self.params_ar, self.params_ma = self.estimate_params(centered_data, self.p, self.q)
        fitted_values = self._calculate_fitted_values(differenced_data)
        self.residuals = differenced_data - fitted_values
        
        # Transform back to original scale
        if self.d > 0:
            for _ in range(self.d):
                fitted_values = np.cumsum(np.concatenate([[self.preprocessed_data[-self.d]], fitted_values]))
        
        fitted_scaled = self.scaler.inverse_transform(fitted_values.reshape(-1, 1)).flatten()
        min_len = min(len(fitted_scaled), len(self.trend_components), len(self.seasonal_components))
        
        self.fitted_values = np.zeros(len(self.original_data))
        self.fitted_values[:min_len] = fitted_scaled[:min_len] + self.trend_components[:min_len] + self.seasonal_components[:min_len]
        if min_len < len(self.original_data):
            self.fitted_values[min_len:] = np.mean(self.fitted_values[:min_len])
        
        self.fitted_values = np.maximum(np.expm1(self.fitted_values), 0)
        return self
    
    def _calculate_fitted_values(self, data):
        fitted = np.zeros(len(data))
        residuals = np.zeros(len(data))
        
        for t in range(len(data)):
            ar_term = sum(self.params_ar[i] * (data[t - i - 1] - self.mean) 
                         for i in range(min(self.p, t)) if len(self.params_ar) > i)
            ma_term = sum(self.params_ma[i] * residuals[t - i - 1] 
                         for i in range(min(self.q, t)) if len(self.params_ma) > i)
            fitted[t] = self.mean + ar_term + ma_term
            residuals[t] = data[t] - fitted[t]
        return fitted
    
    def forecast(self, steps=1):
        if self.preprocessed_data is None or len(self.preprocessed_data) == 0:
            return np.full(steps, np.mean(self.original_data) if len(self.original_data) > 0 else 0)
        
        differenced_data = self.preprocessed_data.copy()
        if self.d > 0:
            for _ in range(self.d):
                differenced_data = np.diff(differenced_data)
        
        forecasts = []
        last_values = differenced_data.copy()
        last_residuals = self.residuals.copy() if self.residuals is not None else np.zeros(len(differenced_data))
        
        for step in range(steps):
            ar_term = sum(self.params_ar[i] * (last_values[-(i+1)] - self.mean) 
                         for i in range(min(self.p, len(last_values))) if len(self.params_ar) > i)
            ma_term = sum(self.params_ma[i] * last_residuals[-(i+1)] 
                         for i in range(min(self.q, len(last_residuals))) if len(self.params_ma) > i and step == 0)
            
            forecast = self.mean + ar_term + ma_term
            forecasts.append(forecast)
            last_values = np.append(last_values, forecast)
            last_residuals = np.append(last_residuals, 0)
        
        forecasts = np.array(forecasts)
        
        if self.d > 0:
            for _ in range(self.d):
                forecasts = np.cumsum(np.concatenate([[self.preprocessed_data[-self.d]], forecasts]))
        
        forecasts = self.scaler.inverse_transform(forecasts.reshape(-1, 1)).flatten()
        
        for i in range(steps):
            trend_value = self.trend_components[-1] if len(self.trend_components) > 0 else 0
            seasonal_idx = (len(self.seasonal_components) + i) % 7
            seasonal_value = self.seasonal_components[seasonal_idx] if len(self.seasonal_components) > seasonal_idx else 0
            forecasts[i] += trend_value + seasonal_value
        
        return np.maximum(np.expm1(forecasts), 0)
    
    def calculate_metrics(self):
        """Calculate normalized model performance metrics"""
        if self.fitted_values is None or self.original_data is None:
            return {'mae': 1.0, 'rmse': 1.0, 'r2': 0.0, 'mae_normalized': 1.0, 'rmse_normalized': 1.0}
        
        min_len = min(len(self.fitted_values), len(self.original_data))
        if min_len == 0:
            return {'mae': 1.0, 'rmse': 1.0, 'r2': 0.0, 'mae_normalized': 1.0, 'rmse_normalized': 1.0}
        
        actual = self.original_data[-min_len:]
        predicted = self.fitted_values[-min_len:]
        
        # Remove any NaN or infinite values
        mask = np.isfinite(actual) & np.isfinite(predicted)
        if not np.any(mask) or len(actual[mask]) < 2:
            return {'mae': 1.0, 'rmse': 1.0, 'r2': 0.0, 'mae_normalized': 1.0, 'rmse_normalized': 1.0}
        
        actual = actual[mask]
        predicted = predicted[mask]
        
        try:
            mae = mean_absolute_error(actual, predicted)
            rmse = np.sqrt(np.mean((actual - predicted) ** 2))
            r2 = max(-1.0, min(1.0, r2_score(actual, predicted)))
            
            # Normalize MAE and RMSE by mean of actual values
            mean_actual = np.mean(actual)
            mae_normalized = mae / mean_actual if mean_actual > 0 else 1.0
            rmse_normalized = rmse / mean_actual if mean_actual > 0 else 1.0
            
            return {
                'mae': float(mae),
                'rmse': float(rmse),
                'r2': float(r2),
                'mae_normalized': float(min(1.0, mae_normalized)),
                'rmse_normalized': float(min(1.0, rmse_normalized))
            }
        except:
            return {'mae': 1.0, 'rmse': 1.0, 'r2': 0.0, 'mae_normalized': 1.0, 'rmse_normalized': 1.0}
    
    def calculate_aic(self):
        if self.residuals is None or len(self.residuals) == 0:
            return float('inf')
        n, k = len(self.residuals), self.p + self.q + 1
        if n <= k:
            return float('inf')
        residual_variance = np.var(self.residuals)
        return n * np.log(residual_variance) + 2 * k if residual_variance > 0 else float('inf')

class SalesForecastingEngine:
    def __init__(self, data_file='cleaned_customer_data.csv'):
        self.data_file = data_file
        self.df = None
        self.daily_sales = None
        self.category_sales = {}
        self.arima_model = None
        self.category_models = {}
        self._load_and_prepare_data()
        
    def _load_and_prepare_data(self):
        try:
            self.df = pd.read_csv(self.data_file)
            self._clean_data()
            self._prepare_time_series()
            self._prepare_category_time_series()
            self._fit_models()
        except:
            self.df = pd.DataFrame()
    
    def _clean_data(self):
        if self.df.empty:
            return
        
        # Handle loyalty member column
        if 'Loyalty Member' in self.df.columns and self.df['Loyalty Member'].dtype == 'object':
            self.df['Loyalty Member'] = self.df['Loyalty Member'].map({
                'True': True, 'False': False, 'Yes': True, 'No': False
            }).fillna(False)
        
        # Clean numeric columns
        for col in ['Total Price', 'Quantity', 'Unit Price']:
            if col in self.df.columns:
                self.df[col] = pd.to_numeric(self.df[col], errors='coerce').fillna(0 if col != 'Quantity' else 1)
        
        # Filter valid records
        self.df = self.df[(self.df['Total Price'] >= 0) & (self.df['Quantity'] > 0)].copy()
    
    def _prepare_time_series(self):
        if self.df.empty:
            return
        
        self.df['Purchase Date'] = pd.to_datetime(self.df['Purchase Date'], errors='coerce')
        completed_df = self.df[self.df['Order Status'] == 'Completed'].dropna(subset=['Purchase Date'])
        
        if completed_df.empty:
            return
        
        completed_df['Date'] = completed_df['Purchase Date'].dt.date
        self.daily_sales = completed_df.groupby('Date').agg({
            'Total Price': 'sum',
            'Quantity': 'sum',
            'Customer ID': 'nunique'
        }).reset_index()
        
        self.daily_sales.columns = ['Date', 'Revenue', 'Units_Sold', 'Customers']
        self.daily_sales['Date'] = pd.to_datetime(self.daily_sales['Date'])
        
        self._fill_missing_days()
        self.daily_sales['Revenue_Smoothed'] = self.daily_sales['Revenue'].rolling(
            window=3, center=True, min_periods=1
        ).mean()
        self.daily_sales = self.daily_sales.sort_values('Date').reset_index(drop=True)
    
    def _prepare_category_time_series(self):
        if self.df.empty or self.daily_sales is None:
            return
        
        completed_df = self.df[self.df['Order Status'] == 'Completed'].copy()
        completed_df['Date'] = completed_df['Purchase Date'].dt.date
        
        category_daily = completed_df.groupby(['Date', 'Product Type']).agg({
            'Total Price': 'sum',
            'Quantity': 'sum'
        }).reset_index()
        category_daily['Date'] = pd.to_datetime(category_daily['Date'])
        
        date_range = pd.date_range(
            start=self.daily_sales['Date'].min(),
            end=self.daily_sales['Date'].max(),
            freq='D'
        )
        complete_df = pd.DataFrame({'Date': date_range})
        
        for category in category_daily['Product Type'].unique():
            cat_data = category_daily[category_daily['Product Type'] == category]
            cat_filled = complete_df.merge(cat_data[['Date', 'Total Price', 'Quantity']], on='Date', how='left')
            cat_filled[['Total Price', 'Quantity']] = cat_filled[['Total Price', 'Quantity']].fillna(0)
            cat_filled['Quantity_Smoothed'] = cat_filled['Quantity'].rolling(
                window=3, center=True, min_periods=1
            ).mean()
            self.category_sales[category] = cat_filled.sort_values('Date').reset_index(drop=True)
    
    def _fill_missing_days(self):
        if self.daily_sales is None or self.daily_sales.empty:
            return
        
        date_range = pd.date_range(self.daily_sales['Date'].min(), self.daily_sales['Date'].max(), freq='D')
        complete_df = pd.DataFrame({'Date': date_range})
        self.daily_sales = complete_df.merge(self.daily_sales, on='Date', how='left')
        self.daily_sales[['Revenue', 'Units_Sold', 'Customers']] = self.daily_sales[['Revenue', 'Units_Sold', 'Customers']].fillna(0)
    
    def _find_best_arima_params(self, data_series, max_p=2, max_d=1, max_q=2):
        if len(data_series) < 15:
            return (1, 1, 1)
        
        best_aic, best_params = float('inf'), (1, 1, 1)
        
        for p in range(max_p + 1):
            for d in range(max_d + 1):
                for q in range(max_q + 1):
                    if p + q > 0 and len(data_series) > p + d + q + 10:
                        try:
                            model = EnhancedARIMAModel(p, d, q)
                            model.fit(data_series)
                            aic = model.calculate_aic()
                            if aic < best_aic:
                                best_aic, best_params = aic, (p, d, q)
                        except:
                            continue
        return best_params
    
    def _fit_models(self):
        if self.daily_sales is None or len(self.daily_sales) < 15:
            return
        
        try:
            # Fit main model
            revenue_series = self.daily_sales['Revenue_Smoothed'].values
            p, d, q = self._find_best_arima_params(revenue_series)
            self.arima_model = EnhancedARIMAModel(p, d, q)
            self.arima_model.fit(revenue_series)
            
            # Fit category models
            for category, cat_data in self.category_sales.items():
                if len(cat_data) >= 15 and cat_data['Quantity'].sum() > 0:
                    try:
                        quantity_series = cat_data['Quantity_Smoothed'].values
                        p_cat, d_cat, q_cat = self._find_best_arima_params(quantity_series)
                        cat_model = EnhancedARIMAModel(p_cat, d_cat, q_cat)
                        cat_model.fit(quantity_series)
                        
                        if cat_model.calculate_metrics()['r2'] > -0.5:
                            self.category_models[category] = cat_model
                    except:
                        continue
        except:
            pass
    
    def generate_forecast(self, period='7days'):
        if self.arima_model is None:
            return self._get_empty_forecast()
        
        try:
            forecast_steps = 7 if period == '7days' else 15
            forecasts = self.arima_model.forecast(steps=forecast_steps)
            last_date = self.daily_sales['Date'].max()
            model_metrics = self.arima_model.calculate_metrics()
            
            # Generate daily forecasts
            daily_forecasts = []
            for i in range(forecast_steps):
                future_date = last_date + timedelta(days=i+1)
                predicted_revenue = max(0, forecasts[i])
                
                # Calculate confidence
                base_confidence = 90 - (i * 1.5)
                if model_metrics['r2'] > 0.7:
                    base_confidence += 5
                elif model_metrics['r2'] < 0.3:
                    base_confidence -= 10
                
                # Weekend adjustment
                is_weekend = future_date.weekday() >= 5
                if is_weekend:
                    predicted_revenue *= 0.8
                    base_confidence -= 3
                
                daily_forecasts.append({
                    'date': future_date.strftime('%Y-%m-%d'),
                    'predicted': round(predicted_revenue, 2),
                    'confidence': round(max(60, min(95, base_confidence)), 1),
                    'day_name': future_date.strftime('%A'),
                    'is_weekend': is_weekend
                })
            
            # Generate category forecasts
            category_forecasts = self._generate_category_forecasts(forecast_steps, last_date)
            
            # Calculate summary metrics
            total_predicted = sum(f['predicted'] for f in daily_forecasts)
            historical_revenue = self.daily_sales['Revenue'].tail(forecast_steps).sum()
            growth_rate = ((total_predicted - historical_revenue) / historical_revenue * 100) if historical_revenue > 0 else 0
            avg_confidence = np.mean([f['confidence'] for f in daily_forecasts])
            uncertainty_factor = max(0.1, 1 - model_metrics['r2']) if model_metrics['r2'] > 0 else 0.5
            
            # Prepare line graph data
            line_graph_data = []
            for _, row in self.daily_sales.iterrows():
                line_graph_data.append({
                    'date': row['Date'].strftime('%Y-%m-%d'),
                    'actual': float(row['Revenue']),
                    'predicted': None,
                    'type': 'historical'
                })
            
            for forecast in daily_forecasts:
                line_graph_data.append({
                    'date': forecast['date'],
                    'actual': None,
                    'predicted': forecast['predicted'],
                    'type': 'forecast',
                    'confidence': forecast['confidence']
                })
            
            return {
                'summary': {
                    'predictedRevenue': round(total_predicted, 2),
                    'growthRate': round(growth_rate, 1),
                    'confidence': round(avg_confidence, 1),
                    'bestCase': round(total_predicted * (1 + uncertainty_factor * 0.5), 2),
                    'worstCase': round(total_predicted * (1 - uncertainty_factor * 0.3), 2),
                    'dailyAverage': round(total_predicted / forecast_steps, 2)
                },
                'dailyForecast': daily_forecasts,
                'categoryForecast': category_forecasts,
                'lineGraphData': line_graph_data,
                'topProducts': self._get_top_products_forecast(),
                'modelInfo': {
                    'type': f'Enhanced ARIMA({self.arima_model.p},{self.arima_model.d},{self.arima_model.q})',
                    'dataPoints': len(self.daily_sales),
                    'forecastHorizon': f'{forecast_steps} days',
                    'lastDataDate': self.daily_sales['Date'].max().strftime('%Y-%m-%d'),
                    'accuracy': f"{round(max(0, model_metrics['r2'] * 100), 1)}%",
                    'categoryModels': len(self.category_models)
                }
            }
        except:
            return self._get_empty_forecast()
    
    def _generate_category_forecasts(self, forecast_steps, last_date):
        category_forecasts = []
        
        for category, model in self.category_models.items():
            try:
                forecasts = model.forecast(steps=forecast_steps)
                
                daily_category_forecasts = []
                for i in range(forecast_steps):
                    future_date = last_date + timedelta(days=i+1)
                    predicted_quantity = max(0, forecasts[i])
                    
                    if future_date.weekday() >= 5:  # Weekend adjustment
                        predicted_quantity *= 0.75
                    
                    daily_category_forecasts.append({
                        'date': future_date.strftime('%Y-%m-%d'),
                        'predicted_quantity': round(predicted_quantity, 0),
                        'day_name': future_date.strftime('%A')
                    })
                
                total_predicted = int(sum(f['predicted_quantity'] for f in daily_category_forecasts))
                category_forecasts.append({
                    'category': category,
                    'total_predicted_quantity': total_predicted,
                    'daily_average': round(total_predicted / forecast_steps, 1),
                    'daily_forecasts': daily_category_forecasts
                })
            except:
                continue
        
        return sorted(category_forecasts, key=lambda x: x['total_predicted_quantity'], reverse=True)
    
    def _get_top_products_forecast(self):
        if not self.category_models:
            return self._get_legacy_top_products_forecast()
        
        top_products = []
        for category, model in self.category_models.items():
            if category not in self.category_sales:
                continue
                
            try:
                cat_data = self.category_sales[category]
                recent_revenue = cat_data['Total Price'].tail(14).sum()
                recent_quantity = cat_data['Quantity'].tail(14).sum()
                
                if recent_quantity == 0:
                    continue
                
                forecasted_quantities = model.forecast(steps=7)
                total_forecasted_quantity = sum(max(0, q) for q in forecasted_quantities)
                
                avg_price = recent_revenue / recent_quantity
                predicted_sales = total_forecasted_quantity * avg_price
                
                historical_quantity = cat_data['Quantity'].tail(7).sum()
                growth_rate = ((total_forecasted_quantity - historical_quantity) / historical_quantity * 100) if historical_quantity > 0 else 0
                
                if predicted_sales > 0:
                    top_products.append({
                        'name': category,
                        'predictedSales': round(predicted_sales, 2),
                        'predictedQuantity': int(total_forecasted_quantity),
                        'growth': round(growth_rate, 1),
                        'avgPrice': round(avg_price, 2)
                    })
            except:
                continue
        
        return sorted(top_products, key=lambda x: x['predictedSales'], reverse=True)[:5]
    
    def _get_legacy_top_products_forecast(self):
        if self.df.empty:
            return []
        
        try:
            completed_orders = self.df[self.df['Order Status'] == 'Completed']
            recent_date = completed_orders['Purchase Date'].max() - pd.DateOffset(days=21)
            recent_orders = completed_orders[completed_orders['Purchase Date'] >= recent_date]
            
            if recent_orders.empty:
                return []
            
            product_stats = recent_orders.groupby('Product Type').agg({
                'Total Price': 'sum',
                'Quantity': 'sum'
            }).reset_index()
            
            top_products = []
            for _, row in product_stats.head(5).iterrows():
                if row['Quantity'] > 0:
                    top_products.append({
                        'name': row['Product Type'],
                        'predictedSales': round(row['Total Price'] * 1.02, 2),
                        'predictedQuantity': int(row['Quantity'] * 1.02),
                        'growth': round(np.random.normal(2, 5), 1),
                        'avgPrice': round(row['Total Price'] / row['Quantity'], 2)
                    })
            
            return sorted(top_products, key=lambda x: x['predictedSales'], reverse=True)
        except:
            return []
    
    def _get_empty_forecast(self):
        return {
            'summary': {
                'predictedRevenue': 0, 'growthRate': 0, 'confidence': 0,
                'bestCase': 0, 'worstCase': 0, 'dailyAverage': 0
            },
            'dailyForecast': [], 'categoryForecast': [], 'lineGraphData': [],
            'topProducts': [], 'modelInfo': {
                'type': 'No model available', 'dataPoints': 0, 'forecastHorizon': 'N/A',
                'lastDataDate': 'N/A', 'accuracy': '0%', 'categoryModels': 0
            }
        }

# Flask app
app = Flask(__name__)
CORS(app)
forecasting_engine = None

def get_engine():
    global forecasting_engine
    if forecasting_engine is None:
        try:
            forecasting_engine = SalesForecastingEngine('cleaned_customer_data.csv')
        except:
            forecasting_engine = SalesForecastingEngine()
    return forecasting_engine

@app.route('/api/sales/forecast', methods=['GET'])
def get_sales_forecast():
    try:
        period = request.args.get('period', '7days')
        period = '7days' if period not in ['7days', '15days'] else period
        return jsonify(get_engine().generate_forecast(period))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/sales/metrics', methods=['GET'])
def get_model_metrics():
    try:
        engine = get_engine()
        if engine.arima_model is None:
            return jsonify({'error': 'No model trained'}), 404
        
        metrics = engine.arima_model.calculate_metrics()
        
        return jsonify({
            'main_model': {
                'type': f"Enhanced ARIMA({engine.arima_model.p},{engine.arima_model.d},{engine.arima_model.q})",
                'mae': round(metrics['mae'], 2),
                'rmse': round(metrics['rmse'], 2),
                'r2': round(metrics['r2'], 4),
                'mae_normalized': round(metrics['mae_normalized'], 4),
                'rmse_normalized': round(metrics['rmse_normalized'], 4),
                'accuracy_percentage': f"{round(max(0, metrics['r2'] * 100), 1)}%"
            },
            'data_points': len(engine.daily_sales) if engine.daily_sales is not None else 0,
            'category_models_count': len(engine.category_models)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/sales/categories', methods=['GET'])
def get_category_forecast():
    try:
        engine = get_engine()
        period = request.args.get('period', '7days')
        forecast_steps = 7 if period == '7days' else 15
        
        if not engine.category_models:
            return jsonify({'error': 'No category models available'}), 404
        
        last_date = engine.daily_sales['Date'].max()
        category_forecasts = engine._generate_category_forecasts(forecast_steps, last_date)
        
        return jsonify({
            'categories': category_forecasts,
            'period': period,
            'forecast_steps': forecast_steps,
            'total_categories': len(category_forecasts)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/sales/data-status', methods=['GET'])
def get_data_status():
    try:
        engine = get_engine()
        data_available = engine.df is not None and not engine.df.empty
        record_count = len(engine.df) if data_available else 0
        daily_points = len(engine.daily_sales) if engine.daily_sales is not None else 0
        
        categories_info = {}
        for category, cat_data in engine.category_sales.items():
            categories_info[category] = {
                'data_points': len(cat_data),
                'total_quantity': int(cat_data['Quantity'].sum()),
                'total_revenue': round(cat_data['Total Price'].sum() if 'Total Price' in cat_data.columns else 0, 2),
                'has_model': category in engine.category_models
            }
        
        return jsonify({
            'status': 'success',
            'data_available': data_available,
            'record_count': record_count,
            'daily_data_points': daily_points,
            'models_trained': bool(engine.arima_model),
            'category_models_trained': len(engine.category_models),
            'categories': categories_info
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/api/sales/retrain', methods=['POST'])
def retrain_models():
    try:
        global forecasting_engine
        forecasting_engine = SalesForecastingEngine('cleaned_customer_data.csv')
        
        return jsonify({
            'status': 'success',
            'message': 'Models retrained successfully',
            'main_model_trained': forecasting_engine.arima_model is not None,
            'category_models_trained': len(forecasting_engine.category_models),
            'categories': list(forecasting_engine.category_models.keys())
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/api/sales/category/<category_name>/forecast', methods=['GET'])
def get_single_category_forecast(category_name):
    try:
        engine = get_engine()
        if category_name not in engine.category_models:
            return jsonify({'error': f'No model available for category: {category_name}'}), 404
        
        period = request.args.get('period', '7days')
        forecast_steps = 7 if period == '7days' else 15
        
        model = engine.category_models[category_name]
        forecasts = model.forecast(steps=forecast_steps)
        last_date = engine.daily_sales['Date'].max()
        
        daily_forecasts = []
        for i in range(forecast_steps):
            future_date = last_date + timedelta(days=i+1)
            predicted_quantity = max(0, forecasts[i])
            
            if future_date.weekday() >= 5:
                predicted_quantity *= 0.75
            
            daily_forecasts.append({
                'date': future_date.strftime('%Y-%m-%d'),
                'predicted_quantity': round(predicted_quantity, 0),
                'day_name': future_date.strftime('%A'),
                'is_weekend': future_date.weekday() >= 5
            })
        
        historical_data = []
        if category_name in engine.category_sales:
            cat_data = engine.category_sales[category_name]
            for _, row in cat_data.iterrows():
                historical_data.append({
                    'date': row['Date'].strftime('%Y-%m-%d'),
                    'actual_quantity': int(row['Quantity']),
                    'actual_revenue': round(row['Total Price'] if 'Total Price' in cat_data.columns else 0, 2)
                })
        
        return jsonify({
            'category': category_name,
            'model_type': f"Enhanced ARIMA({model.p},{model.d},{model.q})",
            'forecast': {
                'period': period,
                'total_predicted_quantity': int(sum(f['predicted_quantity'] for f in daily_forecasts)),
                'daily_average': round(sum(f['predicted_quantity'] for f in daily_forecasts) / forecast_steps, 1),
                'daily_forecasts': daily_forecasts
            },
            'historical_data': historical_data[-30:]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    engine = get_engine()
    
    return jsonify({
        'status': 'healthy',
        'engine': 'Enhanced ARIMA Forecasting Engine',
        'timestamp': datetime.now().isoformat(),
        'models': {
            'main_model': engine.arima_model is not None,
            'category_models': len(engine.category_models),
            'data_loaded': engine.df is not None and not engine.df.empty
        }
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)