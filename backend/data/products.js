const products = [
  // Smartphones
  {
    name: 'iPhone 13 128GB Memory - Midnight Black',
    image: '/images/phone_iphone13_black.jpg',
    description:
      'RAM: 6GB, Storage: 128GB, Display: 6.1-inch Super Retina XDR, Chip: A15 Bionic, Camera: Dual 12MP, Connectivity: 5G, Battery: Long life, Water Resistance: IP68, Design: Ceramic Shield front, OS: iOS',
    brand: 'Apple',
    category: 'Smartphone',
    price: 599.99,
    countInStock: 7,
    rating: 4.0,
    numReviews: 8,
  },
  {
    name: 'Samsung Galaxy S21 - Phantom Gray',
    image: '/images/phone_galaxy_s21_gray.jpg',
    description:
      'RAM: 8GB, Storage: 128GB, Display: 6.2-inch AMOLED, Chip: Exynos 2100, Camera: Triple 12MP, Connectivity: 5G, Battery: 4000mAh, OS: Android',
    brand: 'Samsung',
    category: 'Smartphone',
    price: 649.99,
    countInStock: 5,
    rating: 4.2,
    numReviews: 12,
  },
  {
    name: 'Google Pixel 6 - Sorta Seafoam',
    image: '/images/phone_pixel6_seafoam.jpg',
    description:
      'RAM: 8GB, Storage: 128GB, Display: 6.4-inch OLED, Chip: Google Tensor, Camera: Dual 50MP + 12MP, Connectivity: 5G, Battery: 4614mAh, OS: Android',
    brand: 'Google',
    category: 'Smartphone',
    price: 599.99,
    countInStock: 6,
    rating: 4.3,
    numReviews: 10,
  },

  // Tablets
  {
    name: 'Samsung Galaxy Tab S7 - Mystic Black',
    image: '/images/tablet_galaxy_tab_s7_black.jpg',
    description:
      'RAM: 6GB, Storage: 128GB, Display: 11-inch LTPS LCD, Chip: Snapdragon 865+, Camera: 13MP rear, Connectivity: Wi-Fi, 5G options, Battery: 8000mAh, OS: Android',
    brand: 'Samsung',
    category: 'Tablet',
    price: 499.99,
    countInStock: 5,
    rating: 4.3,
    numReviews: 10,
  },
  {
    name: 'Apple iPad Air - Sky Blue',
    image: '/images/tablet_ipad_air_skyblue.jpg',
    description:
      'RAM: 4GB, Storage: 256GB, Display: 10.9-inch Liquid Retina, Chip: A14 Bionic, Camera: 12MP rear, Connectivity: Wi-Fi + Cellular options, Battery: Up to 10 hours, OS: iPadOS',
    brand: 'Apple',
    category: 'Tablet',
    price: 599.99,
    countInStock: 8,
    rating: 4.6,
    numReviews: 14,
  },
  {
    name: 'Microsoft Surface Pro 8 - Platinum',
    image: '/images/tablet_surface_pro8_platinum.jpg',
    description:
      'RAM: 8GB, Storage: 256GB SSD, Display: 13-inch PixelSense Flow, Chip: Intel Core i5 11th Gen, Battery: Up to 16 hours, OS: Windows 11',
    brand: 'Microsoft',
    category: 'Tablet',
    price: 1099.99,
    countInStock: 5,
    rating: 4.4,
    numReviews: 11,
  },

  // Laptops
  {
    name: 'Dell XPS 13 Laptop - Platinum Silver',
    image: '/images/laptop_dell_xps13_silver.jpg',
    description:
      'RAM: 16GB, Storage: 512GB SSD, Display: 13.4-inch FHD+, Chip: Intel Core i7 11th Gen, Graphics: Intel Iris Xe, Battery: Long life, OS: Windows 11',
    brand: 'Dell',
    category: 'Laptop',
    price: 1199.99,
    countInStock: 3,
    rating: 4.5,
    numReviews: 15,
  },
  {
    name: 'HP Spectre x360 Laptop - Nightfall Black',
    image: '/images/laptop_hp_spectre_x360_black.jpg',
    description:
      'RAM: 16GB, Storage: 1TB SSD, Display: 13.3-inch 4K UHD, Chip: Intel Core i7 11th Gen, Battery: Long life, OS: Windows 11',
    brand: 'HP',
    category: 'Laptop',
    price: 1399.99,
    countInStock: 2,
    rating: 4.6,
    numReviews: 8,
  },
  {
    name: 'MacBook Pro 14-inch - Space Gray',
    image: '/images/laptop_macbookpro14_spacegray.jpg',
    description:
      'RAM: 16GB, Storage: 512GB SSD, Display: 14.2-inch Liquid Retina XDR, Chip: Apple M1 Pro, Battery: Up to 17 hours, OS: macOS',
    brand: 'Apple',
    category: 'Laptop',
    price: 1999.99,
    countInStock: 4,
    rating: 4.8,
    numReviews: 20,
  },

  // Smartwatches
  {
    name: 'Apple Watch Series 7 - Starlight',
    image: '/images/smartwatch_apple_watch7_starlight.jpg',
    description:
      'Display: 1.69-inch OLED, Chip: S7 SiP, Connectivity: GPS + Cellular options, Sensors: Heart rate, SpO2, ECG, Battery: Up to 18 hours, OS: watchOS',
    brand: 'Apple',
    category: 'Smartwatch',
    price: 399.99,
    countInStock: 6,
    rating: 4.7,
    numReviews: 20,
  },
  {
    name: 'Samsung Galaxy Watch 4 - Black',
    image: '/images/smartwatch_galaxy_watch4_black.jpg',
    description:
      'Display: 1.4-inch Super AMOLED, Chip: Exynos W920, Sensors: Heart rate, ECG, SpO2, Battery: Up to 40 hours, OS: Wear OS',
    brand: 'Samsung',
    category: 'Smartwatch',
    price: 249.99,
    countInStock: 7,
    rating: 4.4,
    numReviews: 14,
  },
  {
    name: 'Fitbit Versa 3 - Pink Clay',
    image: '/images/smartwatch_fitbit_versa3_pinkclay.jpg',
    description:
      'Display: 1.58-inch AMOLED, Connectivity: GPS, Heart rate monitor, Sleep tracking, Battery: Up to 6 days, OS: Fitbit OS',
    brand: 'Fitbit',
    category: 'Smartwatch',
    price: 229.99,
    countInStock: 9,
    rating: 4.3,
    numReviews: 13,
  },

  // Headphones
  {
    name: 'Airpods First Gen - White',
    image: '/images/headphones_airpods_firstgen_white.jpg',
    description:
      'Bluetooth: Wireless connection, Audio: High-quality AAC, Microphone: Built-in for calls, Compatibility: Works with compatible devices, Use: Immersive listening experience',
    brand: 'Apple',
    category: 'Headphones',
    price: 89.99,
    countInStock: 10,
    rating: 4.5,
    numReviews: 12,
  },
  {
    name: 'Sony WH-1000XM4 - Black',
    image: '/images/headphones_sony_wh1000xm4_black.jpg',
    description:
      'Bluetooth: Wireless, Noise Cancellation: Industry-leading, Battery: Up to 30 hours, Microphone: Built-in for calls, Audio: Hi-Res, Compatibility: Multi-device pairing',
    brand: 'Sony',
    category: 'Headphones',
    price: 349.99,
    countInStock: 4,
    rating: 4.8,
    numReviews: 25,
  },
  {
    name: 'Bose QuietComfort 35 II - Black',
    image: '/images/headphones_bose_qc35ii_black.jpg',
    description:
      'Bluetooth: Wireless, Noise Cancellation: Advanced, Battery: Up to 20 hours, Microphone: Built-in, Audio: High fidelity sound',
    brand: 'Bose',
    category: 'Headphones',
    price: 299.99,
    countInStock: 5,
    rating: 4.7,
    numReviews: 18,
  },
  {
    name: 'Jabra Elite 85t - Titanium Black',
    image: '/images/headphones_jabra_elite85t_titaniumblack.jpg',
    description:
      'Bluetooth: True wireless, Noise Cancellation: Adjustable ANC, Battery: Up to 5.5 hours, Microphone: Built-in, Audio: Powerful sound',
    brand: 'Jabra',
    category: 'Headphones',
    price: 229.99,
    countInStock: 6,
    rating: 4.4,
    numReviews: 16,
  },
];
export default products;