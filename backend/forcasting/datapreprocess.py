import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

class DataPreprocessor:
    """
    Simplified data preprocessing that creates a single CSV with only forecasting-essential columns
    """
    
    def __init__(self, input_file='data.csv', output_file='cleaned_customer_data.csv'):
        self.input_file = input_file
        self.output_file = output_file
        self.df = None
        
    def load_data(self):
        """Load raw data from CSV"""
        print("Reading data...")
        self.df = pd.read_csv(self.input_file)
        print(f"Original data shape: {self.df.shape}")
        print(f"Original columns: {list(self.df.columns)}")
        
        # Print column availability for key columns
        key_columns = ['Purchase Date', 'Order Status', 'Product Type', 
                      'Total Price', 'Quantity', 'Customer ID']
        print("\nKey column availability:")
        for col in key_columns:
            status = "✓" if col in self.df.columns else "✗"
            print(f"  {status} {col}")
        
        return self
    
    def validate_required_columns(self):
        """Ensure required columns exist"""
        required = ['Purchase Date', 'Order Status', 'Total Price', 'Quantity']
        missing = [col for col in required if col not in self.df.columns]
        
        if missing:
            raise ValueError(f"Missing required columns: {missing}")
        
        return self
    
    def clean_dates(self):
        """Clean and validate date columns"""
        print("\nCleaning dates...")
        self.df['Purchase Date'] = pd.to_datetime(self.df['Purchase Date'], errors='coerce')
        
        invalid_dates = self.df['Purchase Date'].isna().sum()
        if invalid_dates > 0:
            print(f"  Removing {invalid_dates} rows with invalid dates")
            self.df = self.df.dropna(subset=['Purchase Date'])
        
        self.df = self.df.sort_values('Purchase Date').reset_index(drop=True)
        return self
    
    def clean_numeric_columns(self):
        """Clean numeric columns"""
        print("Cleaning numeric columns...")
        
        for col in ['Total Price', 'Quantity']:
            if col in self.df.columns:
                self.df[col] = pd.to_numeric(self.df[col], errors='coerce')
                before = len(self.df)
                self.df = self.df[self.df[col] >= 0]
                removed = before - len(self.df)
                if removed > 0:
                    print(f"  Removed {removed} rows with invalid {col}")
        
        # Remove rows where quantity is 0
        self.df = self.df[self.df['Quantity'] > 0]
        
        return self
    
    def clean_categorical_columns(self):
        """Clean categorical columns"""
        print("Cleaning categorical columns...")
        
        if 'Order Status' in self.df.columns:
            self.df['Order Status'] = self.df['Order Status'].str.strip().str.title()
        
        if 'Product Type' in self.df.columns:
            self.df['Product Type'] = self.df['Product Type'].str.strip().str.title()
        
        return self
    
    def keep_completed_orders_only(self):
        """Keep only completed orders for forecasting"""
        print("Filtering completed orders...")
        before = len(self.df)
        self.df = self.df[self.df['Order Status'] == 'Completed'].copy()
        removed = before - len(self.df)
        print(f"  Kept {len(self.df)} completed orders (removed {removed} non-completed)")
        return self
    
    def create_forecasting_columns(self):
        """Create only the columns needed for forecasting"""
        print("Creating forecasting columns...")
        
        # Date (just the date part, no time)
        self.df['Date'] = self.df['Purchase Date'].dt.date
        self.df['Date'] = pd.to_datetime(self.df['Date'])
        
        # Product category (handle missing)
        if 'Product Type' not in self.df.columns:
            self.df['Product_Type'] = 'Unknown'
        else:
            self.df['Product_Type'] = self.df['Product Type']
        
        # Revenue (same as Total Price)
        self.df['Revenue'] = self.df['Total Price']
        
        # Keep quantity as is
        self.df['Quantity'] = self.df['Quantity']
        
        return self
    
    def select_final_columns(self):
        """Select only the columns needed for forecasting"""
        print("Selecting final columns...")
        
        # Essential columns for forecasting
        final_columns = ['Date', 'Product_Type', 'Revenue', 'Quantity']
        
        self.df = self.df[final_columns].copy()
        
        print(f"  Final columns: {list(self.df.columns)}")
        print(f"  Final shape: {self.df.shape}")
        
        return self
    
    def save_cleaned_data(self):
        """Save cleaned data to CSV"""
        print(f"\nSaving cleaned data to: {self.output_file}")
        self.df.to_csv(self.output_file, index=False)
        print("✅ Data saved successfully")
        return self
    
    def generate_summary(self):
        """Generate summary of cleaned data"""
        print("\n" + "="*70)
        print("DATA PREPROCESSING SUMMARY")
        print("="*70)
        
        print(f"\n📊 Dataset Overview:")
        print(f"   Total rows: {len(self.df):,}")
        print(f"   Date range: {self.df['Date'].min().strftime('%Y-%m-%d')} to {self.df['Date'].max().strftime('%Y-%m-%d')}")
        print(f"   Time span: {(self.df['Date'].max() - self.df['Date'].min()).days} days")
        print(f"   Unique dates: {self.df['Date'].nunique()}")
        
        print(f"\n💰 Revenue Stats:")
        print(f"   Total revenue: ${self.df['Revenue'].sum():,.2f}")
        print(f"   Average per transaction: ${self.df['Revenue'].mean():.2f}")
        print(f"   Total units sold: {self.df['Quantity'].sum():,.0f}")
        
        if 'Product_Type' in self.df.columns:
            print(f"\n🛍️  Product Categories:")
            print(f"   Unique categories: {self.df['Product_Type'].nunique()}")
            print("\n   Top 5 by revenue:")
            top_products = self.df.groupby('Product_Type')['Revenue'].sum().sort_values(ascending=False).head(5)
            for product, revenue in top_products.items():
                print(f"   • {product}: ${revenue:,.2f}")
        
        print(f"\n📈 Daily Aggregates Preview:")
        daily = self.df.groupby('Date').agg({
            'Revenue': 'sum',
            'Quantity': 'sum'
        })
        print(f"   Average daily revenue: ${daily['Revenue'].mean():,.2f}")
        print(f"   Max daily revenue: ${daily['Revenue'].max():,.2f}")
        print(f"   Average daily units: {daily['Quantity'].mean():.1f}")
        
        print("\n" + "="*70)
        print("✅ Data is ready for forecasting!")
        print("="*70)
        
        return self
    
    def process_all(self):
        """Execute full preprocessing pipeline"""
        print("="*70)
        print("STARTING DATA PREPROCESSING")
        print("="*70)
        
        (self
            .load_data()
            .validate_required_columns()
            .clean_dates()
            .clean_numeric_columns()
            .clean_categorical_columns()
            .keep_completed_orders_only()
            .create_forecasting_columns()
            .select_final_columns()
            .save_cleaned_data()
            .generate_summary())
        
        return self


if __name__ == "__main__":
    try:
        # Initialize preprocessor
        preprocessor = DataPreprocessor(
            input_file='data.csv',
            output_file='cleaned_customer_data.csv'
        )
        
        # Run full pipeline
        preprocessor.process_all()
        
        print("\n" + "="*70)
        print("Next step: Run forecastingengine.py to train models")
        print("="*70)
        
    except FileNotFoundError:
        print("❌ Error: 'data.csv' not found in current directory")
        print("Please ensure your data file is named 'data.csv'")
    except Exception as e:
        print(f"❌ Error during preprocessing: {str(e)}")
        import traceback
        traceback.print_exc()