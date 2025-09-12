import pandas as pd
import numpy as np
from datetime import datetime
import re
import warnings
warnings.filterwarnings('ignore')

def clean_customer_data(file_path):
    """
    Clean customer data for time series forecasting
    
    Parameters:
    file_path (str): Path to the CSV file
    
    Returns:
    pd.DataFrame: Cleaned dataset
    """
    
    # Read the data
    print("Reading data...")
    df = pd.read_csv(file_path)
    
    print(f"Original data shape: {df.shape}")
    print(f"Original columns: {list(df.columns)}")
    
    # Make a copy for cleaning
    df_clean = df.copy()
    
    # 1. Clean column names (remove extra spaces)
    df_clean.columns = df_clean.columns.str.strip()
    
    # 2. Handle date column
    print("\nCleaning date column...")
    df_clean['Purchase Date'] = pd.to_datetime(df_clean['Purchase Date'], errors='coerce')
    
    # Remove rows with invalid dates
    invalid_dates = df_clean['Purchase Date'].isna().sum()
    if invalid_dates > 0:
        print(f"Removing {invalid_dates} rows with invalid dates")
        df_clean = df_clean.dropna(subset=['Purchase Date'])
    
    # 3. Clean numeric columns
    print("Cleaning numeric columns...")
    numeric_columns = ['Age', 'Rating', 'Total Price', 'Unit Price', 'Quantity', 'Add-on Total']
    
    for col in numeric_columns:
        if col in df_clean.columns:
            # Convert to numeric, coercing errors to NaN
            df_clean[col] = pd.to_numeric(df_clean[col], errors='coerce')
            
            # Handle negative values (shouldn't exist for these metrics)
            if col in ['Total Price', 'Unit Price', 'Quantity', 'Add-on Total', 'Age']:
                df_clean = df_clean[df_clean[col] >= 0]
            
            # Handle Rating bounds (should be 1-5)
            if col == 'Rating':
                df_clean = df_clean[(df_clean[col] >= 1) & (df_clean[col] <= 5)]
            
            # Handle Age bounds (reasonable limits)
            if col == 'Age':
                df_clean = df_clean[(df_clean[col] >= 10) & (df_clean[col] <= 100)]
    
    # 4. Clean categorical columns
    print("Cleaning categorical columns...")
    
    # Clean Gender
    if 'Gender' in df_clean.columns:
        df_clean['Gender'] = df_clean['Gender'].str.strip().str.title()
        # Keep only Male/Female, mark others as 'Other'
        valid_genders = ['Male', 'Female']
        df_clean['Gender'] = df_clean['Gender'].apply(
            lambda x: x if x in valid_genders else 'Other'
        )
    
    # Clean Loyalty Member
    if 'Loyalty Member' in df_clean.columns:
        df_clean['Loyalty Member'] = df_clean['Loyalty Member'].str.strip().str.title()
        # Convert to boolean
        df_clean['Loyalty Member'] = df_clean['Loyalty Member'].map({'Yes': True, 'No': False})
    
    # Clean Order Status
    if 'Order Status' in df_clean.columns:
        df_clean['Order Status'] = df_clean['Order Status'].str.strip().str.title()
    
    # Clean Product Type
    if 'Product Type' in df_clean.columns:
        df_clean['Product Type'] = df_clean['Product Type'].str.strip().str.title()
    
    # Clean Payment Method
    if 'Payment Method' in df_clean.columns:
        df_clean['Payment Method'] = df_clean['Payment Method'].str.strip().str.title()
        # Standardize payment methods
        payment_mapping = {
            'Credit Card': 'Credit Card',
            'Creditcard': 'Credit Card',
            'Debit Card': 'Debit Card',
            'Debitcard': 'Debit Card',
            'Paypal': 'PayPal',
            'Cash': 'Cash'
        }
        df_clean['Payment Method'] = df_clean['Payment Method'].map(payment_mapping).fillna(df_clean['Payment Method'])
    
    # Clean Shipping Type
    if 'Shipping Type' in df_clean.columns:
        df_clean['Shipping Type'] = df_clean['Shipping Type'].str.strip().str.title()
    
    # 5. Handle Add-ons
    print("Processing add-ons...")
    if 'Add-ons Purchased' in df_clean.columns:
        # Fill NaN with empty string
        df_clean['Add-ons Purchased'] = df_clean['Add-ons Purchased'].fillna('')
        
        # Count number of add-ons
        df_clean['Addon_Count'] = df_clean['Add-ons Purchased'].apply(
            lambda x: len(x.split(',')) if x else 0
        )
    
    # Fill NaN in Add-on Total with 0
    if 'Add-on Total' in df_clean.columns:
        df_clean['Add-on Total'] = df_clean['Add-on Total'].fillna(0)
    
    # 6. Data validation checks
    print("Performing data validation...")
    
    # Check for logical inconsistencies
    if 'Total Price' in df_clean.columns and 'Unit Price' in df_clean.columns and 'Quantity' in df_clean.columns:
        # Calculate expected total (Unit Price * Quantity + Add-on Total)
        expected_total = (df_clean['Unit Price'] * df_clean['Quantity'] + 
                         df_clean.get('Add-on Total', 0))
        
        # Allow for small rounding differences (within 1% or $1, whichever is larger)
        tolerance = np.maximum(expected_total * 0.01, 1.0)
        price_discrepancy = np.abs(df_clean['Total Price'] - expected_total) > tolerance
        
        print(f"Found {price_discrepancy.sum()} rows with price discrepancies")
        
        # You can choose to either remove these or flag them
        df_clean['Price_Discrepancy'] = price_discrepancy
    
    # 7. Remove duplicates
    print("Removing duplicates...")
    initial_rows = len(df_clean)
    df_clean = df_clean.drop_duplicates()
    duplicates_removed = initial_rows - len(df_clean)
    print(f"Removed {duplicates_removed} duplicate rows")
    
    # 8. Create additional time-based features for forecasting
    print("Creating time-based features...")
    df_clean['Year'] = df_clean['Purchase Date'].dt.year
    df_clean['Month'] = df_clean['Purchase Date'].dt.month
    df_clean['Day'] = df_clean['Purchase Date'].dt.day
    df_clean['DayOfWeek'] = df_clean['Purchase Date'].dt.dayofweek
    df_clean['Quarter'] = df_clean['Purchase Date'].dt.quarter
    df_clean['WeekOfYear'] = df_clean['Purchase Date'].dt.isocalendar().week
    
    # 9. Sort by date for time series analysis
    df_clean = df_clean.sort_values('Purchase Date').reset_index(drop=True)
    
    # 10. Final data summary
    print(f"\nCleaned data shape: {df_clean.shape}")
    print(f"Date range: {df_clean['Purchase Date'].min()} to {df_clean['Purchase Date'].max()}")
    print(f"Missing values per column:")
    missing_values = df_clean.isnull().sum()
    for col, missing in missing_values.items():
        if missing > 0:
            print(f"  {col}: {missing} ({missing/len(df_clean)*100:.2f}%)")
    
    return df_clean

