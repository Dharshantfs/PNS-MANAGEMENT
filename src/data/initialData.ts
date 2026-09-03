import { DailyMenu } from '../types';

// Demo food menu shown to tenants. Not property-specific data (that all lives
// in Firestore now - see src/services/firestoreService.ts) so it's fine to
// keep as static, hardcoded content here.
export const weeklyMenu: DailyMenu[] = [
  {
    day: 'Monday',
    breakfast: 'Idli, Medu Vada, Coconut Chutney, Sambar, Tea/Coffee',
    lunch: 'Steamed Rice, Dal Tadka, Aloo Gobhi, Curd, Pickle, Papad',
    dinner: 'Phulka / Roti, Paneer Masala, Veg Pulao, Dal Fry, Kheer',
  },
  {
    day: 'Tuesday',
    breakfast: 'Poha with Roasted Peanuts, Sev, Green Chutney, Tea/Coffee',
    lunch: 'Jeera Rice, Rajma Curry, Bhindi Fry, Fresh Salad, Buttermilk',
    dinner: 'Chapati, Mix Veg Curry, Egg Curry / Paneer Bhurji, Steamed Rice',
  },
  {
    day: 'Wednesday',
    breakfast: 'Masala Dosa, Potato Palya, Chutney, Sambar, Filter Coffee',
    lunch: 'South Indian Thali: Rice, Rasam, Sambar, Cabbage Poriyal, Curd',
    dinner: 'Tandoori Roti, Chicken Curry / Shahi Paneer, Fried Rice',
  },
  {
    day: 'Thursday',
    breakfast: 'Aloo Paratha with Fresh Curd, Butter, Pickle, Chai',
    lunch: 'Lemon Rice, Dal Makhani, Seasonal Dry Subzi, Raita',
    dinner: 'Phulka, Chana Masala, Vegetable Biryani, Boondi Raita',
  },
  {
    day: 'Friday',
    breakfast: 'Uttapam with Tomato Onion Topping, Sambar, Chutney, Tea',
    lunch: 'Steamed Rice, Moong Dal, Lauki Kofta, Papad, Curd',
    dinner: 'Butter Naan, Kadai Paneer / Kadai Chicken, Peas Pulao, Ice Cream',
  },
  {
    day: 'Saturday',
    breakfast: 'Puri Bhaji with Halwa, Tea/Coffee',
    lunch: 'Curd Rice with Pomegranate, Bisibelebath, Potato Chips, Pickle',
    dinner: 'Chapati, Malai Kofta, Kashmiri Pulao, Gulab Jamun',
  },
  {
    day: 'Sunday',
    breakfast: 'Upma with Kesari Bath (Chow Chow Bath), Filter Coffee',
    lunch: 'Special Dum Biryani (Chicken / Veg), Mirchi Ka Salan, Raita',
    dinner: 'Phulka, Dal Fry, Jeera Aloo, Steamed Rice, Sweet Payasam',
    special: 'Sunday Special Chicken / Paneer Dum Biryani Feast',
  },
];
