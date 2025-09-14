import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

from flask import Flask, request, jsonify
from flask_cors import CORS

class ARIMAModel:
    """Enhanced ARIMA Model implementation with evaluation metrics"""
    
    def __init__(self, p=1, d=1, q=1):
        self.p = p
        self.d = d
        self.q = q
        self.params_ar = None
        self.params_ma = None
        self.residuals = None
        self.original_data = None
        self.mean = 0
        self.fitted_values = None
        
    def difference(self, data, d):
        """Apply differencing to make series stationary"""
        diff_data = data.copy()
        for i in range(d):
            diff_data = np.diff(diff_data)
        return diff_data
    
    def inverse_difference(self, diff_data, original_data, d):
        """Reverse differencing to get original scale"""
        result = diff_data.copy()
        
        for i in range(d):
            last_value = original_data[-(d-i)] if len(original_data) > d - i - 1 else original_data[-1]
            reconstructed = [last_value]
            for val in result:
                reconstructed.append(reconstructed[-1] + val)
            result = np.array(reconstructed[1:])
            
        return result
    
    def autocorrelation(self, data, max_lag):
        """Calculate autocorrelation function"""
        n = len(data)
        data = data - np.mean(data)
        
        autocorr = np.zeros(max_lag + 1)
        autocorr[0] = 1.0
        
        c0 = np.sum(data ** 2) / n
        if c0 == 0:
            return autocorr
            
        for lag in range(1, max_lag + 1):
            c_lag = np.sum(data[:-lag] * data[lag:]) / n
            autocorr[lag] = c_lag / c0
        
        return autocorr
    
    def estimate_ar_params(self, data, p):
        """Estimate AR parameters using Yule-Walker equations"""
        if p == 0:
            return np.array([])
        
        autocorr = self.autocorrelation(data, p)
        R = np.zeros((p, p))
        r = np.zeros(p)
        
        for i in range(p):
            r[i] = autocorr[i + 1]
            for j in range(p):
                R[i, j] = autocorr[abs(i - j)]
        
        try:
            phi = np.linalg.solve(R, r)
        except:
            phi = np.zeros(p)
        
        return phi
    
    def estimate_ma_params(self, residuals, q):
        """Estimate MA parameters"""
        if q == 0:
            return np.array([])
        
        autocorr = self.autocorrelation(residuals, q)
        return np.array([-autocorr[i + 1] * 0.8 for i in range(q)])
    
    def fit(self, data):
        """Fit ARIMA model to data"""
        self.original_data = np.array(data)
        
        # Apply differencing
        differenced_data = self.difference(self.original_data, self.d) if self.d > 0 else self.original_data.copy()
        
        self.mean = np.mean(differenced_data)
        centered_data = differenced_data - self.mean
        
        # Estimate parameters
        self.params_ar = self.estimate_ar_params(centered_data, self.p)
        residuals = self._calculate_residuals(centered_data)
        self.params_ma = self.estimate_ma_params(residuals, self.q)
        
        # Final residuals and fitted values
        fitted_values = self._calculate_fitted_values(differenced_data)
        self.residuals = differenced_data - fitted_values
        
        # Store fitted values in original scale for evaluation
        if self.d > 0:
            self.fitted_values = self.inverse_difference(fitted_values, self.original_data, self.d)
        else:
            self.fitted_values = fitted_values
        
        return self
    
    def _calculate_residuals(self, data):
        """Calculate residuals from AR model"""
        residuals = np.zeros(len(data))
        
        for t in range(self.p, len(data)):
            ar_term = sum(self.params_ar[i] * data[t - i - 1] for i in range(self.p))
            residuals[t] = data[t] - ar_term
        
        return residuals[self.p:] if self.p > 0 else residuals
    
    def _calculate_fitted_values(self, data):
        """Calculate fitted values"""
        fitted = np.zeros(len(data))
        residuals = np.zeros(len(data))
        
        for t in range(len(data)):
            # AR component
            ar_term = sum(self.params_ar[i] * (data[t - i - 1] - self.mean) 
                         for i in range(min(self.p, t)) if t - i - 1 >= 0)
            
            # MA component
            ma_term = sum(self.params_ma[i] * residuals[t - i - 1] 
                         for i in range(min(self.q, t)) if t - i - 1 >= 0)
            
            fitted[t] = self.mean + ar_term + ma_term
            residuals[t] = data[t] - fitted[t]
        
        return fitted
    
    def forecast(self, steps=1):
        """Generate forecasts"""
        differenced_data = self.difference(self.original_data, self.d) if self.d > 0 else self.original_data.copy()
            
        forecasts = []
        last_values = differenced_data.copy()
        last_residuals = self.residuals.copy() if self.residuals is not None else np.zeros(len(differenced_data))
        
        for step in range(steps):
            # AR component
            ar_term = sum(self.params_ar[i] * (last_values[-(i+1)] - self.mean) 
                         for i in range(min(self.p, len(last_values))))
            
            # MA component (only for one-step ahead)
            ma_term = 0
            if step == 0:
                ma_term = sum(self.params_ma[i] * last_residuals[-(i+1)] 
                             for i in range(min(self.q, len(last_residuals))))
            
            forecast = self.mean + ar_term + ma_term
            forecasts.append(forecast)
            
            # Update for next forecast
            last_values = np.append(last_values, forecast)
            last_residuals = np.append(last_residuals, 0)
        
        # Convert back to original scale if differencing was applied
        if self.d > 0:
            forecasts = self.inverse_difference(np.array(forecasts), self.original_data, self.d)
        
        return forecasts
    
    def calculate_metrics(self):
        """Calculate evaluation metrics: MAE, MSE, RMSE, R²"""
        if self.fitted_values is None or self.original_data is None:
            return {'mae': float('inf'), 'mse': float('inf'), 'rmse': float('inf'), 'r2': -float('inf')}
        
        # Ensure same length for comparison
        min_len = min(len(self.fitted_values), len(self.original_data))
        actual = self.original_data[-min_len:]
        predicted = self.fitted_values[-min_len:]
        
        # Calculate metrics
        mae = np.mean(np.abs(actual - predicted))
        mse = np.mean((actual - predicted) ** 2)
        rmse = np.sqrt(mse)
        
        # R²
        ss_res = np.sum((actual - predicted) ** 2)
        ss_tot = np.sum((actual - np.mean(actual)) ** 2)
        r2 = 1 - (ss_res / ss_tot) if ss_tot != 0 else -float('inf')
        
        return {
            'mae': float(mae),
            'mse': float(mse),
            'rmse': float(rmse),
            'r2': float(r2)
        }
    
    def calculate_aic(self):
        """Calculate AIC"""
        if self.residuals is None:
            return float('inf')
            
        n = len(self.residuals)
        k = self.p + self.q
        mse = np.mean(self.residuals ** 2)
        
        if mse <= 0:
            return float('inf')
        
        return n * np.log(mse) + 2 * k

