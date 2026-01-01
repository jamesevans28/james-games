/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Neo-Arcade dark palette - inverted (50 = darkest, 900 = lightest)
        flingo: {
          50: "#1e2028",
          100: "#252832",
          200: "#2d313d",
          300: "#3a3f4f",
          400: "#4a5066",
          500: "#5c6380",
          600: "#7a829f",
          700: "#9fa6be",
          800: "#c4c9d9",
          900: "#eaecf2",
        },
        // Neon accent colors
        neon: {
          lime: "#c8ff32",
          pink: "#ff3eb5",
          blue: "#32d4ff",
          yellow: "#ffeb3b",
          orange: "#ff7a32",
          purple: "#b366ff",
        },
        // Legacy candy aliases for compatibility
        candy: {
          pink: "#ff3eb5",
          yellow: "#ffeb3b",
          mint: "#c8ff32",
          sky: "#32d4ff",
        },
        // Surface colors
        surface: {
          dark: "#1a1c23",
          card: "#22252e",
          elevated: "#2a2e38",
        },
      },
      fontFamily: {
        display: ["Baloo 2", "Nunito", "Arial", "sans-serif"],
        sans: ["Baloo 2", "Nunito", "Arial", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        "neon-lime": "0 0 20px rgba(200, 255, 50, 0.4), 0 0 40px rgba(200, 255, 50, 0.2)",
        "neon-pink": "0 0 20px rgba(255, 62, 181, 0.4), 0 0 40px rgba(255, 62, 181, 0.2)",
        "neon-blue": "0 0 20px rgba(50, 212, 255, 0.4), 0 0 40px rgba(50, 212, 255, 0.2)",
        fun: "0 4px 20px -2px rgba(200, 255, 50, 0.25)",
        "fun-lg": "0 8px 30px -4px rgba(200, 255, 50, 0.35)",
        card: "0 4px 16px -4px rgba(0, 0, 0, 0.5)",
        "card-hover": "0 8px 32px -4px rgba(200, 255, 50, 0.2)",
      },
      backgroundImage: {
        "gradient-neon": "linear-gradient(135deg, #c8ff32 0%, #32d4ff 50%, #ff3eb5 100%)",
        "gradient-lime": "linear-gradient(135deg, #c8ff32 0%, #9fdf00 100%)",
        "gradient-pink": "linear-gradient(135deg, #ff3eb5 0%, #e02090 100%)",
        "gradient-dark": "linear-gradient(180deg, #1a1c23 0%, #22252e 100%)",
      },
      animation: {
        "bounce-slow": "bounce 2s infinite",
        wiggle: "wiggle 1s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "bounce-in": "bounce-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        shimmer: "shimmer 2s linear infinite",
        "slide-up": "slide-up 0.4s ease-out forwards",
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
        "glow-pulse": {
          "0%, 100%": { filter: "drop-shadow(0 0 8px rgba(200, 255, 50, 0.6))" },
          "50%": { filter: "drop-shadow(0 0 20px rgba(200, 255, 50, 0.9))" },
        },
        "bounce-in": {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "50%": { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "slide-up": {
          from: { transform: "translateY(20px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
