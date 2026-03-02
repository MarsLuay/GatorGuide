/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        emerald: {
          50: "#b6e2b6",
          100: "#8cd19e",
          200: "#63b48b",
          300: "#3a9e75",
          400: "#1f8a5d",
          500: "#008f4e",
          600: "#00753e",
          700: "#00572b",
          800: "#003b1a",
          900: "#001f0f",
        },
        danger: "#EF4444",
        neutral: {
          300: "#9CA3AF",
          500: "#6B7280",
          600: "#4B5563",
          700: "#374151",
          800: "#1F2937",
          900: "#111827",
        },
        gray: {
          50: "#F9FAFB",
          100: "#F3F4F6",
          200: "#E5E7EB",
          300: "#D1D5DB",
          400: "#9CA3AF",
          500: "#6B7280",
          600: "#6B7280",
          900: "#111827",
        },
      },
    },
  },
  plugins: [],
};
