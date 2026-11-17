export const productScreens = {
  dashboard: {
    src: "/product/dashboard.png",
    title: "Web dashboard",
    alt: "Web workspace showing sidebar navigation, an empty device inventory and monitoring availability",
  },
  android: {
    src: "/product/android.png",
    title: "Android app",
    alt: "Android Home with workspace, phone, device and permissions links above floating bottom tabs",
  },
  ios: {
    src: "/product/ios.png",
    title: "iOS app",
    alt: "iOS Home with grouped menu rows and rounded floating bottom navigation",
  },
  desktop: {
    src: "/product/desktop.png",
    title: "Computer status",
    alt: "Desktop app with a rounded sidebar, computer status cards and quick access links",
  },
  services: {
    src: "/product/services.png",
    title: "Service inventory",
    alt: "Desktop service inventory with project search and an empty development services list",
  },
};
export type ProductScreen = keyof typeof productScreens;
