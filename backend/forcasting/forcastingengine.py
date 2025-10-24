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
    """Optimized ARIMA implementation for time series forecasting"""
    
    def __init__(self, p=1, d=1, q=1):
        self.p, self.d, self.q = p, d, q
        self.params_ar = self.params_ma = self.residuals = None
        self.original_data = self.preprocessed_data = None
        self.mean = 0
        self.fitted_values = None
        self.scaler = StandardScaler()
        self.trend = self.seasonal = None
        
    def preprocess_data(self, data):
        """Preprocessing with trend and seasonal decomposition"""
        data = np.maximum(data, 0.01)
        if np.all(data > 0):
            data = np.log1p(data)
        
        n, period = len(data), 7
        
        # Efficient trend calculation
        if n >= period * 2:
            trend = np.convolve(data, np.ones(period)/period, mode='same')
            half_period = period // 2
            trend[:half_period] = np.mean(data[:half_period+1])
            trend[-half_period:] = np.mean(data[-half_period:])
        else:
            trend = np.full(n, np.mean(data))
        
        # Vectorized seasonal component
        detrended = data - trend
        seasonal = np.zeros(n)
        if n >= period:
            for i in range(period):
                indices = np.arange(i, n, period)
                seasonal[indices] = np.mean(detrended[indices])
        
        self.trend, self.seasonal = trend, seasonal
        residual = data - trend - seasonal
        return self.scaler.fit_transform(residual.reshape(-1, 1)).flatten()
    
    def autocorrelation(self, data, max_lag):
        """Vectorized autocorrelation calculation"""
        n = len(data)
        if n < 2:
            return np.array([1.0] + [0.0] * max_lag)
        
        data = data - np.mean(data)
        c0 = np.sum(data ** 2) / n
        
        if c0 == 0:
            return np.array([1.0] + [0.0] * max_lag)
        
        autocorr = np.ones(max_lag + 1)
        for lag in range(1, min(max_lag + 1, n)):
            autocorr[lag] = np.sum(data[:-lag] * data[lag:]) / (n * c0)
        
        return autocorr
    
    def estimate_params(self, data, p, q):
        """Estimate AR and MA parameters"""
        params_ar = np.array([])
        if p > 0:
            autocorr = self.autocorrelation(data, p)
            R = np.array([[autocorr[abs(i - j)] for j in range(p)] for i in range(p)])
            R += 1e-6 * np.eye(p)
            try:
                params_ar = np.clip(np.linalg.solve(R, autocorr[1:p+1]), -0.95, 0.95)
            except:
                params_ar = np.linspace(0.3, 0.3 * p, p) / p
        
        params_ma = np.array([])
        if q > 0:
            residuals = self._calculate_residuals(data - np.mean(data), params_ar)
            autocorr = self.autocorrelation(residuals, q)
            params_ma = np.clip(-autocorr[1:q+1] * 0.5, -0.95, 0.95)
        
        return params_ar, params_ma
    
    def _calculate_residuals(self, data, ar_params):
        """Calculate residuals from AR process"""
        if len(ar_params) == 0:
            return data
        
        residuals = np.zeros(len(data))
        p = len(ar_params)
        for t in range(p, len(data)):
            ar_term = np.dot(ar_params, data[t-p:t][::-1])
            residuals[t] = data[t] - ar_term
        return residuals[p:]
    
    def fit(self, data):
        """Fit ARIMA model"""
        self.original_data = np.array(data, dtype=float)
        if len(self.original_data) < 10:
            self.mean = np.mean(self.original_data)
            self.fitted_values = np.full_like(self.original_data, self.mean)
            return self
        
        self.preprocessed_data = self.preprocess_data(self.original_data)
        
        # Differencing
        differenced = self.preprocessed_data.copy()
        for _ in range(self.d):
            if len(differenced) > 1:
                differenced = np.diff(differenced)
            else:
                self.d = 0
                break
        
        self.mean = np.mean(differenced)
        centered = differenced - self.mean
        
        # Parameter estimation
        self.params_ar, self.params_ma = self.estimate_params(centered, self.p, self.q)
        fitted = self._calculate_fitted_values(differenced)
        self.residuals = differenced - fitted
        
        # Inverse transform
        for _ in range(self.d):
            fitted = np.cumsum(np.concatenate([[self.preprocessed_data[-self.d]], fitted]))
        
        fitted_scaled = self.scaler.inverse_transform(fitted.reshape(-1, 1)).flatten()
        min_len = min(len(fitted_scaled), len(self.trend), len(self.seasonal))
        
        self.fitted_values = np.zeros(len(self.original_data))
        self.fitted_values[:min_len] = fitted_scaled[:min_len] + self.trend[:min_len] + self.seasonal[:min_len]
        self.fitted_values[min_len:] = np.mean(self.fitted_values[:min_len])
        self.fitted_values = np.maximum(np.expm1(self.fitted_values), 0)
        
        return self
    
    def _calculate_fitted_values(self, data):
        """Calculate fitted values from ARIMA model"""
        n = len(data)
        fitted = np.zeros(n)
        residuals = np.zeros(n)
        
        for t in range(n):
            ar_term = sum(self.params_ar[i] * (data[t-i-1] - self.mean) 
                         for i in range(min(self.p, t)) if i < len(self.params_ar))
            ma_term = sum(self.params_ma[i] * residuals[t-i-1] 
                         for i in range(min(self.q, t)) if i < len(self.params_ma))
            fitted[t] = self.mean + ar_term + ma_term
            residuals[t] = data[t] - fitted[t]
        
        return fitted
    
    def forecast(self, steps=1):
        """Generate forecasts"""
        if self.preprocessed_data is None or len(self.preprocessed_data) == 0:
            return np.full(steps, np.mean(self.original_data) if len(self.original_data) > 0 else 0)
        
        differenced = self.preprocessed_data.copy()
        for _ in range(self.d):
            differenced = np.diff(differenced)
        
        forecasts = []
        last_values = list(differenced)
        last_residuals = list(self.residuals) if self.residuals is not None else [0] * len(differenced)
        
        for step in range(steps):
            ar_term = sum(self.params_ar[i] * (last_values[-(i+1)] - self.mean) 
                         for i in range(min(self.p, len(last_values))) if i < len(self.params_ar))
            ma_term = sum(self.params_ma[i] * last_residuals[-(i+1)] 
                         for i in range(min(self.q, len(last_residuals))) if i < len(self.params_ma) and step == 0)
            
            forecast = self.mean + ar_term + ma_term
            forecasts.append(forecast)
            last_values.append(forecast)
            last_residuals.append(0)
        
        forecasts = np.array(forecasts)
        
        # Inverse differencing
        for _ in range(self.d):
            forecasts = np.cumsum(np.concatenate([[self.preprocessed_data[-self.d]], forecasts]))
        
        forecasts = self.scaler.inverse_transform(forecasts.reshape(-1, 1)).flatten()
        
        # Add trend and seasonal
        for i in range(steps):
            trend_val = self.trend[-1] if len(self.trend) > 0 else 0
            seasonal_idx = (len(self.seasonal) + i) % 7
            seasonal_val = self.seasonal[seasonal_idx] if seasonal_idx < len(self.seasonal) else 0
            forecasts[i] += trend_val + seasonal_val
        
        return np.maximum(np.expm1(forecasts), 0)
    
    def calculate_metrics(self):
        """Calculate model performance metrics"""
        if self.fitted_values is None or self.original_data is None:
            return {'mae': 1.0, 'rmse': 1.0, 'r2': 0.0, 'mae_normalized': 1.0, 'rmse_normalized': 1.0, 'mean_actual': 0.0}
        
        min_len = min(len(self.fitted_values), len(self.original_data))
        if min_len == 0:
            return {'mae': 1.0, 'rmse': 1.0, 'r2': 0.0, 'mae_normalized': 1.0, 'rmse_normalized': 1.0, 'mean_actual': 0.0}
        
        actual = self.original_data[-min_len:]
        predicted = self.fitted_values[-min_len:]
        mask = np.isfinite(actual) & np.isfinite(predicted)
        
        if not np.any(mask) or len(actual[mask]) < 2:
            return {'mae': 1.0, 'rmse': 1.0, 'r2': 0.0, 'mae_normalized': 1.0, 'rmse_normalized': 1.0, 'mean_actual': 0.0}
        
        actual, predicted = actual[mask], predicted[mask]
        
        try:
            mae = mean_absolute_error(actual, predicted)
            rmse = np.sqrt(np.mean((actual - predicted) ** 2))
            r2 = np.clip(r2_score(actual, predicted), -1.0, 1.0)
            mean_actual = np.mean(actual)
            
            # Normalized metrics (percentage of mean)
            mae_normalized = (mae / mean_actual) if mean_actual > 0 else 1.0
            rmse_normalized = (rmse / mean_actual) if mean_actual > 0 else 1.0
            
            return {
                'mae': float(mae),
                'rmse': float(rmse),
                'r2': float(r2),
                'mae_normalized': float(mae_normalized),
                'rmse_normalized': float(rmse_normalized),
                'mean_actual': float(mean_actual)
            }
        except:
            return {'mae': 1.0, 'rmse': 1.0, 'r2': 0.0, 'mae_normalized': 1.0, 'rmse_normalized': 1.0, 'mean_actual': 0.0}
    
    def calculate_aic(self):
        """Calculate AIC"""
        if self.residuals is None or len(self.residuals) == 0:
            return float('inf')
        n, k = len(self.residuals), self.p + self.q + 1
        if n <= k:
            return float('inf')
        var = np.var(self.residuals)
        return n * np.log(var) + 2 * k if var > 0 else float('inf')