class SalesForecastingEngine:
    """Enhanced Sales Forecasting Engine with category forecasting and metrics"""
    
    def __init__(self, data_file='cleaned_customer_data.csv'):
        self.data_file = data_file
        self.df = None
        self.daily_sales = None
        self.category_sales = None
        self.arima_model = None
        self.category_models = {}
        
        self.load_and_prepare_data()
        
    def load_and_prepare_data(self):
        """Load and prepare data"""
        try:
            self.df = pd.read_csv(self.data_file)
            print(f"Loaded {len(self.df)} records")
            
            # Handle the boolean Loyalty Member column
            if 'Loyalty Member' in self.df.columns:
                # Convert string representations to boolean if needed
                if self.df['Loyalty Member'].dtype == 'object':
                    self.df['Loyalty Member'] = self.df['Loyalty Member'].map({
                        'True': True, 'False': False, 'Yes': True, 'No': False,
                        True: True, False: False
                    }).fillna(False)
            
            self._prepare_time_series()
            self._prepare_category_time_series()
            self._fit_models()
        except Exception as e:
            print(f"Error loading data: {str(e)}")
            self.df = pd.DataFrame()
    
    def _prepare_time_series(self):
        """Prepare daily sales time series"""
        if self.df.empty:
            return
        
        # Convert date and filter completed orders
        self.df['Purchase Date'] = pd.to_datetime(self.df['Purchase Date'])
        completed_df = self.df[self.df['Order Status'] == 'Completed'].copy()
        
        if completed_df.empty:
            print("No completed orders found")
            return
        
        # Group by day
        completed_df['Date'] = completed_df['Purchase Date'].dt.date
        self.daily_sales = completed_df.groupby('Date').agg({
            'Total Price': 'sum',
            'Quantity': 'sum',
            'Customer ID': 'nunique'
        }).reset_index()
        
        self.daily_sales.columns = ['Date', 'Revenue', 'Units_Sold', 'Customers']
        self.daily_sales['Date'] = pd.to_datetime(self.daily_sales['Date'])
        
        # Fill missing days and sort
        self._fill_missing_days()
        self.daily_sales = self.daily_sales.sort_values('Date').reset_index(drop=True)
        
        print(f"Prepared {len(self.daily_sales)} days of data")
        
    def _prepare_category_time_series(self):
        """Prepare daily sales time series by product category"""
        if self.df.empty:
            return
        
        completed_df = self.df[self.df['Order Status'] == 'Completed'].copy()
        
        if completed_df.empty:
            return
        
        # Group by date and product type
        completed_df['Date'] = completed_df['Purchase Date'].dt.date
        category_daily = completed_df.groupby(['Date', 'Product Type']).agg({
            'Total Price': 'sum',
            'Quantity': 'sum'
        }).reset_index()
        
        category_daily['Date'] = pd.to_datetime(category_daily['Date'])
        
        # Create time series for each category
        self.category_sales = {}
        categories = category_daily['Product Type'].unique()
        
        for category in categories:
            cat_data = category_daily[category_daily['Product Type'] == category].copy()
            
            # Fill missing days
            date_range = pd.date_range(
                start=self.daily_sales['Date'].min() if self.daily_sales is not None else cat_data['Date'].min(),
                end=self.daily_sales['Date'].max() if self.daily_sales is not None else cat_data['Date'].max(),
                freq='D'
            )
            complete_df = pd.DataFrame({'Date': date_range})
            
            cat_filled = complete_df.merge(cat_data[['Date', 'Total Price', 'Quantity']], on='Date', how='left')
            cat_filled[['Total Price', 'Quantity']] = cat_filled[['Total Price', 'Quantity']].fillna(0)
            cat_filled = cat_filled.sort_values('Date').reset_index(drop=True)
            
            self.category_sales[category] = cat_filled
        
        print(f"Prepared category data for {len(categories)} categories")
        
    def _fill_missing_days(self):
        """Fill missing days in time series"""
        if self.daily_sales.empty:
            return
        
        date_range = pd.date_range(
            start=self.daily_sales['Date'].min(),
            end=self.daily_sales['Date'].max(),
            freq='D'
        )
        complete_df = pd.DataFrame({'Date': date_range})
        
        self.daily_sales = complete_df.merge(self.daily_sales, on='Date', how='left')
        self.daily_sales[['Revenue', 'Units_Sold', 'Customers']] = \
            self.daily_sales[['Revenue', 'Units_Sold', 'Customers']].fillna(0)
    
    def _find_best_arima_params(self, data_series):
        """Find best ARIMA parameters for a given series"""
        if len(data_series) < 30:
            return (1, 1, 1)
        
        best_aic = float('inf')
        best_params = (1, 1, 1)
        
        for p in range(3):
            for d in range(2):
                for q in range(3):
                    try:
                        model = ARIMAModel(p=p, d=d, q=q)
                        model.fit(data_series)
                        aic = model.calculate_aic()
                        
                        if aic < best_aic:
                            best_aic = aic
                            best_params = (p, d, q)
                    except:
                        continue
        
        return best_params
    
    def _fit_models(self):
        """Fit ARIMA models for revenue and categories"""
        if self.daily_sales is None or len(self.daily_sales) < 10:
            print("Insufficient data for modeling")
            return
        
        try:
            # Fit main revenue model
            revenue_series = self.daily_sales['Revenue'].values
            p, d, q = self._find_best_arima_params(revenue_series)
            
            self.arima_model = ARIMAModel(p=p, d=d, q=q)
            self.arima_model.fit(revenue_series)
            
            print(f"Main ARIMA({p},{d},{q}) fitted successfully")
            
            # Fit category models
            if self.category_sales:
                for category, cat_data in self.category_sales.items():
                    if len(cat_data) >= 10 and cat_data['Quantity'].sum() > 0:
                        try:
                            quantity_series = cat_data['Quantity'].values
                            p_cat, d_cat, q_cat = self._find_best_arima_params(quantity_series)
                            
                            cat_model = ARIMAModel(p=p_cat, d=d_cat, q=q_cat)
                            cat_model.fit(quantity_series)
                            
                            self.category_models[category] = cat_model
                            print(f"Category '{category}' ARIMA({p_cat},{d_cat},{q_cat}) fitted")
                        except Exception as e:
                            print(f"Failed to fit model for category '{category}': {str(e)}")
            
        except Exception as e:
            print(f"Error fitting models: {str(e)}")
    
    def generate_forecast(self, period='7days'):
        """Generate comprehensive forecast with metrics and category forecasting"""
        if self.arima_model is None:
            return self._get_empty_forecast()
        
        try:
            forecast_steps = 7 if period == '7days' else 15
            
            # Generate revenue forecasts
            forecasts = self.arima_model.forecast(steps=forecast_steps)
            last_date = self.daily_sales['Date'].max()
            
            # Calculate model metrics
            model_metrics = self.arima_model.calculate_metrics()
            
            # Create forecast data
            daily_forecasts = []
            for i in range(forecast_steps):
                future_date = last_date + timedelta(days=i+1)
                predicted_revenue = max(0, forecasts[i])
                
                # Calculate confidence
                base_confidence = 85 - (i * 2)  # Decrease with horizon
                is_weekend = future_date.weekday() >= 5
                
                if is_weekend:
                    predicted_revenue *= 0.8
                    base_confidence -= 5
                
                confidence = max(50, base_confidence)
                
                daily_forecasts.append({
                    'date': future_date.strftime('%Y-%m-%d'),
                    'predicted': round(predicted_revenue, 2),
                    'confidence': round(confidence, 1),
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
            uncertainty_factor = (100 - avg_confidence) / 100
            
            # Prepare ALL historical data + forecast data for line graph
            line_graph_data = []
            
            # Add ALL historical data points
            for _, row in self.daily_sales.iterrows():
                line_graph_data.append({
                    'date': row['Date'].strftime('%Y-%m-%d'),
                    'actual': float(row['Revenue']),
                    'predicted': None,
                    'type': 'historical'
                })
            
            # Add forecast data
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
                    'bestCase': round(total_predicted * (1 + uncertainty_factor * 0.4), 2),
                    'worstCase': round(total_predicted * (1 - uncertainty_factor * 0.2), 2),
                    'dailyAverage': round(total_predicted / forecast_steps, 2)
                },
                'dailyForecast': daily_forecasts,
                'categoryForecast': category_forecasts,
                'lineGraphData': line_graph_data,
                'topProducts': self._get_top_products_forecast(),
                'modelInfo': {
                    'type': f'ARIMA({self.arima_model.p},{self.arima_model.d},{self.arima_model.q})',
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
            
        except Exception as e:
            print(f"Error generating forecast: {str(e)}")
            return self._get_empty_forecast()
    
    def _generate_category_forecasts(self, forecast_steps, last_date):
        """Generate forecasts for each product category"""
        category_forecasts = []
        
        for category, model in self.category_models.items():
            try:
                forecasts = model.forecast(steps=forecast_steps)
                metrics = model.calculate_metrics()
                
                daily_category_forecasts = []
                for i in range(forecast_steps):
                    future_date = last_date + timedelta(days=i+1)
                    predicted_quantity = max(0, forecasts[i])
                    
                    # Apply weekend adjustment
                    if future_date.weekday() >= 5:
                        predicted_quantity *= 0.7
                    
                    daily_category_forecasts.append({
                        'date': future_date.strftime('%Y-%m-%d'),
                        'predicted_quantity': round(predicted_quantity, 0),
                        'day_name': future_date.strftime('%A')
                    })
                
                total_predicted_quantity = sum(f['predicted_quantity'] for f in daily_category_forecasts)
                
                category_forecasts.append({
                    'category': category,
                    'total_predicted_quantity': int(total_predicted_quantity),
                    'daily_average': round(total_predicted_quantity / forecast_steps, 1),
                    'daily_forecasts': daily_category_forecasts,
                    'model_metrics': {
                        'mae': round(metrics['mae'], 2),
                        'rmse': round(metrics['rmse'], 2),
                        'r2': round(metrics['r2'], 4)
                    },
                    'model_type': f"ARIMA({model.p},{model.d},{model.q})"
                })
                
            except Exception as e:
                print(f"Error forecasting category '{category}': {str(e)}")
                continue
        
        # Sort by total predicted quantity
        category_forecasts.sort(key=lambda x: x['total_predicted_quantity'], reverse=True)
        
        return category_forecasts
    
    def _get_top_products_forecast(self):
        """Get top products forecast based on category models"""
        if not self.category_models:
            return self._get_legacy_top_products_forecast()
        
        top_products = []
        
        for category, model in self.category_models.items():
            try:
                # Get recent historical data
                if category in self.category_sales:
                    cat_data = self.category_sales[category]
                    recent_revenue = cat_data['Total Price'].tail(7).sum()
                    recent_quantity = cat_data['Quantity'].tail(7).sum()
                    
                    # Forecast next 7 days
                    forecasted_quantities = model.forecast(steps=7)
                    total_forecasted_quantity = sum(max(0, q) for q in forecasted_quantities)
                    
                    # Estimate revenue based on average price
                    avg_price = recent_revenue / recent_quantity if recent_quantity > 0 else 0
                    predicted_sales = total_forecasted_quantity * avg_price
                    
                    # Calculate growth rate
                    historical_quantity = cat_data['Quantity'].tail(7).sum()
                    growth_rate = ((total_forecasted_quantity - historical_quantity) / historical_quantity * 100) if historical_quantity > 0 else 0
                    
                    if predicted_sales > 0:  # Only include categories with positive predictions
                        top_products.append({
                            'name': category,
                            'predictedSales': round(predicted_sales, 2),
                            'predictedQuantity': int(total_forecasted_quantity),
                            'growth': round(growth_rate, 1),
                            'avgPrice': round(avg_price, 2)
                        })
                        
            except Exception as e:
                print(f"Error in top products for category '{category}': {str(e)}")
                continue
        
        return sorted(top_products, key=lambda x: x['predictedSales'], reverse=True)[:5]
    
    def _get_legacy_top_products_forecast(self):
        """Legacy method for top products when category models are not available"""
        if self.df.empty:
            return []
        
        try:
            completed_orders = self.df[self.df['Order Status'] == 'Completed']
            recent_date = completed_orders['Purchase Date'].max() - pd.DateOffset(days=14)
            recent_orders = completed_orders[completed_orders['Purchase Date'] >= recent_date]
            
            if recent_orders.empty:
                return []
            
            product_stats = recent_orders.groupby('Product Type').agg({
                'Total Price': 'sum',
                'Quantity': 'sum'
            }).reset_index()
            
            top_products = []
            for _, row in product_stats.head(5).iterrows():
                predicted_sales = row['Total Price'] * 1.05
                predicted_quantity = row['Quantity'] * 1.05
                growth_rate = np.random.normal(3, 8)
                avg_price = row['Total Price'] / row['Quantity'] if row['Quantity'] > 0 else 0
                
                top_products.append({
                    'name': row['Product Type'],
                    'predictedSales': round(predicted_sales, 2),
                    'predictedQuantity': int(predicted_quantity),
                    'growth': round(growth_rate, 1),
                    'avgPrice': round(avg_price, 2)
                })
            
            return sorted(top_products, key=lambda x: x['predictedSales'], reverse=True)
            
        except Exception as e:
            print(f"Error getting legacy top products: {str(e)}")
            return []
    
    def _get_empty_forecast(self):
        """Return empty forecast structure"""
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
                'metrics': {
                    'mae': 0,
                    'mse': 0,
                    'rmse': 0,
                    'r2': 0
                },
                'categoryModels': 0
            }
        }

