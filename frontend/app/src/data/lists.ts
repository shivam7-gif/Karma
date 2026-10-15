export interface ListItem {
  id: string;
  title: string;
  itemCount?: number;
}

export interface ListSection {
  title: string;
  items: ListItem[];
}

export interface ListData {
  shoppingLists: ListItem[];
  customLists: ListItem[];
}

export const initialListData: ListData = {
  shoppingLists: [
    { id: 'shop-1', title: 'Shopping', itemCount: 7 }
  ],
  customLists: [
    { id: 'cust-1', title: 'Next Event Checklist' },
    { id: 'cust-2', title: 'Whole Foods', itemCount: 10 },
    { id: 'cust-3', title: 'Thanksgiving', itemCount: 11 },
    { id: 'cust-4', title: 'Trip Packing' },
    { id: 'cust-5', title: 'Maul Packing', itemCount: 42 },
    { id: 'cust-6', title: 'London Packing', itemCount: 11 },
    { id: 'cust-7', title: 'Weekly Grocery', itemCount: 22 },
    { id: 'cust-8', title: 'Camping Trip', itemCount: 30 }
  ]
};
