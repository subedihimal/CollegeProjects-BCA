"""Create the cleaned transaction file used by the forecasting pipeline."""

from pathlib import Path

import pandas as pd


DATA_DIRECTORY = Path(__file__).resolve().parent
RAW_DATA = DATA_DIRECTORY / "data.csv"
CLEAN_DATA = DATA_DIRECTORY / "cleaned_customer_data.csv"
REQUIRED_COLUMNS = {
    "Purchase Date",
    "Order Status",
    "Product Type",
    "Total Price",
    "Quantity",
}


def clean_data(
    input_file: Path = RAW_DATA,
    output_file: Path = CLEAN_DATA,
) -> pd.DataFrame:
    """Filter completed valid orders and save forecasting columns."""
    data = pd.read_csv(input_file)
    missing = REQUIRED_COLUMNS.difference(data.columns)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")

    data["Purchase Date"] = pd.to_datetime(
        data["Purchase Date"], errors="coerce"
    )
    data["Total Price"] = pd.to_numeric(data["Total Price"], errors="coerce")
    data["Quantity"] = pd.to_numeric(data["Quantity"], errors="coerce")
    data["Order Status"] = data["Order Status"].str.strip().str.title()
    data["Product Type"] = data["Product Type"].str.strip().str.title()

    valid = (
        data["Purchase Date"].notna()
        & data["Total Price"].ge(0)
        & data["Quantity"].gt(0)
        & data["Order Status"].eq("Completed")
    )
    cleaned = (
        data.loc[valid]
        .sort_values(
            ["Purchase Date", "Product Type", "Total Price", "Quantity"],
            kind="stable",
        )
        .assign(Date=lambda frame: frame["Purchase Date"].dt.normalize())
        .rename(
            columns={
                "Product Type": "Product_Type",
                "Total Price": "Revenue",
            }
        )[["Date", "Product_Type", "Revenue", "Quantity"]]
        .reset_index(drop=True)
    )
    cleaned.to_csv(output_file, index=False)
    return cleaned


if __name__ == "__main__":
    result = clean_data()
    print(f"Saved {len(result):,} cleaned rows to {CLEAN_DATA}")