class SalesForecastingEngine:
    """Sales forecasting engine"""
    
    def __init__(self, data_file='cleaned_customer_data.csv'):
        self.data_file = data_file
        self.df = None
        self.daily_sales = None
        self.category_sales = {}
        self.arima_model = None
        self.category_models = {}
        
        self._load_and_prepare_data()
        self._fit_models()
        
    def _load_and_prepare_data(self):
        """Load and prepare time series data"""
        try:
            self.df = pd.read_csv(self.data_file)
            self.df['Date'] = pd.to_datetime(self.df['Date'])
            self._prepare_daily_sales()
            self._prepare_category_sales()
            
        except FileNotFoundError:
            self.df = pd.DataFrame()
            self.daily_sales = None
        except Exception as e:
            self.df = pd.DataFrame()
            self.daily_sales = None
    
    def _prepare_daily_sales(self):
        """Prepare daily aggregates"""
        if self.df.empty:
            return
        
        daily = self.df.groupby('Date').agg({'Revenue': 'sum', 'Quantity': 'sum'}).reset_index()
        
        # Fill missing days
        date_range = pd.date_range(daily['Date'].min(), daily['Date'].max(), freq='D')
        daily = pd.DataFrame({'Date': date_range}).merge(daily, on='Date', how='left').fillna(0)
        
        # Smoothing
        daily['Revenue_Smoothed'] = daily['Revenue'].rolling(3, center=True, min_periods=1).mean()
        daily['Units_Smoothed'] = daily['Quantity'].rolling(3, center=True, min_periods=1).mean()
        
        self.daily_sales = daily.sort_values('Date').reset_index(drop=True)
    
    def _prepare_category_sales(self):
        """Prepare category aggregates"""
        if self.df.empty or self.daily_sales is None:
            return
        
        category_daily = self.df.groupby(['Date', 'Product_Type']).agg({
            'Revenue': 'sum', 'Quantity': 'sum'
        }).reset_index()
        
        date_range = pd.date_range(self.daily_sales['Date'].min(), self.daily_sales['Date'].max(), freq='D')
        
        for category in category_daily['Product_Type'].unique():
            cat_data = category_daily[category_daily['Product_Type'] == category]
            cat_filled = pd.DataFrame({'Date': date_range}).merge(
                cat_data[['Date', 'Revenue', 'Quantity']], on='Date', how='left'
            ).fillna(0)
            
            cat_filled['Revenue_Smoothed'] = cat_filled['Revenue'].rolling(3, center=True, min_periods=1).mean()
            cat_filled['Quantity_Smoothed'] = cat_filled['Quantity'].rolling(3, center=True, min_periods=1).mean()
            
            self.category_sales[category] = cat_filled.sort_values('Date').reset_index(drop=True)
    
    def _find_best_arima_params(self, series, max_p=2, max_d=1, max_q=2):
        """Find optimal ARIMA parameters"""
        if len(series) < 15:
            return (1, 1, 1)
        
        best_aic, best_params = float('inf'), (1, 1, 1)
        
        for p in range(max_p + 1):
            for d in range(max_d + 1):
                for q in range(max_q + 1):
                    if p + q > 0 and len(series) > p + d + q + 10:
                        try:
                            model = EnhancedARIMAModel(p, d, q)
                            model.fit(series)
                            aic = model.calculate_aic()
                            if aic < best_aic:
                                best_aic, best_params = aic, (p, d, q)
                        except:
                            continue
        return best_params
    
    def _fit_models(self):
        """Fit ARIMA models"""
        if self.daily_sales is None or len(self.daily_sales) < 15:
            return
        
        try:
            # Main model
            revenue = self.daily_sales['Revenue_Smoothed'].values
            p, d, q = self._find_best_arima_params(revenue)
            self.arima_model = EnhancedARIMAModel(p, d, q)
            self.arima_model.fit(revenue)
            
            # Category models
            for category, cat_data in self.category_sales.items():
                if len(cat_data) >= 15 and cat_data['Quantity'].sum() > 0:
                    try:
                        quantity = cat_data['Quantity_Smoothed'].values
                        p, d, q = self._find_best_arima_params(quantity)
                        model = EnhancedARIMAModel(p, d, q)
                        model.fit(quantity)
                        
                        if model.calculate_metrics()['r2'] > -0.5:
                            self.category_models[category] = model
                    except:
                        continue
            
        except Exception as e:
            pass
    
    def generate_forecast(self, period='7days'):
        """Generate forecast"""
        if self.arima_model is None:
            return self._empty_forecast()
        
        try:
            steps = 7 if period == '7days' else 15
            forecasts = self.arima_model.forecast(steps)
            last_date = self.daily_sales['Date'].max()
            metrics = self.arima_model.calculate_metrics()
            
            # Daily forecasts
            daily = []
            for i in range(steps):
                date = last_date + timedelta(days=i+1)
                revenue = max(0, forecasts[i])
                is_weekend = date.weekday() >= 5
                
                if is_weekend:
                    revenue *= 0.8
                
                daily.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'predicted': round(revenue, 2),
                    'day_name': date.strftime('%A'),
                    'is_weekend': is_weekend
                })
            
            # Calculate growth rate
            total_predicted = sum(f['predicted'] for f in daily)
            historical_revenue = self.daily_sales['Revenue'].tail(steps).sum()
            
            if historical_revenue > 0:
                growth_rate = ((total_predicted - historical_revenue) / historical_revenue) * 100
            else:
                growth_rate = 0.0
            
            uncertainty = max(0.1, 1 - metrics['r2']) if metrics['r2'] > 0 else 0.5
            
            # Line graph data
            line_data = []
            for _, row in self.daily_sales.iterrows():
                line_data.append({
                    'date': row['Date'].strftime('%Y-%m-%d'),
                    'actual': float(row['Revenue']),
                    'predicted': None,
                    'type': 'historical'
                })
            
            for f in daily:
                line_data.append({
                    'date': f['date'],
                    'actual': None,
                    'predicted': f['predicted'],
                    'type': 'forecast'
                })
            
            return {
                'summary': {
                    'predictedRevenue': round(total_predicted, 2),
                    'growthRate': round(growth_rate, 1),
                    'bestCase': round(total_predicted * (1 + uncertainty * 0.5), 2),
                    'worstCase': round(total_predicted * (1 - uncertainty * 0.3), 2),
                    'dailyAverage': round(total_predicted / steps, 2),
                    'historicalRevenue': round(historical_revenue, 2)
                },
                'dailyForecast': daily,
                'categoryForecast': self._category_forecast(steps, last_date),
                'lineGraphData': line_data,
                'topProducts': self._top_products(),
                'modelInfo': {
                    'type': f'ARIMA({self.arima_model.p},{self.arima_model.d},{self.arima_model.q})',
                    'dataPoints': len(self.daily_sales),
                    'forecastHorizon': f'{steps} days',
                    'lastDataDate': last_date.strftime('%Y-%m-%d'),
                    'accuracy': f"{round(max(0, metrics['r2'] * 100), 1)}%",
                    'categoryModels': len(self.category_models)
                }
            }
        except Exception as e:
            return self._empty_forecast()
    
    def _category_forecast(self, steps, last_date):
        """Category forecasts"""
        results = []
        
        for category, model in self.category_models.items():
            try:
                forecasts = model.forecast(steps)
                cat_hist = self.category_sales.get(category)
                
                # Average price
                avg_price = 0.0
                if cat_hist is not None and len(cat_hist) > 0:
                    recent = cat_hist.tail(14)
                    rev = float(recent['Revenue'].sum())
                    qty = int(recent['Quantity'].sum())
                    avg_price = (rev / qty) if qty > 0 else 0.0
                
                daily = []
                for i in range(steps):
                    date = last_date + timedelta(days=i+1)
                    qty = max(0, float(forecasts[i]))
                    rev = round(qty * avg_price, 2) if avg_price > 0 else 0.0
                    
                    daily.append({
                        'date': date.strftime('%Y-%m-%d'),
                        'predicted_quantity': round(qty, 0),
                        'predicted_revenue': rev,
                        'day_name': date.strftime('%A'),
                        'is_weekend': date.weekday() >= 5
                    })
                
                total = int(sum(f['predicted_quantity'] for f in daily))
                results.append({
                    'category': category,
                    'total_predicted_quantity': total,
                    'daily_average': round(total / steps, 1),
                    'daily_forecasts': daily
                })
            except:
                continue
        
        return sorted(results, key=lambda x: x['total_predicted_quantity'], reverse=True)
    
    def _top_products(self):
        """Top products forecast"""
        products = []
        
        for category, model in self.category_models.items():
            if category not in self.category_sales:
                continue
            
            try:
                cat_data = self.category_sales[category]
                recent_rev = cat_data['Revenue'].tail(14).sum()
                recent_qty = cat_data['Quantity'].tail(14).sum()
                
                if recent_qty == 0:
                    continue
                
                forecasts = model.forecast(7)
                total_qty = sum(max(0, q) for q in forecasts)
                avg_price = recent_rev / recent_qty
                predicted_sales = total_qty * avg_price
                
                hist_qty = cat_data['Quantity'].tail(7).sum()
                growth = ((total_qty - hist_qty) / hist_qty * 100) if hist_qty > 0 else 0.0
                
                if predicted_sales > 0:
                    products.append({
                        'name': category,
                        'predictedSales': round(predicted_sales, 2),
                        'predictedQuantity': int(total_qty),
                        'growth': round(growth, 1),
                        'avgPrice': round(avg_price, 2)
                    })
            except:
                continue
        
        return sorted(products, key=lambda x: x['predictedSales'], reverse=True)[:5]
    
    def _empty_forecast(self):
        """Empty forecast structure"""
        return {
            'summary': {'predictedRevenue': 0, 'growthRate': 0,
                       'bestCase': 0, 'worstCase': 0, 'dailyAverage': 0},
            'dailyForecast': [], 'categoryForecast': [], 'lineGraphData': [],
            'topProducts': [], 'modelInfo': {
                'type': 'No model', 'dataPoints': 0, 'forecastHorizon': 'N/A',
                'lastDataDate': 'N/A', 'accuracy': '0%', 'categoryModels': 0
            }
        }


