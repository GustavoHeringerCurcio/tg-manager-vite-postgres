export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(228 13% 25%)",
        input: "hsl(228 13% 22%)",
        ring: "hsl(235 70% 60%)",
        background: "hsl(0 0% 9%)",
        foreground: "hsl(0 0% 98%)",
        primary: {
          DEFAULT: "hsl(235 70% 60%)",
          foreground: "hsl(0 0% 100%)",
        },
        secondary: {
          DEFAULT: "hsl(228 15% 20%)",
          foreground: "hsl(0 0% 98%)",
        },
        destructive: {
          DEFAULT: "hsl(0 70% 55%)",
          foreground: "hsl(0 0% 98%)",
        },
        muted: {
          DEFAULT: "hsl(228 15% 18%)",
          foreground: "hsl(228 8% 65%)",
        },
        accent: {
          DEFAULT: "hsl(235 25% 22%)",
          foreground: "hsl(0 0% 98%)",
        },
        popover: {
          DEFAULT: "hsl(225 12% 18%)",
          foreground: "hsl(0 0% 98%)",
        },
        card: {
          DEFAULT: "hsl(225 10% 16%)",
          foreground: "hsl(0 0% 98%)",
        },
        sidebar: {
          DEFAULT: "hsl(235 12% 10%)",
          foreground: "hsl(0 0% 98%)",
          primary: "hsl(235 70% 60%)",
          "primary-foreground": "hsl(0 0% 98%)",
          accent: "hsl(235 18% 16%)",
          "accent-foreground": "hsl(0 0% 98%)",
          border: "hsl(228 13% 20%)",
          ring: "hsl(235 70% 60%)",
        },
      },
      borderRadius: {
        lg: "0.625rem",
        md: "calc(0.625rem - 2px)",
        sm: "calc(0.625rem - 4px)",
        xl: "calc(0.625rem + 2px)",
      },
      boxShadow: {
        card: "0 0 0 1px hsl(228 13% 25%), 0 2px 8px 0 rgba(0, 0, 0, 0.4)",
      },
    },
  },
  plugins: [],
};