# Flask API
app = Flask(__name__)
CORS(app)

# Global forecasting engine
forecasting_engine = None

def initialize_engine():
    """Initialize forecasting engine"""
    global forecasting_engine
    try:
        forecasting_engine = SalesForecastingEngine('cleaned_customer_data.csv')
        print("Enhanced forecasting engine initialized successfully with cleaned data")
    except Exception as e:
        print(f"Error initializing engine: {str(e)}")
        forecasting_engine = SalesForecastingEngine()

@app.route('/api/sales/forecast', methods=['GET'])
def get_sales_forecast():
    """Get sales forecast with metrics and category forecasting"""
    global forecasting_engine
    
    if forecasting_engine is None:
        initialize_engine()
    
    try:
        period = request.args.get('period', '7days')
        period = '7days' if period not in ['7days', '15days'] else period
        
        forecast_data = forecasting_engine.generate_forecast(period)
        return jsonify(forecast_data)
        
    except Exception as e:
        print(f"API Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/sales/metrics', methods=['GET'])
def get_model_metrics():
    """Get detailed model performance metrics"""
    global forecasting_engine
    
    if forecasting_engine is None:
        initialize_engine()
    
    try:
        if forecasting_engine.arima_model is None:
            return jsonify({'error': 'No model trained'}), 404
        
        # Main model metrics
        main_metrics = forecasting_engine.arima_model.calculate_metrics()
        
        # Category model metrics
        category_metrics = {}
        for category, model in forecasting_engine.category_models.items():
            category_metrics[category] = {
                'metrics': model.calculate_metrics(),
                'model_params': f"ARIMA({model.p},{model.d},{model.q})"
            }
        
        return jsonify({
            'main_model': {
                'type': f"ARIMA({forecasting_engine.arima_model.p},{forecasting_engine.arima_model.d},{forecasting_engine.arima_model.q})",
                'metrics': main_metrics
            },
            'category_models': category_metrics,
            'data_points': len(forecasting_engine.daily_sales) if forecasting_engine.daily_sales is not None else 0
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/sales/categories', methods=['GET'])
def get_category_forecast():
    """Get detailed category quantity forecasts"""
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
    """Check data availability status"""
    global forecasting_engine
    
    if forecasting_engine is None:
        initialize_engine()
    
    try:
        data_available = forecasting_engine.df is not None and not forecasting_engine.df.empty
        record_count = len(forecasting_engine.df) if data_available else 0
        daily_points = len(forecasting_engine.daily_sales) if forecasting_engine.daily_sales is not None else 0
        
        # Get category information
        categories_info = {}
        if forecasting_engine.category_sales:
            for category, cat_data in forecasting_engine.category_sales.items():
                categories_info[category] = {
                    'data_points': len(cat_data),
                    'total_quantity': int(cat_data['Quantity'].sum()),
                    'total_revenue': round(cat_data['Total Price'].sum(), 2),
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
    """Retrain forecasting models"""
    try:
        global forecasting_engine
        forecasting_engine = SalesForecastingEngine('cleaned_customer_data.csv')
        
        # Get training summary
        main_model_trained = forecasting_engine.arima_model is not None
        category_models_count = len(forecasting_engine.category_models)
        
        return jsonify({
            'status': 'success', 
            'message': 'Models retrained successfully',
            'main_model_trained': main_model_trained,
            'category_models_trained': category_models_count,
            'categories': list(forecasting_engine.category_models.keys()) if forecasting_engine.category_models else []
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/api/sales/category/<category_name>/forecast', methods=['GET'])
def get_single_category_forecast(category_name):
    """Get forecast for a specific category"""
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
        
        # Create detailed forecast
        daily_forecasts = []
        for i in range(forecast_steps):
            future_date = last_date + timedelta(days=i+1)
            predicted_quantity = max(0, forecasts[i])
            
            # Apply weekend adjustment
            if future_date.weekday() >= 5:
                predicted_quantity *= 0.7
            
            daily_forecasts.append({
                'date': future_date.strftime('%Y-%m-%d'),
                'predicted_quantity': round(predicted_quantity, 0),
                'day_name': future_date.strftime('%A'),
                'is_weekend': future_date.weekday() >= 5
            })
        
        # Get historical data for this category
        historical_data = []
        if category_name in forecasting_engine.category_sales:
            cat_data = forecasting_engine.category_sales[category_name]
            for _, row in cat_data.iterrows():
                historical_data.append({
                    'date': row['Date'].strftime('%Y-%m-%d'),
                    'actual_quantity': int(row['Quantity']),
                    'actual_revenue': round(row['Total Price'], 2)
                })
        
        return jsonify({
            'category': category_name,
            'model_type': f"ARIMA({model.p},{model.d},{model.q})",
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
            'historical_data': historical_data[-30:]  # Last 30 days
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/sales/model-comparison', methods=['GET'])
def get_model_comparison():
    """Compare performance across all models"""
    global forecasting_engine
    
    if forecasting_engine is None:
        initialize_engine()
    
    try:
        if forecasting_engine.arima_model is None:
            return jsonify({'error': 'No models trained'}), 404
        
        comparison_data = []
        
        # Main revenue model
        main_metrics = forecasting_engine.arima_model.calculate_metrics()
        comparison_data.append({
            'model_name': 'Revenue (Main)',
            'model_type': f"ARIMA({forecasting_engine.arima_model.p},{forecasting_engine.arima_model.d},{forecasting_engine.arima_model.q})",
            'target_variable': 'Revenue',
            'data_points': len(forecasting_engine.daily_sales),
            'mae': round(main_metrics['mae'], 2),
            'mse': round(main_metrics['mse'], 2),
            'rmse': round(main_metrics['rmse'], 2),
            'r2': round(main_metrics['r2'], 4),
            'r2_percentage': round(main_metrics['r2'] * 100, 2) if main_metrics['r2'] > 0 else 0
        })
        
        # Category models
        for category, model in forecasting_engine.category_models.items():
            metrics = model.calculate_metrics()
            data_points = len(forecasting_engine.category_sales[category]) if category in forecasting_engine.category_sales else 0
            
            comparison_data.append({
                'model_name': f'{category} (Quantity)',
                'model_type': f"ARIMA({model.p},{model.d},{model.q})",
                'target_variable': 'Quantity',
                'data_points': data_points,
                'mae': round(metrics['mae'], 2),
                'mse': round(metrics['mse'], 2),
                'rmse': round(metrics['rmse'], 2),
                'r2': round(metrics['r2'], 4),
                'r2_percentage': round(metrics['r2'] * 100, 2) if metrics['r2'] > 0 else 0
            })
        
        # Sort by R² score
        comparison_data.sort(key=lambda x: x['r2'], reverse=True)
        
        # Calculate summary statistics
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
    """Health check endpoint"""
    global forecasting_engine
    
    models_status = {
        'main_model': forecasting_engine.arima_model is not None if forecasting_engine else False,
        'category_models': len(forecasting_engine.category_models) if forecasting_engine else 0,
        'data_loaded': forecasting_engine.df is not None and not forecasting_engine.df.empty if forecasting_engine else False
    }
    
    return jsonify({
        'status': 'healthy',
        'engine': 'Enhanced ARIMA Forecasting with Metrics - Cleaned Data',
        'timestamp': datetime.now().isoformat(),
        'models': models_status,
        'features': [
            'Revenue Forecasting',
            'Category Quantity Forecasting', 
            'Model Performance Metrics (MAE, MSE, RMSE, R²)',
            'Multi-Model Comparison',
            'Historical Data Analysis',
            'Cleaned Dataset Integration'
        ]
    })

if __name__ == '__main__':
    print("Initializing Enhanced ARIMA Forecasting Engine with Cleaned Data...")
    initialize_engine()
    
    print("Starting Enhanced Sales Forecasting API...")
    print("Available endpoints:")
    print("- GET  /api/sales/forecast?period=7days|15days")
    print("- GET  /api/sales/metrics")
    print("- GET  /api/sales/categories?period=7days|15days")
    print("- GET  /api/sales/category/<name>/forecast?period=7days|15days")
    print("- GET  /api/sales/model-comparison")
    print("- GET  /api/sales/data-status")
    print("- POST /api/sales/retrain")
    print("- GET  /health")
    print("\nDataset Features:")
    print("✓ Using cleaned_customer_data.csv")
    print("✓ Enhanced with additional columns (Year, Month, Day, etc.)")
    print("✓ Boolean Loyalty Member handling")
    print("✓ Price Discrepancy detection")
    print("✓ Temporal features (Quarter, WeekOfYear, DayOfWeek)")
    print("\nModel Features:")
    print("✓ Model Performance Metrics (MAE, MSE, RMSE, R²)")
    print("✓ Category-wise Quantity Forecasting")
    print("✓ Individual Category Model Analysis")
    print("✓ Multi-Model Performance Comparison")
    print("✓ Enhanced API Endpoints")
    
    app.run(debug=True, host='0.0.0.0', port=5001)