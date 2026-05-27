export type Category = {
  id: number;
  name: string;
  slug: string;
};

export type Product = {
  id: number;
  slug: string;
  name: string;
  description: string;
  price: string;
  stock: number;
  imageUrl: string;
  galleryImages: string[];
  category: string;
  featured: boolean;
};

export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type OrderItem = {
  productId: number;
  slug: string;
  name: string;
  price: string;
  quantity: number;
  subtotal: string;
};

export type Order = {
  id: number;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingPostalCode: string;
  shippingCountry: string;
  shippingProvider: string;
  shippingService: string;
  shippingCost: string;
  shippingEta: string;
  shippingTrackingNumber: string;
  shippingTrackingUrl: string;
  status: OrderStatus;
  subtotalAmount: string;
  totalAmount: string;
  items: OrderItem[];
  events: OrderEvent[];
  createdAt: string;
  updatedAt: string;
};

export type OrderEvent = {
  id: number;
  type: "created" | "status_changed" | "shipping_updated";
  message: string;
  createdAt: string;
};

export type StoreSettings = {
  storeName: string;
  whatsappNumber: string;
  shipping: {
    provider: string;
    service: string;
    freeShippingMinimum: number;
    cabaRate: number;
    gbaRate: number;
    interiorRate: number;
  };
  promoBanner: {
    enabled: boolean;
    title: string;
    message: string;
    ctaLabel: string;
    ctaUrl: string;
    startsAt: string;
    endsAt: string;
  };
};

export type AdminAccount = {
  name: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
};

export type Database = {
  categories: Category[];
  products: Product[];
  orders: Order[];
  settings: StoreSettings;
  admin?: AdminAccount;
};
