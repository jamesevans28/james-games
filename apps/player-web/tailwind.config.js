/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Primary purple gradient colors (from logo)
        flingo: {
          50: "#FAF5FF",
          100: "#F3E8FF",
          200: "#E9D5FF",
          300: "#D8B4FE",
          400: "#C084FC",
          500: "#A855F7", // Primary purple
          600: "#9333EA",
          700: "#7C3AED", // Deep purple
          800: "#6366F1", // Indigo accent
          900: "#4C1D95",
        },
        // Accent colors (from logo decorations)
        candy: {
          pink: "#F472B6",
          yellow: "#FBBF24",
          mint: "#34D399",
          sky: "#60A5FA",
        },
      },
      fontFamily: {
        display: ["Fredoka", "Arial", "sans-serif"],
        sans: ["Fredoka", "Arial", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        fun: "0 4px 20px -2px rgba(168, 85, 247, 0.25)",
        "fun-lg": "0 8px 30px -4px rgba(168, 85, 247, 0.35)",
        card: "0 2px 12px -2px rgba(0, 0, 0, 0.08)",
        "card-hover": "0 8px 24px -4px rgba(168, 85, 247, 0.2)",
      },
      backgroundImage: {
        "gradient-flingo": "linear-gradient(135deg, #A855F7 0%, #7C3AED 50%, #6366F1 100%)",
        "gradient-candy": "linear-gradient(135deg, #FBBF24 0%, #F472B6 50%, #60A5FA 100%)",
        "gradient-fun": "linear-gradient(180deg, #FAF5FF 0%, #FFF7ED 50%, #ECFDF5 100%)",
      },
      animation: {
        "bounce-slow": "bounce 2s infinite",
        wiggle: "wiggle 1s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
      },
      keyframes: {
        wiggle: {
          "0%, 100%": { transform: "rotate(-3deg)" },
          "50%": { transform: "rotate(3deg)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
