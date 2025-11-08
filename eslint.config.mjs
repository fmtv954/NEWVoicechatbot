import nextConfig from "eslint-config-next"

const config = [
  {
    ignores: ["**/*.d.ts", "node_modules", ".next", "dist", "build"],
  },
  ...nextConfig,
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "react-hooks/immutability": "off",
    },
  },
]

export default config