# Flask API
app = Flask(__name__)
CORS(app)
engine = None

def get_engine():
    global engine
    if engine is None:
        try:
            engine = SalesForecastingEngine()
        except Exception as e:
            engine = SalesForecastingEngine()
    return engine

@app.route('/api/sales/forecast', methods=['GET'])
def get_forecast():
    period = request.args.get('period', '7days')
    period = '7days' if period not in ['7days', '15days'] else period
    return jsonify(get_engine().generate_forecast(period))

@app.route('/api/sales/metrics', methods=['GET'])
def get_metrics():
    eng = get_engine()
    if eng.arima_model is None:
        return jsonify({'error': 'No model'}), 404
    
    m = eng.arima_model.calculate_metrics()
    return jsonify({
        'main_model': {
            'type': f"ARIMA({eng.arima_model.p},{eng.arima_model.d},{eng.arima_model.q})",
            'mae': round(m['mae'], 2),
            'rmse': round(m['rmse'], 2),
            'r2': round(m['r2'], 4),
            'mae_normalized': round(m['mae_normalized'], 4),
            'rmse_normalized': round(m['rmse_normalized'], 4),
            'mean_actual': round(m['mean_actual'], 2),
            'accuracy': f"{round(max(0, m['r2'] * 100), 1)}%"
        },
        'data_points': len(eng.daily_sales) if eng.daily_sales is not None else 0,
        'category_models': len(eng.category_models)
    })

