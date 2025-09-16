import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

from flask import Flask, request, jsonify
from flask_cors import CORS
from scipy import stats
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

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
        
        # Outlier removal
        Q1, Q3 = np.percentile(data, [25, 75])
        IQR = Q3 - Q1
        outliers = (data < Q1 - 1.5 * IQR) | (data > Q3 + 1.5 * IQR)
        data[outliers] = np.median(data[~outliers])
        
        # Decomposition
        n, period = len(data), 7
        if n >= period * 2:
            trend = np.convolve(data, np.ones(period)/period, mode='same')
            for i in range(period//2):
                trend[i] = np.mean(data[:i+period//2+1])
                trend[-(i+1)] = np.mean(data[-(i+period//2+1):])
        else:
            trend = np.full(n, np.mean(data))
        
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
        if p > 0:
            autocorr = self.autocorrelation(data, p)
            R = np.array([[autocorr[abs(i - j)] for j in range(p)] for i in range(p)])
            R += 1e-6 * np.eye(p)
            r = autocorr[1:p+1]
            try:
                params_ar = np.clip(np.linalg.solve(R, r), -0.95, 0.95)
            except:
                params_ar = np.array([0.3 * (i + 1) / p for i in range(p)])
        else:
            params_ar = np.array([])
        
        if q > 0:
            residuals = self._calculate_residuals(data - np.mean(data), params_ar)
            autocorr = self.autocorrelation(residuals, q)
            params_ma = np.clip([-autocorr[i + 1] * 0.5 for i in range(q)], -0.95, 0.95)
        else:
            params_ma = np.array([])
        
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
        
        if self.d > 0 and len(self.preprocessed_data) > self.d:
            differenced_data = self.preprocessed_data.copy()
            for _ in range(self.d):
                differenced_data = np.diff(differenced_data)
        else:
            differenced_data = self.preprocessed_data.copy()
            self.d = 0
        
        self.mean = np.mean(differenced_data)
        centered_data = differenced_data - self.mean
        
        self.params_ar, self.params_ma = self.estimate_params(centered_data, self.p, self.q)
        fitted_values = self._calculate_fitted_values(differenced_data)
        self.residuals = differenced_data - fitted_values
        
        # Convert back to original scale
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
        
        # Postprocess
        forecasts = self.scaler.inverse_transform(forecasts.reshape(-1, 1)).flatten()
        
        for i in range(steps):
            trend_value = self.trend_components[-1] if len(self.trend_components) > 0 else 0
            seasonal_idx = (len(self.seasonal_components) + i) % 7
            seasonal_value = self.seasonal_components[seasonal_idx] if len(self.seasonal_components) > seasonal_idx else 0
            forecasts[i] += trend_value + seasonal_value
        
        return np.maximum(np.expm1(forecasts), 0)
    
    def calculate_metrics(self):
        if self.fitted_values is None or self.original_data is None:
            return {'mae': float('inf'), 'mse': float('inf'), 'rmse': float('inf'), 'r2': -float('inf')}
        
        min_len = min(len(self.fitted_values), len(self.original_data))
        if min_len == 0:
            return {'mae': float('inf'), 'mse': float('inf'), 'rmse': float('inf'), 'r2': -float('inf')}
        
        actual, predicted = self.original_data[-min_len:], self.fitted_values[-min_len:]
        
        try:
            return {
                'mae': float(mean_absolute_error(actual, predicted)),
                'mse': float(mean_squared_error(actual, predicted)),
                'rmse': float(np.sqrt(mean_squared_error(actual, predicted))),
                'r2': float(r2_score(actual, predicted))
            }
        except:
            mae = np.mean(np.abs(actual - predicted))
            mse = np.mean((actual - predicted) ** 2)
            ss_tot = np.sum((actual - np.mean(actual)) ** 2)
            r2 = 1 - (np.sum((actual - predicted) ** 2) / ss_tot) if ss_tot != 0 else -float('inf')
            return {'mae': float(mae), 'mse': float(mse), 'rmse': float(np.sqrt(mse)), 'r2': float(r2)}
    
    def calculate_aic(self):
        if self.residuals is None:
            return float('inf')
        n, k = len(self.residuals), self.p + self.q + 1
        if n <= k:
            return float('inf')
        mse = np.mean(self.residuals ** 2)
        return n * np.log(mse) + 2 * k if mse > 0 else float('inf')

class SalesForecastingEngine:
    def __init__(self, data_file='cleaned_customer_data.csv'):
        self.data_file = data_file
        self.df = self.daily_sales = self.category_sales = None
        self.arima_model = None
        self.category_models = {}
        self.load_and_prepare_data()
        
    def load_and_prepare_data(self):
        try:
            self.df = pd.read_csv(self.data_file)
            
            if 'Loyalty Member' in self.df.columns and self.df['Loyalty Member'].dtype == 'object':
                self.df['Loyalty Member'] = self.df['Loyalty Member'].map({
                    'True': True, 'False': False, 'Yes': True, 'No': False
                }).fillna(False)
            
            # Clean numeric columns
            for col in ['Total Price', 'Quantity', 'Unit Price']:
                self.df[col] = pd.to_numeric(self.df[col], errors='coerce').fillna(0 if col != 'Quantity' else 1)
            
            self.df = self.df[(self.df['Total Price'] >= 0) & (self.df['Quantity'] > 0)].copy()
            
            self._prepare_time_series()
            self._prepare_category_time_series()
            self._fit_models()
            
        except Exception as e:
            self.df = pd.DataFrame()
    
    def _prepare_time_series(self):
        if self.df.empty:
            return
        
        self.df['Purchase Date'] = pd.to_datetime(self.df['Purchase Date'])
        completed_df = self.df[self.df['Order Status'] == 'Completed'].copy()
        
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
        self.daily_sales['Revenue_Smoothed'] = self.daily_sales['Revenue'].rolling(window=3, center=True, min_periods=1).mean()
        self.daily_sales = self.daily_sales.sort_values('Date').reset_index(drop=True)
        
    def _prepare_category_time_series(self):
        if self.df.empty:
            return
        
        completed_df = self.df[self.df['Order Status'] == 'Completed'].copy()
        if completed_df.empty:
            return
        
        completed_df['Date'] = completed_df['Purchase Date'].dt.date
        category_daily = completed_df.groupby(['Date', 'Product Type']).agg({
            'Total Price': 'sum',
            'Quantity': 'sum'
        }).reset_index()
        category_daily['Date'] = pd.to_datetime(category_daily['Date'])
        
        self.category_sales = {}
        for category in category_daily['Product Type'].unique():
            cat_data = category_daily[category_daily['Product Type'] == category].copy()
            date_range = pd.date_range(
                start=self.daily_sales['Date'].min(),
                end=self.daily_sales['Date'].max(),
                freq='D'
            )
            complete_df = pd.DataFrame({'Date': date_range})
            cat_filled = complete_df.merge(cat_data[['Date', 'Total Price', 'Quantity']], on='Date', how='left')
            cat_filled[['Total Price', 'Quantity']] = cat_filled[['Total Price', 'Quantity']].fillna(0)
            cat_filled['Quantity_Smoothed'] = cat_filled['Quantity'].rolling(window=3, center=True, min_periods=1).mean()
            self.category_sales[category] = cat_filled.sort_values('Date').reset_index(drop=True)
        
    def _fill_missing_days(self):
        if self.daily_sales.empty:
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
            revenue_series = self.daily_sales['Revenue_Smoothed'].values
            p, d, q = self._find_best_arima_params(revenue_series)
            self.arima_model = EnhancedARIMAModel(p, d, q)
            self.arima_model.fit(revenue_series)
            
            if self.category_sales:
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
            
            daily_forecasts = []
            for i in range(forecast_steps):
                future_date = last_date + timedelta(days=i+1)
                predicted_revenue = max(0, forecasts[i])
                
                base_confidence = 90 - (i * 1.5)
                if model_metrics['r2'] > 0.7:
                    base_confidence += 5
                elif model_metrics['r2'] < 0.3:
                    base_confidence -= 10
                
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
            
            category_forecasts = self._generate_category_forecasts(forecast_steps, last_date)
            total_predicted = sum(f['predicted'] for f in daily_forecasts)
            
            historical_revenue = self.daily_sales['Revenue'].tail(forecast_steps).sum()
            growth_rate = ((total_predicted - historical_revenue) / historical_revenue * 100) if historical_revenue > 0 else 0
            avg_confidence = np.mean([f['confidence'] for f in daily_forecasts])
            uncertainty_factor = max(0.1, 1 - model_metrics['r2']) if model_metrics['r2'] > 0 else 0.5
            
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
                    'metrics': {
                        'mae': round(model_metrics['mae'], 2),
                        'mse': round(model_metrics['mse'], 2),
                        'rmse': round(model_metrics['rmse'], 2),
                        'r2': round(model_metrics['r2'], 4)
                    },
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
                metrics = model.calculate_metrics()
                
                daily_category_forecasts = []
                for i in range(forecast_steps):
                    future_date = last_date + timedelta(days=i+1)
                    predicted_quantity = max(0, forecasts[i])
                    
                    if future_date.weekday() >= 5:
                        predicted_quantity *= 0.75
                    
                    daily_category_forecasts.append({
                        'date': future_date.strftime('%Y-%m-%d'),
                        'predicted_quantity': round(predicted_quantity, 0),
                        'day_name': future_date.strftime('%A')
                    })
                
                category_forecasts.append({
                    'category': category,
                    'total_predicted_quantity': int(sum(f['predicted_quantity'] for f in daily_category_forecasts)),
                    'daily_average': round(sum(f['predicted_quantity'] for f in daily_category_forecasts) / forecast_steps, 1),
                    'daily_forecasts': daily_category_forecasts,
                    'model_metrics': {
                        'mae': round(metrics['mae'], 2),
                        'rmse': round(metrics['rmse'], 2),
                        'r2': round(metrics['r2'], 4)
                    },
                    'model_type': f"Enhanced ARIMA({model.p},{model.d},{model.q})"
                })
            except:
                continue
        
        return sorted(category_forecasts, key=lambda x: x['total_predicted_quantity'], reverse=True)
    
    def _get_top_products_forecast(self):
        if not self.category_models:
            return self._get_legacy_top_products_forecast()
        
        top_products = []
        for category, model in self.category_models.items():
            try:
                if category in self.category_sales:
                    cat_data = self.category_sales[category]
                    recent_revenue = cat_data['Total Price'].tail(14).sum()
                    recent_quantity = cat_data['Quantity'].tail(14).sum()
                    
                    forecasted_quantities = model.forecast(steps=7)
                    total_forecasted_quantity = sum(max(0, q) for q in forecasted_quantities)
                    
                    avg_price = recent_revenue / recent_quantity if recent_quantity > 0 else 0
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
                predicted_sales = row['Total Price'] * 1.02
                predicted_quantity = row['Quantity'] * 1.02
                growth_rate = np.random.normal(2, 5)
                avg_price = row['Total Price'] / row['Quantity'] if row['Quantity'] > 0 else 0
                
                top_products.append({
                    'name': row['Product Type'],
                    'predictedSales': round(predicted_sales, 2),
                    'predictedQuantity': int(predicted_quantity),
                    'growth': round(growth_rate, 1),
                    'avgPrice': round(avg_price, 2)
                })
            
            return sorted(top_products, key=lambda x: x['predictedSales'], reverse=True)
        except:
            return []
    
    def _get_empty_forecast(self):
        return {
            'summary': {
                'predictedRevenue': 0,
                'growthRate': 0,
                'confidence': 0,
                'bestCase': 0,
                'worstCase': 0,
                'dailyAverage': 0
            },
            'dailyForecast': [],
            'categoryForecast': [],
            'lineGraphData': [],
            'topProducts': [],
            'modelInfo': {
                'type': 'No model available',
                'dataPoints': 0,
                'forecastHorizon': 'N/A',
                'lastDataDate': 'N/A',
                'metrics': {'mae': 0, 'mse': 0, 'rmse': 0, 'r2': 0},
                'categoryModels': 0
            }
        }

app = Flask(__name__)
CORS(app)
forecasting_engine = None

def initialize_engine():
    global forecasting_engine
    try:
        forecasting_engine = SalesForecastingEngine('cleaned_customer_data.csv')
    except:
        forecasting_engine = SalesForecastingEngine()

@app.route('/api/sales/forecast', methods=['GET'])
def get_sales_forecast():
    global forecasting_engine
    if forecasting_engine is None:
        initialize_engine()
    
    try:
        period = request.args.get('period', '7days')
        period = '7days' if period not in ['7days', '15days'] else period
        return jsonify(forecasting_engine.generate_forecast(period))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/sales/metrics', methods=['GET'])
def get_model_metrics():
    global forecasting_engine
    if forecasting_engine is None:
        initialize_engine()
    
    try:
        if forecasting_engine.arima_model is None:
            return jsonify({'error': 'No model trained'}), 404
        
        main_metrics = forecasting_engine.arima_model.calculate_metrics()
        category_metrics = {}
        for category, model in forecasting_engine.category_models.items():
            category_metrics[category] = {
                'metrics': model.calculate_metrics(),
                'model_params': f"Enhanced ARIMA({model.p},{model.d},{model.q})"
            }
        
        return jsonify({
            'main_model': {
                'type': f"Enhanced ARIMA({forecasting_engine.arima_model.p},{forecasting_engine.arima_model.d},{forecasting_engine.arima_model.q})",
                'metrics': main_metrics
            },
            'category_models': category_metrics,
            'data_points': len(forecasting_engine.daily_sales) if forecasting_engine.daily_sales is not None else 0
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/sales/categories', methods=['GET'])
def get_category_forecast():
    global forecasting_engine
    if forecasting_engine is None:
        initialize_engine()
    
    try:
        period = request.args.get('period', '7days')
        forecast_steps = 7 if period == '7days' else 15
        
        if not forecasting_engine.category_models:
            return jsonify({'error': 'No category models available'}), 404
        
        last_date = forecasting_engine.daily_sales['Date'].max()
        category_forecasts = forecasting_engine._generate_category_forecasts(forecast_steps, last_date)
        
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
    global forecasting_engine
    if forecasting_engine is None:
        initialize_engine()
    
    try:
        data_available = forecasting_engine.df is not None and not forecasting_engine.df.empty
        record_count = len(forecasting_engine.df) if data_available else 0
        daily_points = len(forecasting_engine.daily_sales) if forecasting_engine.daily_sales is not None else 0
        
        categories_info = {}
        if forecasting_engine.category_sales:
            for category, cat_data in forecasting_engine.category_sales.items():
                categories_info[category] = {
                    'data_points': len(cat_data),
                    'total_quantity': int(cat_data['Quantity'].sum()),
                    'total_revenue': round(cat_data['Total Price'].sum() if 'Total Price' in cat_data.columns else 0, 2),
                    'has_model': category in forecasting_engine.category_models
                }
        
        return jsonify({
            'status': 'success',
            'data_available': data_available,
            'record_count': record_count,
            'daily_data_points': daily_points,
            'models_trained': bool(forecasting_engine.arima_model),
            'category_models_trained': len(forecasting_engine.category_models),
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
    global forecasting_engine
    if forecasting_engine is None:
        initialize_engine()
    
    try:
        if category_name not in forecasting_engine.category_models:
            return jsonify({'error': f'No model available for category: {category_name}'}), 404
        
        period = request.args.get('period', '7days')
        forecast_steps = 7 if period == '7days' else 15
        
        model = forecasting_engine.category_models[category_name]
        forecasts = model.forecast(steps=forecast_steps)
        metrics = model.calculate_metrics()
        
        last_date = forecasting_engine.daily_sales['Date'].max()
        
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
        if category_name in forecasting_engine.category_sales:
            cat_data = forecasting_engine.category_sales[category_name]
            for _, row in cat_data.iterrows():
                historical_data.append({
                    'date': row['Date'].strftime('%Y-%m-%d'),
                    'actual_quantity': int(row['Quantity']),
                    'actual_revenue': round(row['Total Price'] if 'Total Price' in cat_data.columns else 0, 2)
                })
        
        return jsonify({
            'category': category_name,
            'model_type': f"Enhanced ARIMA({model.p},{model.d},{model.q})",
            'metrics': {
                'mae': round(metrics['mae'], 2),
                'mse': round(metrics['mse'], 2),
                'rmse': round(metrics['rmse'], 2),
                'r2': round(metrics['r2'], 4)
            },
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

@app.route('/api/sales/model-comparison', methods=['GET'])
def get_model_comparison():
    global forecasting_engine
    if forecasting_engine is None:
        initialize_engine()
    
    try:
        if forecasting_engine.arima_model is None:
            return jsonify({'error': 'No models trained'}), 404
        
        comparison_data = []
        
        main_metrics = forecasting_engine.arima_model.calculate_metrics()
        comparison_data.append({
            'model_name': 'Revenue (Main)',
            'model_type': f"Enhanced ARIMA({forecasting_engine.arima_model.p},{forecasting_engine.arima_model.d},{forecasting_engine.arima_model.q})",
            'target_variable': 'Revenue',
            'data_points': len(forecasting_engine.daily_sales),
            'mae': round(main_metrics['mae'], 2),
            'mse': round(main_metrics['mse'], 2),
            'rmse': round(main_metrics['rmse'], 2),
            'r2': round(main_metrics['r2'], 4),
            'r2_percentage': round(main_metrics['r2'] * 100, 2) if main_metrics['r2'] > 0 else 0
        })
        
        for category, model in forecasting_engine.category_models.items():
            metrics = model.calculate_metrics()
            data_points = len(forecasting_engine.category_sales[category]) if category in forecasting_engine.category_sales else 0
            
            comparison_data.append({
                'model_name': f'{category} (Quantity)',
                'model_type': f"Enhanced ARIMA({model.p},{model.d},{model.q})",
                'target_variable': 'Quantity',
                'data_points': data_points,
                'mae': round(metrics['mae'], 2),
                'mse': round(metrics['mse'], 2),
                'rmse': round(metrics['rmse'], 2),
                'r2': round(metrics['r2'], 4),
                'r2_percentage': round(metrics['r2'] * 100, 2) if metrics['r2'] > 0 else 0
            })
        
        comparison_data.sort(key=lambda x: x['r2'], reverse=True)
        
        r2_scores = [model['r2'] for model in comparison_data if model['r2'] > -float('inf')]
        rmse_scores = [model['rmse'] for model in comparison_data if model['rmse'] < float('inf')]
        
        summary = {
            'total_models': len(comparison_data),
            'avg_r2': round(np.mean(r2_scores), 4) if r2_scores else 0,
            'avg_rmse': round(np.mean(rmse_scores), 2) if rmse_scores else 0,
            'best_model': comparison_data[0]['model_name'] if comparison_data else 'None',
            'best_r2': comparison_data[0]['r2'] if comparison_data else 0
        }
        
        return jsonify({
            'summary': summary,
            'models': comparison_data,
            'generated_at': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    global forecasting_engine
    
    models_status = {
        'main_model': forecasting_engine.arima_model is not None if forecasting_engine else False,
        'category_models': len(forecasting_engine.category_models) if forecasting_engine else 0,
        'data_loaded': forecasting_engine.df is not None and not forecasting_engine.df.empty if forecasting_engine else False
    }
    
    return jsonify({
        'status': 'healthy',
        'engine': 'Enhanced ARIMA Forecasting Engine',
        'timestamp': datetime.now().isoformat(),
        'models': models_status
    })

if __name__ == '__main__':
    initialize_engine()
    app.run(debug=True, host='0.0.0.0', port=5001)