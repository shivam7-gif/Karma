import type { AppBuildSpecification } from './types.js';

export function isAppBuildingPrompt(prompt: string): boolean {
  const p = prompt.trim().toLowerCase();
  
  // App creation triggers
  const creationVerbs = /\b(create|build|scaffold|develop|generate|code|make)\b/i.test(p);
  const targetAppTypes = /\b(app|application|platform|dashboard|system|website|portal|store|service)\b/i.test(p);
  const appDomains = /\b(food delivery|delivery|ecommerce|e-commerce|restaurant|checkout|saas|marketplace|social network|booking|admin dashboard|order tracking)\b/i.test(p);
  
  // Check for multi-module requirement descriptions like "with authentication, listings, cart, checkout..."
  const hasMultipleModules =
    [
      'authentication',
      'auth',
      'cart',
      'checkout',
      'listings',
      'search',
      'tracking',
      'dashboard',
      'orders',
      'admin',
    ].filter((term) => p.includes(term)).length >= 3;

  return (creationVerbs && targetAppTypes && (appDomains || hasMultipleModules)) ||
    (p.includes('food delivery app') && (p.includes('cart') || p.includes('dashboard') || p.includes('tracking')));
}

export function buildAppSpecification(userPrompt: string): AppBuildSpecification {
  const isFoodDelivery = /\b(food|delivery|restaurant|meal|menu|dishes)\b/i.test(userPrompt);

  const title = isFoodDelivery
    ? 'FeastFlow — Full-Stack Responsive Food Delivery Platform'
    : 'Full-Stack Modern Web Application';

  const summary = isFoodDelivery
    ? 'A complete, responsive multi-role food delivery platform featuring customer ordering, restaurant discovery, interactive cart & mock checkout, real-time order tracking, and a comprehensive restaurant admin dashboard.'
    : `Full-stack application generated from user prompt: "${userPrompt.slice(0, 100)}"`;

  const customerFacing = [
    'Clean, modern hero section with location/address picker and search bar.',
    'Curated cuisine category pills (Burgers, Asian, Pizza, Desserts, Healthy, Drinks).',
    'Featured restaurant carousel with dietary filters (Vegetarian, Vegan, Halal, Gluten-free).',
    'Interactive restaurant detail page with high-res food images, descriptions, item customizer modal (sizes, spice levels, add-ons).',
  ];

  const authentication = [
    'Multi-role secure authentication (Customer, Restaurant Owner, Admin).',
    'Customer registration, login, and password management with secure session/JWT.',
    'User profile page displaying saved delivery addresses, contact info, and previous orders.',
  ];

  const restaurantListingsAndSearch = [
    'Live search bar with instant autocomplete across restaurants, dishes, and cuisines.',
    'Filtering by delivery time (e.g. Under 30 mins), minimum order amount, and rating (> 4.5 stars).',
    'Restaurant card displaying average prep time, delivery fee, star rating, and price tier ($$).',
    'Categorized menu layout with sticky section navigation (Appetizers, Mains, Drinks, Desserts).',
  ];

  const cartAndCheckout = [
    'Slide-over / sticky cart panel with real-time price calculation, taxes, and delivery fees.',
    'Item quantity adjustments and item-level custom instructions.',
    'Delivery address selection with landmark instructions.',
    'Sandbox / Mock Payment Gateway integration (card, UPI/mock wallet, cash on delivery).',
    'Order placement confirmation with immediate order ID generation and invoice summary.',
  ];

  const orderStatusAndTracking = [
    'Live visual order progress stepper: Order Placed -> Confirmed by Kitchen -> Preparing -> Out for Delivery -> Delivered.',
    'Estimated time of arrival (ETA) countdown timer.',
    'Simulated courier location map / route card with driver contact mock button.',
    'Historical order log with one-click re-order functionality.',
  ];

  const adminAndRestaurantDashboard = [
    'Restaurant partner portal to toggle online/offline store status.',
    'Live order board with audible/visual alerts for incoming new orders (Accept / Reject / Ready for Pickup).',
    'Menu management CRUD: Add/edit dishes, prices, photos, and mark items out-of-stock.',
    'Business analytics overview: daily revenue, top-selling items, average fulfillment time.',
  ];

  const backendAndDatabase = [
    'REST or GraphQL API endpoints (Node.js/Express, Next.js API, or FastAPI).',
    'Relational schema (PostgreSQL / SQLite via Prisma or Drizzle ORM):',
    '  - Users (id, name, email, passwordHash, role, phone, addresses)',
    '  - Restaurants (id, name, description, cuisine, rating, deliveryTimeMin, coverImage)',
    '  - MenuItems (id, restaurantId, name, description, price, category, isAvailable, image)',
    '  - Orders (id, customerId, restaurantId, status, totalAmount, deliveryAddress, itemsJson, createdAt)',
    '  - OrderItems (id, orderId, menuItemId, quantity, unitPrice, customizationsJson)',
  ];

  const validationAndErrorStates = [
    'Strict input validation using Zod on both client and server.',
    'Graceful error states for network failure, empty search queries, and closed restaurants.',
    'Cart safety check: alert when adding items from a different restaurant than existing cart items.',
  ];

  const mobileAndAccessibility = [
    'Mobile-first responsive layout (smooth bottom navigation bar on mobile viewports).',
    'WCAG AA accessible contrast, keyboard navigation, and semantic HTML5 elements.',
    'Touch-friendly interactive targets (minimum 44x44px).',
  ];

  const mockPaymentNotice =
    'CRITICAL SAFEGUARD: Payment integration must strictly use a Sandbox / Mock simulator mode. Never collect real credit card numbers, live UPI credentials, or process actual bank transactions without explicit production authorization.';

  const setupAndEnvVars = [
    'PORT=3000',
    'DATABASE_URL=postgresql://user:password@localhost:5432/delivery_db',
    'JWT_SECRET=super-secret-development-key-change-in-production',
    'MOCK_PAYMENT_ENABLED=true',
    'NEXT_PUBLIC_APP_URL=http://localhost:3000',
  ];

  // Full formatted Markdown brief ready for Manus or Replit Agent
  const fullMarkdownBrief = `# ${title}
## Project Overview
${summary}

---

## 1. Customer-Facing Responsive UI
${customerFacing.map((item) => `- ${item}`).join('\n')}

## 2. Customer Authentication & Profiles
${authentication.map((item) => `- ${item}`).join('\n')}

## 3. Restaurant Listings, Search & Categories
${restaurantListingsAndSearch.map((item) => `- ${item}`).join('\n')}

## 4. Cart & Checkout Flow
${cartAndCheckout.map((item) => `- ${item}`).join('\n')}

## 5. Live Order Status & Tracking
${orderStatusAndTracking.map((item) => `- ${item}`).join('\n')}

## 6. Restaurant / Admin Dashboard
${adminAndRestaurantDashboard.map((item) => `- ${item}`).join('\n')}

## 7. Backend Architecture & Database Schema
${backendAndDatabase.map((item) => `- ${item}`).join('\n')}

## 8. Validation & Error Handling
${validationAndErrorStates.map((item) => `- ${item}`).join('\n')}

## 9. Mobile Responsiveness & Accessibility
${mobileAndAccessibility.map((item) => `- ${item}`).join('\n')}

## 10. Security & Mock Payment Policy
> 🛡️ **${mockPaymentNotice}**

---

## Environment Variables & Setup
\`\`\`env
${setupAndEnvVars.join('\n')}
\`\`\`

## Instructions for Agent
1. Scaffold clean modular directories (\`/client\`, \`/server\` or Next.js App Router).
2. Seed initial mock data for at least 6 restaurants and 24 delicious menu items.
3. Ensure all user flows (browsing -> cart -> mock checkout -> order tracking -> admin view) are functional and demonstrable.
`;

  return {
    title,
    userPrompt,
    summary,
    targetPlatform: 'fullstack',
    features: {
      customerFacing,
      authentication,
      restaurantListingsAndSearch,
      cartAndCheckout,
      orderStatusAndTracking,
      adminAndRestaurantDashboard,
      backendAndDatabase,
      validationAndErrorStates,
      mobileAndAccessibility,
    },
    mockPaymentNotice,
    setupAndEnvVars,
    technicalStackPreference: 'TypeScript, React / Next.js, Node.js, Tailwind CSS / Vanilla CSS, PostgreSQL / SQLite',
    fullMarkdownBrief,
  };
}