@app.route('/api/sales/categories', methods=['GET'])
def get_categories():
    eng = get_engine()
    period = request.args.get('period', '7days')
    steps = 7 if period == '7days' else 15
    
    if not eng.category_models:
        return jsonify({'error': 'No category models'}), 404
    
    last_date = eng.daily_sales['Date'].max()
    return jsonify({
        'categories': eng._category_forecast(steps, last_date),
        'period': period,
        'forecast_steps': steps,
        'total_categories': len(eng.category_models)
    })

@app.route('/api/sales/data-status', methods=['GET'])
def get_status():
    eng = get_engine()
    available = eng.df is not None and not eng.df.empty
    
    cat_info = {}
    for cat, data in eng.category_sales.items():
        cat_info[cat] = {
            'data_points': len(data),
            'total_quantity': int(data['Quantity'].sum()),
            'total_revenue': round(data['Revenue'].sum(), 2),
            'has_model': cat in eng.category_models
        }
    
    return jsonify({
        'status': 'success',
        'data_available': available,
        'record_count': len(eng.df) if available else 0,
        'daily_points': len(eng.daily_sales) if eng.daily_sales is not None else 0,
        'models_trained': eng.arima_model is not None,
        'category_models': len(eng.category_models),
        'categories': cat_info
    })

@app.route('/api/sales/retrain', methods=['POST'])
def retrain():
    global engine
    engine = SalesForecastingEngine()
    
    return jsonify({
        'status': 'success',
        'message': 'Retrained',
        'main_model': engine.arima_model is not None,
        'category_models': len(engine.category_models),
        'categories': list(engine.category_models.keys())
    })

@app.route('/health', methods=['GET'])
def health():
    eng = get_engine()
    return jsonify({
        'status': 'healthy',
        'engine': 'Enhanced ARIMA Engine',
        'timestamp': datetime.now().isoformat(),
        'models': {
            'main': eng.arima_model is not None,
            'categories': len(eng.category_models),
            'data_loaded': eng.df is not None and not eng.df.empty
        }
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)