def generate_data_summary(df):
    """Generate a comprehensive summary of the cleaned data"""
    
    print("\n" + "="*60)
    print("DATA SUMMARY REPORT")
    print("="*60)
    
    # Basic info
    print(f"\nDataset Shape: {df.shape[0]} rows, {df.shape[1]} columns")
    
    # Date range
    if 'Purchase Date' in df.columns:
        print(f"Date Range: {df['Purchase Date'].min().strftime('%Y-%m-%d')} to {df['Purchase Date'].max().strftime('%Y-%m-%d')}")
        print(f"Time Span: {(df['Purchase Date'].max() - df['Purchase Date'].min()).days} days")
    
    # Numerical summaries
    print(f"\nNumerical Columns Summary:")
    numerical_cols = df.select_dtypes(include=[np.number]).columns
    print(df[numerical_cols].describe())
    
    # Categorical summaries
    print(f"\nCategorical Columns Summary:")
    categorical_cols = df.select_dtypes(include=['object']).columns
    for col in categorical_cols:
        if col not in ['Add-ons Purchased', 'SKU']:  # Skip detailed columns
            print(f"\n{col}:")
            print(df[col].value_counts().head())
    
    # Order status breakdown
    if 'Order Status' in df.columns:
        print(f"\nOrder Status Distribution:")
        status_counts = df['Order Status'].value_counts()
        for status, count in status_counts.items():
            print(f"  {status}: {count} ({count/len(df)*100:.2f}%)")
    
    return True

# Usage example
if __name__ == "__main__":
    # Using your data file
    file_path = 'data.csv'
    
    try:
        # Clean the data
        cleaned_df = clean_customer_data(file_path)
        
        # Generate summary
        generate_data_summary(cleaned_df)
        
        # Save cleaned data
        output_path = 'cleaned_customer_data.csv'
        cleaned_df.to_csv(output_path, index=False)
        print(f"\nCleaned data saved to: {output_path}")
        
        # Show first few rows
        print(f"\nFirst 5 rows of cleaned data:")
        print(cleaned_df.head())
        
    except FileNotFoundError:
        print(f"Error: File '{file_path}' not found.")
        print("Please update the file_path variable with your actual CSV file path.")
    except Exception as e:
        print(f"Error processing data: {str(e)}")