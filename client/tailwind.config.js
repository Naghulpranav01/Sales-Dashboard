export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"]
      },
      colors: {
        ink: "#101413",
        panel: "#171d1b",
        line: "#26302d",
        accent: "#14b88a"
      }
    }
  },
  plugins: []
};
